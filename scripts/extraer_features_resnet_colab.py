import os
import torch
import torchvision.models as tv_models
import torch.nn as nn
import numpy as np
import pickle
import pandas as pd
import s2sphere
from torchvision import transforms
from PIL import Image, ImageFile
from tqdm import tqdm
import urllib.request
import zipfile
import shutil

ImageFile.LOAD_TRUNCATED_IMAGES = True

BATCH_SIZE = 64 # Al leer de disco local (SSD NVMe de Colab) podemos subir el batch size

import os
# Detectamos si el usuario ha montado Google Drive previamente en Colab
if os.path.exists('/content/drive/MyDrive'):
    OUTPUT_DIR = "/content/drive/MyDrive/GeoGuessr_ResNet_Chunks"
    print(f"Google Drive detectado. Los chunks se guardarán a salvo en {OUTPUT_DIR}")
else:
    OUTPUT_DIR = "/content/models/checkpoints_features_resnet/train"
    print("Google Drive no detectado. Guardando en almacenamiento temporal (se perderá al cerrar).")

MAP_PATH = "/content/models/s2_class_map_multi.pkl"
CSV_URL = "https://huggingface.co/datasets/osv5m/osv5m/resolve/main/train.csv"
CSV_PATH = "/content/train.csv"
NUM_ZIPS_TO_PROCESS = 20 # 20 zips * ~50k = ~1 millón de imágenes

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Hardware: {device}")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Cargar el mapa de celdas S2
if not os.path.exists(MAP_PATH):
    raise FileNotFoundError(f"Falta el archivo {MAP_PATH}. ¡Súbelo a Colab dentro de la carpeta models!")

with open(MAP_PATH, "rb") as f:
    data_loaded = pickle.load(f)
map_l4 = data_loaded["L4"]["cell_to_idx"]
map_l7 = data_loaded["L7"]["cell_to_idx"]
map_l10 = data_loaded["L10"]["cell_to_idx"]

# 2. Descargar train.csv si no existe
if not os.path.exists(CSV_PATH):
    print("Descargando archivo de coordenadas (train.csv)...")
    urllib.request.urlretrieve(CSV_URL, CSV_PATH)

print("Cargando coordenadas en memoria...")
# Solo cargamos las columnas necesarias para ahorrar RAM
df = pd.read_csv(CSV_PATH, usecols=['id', 'latitude', 'longitude'], dtype={'id': str, 'latitude': float, 'longitude': float})
df.set_index('id', inplace=True)
df_dict = df.to_dict('index')
del df

# 3. Preparar Transformación y Modelo
class MultiCropTransform:
    def __init__(self):
        self.normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406], 
            std=[0.229, 0.224, 0.225]
        )
        self.to_tensor = transforms.ToTensor()
        self.resize_height = 224

    def __call__(self, image):
        w, h = image.size
        scale = self.resize_height / h
        new_w = int(w * scale)
        new_h = self.resize_height
        image = image.resize((new_w, new_h), Image.BICUBIC)
        crops = [
            image.crop((0, 0, 224, 224)),
            image.crop(((new_w - 224) // 2, 0, (new_w - 224) // 2 + 224, 224)),
            image.crop((new_w - 224, 0, new_w, 224))
        ]
        return torch.stack([self.normalize(self.to_tensor(c)) for c in crops])

custom_transform = MultiCropTransform()

print("Cargando ResNet50...")
resnet = tv_models.resnet50(weights=tv_models.ResNet50_Weights.IMAGENET1K_V2)
model = nn.Sequential(*list(resnet.children())[:-1], nn.Flatten()).to(device)
model.eval()

# 4. Procesar ZIPs uno por uno
chunk_counter = 0
features_cache = []
labels_cache = []
CHUNK_SIZE = 50000

for zip_idx in range(NUM_ZIPS_TO_PROCESS):
    zip_url = f"https://huggingface.co/datasets/osv5m/osv5m/resolve/main/images/train/{zip_idx:02d}.zip"
    zip_path = f"/content/temp_{zip_idx:02d}.zip"
    extract_dir = f"/content/images_temp"
    
    print(f"\n=======================================================")
    print(f"--- PROCESANDO LOTE {zip_idx+1}/{NUM_ZIPS_TO_PROCESS} (Aprox {chunk_counter*50}k imágenes procesadas) ---")
    print(f"=======================================================")
    
    print(f"Descargando {zip_url} a súper alta velocidad (SSD Colab)...")
    try:
        urllib.request.urlretrieve(zip_url, zip_path)
    except Exception as e:
        print(f"Error descargando {zip_url}: {e}. Terminando bucle.")
        break
        
    print(f"Descomprimiendo en disco local...")
    os.makedirs(extract_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    
    # Listar imágenes
    image_files = []
    for root, _, files in os.walk(extract_dir):
        for f in files:
            if f.endswith(".jpg"):
                image_files.append(os.path.join(root, f))
    
    print(f"Encontradas {len(image_files)} imágenes. Inyectando en ResNet50...")
    
    # Procesar en batches con barra de progreso
    for i in tqdm(range(0, len(image_files), BATCH_SIZE)):
        batch_files = image_files[i:i+BATCH_SIZE]
        batch_tensors = []
        batch_labels = []
        
        for img_path in batch_files:
            img_id = os.path.splitext(os.path.basename(img_path))[0]
            if img_id not in df_dict:
                continue
                
            lat = df_dict[img_id]['latitude']
            lon = df_dict[img_id]['longitude']
            p1 = s2sphere.LatLng.from_degrees(lat, lon)
            cell = s2sphere.CellId.from_lat_lng(p1)
            
            token_l4 = cell.parent(4).to_token()
            label_l4 = map_l4.get(token_l4, -100)
            if label_l4 == -100:
                continue
                
            token_l7 = cell.parent(7).to_token()
            token_l10 = cell.parent(10).to_token()
            label_l7 = map_l7.get(token_l7, -100)
            label_l10 = map_l10.get(token_l10, -100)
            
            try:
                with Image.open(img_path) as img:
                    img = img.convert("RGB")
                    tensor = custom_transform(img)
            except Exception:
                continue
                
            batch_tensors.append(tensor)
            batch_labels.append([label_l4, label_l7, label_l10])
            
        if not batch_tensors:
            continue
            
        images = torch.stack(batch_tensors)
        b, n_crops, c, h, w = images.shape
        images = images.view(-1, c, h, w).to(device)
        
        with torch.no_grad():
            image_features = model(images)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            image_features = image_features.view(b, n_crops, -1)
            image_features = image_features.mean(dim=1)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            
            features_cache.append(image_features.cpu().numpy().astype(np.float16))
            labels_cache.append(np.array(batch_labels, dtype=np.int32))
            
        # Guardar chunks si superamos el tamaño
        total_cached = sum(len(x) for x in features_cache)
        if total_cached >= CHUNK_SIZE:
            data_to_save = {
                "features": np.concatenate(features_cache),
                "labels": np.concatenate(labels_cache)
            }
            save_path = f"{OUTPUT_DIR}/chunk_{chunk_counter}.pkl"
            with open(save_path, "wb") as f:
                pickle.dump(data_to_save, f)
            print(f"\n[!] Chunk {chunk_counter} guardado ({total_cached} imágenes recolectadas).")
            features_cache = []
            labels_cache = []
            chunk_counter += 1

    # Limpieza crucial para no llenar el disco de Colab
    print("Borrando basurilla para liberar disco duro de Colab...")
    os.remove(zip_path)
    shutil.rmtree(extract_dir)

# Guardar último chunk restante
if features_cache:
    data_to_save = {
        "features": np.concatenate(features_cache),
        "labels": np.concatenate(labels_cache)
    }
    save_path = f"{OUTPUT_DIR}/chunk_{chunk_counter}.pkl"
    with open(save_path, "wb") as f:
        pickle.dump(data_to_save, f)
    print(f"\n[!] Último chunk guardado.")

print("\n🚀 ¡Extracción de 1 Millón de Imágenes FINALIZADA CON ÉXITO! 🚀")
