import { useCallback, useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

import { haversineDistance, calculateScore } from './utils/gameLogic';
import Diagnostics from './components/Diagnostics';
import ResultOverlay from './components/ResultOverlay';
import GameMap from './components/GameMap';
import StreetView from './components/StreetView';

export default function Interface() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || localStorage.getItem('GOOGLE_MAPS_KEY') || '';

  // Estado del juego
  const [actualLocation, setActualLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [panoId, setPanoId] = useState('');
  const [userGuess, setUserGuess] = useState<google.maps.LatLngLiteral | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Estado del sistema
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [authError, setAuthError] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  // Captura de errores de autentificación de Google Maps
  useEffect(() => {
    // @ts-ignore
    window.gm_authFailure = () => {
      console.error("Google Maps Auth Failure detected!");
      setAuthError(true);
    };
  }, []);

  const findRandomLocation = useCallback(() => {
    if (!window.google) return;

    setLoadingLocation(true);
    const sv = new google.maps.StreetViewService();

    const tryLocation = () => {
      // Genera un punto aleatorio
      const lat = (Math.random() * 170) - 85; // Evita los polos extremos
      const lng = (Math.random() * 360) - 180;
      const randomPoint = new google.maps.LatLng(lat, lng);

      sv.getPanorama({
        location: randomPoint,
        preference: google.maps.StreetViewPreference.NEAREST,
        radius: 100000, // 100km de radio para encontrar una carretera cercana
        source: google.maps.StreetViewSource.OUTDOOR // Preferencia por outdoor
      }, (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data && data.location && data.location.latLng) {
          // Found a valid spot!
          console.log("Found valid location:", data.location.description);
          setActualLocation({
            lat: data.location.latLng.lat(),
            lng: data.location.latLng.lng()
          });
          setPanoId(data.location.pano || '');
          setLoadingLocation(false);
        } else {
          // Error de formato o sin suerte
          // Reintentar hasta encontrar ubicación Geoguessr friendly
          tryLocation();
        }
      });
    };

    tryLocation();
  }, [isLoaded]);

  // Carga de ubicación inicial
  useEffect(() => {
    if (isLoaded && !actualLocation) {
      findRandomLocation();
    }
  }, [isLoaded, findRandomLocation, actualLocation]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (result) return; // Game over
    if (e.latLng) {
      setUserGuess({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, [result]);

  const submitGuess = async () => {
    if (!userGuess || !actualLocation) return;
    setIsSubmitting(true);

    // Simulación de tiempo pensando
    setTimeout(() => {
      // 1. Cálculo del usuario
      const userDist = haversineDistance(actualLocation.lat, actualLocation.lng, userGuess.lat, userGuess.lng);
      const userScore = calculateScore(userDist);

      // 2. Simulación de IA (200-300km de fallo)
      const latDrift = (Math.random() - 0.5) * 4;
      const lngDrift = (Math.random() - 0.5) * 4;
      const aiLat = actualLocation.lat + latDrift;
      const aiLng = actualLocation.lng + lngDrift;

      const aiDist = haversineDistance(actualLocation.lat, actualLocation.lng, aiLat, aiLng);
      const aiScore = calculateScore(aiDist);

      // 3. Determinar Ganador
      let winner = "Empate";
      if (userScore > aiScore) winner = "Usuario";
      else if (aiScore > userScore) winner = "IA";

      setResult({
        round_winner: winner,
        user: { score: userScore, distance_km: userDist.toFixed(2), lat: userGuess.lat, lng: userGuess.lng },
        ai: { score: aiScore, distance_km: aiDist.toFixed(2), lat: aiLat, lng: aiLng },
        actual: actualLocation
      });

      setIsSubmitting(false);
    }, 800);
  };

  const handleNextRound = () => {
    setResult(null);
    setUserGuess(null);
    setTilesLoaded(false);
    setAuthError(false);
    findRandomLocation();
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-red-900 text-white p-4">
        <div>
          <h1 className="text-2xl font-bold">Error al cargar API</h1>
          <p>{loadError.message}</p>
          <p className="text-sm mt-2">Clave usada: {apiKey ? `${apiKey.substring(0, 5)}...` : 'Ninguna'}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || loadingLocation || !actualLocation) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-slate-900 text-white flex-col space-y-4">
        <div className="text-4xl animate-bounce">🌍</div>
        <div className="text-xl animate-pulse font-mono">{loadingLocation ? "Searching for a random spot..." : "Loading Map..."}</div>
        <div className="text-xs opacity-50">Searching worldwide...</div>
      </div>
    );
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