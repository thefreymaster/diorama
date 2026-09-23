import Animated from 'react-native-reanimated';

import type { HudState } from '@/features/viewer/hud';

import { CountdownHud } from './CountdownHud';
import { NoticeHud } from './NoticeHud';
import { PerEye } from './PerEye';
import { useHudFade } from './useHudFade';

type ViewerHudProps = {
  /** What to show, or `null` before anything has been shown. */
  hud: HudState | null;
  /** Stereo: one copy per eye. */
  perEye: boolean;
};

/**
 * The only thing drawn over the city: the startup countdown or a short
 * notice, springing in and back out. Both eye copies share one animation,
 * so they always match.
 */
export function ViewerHud({ hud, perEye }: ViewerHudProps) {
  const fadeStyle = useHudFade(hud?.visible ?? false);

  if (!hud) return null;
  const { content } = hud;

  return (
    <PerEye perEye={perEye}>
      <Animated.View testID="viewer-hud" style={fadeStyle}>
        {content.kind === 'countdown' ? (
          <CountdownHud secondsLeft={content.secondsLeft} />
        ) : (
          <NoticeHud notice={content.notice} />
        )}
      </Animated.View>
    </PerEye>
  );
}
