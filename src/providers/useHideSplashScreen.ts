import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

/**
 * Lifts the launch screen one frame after the first screen commits, so the
 * app is already drawn underneath (the same moment expo-router picks).
 *
 * expo-router hides it too, but through an async native call, and Expo runs
 * the async native calls of every module one at a time on one shared queue.
 * Anything slow ahead of it there holds the splash up: the picker reads
 * location access at launch, and Core Location can take minutes to answer
 * (the iOS 26.5 Simulator's location service hangs after a boot), so the app
 * sat on its splash with the picker drawn behind it (T48). `hide()` is a
 * synchronous native call, so it never waits behind anything. Hiding twice
 * does nothing.
 */
export function useHideSplashScreen(): void {
  useEffect(() => {
    const frame = requestAnimationFrame(() => SplashScreen.hide());
    return () => cancelAnimationFrame(frame);
  }, []);
}
