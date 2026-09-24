import * as Location from 'expo-location';

import {
  GEOCODE_TIMEOUT_MS,
  LOCATE_TIMEOUT_MS,
  LocateError,
  isAccessDenied,
  locateMe,
  readLocationAccess,
} from '../locateMe';

// expo-location is mocked in jest.setup.ts; each test sets the answers it needs.
const mockServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockGetPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

function permission(status: Location.PermissionStatus): Location.LocationPermissionResponse {
  return {
    status,
    granted: status === Location.PermissionStatus.GRANTED,
    canAskAgain: status !== Location.PermissionStatus.DENIED,
    expires: 'never',
  };
}

function fix(latitude: number, longitude: number): Location.LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 20,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 0,
  };
}

const CITY_HALL: Location.LocationGeocodedAddress = {
  name: '1 City Hall Sq',
  streetNumber: '1',
  street: 'City Hall Sq',
  city: 'Boston',
  district: null,
  subregion: 'Suffolk County',
  region: 'MA',
  country: 'United States',
  postalCode: '02201',
  isoCountryCode: 'US',
  timezone: null,
  formattedAddress: null,
};

/** A promise that never settles: a fix or a lookup that never comes back. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected it to fail');
    },
    (error: unknown) => error,
  );
}

beforeEach(() => {
  jest.useRealTimers();
  mockServicesEnabled.mockReset().mockResolvedValue(true);
  mockGetPermission
    .mockReset()
    .mockResolvedValue(permission(Location.PermissionStatus.UNDETERMINED));
  mockRequestPermission
    .mockReset()
    .mockResolvedValue(permission(Location.PermissionStatus.GRANTED));
  mockPosition.mockReset().mockResolvedValue(fix(42.3601, -71.0589));
  mockReverseGeocode.mockReset().mockResolvedValue([CITY_HALL]);
});

describe('locateMe', () => {
  it('asks for access, takes one balanced fix, and names it', async () => {
    await expect(locateMe()).resolves.toEqual({
      id: '1-city-hall-sq_42.360_-71.059',
      name: '1 City Hall Sq',
      country: 'Boston, United States',
      lat: 42.3601,
      lon: -71.0589,
      altitude: 700,
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 42.3601, longitude: -71.0589 });
  });

  it('does not ask again once access is on', async () => {
    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.GRANTED));

    await expect(locateMe()).resolves.toMatchObject({ name: '1 City Hall Sq' });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('fails as denied when access was turned off before, without asking', async () => {
    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.DENIED));

    expect(isAccessDenied(await failure(locateMe()))).toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('waits as long as it takes for an answer to the prompt', async () => {
    jest.useFakeTimers();
    let answer: (response: Location.LocationPermissionResponse) => void = () => {};
    mockRequestPermission.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const result = locateMe();
    await jest.advanceTimersByTimeAsync(LOCATE_TIMEOUT_MS * 3);
    expect(mockPosition).not.toHaveBeenCalled();
    answer(permission(Location.PermissionStatus.GRANTED));

    await expect(result).resolves.toMatchObject({ name: '1 City Hall Sq' });
  });

  it('fails as unavailable when Core Location does not answer', async () => {
    jest.useFakeTimers();
    mockServicesEnabled.mockReturnValue(never());

    const result = failure(locateMe());
    await jest.advanceTimersByTimeAsync(LOCATE_TIMEOUT_MS);

    expect(await result).toMatchObject({ name: 'LocateError', reason: 'unavailable' });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('fails as denied when access is off, without looking', async () => {
    mockRequestPermission.mockResolvedValue(permission(Location.PermissionStatus.DENIED));

    const error = await failure(locateMe());

    expect(error).toBeInstanceOf(LocateError);
    expect(isAccessDenied(error)).toBe(true);
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('fails as unavailable with Location Services off, without asking', async () => {
    mockServicesEnabled.mockResolvedValue(false);

    const error = await failure(locateMe());

    expect(error).toMatchObject({ name: 'LocateError', reason: 'unavailable' });
    expect(isAccessDenied(error)).toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('fails as unavailable when Core Location finds nothing', async () => {
    mockPosition.mockRejectedValue(new Error('Cannot obtain current location'));

    expect(await failure(locateMe())).toMatchObject({ name: 'LocateError', reason: 'unavailable' });
  });

  it('gives up on a fix after the timeout', async () => {
    jest.useFakeTimers();
    mockPosition.mockReturnValue(never());

    const result = failure(locateMe());
    await jest.advanceTimersByTimeAsync(LOCATE_TIMEOUT_MS - 1);
    expect(mockReverseGeocode).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(await result).toMatchObject({ name: 'LocateError', reason: 'unavailable' });
  });

  it('still opens the spot as "Current location" when it can not be named', async () => {
    mockReverseGeocode.mockRejectedValue(new Error('Geocoding rate limit exceeded'));

    await expect(locateMe()).resolves.toMatchObject({
      id: 'current-location_42.360_-71.059',
      name: 'Current location',
      country: '',
    });
  });

  it('stops waiting for a name after the geocode timeout', async () => {
    jest.useFakeTimers();
    mockReverseGeocode.mockReturnValue(never());

    const result = locateMe();
    await jest.advanceTimersByTimeAsync(GEOCODE_TIMEOUT_MS);

    await expect(result).resolves.toMatchObject({ name: 'Current location' });
  });

  it('names nothing when Apple Maps returns no address', async () => {
    mockReverseGeocode.mockResolvedValue([]);

    await expect(locateMe()).resolves.toMatchObject({ name: 'Current location' });
  });
});

describe('readLocationAccess', () => {
  it('reads the access without asking', async () => {
    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.GRANTED));
    await expect(readLocationAccess()).resolves.toBe('granted');

    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.DENIED));
    await expect(readLocationAccess()).resolves.toBe('denied');

    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.UNDETERMINED));
    await expect(readLocationAccess()).resolves.toBe('undetermined');

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('says so when Location Services is off for the whole phone', async () => {
    mockServicesEnabled.mockResolvedValue(false);
    mockGetPermission.mockResolvedValue(permission(Location.PermissionStatus.DENIED));

    await expect(readLocationAccess()).resolves.toBe('servicesOff');
  });
});
