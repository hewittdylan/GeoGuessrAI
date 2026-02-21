import React from 'react';

interface DiagnosticsProps {
    isLoaded: boolean;
    tilesLoaded: boolean;
    isSubmitting: boolean;
    authError: boolean;
}

const Diagnostics: React.FC<DiagnosticsProps> = ({ isLoaded, tilesLoaded, isSubmitting, authError }) => {
    return (
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
            <div className="bg-black/80 text-white text-[10px] p-2 rounded-lg border border-white/10 backdrop-blur-sm shadow-xl">
                <div className="font-bold mb-1 text-xs text-accent border-b border-white/20 pb-1 flex justify-between">
                    <span>Diagnóstico del sistema</span>
                    <span className={authError ? "text-red-500" : "text-green-500"}></span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 font-mono opacity-80">
                    <span>API Cargada:</span> <span>{isLoaded ? 'SI' : 'NO'}</span>
                    <span>Gráficos:</span> <span>{tilesLoaded ? 'OK' : '...'}</span>
                    <span>Enviando guess:</span> <span>{isSubmitting ? 'SI' : 'NO'}</span>
                </div>
            </div>
        </div>
    );
};

export default Diagnostics;
