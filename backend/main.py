import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import requests
from io import BytesIO
from PIL import Image
from inference import predict, load_clip
from fastapi.middleware.cors import CORSMiddleware
import time
import json
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CONFIG_PATH = MODELS_DIR / "config.json"

@app.on_event("startup")
async def startup_event():
    # Pre-cargamos CLIP
    load_clip()

class PredictRequest(BaseModel):
    urls: List[str]
    model_id: str

@app.get("/models")
async def get_models():
    try:
        with open(CONFIG_PATH, "r") as f:
            config_data = json.load(f)
        return config_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo configuración de modelos: {str(e)}")

@app.post("/predict")
async def get_prediction(request: PredictRequest):
    if not request.urls:
        raise HTTPException(status_code=400, detail="No se han recibido URLs")
    if not request.model_id:
        raise HTTPException(status_code=400, detail="No se ha especificado un modelo")
        
    images = []
    # Intentar extraer coordenadas reales de la primera URL si es posible
    true_lat, true_lng = None, None
    import re
    match = re.search(r'location=([\d\.-]+),([\d\.-]+)', request.urls[0])
    if match:
        true_lat, true_lng = float(match.group(1)), float(match.group(2))
    else:
        # A veces viene en un formato diferente, e.g. cbll=
        match = re.search(r'cbll=([\d\.-]+),([\d\.-]+)', request.urls[0])
        if match:
            true_lat, true_lng = float(match.group(1)), float(match.group(2))
            
    if true_lat is not None and true_lng is not None:
        print(f"Recibidas {len(request.urls)} URLs (Coordenadas Reales: {true_lat:.4f}, {true_lng:.4f})")
    else:
         print(f"Recibidas {len(request.urls)} URLs (Coordenadas Reales: Desconocidas)")
    
    try:
        # Descargar imágenes
        for url in request.urls:
            print(f"Descargando: {url}...")
            # Nos hacemos pasar por el frontend para que la API Key no nos rechace si tiene restricción de Referer
            headers = {"Referer": "http://localhost:5173"}
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
            
            # Quitar marca de agua de Google (recortar 40 píxeles inferiores) y redimensionar a 640x640
            # Asumiendo que las imágenes estándar de Street View son 640x640
            width, height = img.size
            if height > 40:
                img = img.crop((0, 0, width, height - 40))
                print(f"Recortado: {width}x{height} -> {img.size}")
            
            images.append(img)
            
        print(f"Ejecutando inferencia con modelo {request.model_id}")
        start_time = time.time()
        
        true_coords = {"lat": true_lat, "lng": true_lng} if true_lat is not None else None
        result = predict(images, model_id=request.model_id, true_coords=true_coords)
        
        duration = time.time() - start_time
        print(f"Predicción realizada en {duration:.2f}s: {result}")
        
        return result
        
    except Exception as e:
        print(f"Error durante la predicción: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
