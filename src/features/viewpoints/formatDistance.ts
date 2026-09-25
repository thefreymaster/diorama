/** Kilometers and meters, or miles and feet. */
export type DistanceUnits = 'metric' | 'imperial';

/** Regions that sign roads in miles, where Apple Maps shows miles. */
const MILE_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/** The region in a locale tag: "en-US" → "US", "zh-Hant-TW" → "TW", "fr" → undefined. */
function localeRegion(locale: string): string | undefined {
  for (const part of locale.split(/[-_]/).slice(1)) {
    // Extensions ("-u-ca-gregory") start with a single letter; no region past them.
    if (part.length === 1) return undefined;
    if (/^([a-z]{2}|\d{3})$/i.test(part)) return part.toUpperCase();
  }
  return undefined;
}

/** Miles where the locale's region uses them, else kilometers. */
export function distanceUnits(locale: string): DistanceUnits {
  const region = localeRegion(locale);
  return region !== undefined && MILE_REGIONS.has(region) ? 'imperial' : 'metric';
}

/** The locale the app formats in, e.g. "en-US". */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en-US';
  }
}

/** Rounds to the nearest `step`, never below one step (no "0 m"). */
function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * A distance the way Apple Maps writes it: "350 m", "2.4 km", "12 km", or
 * in miles "500 ft", "1.5 mi", "12 mi".
 */
export function formatDistance(meters: number, locale: string = deviceLocale()): string {
  const number = (value: number, fractionDigits: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: fractionDigits });

  if (distanceUnits(locale) === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    if (miles < 0.1) return `${number(roundTo(meters / METERS_PER_FOOT, 50), 0)} ft`;
    return `${number(miles, miles < 10 ? 1 : 0)} mi`;
  }
  const shortMeters = roundTo(meters, 10);
  if (shortMeters < 1000) return `${number(shortMeters, 0)} m`;
  const km = meters / 1000;
  return `${number(km, km < 10 ? 1 : 0)} km`;
}
