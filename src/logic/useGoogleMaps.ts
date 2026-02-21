import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

interface UseGoogleMapsReturn {
    isLoaded: boolean;
    loadError: Error | undefined;
    authError: boolean;
}

export const useGoogleMaps = (apiKey: string): UseGoogleMapsReturn => {
    const [authError, setAuthError] = useState(false);

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: apiKey
    });

    useEffect(() => {
        // @ts-ignore
        window.gm_authFailure = () => {
            console.error("Google Maps Auth Failure detected!");
            setAuthError(true);
        };

        return () => {
            // @ts-ignore
            window.gm_authFailure = () => { };
        };
    }, []);

    return { isLoaded, loadError, authError };
};
