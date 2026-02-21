import { useState, useEffect, useCallback, useRef } from 'react';
import { haversineDistance, calculateScore } from '../utils/gameLogic';

interface GameState {
    actualLocation: google.maps.LatLngLiteral | null;
    panoId: string;
    player1Guess: google.maps.LatLngLiteral | null;
    result: any | null;
    isSubmitting: boolean;
    loadingLocation: boolean;
    tilesLoaded: boolean;
    player1TotalScore: number;
    player2TotalScore: number;
    timeLeft: number;
    matchWinner: 'player1' | 'player2' | null;
}

interface UseGameLogicReturn extends GameState {
    setTilesLoaded: (loaded: boolean) => void;
    setPlayer1Guess: (guess: google.maps.LatLngLiteral | null) => void;
    handleMapClick: (e: google.maps.MapMouseEvent) => void;
    submitGuess: () => void;
    handleNextRound: () => void;
}

const STARTING_HEALTH = 10000;
const ROUND_TIME = 120;

export const useGameLogic = (isLoaded: boolean, gameMode: 'human_vs_ai' | 'ai_vs_ai' = 'human_vs_ai'): UseGameLogicReturn => {
    // Estado del juego
    const [actualLocation, setActualLocation] = useState<google.maps.LatLngLiteral | null>(null);
    const [panoId, setPanoId] = useState('');
    const [player1Guess, setPlayer1Guess] = useState<google.maps.LatLngLiteral | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [tilesLoaded, setTilesLoaded] = useState(false);

    // Estado competitivo
    const [player1TotalScore, setPlayer1TotalScore] = useState(STARTING_HEALTH);
    const [player2TotalScore, setPlayer2TotalScore] = useState(STARTING_HEALTH);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [matchWinner, setMatchWinner] = useState<'player1' | 'player2' | null>(null);

    // Referencias para el temporizador
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
                    // Reiniciar temporizador al encontrar nueva ubicación
                    setTimeLeft(ROUND_TIME);
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

    // Efecto del Temporizador
    useEffect(() => {
        if (matchWinner || result || loadingLocation || isSubmitting) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    // Forzar envío cuando el tiempo se agota
                    submitGuess(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [matchWinner, result, loadingLocation, isSubmitting]); // submitGuess es stable, pero lo quitamos de deptos para evitar loops si cambia

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (result || gameMode === 'ai_vs_ai' || matchWinner) return;
        if (e.latLng) {
            setPlayer1Guess({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    }, [result, gameMode, matchWinner]);

    // Modificamos submitGuess para aceptar un flag de "forzado por tiempo"
    const submitGuess = async (forceTimeOut: boolean = false) => {
        if (!actualLocation) return;

        // Si no es forzado y no hay guess en modo humano, return
        if (!forceTimeOut && gameMode === 'human_vs_ai' && !player1Guess) return;

        setIsSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        // Pequeño delay para simular proceso y UX
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
            } else if (forceTimeOut && !player1Guess) {
                // Si se acabó el tiempo y no adivinó, null (tratado como 0 puntos)
                finalPlayer1Guess = null;
            }

            // Calcular puntuación Jugador 1
            let player1Score = 0;
            let player1Dist = 0;

            if (finalPlayer1Guess) {
                player1Dist = haversineDistance(actualLocation.lat, actualLocation.lng, finalPlayer1Guess.lat, finalPlayer1Guess.lng);
                player1Score = calculateScore(player1Dist);
            } else {
                // Penalización por no adivinar: 0 puntos
                player1Score = 0;
            }

            // 2. Lógica para el Jugador 2
            const latDrift = (Math.random() - 0.5) * 4;
            const lngDrift = (Math.random() - 0.5) * 4;
            const aiLat = actualLocation.lat + latDrift;
            const aiLng = actualLocation.lng + lngDrift;

            const player2Dist = haversineDistance(actualLocation.lat, actualLocation.lng, aiLat, aiLng);
            const player2Score = calculateScore(player2Dist);

            // 3. Determinar el ganador de la ronda y daño
            let roundWinner = "Empate";
            let damage = Math.abs(player1Score - player2Score);

            let newP1Total = player1TotalScore;
            let newP2Total = player2TotalScore;

            if (player1Score > player2Score) {
                roundWinner = gameMode === 'ai_vs_ai' ? "AI 1" : "Usuario";
                newP2Total = Math.max(0, player2TotalScore - damage);
            } else if (player2Score > player1Score) {
                roundWinner = gameMode === 'ai_vs_ai' ? "AI 2" : "IA";
                newP1Total = Math.max(0, player1TotalScore - damage);
            } else {
                // En empate exacto, nadie recibe daño
                damage = 0;
            }

            // Actualizar totales
            setPlayer1TotalScore(newP1Total);
            setPlayer2TotalScore(newP2Total);

            // Verificar fin de partida
            let finalMatchWinner: 'player1' | 'player2' | null = null;
            if (newP1Total <= 0) finalMatchWinner = 'player2';
            if (newP2Total <= 0) finalMatchWinner = 'player1';

            if (finalMatchWinner) {
                setMatchWinner(finalMatchWinner);
            }

            setResult({
                round_winner: roundWinner,
                player1: {
                    score: player1Score,
                    distance_km: finalPlayer1Guess ? player1Dist.toFixed(2) : "N/A",
                    lat: finalPlayer1Guess?.lat,
                    lng: finalPlayer1Guess?.lng
                },
                player2: {
                    score: player2Score,
                    distance_km: player2Dist.toFixed(2),
                    lat: aiLat,
                    lng: aiLng
                },
                actual: actualLocation,
                damage: damage, // Para mostrar cuánto se restó
                p1Total: newP1Total,
                p2Total: newP2Total,
                matchOver: !!finalMatchWinner
            });

            setIsSubmitting(false);
        }, 800);
    };

    const handleNextRound = () => {
        if (matchWinner) {
            setMatchWinner(null);
            setPlayer1TotalScore(STARTING_HEALTH);
            setPlayer2TotalScore(STARTING_HEALTH);
        }

        setResult(null);
        setPlayer1Guess(null);
        setTilesLoaded(false);
        // El timer se reiniciará cuando findRandomLocation encuentre una ubicación
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
        submitGuess: () => submitGuess(false),
        handleNextRound,
        player1TotalScore,
        player2TotalScore,
        timeLeft,
        matchWinner
    };
};
