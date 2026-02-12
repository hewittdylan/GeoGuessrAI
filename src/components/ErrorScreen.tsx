import React from 'react';

interface ErrorScreenProps {
    error: Error;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
    return (
        <div className="flex items-center justify-center w-full h-screen bg-red-900 text-white p-4">
            <div>
                <h1 className="text-2xl font-bold">Error al cargar API</h1>
                <p>{error.message}</p>
                <p className="text-sm mt-2">
                    Por favor verifica tu conexión o configuración.
                </p>
            </div>
        </div>
    );
};

export default ErrorScreen;
