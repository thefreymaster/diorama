import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { autocomplete, resolve, type Completion, type ResolvedCity } from '@diorama/native';

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
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

const mockAutocomplete = jest.mocked(autocomplete);
const mockResolve = jest.mocked(resolve);
const mockSelectionHaptic = jest.mocked(Haptics.selectionAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

const HOBOKEN: ResolvedCity & RecentCity = {
  id: 'hoboken_40.744_-74.032',
  name: 'Hoboken',
  country: 'United States',
  lat: 40.743991,
  lon: -74.032363,
  altitude: 800,
};

function completion(title: string, subtitle: string, matched = 0): Completion {
  return {
    id: `${title}\u001f${subtitle}`,
    title,
    subtitle,
    titleHighlights: matched > 0 ? [{ start: 0, length: matched }] : [],
  };
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
  mockAutocomplete.mockReset();
  mockResolve.mockReset();
  mockSelectionHaptic.mockClear();
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
    expect(headers).toEqual(['Recent', 'Featured']);
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
    mockResolve.mockResolvedValue(HOBOKEN);
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
    });
    const router = renderRouter(routes, { initialUrl: '/?q=par' });

    fireEvent.press(await screen.findByText('France'));

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/city/paris');
    expect(getRecents().map((city) => city.id)).toEqual(['paris']);
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

    await act(async () => pending.settle(HOBOKEN));
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
    await act(async () => pending.settle(HOBOKEN));

    expect(router.getPathname()).toBe('/settings');
    expect(getRecents()).toEqual([]);
  });
});
