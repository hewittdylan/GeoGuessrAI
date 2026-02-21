import { useGoogleMaps } from '../logic/useGoogleMaps';
import { useGameLogic } from '../logic/useGameLogic';
import Diagnostics from '../components/Diagnostics';
import ResultOverlay from '../components/ResultOverlay';
import GameMap from '../components/GameMap';
import StreetView from '../components/StreetView';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import { useNavigate, useLocation } from 'react-router-dom';
import HealthBar from '../components/HealthBar';

export default function GameMatch() {
    const navigate = useNavigate();
    const location = useLocation();
    const gameMode = (location.state as { gameMode?: 'human_vs_ai' | 'ai_vs_ai' })?.gameMode || 'human_vs_ai';

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || localStorage.getItem('GOOGLE_MAPS_KEY') || '';

    const { isLoaded, loadError, authError } = useGoogleMaps(apiKey);

    const {
        actualLocation,
        panoId,
        player1Guess,
        result,
        isSubmitting,
        loadingLocation,
        tilesLoaded,
        setTilesLoaded,
        handleMapClick,
        submitGuess,
        handleNextRound,
        player1TotalScore,
        player2TotalScore,
        timeLeft,
        matchWinner
    } = useGameLogic(isLoaded, gameMode);

    const handleExit = () => {
        navigate('/');
    };

    if (loadError) {
        return <ErrorScreen error={loadError} />;
    }

    if (!isLoaded || loadingLocation || !actualLocation) {
        return <LoadingScreen isFindingLocation={loadingLocation} />;
    }

    // Formato de tiempo MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
            {/* Header: Barras de Vida y Tiempo */}

            {/* Botón vuelta al menú principal */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={handleExit}
                    className="bg-black/40 hover:bg-black/60 text-white/80 p-2 rounded-lg backdrop-blur-sm transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
            </div>

            <Diagnostics
                isLoaded={isLoaded}
                tilesLoaded={tilesLoaded}
                isSubmitting={isSubmitting}
                authError={authError}
            />

            <StreetView
                panoId={panoId}
                isLoaded={isLoaded}
            />

            {result && (
                <ResultOverlay
                    result={result}
                    onNextRound={handleNextRound}
                    gameMode={gameMode}
                    matchWinner={matchWinner}
                    onExit={handleExit}
                />
            )}

            <GameMap
                player1Guess={player1Guess}
                onMapClick={handleMapClick}
                onTilesLoaded={() => setTilesLoaded(true)}
                isSubmitting={isSubmitting}
                onSubmit={submitGuess}
                showResult={!!result}
                result={result}
                gameMode={gameMode}
            />

            {/* Header: Barras de Vida y Tiempo */}
            <div className="absolute top-0 inset-x-0 z-[100] bg-gradient-to-b from-black/90 to-transparent pt-4 pb-12 px-8 pointer-events-none">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 h-24">

                    {/* Jugador 1 Salud */}
                    <HealthBar
                        current={player1TotalScore}
                        max={10000}
                        color="bg-amber-500"
                        label={gameMode === 'ai_vs_ai' ? 'IA 1' : 'TÚ'}
                        isRightAligned={false}
                    />

                    {/* Temporizador Central */}
                    <div className="flex flex-col items-center justify-center min-w-[120px] -mt-2">
                        <div className={`text-5xl font-black tracking-widest drop-shadow-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(timeLeft)}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">Tiempo</div>
                    </div>

                    {/* Jugador 2 Salud */}
                    <HealthBar
                        current={player2TotalScore}
                        max={10000}
                        color="bg-rose-600"
                        label={gameMode === 'ai_vs_ai' ? 'IA 2' : 'RIVAL'}
                        isRightAligned={true}
                    />

                </div>
            </div>

        </div>
    );
}
