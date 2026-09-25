import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactTestInstance } from 'react-test-renderer';

import { flyoverCoverageAt, type DioramaMapViewProps } from '@diorama/native';
import { addRecent, clearRecents, type RecentCity } from '@/features/cities/recentsStore';
import { getSettings, resetSettings, setMapStyle } from '@/features/settings/store';
import { queryClient } from '@/providers/queryClient';
import { storage } from '@/providers/storage';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as PickRoute from '../../../../app/pick';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';
import * as ViewerRoute from '../../../../app/view/[cityId]';
import * as ViewpointsRoute from '../../../../app/viewpoints/[cityId]';
import { TERRAIN_NOTE } from '../TerrainNote';

// The native map becomes a plain view that keeps its props (so tests can
// read them and play MapKit's part by calling `onReady`) and a ref for the
// Viewer.
jest.mock('@diorama/native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function MockDioramaMapView({ ref, ...props }: DioramaMapViewProps) {
    React.useImperativeHandle(ref, () => ({
      recenter: () => Promise.resolve(),
      setDebugLook: () => Promise.resolve(),
      beginZoom: () => Promise.resolve(),
      setZoom: () => Promise.resolve(),
      endZoom: () => Promise.resolve(),
      resetZoom: () => Promise.resolve(),
      followTo: () => Promise.resolve(),
      setDebugLean: () => Promise.resolve(),
    }));
    return React.createElement(View, { testID: 'diorama-map', ...props });
  }
  return {
    ...jest.requireActual<object>('@diorama/native'),
    DioramaMapView: MockDioramaMapView,
  };
});

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  pick: PickRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  'viewpoints/[cityId]': ViewpointsRoute,
  settings: SettingsRoute,
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

/** The native stack's header settings for one screen (react-native-screens). */
const HEADER_CONFIG: string = 'RNSScreenStackHeaderConfig';

/** A menu choice as react-native-screens hands it to UIKit (a UIAction). */
type MenuAction = { menuId: string; title: string; state?: 'on' | 'off' | 'mixed' };
/** A section of a menu (an inline UIMenu). */
type MenuSection = { title?: string; displayInline?: boolean; items: MenuAction[] };
/** A bar button (UIBarButtonItem) as react-native-screens hands it to UIKit. */
type BarButtonItem = {
  type: 'button' | 'menu';
  sfSymbolName?: string;
  accessibilityLabel?: string;
  menu?: { items: MenuSection[] };
};

/** The preview's header for `title`. */
function header(title: string): ReactTestInstance {
  return screen.UNSAFE_root.find(
    (node) => node.type === HEADER_CONFIG && node.props.title === title,
  );
}

/** The map button, top right in the preview's header. */
function mapButton(title = 'Paris'): BarButtonItem {
  const items: BarButtonItem[] = header(title).props.headerRightBarButtonItems ?? [];
  const button = items.find((item) => item.sfSymbolName === 'map');
  if (!button) throw new Error('No map button in the header');
  return button;
}

/** The map menu's style choices: each one's name and whether it has the checkmark. */
function styleChoices(title = 'Paris') {
  const section = mapButton(title).menu?.items[0];
  return section?.items.map((action) => ({ title: action.title, on: action.state === 'on' }));
}

/** What UIKit reports when a choice in the map menu is picked. */
function pickStyle(name: string, title = 'Paris') {
  const section = mapButton(title).menu?.items[0];
  const action = section?.items.find((item) => item.title === name);
  expect(action).toBeDefined();
  fireEvent(header(title), 'pressHeaderBarButtonMenuItem', {
    nativeEvent: { menuId: action?.menuId },
  });
}

/** The map's props, even while another screen covers (and hides) the preview. */
function previewMap(): DioramaMapViewProps {
  return screen.getByTestId('diorama-map', { includeHiddenElements: true })
    .props as DioramaMapViewProps;
}

/** What the map reports once MapKit has drawn the first full frame. */
function finishRendering() {
  act(() =>
    previewMap().onReady?.({ coverage: flyoverCoverageAt(previewMap().center), mode: 'mono' }),
  );
}

function savedMapStyle(): unknown {
  return JSON.parse(storage.getString('settings') ?? 'null')?.state?.mapStyle;
}

beforeEach(() => {
  queryClient.clear();
  clearRecents();
  resetSettings();
});

describe('the preview’s map menu', () => {
  it('sits top right as a map button, with the three styles and a checkmark on Satellite', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    const button = mapButton();
    expect(button.type).toBe('menu');
    expect(button.accessibilityLabel).toBe('Map style, Satellite');
    expect(button.menu?.items).toHaveLength(1);
    expect(button.menu?.items[0]).toMatchObject({ title: 'Map style', displayInline: true });
    expect(styleChoices()).toEqual([
      { title: 'Satellite', on: true },
      { title: 'Satellite with labels', on: false },
      { title: 'Standard', on: false },
    ]);
    expect(previewMap().mapStyle).toBe('satellite');
  });

  it('changes the map style in place, and moves the checkmark', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');
    finishRendering();
    const camera = {
      center: previewMap().center,
      altitude: previewMap().altitude,
      pitch: previewMap().pitch,
      heading: previewMap().heading,
    };

    act(() => pickStyle('Standard'));

    expect(previewMap().mapStyle).toBe('standard');
    expect(mapButton().accessibilityLabel).toBe('Map style, Standard');
    expect(styleChoices()).toEqual([
      { title: 'Satellite', on: false },
      { title: 'Satellite with labels', on: false },
      { title: 'Standard', on: true },
    ]);
    // Same map, same camera, still turning: only the look changed.
    expect(previewMap()).toMatchObject({ ...camera, orbit: true });
    expect(screen.getAllByTestId('diorama-map', { includeHiddenElements: true })).toHaveLength(1);

    act(() => pickStyle('Satellite with labels'));
    expect(previewMap().mapStyle).toBe('hybrid');
    expect(mapButton().accessibilityLabel).toBe('Map style, Satellite with labels');
  });

  it('remembers the choice, across launches, until Reset to defaults', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    act(() => pickStyle('Standard'));

    expect(getSettings().mapStyle).toBe('standard');
    expect(savedMapStyle()).toBe('standard');
    screen.unmount();

    // Another city, another visit: still Standard.
    renderRouter(routes, { initialUrl: '/city/london' });
    await screen.findByTestId('city-preview-screen');
    expect(previewMap().mapStyle).toBe('standard');
    expect(styleChoices('London')?.find((choice) => choice.on)?.title).toBe('Standard');

    act(() => resetSettings());
    expect(previewMap().mapStyle).toBe('satellite');
    expect(savedMapStyle()).toBe('satellite');
  });

  it('drops the "terrain only" note in Standard, which draws its own buildings', async () => {
    addRecent(DUBAI);
    renderRouter(routes, { initialUrl: `/city/${DUBAI.id}` });
    await screen.findByText('Dubai');
    finishRendering();
    expect(screen.getByText(TERRAIN_NOTE)).toBeOnTheScreen();

    act(() => pickStyle('Standard', 'Dubai'));
    expect(screen.queryByText(TERRAIN_NOTE)).toBeNull();

    // The labels don't add buildings: the note is back.
    act(() => pickStyle('Satellite with labels', 'Dubai'));
    await waitFor(() => expect(screen.getByText(TERRAIN_NOTE)).toBeOnTheScreen());
  });
});

describe('the map style elsewhere', () => {
  it('carries into the Viewer, and reaches it live', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');
    act(() => pickStyle('Standard'));

    fireEvent.press(screen.getByRole('button', { name: 'Enter Mini City' }));
    const viewerMap = () => screen.getByTestId('viewer-map').props as DioramaMapViewProps;
    await screen.findByTestId('viewer-map');
    expect(viewerMap().mapStyle).toBe('standard');

    act(() => setMapStyle('hybrid'));
    expect(viewerMap().mapStyle).toBe('hybrid');
  });

  it('opens a deep-linked Viewer in the chosen style', async () => {
    setMapStyle('hybrid');
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = await screen.findByTestId('viewer-map');
    expect((viewerMap.props as DioramaMapViewProps).mapStyle).toBe('hybrid');
  });
});
