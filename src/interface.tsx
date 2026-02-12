import { useGoogleMaps } from './logic/useGoogleMaps';
import { useGameLogic } from './logic/useGameLogic';
import Diagnostics from './components/Diagnostics';
import ResultOverlay from './components/ResultOverlay';
import GameMap from './components/GameMap';
import StreetView from './components/StreetView';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';

export default function Interface() {
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

  if (loadError) {
    return <ErrorScreen error={loadError} />;
  }

  if (!isLoaded || loadingLocation || !actualLocation) {
    return <LoadingScreen isFindingLocation={loadingLocation} />;
  }

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">

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