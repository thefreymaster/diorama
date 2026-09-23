import type { SFSymbol } from 'expo-symbols';

import type { ColorToken } from '@/theme';

import type { RecentCity } from './recentsStore';

/** Tile colors a city row may use: the standard iOS tints (white glyph on top). */
export type CityTileColor = Extract<
  ColorToken,
  | 'systemBlue'
  | 'systemBrown'
  | 'systemCyan'
  | 'systemGreen'
  | 'systemIndigo'
  | 'systemOrange'
  | 'systemPink'
  | 'systemPurple'
  | 'systemRed'
  | 'systemTeal'
>;

/**
 * A featured city. It has the same fields as a recent city, so screens can
 * treat both alike (and pass one straight to `addRecent`), plus a hand-tuned
 * camera and a row icon.
 */
export type CuratedCity = RecentCity & {
  /** Degrees tilted away from straight down. MapKit caps it by altitude. */
  pitch: number;
  /** Compass degrees the camera faces (0 = north), chosen to frame the landmarks. */
  heading: number;
  /** Row glyph. Must exist in SF Symbols 4.2 or earlier (iOS 16.4). */
  symbol: SFSymbol;
  /** Row tile color, for `<RowIcon tileColor>`. */
  tileColor: CityTileColor;
};

/**
 * Cities with Apple's photoreal 3D (Flyover) buildings, in "Featured" order.
 *
 * - `id` is the URL slug: `/city/new-york`.
 * - `lat`/`lon` sit on a landmark-dense spot, not the city hall. It's the
 *   point the camera looks at and the preview orbits around.
 * - `altitude` is the camera-to-center distance in meters (MapKit's
 *   `centerCoordinateDistance`), not the height above the ground.
 * - Every center must be inside a checked area in
 *   modules/diorama-native/src/flyoverCoverage.ts (a test enforces it).
 *   Dubai is not here: it's flat imagery only.
 *
 * Tune a camera with diorama://dev/map?lat=…&lon=…&altitude=…&pitch=…&heading=…
 */
export const CURATED_CITIES: readonly CuratedCity[] = [
  {
    // Midtown: Empire State in front, Times Square and Chrysler around, looking up the avenues.
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    lat: 40.7549,
    lon: -73.984,
    altitude: 1200,
    pitch: 60,
    heading: 29,
    symbol: 'building.2.fill',
    tileColor: 'systemBlue',
  },
  {
    // From the Trocadéro side: the Seine, the Eiffel Tower, then the Champ de Mars.
    id: 'paris',
    name: 'Paris',
    country: 'France',
    lat: 48.8575,
    lon: 2.2957,
    altitude: 1000,
    pitch: 60,
    heading: 137,
    symbol: 'sparkles',
    tileColor: 'systemPurple',
  },
  {
    // From the South Bank: the London Eye, the Thames, then Parliament and the Abbey.
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5005,
    lon: -0.1235,
    altitude: 1100,
    pitch: 60,
    heading: 250,
    symbol: 'crown.fill',
    tileColor: 'systemRed',
  },
  {
    // From Roppongi: Tokyo Tower and Shiba Park, with the bay behind.
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6582,
    lon: 139.747,
    altitude: 1200,
    pitch: 60,
    heading: 100,
    symbol: 'train.side.front.car',
    tileColor: 'systemPink',
  },
  {
    // From SoMa: Salesforce Tower, the Financial District, the Ferry Building and the bay.
    id: 'san-francisco',
    name: 'San Francisco',
    country: 'United States',
    lat: 37.7935,
    lon: -122.3985,
    altitude: 1300,
    pitch: 60,
    heading: 20,
    symbol: 'cablecar.fill',
    tileColor: 'systemOrange',
  },
  {
    // From the Celio hill: the Colosseum, then the Forum, with the Palatine on the left.
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    lat: 41.891,
    lon: 12.4895,
    altitude: 1000,
    pitch: 58,
    heading: 300,
    symbol: 'building.columns.fill',
    tileColor: 'systemBrown',
  },
  {
    // From Farm Cove: the Opera House up front, the Harbour Bridge behind it.
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    lat: -33.8565,
    lon: 151.214,
    altitude: 1300,
    pitch: 60,
    heading: 310,
    symbol: 'sailboat.fill',
    tileColor: 'systemCyan',
  },
  {
    // The Sagrada Família, looking down Carrer de Marina across the Eixample to the sea.
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    lat: 41.4036,
    lon: 2.1744,
    altitude: 1100,
    pitch: 58,
    heading: 135,
    symbol: 'soccerball',
    tileColor: 'systemIndigo',
  },
  {
    // From Grant Park: Millennium Park and the Bean up front, the Michigan Avenue wall, then the Loop.
    id: 'chicago',
    name: 'Chicago',
    country: 'United States',
    lat: 41.8812,
    lon: -87.625,
    altitude: 1700,
    pitch: 58,
    heading: 262,
    symbol: 'wind',
    tileColor: 'systemTeal',
  },
  {
    // From the lagoon: the Doge's Palace, the Campanile and St Mark's Basilica.
    id: 'venice',
    name: 'Venice',
    country: 'Italy',
    lat: 45.4338,
    lon: 12.3395,
    altitude: 900,
    pitch: 55,
    heading: 20,
    symbol: 'theatermasks.fill',
    tileColor: 'systemPurple',
  },
  {
    // Up the Strip: Bellagio's lake on the left, Paris and Caesars, the north Strip behind.
    id: 'las-vegas',
    name: 'Las Vegas',
    country: 'United States',
    lat: 36.1135,
    lon: -115.174,
    altitude: 1300,
    pitch: 60,
    heading: 5,
    symbol: 'dice.fill',
    tileColor: 'systemPink',
  },
  {
    // From Dam Square: the Royal Palace, then the canal rings and the Westerkerk.
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    lat: 52.374,
    lon: 4.8875,
    altitude: 900,
    pitch: 55,
    heading: 285,
    symbol: 'bicycle',
    tileColor: 'systemOrange',
  },
  {
    // Downtown, up Grand Avenue: Wilshire Grand and US Bank Tower, then Disney Hall and City Hall.
    id: 'los-angeles',
    name: 'Los Angeles',
    country: 'United States',
    lat: 34.0525,
    lon: -118.253,
    altitude: 1500,
    pitch: 62,
    heading: 40,
    symbol: 'film.fill',
    tileColor: 'systemIndigo',
  },
  {
    // From the Oltrarno: the Arno and Ponte Vecchio, the Uffizi, Palazzo Vecchio and the Duomo.
    id: 'florence',
    name: 'Florence',
    country: 'Italy',
    lat: 43.7705,
    lon: 11.2555,
    altitude: 900,
    pitch: 55,
    heading: 10,
    symbol: 'paintpalette.fill',
    tileColor: 'systemRed',
  },
  {
    // From Queen Anne: the Space Needle, then Belltown and the downtown towers.
    id: 'seattle',
    name: 'Seattle',
    country: 'United States',
    lat: 47.6185,
    lon: -122.3465,
    altitude: 1400,
    pitch: 60,
    heading: 145,
    symbol: 'cup.and.saucer.fill',
    tileColor: 'systemBrown',
  },
  {
    // From the Old Town: the Charles Bridge, the Vltava, Malá Strana and Prague Castle.
    id: 'prague',
    name: 'Prague',
    country: 'Czechia',
    lat: 50.0878,
    lon: 14.408,
    altitude: 1300,
    pitch: 58,
    heading: 295,
    symbol: 'clock.fill',
    tileColor: 'systemBlue',
  },
  {
    // From Back Bay: the Public Garden and the Common, the State House, downtown and the harbor.
    id: 'boston',
    name: 'Boston',
    country: 'United States',
    lat: 42.3565,
    lon: -71.061,
    altitude: 1200,
    pitch: 60,
    heading: 70,
    symbol: 'graduationcap.fill',
    tileColor: 'systemRed',
  },
  {
    // From the Tiergarten: the Brandenburg Gate and the Reichstag, Unter den Linden to the TV Tower.
    id: 'berlin',
    name: 'Berlin',
    country: 'Germany',
    lat: 52.5168,
    lon: 13.38,
    altitude: 1100,
    pitch: 60,
    heading: 80,
    symbol: 'music.note',
    tileColor: 'systemIndigo',
  },
  {
    // From False Creek: the downtown towers, Coal Harbour and the North Shore mountains.
    id: 'vancouver',
    name: 'Vancouver',
    country: 'Canada',
    lat: 49.287,
    lon: -123.12,
    altitude: 1400,
    pitch: 60,
    heading: 340,
    symbol: 'mountain.2.fill',
    tileColor: 'systemGreen',
  },
  {
    // From Biscayne Bay: Brickell Key, then the Brickell and downtown skyline.
    id: 'miami',
    name: 'Miami',
    country: 'United States',
    lat: 25.771,
    lon: -80.1905,
    altitude: 1400,
    pitch: 62,
    heading: 280,
    symbol: 'beach.umbrella.fill',
    tileColor: 'systemTeal',
  },
];

/** The featured city with this id, or `undefined`. Works offline. */
export function getCuratedCity(id: string): CuratedCity | undefined {
  return CURATED_CITIES.find((city) => city.id === id);
}
