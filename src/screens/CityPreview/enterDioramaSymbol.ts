import type { SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';

import { iosMajorVersion } from '@/theme';

/** `visionpro` arrived with SF Symbols 5 (iOS 17). Older iOS gets eyeglasses. */
export function enterDioramaSymbol(iosMajor: number): SFSymbol {
  return iosMajor >= 17 ? 'visionpro' : 'eyeglasses';
}

/** The glyph on the "Enter Mini City" button for the iOS this is running on. */
export const ENTER_DIORAMA_SYMBOL = enterDioramaSymbol(iosMajorVersion(Platform.Version));
