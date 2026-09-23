import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  COUNTDOWN_SECONDS,
  COUNTDOWN_TITLE,
  HUD_NOTICES,
  type HudNotice,
  type HudState,
} from './hud';

/** VoiceOver can't see the HUD (the whole view is one element), so it hears it. */
function announce(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}

/**
 * The Viewer's one HUD slot. The countdown stays up until `hide()`; a notice
 * hides itself after its hold time, and a newer notice restarts the clock.
 */
export function useViewerHud() {
  const [hud, setHud] = useState<HudState | null>(null);

  useEffect(() => {
    if (!hud?.visible || hud.content.kind !== 'notice') return;
    const timer = setTimeout(
      () => setHud({ ...hud, visible: false }),
      HUD_NOTICES[hud.content.notice].holdMs,
    );
    return () => clearTimeout(timer);
  }, [hud]);

  const showCountdown = (secondsLeft: number) => {
    if (secondsLeft === COUNTDOWN_SECONDS) announce(COUNTDOWN_TITLE);
    setHud({ content: { kind: 'countdown', secondsLeft }, visible: true });
  };

  const showNotice = (notice: HudNotice) => {
    announce(HUD_NOTICES[notice].text);
    setHud({ content: { kind: 'notice', notice }, visible: true });
  };

  const hide = () => setHud((current) => current && { ...current, visible: false });

  return { hud, showCountdown, showNotice, hide };
}
