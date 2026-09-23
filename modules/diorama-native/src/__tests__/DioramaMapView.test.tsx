import { render } from '@testing-library/react-native';
import { createRef } from 'react';

import { DioramaMapView, type DioramaMapViewRef } from '..';

const CAMERA = {
  center: { latitude: 40.7549, longitude: -73.984 },
  altitude: 1200,
  pitch: 60,
  heading: 29,
};

describe('DioramaMapView', () => {
  it('renders and exposes recenter() and setDebugLook() on its ref', () => {
    const ref = createRef<DioramaMapViewRef>();
    const view = render(<DioramaMapView ref={ref} {...CAMERA} />);
    expect(view.toJSON()).toBeTruthy();
    expect(typeof ref.current?.recenter).toBe('function');
    expect(typeof ref.current?.setDebugLook).toBe('function');
  });

  it('leaves head tracking off by default', () => {
    const view = render(<DioramaMapView {...CAMERA} />);
    expect(view.toJSON()).toMatchObject({
      props: { headTracking: false, debugLook: false, trackingSensitivity: 1 },
    });
  });

  it('passes head tracking props to the native view', () => {
    const view = render(
      <DioramaMapView {...CAMERA} headTracking debugLook trackingSensitivity={1.5} />,
    );
    expect(view.toJSON()).toMatchObject({
      props: { ...CAMERA, headTracking: true, debugLook: true, trackingSensitivity: 1.5 },
    });
  });
});
