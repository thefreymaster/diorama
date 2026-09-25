import {
  altitudeForSpan,
  formatCoordinates,
  pickedPlace,
  PICKED_ALTITUDE_RANGE,
  spanForAltitude,
} from '../pickedPlace';
import { NEARBY_SPAN_M, startFromParams } from '../pickerStart';

describe('picked place', () => {
  it('puts the camera a twelfth of the map’s width out, within 600 m to 4.5 km', () => {
    expect(altitudeForSpan(12_000)).toBe(1000);
    expect(altitudeForSpan(2000)).toBe(PICKED_ALTITUDE_RANGE.min);
    expect(altitudeForSpan(500_000)).toBe(PICKED_ALTITUDE_RANGE.max);
    expect(altitudeForSpan(Number.NaN)).toBe(PICKED_ALTITUDE_RANGE.min);
    expect(spanForAltitude(altitudeForSpan(18_000))).toBe(18_000);
  });

  it('writes coordinates the way Apple Maps does', () => {
    expect(formatCoordinates({ latitude: 40.74844, longitude: -73.98566 })).toBe(
      '40.7484° N, 73.9857° W',
    );
    expect(formatCoordinates({ latitude: -33.8568, longitude: 151.2153 })).toBe(
      '33.8568° S, 151.2153° E',
    );
  });

  it('names a spot with no address by its coordinates, with no subtitle', () => {
    expect(pickedPlace({ latitude: 0.5, longitude: -30.25, spanMeters: 60_000 })).toEqual({
      id: '0-5000-n-30-2500-w_0.500_-30.250',
      name: '0.5000° N, 30.2500° W',
      country: '',
      lat: 0.5,
      lon: -30.25,
      altitude: 4500,
    });
  });
});

describe('picker start from a link', () => {
  it('reads lat, lon and span, clamping the span', () => {
    expect(startFromParams({ lat: '48.8584', lon: '2.2945', span: '2000' })).toEqual({
      center: { latitude: 48.8584, longitude: 2.2945 },
      span: 2000,
    });
    expect(startFromParams({ lat: '1', lon: '2', span: '5' })?.span).toBe(100);
    expect(startFromParams({ lat: '1', lon: '2' })?.span).toBe(NEARBY_SPAN_M);
    expect(startFromParams({ lat: '1', lon: '2', span: '-4' })?.span).toBe(NEARBY_SPAN_M);
  });

  it('ignores a link without a valid spot', () => {
    expect(startFromParams({})).toBeNull();
    expect(startFromParams({ lat: '48.8' })).toBeNull();
    expect(startFromParams({ lat: 'north', lon: '2' })).toBeNull();
    expect(startFromParams({ lat: '91', lon: '2' })).toBeNull();
    expect(startFromParams({ lat: '1', lon: '181' })).toBeNull();
    expect(startFromParams({ lat: '', lon: '' })).toBeNull();
  });
});
