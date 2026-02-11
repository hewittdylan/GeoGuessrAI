import React, { useEffect, useRef } from 'react';

interface StreetViewProps {
    panoId: string;
    isLoaded: boolean;
}

const StreetView: React.FC<StreetViewProps> = ({ panoId, isLoaded }) => {
    const streetViewRef = useRef<HTMLDivElement>(null);
    const streetViewInstance = useRef<google.maps.StreetViewPanorama | null>(null);

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
        }

        // Update Pano ID if changed
        if (panoId && streetViewInstance.current) {
            streetViewInstance.current.setPano(panoId);
            streetViewInstance.current.setVisible(true);
        }
    }, [isLoaded, panoId]);

    return <div ref={streetViewRef} className="absolute inset-0 z-0 bg-slate-900" />;
};

export default StreetView;
