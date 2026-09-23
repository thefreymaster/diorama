import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppProviders } from '@/providers/AppProviders';

import * as DevMapRoute from '../../app/dev/map';
import * as DevSearchRoute from '../../app/dev/search';
import * as DevUIRoute from '../../app/dev/ui';

// A stand-in home screen, so this test doesn't depend on the city picker.
function Home() {
  return <Text testID="home">Home</Text>;
}

// The dev search route's hooks need the query client, even when it redirects.
function Layout() {
  return (
    <AppProviders>
      <Stack />
    </AppProviders>
  );
}

const routes = {
  _layout: Layout,
  index: Home,
  'dev/map': DevMapRoute,
  'dev/search': DevSearchRoute,
  'dev/ui': DevUIRoute,
};

const runtime = globalThis as unknown as { __DEV__: boolean };

describe('dev routes in a release build', () => {
  const wasDev = runtime.__DEV__;

  beforeEach(() => {
    runtime.__DEV__ = false;
  });

  afterEach(() => {
    runtime.__DEV__ = wasDev;
  });

  it.each(['/dev/map', '/dev/map?lat=48.85&lon=2.35&orbit=1', '/dev/search', '/dev/ui'])(
    '%s redirects home',
    async (url) => {
      const router = renderRouter(routes, { initialUrl: url });

      expect(await screen.findByTestId('home')).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/');
    },
  );
});

describe('dev routes in development', () => {
  it('opens the UI gallery at /dev/ui', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev/ui' });

    expect(await screen.findByText('Large title')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/dev/ui');
  });

  it('opens the search check at /dev/search', async () => {
    const router = renderRouter(routes, { initialUrl: '/dev/search' });

    expect(await screen.findByLabelText('City or address')).toBeOnTheScreen();
    expect(screen.getByTestId('search-status')).toHaveTextContent('Type at least 2 letters.');
    expect(router.getPathname()).toBe('/dev/search');
  });
});
