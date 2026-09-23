import type { Completion, PlaceKind } from '@diorama/native';

import { KIND_SYMBOLS, searchSections, titleMatch } from '../searchSections';

function completion(
  title: string,
  subtitle: string,
  kind: PlaceKind,
  highlights: [start: number, length: number][] = [],
): Completion {
  return {
    id: `${title}\u001f${subtitle}`,
    title,
    subtitle,
    titleHighlights: highlights.map(([start, length]) => ({ start, length })),
    kind,
  };
}

function titles(completions: readonly Completion[]): string[] {
  return completions.map((result) => `${result.title} | ${result.subtitle}`);
}

// Real results for "Par" from a Mac near Boston: Apple's mixed order puts
// the nearby station before Paris.
const PAR = [
  completion('Park Street Station', 'Boston, MA, United States', 'address', [[0, 3]]),
  completion('Paris', 'France', 'city', [[0, 3]]),
  completion('The Paramount', '44 Charles St, Boston, MA  02114, United States', 'place', [[4, 3]]),
  completion('Parma', 'Italy', 'city', [[0, 3]]),
  completion('Parkhurst Rd', 'Lowell, MA, United States', 'address', [[0, 3]]),
];

describe('titleMatch', () => {
  it('is the share of the title that matches', () => {
    expect(titleMatch(PAR[1]!)).toBeCloseTo(0.6);
    expect(titleMatch(PAR[0]!)).toBeCloseTo(3 / 19);
  });

  it('counts overlapping ranges once and ignores ranges past the title', () => {
    const tower = completion('Eiffel Tower', 'France', 'place', [
      [0, 6],
      [7, 5],
      [0, 12],
    ]);
    expect(titleMatch(tower)).toBe(1);
    expect(titleMatch(completion('Rome', 'Italy', 'city', [[2, 10]]))).toBe(0.5);
    expect(titleMatch(completion('', '', 'city', [[0, 1]]))).toBe(0);
  });
});

describe('searchSections', () => {
  it('splits cities from addresses and places, keeping Apple’s order in each', () => {
    const sections = searchSections(PAR);

    expect(sections.map((section) => section.title)).toEqual(['Cities', 'Places']);
    expect(titles(sections[0]!.completions)).toEqual(['Paris | France', 'Parma | Italy']);
    expect(titles(sections[1]!.completions)).toEqual([
      'Park Street Station | Boston, MA, United States',
      'The Paramount | 44 Charles St, Boston, MA  02114, United States',
      'Parkhurst Rd | Lowell, MA, United States',
    ]);
  });

  it('leads with the section whose top result matches the typed text better', () => {
    // "Par" is most of "Paris" but little of "Park Street Station".
    expect(searchSections(PAR)[0]!.key).toBe('cities');

    // "Tokyo" is all of the city, but not of Tokyo Steakhouse.
    const tokyo = [
      completion('Tokyo Steakhouse', '1201 Broadway, Saugus, MA  01906', 'place', [[0, 5]]),
      completion('Tokyo', 'Japan', 'city', [[0, 5]]),
    ];
    expect(searchSections(tokyo).map((section) => section.key)).toEqual(['cities', 'places']);

    const loop = [
      completion('Infinite Loop', 'Cupertino, CA, United States', 'city', [[0, 8]]),
      completion('1 Infinite Loop', 'Cupertino, CA, United States', 'address', [[0, 15]]),
    ];
    expect(searchSections(loop).map((section) => section.key)).toEqual(['places', 'cities']);
  });

  it('follows Apple’s ranking when both match as well', () => {
    const eiffel = [
      completion('Eiffel Tower', '5 Avenue Anatole France, 75007 Paris', 'place', [[0, 12]]),
      completion('Eiffel Tower', 'Varachha, Surat, Gujarat, India', 'city', [[0, 12]]),
    ];
    expect(searchSections(eiffel).map((section) => section.key)).toEqual(['places', 'cities']);
    expect(searchSections([...eiffel].reverse()).map((section) => section.key)).toEqual([
      'cities',
      'places',
    ]);
  });

  it('leaves out an empty section', () => {
    const address = [
      completion('1 Infinite Loop', 'Cupertino, CA, United States', 'address', [[0, 15]]),
    ];
    expect(searchSections(address).map((section) => section.title)).toEqual(['Places']);
    expect(searchSections([PAR[1]!]).map((section) => section.title)).toEqual(['Cities']);
    expect(searchSections([])).toEqual([]);
  });
});

describe('KIND_SYMBOLS', () => {
  it('gives each kind its own glyph', () => {
    expect(KIND_SYMBOLS).toEqual({
      city: 'mappin.and.ellipse',
      address: 'mappin.circle.fill',
      place: 'building.2.fill',
    });
  });
});
