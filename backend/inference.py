import torch
import torch.nn.functional as F
import open_clip
import pickle
import s2sphere
from PIL import Image
import os
from pathlib import Path
from torchvision import transforms

# Configuración
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
MODEL_HEAD_PATH = MODELS_DIR / "checkpoints_model_multi/best_model_multi.pth"
MAP_PATH = MODELS_DIR / "s2_class_map_multi.pkl"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Iniciando sistema de predicción en {DEVICE}")

# Transformación Multi-Crop idéntica a extraer_features.py para que el modelo reciba lo mismo que en el entrenamiento
class MultiCropTransform:
    def __init__(self):
        self.normalize = transforms.Normalize(
            mean=(0.48145466, 0.4578275, 0.40821073), 
            std=(0.26862954, 0.26130258, 0.27577711)
        )
        self.to_tensor = transforms.ToTensor()
        self.resize_height = 224

    def __call__(self, image):
        w, h = image.size
        scale = self.resize_height / h
        new_w = int(w * scale)
        new_h = self.resize_height
        image = image.resize((new_w, new_h), Image.BICUBIC)
        
        crops = []
        crops.append(image.crop((0, 0, 224, 224)))
        center_x = (new_w - 224) // 2
        crops.append(image.crop((center_x, 0, center_x + 224, 224)))
        crops.append(image.crop((new_w - 224, 0, new_w, 224)))
        
        tensors = [self.normalize(self.to_tensor(crop)) for crop in crops]
        return torch.stack(tensors)

custom_transform = MultiCropTransform()

# Variables globales para mantener el modelo
backbone = None
head = None
idx_to_cell_l4 = None
num_classes_l4 = None
idx_to_cell_l7 = None
num_classes_l7 = None
idx_to_cell_l10 = None
num_classes_l10 = None
l10_to_l4_idx = None  # Lista que mapea el índice L10 a su índice L4 correspondiente

def load_model():
    global backbone, head
    global idx_to_cell_l4, num_classes_l4, idx_to_cell_l7, num_classes_l7, idx_to_cell_l10, num_classes_l10, l10_to_l4_idx
    
    if backbone is not None:
        return

    # Cargar mapa de clases
    print("Cargando mapa de clases")
    if not MAP_PATH.exists():
        raise FileNotFoundError(f"Mapa de clases no encontrado en {MAP_PATH}")
        
    with open(MAP_PATH, "rb") as f:
        map_data = pickle.load(f)
    
    idx_to_cell_l4 = {v: k for k, v in map_data["L4"]["cell_to_idx"].items()}
    num_classes_l4 = map_data["L4"]["total_cells"]
    idx_to_cell_l7 = {v: k for k, v in map_data["L7"]["cell_to_idx"].items()}
    num_classes_l7 = map_data["L7"]["total_cells"]
    idx_to_cell_l10 = {v: k for k, v in map_data["L10"]["cell_to_idx"].items()}
    num_classes_l10 = map_data["L10"]["total_cells"]

    # Precalcular mapa jerárquico L10 -> L4 para probabilidad conjunta
    print("Precalculando relaciones jerárquicas L10 -> L4")
    l10_to_l4_idx = []
    
    # Crear una lista rápida de celdas L4
    cells_l4 = [s2sphere.CellId.from_token(idx_to_cell_l4[i]) for i in range(num_classes_l4)]
    
    for j in range(num_classes_l10):
        token_l10 = idx_to_cell_l10[j]
        cell_l10 = s2sphere.CellId.from_token(token_l10)
        found_parent = -1
        # Buscar qué L4 lo contiene
        for i, cell_l4 in enumerate(cells_l4):
            if cell_l4.contains(cell_l10):
                found_parent = i
                break
        
        # Si por algún motivo matemático no encaja perfecto (bordes), asignamos el L4 más cercano o un neutro?
        # Para evitar cuelgues, si found_parent es -1 (no debería pasar), lo dejamos en 0.
        if found_parent == -1:
            found_parent = 0
            
        l10_to_l4_idx.append(found_parent)

    # Cargar CLIP
    print("Cargando CLIP (ViT-B-32)")
    backbone, _, _ = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    backbone.to(DEVICE)
    backbone.eval()

    # Cargar modelo entrenado
    print("Cargando modelo entrenado")
    import torch.nn as nn
    class GeoGuessrMultiHead(nn.Module):
        def __init__(self, input_dim=512, hidden_dim=1024):
            super().__init__()
            self.tronco = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.3)
            )
            self.cabeza_l4 = nn.Linear(hidden_dim, num_classes_l4)
            self.cabeza_l7 = nn.Linear(hidden_dim, num_classes_l7)
            self.cabeza_l10 = nn.Linear(hidden_dim, num_classes_l10)

        def forward(self, x):
            features = self.tronco(x)
            return self.cabeza_l4(features), self.cabeza_l7(features), self.cabeza_l10(features)

    head = GeoGuessrMultiHead()
    
    if not MODEL_HEAD_PATH.exists():
         raise FileNotFoundError(f"Modelo entrenado no encontrado en {MODEL_HEAD_PATH}")

    # El state_dict guardado parece tener "net.X" o haber sido guardado desde una clase.
    # Si las llaves empiezan con "net.", pero head es un Sequential directo,
    # necesitamos ajustar las llaves del state_dict o cargar en una clase igual.
    state_dict = torch.load(MODEL_HEAD_PATH, map_location=DEVICE)
    
    # Adaptar las llaves si tienen prefijo "net." pero nuestro mdulo es un Sequential directo,
    # donde las llaves esperadas son "0.weight", "1.weight", etc.
    new_state_dict = {}
    for k, v in state_dict.items():
        if k.startswith("net."):
            new_key = k.replace("net.", "", 1)
            new_state_dict[new_key] = v
        else:
            new_state_dict[k] = v
            
    head.load_state_dict(new_state_dict)
    head.to(DEVICE)
    head.eval()
    print("Modelo cargado exitosamente")

import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Radio de la Tierra en km
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def predict(images: list[Image.Image], top_k=5, true_coords=None):
    """
    Predice la ubicación para una lista de imágenes.
    Devuelve la predicción con la mayor confianza entre todas las imágenes,
    junto con las top k ubicaciones candidatas de esa mejor imagen.
    Devuelve { 
        "best": {lat: float, lng: float, confidence: float},
        "top_5": [ {lat: float, lng: float, confidence: float}, ... ]
    }
    """
    if not backbone:
        load_model()
    
    best_top_k_preds = []
    best_confidence = -1.0
    
    for i, img in enumerate(images):
        img = img.convert("RGB")
        # Generamos los 3 recortes: shape (3, 3, 224, 224)
        crops_tensor = custom_transform(img).to(DEVICE)

        with torch.no_grad():
            # Codificamos las 3 imágenes (3, 512)
            c_features = backbone.encode_image(crops_tensor)
            c_features /= c_features.norm(dim=-1, keepdim=True)
            
            # Promediamos y re-normalizamos (1, 512)
            features = c_features.mean(dim=0, keepdim=True)
            features /= features.norm(dim=-1, keepdim=True)
            
            # Pasamos flotantes puros al modelo MultiHead
            features = features.float()
            
            out_l4, out_l7, out_l10 = head(features)
            probs_l4 = F.softmax(out_l4, dim=1)
            
            # Determinar el país ganador (L4)
            top_prob_l4, top_idx_l4 = torch.max(probs_l4, 1)
            current_best_conf = top_prob_l4.item()
            winner_l4_idx = top_idx_l4.item()
            
            # Forzar que L10 solo pueda elegir ciudades del L4 ganador
            # Clonamos los logits de L10 para no modificar el tensor original
            masked_logits_l10 = out_l10.clone()
            
            # Crear máscara booleana: True para las ciudades que pertenecen al L4 ganador
            valid_l10_mask = torch.tensor([l10_to_l4_idx[j] == winner_l4_idx for j in range(num_classes_l10)], device=DEVICE)
            
            # Poner -infinito en los logits de las ciudades que NO son del L4 ganador
            masked_logits_l10[0, ~valid_l10_mask] = -float('inf')
            
            # Aplicar Softmax solo sobre las ciudades válidas (las inválidas tendrán prob = 0.0)
            filtered_probs_l10 = F.softmax(masked_logits_l10, dim=1)
                
            # Obtener las top K predicciones
            top_probs, top_indices = torch.topk(filtered_probs_l10, top_k)
            
            print(f"Imagen {i+1}: Confianza País (L4) {current_best_conf:.4f} | Ciudad Top 1 prob relativa: {top_probs[0][0].item():.4f}")

            if current_best_conf > best_confidence:
                best_confidence = current_best_conf
                
                # Procesar todas las top k para esta imagen ganadora
                current_top_preds = []
                for j in range(top_k):
                    conf = top_probs[0][j].item()
                    idx = top_indices[0][j].item()
                    
                    # Traducir ID -> S2 Token -> Lat/Lon
                    token = idx_to_cell_l10[idx]
                    cell_id = s2sphere.CellId.from_token(token)
                    lat_lng = cell_id.to_lat_lng()
                    lat = lat_lng.lat().degrees
                    lng = lat_lng.lng().degrees
                    
                    current_top_preds.append({
                        "lat": lat,
                        "lng": lng,
                        "confidence": conf
                    })
                
                best_top_k_preds = current_top_preds

    # El primer elemento en best_top_k_preds es el "mejor"
    best_prediction = best_top_k_preds[0] if best_top_k_preds else None
    
    if true_coords and best_prediction:
        dist_km = haversine(true_coords['lat'], true_coords['lng'], best_prediction['lat'], best_prediction['lng'])
        print(f"Mejor predicción seleccionada con confianza: {best_confidence:.4f} (Error: {dist_km:.2f} km)")
    else:
        print(f"Mejor predicción seleccionada con confianza: {best_confidence:.4f} (Error: Desconocido)")
    
    return {
        "best": best_prediction,
        "top_5": best_top_k_preds
    }
