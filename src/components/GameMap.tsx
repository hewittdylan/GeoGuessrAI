import React, { useMemo } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

interface GameMapProps {
    userGuess: google.maps.LatLngLiteral | null;
    onMapClick: (e: google.maps.MapMouseEvent) => void;
    onTilesLoaded: () => void;
    isSubmitting: boolean;
    onSubmit: () => void;
    showResult: boolean;
    result?: {
        actual: google.maps.LatLngLiteral;
        ai: { lat: number; lng: number };
        user: { lat: number; lng: number };
    };
}

const interactiveMapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
};

const GameMap: React.FC<GameMapProps> = ({
    userGuess,
    onMapClick,
    onTilesLoaded,
    isSubmitting,
    onSubmit,
    showResult,
    result
}) => {
    const defaultCenter = useMemo(() => ({ lat: 20, lng: 0 }), []); // Centro del mundo

    // Iconos SVG personalizados, definidos dentro del componente para asegurar que google.maps esté disponible
    const mapIcons = useMemo(() => {
        if (!window.google) return null; // Guard clause

        return {
            actual: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000" stroke="#000000" stroke-width="1.5">
            <path d="M5 21h2v-8h11l-3-4 3-4H7V3H5v18z" />
        </svg>`),
                scaledSize: { width: 32, height: 32 },
                anchor: { x: 6, y: 21 }
            },
            user: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#3b82f6", // Blue-500
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
            },
            ai: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#a855f7", // Purple-500
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
            }
        };
    }, []);

    // Si los iconos no se han cargado (porque la API no está lista), no renderizar nada
    if (!mapIcons) return null;

    return (
        <div
            className={`
        absolute z-20 
        transition-all duration-500 ease-in-out
        shadow-2xl rounded-xl overflow-hidden border-2 border-white/20 bg-slate-800
        ${showResult
                    ? 'inset-4 z-40' // Pantalla casi completa al mostrar resultado
                    : 'bottom-4 right-4 w-72 h-48 hover:w-[600px] hover:h-[400px]'}
      `}
        >
            <div className="w-full h-full relative group">
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={result ? result.actual : defaultCenter}
                    zoom={result ? 4 : 2}
                    options={interactiveMapOptions}
                    onClick={!showResult ? onMapClick : undefined}
                    onTilesLoaded={onTilesLoaded}
                >
                    {/* Marcador de suposición del usuario durante la ronda */}
                    {userGuess && !result && (
                        <Marker
                            position={userGuess}
                            icon={mapIcons.user}
                        />
                    )}

                    {/* Marcadores de Resultado */}
                    {result && (
                        <>
                            {/* Ubicación Real - Bandera */}
                            <Marker
                                position={result.actual}
                                icon={mapIcons.actual as any}
                                zIndex={100}
                            />

                            {/* Suposición del Usuario */}
                            <Marker
                                position={result.user}
                                icon={mapIcons.user}
                                zIndex={90}
                            />

                            {/* Suposición de la IA */}
                            <Marker
                                position={result.ai}
                                icon={mapIcons.ai}
                                zIndex={90}
                            />

                            {/* Líneas */}
                            <Polyline
                                path={[result.actual, result.user]}
                                options={{
                                    strokeColor: "#3b82f6",
                                    strokeOpacity: 0,
                                    strokeWeight: 0,
                                    geodesic: true,
                                    icons: [{
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeOpacity: 1,
                                            scale: 3,
                                            strokeColor: "#3b82f6"
                                        },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                            <Polyline
                                path={[result.actual, result.ai]}
                                options={{
                                    strokeColor: "#a855f7",
                                    strokeOpacity: 0,
                                    strokeWeight: 0,
                                    geodesic: true,
                                    icons: [{
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeOpacity: 1,
                                            scale: 3,
                                            strokeColor: "#a855f7"
                                        },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                        </>
                    )}
                </GoogleMap>

                {/* Pista superpuesta, desaparece al pasar el cursor*/}
                {!showResult && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                        <span className="text-white/80 font-bold text-sm bg-black/50 px-2 py-1 rounded backdrop-blur-md">MAPA</span>
                    </div>
                )}

                {/* Botón flotante de adivinar */}
                {!showResult && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 transform transition-all duration-300 translate-y-20 group-hover:translate-y-0">
                        <button
                            disabled={!userGuess || isSubmitting}
                            onClick={onSubmit}
                            className={`
                    px-6 py-2 rounded-full font-bold text-sm shadow-xl transition-all transform
                    ${!userGuess
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-primary text-background hover:bg-accent hover:scale-105 active:scale-95'}
                `}
                        >
                            {isSubmitting ? '...' : 'ADIVINAR'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameMap;
