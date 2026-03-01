import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
import numpy as np
import pickle
import glob
import os
import gc

# Configuracion
BATCH_SIZE = 256
EPOCHS = 50
LR = 0.001
CHECKPOINT_DIR = "../models/checkpoints_features/train" 
MODEL_DIR = "../models/checkpoints_model_multi"
MAP_PATH = "../models/s2_class_map_multi.pkl"
os.makedirs(MODEL_DIR, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Hardware: {device}")

def cargar_datos():
    print("Cargando features en RAM")
    chunk_files = sorted(glob.glob(f"{CHECKPOINT_DIR}/chunk_*.pkl"), key=lambda x: int(x.split('_')[-1].split('.')[0]))
    
    if not chunk_files:
        raise FileNotFoundError("No hay chunks. Ejecuta extraer_features.py primero")

    all_features = []
    all_labels = []

    for cf in chunk_files:
        with open(cf, "rb") as f:
            data = pickle.load(f)
            all_features.append(data["features"])
            all_labels.append(data["labels"]) # Ahora esto es un array de N x 3
    
    X = np.concatenate(all_features)
    y = np.concatenate(all_labels)
    
    print(f"Dataset cargado: {len(X)} muestras con 3 etiquetas por muestra")
    return X, y

if __name__ == "__main__":
    X, y = cargar_datos()
    
    # Cargamos los 3 diccionarios de clases
    try:
        with open(MAP_PATH, "rb") as f:
            class_map = pickle.load(f)
            num_l4 = class_map["L4"]["total_cells"]
            num_l7 = class_map["L7"]["total_cells"]
            num_l10 = class_map["L10"]["total_cells"]
            print(f"Mapas cargados. Clases -> L4: {num_l4} | L7: {num_l7} | L10: {num_l10}")
    except Exception:
        raise FileNotFoundError(f"No se pudo cargar {MAP_PATH}")

    class MemoryEfficientDataset(torch.utils.data.Dataset):
        def __init__(self, features, labels):
            self.features = features
            self.labels = labels
            
        def __len__(self):
            return len(self.labels)
        
        def __getitem__(self, idx):
            # features es un vector 1D (512,), labels es un vector 1D de 3 elementos (L4, L7, L10)
            return (torch.tensor(self.features[idx], dtype=torch.float32), 
                    torch.tensor(self.labels[idx], dtype=torch.long))

    # Split de datos
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.1, random_state=42)
    
    train_dataset = MemoryEfficientDataset(X_train, y_train)
    val_dataset = MemoryEfficientDataset(X_val, y_val)
    
    del X, y
    gc.collect()

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, pin_memory=True)
        
    # La Red Neuronal de 3 Cabezas
    class GeoGuessrMultiHead(nn.Module):
        def __init__(self, input_dim=512, hidden_dim=1024):
            super().__init__()
            # Tronco común
            self.tronco = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.3)
            )
            # Cabezales independientes
            self.cabeza_l4 = nn.Linear(hidden_dim, num_l4)
            self.cabeza_l7 = nn.Linear(hidden_dim, num_l7)
            self.cabeza_l10 = nn.Linear(hidden_dim, num_l10)

        def forward(self, x):
            features = self.tronco(x)
            out_l4 = self.cabeza_l4(features)
            out_l7 = self.cabeza_l7(features)
            out_l10 = self.cabeza_l10(features)
            return out_l4, out_l7, out_l10

    model = GeoGuessrMultiHead().to(device)
    
    # El truco es que ignore_index = -100 ignora las zonas remotas sin Nivel 10
    criterion = nn.CrossEntropyLoss(ignore_index=-100)
    optimizer = optim.AdamW(model.parameters(), lr=LR)

    # Función auxiliar para calcular precisión ignorando los -100
    def calcular_accuracy(outputs, targets):
        valid_mask = targets != -100
        if valid_mask.sum() == 0: return 0.0
        _, predicciones = torch.max(outputs.data, 1)
        correctas = (predicciones[valid_mask] == targets[valid_mask]).float().sum().item()
        return (correctas / valid_mask.sum().item()) * 100

    best_l4_acc = 0.0

    print("Iniciando entrenamiento multi-cabezal")

    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        
        for i, (inputs, targets) in enumerate(train_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            
            optimizer.zero_grad()
            out_l4, out_l7, out_l10 = model(inputs)
            
            # Calculamos las 3 pérdidas separadas
            loss_l4 = criterion(out_l4, targets[:, 0])
            loss_l7 = criterion(out_l7, targets[:, 1])
            loss_l10 = criterion(out_l10, targets[:, 2])
            
            # Sumamos las pérdidas para actualizar todos los pesos a la vez
            loss = loss_l4 + loss_l7 + loss_l10
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            if i % 100 == 0:
                print(f"Batch {i}/{len(train_loader)} | Total Loss: {loss.item():.4f}", end="\r")

        # Validación
        model.eval()
        val_loss = 0.0
        acc_l4_total, acc_l7_total, acc_l10_total = 0.0, 0.0, 0.0
        batches_val = len(val_loader)

        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                out_l4, out_l7, out_l10 = model(inputs)
                
                loss = criterion(out_l4, targets[:, 0]) + criterion(out_l7, targets[:, 1]) + criterion(out_l10, targets[:, 2])
                val_loss += loss.item()
                
                # Acumulamos las precisiones medias por batch
                acc_l4_total += calcular_accuracy(out_l4, targets[:, 0])
                acc_l7_total += calcular_accuracy(out_l7, targets[:, 1])
                acc_l10_total += calcular_accuracy(out_l10, targets[:, 2])
        
        avg_val_loss = val_loss / batches_val
        acc_l4 = acc_l4_total / batches_val
        acc_l7 = acc_l7_total / batches_val
        acc_l10 = acc_l10_total / batches_val
        
        print(f"\nEpoch {epoch+1}/{EPOCHS} | Val Loss: {avg_val_loss:.4f}")
        print(f"Acc L4 (País): {acc_l4:.2f}% | Acc L7 (Región): {acc_l7:.2f}% | Acc L10 (Ciudad): {acc_l10:.2f}%")
        
        # Guardamos el modelo basándonos en la precisión del País (L4)
        if acc_l4 > best_l4_acc:
            best_l4_acc = acc_l4
            torch.save(model.state_dict(), f"{MODEL_DIR}/best_model_multi.pth")
            print(f"¡Nuevo récord en L4! Modelo guardado.")