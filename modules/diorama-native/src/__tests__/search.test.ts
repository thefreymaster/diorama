import {
  PLACE_ALTITUDES,
  SUGGESTED_ALTITUDE_RANGE,
  autocomplete,
  completionKind,
  isSearchSuperseded,
  placeId,
  placeKind,
  placeSubtitle,
  resolve,
  suggestedAltitude,
  toCompletion,
  toResolvedCity,
  type Completion,
  type NativeCompletion,
  type NativePlace,
} from '../search';

const mockNative = {
  autocomplete: jest.fn<Promise<NativeCompletion[]>, [string]>(),
  resolve: jest.fn<Promise<NativePlace>, [string]>(),
};

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireNativeModule: () => mockNative,
}));

// What Swift sends for real suggestions and places (checked against Apple
// Maps on iOS 26).
const PARIS: NativePlace = {
  name: 'Paris',
  country: 'France',
  locality: 'Paris',
  latitude: 48.85661234567,
  longitude: 2.35222198765,
  latitudeDelta: 0.087,
  longitudeDelta: 0.246,
  category: '',
  isCity: true,
};

const INFINITE_LOOP: NativePlace = {
  name: '1 Infinite Loop',
  country: 'United States',
  locality: 'Cupertino',
  latitude: 37.331656,
  longitude: -122.0301426,
  latitudeDelta: 0.009,
  longitudeDelta: 0.0113,
  category: '',
  isCity: false,
};

const EIFFEL_TOWER: NativePlace = {
  name: 'Eiffel Tower',
  country: 'France',
  locality: 'Paris',
  latitude: 48.8582583,
  longitude: 2.2944877,
  latitudeDelta: 0.0057,
  longitudeDelta: 0.0087,
  category: 'MKPOICategoryLandmark',
  isCity: false,
};

const NATIVE_PARIS_COMPLETION: NativeCompletion = {
  id: 'Paris\u001fFrance',
  title: 'Paris',
  subtitle: 'France',
  titleHighlights: [{ start: 0, length: 3 }],
  isCity: true,
};

const PARIS_COMPLETION: Completion = {
  id: 'Paris\u001fFrance',
  title: 'Paris',
  subtitle: 'France',
  titleHighlights: [{ start: 0, length: 3 }],
  kind: 'city',
};

beforeEach(() => {
  mockNative.autocomplete.mockReset();
  mockNative.resolve.mockReset();
});

describe('placeId', () => {
  it('is a slug plus rounded coordinates', () => {
    expect(placeId('Paris', 48.8566, 2.3522)).toBe('paris_48.857_2.352');
    expect(placeId('New York', 40.7128, -74.006)).toBe('new-york_40.713_-74.006');
  });

  it('drops accents and punctuation, and stays URL-safe', () => {
    expect(placeId('São Paulo', -23.5489, -46.6388)).toBe('sao-paulo_-23.549_-46.639');
    expect(placeId('Zürich', 47.3769, 8.5417)).toBe('zurich_47.377_8.542');
    expect(placeId("  St. John's  ", 47.56, -52.71)).toBe('st-john-s_47.560_-52.710');
    for (const id of [placeId('東京', 35.68, 139.77), placeId('A'.repeat(99), 1, 2)]) {
      expect(id).toMatch(/^[a-z0-9._-]+$/);
    }
  });

  it('falls back to "place" for names with no Latin letters, and caps long names', () => {
    expect(placeId('東京', 35.6812, 139.7671)).toBe('place_35.681_139.767');
    expect(placeId('Street '.repeat(20), 0, 0).split('_')[0]!.length).toBeLessThanOrEqual(40);
  });

  it('gives the same id for the same place resolved twice', () => {
    expect(placeId('Paris', 48.85661, 2.35222)).toBe(placeId('Paris', 48.85664, 2.35219));
  });
});

describe('suggestedAltitude', () => {
  const { min, max } = SUGGESTED_ALTITUDE_RANGE;

  it('frames a mid-sized city between the limits', () => {
    // Paris is ~18 km east to west.
    const altitude = suggestedAltitude(PARIS);
    expect(altitude).toBeGreaterThan(min);
    expect(altitude).toBeLessThan(max);
    expect(altitude).toBeCloseTo(1500, -2);
  });

  it('clamps small places and big metros', () => {
    expect(suggestedAltitude({ latitude: 40, latitudeDelta: 0.002, longitudeDelta: 0.002 })).toBe(
      min,
    );
    // Greater London is ~50 km across: 3 km, not 6.
    expect(suggestedAltitude({ latitude: 51.5, latitudeDelta: 0.45, longitudeDelta: 0.7 })).toBe(
      max,
    );
  });

  it('uses the closest distance for bad input', () => {
    expect(suggestedAltitude({ latitude: 0, latitudeDelta: NaN, longitudeDelta: 1 })).toBe(min);
  });

  it('frames an address or a place a block or two away, whatever its box', () => {
    expect(suggestedAltitude(INFINITE_LOOP, 'address')).toBe(PLACE_ALTITUDES.address);
    expect(suggestedAltitude(EIFFEL_TOWER, 'place')).toBe(PLACE_ALTITUDES.place);
    // Mount Fuji's box is ~20 km: a city that big would get 1.5 km.
    const fuji = { latitude: 35.36, latitudeDelta: 0.19, longitudeDelta: 0.2 };
    expect(suggestedAltitude(fuji, 'place')).toBe(PLACE_ALTITUDES.place);
    for (const altitude of Object.values(PLACE_ALTITUDES)) {
      expect(altitude).toBeGreaterThanOrEqual(600);
      expect(altitude).toBeLessThanOrEqual(900);
    }
  });

  it('keeps the span rule for cities', () => {
    expect(suggestedAltitude(PARIS, 'city')).toBe(suggestedAltitude(PARIS));
  });
});

describe('completionKind', () => {
  it('trusts the city list', () => {
    expect(completionKind({ isCity: true, subtitle: 'France' })).toBe('city');
    // Some towns come with a postcode.
    expect(completionKind({ isCity: true, subtitle: '13730 Saint-Victoret, France' })).toBe('city');
  });

  it('tells a landmark or business (it has a street address) from a street', () => {
    expect(
      completionKind({ isCity: false, subtitle: '5 Avenue Anatole France, 75007 Paris, France' }),
    ).toBe('place');
    expect(
      completionKind({
        isCity: false,
        subtitle: '88 Ames St, Cambridge, MA  02142, United States',
      }),
    ).toBe('place');
    expect(completionKind({ isCity: false, subtitle: 'Cupertino, CA, United States' })).toBe(
      'address',
    );
  });

  it('adds the kind in place of the city flag', () => {
    expect(toCompletion(NATIVE_PARIS_COMPLETION)).toEqual(PARIS_COMPLETION);
    expect(
      toCompletion({
        id: '1 Infinite Loop\u001fCupertino, CA, United States',
        title: '1 Infinite Loop',
        subtitle: 'Cupertino, CA, United States',
        titleHighlights: [],
        isCity: false,
      }),
    ).toMatchObject({ kind: 'address' });
  });
});

describe('placeKind', () => {
  it('reads a point-of-interest category as a place', () => {
    expect(placeKind(EIFFEL_TOWER)).toBe('place');
    // Even when the suggestion looked like a street ("Golden Gate Bridge").
    expect(placeKind({ ...INFINITE_LOOP, category: 'MKPOICategoryLandmark' })).toBe('place');
  });

  it('trusts a city suggestion, neighborhoods included', () => {
    expect(placeKind(PARIS)).toBe('city');
    expect(
      placeKind({ name: 'Central Park', locality: 'New York', category: '', isCity: true }),
    ).toBe('city');
  });

  it('works out the rest from the address: its own name inside a town is an address', () => {
    expect(placeKind(INFINITE_LOOP)).toBe('address');
    // Resolved from text (no suggestion to go by), or on iOS 17.
    expect(placeKind({ ...PARIS, isCity: false })).toBe('city');
    expect(placeKind({ ...PARIS, isCity: false, locality: 'PARIS' })).toBe('city');
    expect(placeKind({ name: 'Tokyo', locality: '', category: '', isCity: false })).toBe('city');
  });
});

describe('placeSubtitle', () => {
  it('is the country for a city', () => {
    expect(placeSubtitle(PARIS, 'city')).toBe('France');
  });

  it('is the town and country for an address or a place', () => {
    expect(placeSubtitle(INFINITE_LOOP, 'address')).toBe('Cupertino, United States');
    expect(placeSubtitle(EIFFEL_TOWER, 'place')).toBe('Paris, France');
  });

  it('skips parts that are missing or repeat the name', () => {
    expect(placeSubtitle({ ...INFINITE_LOOP, locality: '' }, 'address')).toBe('United States');
    expect(
      placeSubtitle({ name: 'Monaco City', locality: 'Monaco', country: 'Monaco' }, 'place'),
    ).toBe('Monaco');
    expect(
      placeSubtitle(
        { name: 'Golden Gate Park', locality: 'Golden Gate Park', country: '' },
        'place',
      ),
    ).toBe('');
  });
});

describe('toResolvedCity', () => {
  it('has the recents fields, a URL id, a suggested altitude and the kind', () => {
    expect(toResolvedCity(PARIS)).toEqual({
      id: 'paris_48.857_2.352',
      name: 'Paris',
      country: 'France',
      lat: 48.856612,
      lon: 2.352222,
      altitude: suggestedAltitude(PARIS),
      kind: 'city',
    });
  });

  it('gives a street address the same shape, framed on its block', () => {
    expect(toResolvedCity(INFINITE_LOOP)).toEqual({
      id: '1-infinite-loop_37.332_-122.030',
      name: '1 Infinite Loop',
      country: 'Cupertino, United States',
      lat: 37.331656,
      lon: -122.030143,
      altitude: PLACE_ALTITUDES.address,
      kind: 'address',
    });
  });

  it('gives a landmark the same shape, with a URL-safe id', () => {
    const tower = toResolvedCity(EIFFEL_TOWER);
    expect(tower).toMatchObject({
      id: 'eiffel-tower_48.858_2.294',
      name: 'Eiffel Tower',
      country: 'Paris, France',
      altitude: PLACE_ALTITUDES.place,
      kind: 'place',
    });
    expect(tower.id).toMatch(/^[a-z0-9._-]+$/);
  });
});

describe('isSearchSuperseded', () => {
  it('recognizes the error an older query gets', () => {
    const superseded = Object.assign(new Error('A newer search replaced this one'), {
      code: 'ERR_SEARCH_SUPERSEDED',
    });
    expect(isSearchSuperseded(superseded)).toBe(true);
    expect(isSearchSuperseded(new Error('City search failed'))).toBe(false);
    expect(isSearchSuperseded('ERR_SEARCH_SUPERSEDED')).toBe(false);
  });
});

describe('native calls', () => {
  it('autocomplete passes the query to Swift and adds each kind', async () => {
    mockNative.autocomplete.mockResolvedValue([NATIVE_PARIS_COMPLETION]);

    await expect(autocomplete('Par')).resolves.toEqual([PARIS_COMPLETION]);
    expect(mockNative.autocomplete).toHaveBeenCalledWith('Par');
  });

  it('autocomplete rejects as soon as its signal aborts', async () => {
    mockNative.autocomplete.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();

    const request = autocomplete('Pa', { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toThrow('Search aborted');
  });

  it('autocomplete rejects at once for a signal that has already aborted', async () => {
    mockNative.autocomplete.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    controller.abort();

    await expect(autocomplete('Pa', { signal: controller.signal })).rejects.toThrow(
      'Search aborted',
    );
  });

  it('autocomplete passes Swift errors through when it has a signal', async () => {
    const superseded = Object.assign(new Error('A newer search replaced this one'), {
      code: 'ERR_SEARCH_SUPERSEDED',
    });
    mockNative.autocomplete.mockRejectedValue(superseded);

    const request = autocomplete('Pa', { signal: new AbortController().signal });

    await expect(request).rejects.toBe(superseded);
  });

  it('autocomplete keeps its answer when the signal aborts afterwards', async () => {
    mockNative.autocomplete.mockResolvedValue([NATIVE_PARIS_COMPLETION]);
    const controller = new AbortController();

    const request = autocomplete('Par', { signal: controller.signal });
    await expect(request).resolves.toEqual([PARIS_COMPLETION]);
    controller.abort();

    await expect(request).resolves.toEqual([PARIS_COMPLETION]);
  });

  it('resolve passes Swift errors through', async () => {
    mockNative.resolve.mockRejectedValue(new Error('No place found'));

    await expect(resolve('Nowhere\u001f')).rejects.toThrow('No place found');
  });

  it('autocomplete still answers when its signal never aborts', async () => {
    mockNative.autocomplete.mockResolvedValue([NATIVE_PARIS_COMPLETION]);

    const request = autocomplete('Par', { signal: new AbortController().signal });

    await expect(request).resolves.toEqual([PARIS_COMPLETION]);
  });

  it('resolve turns the Swift place into a city', async () => {
    mockNative.resolve.mockResolvedValue(PARIS);

    await expect(resolve(PARIS_COMPLETION.id)).resolves.toMatchObject({
      id: 'paris_48.857_2.352',
      name: 'Paris',
      country: 'France',
      kind: 'city',
    });
    expect(mockNative.resolve).toHaveBeenCalledWith(PARIS_COMPLETION.id);
  });

  it('resolve turns a Swift address into the same shape', async () => {
    mockNative.resolve.mockResolvedValue(INFINITE_LOOP);

    await expect(resolve('1 Infinite Loop\u001fCupertino, CA, United States')).resolves.toEqual(
      toResolvedCity(INFINITE_LOOP),
    );
  });
});
