import { useEffect, useEffectEvent } from 'react';

import { COUNTDOWN_SECONDS } from './hud';

const ONE_SECOND = 1000;

type CountdownHandlers = {
  /** 3 as it starts, then 2, then 1, a second apart. */
  onTick: (secondsLeft: number) => void;
  /** A second after 1. */
  onDone: () => void;
};

/**
 * "Put on your viewer" 3, 2, 1, while `running`. Each time `running` turns
 * true it counts from the top; if it turns false first, the count just
 * stops (the phone came out of the headset), and `onDone` never comes.
 */
export function useHeadsetCountdown(running: boolean, { onTick, onDone }: CountdownHandlers) {
  const tick = useEffectEvent(onTick);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    if (!running) return;
    let secondsLeft = COUNTDOWN_SECONDS;
    tick(secondsLeft);
    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        tick(secondsLeft);
        return;
      }
      clearInterval(timer);
      finish();
    }, ONE_SECOND);
    return () => clearInterval(timer);
  }, [running]);
}
