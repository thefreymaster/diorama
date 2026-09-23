import { useEffect, useState } from 'react';

/** How long the exit button stays up after a tap in mono. */
export const EXIT_BUTTON_SHOWN_MS = 3000;

/**
 * Whether the Viewer's exit button is up. In stereo it always is: it sits
 * in the black margin around the eye windows, out of sight through the
 * lenses. In mono the city fills the screen, so the button stays out of the
 * way until the screen is tapped, then hides 3 s later.
 */
export function useExitButton(stereo: boolean) {
  // A fresh object per tap, so every tap restarts the 3 s.
  const [tapped, setTapped] = useState({ shown: false });

  useEffect(() => {
    if (!tapped.shown) return;
    const timer = setTimeout(() => setTapped({ shown: false }), EXIT_BUTTON_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [tapped]);

  return {
    visible: stereo || tapped.shown,
    /** The screen was tapped: show the button for 3 s (or 3 s more). */
    reveal: () => setTapped({ shown: true }),
  };
}
