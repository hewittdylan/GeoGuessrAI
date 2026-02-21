import React from 'react';

interface LoadingScreenProps {
    isFindingLocation?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isFindingLocation = false }) => {
    return (
        <div className="flex items-center justify-center w-full h-screen bg-background text-primary flex-col space-y-4">
            <div className="text-4xl animate-bounce">🌍</div>
            <div className="text-xl animate-pulse font-mono text-accent">
                {isFindingLocation ? "Generando ubicación aleatoria..." : "Cargando mapa..."}
            </div>
            <div className="text-xs text-text/50 font-mono tracking-widest uppercase">Buscando por todo el mundo...</div>
        </div>
    );
};

export default LoadingScreen;
