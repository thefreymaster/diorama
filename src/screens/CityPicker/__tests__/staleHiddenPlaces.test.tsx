import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import { CURATED_PLACES } from '@/features/cities/curated';
import { getHiddenFeatured } from '@/features/cities/hiddenFeaturedStore';

import * as CityRoute from '../../../../app/city/[cityId]';
import * as IndexRoute from '../../../../app/index';
import * as RootLayout from '../../../../app/_layout';
import * as SettingsRoute from '../../../../app/settings';

// Saved by an older version, before T58 trimmed the suggestions: Venice,
// Glacier and Mount Rainier were deleted from the picker while it still
// listed them, and Tokyo was too. MMKV is read the first time the store
// loads, so the old list is on disk before this file's imports run.
jest.mock('@/providers/storage', () => {
  const actual = jest.requireActual<typeof import('@/providers/storage')>('@/providers/storage');
  actual.storage.set(
    'hiddenFeatured',
    JSON.stringify({
      state: { ids: ['venice', 'tokyo', 'glacier', 'mount-rainier'] },
      version: 1,
    }),
  );
  return actual;
});

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  'city/[cityId]': CityRoute,
  settings: SettingsRoute,
};

/** The title of every row in the picker, top to bottom. */
function rowTitles(): string[] {
  return screen
    .getAllByTestId('swipe-row')
    .map((row) => within(row).getAllByText(/./)[0]?.props.children as string);
}

describe('city picker, hidden places that are no longer suggested', () => {
  it('forgets them on launch and keeps the rest hidden', () => {
    expect(getHiddenFeatured()).toEqual(['tokyo']);
  });

  it('lists every other suggested place once, with no empty rows', async () => {
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByText('Featured');
    const expected = CURATED_PLACES.filter((place) => place.id !== 'tokyo').map(
      (place) => place.name,
    );
    expect(rowTitles()).toEqual(expected);
    for (const title of rowTitles()) expect(title.trim()).not.toBe('');
    expect(screen.queryByText('Tokyo')).toBeNull();
    expect(screen.queryByText('No places')).toBeNull();
  });

  it('restores only what is still there', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByText('Featured');

    act(() => router.push('/settings'));
    fireEvent.press(await screen.findByRole('button', { name: 'Restore suggested places' }));
    expect(getHiddenFeatured()).toEqual([]);

    act(() => router.back());
    expect(await screen.findByText('Tokyo')).toBeOnTheScreen();
    expect(rowTitles()).toEqual(CURATED_PLACES.map((place) => place.name));
  });
});
