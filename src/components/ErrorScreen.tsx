import React from 'react';

interface ErrorScreenProps {
    error: Error;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
    return (
        <div className="flex items-center justify-center w-full h-screen bg-background text-red-500 p-4 font-mono">
            <div className="text-center space-y-4 border border-red-900/50 p-8 rounded-2xl bg-red-950/20 backdrop-blur-sm">
                <h1 className="text-2xl font-bold uppercase tracking-widest">Error de Carga</h1>
                <p className="text-red-400">{error.message}</p>
                <p className="text-xs text-red-300/50 mt-2 uppercase tracking-wide">
                    Verifica tu conexión o la clave de API
                </p>
            </div>
        </div>
    );
};

export default ErrorScreen;
