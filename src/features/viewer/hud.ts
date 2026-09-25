import type { SFSymbol } from 'expo-symbols';

/** Seconds of "Put on your viewer" before the view recenters and follows your head. */
export const COUNTDOWN_SECONDS = 3;

export const COUNTDOWN_TITLE = 'Put on your viewer';

/** Under the countdown: the one exit that works once the viewer is on. */
export const COUNTDOWN_HINT = 'Hold anywhere to exit';

/**
 * A short message that fades in over the view, then fades out on its own.
 * The lean hints follow the camera tracking (see `useLeanHints`):
 * `leanStarting` while it gets its bearings, `leanLimited` when it has lost
 * its place for a while.
 */
export type HudNotice = 'recentered' | 'cooling' | 'leanStarting' | 'leanLimited';

type NoticeCopy = {
  text: string;
  symbol: SFSymbol;
  /** How long it stays up at most before fading out. */
  holdMs: number;
};

export const HUD_NOTICES: Readonly<Record<HudNotice, NoticeCopy>> = {
  recentered: { text: 'Recentered', symbol: 'scope', holdMs: 1200 },
  cooling: { text: 'Switched to one view to cool down', symbol: 'thermometer.high', holdMs: 3000 },
  leanStarting: { text: 'Look around the room to start', symbol: 'viewfinder', holdMs: 5000 },
  leanLimited: {
    text: 'Hold still, finding your place',
    symbol: 'location.viewfinder',
    holdMs: 4000,
  },
};

/**
 * A notice let go early (`endNotice`, say the tracking it spoke of has
 * started) still stays up this long, so it never just flickers.
 */
export const NOTICE_MIN_MS = 1500;

/** What the HUD shows: the startup countdown, or a notice. */
export type HudContent =
  { kind: 'countdown'; secondsLeft: number } | { kind: 'notice'; notice: HudNotice };

/**
 * The HUD's last content, and whether it's up. Content stays after it's
 * hidden, so the HUD can fade out with it rather than go blank first.
 */
export type HudState = {
  content: HudContent;
  visible: boolean;
};
