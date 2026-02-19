import torch
import open_clip
import numpy as np
import pickle
import os
import glob
import argparse
import s2sphere
from torchvision import transforms
from torch.utils.data import DataLoader, Dataset
from datasets import load_dataset
from PIL import Image, ImageFile
from tqdm import tqdm

# Evita errores por imágenes truncadas
ImageFile.LOAD_TRUNCATED_IMAGES = True

BATCH_SIZE = 20           # Usando GTX 1650 (4GB) (20 * 3 crops = 60 imágenes en VRAM)
NUM_WORKERS = 2           # Windows + HDD, subirlo empeora el rendimiento
CACHE_DIR = "D:/Datasets_Cache"
MAP_PATH = "../models/s2_class_map.pkl"
S2_LEVEL = 12

device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Preparando entorno")

# Cargamos mapa S2
with open(MAP_PATH, "rb") as f:
    data_loaded = pickle.load(f)
token_to_index = data_loaded["cell_to_idx"]

# Usamos el mapeo generado en el Notebook para mantener la coherencia
valid_tokens = list(token_to_index.keys())
print(f"Mapa cargado con {len(valid_tokens)} celdas válidas")

# Transformación Multi-Crop, en el dataset el tamaño de las imágenes es 910x512 o 682x512, ratios 16:9 o 4:3
# CLIP espera imágenes de 224x224, por lo que vamos a extraer recortes que cubran toda la panorámica
class MultiCropTransform:
    def __init__(self):
        self.normalize = transforms.Normalize(
            mean=(0.48145466, 0.4578275, 0.40821073), 
            std=(0.26862954, 0.26130258, 0.27577711)
        )
        self.to_tensor = transforms.ToTensor()
        self.resize_height = 224 # Altura fija

    def __call__(self, image):
        # Redimensionar manteniendo aspect ratio tal que la altura sea 224
        w, h = image.size
        scale = self.resize_height / h
        new_w = int(w * scale)
        new_h = self.resize_height
        image = image.resize((new_w, new_h), Image.BICUBIC)
        
        crops = []
        
        # Left Crop
        crops.append(image.crop((0, 0, 224, 224)))
        
        # Center Crop
        center_x = (new_w - 224) // 2
        crops.append(image.crop((center_x, 0, center_x + 224, 224)))
        
        # Right Crop
        crops.append(image.crop((new_w - 224, 0, new_w, 224)))
        
        # Convertir y Normalizar
        tensors = [self.normalize(self.to_tensor(crop)) for crop in crops]
        
        # Stackear en un solo tensor (3, 3, 224, 224)
        return torch.stack(tensors)

custom_transform = MultiCropTransform()

# Modelo base CLIP
# Usamos ViT-B-32 preentrenado
print("Cargando modelo CLIP")
model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
model = model.to(device)
model.eval()

# Dataset personalizado
class FeatureExtractionDataset(Dataset):
    def __init__(self, hf_dataset, indices, transform=None):
        self.dataset = hf_dataset
        self.indices = indices
        self.transform = transform

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, idx):
        try:
            real_idx = self.indices[idx]
            sample = self.dataset[real_idx]
            
            # Cargar imagen y convertir a RGB
            image = sample['image'].convert("RGB") 
            
            # Aplicamos Multi-Crop -> Devuelve (3, 3, 224, 224)
            if self.transform:
                image_tensor = self.transform(image)
            else:
                return None, None
            
            # Lat / Lon -> S2 Cell -> Int ID
            lat, lon = sample['latitude'], sample['longitude']
            p1 = s2sphere.LatLng.from_degrees(lat, lon)
            cell = s2sphere.CellId.from_lat_lng(p1).parent(S2_LEVEL)
            token = cell.to_token()

            # Si el token está en una clase válida, devolvemos su ID
            if token in token_to_index:
                label_id = token_to_index[token]
                return image_tensor, label_id
            else:
                return None, None
        except Exception as e:
            return None, None

def collate_fn_ignore_errors(batch):
    # Filtra fallos de lectura
    batch = [sample for sample in batch if sample[0] is not None]
    if len(batch) == 0: return None
    return torch.utils.data.dataloader.default_collate(batch)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["train", "val"], required=True, help="Split set to process")
    args = parser.parse_args()

    # Rutas dinámicas
    if args.split == "train":
        INDEX_FILE = "../models/train_indices.pkl"
        OUTPUT_DIR = "../models/checkpoints_features/train"
        HF_SPLIT = "train"
    else:
        INDEX_FILE = "../models/val_indices.pkl"
        OUTPUT_DIR = "../models/checkpoints_features/val"
        HF_SPLIT = "test" # El dataset oficial llama 'test' al set de validación

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Procesando split: {args.split} (Split: {HF_SPLIT}) -> {OUTPUT_DIR}")

    # Cargar índices
    if not os.path.exists(INDEX_FILE):
         # Fallback si no existe el fichero de indices
         print(f"No encontré {INDEX_FILE}, cargando dataset entero ??") # Esto debería fallar si no hay índices para val
         ds = load_dataset("osv5m/osv5m", split=HF_SPLIT, cache_dir=CACHE_DIR, trust_remote_code=True)
         valid_indices = range(len(ds))
    else:
        with open(INDEX_FILE, "rb") as f:
            valid_indices = pickle.load(f)
        ds = load_dataset("osv5m/osv5m", split=HF_SPLIT, cache_dir=CACHE_DIR, trust_remote_code=True)

    dataset = FeatureExtractionDataset(ds, valid_indices, transform=custom_transform)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, num_workers=NUM_WORKERS, collate_fn=collate_fn_ignore_errors)

    print("Iniciando extracción con Multi-Crop (3x features por imagen)")
    
    features_cache = []
    labels_cache = []
    chunk_counter = 0
    CHUNK_SIZE = 50000 # Guardar cada 50k vectores

    with torch.no_grad(): # Desactivado AMP para compatibilidad con Maxwell (GTX 980)
        for batch in tqdm(loader):
            if batch is None: continue
            
            images, labels = batch
            # images shape: (B, 3, 3, 224, 224) -> (Batch, Crops, Channels, H, W)
            
            # Aplanar para CLIP: (B*3, 3, 224, 224)
            b, n_crops, c, h, w = images.shape
            images = images.view(-1, c, h, w).to(device)
            
            # Extracción de features (B*3, 512)
            image_features = model.encode_image(images)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            
            # Reshape para volver a agrupar por imagen: (B, 3, 512)
            image_features = image_features.view(b, n_crops, -1)
            
            # Promediar los 3 crops: (B, 512)
            image_features = image_features.mean(dim=1)
            
            # Re-normalizar después del promedio (importante para cosine similarity/dot product)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            
            # Guardar en CPU como float16
            features_cache.append(image_features.cpu().numpy().astype(np.float16))
            labels_cache.append(labels.numpy().astype(np.int32)) # Guardamos enteros

            # Guardado intermedio
            if len(features_cache) * BATCH_SIZE >= CHUNK_SIZE:
                data_to_save = {
                    "features": np.concatenate(features_cache),
                    "labels": np.concatenate(labels_cache)
                }
                save_path = f"{OUTPUT_DIR}/chunk_{chunk_counter}.pkl"
                with open(save_path, "wb") as f:
                    pickle.dump(data_to_save, f)
                
                print(f"Chunk {chunk_counter} guardado.")
                features_cache = []
                labels_cache = []
                chunk_counter += 1

    # Último chunk
    if features_cache:
        data_to_save = {
            "features": np.concatenate(features_cache),
            "labels": np.concatenate(labels_cache)
        }
        with open(f"{OUTPUT_DIR}/chunk_{chunk_counter}.pkl", "wb") as f:
            pickle.dump(data_to_save, f)
        print("Extracción finalizada con éxito")