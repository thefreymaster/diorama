import { render } from '@testing-library/react-native';
import { createRef } from 'react';

import { DioramaMapView, type DioramaMapViewRef } from '..';

describe('DioramaMapView', () => {
  it('renders and exposes recenter() on its ref', () => {
    const ref = createRef<DioramaMapViewRef>();
    const view = render(
      <DioramaMapView
        ref={ref}
        center={{ latitude: 40.7549, longitude: -73.984 }}
        altitude={1200}
        pitch={60}
        heading={29}
      />,
    );
    expect(view.toJSON()).toBeTruthy();
    expect(typeof ref.current?.recenter).toBe('function');
  });
});
