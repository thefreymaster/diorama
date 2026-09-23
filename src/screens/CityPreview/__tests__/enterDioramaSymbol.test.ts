import { enterDioramaSymbol } from '../enterDioramaSymbol';

describe('enterDioramaSymbol', () => {
  it('uses the Vision Pro glyph from iOS 17, where SF Symbols 5 has it', () => {
    expect(enterDioramaSymbol(17)).toBe('visionpro');
    expect(enterDioramaSymbol(26)).toBe('visionpro');
  });

  it('falls back to eyeglasses on iOS 16', () => {
    expect(enterDioramaSymbol(16)).toBe('eyeglasses');
  });
});
