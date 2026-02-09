import React, { useMemo } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';

interface GameMapProps {
    userGuess: google.maps.LatLngLiteral | null;
    onMapClick: (e: google.maps.MapMouseEvent) => void;
    onTilesLoaded: () => void;
    isSubmitting: boolean;
    onSubmit: () => void;
    showResult: boolean;
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
    showResult
}) => {
    const defaultCenter = useMemo(() => ({ lat: 20, lng: 0 }), []); // World center

    return (
        <div
            className={`
        absolute bottom-4 right-4 z-20 
        transition-all duration-300 ease-in-out
        shadow-2xl rounded-xl overflow-hidden border-2 border-white/20
        ${showResult ? 'w-0 h-0 opacity-0' : 'w-72 h-48 hover:w-[600px] hover:h-[400px]'}
        bg-slate-800
      `}
        >
            <div className="w-full h-full relative group">
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={defaultCenter}
                    zoom={2}
                    options={interactiveMapOptions}
                    onClick={onMapClick}
                    onTilesLoaded={onTilesLoaded}
                >
                    {/* User's Guess Marker */}
                    {userGuess && (
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
                </GoogleMap>

                {/* Hover overlay hint (disappears on hover) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                    <span className="text-white/80 font-bold text-sm bg-black/50 px-2 py-1 rounded backdrop-blur-md">MAP</span>
                </div>

                {/* Floating Guess Button (Inside Map) */}
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
                        {isSubmitting ? '...' : 'GUESS'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameMap;
