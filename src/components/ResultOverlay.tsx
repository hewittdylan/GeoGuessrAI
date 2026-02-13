import React from 'react';

interface ResultOverlayProps {
    result: {
        round_winner: string;
        player1: { score: number; distance_km: string; lat: number; lng: number };
        player2: { score: number; distance_km: string; lat: number; lng: number };
        actual: google.maps.LatLngLiteral;
    };
    onNextRound: () => void;
    gameMode?: 'human_vs_ai' | 'ai_vs_ai';
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ result, onNextRound, gameMode = 'human_vs_ai' }) => {
    // Determinar el ganador según el modo de juego y el resultado
    const isPlayer1Winner = result.round_winner === 'Usuario' || result.round_winner === 'AI 1';
    const isPlayer2Winner = result.round_winner === 'IA' || result.round_winner === 'AI 2';

    // Etiquetas
    const leftLabel = gameMode === 'ai_vs_ai' ? 'Estimación IA 1' : 'Tu Estimación';
    const rightLabel = gameMode === 'ai_vs_ai' ? 'Estimación IA 2' : 'Estimación IA';

    // Texto de victoria
    let victoryText = 'EMPATE';
    if (isPlayer1Winner) {
        victoryText = gameMode === 'ai_vs_ai' ? 'VICTORIA IA 1' : 'VICTORIA';
    } else if (isPlayer2Winner) {
        victoryText = gameMode === 'ai_vs_ai' ? 'VICTORIA IA 2' : 'DERROTA';
    }

    return (
        <div className="absolute inset-x-0 bottom-8 z-50 flex justify-center pointer-events-none px-4">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-1 pointer-events-auto flex items-stretch">

                {/* Sección Jugador 1 */}
                <div className="flex flex-col justify-center items-center px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 min-w-[140px]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400 mb-1">{leftLabel}</div>
                    <div className="text-2xl font-black text-white">{result.player1.score} <span className="text-xs font-normal text-amber-300 opacity-60">pts</span></div>
                    <div className="text-sm font-mono text-amber-200 mt-1">{result.player1.distance_km} <span className="text-[10px] opacity-50">km</span></div>
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
                        <div className={`text-xl font-black italic tracking-wider ${isPlayer1Winner ? 'text-amber-400' : isPlayer2Winner ? 'text-rose-500' : 'text-white'
                            }`}>
                            {victoryText}
                        </div>
                        <button
                            onClick={onNextRound}
                            className="bg-white hover:bg-gray-100 text-slate-900 font-bold py-2 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg active:scale-95 text-sm uppercase tracking-wide"
                        >
                            Siguiente Ronda
                        </button>
                    </div>
                </div>

                {/* Sección Jugador 2 */}
                <div className="flex flex-col justify-center items-center px-6 py-3 rounded-2xl bg-rose-600/10 border border-rose-600/20 min-w-[140px]">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-rose-500 mb-1">{rightLabel}</div>
                    <div className="text-2xl font-black text-white">{result.player2.score} <span className="text-xs font-normal text-rose-400 opacity-60">pts</span></div>
                    <div className="text-sm font-mono text-rose-300 mt-1">{result.player2.distance_km} <span className="text-[10px] opacity-50">km</span></div>
                </div>

            </div>
        </div>
    );
};

export default ResultOverlay;
