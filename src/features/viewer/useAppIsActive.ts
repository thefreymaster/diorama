import { useEffect, useEffectEvent, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** In front and taking input. `unknown` (before the first report) counts as active. */
function isActiveState(state: AppStateStatus): boolean {
  return state !== 'background' && state !== 'inactive';
}

/**
 * True while the app is in front: not in the background, and not covered by
 * Control Center, the app switcher or a call. `onReturn` runs each time it
 * comes back.
 */
export function useAppIsActive(onReturn?: () => void): boolean {
  const [isActive, setActive] = useState(() => isActiveState(AppState.currentState));
  const handleReturn = useEffectEvent(() => onReturn?.());

  useEffect(() => {
    let wasActive = isActiveState(AppState.currentState);
    const subscription = AppState.addEventListener('change', (state) => {
      const active = isActiveState(state);
      setActive(active);
      if (active && !wasActive) handleReturn();
      wasActive = active;
    });
    return () => subscription.remove();
  }, []);

  return isActive;
}
