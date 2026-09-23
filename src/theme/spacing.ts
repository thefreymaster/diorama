/** Every gap and padding sits on a 4-pt grid. */
export const GRID = 4;

/** `space(3)` → 12. For the odd value the named steps don't cover. */
export function space(steps: number): number {
  return steps * GRID;
}

export const spacing = {
  xs: space(1), // 4
  sm: space(2), // 8
  md: space(3), // 12
  lg: space(4), // 16: standard iOS side margin
  xl: space(5), // 20
  xxl: space(6), // 24
  xxxl: space(8), // 32
  huge: space(12), // 48
} as const;

export type SpacingToken = keyof typeof spacing;
