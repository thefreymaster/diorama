import Animated from 'react-native-reanimated';

import type { HudState } from '@/features/viewer/hud';

import { CountdownHud } from './CountdownHud';
import { HudGlass } from './HudGlass';
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
 * so they always match. The glass is there (dissolved) from the start, so
 * it can materialize the first time too.
 */
export function ViewerHud({ hud, perEye }: ViewerHudProps) {
  const fade = useHudFade(hud?.visible ?? false);
  const content = hud?.content;

  return (
    <PerEye perEye={perEye}>
      <Animated.View testID="viewer-hud" style={fade.containerStyle}>
        <HudGlass kind={content?.kind ?? 'notice'} visible={fade.glassVisible}>
          <Animated.View testID="viewer-hud-content" style={fade.contentStyle}>
            {content?.kind === 'countdown' ? (
              <CountdownHud secondsLeft={content.secondsLeft} />
            ) : content ? (
              <NoticeHud notice={content.notice} />
            ) : null}
          </Animated.View>
        </HudGlass>
      </Animated.View>
    </PerEye>
  );
}
