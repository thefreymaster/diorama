import { ACCESSIBILITY_FONT_SCALE, scaleForDynamicType, MAX_GLYPH_SCALE } from '../dynamicType';
import { iosMajorVersion, listMetrics } from '../metrics';
import { GRID, space, spacing } from '../spacing';

describe('spacing', () => {
  it('keeps every step on the 4-pt grid', () => {
    for (const value of Object.values(spacing)) {
      expect(value % GRID).toBe(0);
    }
    expect(space(3)).toBe(12);
    expect(spacing.lg).toBe(16);
  });
});

describe('iosMajorVersion', () => {
  it('reads the major version from strings and numbers', () => {
    expect(iosMajorVersion('26.0')).toBe(26);
    expect(iosMajorVersion('18.6.2')).toBe(18);
    expect(iosMajorVersion(17.4)).toBe(17);
  });

  it('treats garbage as an old iOS', () => {
    expect(iosMajorVersion('')).toBe(0);
    expect(iosMajorVersion('beta')).toBe(0);
  });
});

describe('listMetrics', () => {
  const hairline = 1 / 3;

  it('keeps classic full-width hairline lists before iOS 26', () => {
    expect(listMetrics(18, hairline)).toEqual({
      rowMinHeight: 44,
      sectionRadius: 10,
      separatorThickness: hairline,
      separatorTrailingInset: 0,
    });
  });

  it('matches the iOS 26 Settings app from iOS 26 on', () => {
    expect(listMetrics(26, hairline)).toEqual({
      rowMinHeight: 52,
      sectionRadius: 26,
      separatorThickness: 1,
      separatorTrailingInset: 16,
    });
    expect(listMetrics(27, hairline)).toEqual(listMetrics(26, hairline));
  });
});

describe('scaleForDynamicType', () => {
  it('leaves sizes alone at the default text size', () => {
    expect(scaleForDynamicType(29, 1)).toBe(29);
  });

  it('follows smaller and larger text sizes, rounded to whole points', () => {
    expect(scaleForDynamicType(17, 0.823)).toBe(14);
    expect(scaleForDynamicType(17, 1.235)).toBe(21);
  });

  it('stops growing at the accessibility sizes', () => {
    expect(MAX_GLYPH_SCALE).toBe(1.6);
    expect(scaleForDynamicType(20, 3.1)).toBe(32);
    expect(scaleForDynamicType(20, 3.1, 2)).toBe(40);
  });
});

describe('accessibility text sizes', () => {
  // Body text is 17 pt at the default size, 23 pt at XXXL and 28 pt at AX1.
  it('begin after the largest standard size', () => {
    expect(ACCESSIBILITY_FONT_SCALE).toBeGreaterThan(23 / 17);
    expect(ACCESSIBILITY_FONT_SCALE).toBeLessThanOrEqual(28 / 17);
  });
});
