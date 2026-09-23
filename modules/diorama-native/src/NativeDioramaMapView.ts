import { requireNativeView } from 'expo';
import type { ComponentType, Ref } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import type {
  DioramaDegradedEvent,
  DioramaEyeLayout,
  DioramaMapViewProps,
  DioramaMapViewRef,
} from './DioramaMapView.types';

/** Native `onReady` payload: none. It only means "first full render done". */
export type NativeReadyEvent = NativeSyntheticEvent<Record<string, never>>;

/** Native `onDegraded` payload: the public event, wrapped by React Native. */
export type NativeDegradedEvent = NativeSyntheticEvent<DioramaDegradedEvent>;

/** Native `onEyeLayout` payload: the public layout, wrapped by React Native. */
export type NativeEyeLayoutEvent = NativeSyntheticEvent<DioramaEyeLayout>;

/**
 * Props exactly as the Swift view receives them. The public wrapper in
 * DioramaMapView.tsx turns native events into the friendlier public ones.
 */
export type NativeDioramaMapViewProps = Omit<
  DioramaMapViewProps,
  'onReady' | 'onDegraded' | 'onEyeLayout' | 'ref'
> & {
  onReady?: (event: NativeReadyEvent) => void;
  onDegraded?: (event: NativeDegradedEvent) => void;
  onEyeLayout?: (event: NativeEyeLayoutEvent) => void;
  ref?: Ref<DioramaMapViewRef>;
};

/** The raw native component (the first View in DioramaNativeModule.swift). */
export const NativeDioramaMapView: ComponentType<NativeDioramaMapViewProps> =
  requireNativeView('DioramaNative');
