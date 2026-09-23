import { textStyle, textVariants, typeRamp } from '../typography';

describe('type ramp', () => {
  it('covers every iOS text style, largest first', () => {
    expect(textVariants).toHaveLength(11);
    expect(Object.keys(typeRamp).sort()).toEqual([...textVariants].sort());

    const sizes = textVariants.map((variant) => typeRamp[variant].fontSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('matches the HIG defaults for the anchor styles', () => {
    expect(textStyle('largeTitle')).toEqual({ fontSize: 34, lineHeight: 41, fontWeight: '400' });
    expect(textStyle('body')).toEqual({ fontSize: 17, lineHeight: 22, fontWeight: '400' });
    expect(textStyle('headline')).toEqual({ fontSize: 17, lineHeight: 22, fontWeight: '600' });
    expect(textStyle('caption2')).toEqual({ fontSize: 11, lineHeight: 13, fontWeight: '400' });
  });

  it('never sets a line height smaller than the font size', () => {
    for (const variant of textVariants) {
      expect(typeRamp[variant].lineHeight).toBeGreaterThanOrEqual(typeRamp[variant].fontSize);
    }
  });

  it('uses the emphasized weight only when asked', () => {
    expect(textStyle('largeTitle', true).fontWeight).toBe('700');
    expect(textStyle('title3', true).fontWeight).toBe('600');
    expect(textStyle('body', true).fontWeight).toBe('600');
    expect(textStyle('body', false).fontWeight).toBe('400');
  });
});
