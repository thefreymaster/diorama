import { requireNativeView } from 'expo';
import type { ComponentType, Ref } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import type {
  DioramaDegradedEvent,
  DioramaEyeLayout,
  DioramaMapViewProps,
  DioramaMapViewRef,
  DioramaViewMode,
} from './DioramaMapView.types';

/** Native `onReady` payload: which view ("first full render done") just drew. */
export type NativeReadyEvent = NativeSyntheticEvent<{ mode: DioramaViewMode }>;

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
