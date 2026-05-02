import React, { useEffect, useRef } from 'react';

interface StreetViewProps {
    panoId: string;
    isLoaded: boolean;
    onPanoChanged?: (panoId: string) => void;
}

const StreetView: React.FC<StreetViewProps> = ({ panoId, isLoaded, onPanoChanged }) => {
    const streetViewRef = useRef<HTMLDivElement>(null);
    const streetViewInstance = useRef<google.maps.StreetViewPanorama | null>(null);
    const lastSetPanoId = useRef<string | null>(null);

    useEffect(() => {
        if (!streetViewRef.current || !isLoaded) return;

        if (!streetViewInstance.current) {
            const panorama = new google.maps.StreetViewPanorama(streetViewRef.current, {
                disableDefaultUI: true,
                showRoadLabels: false,
                visible: true,
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
                imageDateControl: true,
                motionTracking: false
            });
            streetViewInstance.current = panorama;

            // Suscribirse a cambios en el panorama si el usuario se desplaza
            panorama.addListener('pano_changed', () => {
                const currentPano = panorama.getPano();
                if (currentPano) {
                    lastSetPanoId.current = currentPano; // El usuario lo ha movido, registramos dónde estamos
                    if (onPanoChanged) {
                        onPanoChanged(currentPano);
                    }
                }
            });
        }

        // Actualizar ID del panorama si cambia
        if (panoId && streetViewInstance.current && lastSetPanoId.current !== panoId) {
            lastSetPanoId.current = panoId;
            streetViewInstance.current.setPano(panoId);
            streetViewInstance.current.setVisible(true);
        }
    }, [isLoaded, panoId, onPanoChanged]);

    return <div ref={streetViewRef} className="absolute inset-0 z-0 bg-slate-900" />;
};

export default StreetView;
