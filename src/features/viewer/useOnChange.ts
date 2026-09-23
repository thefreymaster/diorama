import { useEffect, useEffectEvent, useRef } from 'react';

/**
 * Runs `onChange(value)` after a render in which `value` changed: not on
 * mount, only on each change after it. Like a `useEffect` on `[value]` that
 * skips the first run, and always calls the latest `onChange`.
 */
export function useOnChange<T>(value: T, onChange: (value: T) => void) {
  const handleChange = useEffectEvent(onChange);
  const previous = useRef(value);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    handleChange(value);
  }, [value]);
}
