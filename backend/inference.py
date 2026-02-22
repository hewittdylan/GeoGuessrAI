import torch
import torch.nn.functional as F
import open_clip
import pickle
import s2sphere
from PIL import Image
import os
from pathlib import Path

# Configuración
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
MODEL_HEAD_PATH = MODELS_DIR / "checkpoints_model/best_model.pth"
MAP_PATH = MODELS_DIR / "s2_class_map.pkl"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Iniciando sistema de predicción en {DEVICE}")

# Variables globales para mantener el modelo
backbone = None
preprocess = None
head = None
idx_to_cell = None

def load_model():
    global backbone, preprocess, head, idx_to_cell
    
    if backbone is not None:
        return

    # Cargar mapa de clases
    print("Cargando mapa de clases")
    if not MAP_PATH.exists():
        raise FileNotFoundError(f"Mapa de clases no encontrado en {MAP_PATH}")
        
    with open(MAP_PATH, "rb") as f:
        map_data = pickle.load(f)
    
    idx_to_cell = map_data["idx_to_cell"]
    num_classes = map_data["total_cells"]

    # Cargar CLIP
    print("Cargando CLIP (ViT-B-32)")
    backbone, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    backbone.to(DEVICE)
    backbone.eval()

    # Cargar modelo entrenado
    print("Cargando modelo entrenado")
    head = torch.nn.Linear(512, num_classes)
    
    if not MODEL_HEAD_PATH.exists():
         raise FileNotFoundError(f"Modelo entrenado no encontrado en {MODEL_HEAD_PATH}")

    state_dict = torch.load(MODEL_HEAD_PATH, map_location=DEVICE)
    head.load_state_dict(state_dict)
    head.to(DEVICE)
    head.eval()
    print("Modelo cargado exitosamente")

def predict(images: list[Image.Image], top_k=5):
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
        img_tensor = preprocess(img).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            features = backbone.encode_image(img_tensor).float()
            logits = head(features)
            probs = F.softmax(logits, dim=1)
            
            # Obtener las top K predicciones para esta imagen
            top_probs, top_indices = torch.topk(probs, top_k)
            
            # La confianza de la predicción #1 determina si esta imagen es la "mejor"
            current_best_conf = top_probs[0][0].item()
            
            print(f"Imagen {i+1}: Confianza {current_best_conf:.4f}")

            if current_best_conf > best_confidence:
                best_confidence = current_best_conf
                
                # Procesar todas las top k para esta imagen ganadora
                current_top_preds = []
                for j in range(top_k):
                    conf = top_probs[0][j].item()
                    idx = top_indices[0][j].item()
                    
                    # Traducir ID -> S2 Token -> Lat/Lon
                    token = idx_to_cell[idx]
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
    
    print(f"Mejor predicción seleccionada con confianza: {best_confidence:.4f}")
    
    return {
        "best": best_prediction,
        "top_5": best_top_k_preds
    }
