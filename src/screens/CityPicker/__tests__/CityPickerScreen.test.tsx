import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { SymbolView } from 'expo-symbols';
import { AccessibilityInfo, ScrollView } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { ReactTestInstance } from 'react-test-renderer';

import {
  autocomplete,
  resolve,
  type Completion,
  type PlaceKind,
  type ResolvedCity,
} from '@diorama/native';

import { CURATED_CITIES, CURATED_PARKS, CURATED_PLACES } from '@/features/cities/curated';
import {
  getHiddenFeatured,
  hideFeatured,
  restoreFeatured,
} from '@/features/cities/hiddenFeaturedStore';
import {
  addRecent,
  clearRecents,
  getRecents,
  type RecentCity,
} from '@/features/cities/recentsStore';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';

// The Swift search functions; everything else in the module stays real.
jest.mock('@diorama/native', () => ({
  ...jest.requireActual('@diorama/native'),
  autocomplete: jest.fn(),
  resolve: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockAutocomplete = jest.mocked(autocomplete);
const mockResolve = jest.mocked(resolve);
const mockSelectionHaptic = jest.mocked(Haptics.selectionAsync);
const mockImpactHaptic = jest.mocked(Haptics.impactAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

const HOBOKEN: RecentCity = {
  id: 'hoboken_40.744_-74.032',
  name: 'Hoboken',
  country: 'United States',
  lat: 40.743991,
  lon: -74.032363,
  altitude: 800,
};

/** Hoboken as `resolve()` returns it: the recents fields plus its kind. */
const HOBOKEN_RESOLVED: ResolvedCity = { ...HOBOKEN, kind: 'city' };

/** A street address as it's kept in Recent. */
const INFINITE_LOOP: RecentCity = {
  id: '1-infinite-loop_37.332_-122.030',
  name: '1 Infinite Loop',
  country: 'Cupertino, United States',
  lat: 37.331656,
  lon: -122.030143,
  altitude: 700,
};

function completion(
  title: string,
  subtitle: string,
  matched = 0,
  kind: PlaceKind = 'city',
): Completion {
  return {
    id: `${title}\u001f${subtitle}`,
    title,
    subtitle,
    titleHighlights: matched > 0 ? [{ start: 0, length: matched }] : [],
    kind,
  };
}

function sectionHeaders(): string[] {
  return screen.getAllByRole('header').map((header) => header.props.children);
}

const RESULT_SYMBOLS: readonly string[] = [
  'mappin.and.ellipse',
  'mappin.circle.fill',
  'building.2.fill',
];

/** The leading glyph of each result row, top to bottom. */
function resultSymbols(): string[] {
  return screen
    .UNSAFE_getAllByType(SymbolView)
    .map((symbol) => String(symbol.props.name))
    .filter((name) => RESULT_SYMBOLS.includes(name));
}

/** A promise the test settles by hand, to hold a native call "in flight". */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    settle = resolvePromise;
  });
  return { promise, settle };
}

function findHostNode(type: string): ReactTestInstance {
  return screen.UNSAFE_root.find((node) => node.type === type);
}

/** What UIKit reports as the user types in the header search field. */
function typeInSearchBar(text: string) {
  fireEvent(findHostNode('RNSSearchBar'), 'changeText', { nativeEvent: { text } });
}

/** What UIKit reports when the Settings bar button is tapped. */
function pressSettingsButton() {
  const header = findHostNode('RNSScreenStackHeaderConfig');
  const items: { accessibilityLabel?: string; buttonId: string; sfSymbolName?: string }[] =
    header.props.headerRightBarButtonItems;
  const gear = items.find((item) => item.accessibilityLabel === 'Settings');
  expect(gear?.sfSymbolName).toBe('gearshape');
  fireEvent(header, 'pressHeaderBarButtonItem', { nativeEvent: { buttonId: gear?.buttonId } });
}

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  restoreFeatured();
  mockAutocomplete.mockReset();
  mockResolve.mockReset();
  mockSelectionHaptic.mockClear();
  mockImpactHaptic.mockClear();
});

describe('city picker, nothing typed', () => {
  it('lists the featured cities, with no Recent section before any city is opened', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('Featured')).toBeOnTheScreen();
    expect(screen.getByText('Paris')).toBeOnTheScreen();
    expect(screen.getByText('Tokyo')).toBeOnTheScreen();
    expect(screen.queryByText('Recent')).toBeNull();
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it('lists recent cities above Featured, newest first', async () => {
    addRecent(HOBOKEN);
    addRecent({ ...HOBOKEN, id: 'rome', name: 'Rome', country: 'Italy' });
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByText('Featured');
    const headers = screen.getAllByRole('header').map((header) => header.props.children);
    expect(headers).toEqual(['Recent', 'Featured', 'National parks']);
    // Rome is in both sections; the Recent one comes first.
    expect(screen.getAllByText('Rome')).toHaveLength(2);
    expect(screen.getByText('Hoboken')).toBeOnTheScreen();
  });

  it('opens a featured city with a tick, and it becomes the newest recent', async () => {
    addRecent(HOBOKEN);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Paris'));

    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(router.getPathname()).toBe('/city/paris');
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(getRecents().map((city) => city.id)).toEqual(['paris', HOBOKEN.id]);
  });

  it('reopens a recent city', async () => {
    addRecent(HOBOKEN);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Hoboken'));

    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(router.getPathname()).toBe(`/city/${HOBOKEN.id}`);
  });

  it('lists the national parks below Featured, and Featured keeps cities only', async () => {
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByText('Featured');
    expect(sectionHeaders()).toEqual(['Featured', 'National parks']);
    expect(screen.getByText('Grand Canyon')).toBeOnTheScreen();
    expect(screen.getByText('Arizona, United States')).toBeOnTheScreen();
    expect(screen.getByText('Yellowstone')).toBeOnTheScreen();
    expect(screen.getByText('Landscapes with 3D terrain in Apple Maps.')).toBeOnTheScreen();
    // One row per place: cities in Featured, then the parks, nothing twice.
    const titles = screen
      .getAllByTestId('swipe-row')
      .map((row) => within(row).getAllByText(/./)[0]?.props.children as string);
    expect(titles).toEqual(CURATED_PLACES.map((place) => place.name));
  });

  it('opens a park with a tick, and it becomes the newest recent', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Grand Canyon'));

    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(router.getPathname()).toBe('/city/grand-canyon');
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(getRecents().map((city) => city.id)).toEqual(['grand-canyon']);
  });

  it('opens Settings from the gear in the header', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    act(() => pressSettingsButton());

    expect(router.getPathname()).toBe('/settings');
    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();
  });
});

describe('city picker, searching', () => {
  it('shows Apple Maps results as you type, with the matched letters in bold', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Paris', 'France', 3),
      completion('Paris', 'TX, United States', 3),
    ]);
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    typeInSearchBar('Par');

    expect(await screen.findByText('France')).toBeOnTheScreen();
    expect(screen.getByText('TX, United States')).toBeOnTheScreen();
    expect(screen.queryByText('Featured')).toBeNull();
    expect(mockAutocomplete).toHaveBeenLastCalledWith('Par', expect.anything());
    expect(router.getSearchParams()).toEqual({ q: 'Par' });

    const [firstMatch] = screen.getAllByText('Par');
    expect(firstMatch).toHaveStyle({ fontWeight: '600' });
    expect(screen.getAllByText('Paris')).toHaveLength(2);
  });

  it('keeps Featured for a single letter', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    typeInSearchBar('P');

    expect(screen.getByText('Featured')).toBeOnTheScreen();
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it('brings Recent and Featured back when the search is cleared', async () => {
    mockAutocomplete.mockResolvedValue([completion('Paris', 'France', 3)]);
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');
    typeInSearchBar('Par');
    await screen.findByText('France');

    // Cancel (or the clear button) reports empty text.
    typeInSearchBar('');

    expect(await screen.findByText('Featured')).toBeOnTheScreen();
    expect(router.getSearchParams().q).toBeUndefined();
  });

  it('opens already searching from a link with ?q=', async () => {
    mockAutocomplete.mockResolvedValue([completion('Paris', 'France', 3)]);
    renderRouter(routes, { initialUrl: '/?q=par' });

    expect(await screen.findByText('France')).toBeOnTheScreen();
    expect(mockAutocomplete).toHaveBeenCalledWith('par', expect.anything());
  });

  it('shows skeleton rows until the first results arrive', async () => {
    const pending = deferred<Completion[]>();
    mockAutocomplete.mockReturnValue(pending.promise);
    renderRouter(routes, { initialUrl: '/?q=par' });

    expect(await screen.findAllByLabelText('Loading')).toHaveLength(3);

    await act(async () => pending.settle([completion('Paris', 'France', 3)]));
    expect(await screen.findByText('France')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Loading')).toBeNull();
  });

  it('says so quietly when nothing matches', async () => {
    mockAutocomplete.mockResolvedValue([]);
    renderRouter(routes, { initialUrl: '/?q=zzqx' });

    expect(await screen.findByText('No results')).toBeOnTheScreen();
    expect(screen.getByText('Check the spelling or try a new search.')).toBeOnTheScreen();
  });

  it('says so quietly when search fails', async () => {
    mockAutocomplete.mockRejectedValue(new Error('The Internet connection appears to be offline.'));
    renderRouter(routes, { initialUrl: '/?q=par' });

    expect(await screen.findByText("Can't search right now")).toBeOnTheScreen();
    expect(screen.queryByText(/offline/)).toBeNull();
  });
});

describe('city picker, opening a search result', () => {
  const HOBOKEN_RESULT = completion('Hoboken', 'NJ, United States', 3);

  it('resolves it, adds it to Recent, then shows the preview', async () => {
    mockAutocomplete.mockResolvedValue([HOBOKEN_RESULT]);
    mockResolve.mockResolvedValue(HOBOKEN_RESOLVED);
    const router = renderRouter(routes, { initialUrl: '/?q=hob' });

    fireEvent.press(await screen.findByText('NJ, United States'));

    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(mockResolve).toHaveBeenCalledWith(HOBOKEN_RESULT.id);
    expect(router.getPathname()).toBe(`/city/${HOBOKEN.id}`);
    expect(getRecents()).toEqual([HOBOKEN]);
  });

  it('opens the featured city when the result is one', async () => {
    const paris = completion('Paris', 'France', 3);
    mockAutocomplete.mockResolvedValue([paris]);
    mockResolve.mockResolvedValue({
      id: 'paris_48.857_2.352',
      name: 'Paris',
      country: 'France',
      lat: 48.8566,
      lon: 2.3522,
      altitude: 1500,
      kind: 'city',
    });
    const router = renderRouter(routes, { initialUrl: '/?q=par' });

    fireEvent.press(await screen.findByText('France'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/city/paris');
    expect(getRecents().map((city) => city.id)).toEqual(['paris']);
  });

  it('opens the national park when the result is one', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Grand Canyon National Park', 'AZ 86046', 12, 'place'),
    ]);
    mockResolve.mockResolvedValue({
      id: 'grand-canyon-national-park_36.237_-112.191',
      name: 'Grand Canyon National Park',
      country: 'Grand Canyon Village, United States',
      lat: 36.236859,
      lon: -112.191467,
      altitude: 900,
      kind: 'place',
    });
    const router = renderRouter(routes, { initialUrl: '/?q=grand%20canyon' });

    fireEvent.press(await screen.findByText('AZ 86046'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/city/grand-canyon');
    expect(getRecents().map((city) => city.id)).toEqual(['grand-canyon']);
  });

  it('opens the national park for the canyon itself too', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Grand Canyon', 'Arizona, United States', 12, 'address'),
    ]);
    mockResolve.mockResolvedValue({
      id: 'grand-canyon_36.219_-113.161',
      name: 'Grand Canyon',
      country: 'United States',
      lat: 36.219038,
      lon: -113.16096,
      altitude: 3000,
      kind: 'address',
    });
    const router = renderRouter(routes, { initialUrl: '/?q=grand%20canyon' });

    fireEvent.press(await screen.findByText('Arizona, United States'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/city/grand-canyon');
  });

  it('ignores more taps while one is resolving', async () => {
    const pending = deferred<ResolvedCity>();
    mockAutocomplete.mockResolvedValue([HOBOKEN_RESULT]);
    mockResolve.mockReturnValue(pending.promise);
    const router = renderRouter(routes, { initialUrl: '/?q=hob' });

    const row = await screen.findByText('NJ, United States');
    fireEvent.press(row);
    await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(1));
    fireEvent.press(row);
    fireEvent.press(await screen.findByText('Hoboken'));

    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);

    await act(async () => pending.settle(HOBOKEN_RESOLVED));
    expect(router.getPathname()).toBe(`/city/${HOBOKEN.id}`);
  });

  it('stays put and says so quietly when it fails to open', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    mockAutocomplete.mockResolvedValue([HOBOKEN_RESULT]);
    mockResolve.mockRejectedValue(new Error('MKErrorDomain error 4'));
    const router = renderRouter(routes, { initialUrl: '/?q=hob' });

    fireEvent.press(await screen.findByText('NJ, United States'));

    expect(await screen.findByText("Couldn't open Hoboken. Try again.")).toBeOnTheScreen();
    // VoiceOver is on the row, far from the footer, so it hears it too.
    expect(announce).toHaveBeenCalledWith("Couldn't open Hoboken. Try again.");
    expect(router.getPathname()).toBe('/');
    expect(getRecents()).toEqual([]);
    announce.mockRestore();
  });

  it('does not open the preview if you left while it resolved', async () => {
    const pending = deferred<ResolvedCity>();
    mockAutocomplete.mockResolvedValue([HOBOKEN_RESULT]);
    mockResolve.mockReturnValue(pending.promise);
    const router = renderRouter(routes, { initialUrl: '/?q=hob' });

    fireEvent.press(await screen.findByText('NJ, United States'));
    act(() => pressSettingsButton());
    await act(async () => pending.settle(HOBOKEN_RESOLVED));

    expect(router.getPathname()).toBe('/settings');
    expect(getRecents()).toEqual([]);
  });
});

describe('city picker, cities and places', () => {
  it('lists cities and places in their own sections, each kind with its own icon', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Paris', 'France', 3),
      completion('Park St', 'Revere, MA, United States', 3, 'address'),
      completion('The Paramount', '44 Charles St, Boston, MA  02114, United States', 0, 'place'),
      completion('Parma', 'Italy', 3),
    ]);
    renderRouter(routes, { initialUrl: '/?q=par' });

    expect(await screen.findByText('Italy')).toBeOnTheScreen();
    expect(sectionHeaders()).toEqual(['Cities', 'Places']);
    // Parma joins Paris among the cities; the address, then the place, follow.
    expect(resultSymbols()).toEqual([
      'mappin.and.ellipse',
      'mappin.and.ellipse',
      'mappin.circle.fill',
      'building.2.fill',
    ]);
    const [firstMatch] = screen.getAllByText('Par');
    expect(firstMatch).toHaveStyle({ fontWeight: '600' });
  });

  it('still leads with Paris under Cities when Apple ranks a nearby station first', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Park Street Station', 'Boston, MA, United States', 3, 'address'),
      completion('Paris', 'France', 3),
    ]);
    renderRouter(routes, { initialUrl: '/?q=par' });

    expect(await screen.findByText('France')).toBeOnTheScreen();
    expect(sectionHeaders()).toEqual(['Cities', 'Places']);
    expect(resultSymbols()[0]).toBe('mappin.and.ellipse');
  });

  it('leads with Places when a landmark matches as well and Apple ranks it first', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Eiffel Tower', '5 Avenue Anatole France, 75007 Paris, France', 12, 'place'),
      completion('Eiffel Tower', 'Varachha, Surat, Gujarat, India', 12),
    ]);
    renderRouter(routes, { initialUrl: '/?q=eiffel%20tower' });

    expect(await screen.findByText('Varachha, Surat, Gujarat, India')).toBeOnTheScreen();
    expect(sectionHeaders()).toEqual(['Places', 'Cities']);
  });

  it('shows only Places for a street address', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('1 Infinite Loop', 'Cupertino, CA, United States', 15, 'address'),
    ]);
    renderRouter(routes, { initialUrl: '/?q=1%20infinite%20loop' });

    expect(await screen.findByText('Cupertino, CA, United States')).toBeOnTheScreen();
    expect(sectionHeaders()).toEqual(['Places']);
    expect(resultSymbols()).toEqual(['mappin.circle.fill']);
  });

  it('says which place failed to open, under Places', async () => {
    mockAutocomplete.mockResolvedValue([
      completion('Paris', 'France', 3),
      completion('The Paramount', '44 Charles St, Boston, MA  02114, United States', 0, 'place'),
    ]);
    mockResolve.mockRejectedValue(new Error('MKErrorDomain error 4'));
    renderRouter(routes, { initialUrl: '/?q=par' });

    fireEvent.press(await screen.findByText('The Paramount'));

    expect(await screen.findByText("Couldn't open The Paramount. Try again.")).toBeOnTheScreen();
  });
});

describe('city picker, opening an address or a place', () => {
  const INFINITE_LOOP_RESULT = completion(
    '1 Infinite Loop',
    'Cupertino, CA, United States',
    15,
    'address',
  );

  it('resolves an address, adds it to Recent, then shows its preview', async () => {
    mockAutocomplete.mockResolvedValue([INFINITE_LOOP_RESULT]);
    mockResolve.mockResolvedValue({ ...INFINITE_LOOP, kind: 'address' });
    const router = renderRouter(routes, { initialUrl: '/?q=1%20infinite%20loop' });

    fireEvent.press(await screen.findByText('Cupertino, CA, United States'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(mockResolve).toHaveBeenCalledWith(INFINITE_LOOP_RESULT.id);
    expect(router.getPathname()).toBe(`/city/${INFINITE_LOOP.id}`);
    // Kept like any city (the kind isn't stored), with its close camera.
    expect(getRecents()).toEqual([INFINITE_LOOP]);
  });

  it('reopens an address from Recent with nothing cached and no search', async () => {
    addRecent(INFINITE_LOOP);
    const router = renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('Cupertino, United States')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('1 Infinite Loop'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/city/${INFINITE_LOOP.id}`);
    expect(screen.queryByText('City not found')).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('never swaps a place for the featured city it shares a name with', async () => {
    const bistro: ResolvedCity = {
      id: 'paris_48.858_2.294',
      name: 'Paris',
      country: 'Paris, France',
      lat: 48.8583,
      lon: 2.2945,
      altitude: 900,
      kind: 'place',
    };
    mockAutocomplete.mockResolvedValue([
      completion('Paris', '5 Avenue Anatole France, 75007 Paris, France', 5, 'place'),
    ]);
    mockResolve.mockResolvedValue(bistro);
    const router = renderRouter(routes, { initialUrl: '/?q=paris' });

    fireEvent.press(await screen.findByText('5 Avenue Anatole France, 75007 Paris, France'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/city/${bistro.id}`);
    expect(getRecents().map((city) => city.id)).toEqual([bistro.id]);
  });
});

/** The swipe row holding `title` in a section ("Recent" rows come first). */
function swipeRow(title: string, which: 'first' | 'last' = 'first'): ReactTestInstance {
  const rows = screen
    .getAllByTestId('swipe-row')
    .filter((row) => within(row).queryByText(title) !== null);
  const row = which === 'first' ? rows[0] : rows.at(-1);
  if (!row) throw new Error(`No row for ${title}`);
  return row;
}

/** VoiceOver: the row's "Delete" action. */
function voiceOverDelete(row: ReactTestInstance) {
  fireEvent(within(row).getByRole('button'), 'accessibilityAction', {
    nativeEvent: { actionName: 'delete' },
  });
}

/** A tap on the red Delete action a swipe uncovers (VoiceOver doesn't see it). */
function pressDelete(row: ReactTestInstance) {
  fireEvent.press(within(row).getByTestId('swipe-delete-action', { includeHiddenElements: true }));
}

describe('city picker, deleting', () => {
  beforeEach(() => {
    // The row slides out and closes up (a spring) before it's gone.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Lets the delete animation play out. */
  function finishAnimations() {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }

  function featuredTitles(): string[] {
    return screen
      .getAllByTestId('swipe-row')
      .map((row) => within(row).getAllByText(/./)[0]?.props.children as string)
      .slice(getRecents().length);
  }

  it('deletes a recent place from VoiceOver, from the list and the store', async () => {
    addRecent(HOBOKEN);
    addRecent(INFINITE_LOOP);
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Hoboken');

    voiceOverDelete(swipeRow('Hoboken'));
    expect(mockImpactHaptic).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    finishAnimations();

    expect(getRecents()).toEqual([INFINITE_LOOP]);
    expect(screen.queryByText('Hoboken')).toBeNull();
    expect(screen.getByText('1 Infinite Loop')).toBeOnTheScreen();
  });

  it('deletes a recent place with the red Delete action, and Recent goes when empty', async () => {
    addRecent(INFINITE_LOOP);
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('1 Infinite Loop');

    pressDelete(swipeRow('1 Infinite Loop'));
    finishAnimations();

    expect(getRecents()).toEqual([]);
    expect(screen.queryByText('1 Infinite Loop')).toBeNull();
    expect(sectionHeaders()).toEqual(['Featured', 'National parks']);
  });

  it('deleting a featured city hides it, and leaves Recent alone', async () => {
    addRecent({ ...HOBOKEN, id: 'paris', name: 'Paris', country: 'France' });
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');
    expect(screen.getAllByText('Paris')).toHaveLength(2);

    // The Featured Paris is the second one; Recent comes first.
    pressDelete(swipeRow('Paris', 'last'));
    finishAnimations();

    expect(getHiddenFeatured()).toEqual(['paris']);
    expect(getRecents().map((city) => city.id)).toEqual(['paris']);
    expect(screen.getAllByText('Paris')).toHaveLength(1);
    expect(featuredTitles()).not.toContain('Paris');
    expect(featuredTitles()).toContain('Tokyo');
  });

  it('leaves hidden featured cities out of the list from the start', async () => {
    hideFeatured('tokyo');
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    expect(screen.queryByText('Tokyo')).toBeNull();
    expect(screen.getByText('Paris')).toBeOnTheScreen();
  });

  it('drops the Featured header once every featured city is hidden', async () => {
    addRecent(HOBOKEN);
    for (const city of CURATED_CITIES) hideFeatured(city.id);
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Hoboken');

    expect(sectionHeaders()).toEqual(['Recent', 'National parks']);
    expect(screen.queryByText('Cities with 3D buildings in Apple Maps.')).toBeNull();
    expect(screen.queryByText('No places')).toBeNull();
  });

  it('deleting a park hides it, and Restore in Settings brings it back', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Grand Canyon');

    pressDelete(swipeRow('Grand Canyon'));
    finishAnimations();

    expect(getHiddenFeatured()).toEqual(['grand-canyon']);
    expect(screen.queryByText('Grand Canyon')).toBeNull();
    expect(screen.getByText('Yellowstone')).toBeOnTheScreen();

    act(() => pressSettingsButton());
    expect(router.getPathname()).toBe('/settings');
    fireEvent.press(await screen.findByRole('button', { name: 'Restore suggested places' }));

    expect(getHiddenFeatured()).toEqual([]);
    const picker = screen.getByTestId('city-picker-screen', { includeHiddenElements: true });
    expect(
      within(picker).queryByText('Grand Canyon', { includeHiddenElements: true }),
    ).not.toBeNull();
  });

  it('drops the National parks header once every park is hidden', async () => {
    for (const park of CURATED_PARKS) hideFeatured(park.id);
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    expect(sectionHeaders()).toEqual(['Featured']);
    expect(screen.queryByText('Landscapes with 3D terrain in Apple Maps.')).toBeNull();
    expect(screen.queryByText('No places')).toBeNull();
  });

  it('lists only the parks once every featured city is hidden', async () => {
    for (const city of CURATED_CITIES) hideFeatured(city.id);
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('National parks')).toBeOnTheScreen();
    expect(sectionHeaders()).toEqual(['National parks']);
    expect(screen.queryByText('No places')).toBeNull();
  });

  it('says what to do when there is nothing left to list', async () => {
    for (const place of CURATED_PLACES) hideFeatured(place.id);
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByText('No places')).toBeOnTheScreen();
    expect(screen.queryAllByRole('header')).toEqual([]);
  });
});

describe('city picker, a swiped-open row', () => {
  it('still opens a city with a tap', async () => {
    addRecent(HOBOKEN);
    const router = renderRouter(routes, { initialUrl: '/' });

    fireEvent.press(await screen.findByText('Hoboken'));

    expect(router.getPathname()).toBe(`/city/${HOBOKEN.id}`);
  });

  it('closes a swiped-open row on a tap elsewhere, and that tap opens nothing', async () => {
    addRecent(HOBOKEN);
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Hoboken');
    const [hobokenSwipe] = screen.UNSAFE_getAllByType(ReanimatedSwipeable);

    // Hoboken is swiped open; then a finger lands on Paris.
    act(() => hobokenSwipe.props.onSwipeableWillOpen(SwipeDirection.LEFT));
    const parisRow = swipeRow('Paris');
    fireEvent(parisRow, 'touchStart');
    fireEvent(screen.UNSAFE_getByType(ScrollView), 'touchStart');
    fireEvent.press(within(parisRow).getByText('Paris'));

    expect(router.getPathname()).toBe('/');
    expect(mockSelectionHaptic).not.toHaveBeenCalled();

    // Now nothing is open: the next tap opens Paris.
    fireEvent(parisRow, 'touchStart');
    fireEvent(screen.UNSAFE_getByType(ScrollView), 'touchStart');
    fireEvent.press(within(parisRow).getByText('Paris'));
    expect(router.getPathname()).toBe('/city/paris');
  });

  it('closes a swiped-open row when the list scrolls', async () => {
    addRecent(HOBOKEN);
    const router = renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Hoboken');
    const [hobokenSwipe] = screen.UNSAFE_getAllByType(ReanimatedSwipeable);

    act(() => hobokenSwipe.props.onSwipeableWillOpen(SwipeDirection.LEFT));
    fireEvent(screen.UNSAFE_getByType(ScrollView), 'scrollBeginDrag');

    // Nothing open, so a tap goes straight through.
    fireEvent.press(await screen.findByText('Paris'));
    expect(router.getPathname()).toBe('/city/paris');
  });

  it('still opens a hidden featured city from a link', async () => {
    hideFeatured('paris');
    const router = renderRouter(routes, { initialUrl: '/city/paris' });

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/city/paris');
  });
});
