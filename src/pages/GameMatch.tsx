import { useGoogleMaps } from '../logic/useGoogleMaps';
import { useGameLogic } from '../logic/useGameLogic';
import Diagnostics from '../components/Diagnostics';
import ResultOverlay from '../components/ResultOverlay';
import GameMap from '../components/GameMap';
import StreetView from '../components/StreetView';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import { useNavigate } from 'react-router-dom';

export default function GameMatch() {
    const navigate = useNavigate();
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || localStorage.getItem('GOOGLE_MAPS_KEY') || '';

    const { isLoaded, loadError, authError } = useGoogleMaps(apiKey);

    const {
        actualLocation,
        panoId,
        userGuess,
        result,
        isSubmitting,
        loadingLocation,
        tilesLoaded,
        setTilesLoaded,
        handleMapClick,
        submitGuess,
        handleNextRound
    } = useGameLogic(isLoaded);

    const handleExit = () => {
        navigate('/');
    };

    if (loadError) {
        return <ErrorScreen error={loadError} />;
    }

    if (!isLoaded || loadingLocation || !actualLocation) {
        return <LoadingScreen isFindingLocation={loadingLocation} />;
    }

    return (
        <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
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
                />
            )}

            <GameMap
                userGuess={userGuess}
                onMapClick={handleMapClick}
                onTilesLoaded={() => setTilesLoaded(true)}
                isSubmitting={isSubmitting}
                onSubmit={submitGuess}
                showResult={!!result}
                result={result}
            />

        </div>
    );
}
