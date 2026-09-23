import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';

import { DioramaMapView, type DioramaEyeLayout } from '@diorama/native';

import { PerEye } from '../PerEye';

// The HUD is hidden from VoiceOver (it announces itself), so look past that.
const HIDDEN = { includeHiddenElements: true };

const CAMERA = {
  center: { latitude: 48.8575, longitude: 2.2957 },
  altitude: 1000,
  pitch: 60,
  heading: 137,
};

// An iPhone 14 Pro in landscape (852 × 393 pt) behind 64-mm lenses: the
// lens centers sit 386.4 pt apart, at x = 232.8 and 619.2.
const STEREO_LAYOUT: DioramaEyeLayout = {
  mode: 'stereo',
  left: { x: 118.33, y: 103, width: 229, height: 187 },
  right: { x: 504.67, y: 103, width: 229, height: 187 },
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
