export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const calculateScore = (distanceKm: number) => {
    const maxScore = 5000;
    if (distanceKm < 0.05) return maxScore;
    const score = maxScore * Math.exp(-distanceKm / 2000);
    return Math.round(Math.max(0, score));
};

interface GetStreetViewUrlParams {
    panoId: string;
    heading: number;
    pitch: number;
    fov: number;
    apiKey: string;
    width?: number;
    height?: number;
}

export const getStreetViewStaticUrl = ({
    panoId,
    heading,
    pitch,
    fov,
    apiKey,
    width = 640,
    height = 640
}: GetStreetViewUrlParams): string => {
    // Clamp FOV
    const clampedFov = Math.min(Math.max(fov, 10), 120);
    return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&pano=${panoId}&heading=${heading}&pitch=${pitch}&fov=${clampedFov}&key=${apiKey}`;
};
