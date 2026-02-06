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
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800 p-8 rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full">
                <h2 className="text-4xl font-black italic mb-8 text-center text-white">
                    {result.round_winner === 'User' ? '🎉 HAS GANADO!' : result.round_winner === 'AI' ? '🤖 IA DOMINÓ' : '🤝 EMPATE'}
                </h2>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-blue-500/20 p-6 rounded-2xl border border-blue-500/30 text-center transform hover:scale-105 transition-transform">
                        <div className="text-sm text-blue-300 uppercase font-bold tracking-wider mb-2">Tú</div>
                        <div className="text-4xl font-mono text-white mb-1">{result.user.score}</div>
                        <div className="text-sm text-blue-200 opacity-60">{result.user.distance_km} km</div>
                    </div>
                    <div className="bg-purple-500/20 p-6 rounded-2xl border border-purple-500/30 text-center transform hover:scale-105 transition-transform">
                        <div className="text-sm text-purple-300 uppercase font-bold tracking-wider mb-2">IA</div>
                        <div className="text-4xl font-mono text-white mb-1">{result.ai.score}</div>
                        <div className="text-sm text-purple-200 opacity-60">{result.ai.distance_km} km</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={onNextRound}
                        className="w-full py-4 bg-white text-black font-bold text-xl rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-widest"
                    >
                        Siguiente Ronda
                    </button>
                    <div className="text-center text-xs text-gray-500 font-mono">
                        Ubicación Real: {result.actual.lat.toFixed(4)}, {result.actual.lng.toFixed(4)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultOverlay;
