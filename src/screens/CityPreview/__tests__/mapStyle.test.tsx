import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ReactTestInstance } from 'react-test-renderer';

import { flyoverCoverageAt, type DioramaMapViewProps } from '@diorama/native';
import { addRecent, clearRecents, type RecentCity } from '@/features/cities/recentsStore';
import {
  getSettings,
  resetSettings,
  setMapStyle,
  setShowsTraffic,
} from '@/features/settings/store';
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
type MenuAction = {
  menuId: string;
  title: string;
  subtitle?: string;
  state?: 'on' | 'off' | 'mixed';
};
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

/** The map menu's Traffic item, in its own section under the styles. */
function trafficItem(title = 'Paris'): MenuAction {
  const section = mapButton(title).menu?.items[1];
  const action = section?.items.find((item) => item.title === 'Traffic');
  if (!action) throw new Error('No Traffic item in the map menu');
  return action;
}

/** Whether the Traffic item has its checkmark (traffic is on). */
function trafficOn(title = 'Paris'): boolean {
  return trafficItem(title).state === 'on';
}

/** What UIKit reports when Traffic is picked in the map menu. */
function pressTraffic(title = 'Paris') {
  fireEvent(header(title), 'pressHeaderBarButtonMenuItem', {
    nativeEvent: { menuId: trafficItem(title).menuId },
  });
}

/** The style with the checkmark. */
function checkedStyle(title = 'Paris') {
  return styleChoices(title)?.find((choice) => choice.on)?.title;
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

function savedTraffic(): unknown {
  return JSON.parse(storage.getString('settings') ?? 'null')?.state?.showsTraffic;
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
    expect(button.menu?.items).toHaveLength(2);
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

describe('the map menu’s Traffic switch', () => {
  it('sits under the styles, off, saying where the traffic comes from', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    expect(mapButton().menu?.items[1]).toMatchObject({ displayInline: true });
    expect(mapButton().menu?.items[1]?.items).toHaveLength(1);
    expect(trafficItem()).toMatchObject({
      title: 'Traffic',
      subtitle: 'Live traffic from Apple Maps',
    });
    expect(trafficOn()).toBe(false);
    expect(previewMap().showsTraffic).toBe(false);
  });

  it('turns traffic on and off in place, Satellite showing labels meanwhile', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');
    finishRendering();
    const camera = {
      center: previewMap().center,
      altitude: previewMap().altitude,
      pitch: previewMap().pitch,
      heading: previewMap().heading,
    };

    act(() => pressTraffic());

    expect(trafficOn()).toBe(true);
    expect(previewMap().showsTraffic).toBe(true);
    // Imagery alone can't show traffic: it's drawn with labels, and the
    // menu says so.
    expect(checkedStyle()).toBe('Satellite with labels');
    expect(mapButton().accessibilityLabel).toBe('Map style, Satellite with labels, with traffic');
    // The choice underneath is still Satellite, for when traffic goes off.
    expect(getSettings().mapStyle).toBe('satellite');
    expect(previewMap().mapStyle).toBe('satellite');
    // Same map, same camera, still turning.
    expect(previewMap()).toMatchObject({ ...camera, orbit: true });
    expect(screen.getAllByTestId('diorama-map', { includeHiddenElements: true })).toHaveLength(1);

    act(() => pressTraffic());

    expect(trafficOn()).toBe(false);
    expect(previewMap().showsTraffic).toBe(false);
    expect(checkedStyle()).toBe('Satellite');
    expect(mapButton().accessibilityLabel).toBe('Map style, Satellite');
    expect(previewMap()).toMatchObject({ ...camera, orbit: true, mapStyle: 'satellite' });
  });

  it('keeps traffic on in Satellite with labels and Standard, and off in Satellite', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    act(() => pickStyle('Standard'));
    act(() => pressTraffic());
    expect(checkedStyle()).toBe('Standard');
    expect(previewMap()).toMatchObject({ mapStyle: 'standard', showsTraffic: true });
    expect(mapButton().accessibilityLabel).toBe('Map style, Standard, with traffic');

    act(() => pickStyle('Satellite with labels'));
    expect(checkedStyle()).toBe('Satellite with labels');
    expect(previewMap()).toMatchObject({ mapStyle: 'hybrid', showsTraffic: true });

    // Satellite is the imagery with nothing on top: picking it ends traffic.
    act(() => pickStyle('Satellite'));
    expect(checkedStyle()).toBe('Satellite');
    expect(trafficOn()).toBe(false);
    expect(previewMap()).toMatchObject({ mapStyle: 'satellite', showsTraffic: false });

    // Labels chosen with traffic on stay when traffic goes off.
    act(() => pressTraffic());
    act(() => pickStyle('Satellite with labels'));
    act(() => pressTraffic());
    expect(checkedStyle()).toBe('Satellite with labels');
    expect(previewMap()).toMatchObject({ mapStyle: 'hybrid', showsTraffic: false });
  });

  it('remembers traffic, across launches, until Reset to defaults', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');

    act(() => pressTraffic());

    expect(getSettings().showsTraffic).toBe(true);
    expect(savedTraffic()).toBe(true);
    screen.unmount();

    // Another city, another visit: traffic still on.
    renderRouter(routes, { initialUrl: '/city/london' });
    await screen.findByTestId('city-preview-screen');
    expect(previewMap().showsTraffic).toBe(true);
    expect(trafficOn('London')).toBe(true);
    expect(checkedStyle('London')).toBe('Satellite with labels');

    act(() => resetSettings());
    expect(previewMap().showsTraffic).toBe(false);
    expect(savedTraffic()).toBe(false);
    expect(trafficOn('London')).toBe(false);
    expect(checkedStyle('London')).toBe('Satellite');
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

  it('carries traffic into the Viewer, and reaches it live', async () => {
    renderRouter(routes, { initialUrl: '/city/paris' });
    await screen.findByTestId('city-preview-screen');
    act(() => pressTraffic());

    fireEvent.press(screen.getByRole('button', { name: 'Enter Mini City' }));
    const viewerMap = () => screen.getByTestId('viewer-map').props as DioramaMapViewProps;
    await screen.findByTestId('viewer-map');
    expect(viewerMap()).toMatchObject({ mapStyle: 'satellite', showsTraffic: true });
    const camera = {
      center: viewerMap().center,
      altitude: viewerMap().altitude,
      pitch: viewerMap().pitch,
      heading: viewerMap().heading,
    };

    act(() => setShowsTraffic(false));
    expect(viewerMap()).toMatchObject({ ...camera, showsTraffic: false });
    expect(screen.getAllByTestId('viewer-map')).toHaveLength(1);
  });

  it('opens a deep-linked Viewer in the chosen style', async () => {
    setMapStyle('hybrid');
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = await screen.findByTestId('viewer-map');
    expect((viewerMap.props as DioramaMapViewProps).mapStyle).toBe('hybrid');
    expect((viewerMap.props as DioramaMapViewProps).showsTraffic).toBe(false);
  });

  it('opens a deep-linked Viewer with traffic when it is on', async () => {
    setMapStyle('standard');
    setShowsTraffic(true);
    renderRouter(routes, { initialUrl: '/view/paris' });

    const viewerMap = await screen.findByTestId('viewer-map');
    expect(viewerMap.props as DioramaMapViewProps).toMatchObject({
      mapStyle: 'standard',
      showsTraffic: true,
    });
  });
});
