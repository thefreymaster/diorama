import { requireNativeModule } from 'expo';

/**
 * Whether head position (lean to get closer, `headPosition`) may use the
 * camera: `granted`, `denied` (in iOS Settings, or restricted),
 * `undetermined` (never asked), or `unsupported` (no ARKit world tracking
 * here, e.g. the Simulator: don't offer the feature).
 */
export type CameraAccess = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** The camera functions in DioramaNativeModule.swift. */
type NativeCameraModule = {
  getCameraAccess(): Promise<CameraAccess>;
  requestCameraAccess(): Promise<CameraAccess>;
};

let nativeModule: NativeCameraModule | undefined;

// Loaded on first use, so importing this file never touches native code
// (tests mock these functions instead).
function native(): NativeCameraModule {
  nativeModule ??= requireNativeModule<NativeCameraModule>('DioramaNative');
  return nativeModule;
}

/** Camera access for head position right now. Never shows a prompt. */
export function getCameraAccess(): Promise<CameraAccess> {
  return native().getCameraAccess();
}

/**
 * Shows iOS's camera prompt if it was never answered, then resolves with the
 * access. Head position never asks by itself, so call this where a prompt
 * belongs (upright, before the headset goes on). A view already waiting with
 * `headPosition` on starts tracking as soon as access is granted.
 */
export function requestCameraAccess(): Promise<CameraAccess> {
  return native().requestCameraAccess();
}
