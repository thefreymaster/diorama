import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';

import { DioramaMapView, type DioramaEyeLayout } from '@diorama/native';

import { PerEye } from '../PerEye';
import { CIRCLE_MARGIN, circleContentWidth, circleFitScale } from '../useCircleFit';

// The HUD is hidden from VoiceOver (it announces itself), so look past that.
const HIDDEN = { includeHiddenElements: true };

const CAMERA = {
  center: { latitude: 48.8575, longitude: 2.2957 },
  altitude: 1000,
  pitch: 60,
  heading: 137,
};

// An iPhone 14 Pro in landscape (852 × 393 pt) behind 64-mm lenses: the
// lens centers sit 386.4 pt apart, at x = 232.8 and 619.2, and each eye is
// a 35-mm circle (211.3 pt), reported as the square around it.
const DIAMETER = 211.28;
const STEREO_LAYOUT: DioramaEyeLayout = {
  mode: 'stereo',
  left: { x: 127.19, y: 90.86, width: DIAMETER, height: DIAMETER },
  right: { x: 513.53, y: 90.86, width: DIAMETER, height: DIAMETER },
};

function Viewer({ perEye = true }: { perEye?: boolean }) {
  return (
    <View>
      <DioramaMapView testID="map" {...CAMERA} mode={perEye ? 'stereo' : 'mono'} />
      <PerEye perEye={perEye}>
        <Text>Recentered</Text>
      </PerEye>
    </View>
  );
}

function eyeBox(eye: 'left' | 'right' | 'both') {
  return StyleSheet.flatten(screen.getByTestId(`hud-eye-${eye}`, HIDDEN).props.style);
}

function reportLayout(layout: DioramaEyeLayout) {
  act(() => fireEvent(screen.getByTestId('map'), 'eyeLayout', { nativeEvent: layout }));
}

function fitBox(eye: 'left' | 'right' | 'both') {
  return StyleSheet.flatten(screen.getByTestId(`hud-fit-${eye}`, HIDDEN).props.style ?? {});
}

/** What the copy's own layout came to, before any scaling. */
function layOut(eye: 'left' | 'right', width: number, height: number) {
  act(() =>
    fireEvent(screen.getByTestId(`hud-fit-${eye}`, HIDDEN), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    }),
  );
}

function scaleOf(eye: 'left' | 'right'): number {
  const [transform] = (fitBox(eye).transform ?? []) as { scale: number }[];
  return transform?.scale ?? 1;
}

describe('PerEye', () => {
  it('centers a copy on each lens window once the map has laid out', () => {
    render(<Viewer />);
    reportLayout(STEREO_LAYOUT);

    for (const eye of ['left', 'right'] as const) {
      const { x, y, width, height } = STEREO_LAYOUT[eye];
      const box = eyeBox(eye);
      expect(box).toMatchObject({ position: 'absolute', left: x, top: y, width, height });
      expect(box).toMatchObject({ alignItems: 'center', justifyContent: 'center' });
      expect(screen.getByTestId(`hud-eye-${eye}`, HIDDEN)).toHaveTextContent('Recentered');
    }
    // Each copy's center is its lens center.
    const center = (eye: 'left' | 'right') => {
      const box = eyeBox(eye);
      return Number(box.left) + Number(box.width) / 2;
    };
    expect(center('left')).toBeCloseTo(232.83, 1);
    expect(center('right')).toBeCloseTo(619.17, 1);
  });

  it('keeps each copy inside its eye circle, shrinking it only when it has to', () => {
    render(<Viewer />);
    reportLayout(STEREO_LAYOUT);
    const room = DIAMETER / 2 - CIRCLE_MARGIN;

    // Text wraps short of the circle's edge.
    for (const eye of ['left', 'right'] as const) {
      expect(fitBox(eye).maxWidth).toBe(circleContentWidth(DIAMETER));
      expect(circleContentWidth(DIAMETER)).toBeLessThan(DIAMETER - 2 * CIRCLE_MARGIN);
    }

    // The countdown with its hint, as it was measured before it was made
    // compact: 194 × 142 pt, whose corners reached past the circle.
    layOut('left', 194, 142);
    layOut('right', 194, 142);
    expect(scaleOf('left')).toBeLessThan(1);
    expect(Math.hypot(194 / 2, 142 / 2) * scaleOf('left')).toBeCloseTo(room, 5);
    // Both eyes shrink alike, so the copies still fuse.
    expect(scaleOf('right')).toBe(scaleOf('left'));

    // Something that already fits (the compact countdown) keeps its full size.
    layOut('left', 158, 104);
    expect(Math.hypot(158 / 2, 104 / 2)).toBeLessThanOrEqual(room);
    expect(scaleOf('left')).toBe(1);
    expect(scaleOf('right')).toBe(1);
  });

  it('leaves the copies alone until there are circles to fit', () => {
    render(<Viewer />);
    expect(fitBox('left')).toEqual({});

    screen.unmount();
    render(<Viewer perEye={false} />);
    expect(fitBox('both')).toEqual({});
  });

  it('measures a fit by the corners of the box, half its diagonal out', () => {
    const room = DIAMETER / 2 - CIRCLE_MARGIN;
    // A one-line notice capsule, well inside.
    expect(circleFitScale({ width: 152, height: 44 }, DIAMETER)).toBe(1);
    // A square exactly as big as the room allows.
    const side = room * Math.SQRT2;
    expect(circleFitScale({ width: side, height: side }, DIAMETER)).toBeCloseTo(1, 10);
    // A tall stack at the largest text sizes shrinks to fit.
    const scale = circleFitScale({ width: 169, height: 230 }, DIAMETER);
    expect(Math.hypot(169 / 2, 230 / 2) * scale).toBeCloseTo(room, 5);
    // A circle smaller than the margin leaves no room at all.
    expect(circleFitScale({ width: 10, height: 10 }, CIRCLE_MARGIN)).toBe(0);
  });

  it('centers each copy in its half of the screen until then', () => {
    render(<Viewer />);

    for (const eye of ['left', 'right'] as const) {
      expect(eyeBox(eye)).toMatchObject({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      });
      expect(eyeBox(eye).position).toBeUndefined();
    }
  });

  it('goes back to halves when the map goes mono', () => {
    render(<Viewer />);
    reportLayout(STEREO_LAYOUT);
    const whole = { x: 0, y: 0, width: 852, height: 393 };
    reportLayout({ mode: 'mono', left: whole, right: whole });

    expect(eyeBox('left')).toMatchObject({ flex: 1 });
    expect(eyeBox('left').position).toBeUndefined();
  });

  it('draws one copy in the middle in mono', () => {
    render(<Viewer perEye={false} />);

    expect(screen.queryByTestId('hud-eye-left', HIDDEN)).toBeNull();
    expect(eyeBox('both')).toMatchObject({
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });
});
