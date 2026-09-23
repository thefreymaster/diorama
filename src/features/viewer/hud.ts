import type { SFSymbol } from 'expo-symbols';

/** Seconds of "Put on your viewer" before the view recenters and follows your head. */
export const COUNTDOWN_SECONDS = 3;

export const COUNTDOWN_TITLE = 'Put on your viewer';

/** Under the countdown: the one exit that works once the viewer is on. */
export const COUNTDOWN_HINT = 'Hold anywhere to exit';

/** A short message that fades in over the view, then fades out on its own. */
export type HudNotice = 'recentered' | 'cooling';

type NoticeCopy = {
  text: string;
  symbol: SFSymbol;
  /** How long it stays up before fading out. */
  holdMs: number;
};

export const HUD_NOTICES: Readonly<Record<HudNotice, NoticeCopy>> = {
  recentered: { text: 'Recentered', symbol: 'scope', holdMs: 1200 },
  cooling: { text: 'Switched to one view to cool down', symbol: 'thermometer.high', holdMs: 3000 },
};

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
