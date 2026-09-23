import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { autocomplete, resolve, type Completion, type ResolvedCity } from '@diorama/native';

import {
  cityKeys,
  DEFAULT_CAMERA,
  SEARCH_DEBOUNCE_MS,
  useCity,
  useCitySearch,
  useResolveCity,
} from '../queries';
import { addRecent, clearRecents, getRecents, type RecentCity } from '../recentsStore';

// The Swift search functions; everything else in the module stays real.
jest.mock('@diorama/native', () => ({
  ...jest.requireActual('@diorama/native'),
  autocomplete: jest.fn(),
  resolve: jest.fn(),
}));

const mockAutocomplete = jest.mocked(autocomplete);
const mockResolve = jest.mocked(resolve);

function completion(title: string, subtitle: string): Completion {
  return { id: `${title}\u001f${subtitle}`, title, subtitle, titleHighlights: [] };
}

const PARIS = completion('Paris', 'France');
const PARIS_TX = completion('Paris', 'TX, United States');

const HOBOKEN: RecentCity = {
  id: 'hoboken_40.744_-74.032',
  name: 'Hoboken',
  country: 'United States',
  lat: 40.743991,
  lon: -74.032363,
  altitude: 800,
};

/** A promise the test settles by hand, to hold a search "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function createWrapper() {
  // No garbage-collection timers, so Jest can exit.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

beforeEach(() => {
  mockAutocomplete.mockReset();
  mockResolve.mockReset();
  clearRecents();
});

describe('useCity', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('finds a curated city offline, on the first render, without native calls', () => {
    onlineManager.setOnline(false);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCity('paris'), { wrapper });

    expect(result.current.data).toEqual({
      id: 'paris',
      name: 'Paris',
      country: 'France',
      lat: 48.8575,
      lon: 2.2957,
      altitude: 1000,
      pitch: 60,
      heading: 137,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockAutocomplete).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('falls back to recents, with the default camera', () => {
    onlineManager.setOnline(false);
    addRecent(HOBOKEN);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCity(HOBOKEN.id), { wrapper });

    expect(result.current.data).toEqual({ ...HOBOKEN, ...DEFAULT_CAMERA });
  });

  it('prefers the curated city when a recent has the same id', () => {
    addRecent({ ...HOBOKEN, id: 'paris', name: 'Not Paris' });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCity('paris'), { wrapper });

    expect(result.current.data?.name).toBe('Paris');
  });

  it('is null for an unknown id, and finds it once it is a recent', async () => {
    const { wrapper } = createWrapper();
    const first = renderHook(() => useCity(HOBOKEN.id), { wrapper });
    expect(first.result.current.data).toBeNull();
    await waitFor(() => expect(first.result.current.fetchStatus).toBe('idle'));
    first.unmount();

    addRecent(HOBOKEN);
    const second = renderHook(() => useCity(HOBOKEN.id), { wrapper });

    await waitFor(() => expect(second.result.current.data?.name).toBe('Hoboken'));
  });
});

describe('useResolveCity', () => {
  it('resolves a suggestion into a City that useCity can find', async () => {
    const resolved: ResolvedCity = { ...HOBOKEN };
    mockResolve.mockResolvedValue(resolved);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useResolveCity(), { wrapper });

    act(() => result.current.mutate('Hoboken\u001fNJ, United States'));

    await waitFor(() => expect(result.current.data).toEqual({ ...HOBOKEN, ...DEFAULT_CAMERA }));
    expect(mockResolve).toHaveBeenCalledWith('Hoboken\u001fNJ, United States');
    // Not in recents, but cached for the route it navigates to.
    const cached = renderHook(() => useCity(HOBOKEN.id), { wrapper });
    expect(cached.result.current.data).toEqual({ ...HOBOKEN, ...DEFAULT_CAMERA });
    expect(getRecents()).toEqual([]);
  });

  it('reports a failed resolve and caches nothing', async () => {
    mockResolve.mockRejectedValue(new Error('No place found'));
    const { client, wrapper } = createWrapper();
    const { result } = renderHook(() => useResolveCity(), { wrapper });

    act(() => result.current.mutate('Nowhere\u001f'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('No place found');
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryCache().findAll({ queryKey: cityKeys.all })).toEqual([]);
  });
});

describe('useCitySearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Reads the fields during render, as a screen does. TanStack Query only
   * re-renders for fields a component has read, so reading them afterwards
   * in an assertion can see a stale result.
   */
  function renderSearch(initialQuery: string) {
    const { wrapper } = createWrapper();
    return renderHook(
      ({ query }: { query: string }) => {
        const { data, error, isError, isPlaceholderData, fetchStatus } = useCitySearch(query);
        return { data, error, isError, isPlaceholderData, fetchStatus };
      },
      { wrapper, initialProps: { query: initialQuery } },
    );
  }

  async function wait(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('needs at least 2 characters (enabled: query.length > 1)', async () => {
    const search = renderSearch('');

    search.rerender({ query: 'P' });
    search.rerender({ query: ' P ' });
    await wait(1000);

    expect(mockAutocomplete).not.toHaveBeenCalled();
    expect(search.result.current.fetchStatus).toBe('idle');
    expect(search.result.current.data).toBeUndefined();
  });

  it('searches once, for the last text, after the debounce', async () => {
    mockAutocomplete.mockResolvedValue([PARIS]);
    const search = renderSearch('');

    search.rerender({ query: 'Pa' });
    await wait(SEARCH_DEBOUNCE_MS / 2);
    search.rerender({ query: 'Par' });
    await wait(SEARCH_DEBOUNCE_MS - 1);
    expect(mockAutocomplete).not.toHaveBeenCalled();

    await wait(1);
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete).toHaveBeenCalledWith('Par', { signal: expect.any(AbortSignal) });
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS]));
  });

  it('searches text that is already there without waiting', async () => {
    mockAutocomplete.mockResolvedValue([PARIS]);

    renderSearch('Par');
    await wait(0);

    expect(mockAutocomplete).toHaveBeenCalledWith('Par', expect.anything());
  });

  it('keeps the previous results while the next query loads', async () => {
    const pending = deferred<Completion[]>();
    mockAutocomplete.mockResolvedValueOnce([PARIS]).mockReturnValueOnce(pending.promise);
    const search = renderSearch('Par');
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS]));

    search.rerender({ query: 'Paris T' });
    await wait(SEARCH_DEBOUNCE_MS);

    expect(mockAutocomplete).toHaveBeenLastCalledWith('Paris T', expect.anything());
    expect(search.result.current.data).toEqual([PARIS]);
    expect(search.result.current.isPlaceholderData).toBe(true);

    await act(async () => pending.settle([PARIS_TX]));
    await wait(0);
    expect(search.result.current.data).toEqual([PARIS_TX]);
    expect(search.result.current.isPlaceholderData).toBe(false);
  });

  it('trims the text, and does not search again for a trailing space', async () => {
    mockAutocomplete.mockResolvedValue([PARIS]);
    const search = renderSearch('  Par ');
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS]));
    expect(mockAutocomplete).toHaveBeenCalledWith('Par', expect.anything());

    search.rerender({ query: 'Par  ' });
    await wait(SEARCH_DEBOUNCE_MS * 2);

    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
    expect(search.result.current.data).toEqual([PARIS]);
  });

  it('shows a failed search as an error, without retrying', async () => {
    mockAutocomplete.mockRejectedValue(new Error('City search failed'));
    const search = renderSearch('Par');

    await waitFor(() => expect(search.result.current.isError).toBe(true));
    expect(search.result.current.error?.message).toBe('City search failed');

    await wait(10_000);
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
  });

  it('recovers from a failed search on the next keystroke', async () => {
    mockAutocomplete.mockRejectedValueOnce(new Error('City search failed'));
    mockAutocomplete.mockResolvedValueOnce([PARIS]);
    const search = renderSearch('Par');
    await waitFor(() => expect(search.result.current.isError).toBe(true));

    search.rerender({ query: 'Pari' });
    await wait(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS]));
    expect(search.result.current.isError).toBe(false);
  });

  it('cancels a search the user typed past, and never shows its late answer', async () => {
    const slow = deferred<Completion[]>();
    mockAutocomplete.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([PARIS_TX]);
    const search = renderSearch('Par');
    await wait(0);
    const firstSignal = mockAutocomplete.mock.calls[0]?.[1]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    search.rerender({ query: 'Paris T' });
    await wait(SEARCH_DEBOUNCE_MS);
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS_TX]));
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => slow.settle([PARIS]));
    await wait(0);
    expect(search.result.current.data).toEqual([PARIS_TX]);
  });

  it('clears the results at once when the text gets too short', async () => {
    mockAutocomplete.mockResolvedValue([PARIS]);
    const search = renderSearch('Par');
    await waitFor(() => expect(search.result.current.data).toEqual([PARIS]));

    search.rerender({ query: 'P' });

    expect(search.result.current.data).toBeUndefined();
  });
});
