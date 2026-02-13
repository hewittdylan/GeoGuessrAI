import { useState, useEffect, useCallback } from 'react';
import { haversineDistance, calculateScore } from '../utils/gameLogic';

interface GameState {
    actualLocation: google.maps.LatLngLiteral | null;
    panoId: string;
    player1Guess: google.maps.LatLngLiteral | null;
    result: any | null;
    isSubmitting: boolean;
    loadingLocation: boolean;
    tilesLoaded: boolean;
}

interface UseGameLogicReturn extends GameState {
    setTilesLoaded: (loaded: boolean) => void;
    setPlayer1Guess: (guess: google.maps.LatLngLiteral | null) => void;
    handleMapClick: (e: google.maps.MapMouseEvent) => void;
    submitGuess: () => void;
    handleNextRound: () => void;
}

export const useGameLogic = (isLoaded: boolean, gameMode: 'human_vs_ai' | 'ai_vs_ai' = 'human_vs_ai'): UseGameLogicReturn => {
    // Estado del juego
    const [actualLocation, setActualLocation] = useState<google.maps.LatLngLiteral | null>(null);
    const [panoId, setPanoId] = useState('');
    const [player1Guess, setPlayer1Guess] = useState<google.maps.LatLngLiteral | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [tilesLoaded, setTilesLoaded] = useState(false);

    const findRandomLocation = useCallback(() => {
        if (!isLoaded || !window.google) return;

        setLoadingLocation(true);
        const sv = new google.maps.StreetViewService();

        const tryLocation = () => {
            const lat = (Math.random() * 170) - 85;
            const lng = (Math.random() * 360) - 180;
            const randomPoint = new google.maps.LatLng(lat, lng);

            sv.getPanorama({
                location: randomPoint,
                preference: google.maps.StreetViewPreference.NEAREST,
                radius: 100000,
                source: google.maps.StreetViewSource.OUTDOOR
            }, (data, status) => {
                if (status === google.maps.StreetViewStatus.OK && data && data.location && data.location.latLng) {
                    console.log("Found valid location:", data.location.description);
                    setActualLocation({
                        lat: data.location.latLng.lat(),
                        lng: data.location.latLng.lng()
                    });
                    setPanoId(data.location.pano || '');
                    setLoadingLocation(false);
                } else {
                    tryLocation();
                }
            });
        };

        tryLocation();
    }, [isLoaded]);

    // Carga inicial ubicación
    useEffect(() => {
        if (isLoaded && !actualLocation) {
            findRandomLocation();
        }
    }, [isLoaded, actualLocation, findRandomLocation]);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (result || gameMode === 'ai_vs_ai') return;
        if (e.latLng) {
            setPlayer1Guess({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    }, [result, gameMode]);

    const submitGuess = async () => {
        if (!actualLocation) return;
        // En human_vs_ai, necesitamos un player1Guess. En ai_vs_ai, lo generamos.
        if (gameMode === 'human_vs_ai' && !player1Guess) return;

        setIsSubmitting(true);

        setTimeout(() => {
            let finalPlayer1Guess = player1Guess;

            // 1. Lógica para el Jugador 1
            if (gameMode === 'ai_vs_ai') {
                // Simular la suposición de la IA 1
                const latDrift1 = (Math.random() - 0.5) * 4;
                const lngDrift1 = (Math.random() - 0.5) * 4;
                finalPlayer1Guess = {
                    lat: actualLocation.lat + latDrift1,
                    lng: actualLocation.lng + lngDrift1
                };
                setPlayer1Guess(finalPlayer1Guess);
            }

            if (!finalPlayer1Guess) return; // No debería pasar

            // Calcular la puntuación del Jugador 1
            const player1Dist = haversineDistance(actualLocation.lat, actualLocation.lng, finalPlayer1Guess.lat, finalPlayer1Guess.lng);
            const player1Score = calculateScore(player1Dist);

            // 2. Lógica para el Jugador 2
            const latDrift = (Math.random() - 0.5) * 4;
            const lngDrift = (Math.random() - 0.5) * 4;
            const aiLat = actualLocation.lat + latDrift;
            const aiLng = actualLocation.lng + lngDrift;

            const player2Dist = haversineDistance(actualLocation.lat, actualLocation.lng, aiLat, aiLng);
            const player2Score = calculateScore(player2Dist);

            // 3. Determinar el ganador
            let winner = "Empate";
            if (player1Score > player2Score) winner = gameMode === 'ai_vs_ai' ? "AI 1" : "Usuario";
            else if (player2Score > player1Score) winner = gameMode === 'ai_vs_ai' ? "AI 2" : "IA";

            setResult({
                round_winner: winner,
                player1: { score: player1Score, distance_km: player1Dist.toFixed(2), lat: finalPlayer1Guess.lat, lng: finalPlayer1Guess.lng },
                player2: { score: player2Score, distance_km: player2Dist.toFixed(2), lat: aiLat, lng: aiLng },
                actual: actualLocation
            });

            setIsSubmitting(false);
        }, 800);
    };

    const handleNextRound = () => {
        setResult(null);
        setPlayer1Guess(null);
        setTilesLoaded(false);
        findRandomLocation();
    };

    return {
        actualLocation,
        panoId,
        player1Guess,
        result,
        isSubmitting,
        loadingLocation,
        tilesLoaded,
        setTilesLoaded,
        setPlayer1Guess,
        handleMapClick,
        submitGuess,
        handleNextRound
    };
};
