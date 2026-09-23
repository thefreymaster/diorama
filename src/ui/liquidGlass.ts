import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

let cached: boolean | undefined;

/**
 * True when this iPhone can draw iOS 26 Liquid Glass. Checked once; both
 * checks are needed because some iOS 26 betas shipped without the API.
 */
export function canUseLiquidGlass(): boolean {
  if (cached === undefined) {
    try {
      cached = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    } catch {
      cached = false;
    }
  }
  return cached;
}
