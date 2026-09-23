import { renderRouter, screen } from 'expo-router/testing-library';

describe('app', () => {
  it('opens on the index route', async () => {
    const router = renderRouter('./app');

    expect(router.getPathname()).toBe('/');
    expect(await screen.findByText('Tiny model cities, in stereo.')).toBeOnTheScreen();
  });
});
