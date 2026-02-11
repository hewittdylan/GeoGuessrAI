# Geoguessr 2.0: IA vs Humano e IA vs IA

> **Un sistema interactivo capaz de predecir ubicaciones geográficas mediante visión artificial y procesamiento de lenguaje natural**

---

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

### Instalar Dependencia
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

### Configuración del Entorno
Crea un archivo llamado `.env.local` en el directorio raíz del proyecto.
Añade tu API Key de Google Maps:

```env
VITE_GOOGLE_MAPS_KEY=api_key_de_google_maps
```

> **Nota:** Necesitas una API key de Google Cloud con **Maps JavaScript API** y **Street View Static API** habilitadas. [Se puede solicitar aquí](https://developers.google.com/maps/documentation/javascript/get-api-key).

### Ejecutar la Aplicación
Inicia el servidor de desarrollo:

```bash
npm run dev
```

La aplicación se lanzará en `http://localhost:5173`