import React, { useMemo } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

interface GameMapProps {
    player1Guess: google.maps.LatLngLiteral | null;
    onMapClick: (e: google.maps.MapMouseEvent) => void;
    onTilesLoaded: () => void;
    isSubmitting: boolean;
    onSubmit: () => void;
    showResult: boolean;
    result?: {
        actual: google.maps.LatLngLiteral;
        player1: { lat: number; lng: number };
        player2: { lat: number; lng: number };
    };
    gameMode?: 'human_vs_ai' | 'ai_vs_ai';
}

const interactiveMapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
};

const GameMap: React.FC<GameMapProps> = ({
    player1Guess,
    onMapClick,
    onTilesLoaded,
    isSubmitting,
    onSubmit,
    showResult,
    result,
    gameMode = 'human_vs_ai'
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
            player1: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#f59e0b", // Amber-500 (Primary)
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
            },
            player2: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#e11d48", // Rose-600 (Secondary)
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
            }
        };
    }, []);

    // Si los iconos no se han cargado (porque la API no está lista), no renderizar nada
    if (!mapIcons) return null;

    // Referencia al objeto mapa
    const mapRef = React.useRef<google.maps.Map | null>(null);

    const onLoad = React.useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    const onUnmount = React.useCallback(() => {
        mapRef.current = null;
    }, []);

    // Efecto para hacer auto-zoom con los resultados
    React.useEffect(() => {
        if (showResult && result && mapRef.current) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(result.actual);
            bounds.extend(result.player1);
            bounds.extend(result.player2);

            // Esperar a que termine la transición CSS (500ms) antes de ajustar
            const timer = setTimeout(() => {
                if (mapRef.current) {
                    // Ajustar el mapa para que se vean todos los puntos
                    mapRef.current.fitBounds(bounds, {
                        top: 50,
                        right: 50,
                        bottom: 350, // Dejar espacio al ResultOverlay
                        left: 50,
                    });
                }
            }, 500); // 500ms para asegurar que la animación terminó

            return () => clearTimeout(timer);
        }
    }, [showResult, result]);

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
                    zoom={2} // Zoom inicial por defecto, luego fitBounds lo anula
                    options={interactiveMapOptions}
                    onClick={!showResult && gameMode === 'human_vs_ai' ? onMapClick : undefined}
                    onTilesLoaded={onTilesLoaded}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                >
                    {/* Marcador de suposición del Jugador 1 durante la ronda */}
                    {player1Guess && !result && (
                        <Marker
                            position={player1Guess}
                            icon={mapIcons.player1}
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

                            {/* Suposición del Jugador 1 */}
                            <Marker
                                position={result.player1}
                                icon={mapIcons.player1}
                                zIndex={90}
                            />

                            {/* Suposición del Jugador 2 */}
                            <Marker
                                position={result.player2}
                                icon={mapIcons.player2}
                                zIndex={90}
                            />

                            {/* Líneas */}
                            <Polyline
                                path={[result.actual, result.player1]}
                                options={{
                                    strokeColor: "#f59e0b",
                                    strokeOpacity: 0,
                                    strokeWeight: 0,
                                    geodesic: true,
                                    icons: [{
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeOpacity: 1,
                                            scale: 3,
                                            strokeColor: "#f59e0b"
                                        },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                            <Polyline
                                path={[result.actual, result.player2]}
                                options={{
                                    strokeColor: "#e11d48",
                                    strokeOpacity: 0,
                                    strokeWeight: 0,
                                    geodesic: true,
                                    icons: [{
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeOpacity: 1,
                                            scale: 3,
                                            strokeColor: "#e11d48"
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
                            disabled={(gameMode === 'human_vs_ai' && !player1Guess) || isSubmitting}
                            onClick={onSubmit}
                            className={`
                    px-6 py-2 rounded-full font-bold text-sm shadow-xl transition-all transform
                    ${(gameMode === 'human_vs_ai' && !player1Guess)
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-primary text-background hover:bg-accent hover:scale-105 active:scale-95'}
                `}
                        >
                            {isSubmitting ? '...' : (gameMode === 'ai_vs_ai' ? 'SIMULAR RONDA' : 'ADIVINAR')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameMap;
