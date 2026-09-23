import { getCuratedCity } from '@/features/cities/curated';
import type { RecentCity } from '@/features/cities/recentsStore';

import { curatedMatch } from '../curatedMatch';

/** Apple Maps' Paris: the city's center, ~4 km from our Trocadéro view. */
const PARIS_FRANCE: RecentCity = {
  id: 'paris_48.857_2.352',
  name: 'Paris',
  country: 'France',
  lat: 48.8566,
  lon: 2.3522,
  altitude: 1500,
};

describe('curatedMatch', () => {
  it('finds the featured city a search result stands for', () => {
    expect(curatedMatch(PARIS_FRANCE)).toBe(getCuratedCity('paris'));
  });

  it('ignores case and accents in the name', () => {
    expect(curatedMatch({ ...PARIS_FRANCE, name: 'PARÍS' })?.id).toBe('paris');
  });

  it('needs the same name: a neighborhood is not the city', () => {
    expect(curatedMatch({ ...PARIS_FRANCE, name: 'Montmartre', lat: 48.8867, lon: 2.3431 })).toBe(
      undefined,
    );
  });

  it('needs the same place: Paris, TX is not Paris', () => {
    expect(
      curatedMatch({ ...PARIS_FRANCE, country: 'United States', lat: 33.6609, lon: -95.5555 }),
    ).toBe(undefined);
  });
});
