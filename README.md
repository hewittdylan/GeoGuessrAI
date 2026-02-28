# Geoguessr 2.0: IA vs Humano e IA vs IA

> **Un sistema interactivo capaz de predecir ubicaciones geográficas mediante visión artificial y procesamiento de lenguaje natural**

## Equipo

**Autores:**
- Pablo Zamora Morales
- Dylan Hewitt Martínez
- Juan Fonseca Buelga

**Dirigido por:**
- Manuel Méndez Hurtado
- Manuel Núñez García

---

## Descripción del Proyecto

Este proyecto consiste en el desarrollo de un sistema interactivo tipo GeoGuessr, un juego en línea donde los jugadores deben adivinar ubicaciones reales a partir de imágenes, capaz de predecir la ubicación geográfica de una imagen mediante el análisis automático de su contenido visual y textual. Utiliza técnicas avanzadas de detección y clasificación de imágenes basadas en redes neuronales convolucionales para interpretar elementos como paisajes, arquitectura, clima, señales y escritura, junto con procesamiento de lenguaje natural para extraer información relevante de textos visibles en la imagen.

Además, se integrará este sistema en un juego interactivo donde se podrán enfrentar humanos contra la máquina o máquinas entre sí, compitiendo para adivinar la ubicación con mayor precisión.

---

## Instalación y Configuración

### Requisitos Previos
Asegúrate de tener **Node.js** instalado (v18 o superior recomendado)

### Instalar Dependencias

**1. Cliente (Frontend)**
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

**2. Servidor de IA (Backend)**
El backend requiere Python 3.10 o superior. Te recomendamos crear un entorno virtual e instalar las librerías necesarias:

```bash
# Crear y activar entorno virtual (opcional)
# En Mac/Linux:
python3 -m venv .venv
source .venv/bin/activate
# En Windows:
python -m venv .venv
.\venv\Scripts\activate

# Instalar dependencias
pip install -r backend/requirements.txt
```

### Configuración del Entorno
Crea un archivo llamado `.env.local` en el directorio raíz del proyecto.
Añade tu API Key de Google Maps:

```env
VITE_GOOGLE_MAPS_KEY=api_key_de_google_maps
```

> **Nota:** Necesitas una API key de Google Cloud con **Maps JavaScript API** y **Street View Static API** habilitadas. [Se puede solicitar aquí](https://developers.google.com/maps/documentation/javascript/get-api-key).

### Ejecutar la Aplicación

Para que el sistema funcione correctamente, necesitas ejecutar tanto el cliente (interfaz) como el servidor (IA). Debes abrir dos terminales separadas.

#### 1. Iniciar el Servidor de IA (Backend)
Abre una terminal, activa tu entorno virtual y arranca el servidor FastAPI:

```bash
# Activar entorno virtual (opcional pero recomendado)
# En Mac/Linux:
source .venv/bin/activate
# En Windows:
.venv\Scripts\activate

# Iniciar servidor
cd backend
uvicorn main:app --reload
```
El servidor de inferencia escuchará en `http://localhost:8000`.

#### 2. Iniciar el Cliente (Frontend)
Abre otra terminal en la carpeta principal del proyecto y ejecuta el servidor de desarrollo de Vite:

```bash
npm run dev
```

La aplicación se lanzará en `http://localhost:5173`