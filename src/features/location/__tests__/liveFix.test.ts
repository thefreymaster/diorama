import type { LocationObject } from 'expo-location';

import type { Coordinate } from '@diorama/native';

import {
  createFixThrottle,
  LIVE_MAX_ACCURACY_M,
  LIVE_MIN_INTERVAL_MS,
  usableFix,
} from '../liveFix';

function location(latitude: number, longitude: number, accuracy: number | null): LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 0,
  };
}

const CITY_HALL: Coordinate = { latitude: 42.3601, longitude: -71.0589 };
const COMMON: Coordinate = { latitude: 42.3555, longitude: -71.064 };

describe('usableFix', () => {
  it('keeps fixes within 50 m', () => {
    expect(LIVE_MAX_ACCURACY_M).toBe(50);
    expect(usableFix(location(42.3601, -71.0589, 5))).toEqual(CITY_HALL);
    expect(usableFix(location(42.3601, -71.0589, 50))).toEqual(CITY_HALL);
  });

  it('drops fixes worse than 50 m, and ones with no or an invalid accuracy', () => {
    expect(usableFix(location(42.3601, -71.0589, 50.1))).toBeNull();
    expect(usableFix(location(42.3601, -71.0589, 1414))).toBeNull();
    expect(usableFix(location(42.3601, -71.0589, null))).toBeNull();
    expect(usableFix(location(42.3601, -71.0589, -1))).toBeNull();
    expect(usableFix(location(42.3601, -71.0589, Number.NaN))).toBeNull();
  });

  it('drops a fix with no coordinates', () => {
    expect(usableFix(location(Number.NaN, -71.0589, 5))).toBeNull();
    expect(usableFix(location(42.3601, Number.POSITIVE_INFINITY, 5))).toBeNull();
  });
});

describe('createFixThrottle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends the first fix at once', () => {
    const send = jest.fn();
    createFixThrottle(send).push(CITY_HALL);
    expect(send).toHaveBeenCalledWith(CITY_HALL);
  });

  it('sends at most one fix a second, the latest one', () => {
    expect(LIVE_MIN_INTERVAL_MS).toBe(1000);
    const send = jest.fn();
    const throttle = createFixThrottle(send);
    throttle.push(CITY_HALL);
    jest.advanceTimersByTime(200);
    throttle.push({ latitude: 42.358, longitude: -71.061 });
    throttle.push(COMMON);
    expect(send).toHaveBeenCalledTimes(1);

    // The rest of the second, then only the newest fix goes.
    jest.advanceTimersByTime(799);
    expect(send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(COMMON);

    // Nothing new, nothing sent.
    jest.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends at once again after a quiet second', () => {
    const send = jest.fn();
    const throttle = createFixThrottle(send);
    throttle.push(CITY_HALL);
    jest.advanceTimersByTime(1500);
    throttle.push(COMMON);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('drops a waiting fix when cancelled', () => {
    const send = jest.fn();
    const throttle = createFixThrottle(send);
    throttle.push(CITY_HALL);
    throttle.push(COMMON);
    throttle.cancel();
    jest.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
