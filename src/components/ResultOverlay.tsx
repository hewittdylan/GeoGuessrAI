import React from 'react';

interface ResultOverlayProps {
    result: {
        round_winner: string;
        user: { score: number; distance_km: string; lat: number; lng: number };
        ai: { score: number; distance_km: string; lat: number; lng: number };
        actual: google.maps.LatLngLiteral;
    };
    onNextRound: () => void;
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ result, onNextRound }) => {
    return (
        <div className="absolute top-4 right-4 bottom-auto left-auto z-50 flex flex-col items-end pointer-events-none">
            {/* Main Result Card */}
            <div className="bg-slate-900/90 p-6 rounded-2xl border border-white/20 shadow-2xl w-full max-w-md backdrop-blur-md pointer-events-auto">
                <h2 className="text-3xl font-black italic mb-6 text-center text-white">
                    {result.round_winner === 'Usuario' ? '🎉 HAS GANADO!' : result.round_winner === 'IA' ? '🤖 IA DOMINÓ' : '🤝 EMPATE'}
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-500/20 p-4 rounded-xl border border-blue-500/30 text-center">
                        <div className="text-xs text-blue-300 uppercase font-bold tracking-wider mb-1">Tú</div>
                        <div className="text-2xl font-mono text-white mb-0.5">{result.user.score}</div>
                        <div className="text-xs text-blue-200 opacity-60">{result.user.distance_km} km</div>
                    </div>
                    <div className="bg-purple-500/20 p-4 rounded-xl border border-purple-500/30 text-center">
                        <div className="text-xs text-purple-300 uppercase font-bold tracking-wider mb-1">IA</div>
                        <div className="text-2xl font-mono text-white mb-0.5">{result.ai.score}</div>
                        <div className="text-xs text-purple-200 opacity-60">{result.ai.distance_km} km</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onNextRound}
                        className="w-full py-3 bg-white text-black font-bold text-lg rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-widest shadow-lg"
                    >
                        Siguiente Ronda
                    </button>
                    <div className="text-center text-[10px] text-gray-500 font-mono">
                        Ubicación Real: {result.actual.lat.toFixed(4)}, {result.actual.lng.toFixed(4)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultOverlay;
