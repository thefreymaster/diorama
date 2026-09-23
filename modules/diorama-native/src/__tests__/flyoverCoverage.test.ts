import { FLYOVER_AREAS, distanceKm, hasFlyover } from '../flyoverCoverage';

const MIDTOWN = { latitude: 40.7549, longitude: -73.984 };
const SALINA_KS = { latitude: 38.8403, longitude: -97.6114 };
const DUBAI = { latitude: 25.1972, longitude: 55.2744 };

describe('flyoverCoverage', () => {
  it('measures great-circle distance', () => {
    const lowerManhattan = { latitude: 40.7127, longitude: -74.0134 };
    expect(distanceKm(MIDTOWN, MIDTOWN)).toBe(0);
    expect(distanceKm(MIDTOWN, lowerManhattan)).toBeCloseTo(5.3, 0);
  });

  // All three were checked in the Simulator.
  it('knows Manhattan has 3D, and Salina and Dubai do not', () => {
    expect(hasFlyover(MIDTOWN)).toBe(true);
    expect(hasFlyover(SALINA_KS)).toBe(false);
    expect(hasFlyover(DUBAI)).toBe(false);
  });

  it('has valid, unique areas', () => {
    const names = FLYOVER_AREAS.map((area) => area.name);
    expect(new Set(names).size).toBe(names.length);
    for (const area of FLYOVER_AREAS) {
      expect(Math.abs(area.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(area.longitude)).toBeLessThanOrEqual(180);
      expect(area.radiusKm).toBeGreaterThan(0);
    }
  });
});
