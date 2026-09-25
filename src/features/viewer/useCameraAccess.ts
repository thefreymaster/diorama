import { useQuery } from '@tanstack/react-query';

import { getCameraAccess, type CameraAccess } from '@diorama/native';

/** Query keys, so the hooks and their cache updates agree on them. */
export const cameraKeys = {
  access: ['camera', 'access'] as const,
};

/**
 * Whether lean to move closer may use the camera, read without asking
 * (never the prompt). A build without the native side counts as no camera,
 * so lean just stays off.
 */
export async function readCameraAccess(): Promise<CameraAccess> {
  try {
    return await getCameraAccess();
  } catch {
    return 'unsupported';
  }
}

/**
 * Camera access for lean to move closer: on mount and each time the app
 * comes back, so turning it on in iOS Settings shows up on return.
 * `undefined` until first read. With `enabled` false it doesn't read, only
 * reports what was last read.
 */
export function useCameraAccess(enabled = true): CameraAccess | undefined {
  const access = useQuery({
    queryKey: cameraKeys.access,
    queryFn: readCameraAccess,
    enabled,
    // On the device: no connection needed, and cheap to read again.
    networkMode: 'always',
    // Refetches whenever the app returns to the front (see `queryClient`).
    staleTime: 0,
    retry: false,
  });
  return access.data;
}
