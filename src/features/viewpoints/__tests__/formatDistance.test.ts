import { distanceUnits, formatDistance } from '../formatDistance';

describe('distanceUnits', () => {
  it('uses miles where the roads do', () => {
    expect(distanceUnits('en-US')).toBe('imperial');
    expect(distanceUnits('es_US')).toBe('imperial');
    expect(distanceUnits('en-GB')).toBe('imperial');
    expect(distanceUnits('en-US-u-ca-gregory')).toBe('imperial');
  });

  it('uses kilometers everywhere else, and when the region is unknown', () => {
    expect(distanceUnits('en-CA')).toBe('metric');
    expect(distanceUnits('de-DE')).toBe('metric');
    expect(distanceUnits('zh-Hant-TW')).toBe('metric');
    expect(distanceUnits('fr')).toBe('metric');
    expect(distanceUnits('en-u-ca-gregory')).toBe('metric');
  });
});

describe('formatDistance', () => {
  it('writes meters close by, then kilometers with one decimal, then whole ones', () => {
    expect(formatDistance(0, 'de-DE')).toBe('10 m');
    expect(formatDistance(94, 'de-DE')).toBe('90 m');
    expect(formatDistance(996, 'de-DE')).toBe('1 km');
    expect(formatDistance(2240, 'de-DE')).toBe('2,2 km');
    expect(formatDistance(12_900, 'de-DE')).toBe('13 km');
    expect(formatDistance(2240, 'en-CA')).toBe('2.2 km');
  });

  it('writes feet close by, then miles with one decimal, then whole ones', () => {
    expect(formatDistance(94, 'en-US')).toBe('300 ft');
    expect(formatDistance(2240, 'en-US')).toBe('1.4 mi');
    expect(formatDistance(23_100, 'en-US')).toBe('14 mi');
  });
});
