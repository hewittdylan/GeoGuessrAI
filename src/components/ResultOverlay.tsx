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
    const isUserWinner = result.round_winner === 'Usuario';
    const isAiWinner = result.round_winner === 'IA';

    return (
        <div className="absolute inset-x-0 bottom-8 z-50 flex justify-center pointer-events-none px-4">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-1 pointer-events-auto flex items-stretch">

                {/* Sección Usuario */}
                <div className="flex flex-col justify-center items-center px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 min-w-[140px]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mb-1">Tu Estimación</div>
                    <div className="text-2xl font-black text-white">{result.user.score} <span className="text-xs font-normal text-blue-300 opacity-60">pts</span></div>
                    <div className="text-sm font-mono text-blue-200 mt-1">{result.user.distance_km} <span className="text-[10px] opacity-50">km</span></div>
                </div>

                {/*Sección Central*/}
                <div className="flex flex-col justify-center items-center px-8 mx-2 gap-3">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mb-1">
                            Ubicación Real
                        </span>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-black/20 px-3 py-1 rounded-full">
                            <span>{result.actual.lat.toFixed(4)}, {result.actual.lng.toFixed(4)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`text-xl font-black italic tracking-wider ${isUserWinner ? 'text-green-400' : isAiWinner ? 'text-purple-400' : 'text-white'
                            }`}>
                            {isUserWinner ? 'VICTORIA' : isAiWinner ? 'DERROTA' : 'EMPATE'}
                        </div>
                        <button
                            onClick={onNextRound}
                            className="bg-white hover:bg-gray-100 text-slate-900 font-bold py-2 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg active:scale-95 text-sm uppercase tracking-wide"
                        >
                            Siguiente Ronda
                        </button>
                    </div>
                </div>

                {/* Sección IA */}
                <div className="flex flex-col justify-center items-center px-6 py-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 min-w-[140px]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-purple-400 mb-1">Estimación IA</div>
                    <div className="text-2xl font-black text-white">{result.ai.score} <span className="text-xs font-normal text-purple-300 opacity-60">pts</span></div>
                    <div className="text-sm font-mono text-purple-200 mt-1">{result.ai.distance_km} <span className="text-[10px] opacity-50">km</span></div>
                </div>

            </div>
        </div>
    );
};

export default ResultOverlay;
