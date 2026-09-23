import { renderRouter, screen } from 'expo-router/testing-library';

// The first render loads every route file in app/, which can take over a
// second on a cold Jest cache, so allow more than RNTL's default 1 s.
const FIRST_RENDER_TIMEOUT_MS = 10_000;

describe('app', () => {
  it(
    'opens on the index route',
    async () => {
      const router = renderRouter('./app');

      expect(router.getPathname()).toBe('/');
      expect(
        await screen.findByText('Featured', {}, { timeout: FIRST_RENDER_TIMEOUT_MS }),
      ).toBeOnTheScreen();
    },
    FIRST_RENDER_TIMEOUT_MS + 5_000,
  );
});
