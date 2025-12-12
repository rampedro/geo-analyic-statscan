import { GeoPoint } from "../types";

// Helper to generate points around a center
const generateCluster = (
  city: string,
  baseLat: number,
  baseLng: number,
  count: number,
  spread: number
): GeoPoint[] => {
  const points: GeoPoint[] = [];
  for (let i = 0; i < count; i++) {
    // Random offset
    const lat = baseLat + (Math.random() - 0.5) * spread;
    const lng = baseLng + (Math.random() - 0.5) * spread;

    // Simulate correlation: Higher real estate often means better social score, but maybe varies crime
    const realEstatePrice = 400000 + Math.random() * 1500000;
    const realEstateTrend = (Math.random() * 2) - 1; // -1 to 1

    const socialScore = 40 + Math.random() * 60;
    const socialTrend = (Math.random() * 2) - 1;

    // Crime is often inverse to social score, but not always
    const crimeIndex = Math.max(0, 100 - socialScore + (Math.random() * 40 - 20));
    const crimeTrend = (Math.random() * 2) - 1;

    points.push({
      id: `${city}-${i}`,
      // Added missing properties required by GeoPoint interface
      name: `${city} Point ${i}`,
      lod: 'DA',
      city,
      lat,
      lng,
      value: realEstatePrice,
      trend: realEstateTrend,
      metrics: {
        realEstate: realEstatePrice,
        crime: crimeIndex,
        social: socialScore
      },
      realEstatePrice,
      realEstateTrend,
      crimeIndex,
      crimeTrend,
      socialScore,
      socialTrend,
    });
  }
  return points;
};

export const generateCanadianData = (): GeoPoint[] => {
  return [
    ...generateCluster("Toronto", 43.6532, -79.3832, 150, 0.4),
    ...generateCluster("Vancouver", 49.2827, -123.1207, 100, 0.3),
    ...generateCluster("Montreal", 45.5017, -73.5673, 120, 0.35),
    ...generateCluster("Calgary", 51.0447, -114.0719, 80, 0.25),
    ...generateCluster("Ottawa", 45.4215, -75.6972, 60, 0.2),
    ...generateCluster("Halifax", 44.6488, -63.5752, 40, 0.15),
    ...generateCluster("Winnipeg", 49.8951, -97.1384, 50, 0.2),
  ];
};