import torch
import torch.nn as nn
import torch.nn.functional as F
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
    
    # Implementación de Focal Loss para lidiar con el desbalanceo del dataset 
    class FocalLoss(nn.Module):
        def __init__(self, alpha: float=1.0, gamma: float=2.0, ignore_index: int=-100):
            super().__init__()
            self.alpha = alpha
            self.gamma = gamma
            self.ignore_index = ignore_index

        def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
            ce_loss = F.cross_entropy(inputs, targets, reduction='none', ignore_index=self.ignore_index)
            pt = torch.exp(-ce_loss)
            focal_loss = self.alpha * ((1 - pt) ** self.gamma) * ce_loss
            
            # Promediamos solo sobre las muestras válidas
            valid_mask = targets != self.ignore_index
            if valid_mask.any():
                return focal_loss[valid_mask].mean()
            else:
                return (ce_loss.sum() * 0.0)

    # Reemplazamos CrossEntropy por FocalLoss
    criterion = FocalLoss(ignore_index=-100)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    
    # Con el scheduler monitorizamos acc_l4 (Precisión del País) para que no caiga abruptamente ante subidas artificiales de val_loss
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=4, verbose=True)

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
        
        # Pesos dinámicos por época
        progreso = epoch / max(1, (EPOCHS - 1))
        # Warmup más lento para L10: No le exigimos nada hasta después de estabilizarse la red
        if progreso < 0.2:
            # Épocas iniciales: Solo País y algo de Región
            w_l4 = 0.9
            w_l7 = 0.1
            w_l10 = 0.0
        else:
            # Transición suave
            progreso_ajustado = (progreso - 0.2) / 0.8  # Escala de 0.0 a 1.0 para el 80% restante de las épocas
            w_l4 = max(0.1, 0.9 - (0.8 * progreso_ajustado))
            w_l10 = min(0.6, 0.0 + (0.6 * progreso_ajustado))
            w_l7 = 1.0 - (w_l4 + w_l10)
        
        current_lr = optimizer.param_groups[0]['lr']
        print(f"\n[Epoch {epoch+1}/{EPOCHS} | LR: {current_lr:.6f} | Pesos Loss -> L4:{w_l4:.2f} L7:{w_l7:.2f} L10:{w_l10:.2f}]")
        
        for i, (inputs, targets) in enumerate(train_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            
            optimizer.zero_grad()
            out_l4, out_l7, out_l10 = model(inputs)
            
            # Calculamos las 3 pérdidas separadas
            loss_l4 = criterion(out_l4, targets[:, 0])
            loss_l7 = criterion(out_l7, targets[:, 1])
            loss_l10 = criterion(out_l10, targets[:, 2])
            
            # Sumamos las pérdidas ponderadas dinámicamente
            loss = (loss_l4 * w_l4) + (loss_l7 * w_l7) + (loss_l10 * w_l10)
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
                
                loss_v_l4 = criterion(out_l4, targets[:, 0])
                loss_v_l7 = criterion(out_l7, targets[:, 1])
                loss_v_l10 = criterion(out_l10, targets[:, 2])
                
                # Usamos los mismos pesos dinámicos para el loss de validación
                loss = (loss_v_l4 * w_l4) + (loss_v_l7 * w_l7) + (loss_v_l10 * w_l10)
                val_loss += loss.item()
                
                # Acumulamos las precisiones medias por batch
                acc_l4_total += calcular_accuracy(out_l4, targets[:, 0])
                acc_l7_total += calcular_accuracy(out_l7, targets[:, 1])
                acc_l10_total += calcular_accuracy(out_l10, targets[:, 2])
        
        avg_val_loss = val_loss / batches_val
        acc_l4 = acc_l4_total / batches_val
        acc_l7 = acc_l7_total / batches_val
        acc_l10 = acc_l10_total / batches_val
        
        # Step the scheduler monitorizando la precisión L4, no la loss
        scheduler.step(acc_l4)
        
        print(f"Epoch {epoch+1}/{EPOCHS} | Val Loss: {avg_val_loss:.4f}")
        print(f"Acc L4 (País): {acc_l4:.2f}% | Acc L7 (Región): {acc_l7:.2f}% | Acc L10 (Ciudad): {acc_l10:.2f}%")
        
        # Guardamos el modelo basándonos en la precisión del País (L4)
        if acc_l4 > best_l4_acc:
            best_l4_acc = acc_l4
            torch.save(model.state_dict(), f"{MODEL_DIR}/best_model_multi.pth")
            print(f"¡Nuevo récord en L4! Modelo guardado.")