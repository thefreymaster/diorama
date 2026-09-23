import type { Coordinate } from './DioramaMapView.types';

/** A place where Apple Maps shows photoreal 3D (Flyover) buildings. */
export type FlyoverArea = {
  name: string;
  latitude: number;
  longitude: number;
  /** How far from the center the 3D coverage reaches, in km. */
  radiusKm: number;
};

/**
 * MapKit has no "is 3D here?" API, and it accepts a pitched camera over
 * flat imagery too, so coverage comes from this curated list. Apple covers
 * ~350 cities and publishes no list, so this one is incomplete: a missing
 * city only means the app shows its "terrain only" note there. Every entry
 * below was checked in the Simulator (Sept 2026); check a new city with
 * diorama://dev/map?lat=…&lon=… before adding it. Checked and flat (no 3D):
 * Dubai, Mexico City.
 */
export const FLYOVER_AREAS: readonly FlyoverArea[] = [
  { name: 'New York', latitude: 40.7549, longitude: -73.984, radiusKm: 30 },
  { name: 'San Francisco', latitude: 37.7946, longitude: -122.3999, radiusKm: 25 },
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2551, radiusKm: 40 },
  { name: 'Chicago', latitude: 41.8826, longitude: -87.6233, radiusKm: 30 },
  { name: 'Boston', latitude: 42.3555, longitude: -71.0605, radiusKm: 20 },
  { name: 'Seattle', latitude: 47.6062, longitude: -122.3321, radiusKm: 20 },
  { name: 'Las Vegas', latitude: 36.1147, longitude: -115.1728, radiusKm: 20 },
  { name: 'Miami', latitude: 25.7743, longitude: -80.1937, radiusKm: 20 },
  { name: 'Washington', latitude: 38.8899, longitude: -77.0091, radiusKm: 20 },
  { name: 'Philadelphia', latitude: 39.9526, longitude: -75.1652, radiusKm: 20 },
  { name: 'Houston', latitude: 29.7604, longitude: -95.3698, radiusKm: 30 },
  { name: 'Dallas', latitude: 32.7767, longitude: -96.797, radiusKm: 30 },
  { name: 'Austin', latitude: 30.2672, longitude: -97.7431, radiusKm: 20 },
  { name: 'San Diego', latitude: 32.7157, longitude: -117.1611, radiusKm: 20 },
  { name: 'Phoenix', latitude: 33.4484, longitude: -112.074, radiusKm: 30 },
  { name: 'Denver', latitude: 39.7392, longitude: -104.9903, radiusKm: 20 },
  { name: 'Atlanta', latitude: 33.749, longitude: -84.388, radiusKm: 20 },
  { name: 'Portland', latitude: 45.5152, longitude: -122.6784, radiusKm: 20 },
  { name: 'Minneapolis', latitude: 44.9778, longitude: -93.265, radiusKm: 20 },
  { name: 'Detroit', latitude: 42.3314, longitude: -83.0458, radiusKm: 20 },
  { name: 'New Orleans', latitude: 29.9511, longitude: -90.0715, radiusKm: 20 },
  { name: 'Honolulu', latitude: 21.3069, longitude: -157.8583, radiusKm: 20 },
  { name: 'Salt Lake City', latitude: 40.7608, longitude: -111.891, radiusKm: 20 },
  { name: 'Nashville', latitude: 36.1627, longitude: -86.7816, radiusKm: 20 },
  { name: 'St. Louis', latitude: 38.627, longitude: -90.1994, radiusKm: 20 },
  { name: 'Pittsburgh', latitude: 40.4406, longitude: -79.9959, radiusKm: 20 },
  { name: 'Baltimore', latitude: 39.2904, longitude: -76.6122, radiusKm: 20 },
  { name: 'Orlando', latitude: 28.5383, longitude: -81.3792, radiusKm: 20 },
  { name: 'Toronto', latitude: 43.6532, longitude: -79.3832, radiusKm: 20 },
  { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207, radiusKm: 20 },
  { name: 'Montreal', latitude: 45.5017, longitude: -73.5673, radiusKm: 20 },
  { name: 'Calgary', latitude: 51.0447, longitude: -114.0719, radiusKm: 20 },
  { name: 'London', latitude: 51.508, longitude: -0.1281, radiusKm: 30 },
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522, radiusKm: 25 },
  { name: 'Rome', latitude: 41.8902, longitude: 12.4922, radiusKm: 20 },
  { name: 'Barcelona', latitude: 41.4036, longitude: 2.1744, radiusKm: 20 },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, radiusKm: 20 },
  { name: 'Berlin', latitude: 52.5163, longitude: 13.3777, radiusKm: 20 },
  { name: 'Munich', latitude: 48.1374, longitude: 11.5755, radiusKm: 20 },
  { name: 'Hamburg', latitude: 53.5511, longitude: 9.9937, radiusKm: 20 },
  { name: 'Amsterdam', latitude: 52.3731, longitude: 4.8926, radiusKm: 20 },
  { name: 'Vienna', latitude: 48.2082, longitude: 16.3738, radiusKm: 20 },
  { name: 'Prague', latitude: 50.0875, longitude: 14.4213, radiusKm: 20 },
  { name: 'Venice', latitude: 45.434, longitude: 12.3388, radiusKm: 10 },
  { name: 'Florence', latitude: 43.7731, longitude: 11.256, radiusKm: 10 },
  { name: 'Copenhagen', latitude: 55.6761, longitude: 12.5683, radiusKm: 20 },
  { name: 'Stockholm', latitude: 59.3293, longitude: 18.0686, radiusKm: 20 },
  { name: 'Dublin', latitude: 53.3498, longitude: -6.2603, radiusKm: 20 },
  { name: 'Lisbon', latitude: 38.7223, longitude: -9.1393, radiusKm: 20 },
  { name: 'Milan', latitude: 45.4642, longitude: 9.19, radiusKm: 20 },
  { name: 'Budapest', latitude: 47.4979, longitude: 19.0402, radiusKm: 20 },
  { name: 'Brussels', latitude: 50.8467, longitude: 4.3525, radiusKm: 20 },
  { name: 'Zurich', latitude: 47.3769, longitude: 8.5417, radiusKm: 20 },
  { name: 'Tokyo', latitude: 35.6812, longitude: 139.7671, radiusKm: 30 },
  { name: 'Osaka', latitude: 34.6937, longitude: 135.5023, radiusKm: 20 },
  { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681, radiusKm: 15 },
  { name: 'Sydney', latitude: -33.8568, longitude: 151.2153, radiusKm: 20 },
  { name: 'Melbourne', latitude: -37.8136, longitude: 144.9631, radiusKm: 20 },
  { name: 'Brisbane', latitude: -27.4698, longitude: 153.0251, radiusKm: 20 },
  { name: 'Perth', latitude: -31.9523, longitude: 115.8613, radiusKm: 20 },
  { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, radiusKm: 20 },
];

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in km (haversine). */
export function distanceKm(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when `point` falls inside a known photoreal 3D (Flyover) area. */
export function hasFlyover(point: Coordinate): boolean {
  return FLYOVER_AREAS.some((area) => distanceKm(point, area) <= area.radiusKm);
}
