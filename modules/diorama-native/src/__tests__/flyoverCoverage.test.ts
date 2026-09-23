import {
  FLAT_AREAS,
  FLYOVER_AREAS,
  distanceKm,
  flyoverCoverageAt,
  hasFlyover,
} from '../flyoverCoverage';

const MIDTOWN = { latitude: 40.7549, longitude: -73.984 };
const SALINA_KS = { latitude: 38.8403, longitude: -97.6114 };
const DUBAI = { latitude: 25.1972, longitude: 55.2744 };
const MEXICO_CITY_ZOCALO = { latitude: 19.4326, longitude: -99.1332 };
const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
// The middle of the South Pacific, thousands of km from any listed area.
const POINT_NEMO = { latitude: -48.8767, longitude: -123.3933 };

describe('flyoverCoverage', () => {
  it('measures great-circle distance', () => {
    const lowerManhattan = { latitude: 40.7127, longitude: -74.0134 };
    expect(distanceKm(MIDTOWN, MIDTOWN)).toBe(0);
    expect(distanceKm(MIDTOWN, lowerManhattan)).toBeCloseTo(5.3, 0);
  });

  it('matches known city-to-city distances in either direction', () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };

    expect(distanceKm(london, paris)).toBeCloseTo(344, -1);
    expect(distanceKm(paris, london)).toBeCloseTo(distanceKm(london, paris), 9);
  });

  it('measures across the antimeridian the short way', () => {
    const west = { latitude: 0, longitude: 179.9 };
    const east = { latitude: 0, longitude: -179.9 };

    expect(distanceKm(west, east)).toBeCloseTo(22.2, 0);
  });

  // Rounding can push the haversine term past 1, which would make asin NaN.
  it('stays finite for opposite sides of the Earth', () => {
    const antipodes = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
    const poles = distanceKm({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 });

    expect(antipodes).toBeCloseTo(Math.PI * 6371, 0);
    expect(poles).toBeCloseTo(Math.PI * 6371, 0);
  });

  // Honolulu is thousands of km from any other area, so only its own edge counts.
  it('covers a point just inside an area, but not just outside it', () => {
    const honolulu = FLYOVER_AREAS.find((area) => area.name === 'Honolulu');
    if (!honolulu) throw new Error('This test needs an isolated area; pick another one');
    const kmPerDegreeOfLatitude = (Math.PI * 6371) / 180;
    const dueNorthBy = (km: number) => ({
      latitude: honolulu.latitude + km / kmPerDegreeOfLatitude,
      longitude: honolulu.longitude,
    });

    expect(hasFlyover(dueNorthBy(honolulu.radiusKm - 0.1))).toBe(true);
    expect(hasFlyover(dueNorthBy(honolulu.radiusKm + 0.1))).toBe(false);
  });

  // All three were checked in the Simulator.
  it('knows Manhattan has 3D, and Salina and Dubai do not', () => {
    expect(hasFlyover(MIDTOWN)).toBe(true);
    expect(hasFlyover(SALINA_KS)).toBe(false);
    expect(hasFlyover(DUBAI)).toBe(false);
  });

  it.each([
    ['3D', FLYOVER_AREAS],
    ['flat', FLAT_AREAS],
  ])('has valid, unique %s areas', (_kind, areas) => {
    const names = areas.map((area) => area.name);
    expect(new Set(names).size).toBe(names.length);
    for (const area of areas) {
      expect(Math.abs(area.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(area.longitude)).toBeLessThanOrEqual(180);
      expect(area.radiusKm).toBeGreaterThan(0);
    }
  });

  // Otherwise a point could be both, and the answer would depend on list order.
  it('keeps every flat area clear of every 3D area', () => {
    for (const flat of FLAT_AREAS) {
      for (const area of FLYOVER_AREAS) {
        expect(distanceKm(flat, area)).toBeGreaterThan(flat.radiusKm + area.radiusKm);
      }
    }
  });

  describe('flyoverCoverageAt', () => {
    it('says yes inside a checked 3D area', () => {
      expect(flyoverCoverageAt(MIDTOWN)).toBe('yes');
    });

    // Both were checked in the Simulator (T04) and are flat.
    it('says no inside a checked flat area', () => {
      expect(flyoverCoverageAt(DUBAI)).toBe('no');
      expect(flyoverCoverageAt(MEXICO_CITY_ZOCALO)).toBe('no');
    });

    // Not listed means nobody looked, not that Apple has no 3D there.
    it('says unknown anywhere nobody has checked', () => {
      expect(flyoverCoverageAt(SALINA_KS)).toBe('unknown');
      expect(flyoverCoverageAt(REYKJAVIK)).toBe('unknown');
      expect(flyoverCoverageAt(POINT_NEMO)).toBe('unknown');
    });

    it('agrees with the lists for every area center', () => {
      for (const area of FLYOVER_AREAS) expect(flyoverCoverageAt(area)).toBe('yes');
      for (const area of FLAT_AREAS) expect(flyoverCoverageAt(area)).toBe('no');
    });
  });
});
