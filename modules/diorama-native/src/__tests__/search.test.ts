import {
  SUGGESTED_ALTITUDE_RANGE,
  autocomplete,
  isSearchSuperseded,
  placeId,
  resolve,
  suggestedAltitude,
  toResolvedCity,
  type Completion,
  type NativePlace,
} from '../search';

const mockNative = {
  autocomplete: jest.fn<Promise<Completion[]>, [string]>(),
  resolve: jest.fn<Promise<NativePlace>, [string]>(),
};

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireNativeModule: () => mockNative,
}));

const PARIS: NativePlace = {
  name: 'Paris',
  country: 'France',
  latitude: 48.85661234567,
  longitude: 2.35222198765,
  latitudeDelta: 0.087,
  longitudeDelta: 0.246,
};

const PARIS_COMPLETION: Completion = {
  id: 'Paris\u001fFrance',
  title: 'Paris',
  subtitle: 'France',
  titleHighlights: [{ start: 0, length: 3 }],
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
});

describe('toResolvedCity', () => {
  it('has the recents fields, a URL id and a suggested altitude', () => {
    expect(toResolvedCity(PARIS)).toEqual({
      id: 'paris_48.857_2.352',
      name: 'Paris',
      country: 'France',
      lat: 48.856612,
      lon: 2.352222,
      altitude: suggestedAltitude(PARIS),
    });
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
  it('autocomplete passes the query to Swift', async () => {
    mockNative.autocomplete.mockResolvedValue([PARIS_COMPLETION]);

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

  it('autocomplete still answers when its signal never aborts', async () => {
    mockNative.autocomplete.mockResolvedValue([PARIS_COMPLETION]);

    const request = autocomplete('Par', { signal: new AbortController().signal });

    await expect(request).resolves.toEqual([PARIS_COMPLETION]);
  });

  it('resolve turns the Swift place into a city', async () => {
    mockNative.resolve.mockResolvedValue(PARIS);

    await expect(resolve(PARIS_COMPLETION.id)).resolves.toMatchObject({
      id: 'paris_48.857_2.352',
      name: 'Paris',
      country: 'France',
    });
    expect(mockNative.resolve).toHaveBeenCalledWith(PARIS_COMPLETION.id);
  });
});
