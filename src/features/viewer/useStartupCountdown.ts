import { useEffect, useEffectEvent, useState } from 'react';

import { COUNTDOWN_SECONDS } from './hud';

const ONE_SECOND = 1000;

type CountdownPhase = 'waiting' | 'counting' | 'done';

type CountdownHandlers = {
  /** 3, then 2, then 1: once a second, starting with `start()`. */
  onTick: (secondsLeft: number) => void;
  /** A second after 1. */
  onDone: () => void;
};

/**
 * "Put on your viewer" 3, 2, 1. `start()` begins it once the city has drawn
 * (so it never counts over the black loading cover); it only ever runs once.
 */
export function useStartupCountdown({ onTick, onDone }: CountdownHandlers) {
  const [phase, setPhase] = useState<CountdownPhase>('waiting');
  const tick = useEffectEvent(onTick);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    if (phase !== 'counting') return;
    let secondsLeft = COUNTDOWN_SECONDS;
    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        tick(secondsLeft);
        return;
      }
      clearInterval(timer);
      setPhase('done');
      finish();
    }, ONE_SECOND);
    return () => clearInterval(timer);
  }, [phase]);

  const start = () => {
    if (phase !== 'waiting') return;
    setPhase('counting');
    onTick(COUNTDOWN_SECONDS);
  };

  return {
    start,
    /** The countdown has finished: the wearer is in the diorama. */
    isDone: phase === 'done',
  };
}
