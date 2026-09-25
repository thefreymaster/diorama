import { formatDistance } from '@/features/viewpoints/formatDistance';
import { VIEWPOINT_KINDS } from '@/features/viewpoints/kinds';
import type { Viewpoint } from '@/features/viewpoints/viewpoints';
import { ListRow } from '@/ui';

type ViewpointRowProps = {
  viewpoint: Viewpoint;
  onPress: () => void;
};

/** One viewpoint: its name, its kind (with the kind's glyph) and how far it is. */
export function ViewpointRow({ viewpoint, onPress }: ViewpointRowProps) {
  const kind = VIEWPOINT_KINDS[viewpoint.category];

  return (
    <ListRow
      title={viewpoint.name}
      subtitle={kind.label}
      symbol={kind.symbol}
      symbolTile={kind.tileColor}
      value={formatDistance(viewpoint.distance)}
      onPress={onPress}
      accessibilityHint="Opens a preview of this place."
    />
  );
}
