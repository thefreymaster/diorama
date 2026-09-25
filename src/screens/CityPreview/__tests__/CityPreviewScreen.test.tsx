import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';

import { flyoverCoverageAt, type DioramaMapViewProps } from '@diorama/native';
import { addRecent, clearRecents, type RecentCity } from '@/features/cities/recentsStore';
import { resetSettings, setTwoEyeLandscape } from '@/features/settings/store';
import { queryClient } from '@/providers/queryClient';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import { TERRAIN_NOTE } from '../TerrainNote';

// The native map becomes a plain view that keeps its props, so tests can
// read them and play MapKit's part by calling `onReady`.
jest.mock('@diorama/native', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: (props: object) => createElement(View, { testID: 'diorama-map', ...props }),
  };
});

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockImpact = jest.mocked(Haptics.impactAsync);

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

// Searched cities (not featured), so they reach the preview via Recent.
// Reykjavík is in no checked list: nobody knows whether Apple has 3D there.
const REYKJAVIK: RecentCity = {
  id: 'reykjavik_64.146_-21.943',
  name: 'Reykjavík',
  country: 'Iceland',
  lat: 64.1466,
  lon: -21.9426,
  altitude: 1500,
};
// Dubai was checked in the Simulator and is flat: terrain, no 3D buildings.
const DUBAI: RecentCity = {
  id: 'dubai_25.197_55.274',
  name: 'Dubai',
  country: 'United Arab Emirates',
  lat: 25.1972,
  lon: 55.2744,
  altitude: 1500,
};

/** The map's props, even while another screen covers (and hides) the preview. */
function mapProps(): DioramaMapViewProps {
  const map: ReactTestInstance = screen.getByTestId('diorama-map', {
    includeHiddenElements: true,
  });
  return map.props as DioramaMapViewProps;
}

/**
 * What the map reports once MapKit has drawn the first full frame, with the
 * 3D coverage the real wrapper works out for the map's center.
 */
function finishRendering() {
  act(() => mapProps().onReady?.({ coverage: flyoverCoverageAt(mapProps().center), mode: 'mono' }));
}

/** The native stack's header settings for one screen (react-native-screens). */
const HEADER_CONFIG: string = 'RNSScreenStackHeaderConfig';

let reduceMotionListener: ((enabled: boolean) => void) | undefined;

const HEADSET_GUIDANCE = 'Turn your iPhone sideways and place it in your viewer.';

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  resetSettings();
  mockImpact.mockClear();
  reduceMotionListener = undefined;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  // Keep the Reduce Motion listener, so a test can flip the setting live.
  const addEventListener = (event: string, listener: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') reduceMotionListener = listener;
    return { remove: jest.fn() };
  };
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('city preview', () => {
  it('shows the city on the card over an orbiting map from its own camera', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Paris' })).toBeOnTheScreen();
    expect(screen.getByText('France')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enter Mini City' })).toBeOnTheScreen();
    expect(screen.getByText(HEADSET_GUIDANCE)).toBeOnTheScreen();

    expect(mapProps()).toMatchObject({
      center: { latitude: 48.8575, longitude: 2.2957 },
      altitude: 1000,
      pitch: 60,
      heading: 137,
      orbit: true,
    });
    expect(mapProps().mode ?? 'mono').toBe('mono');
    expect(mapProps().headTracking).toBeFalsy();
  });

  it('says the headset view is the sideways one, unless the two-eye view is off', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');
    expect(screen.getByText(HEADSET_GUIDANCE)).toBeOnTheScreen();
    expect(screen.queryByText('Place your iPhone in your viewer.')).toBeNull();

    // No headset view, so no word about one.
    act(() => setTwoEyeLandscape(false));
    expect(screen.queryByText(HEADSET_GUIDANCE)).toBeNull();
    expect(screen.getByRole('button', { name: 'Enter Mini City' })).toBeOnTheScreen();

    act(() => setTwoEyeLandscape(true));
    expect(screen.getByText(HEADSET_GUIDANCE)).toBeOnTheScreen();
  });

  it('names the screen after the city but keeps the see-through header clear', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    const header = screen.UNSAFE_root.findAll(
      (node) => node.type === HEADER_CONFIG && node.props.title === 'Paris',
    );
    expect(header).toHaveLength(1);
    expect(header[0].props.translucent).toBe(true);
  });

  it('shows the terrain note once the map has drawn a place known to be flat', async () => {
    addRecent(DUBAI);
    renderRouter(routes, { initialUrl: `/city/${DUBAI.id}` });

    expect(await screen.findByText('Dubai')).toBeOnTheScreen();
    expect(screen.getByText('United Arab Emirates')).toBeOnTheScreen();
    expect(screen.queryByText(TERRAIN_NOTE)).toBeNull();

    finishRendering();

    expect(screen.getByText(TERRAIN_NOTE)).toBeOnTheScreen();
  });

  // Apple may well have 3D there, so a "terrain only" note could be wrong.
  it('says nothing about 3D where nobody has checked', async () => {
    addRecent(REYKJAVIK);
    renderRouter(routes, { initialUrl: `/city/${REYKJAVIK.id}` });
    expect(await screen.findByText('Reykjavík')).toBeOnTheScreen();
    expect(screen.getByText('Iceland')).toBeOnTheScreen();

    finishRendering();

    expect(screen.queryByText(TERRAIN_NOTE)).toBeNull();
    expect(screen.queryByTestId('terrain-note')).toBeNull();
  });

  it('opens the terrain note to the full height of its text', async () => {
    // Reduce Motion opens it at once, so the height can be read straight away.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    addRecent(DUBAI);
    renderRouter(routes, { initialUrl: `/city/${DUBAI.id}` });
    await screen.findByText('Dubai');
    await act(async () => {});

    finishRendering();
    const text = screen.getByTestId('terrain-note-text');
    // Measured on its own: the closed note (0 tall) must not squash the text.
    expect(text).toHaveStyle({ position: 'absolute' });
    fireEvent(text, 'layout', { nativeEvent: { layout: { height: 26 } } });

    await waitFor(() =>
      expect(getAnimatedStyle(screen.getByTestId('terrain-note')).height).toBe(26),
    );
  });

  it('never shows the terrain note where there are 3D buildings', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    finishRendering();

    expect(screen.queryByText(TERRAIN_NOTE)).toBeNull();
  });

  it('enters the diorama with a light tap, and pauses the orbit underneath', async () => {
    const router = renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    fireEvent.press(screen.getByRole('button', { name: 'Enter Mini City' }));

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(await screen.findByTestId('viewer-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/view/paris');
    expect(router.getSegments()).toEqual(['view', '[cityId]']);
    expect(mapProps().orbit).toBe(false);

    // The Viewer has no chrome; exit the way VoiceOver does (a long press does the same).
    fireEvent(screen.getByTestId('viewer-screen'), 'accessibilityAction', {
      nativeEvent: { actionName: 'exit' },
    });

    expect(router.getPathname()).toBe('/city/paris');
    await waitFor(() => expect(mapProps().orbit).toBe(true));
  });

  it('keeps the map still under Reduce Motion, and follows the setting live', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    await waitFor(() => expect(mapProps().orbit).toBe(false));

    act(() => reduceMotionListener?.(false));
    expect(mapProps().orbit).toBe(true);

    act(() => reduceMotionListener?.(true));
    expect(mapProps().orbit).toBe(false);
  });
});

describe('city preview, VoiceOver', () => {
  it('names the map, and says where Enter Mini City goes', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    expect(screen.getByRole('image', { name: '3D map of Paris' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enter Mini City' }).props.accessibilityHint).toBe(
      'Opens the city full screen.',
    );
  });
});

describe('city preview, unknown city', () => {
  it('says so quietly and offers a way back to the list', async () => {
    const router = renderRouter(routes, { initialUrl: '/city/atlantis' });

    expect(await screen.findByTestId('city-not-found')).toBeOnTheScreen();
    expect(screen.getByText('City not found')).toBeOnTheScreen();
    expect(screen.queryByTestId('diorama-map')).toBeNull();
    expect(screen.queryByText('Enter Mini City')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Choose a city' }));

    expect(router.getPathname()).toBe('/');
    expect(await screen.findByTestId('city-picker-screen')).toBeOnTheScreen();
  });
});
