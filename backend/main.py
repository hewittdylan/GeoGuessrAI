from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import requests
from io import BytesIO
from PIL import Image
from inference import predict, load_model
from fastapi.middleware.cors import CORSMiddleware
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar modelo al arrancar
@app.on_event("startup")
async def startup_event():
    load_model()

class PredictRequest(BaseModel):
    urls: List[str]

@app.post("/predict")
async def get_prediction(request: PredictRequest):
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    
    images = []
    print(f"Recibidas {len(request.urls)} URLs")
    
    try:
        # Descargar imágenes
        for url in request.urls:
            print(f"Descargando: {url}...")
            response = requests.get(url)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
            
            # Quitar marca de agua de Google (recortar 40 píxeles inferiores) y redimensionar a 640x640
            # Asumiendo que las imágenes estándar de Street View son 640x640
            width, height = img.size
            if height > 40:
                img = img.crop((0, 0, width, height - 40))
                print(f"Recortado: {width}x{height} -> {img.size}")
            
            images.append(img)
            
        print("Ejecutando inferencia")
        start_time = time.time()
        result = predict(images)
        duration = time.time() - start_time
        print(f"Predicción realizada en {duration:.2f}s: {result}")
        
        return result
        
    except Exception as e:
        print(f"Error durante la predicción: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
