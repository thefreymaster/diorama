import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import * as CityRoute from '../../../app/city/[cityId]';
import * as IndexRoute from '../../../app/index';
import * as RootLayout from '../../../app/_layout';
import * as SettingsRoute from '../../../app/settings';
import * as ViewerRoute from '../../../app/view/[cityId]';

// Only this task's routes, so dev routes (app/dev/*) and their native
// modules stay out of the test.
const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  'view/[cityId]': ViewerRoute,
  settings: SettingsRoute,
};

describe('routes', () => {
  it('opens the city picker at /', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('city-picker-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });

  it('opens settings at /settings, on top of the picker', async () => {
    const router = renderRouter(routes, { initialUrl: '/settings' });

    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/settings');

    // A deep link still has the picker underneath, so swipe-back has somewhere to go.
    expect(testRouter.canGoBack()).toBe(true);
    testRouter.back('/');
  });

  it('opens the preview at /city/[cityId]', async () => {
    const router = renderRouter(routes, { initialUrl: '/city/paris' });

    expect(await screen.findByTestId('city-preview-screen')).toBeOnTheScreen();
    expect(screen.getByText('paris')).toBeOnTheScreen();
    expect(router.getSegments()).toEqual(['city', '[cityId]']);
    expect(testRouter.canGoBack()).toBe(true);
  });

  it('opens the viewer at /view/[cityId]', async () => {
    const router = renderRouter(routes, { initialUrl: '/view/paris' });

    expect(await screen.findByTestId('viewer-screen')).toBeOnTheScreen();
    expect(screen.getByText('Viewer: paris')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/view/paris');
  });

  it('goes from the preview into the viewer and back', async () => {
    const router = renderRouter(routes, { initialUrl: '/city/paris' });

    fireEvent.press(await screen.findByText('Enter Diorama'));
    expect(await screen.findByTestId('viewer-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/view/paris');

    fireEvent.press(screen.getByText('Done'));
    expect(router.getPathname()).toBe('/city/paris');
  });
});
