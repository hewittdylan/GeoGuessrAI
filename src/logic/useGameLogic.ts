import { useState, useEffect, useCallback } from 'react';
import { haversineDistance, calculateScore } from '../utils/gameLogic';

interface GameState {
    actualLocation: google.maps.LatLngLiteral | null;
    panoId: string;
    userGuess: google.maps.LatLngLiteral | null;
    result: any | null;
    isSubmitting: boolean;
    loadingLocation: boolean;
    tilesLoaded: boolean;
}

interface UseGameLogicReturn extends GameState {
    setTilesLoaded: (loaded: boolean) => void;
    setUserGuess: (guess: google.maps.LatLngLiteral | null) => void;
    handleMapClick: (e: google.maps.MapMouseEvent) => void;
    submitGuess: () => void;
    handleNextRound: () => void;
}

export const useGameLogic = (isLoaded: boolean): UseGameLogicReturn => {
    // Estado del juego
    const [actualLocation, setActualLocation] = useState<google.maps.LatLngLiteral | null>(null);
    const [panoId, setPanoId] = useState('');
    const [userGuess, setUserGuess] = useState<google.maps.LatLngLiteral | null>(null);
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
        if (result) return;
        if (e.latLng) {
            setUserGuess({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    }, [result]);

    const submitGuess = async () => {
        if (!userGuess || !actualLocation) return;
        setIsSubmitting(true);

        setTimeout(() => {
            // 1. Suposición del usuario
            const userDist = haversineDistance(actualLocation.lat, actualLocation.lng, userGuess.lat, userGuess.lng);
            const userScore = calculateScore(userDist);

            // 2. Simulación de IA
            const latDrift = (Math.random() - 0.5) * 4;
            const lngDrift = (Math.random() - 0.5) * 4;
            const aiLat = actualLocation.lat + latDrift;
            const aiLng = actualLocation.lng + lngDrift;

            const aiDist = haversineDistance(actualLocation.lat, actualLocation.lng, aiLat, aiLng);
            const aiScore = calculateScore(aiDist);

            // 3. Determinar el ganador
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
        findRandomLocation();
    };

    return {
        actualLocation,
        panoId,
        userGuess,
        result,
        isSubmitting,
        loadingLocation,
        tilesLoaded,
        setTilesLoaded,
        setUserGuess,
        handleMapClick,
        submitGuess,
        handleNextRound
    };
};
