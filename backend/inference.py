import torch
import torch.nn as nn
import torch.nn.functional as F
import open_clip
import pickle
import s2sphere
from PIL import Image
import json
from pathlib import Path
from torchvision import transforms
import math
import gc

# Configuración
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
CONFIG_PATH = MODELS_DIR / "config.json"
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

# Global CLIP backbone
backbone = None

# Model Cache
loaded_models = {}

class GeoGuessrMultiHead(nn.Module):
    def __init__(self, num_classes_l4, num_classes_l7, num_classes_l10, input_dim=512, hidden_dim=1024):
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



def load_clip():
    global backbone
    if backbone is None:
        print("Cargando CLIP (ViT-B-32)")
        backbone, _, _ = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
        backbone.to(DEVICE)
        backbone.eval()

def load_model(model_id: str):
    global loaded_models
    
    if model_id in loaded_models:
        return loaded_models[model_id]
        
    with open(CONFIG_PATH, "r") as f:
        config_data = json.load(f)
        
    if model_id not in config_data:
        raise ValueError(f"Modelo {model_id} no encontrado en config.json")
        
    model_info = config_data[model_id]
    m_type = model_info["type"]
    map_path = MODELS_DIR / model_info["map_path"]
    weights_path = MODELS_DIR / model_info["weights_path"]
    
    if not map_path.exists():
        raise FileNotFoundError(f"Mapa no encontrado: {map_path}")
    if not weights_path.exists():
        raise FileNotFoundError(f"Pesos no encontrados: {weights_path}")
        
    with open(map_path, "rb") as f:
        map_data = pickle.load(f)
        
    model_context = {"type": m_type}
    
    if m_type == "multi_head":
        idx_to_cell_l4 = {v: k for k, v in map_data["L4"]["cell_to_idx"].items()}
        num_classes_l4 = map_data["L4"]["total_cells"]
        idx_to_cell_l7 = {v: k for k, v in map_data["L7"]["cell_to_idx"].items()}
        num_classes_l7 = map_data["L7"]["total_cells"]
        idx_to_cell_l10 = {v: k for k, v in map_data["L10"]["cell_to_idx"].items()}
        num_classes_l10 = map_data["L10"]["total_cells"]
        
        l10_to_l4_idx = []
        cells_l4 = [s2sphere.CellId.from_token(idx_to_cell_l4[i]) for i in range(num_classes_l4)]
        for j in range(num_classes_l10):
            token_l10 = idx_to_cell_l10[j]
            cell_l10 = s2sphere.CellId.from_token(token_l10)
            found_parent = -1
            for i, cell_l4 in enumerate(cells_l4):
                if cell_l4.contains(cell_l10):
                    found_parent = i
                    break
            if found_parent == -1:
                found_parent = 0
            l10_to_l4_idx.append(found_parent)
            
        head = GeoGuessrMultiHead(num_classes_l4, num_classes_l7, num_classes_l10)
        
        model_context.update({
            "head": head,
            "idx_to_cell_l10": idx_to_cell_l10,
            "num_classes_l10": num_classes_l10,
            "l10_to_l4_idx": l10_to_l4_idx
        })
        
    elif m_type == "uni_head":
        if isinstance(map_data, dict):
            if "cell_to_idx" in map_data:
                idx_to_cell = {v: k for k, v in map_data["cell_to_idx"].items()}
                num_classes = map_data["total_cells"]
            else:
                level_key = next((k for k in map_data.keys() if isinstance(k, str) and k.startswith("L") and isinstance(map_data[k], dict)), None)
                if level_key and "cell_to_idx" in map_data[level_key]:
                    idx_to_cell = {v: k for k, v in map_data[level_key]["cell_to_idx"].items()}
                    num_classes = map_data[level_key]["total_cells"]
                else:
                    idx_to_cell = {i: token for i, token in enumerate(map_data.keys())}
                    num_classes = len(map_data)
        else:
             idx_to_cell = {i: token for i, token in enumerate(map_data)}
             num_classes = len(map_data)
             
        head = nn.Sequential(
            nn.Linear(512, 1024),
            nn.BatchNorm1d(1024),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(1024, num_classes)
        )        
        model_context.update({
            "head": head,
            "idx_to_cell": idx_to_cell,
            "num_classes": num_classes
        })
    else:
        raise ValueError(f"Tipo de modelo desconocido: {m_type}")

    state_dict = torch.load(weights_path, map_location=DEVICE)
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
    
    # Gestión de memoria: mantener máximo 2 modelos concurrentes
    if len(loaded_models) >= 2:
        oldest_model_id = next(iter(loaded_models))
        print(f"Liberando memoria, expulsando modelo antiguo '{oldest_model_id}'")
        
        # Eliminar las referencias al modelo antiguo
        old_context = loaded_models.pop(oldest_model_id)
        del old_context["head"]
        del old_context
        
        # Forzar recolector de basura de Python
        gc.collect()
        
        # Vaciar caché de la GPU si está disponible
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    loaded_models[model_id] = model_context
    return model_context

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Radio de la Tierra en km
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def predict(images: list[Image.Image], model_id: str, top_k=5, true_coords=None):
    load_clip()
    model_ctx = load_model(model_id)
    head = model_ctx["head"]
    m_type = model_ctx["type"]
    
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
            
            if m_type == "multi_head":
                out_l4, out_l7, out_l10 = head(features)
                probs_l4 = F.softmax(out_l4, dim=1)
                top_prob_l4, top_idx_l4 = torch.max(probs_l4, 1)
                current_best_conf = top_prob_l4.item()
                winner_l4_idx = top_idx_l4.item()
                
                masked_logits_l10 = out_l10.clone()
                valid_l10_mask = torch.tensor([model_ctx["l10_to_l4_idx"][j] == winner_l4_idx for j in range(model_ctx["num_classes_l10"])], device=DEVICE)
                masked_logits_l10[0, ~valid_l10_mask] = -float('inf')
                filtered_probs_l10 = F.softmax(masked_logits_l10, dim=1)
                top_probs, top_indices = torch.topk(filtered_probs_l10, top_k)
                idx_map = model_ctx["idx_to_cell_l10"]
                
            elif m_type == "uni_head":
                out = head(features)
                probs = F.softmax(out, dim=1)
                top_probs, top_indices = torch.topk(probs, top_k)
                current_best_conf = top_probs[0][0].item()
                idx_map = model_ctx["idx_to_cell"]
            
            if current_best_conf > best_confidence:
                best_confidence = current_best_conf
                
                # Procesar todas las top k para esta imagen ganadora
                current_top_preds = []
                for j in range(top_k):
                    conf = top_probs[0][j].item()
                    idx = top_indices[0][j].item()
                    
                    token = idx_map[idx]
                    cell_id = s2sphere.CellId.from_token(token)
                    lat_lng = cell_id.to_lat_lng()
                    
                    current_top_preds.append({
                        "lat": lat_lng.lat().degrees,
                        "lng": lat_lng.lng().degrees,
                        "confidence": conf
                    })
                best_top_k_preds = current_top_preds

    best_prediction = best_top_k_preds[0] if best_top_k_preds else None
    
    if true_coords and best_prediction:
        dist_km = haversine(true_coords['lat'], true_coords['lng'], best_prediction['lat'], best_prediction['lng'])
        print(f"Mejor predicción ({model_id}) con confianza: {best_confidence:.4f} (Error: {dist_km:.2f} km)")
    else:
        print(f"Mejor predicción ({model_id}) con confianza: {best_confidence:.4f} (Error: Desconocido)")
    
    return {
        "best": best_prediction,
        "top_5": best_top_k_preds
    }
