import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  COUNTDOWN_SECONDS,
  COUNTDOWN_TITLE,
  HUD_NOTICES,
  NOTICE_MIN_MS,
  type HudNotice,
  type HudState,
} from './hud';

/** What's up now, and when (in `Date.now()` ms) it came up and goes. */
type HudSlot = HudState & {
  shownAt: number;
  hideAt: number;
};

/** VoiceOver can't see the HUD (the whole view is one element), so it hears it. */
function announce(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}

function isShowing(hud: HudSlot | null, notice: HudNotice): hud is HudSlot {
  return hud?.visible === true && hud.content.kind === 'notice' && hud.content.notice === notice;
}

/**
 * The Viewer's one HUD slot. The countdown stays up until `hide()`; a notice
 * hides itself after its hold time, and a newer notice restarts the clock.
 * `endNotice` lets a notice go early, once it has been up long enough to
 * read, if it's still the one showing.
 */
export function useViewerHud() {
  const [hud, setHud] = useState<HudSlot | null>(null);

  useEffect(() => {
    if (!hud?.visible || hud.content.kind !== 'notice') return;
    const timer = setTimeout(
      () => setHud({ ...hud, visible: false }),
      Math.max(0, hud.hideAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [hud]);

  const showCountdown = (secondsLeft: number) => {
    if (secondsLeft === COUNTDOWN_SECONDS) announce(COUNTDOWN_TITLE);
    const now = Date.now();
    setHud({
      content: { kind: 'countdown', secondsLeft },
      visible: true,
      shownAt: now,
      hideAt: Number.POSITIVE_INFINITY,
    });
  };

  const showNotice = (notice: HudNotice) => {
    announce(HUD_NOTICES[notice].text);
    const now = Date.now();
    setHud({
      content: { kind: 'notice', notice },
      visible: true,
      shownAt: now,
      hideAt: now + HUD_NOTICES[notice].holdMs,
    });
  };

  const endNotice = (notice: HudNotice) =>
    setHud((current) =>
      isShowing(current, notice)
        ? { ...current, hideAt: Math.min(current.hideAt, current.shownAt + NOTICE_MIN_MS) }
        : current,
    );

  const hide = () => setHud((current) => current && { ...current, visible: false });

  return { hud, showCountdown, showNotice, endNotice, hide };
}
