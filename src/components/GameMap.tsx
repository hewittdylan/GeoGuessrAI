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
    const defaultCenter = useMemo(() => ({ lat: 20, lng: 0 }), []); // World center

    return (
        <div
            className={`
        absolute z-20 
        transition-all duration-500 ease-in-out
        shadow-2xl rounded-xl overflow-hidden border-2 border-white/20 bg-slate-800
        ${showResult
                    ? 'inset-4 z-40' // Full screen (almost) when showing result
                    : 'bottom-4 right-4 w-72 h-48 hover:w-[600px] hover:h-[400px]'}
      `}
        >
            <div className="w-full h-full relative group">
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={result ? result.actual : defaultCenter}
                    zoom={result ? 3 : 2}
                    options={interactiveMapOptions}
                    onClick={!showResult ? onMapClick : undefined}
                    onTilesLoaded={onTilesLoaded}
                >
                    {/* User's Guess Marker */}
                    {userGuess && !result && (
                        <Marker
                            position={userGuess}
                            icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 7,
                                fillColor: "#3b82f6", // Blue
                                fillOpacity: 1,
                                strokeColor: "#ffffff",
                                strokeWeight: 2,
                            }}
                        />
                    )}

                    {/* Result Markers */}
                    {result && (
                        <>
                            {/* Actual Location */}
                            <Marker
                                position={result.actual}
                                icon={{
                                    url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                                }}
                            />

                            {/* User Guess */}
                            <Marker
                                position={result.user}
                                icon={{
                                    url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                                }}
                            />

                            {/* AI Guess */}
                            <Marker
                                position={result.ai}
                                icon={{
                                    url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
                                }}
                            />

                            {/* Lines */}
                            <Polyline
                                path={[result.actual, result.user]}
                                options={{ strokeColor: "#3b82f6", strokeOpacity: 0.8, strokeWeight: 2, geodesic: true }}
                            />
                            <Polyline
                                path={[result.actual, result.ai]}
                                options={{ strokeColor: "#a855f7", strokeOpacity: 0.8, strokeWeight: 2, geodesic: true }}
                            />
                        </>
                    )}
                </GoogleMap>

                {/* Hover overlay hint (disappears on hover) */}
                {!showResult && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                        <span className="text-white/80 font-bold text-sm bg-black/50 px-2 py-1 rounded backdrop-blur-md">MAPA</span>
                    </div>
                )}

                {/* Floating Guess Button (Inside Map) - Only show if playing */}
                {!showResult && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 transform transition-all duration-300 translate-y-20 group-hover:translate-y-0">
                        <button
                            disabled={!userGuess || isSubmitting}
                            onClick={onSubmit}
                            className={`
                    px-6 py-2 rounded-full font-bold text-sm shadow-xl transition-all transform
                    ${!userGuess
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-green-500 text-white hover:bg-green-400 hover:scale-105 active:scale-95'}
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
