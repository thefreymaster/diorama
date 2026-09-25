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
 * Which picker list a built-in place sits in: "Featured" (cities with 3D
 * buildings) or "National parks" (3D terrain only).
 */
export type CuratedCategory = 'city' | 'park';

/**
 * A built-in place: a featured city or a national park. It has the same
 * fields as a recent city, so screens can treat both alike (and pass one
 * straight to `addRecent`), plus a hand-tuned camera and a row icon.
 */
export type CuratedCity = RecentCity & {
  category: CuratedCategory;
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
 * Each is `category: 'city'`.
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
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
    // From Grant Park: Millennium Park and the Bean up front, the Michigan Avenue wall, then the Loop.
    id: 'chicago',
    category: 'city',
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
    // Up the Strip: Bellagio's lake on the left, Paris and Caesars, the north Strip behind.
    id: 'las-vegas',
    category: 'city',
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
    // From Back Bay: the Public Garden and the Common, the State House, downtown and the harbor.
    id: 'boston',
    category: 'city',
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
    category: 'city',
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
    category: 'city',
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
];

/**
 * National parks, in "National parks" order: US parks, then Mount Everest.
 * There are no 3D buildings here: the draw is MapKit's realistic-elevation
 * terrain, so every center must stay out of the checked areas in
 * flyoverCoverage.ts (coverage `unknown`, so the preview makes no claim
 * about buildings).
 *
 * - `country` is the line under the name: "State, United States", or the
 *   park and country abroad.
 * - MapKit stands every camera on the ground under the point it looks at,
 *   so a center in a deep canyon puts the camera below the rim at a low
 *   Camera height, and in first person the vantage point rides up and down
 *   with the ground under the aim point (OVERVIEW, Motion). So where the
 *   view allows, the center sits on the rim with the camera over ground
 *   about as high: the Grand Canyon's stays on the South Rim, which keeps
 *   that bob to ~2% of the camera's height over the plateau and under ~20%
 *   out over the canyon in stereo (from the canyon floor it would be 30–100%).
 *   Zion (from the floor) rises up to ~28%, and the summit views (Yosemite,
 *   Grand Teton) sink ~30–40% as you look off the summit. Everest's center
 *   sits just below the summit, so a head turn sinks ~16% (see its entry).
 * - Altitudes are larger than a city's (2.5–4.5 km) to take in a
 *   landscape, but MapKit tilts up less and less from farther out, and
 *   past ~55° it stops drawing the far distance (a gray grid). The higher
 *   the ground, the less it tilts: over Everest it draws no more than ~35°.
 */
export const CURATED_PARKS: readonly CuratedCity[] = [
  {
    // From above the South Rim at Mather Point, out over the buttes and temples to the North Rim.
    id: 'grand-canyon',
    category: 'park',
    name: 'Grand Canyon',
    country: 'Arizona, United States',
    lat: 36.061,
    lon: -112.1078,
    altitude: 3500,
    pitch: 52,
    heading: 5,
    symbol: 'binoculars.fill',
    tileColor: 'systemBrown',
  },
  {
    // The Grand Canyon of the Yellowstone: the Lower Falls and the yellow canyon walls.
    id: 'yellowstone',
    category: 'park',
    name: 'Yellowstone',
    country: 'Wyoming, United States',
    lat: 44.7185,
    lon: -110.493,
    altitude: 3000,
    pitch: 55,
    heading: 250,
    symbol: 'flame.fill',
    tileColor: 'systemRed',
  },
  {
    // Half Dome's sheer face from over the valley, Tenaya Canyon beside it.
    id: 'yosemite',
    category: 'park',
    name: 'Yosemite',
    country: 'California, United States',
    lat: 37.7459,
    lon: -119.5332,
    altitude: 4500,
    pitch: 55,
    heading: 120,
    symbol: 'tree.fill',
    tileColor: 'systemBlue',
  },
  {
    // Up Zion Canyon from the south: the Virgin River between the sandstone walls.
    id: 'zion',
    category: 'park',
    name: 'Zion',
    country: 'Utah, United States',
    lat: 37.2593,
    lon: -112.9509,
    altitude: 3000,
    pitch: 55,
    heading: 5,
    symbol: 'figure.hiking',
    tileColor: 'systemOrange',
  },
  {
    // The Grand Teton from over Jackson Hole: its east face, glaciers and neighboring peaks.
    id: 'grand-teton',
    category: 'park',
    name: 'Grand Teton',
    country: 'Wyoming, United States',
    lat: 43.7412,
    lon: -110.8024,
    altitude: 4500,
    pitch: 55,
    heading: 250,
    symbol: 'tent.fill',
    tileColor: 'systemIndigo',
  },
  {
    // The Fiery Furnace: a maze of red sandstone fins.
    id: 'arches',
    category: 'park',
    name: 'Arches',
    country: 'Utah, United States',
    lat: 38.7445,
    lon: -109.556,
    altitude: 2500,
    pitch: 55,
    heading: 60,
    symbol: 'sunset.fill',
    tileColor: 'systemPink',
  },
  {
    // From the rim above Sunset Point, down into the Bryce Amphitheater's hoodoos.
    id: 'bryce-canyon',
    category: 'park',
    name: 'Bryce Canyon',
    country: 'Utah, United States',
    lat: 37.625,
    lon: -112.16,
    altitude: 3000,
    pitch: 55,
    heading: 90,
    symbol: 'moon.stars.fill',
    tileColor: 'systemPurple',
  },
  {
    // Over the summit from the north: the top of the world up front, then the
    // rock bands and ice of the Lhotse face. The camera is ~11.8 km up, where
    // MapKit tilts no further than ~35°, so the pitch asks for no more. The
    // center is on the upper Southwest Face, ~700 m below the summit: a
    // ±60° head turn in the headset moves the vantage point -16% to +4% of
    // its height, and nodding down onto the summit +15% (centered on the
    // summit itself, it would sink ~35%).
    id: 'mount-everest',
    category: 'park',
    name: 'Mount Everest',
    country: 'Sagarmatha National Park, Nepal',
    lat: 27.9825,
    lon: 86.9225,
    altitude: 4500,
    pitch: 35,
    heading: 200,
    symbol: 'mountain.2.fill',
    tileColor: 'systemCyan',
  },
];

/** Every built-in place, cities first. Only for lookups; the picker lists each category on its own. */
export const CURATED_PLACES: readonly CuratedCity[] = [...CURATED_CITIES, ...CURATED_PARKS];

/** The built-in place (featured city or national park) with this id, or `undefined`. Works offline. */
export function getCuratedCity(id: string): CuratedCity | undefined {
  return CURATED_PLACES.find((city) => city.id === id);
}
