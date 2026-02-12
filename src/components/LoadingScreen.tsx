import React from 'react';

interface LoadingScreenProps {
    isFindingLocation?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isFindingLocation = false }) => {
    return (
        <div className="flex items-center justify-center w-full h-screen bg-slate-900 text-white flex-col space-y-4">
            <div className="text-4xl animate-bounce">🌍</div>
            <div className="text-xl animate-pulse font-mono">
                {isFindingLocation ? "Generando ubicación aleatoria..." : "Cargando mapa..."}
            </div>
            <div className="text-xs opacity-50">Buscando por todo el mundo...</div>
        </div>
    );
};

export default LoadingScreen;
