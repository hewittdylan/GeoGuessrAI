import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
import numpy as np
import pickle
import glob
import os
import sys
import gc

BATCH_SIZE = 512
EPOCHS = 50
LR = 0.001
CHECKPOINT_DIR = "../models/checkpoints_features" 
MODEL_DIR = "../models/checkpoints_model"         
os.makedirs(MODEL_DIR, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Hardware: {device}")

def cargar_datos(directorio):
    print(f"Cargando features desde {directorio}")
    chunk_files = sorted(glob.glob(f"{directorio}/chunk_*.pkl"), key=lambda x: int(x.split('_')[-1].split('.')[0]))
    
    if not chunk_files:
        raise FileNotFoundError("No hay chunks. Ejecuta extraer_features.py primero.")

    all_features = []
    all_labels = []

    for cf in chunk_files:
        with open(cf, "rb") as f:
            data = pickle.load(f)
            all_features.append(data["features"])
            all_labels.append(data["labels"])
    
    X = np.concatenate(all_features)
    y = np.concatenate(all_labels)
    
    print(f"Dataset cargado: {len(X)} muestras")
    return X, y

if __name__ == "__main__":
    # X_train, y_train = cargar_datos("../models/checkpoints_features/train")
    # X_val, y_val = cargar_datos("../models/checkpoints_features/val")
    # Usando S2 = 10, MIN_IMAGES = 100 no había una sola foto en el dataset de val, hace falta hacer split manual

    X, y = cargar_datos("../models/checkpoints_features/train")
    
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, 
        test_size=0.1, 
        random_state=42, 
        stratify=y
    )
    
    # Cargar mapa de clases para obtener el número real de celdas
    try:
        with open("../models/s2_class_map.pkl", "rb") as f:
            class_map = pickle.load(f)
            num_classes = class_map["total_cells"]
            print(f"Mapa de clases cargado. Total clases: {num_classes}")
    except Exception:
        raise FileNotFoundError("No se pudo cargar s2_class_map.pkl")

    # Implementación eficiente de memoria
    # En lugar de convertir todo a float32 de golpe, lo hacemos on-the-fly
    class MemoryEfficientDataset(torch.utils.data.Dataset):
        def __init__(self, features, labels):
            self.features = features
            self.labels = labels
            
        def __len__(self):
            return len(self.labels)
        
        def __getitem__(self, idx):
            return (torch.tensor(self.features[idx], dtype=torch.float32), 
                    torch.tensor(self.labels[idx], dtype=torch.long))

    # Dataset encapsulado
    train_dataset = MemoryEfficientDataset(X_train, y_train)
    val_dataset = MemoryEfficientDataset(X_val, y_val)
    
    # Limpiamos los arrays originales completos
    del X_train, y_train, X_val, y_val
    gc.collect()

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, pin_memory=True)
        
    print(f"Configurando salida para {num_classes} clases S2")

    class GeoGuessrHead(nn.Module):
        def __init__(self, input_dim=512, hidden_dim=1024, num_classes=num_classes):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(hidden_dim, num_classes)
            )
        def forward(self, x):
            return self.net(x)

    model = GeoGuessrHead(num_classes=num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)

    # Recuperación ante fallos
    start_epoch = 0
    best_acc = 0.0
    checkpoint_path = f"{MODEL_DIR}/checkpoint_last.pth"
    
    if os.path.exists(checkpoint_path):
        print(f"Checkpoint encontrado. Cargando estado anterior...")
        checkpoint = torch.load(checkpoint_path)
        model.load_state_dict(checkpoint['model_state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        start_epoch = checkpoint['epoch'] + 1
        best_acc = checkpoint.get('best_acc', 0.0)
        print(f"Reanudando en época {start_epoch+1} (Best Acc actual: {best_acc:.2f}%)")
    else:
        print("Iniciando entrenamiento desde cero")

    # Bucle entrenamiento
    for epoch in range(start_epoch, EPOCHS):
        model.train()
        running_loss = 0.0
        
        # Barra de progreso simple
        for i, (inputs, targets) in enumerate(train_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            if i % 100 == 0:
                print(f"Batch {i}/{len(train_loader)} Loss: {loss.item():.4f}", end="\r")

        # Validación
        model.eval()
        correct = 0
        total = 0
        val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item()
                
                _, predicted = torch.max(outputs.data, 1)
                total += targets.size(0)
                correct += (predicted == targets).float().sum().item()
        
        acc = 100 * correct / total
        avg_train_loss = running_loss / len(train_loader)
        avg_val_loss = val_loss / len(val_loader)
        
        print(f"\nEpoch {epoch+1}/{EPOCHS} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Val Acc: {acc:.2f}%")
        
        # Guardar checkpoint seguro
        torch.save({
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'best_acc': max(acc, best_acc)
        }, checkpoint_path)

        # Guardar mejor modelo
        if acc > best_acc:
            best_acc = acc
            torch.save(model.state_dict(), f"{MODEL_DIR}/best_model.pth")
            print(f"¡Nuevo récord! Modelo guardado en best_model.pth")