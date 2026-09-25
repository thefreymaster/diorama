import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { requestCameraAccess, type CameraAccess } from '@diorama/native';
import { useSetting } from '@/features/settings/store';

import { cameraKeys, useCameraAccess } from './useCameraAccess';

/** Shows iOS's camera prompt. If that fails, lean stays off, like a "Don't Allow". */
async function askForCamera(): Promise<CameraAccess> {
  try {
    return await requestCameraAccess();
  } catch {
    return 'unsupported';
  }
}

/**
 * Lean to move closer in the Viewer. With the setting on, the first visit
 * asks for the camera (iOS never shows its prompt twice), but only while
 * `mayAsk`: the phone is in the hand, not in the headset. Meanwhile
 * `isAsking` holds the headset countdown, so it starts after the answer.
 * `headPosition` goes to the map: on only with camera access. Declined (or
 * off in iOS Settings), lean quietly stays off and turning your head still
 * works; Settings says camera access is off.
 */
export function useViewerLean(mayAsk: boolean) {
  const enabled = useSetting('headPosition');
  const access = useCameraAccess(enabled);
  const queryClient = useQueryClient();
  const ask = useMutation({
    mutationFn: askForCamera,
    networkMode: 'always',
    // Known at once, here and in Settings, without waiting for the next read.
    onSuccess: (answer) => queryClient.setQueryData<CameraAccess>(cameraKeys.access, answer),
  });
  // Once per visit at most: a failed ask waits for the next one.
  const shouldAsk = enabled && access === 'undetermined' && mayAsk && ask.isIdle;
  const { mutate } = ask;

  useEffect(() => {
    if (shouldAsk) mutate();
  }, [shouldAsk, mutate]);

  return {
    headPosition: enabled && access === 'granted',
    isAsking: ask.isPending,
  };
}
