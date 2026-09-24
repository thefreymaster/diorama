import type { LocationGeocodedAddress } from 'expo-location';

import { PLACE_ALTITUDES } from '@diorama/native';

import { CURRENT_LOCATION_NAME, placeHere, type Fix } from '../placeHere';

const BOSTON_FIX: Fix = { latitude: 42.3601234, longitude: -71.05891234, accuracy: 35 };

function address(fields: Partial<LocationGeocodedAddress>): LocationGeocodedAddress {
  return {
    city: null,
    district: null,
    streetNumber: null,
    street: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...fields,
  };
}

const CITY_HALL = address({
  name: '1 City Hall Sq',
  streetNumber: '1',
  street: 'City Hall Sq',
  city: 'Boston',
  subregion: 'Suffolk County',
  region: 'MA',
  country: 'United States',
});

describe('placeHere', () => {
  it('names the spot after the place there, with "Town, Country" under it', () => {
    expect(placeHere(BOSTON_FIX, CITY_HALL)).toEqual({
      id: '1-city-hall-sq_42.360_-71.059',
      name: '1 City Hall Sq',
      country: 'Boston, United States',
      lat: 42.360123,
      lon: -71.058912,
      altitude: PLACE_ALTITUDES.address,
    });
  });

  it('falls back to the street when the place has no name', () => {
    const place = placeHere(BOSTON_FIX, { ...CITY_HALL, name: ' ' });
    expect(place.name).toBe('City Hall Sq');
    expect(place.id).toBe('city-hall-sq_42.360_-71.059');
  });

  it('is "Current location" when Apple Maps can not name it (offline)', () => {
    const place = placeHere(BOSTON_FIX);
    expect(place.name).toBe(CURRENT_LOCATION_NAME);
    expect(place.country).toBe('');
    expect(place.id).toBe('current-location_42.360_-71.059');
    expect(place.altitude).toBe(PLACE_ALTITUDES.address);
  });

  it('uses the county when there is no town', () => {
    const place = placeHere(BOSTON_FIX, { ...CITY_HALL, city: null });
    expect(place.country).toBe('Suffolk County, United States');
  });

  it('names an approximate fix after its town, not a street it may not be on', () => {
    const place = placeHere({ ...BOSTON_FIX, accuracy: 3000 }, CITY_HALL);
    expect(place.name).toBe('Boston');
    expect(place.country).toBe('United States');
  });

  it('keeps the street name when the accuracy is unknown', () => {
    expect(placeHere({ ...BOSTON_FIX, accuracy: null }, CITY_HALL).name).toBe('1 City Hall Sq');
  });
});
