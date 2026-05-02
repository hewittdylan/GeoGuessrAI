import { useState, useEffect, useCallback, useRef } from 'react';
import { haversineDistance, calculateScore, getStreetViewStaticUrl } from '../utils/gameLogic';

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
    aiGuess: google.maps.LatLngLiteral | null; // Mantenido para compatibilidad de interfaz
    aiGuess1: google.maps.LatLngLiteral | null;
    aiGuess2: google.maps.LatLngLiteral | null;
}

interface UseGameLogicReturn extends GameState {
    setTilesLoaded: (loaded: boolean) => void;
    setPlayer1Guess: (guess: google.maps.LatLngLiteral | null) => void;
    handleMapClick: (e: google.maps.MapMouseEvent) => void;
    submitGuess: () => void;
    handleNextRound: () => void;
    debugUrls: string[];
    top5Predictions: any[];
    handlePanoChange: (newPanoId: string) => void;
}

const STARTING_HEALTH = 10000;
const ROUND_TIME = 90;

export const useGameLogic = (
    isLoaded: boolean,
    gameMode: 'human_vs_ai' | 'ai_vs_ai' = 'human_vs_ai',
    model1Id: string = '',
    model2Id: string = ''
): UseGameLogicReturn => {
    const [actualLocation, setActualLocation] = useState<google.maps.LatLngLiteral | null>(null);
    const [panoId, setPanoId] = useState('');
    const [player1Guess, setPlayer1Guess] = useState<google.maps.LatLngLiteral | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [tilesLoaded, setTilesLoaded] = useState(false);

    const [aiGuess1, setAiGuess1] = useState<google.maps.LatLngLiteral | null>(null);
    const [aiGuess2, setAiGuess2] = useState<google.maps.LatLngLiteral | null>(null);

    const aiConfidence1 = useRef<number>(-1);
    const aiConfidence2 = useRef<number>(-1);

    const [debugUrls, setDebugUrls] = useState<string[]>([]);
    const [top5Predictions, setTop5Predictions] = useState<any[]>([]);

    // Estado competitivo
    const [player1TotalScore, setPlayer1TotalScore] = useState(STARTING_HEALTH);
    const [player2TotalScore, setPlayer2TotalScore] = useState(STARTING_HEALTH);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [matchWinner, setMatchWinner] = useState<'player1' | 'player2' | null>(null);

    // Predicción del backend
    useEffect(() => {
        if (!panoId || !import.meta.env.VITE_GOOGLE_MAPS_KEY || result || matchWinner) return;

        let isCancelled = false;

        const timeoutId = setTimeout(() => {
            const fetchAiPrediction = async () => {
                // Añadimos la ubicación para que el backend pueda calcular el error de distancia
                let locationParams = "";
                if (actualLocation) {
                    locationParams = `&location=${actualLocation.lat},${actualLocation.lng}`;
                }

                const urls = [0, 90, 180, 270].map(heading => getStreetViewStaticUrl({
                    panoId,
                    heading,
                    pitch: 0,
                    fov: 90,
                    apiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
                    width: 640,
                    height: 680
                }) + locationParams);

                setDebugUrls(urls);

                try {
                    // Jugador 2 (IA)
                    if (model2Id) {
                        const res2 = await fetch('http://localhost:8000/predict', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ urls, model_id: model2Id })
                        });
                        if (res2.ok && !isCancelled) {
                            const data2 = await res2.json();
                            if (data2.best && data2.best.confidence > aiConfidence2.current) {
                                setAiGuess2(data2.best);
                                aiConfidence2.current = data2.best.confidence;
                                setTop5Predictions(data2.top_5 || []);
                                console.log("Predicción de IA 2 actualizada (mejor confianza)", data2.best.confidence);
                            }
                        }
                    }

                    // Jugador 1 (Solo si es IA vs IA)
                    if (gameMode === 'ai_vs_ai' && model1Id) {
                        const res1 = await fetch('http://localhost:8000/predict', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ urls, model_id: model1Id })
                        });
                        if (res1.ok && !isCancelled) {
                            const data1 = await res1.json();
                            if (data1.best && data1.best.confidence > aiConfidence1.current) {
                                setAiGuess1(data1.best);
                                aiConfidence1.current = data1.best.confidence;
                                console.log("Predicción de IA 1 actualizada (mejor confianza)", data1.best.confidence);
                            }
                        }
                    }
                } catch (error) {
                    if (!isCancelled) {
                        console.error("Error al obtener la predicción de IA:", error);
                    }
                }
            };

            fetchAiPrediction();
        }, 500);  // Espera a que el jugador deje de moverse durante 500ms antes de pedir la predicción

        return () => {
            isCancelled = true;
            clearTimeout(timeoutId);
        };
    }, [panoId, actualLocation, gameMode, model1Id, model2Id, result, matchWinner]);


    // Referencias para el temporizador
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const submitGuessRef = useRef<((forceTimeOut: boolean) => void) | null>(null);

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
                    console.log("Encontrada ubicación válida:", data.location.description);
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
                    // Forzar envío con la función actualizada
                    if (submitGuessRef.current) submitGuessRef.current(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [matchWinner, result, loadingLocation, isSubmitting]);

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
                if (aiGuess1) {
                    finalPlayer1Guess = aiGuess1;
                } else {
                    const latDrift1 = (Math.random() - 0.5) * 4;
                    const lngDrift1 = (Math.random() - 0.5) * 4;
                    finalPlayer1Guess = {
                        lat: actualLocation.lat + latDrift1,
                        lng: actualLocation.lng + lngDrift1
                    };
                }
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
            let aiLat = actualLocation.lat;
            let aiLng = actualLocation.lng;

            if (aiGuess2) {
                aiLat = aiGuess2.lat;
                aiLng = aiGuess2.lng;
            } else {
                const latDrift = (Math.random() - 0.5) * 4;
                const lngDrift = (Math.random() - 0.5) * 4;
                aiLat += latDrift;
                aiLng += lngDrift;
            }

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

    // Actualizamos la ref en cada render
    submitGuessRef.current = submitGuess;

    const handleNextRound = () => {
        if (matchWinner) {
            setMatchWinner(null);
            setPlayer1TotalScore(STARTING_HEALTH);
            setPlayer2TotalScore(STARTING_HEALTH);
        }

        setResult(null);
        setPlayer1Guess(null);
        setTilesLoaded(false);
        setAiGuess1(null);
        setAiGuess2(null);
        aiConfidence1.current = -1;
        aiConfidence2.current = -1;
        setTop5Predictions([]);
        setDebugUrls([]);
        findRandomLocation();
    };

    // Diagnostics usa aiGuess para saber si la IA está lista. 
    // En AI vs AI, ambas IA deben estar listas.
    const isAiReady = gameMode === 'ai_vs_ai' ? (!!aiGuess1 && !!aiGuess2) : !!aiGuess2;

    return {
        actualLocation,
        panoId,
        player1Guess,
        result,
        isSubmitting,
        loadingLocation,
        tilesLoaded,
        aiGuess: isAiReady ? aiGuess2 : null, // Retrocompatibilidad visual, null si no está listo
        aiGuess1,
        aiGuess2,
        debugUrls,
        top5Predictions,
        handlePanoChange: (newPano: string) => {
            if (!result && !matchWinner) setPanoId(newPano);
        },
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
