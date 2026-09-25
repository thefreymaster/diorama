import { requireNativeView } from 'expo';
import type { ComponentType, Ref } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import type {
  DioramaCompassStateEvent,
  DioramaDegradedEvent,
  DioramaEyeLayout,
  DioramaHeadPositionStateEvent,
  DioramaHeadPositionStats,
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

/** Native `onHeadPositionState` payload, wrapped by React Native. */
export type NativeHeadPositionStateEvent = NativeSyntheticEvent<DioramaHeadPositionStateEvent>;

/** Native `onHeadPositionStats` payload (debug builds), wrapped by React Native. */
export type NativeHeadPositionStatsEvent = NativeSyntheticEvent<DioramaHeadPositionStats>;

/** Native `onCompassState` payload, wrapped by React Native. */
export type NativeCompassStateEvent = NativeSyntheticEvent<DioramaCompassStateEvent>;

/**
 * Props exactly as the Swift view receives them. The public wrapper in
 * DioramaMapView.tsx turns native events into the friendlier public ones.
 */
export type NativeDioramaMapViewProps = Omit<
  DioramaMapViewProps,
  | 'onReady'
  | 'onDegraded'
  | 'onEyeLayout'
  | 'onHeadPositionState'
  | 'onHeadPositionStats'
  | 'onCompassState'
  | 'ref'
> & {
  onReady?: (event: NativeReadyEvent) => void;
  onDegraded?: (event: NativeDegradedEvent) => void;
  onEyeLayout?: (event: NativeEyeLayoutEvent) => void;
  onHeadPositionState?: (event: NativeHeadPositionStateEvent) => void;
  onHeadPositionStats?: (event: NativeHeadPositionStatsEvent) => void;
  onCompassState?: (event: NativeCompassStateEvent) => void;
  ref?: Ref<DioramaMapViewRef>;
};

/** The raw native component (the first View in DioramaNativeModule.swift). */
export const NativeDioramaMapView: ComponentType<NativeDioramaMapViewProps> =
  requireNativeView('DioramaNative');
