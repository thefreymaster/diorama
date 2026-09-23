/**
 * Maps a setting's value to where the thumb sits on a slider (0 at the left,
 * 1 at the right) and back. Every Settings slider runs from 0 to 1, and the
 * scale decides what the ends mean.
 */
export type SliderScale = {
  toPosition: (value: number) => number;
  fromPosition: (position: number) => number;
};

/** Evenly spaced: `left` at the left end, `right` at the right end. */
export function linearScale(left: number, right: number): SliderScale {
  return {
    toPosition: (value) => (value - left) / (right - left),
    fromPosition: (position) => left + position * (right - left),
  };
}

/**
 * Spaced by ratio, for multipliers: equal thumb moves multiply the value by
 * the same amount, so 0.5× and 2× sit the same distance either side of 1×.
 * `left` may be larger than `right`, to run the value backwards.
 */
export function logScale(left: number, right: number): SliderScale {
  const span = Math.log(right / left);
  return {
    toPosition: (value) => Math.log(value / left) / span,
    fromPosition: (position) => left * Math.exp(position * span),
  };
}

/** A linear scale whose values land on whole steps, and the slider snaps with them. */
export type SteppedScale = SliderScale & {
  /** One step as a share of the track, for the slider's own `step`. */
  positionStep: number;
};

/**
 * Evenly spaced like `linearScale`, but values snap to whole multiples of
 * `step` from `left` (say, whole millimeters). The range should span a whole
 * number of steps, so both ends are reachable.
 */
export function steppedScale(left: number, right: number, step: number): SteppedScale {
  const linear = linearScale(left, right);
  return {
    toPosition: linear.toPosition,
    fromPosition: (position) => {
      const steps = Math.round((linear.fromPosition(position) - left) / step);
      return left + steps * step;
    },
    positionStep: step / (right - left),
  };
}
