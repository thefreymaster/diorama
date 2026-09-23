import { InsetGroupedSection } from '../InsetGroupedSection';
import { ListRow } from '../ListRow';
import { PrimaryButton } from '../PrimaryButton';
import { Screen } from '../Screen';
import { SkeletonRow } from '../SkeletonRow';
import { DemoBlock } from './DemoBlock';
import { GlassDemo } from './GlassDemo';
import { noop, sampleFeatured, sampleRecents } from './sampleData';
import { SymbolsCard } from './SymbolsCard';
import { TypeRampCard } from './TypeRampCard';

/** Dev-only gallery of every UI primitive, for light/dark screenshot checks. */
export function UIGalleryScreen() {
  return (
    <Screen background="grouped">
      <InsetGroupedSection title="Featured" footer="Cities with 3D buildings in Apple Maps.">
        {sampleFeatured.map((city) => (
          <ListRow
            key={city.id}
            title={city.name}
            subtitle={city.country}
            symbol={city.symbol}
            symbolTile={city.tile}
            onPress={noop}
          />
        ))}
      </InsetGroupedSection>

      <InsetGroupedSection title="Recent">
        {sampleRecents.map((city) => (
          <ListRow
            key={city.id}
            title={city.name}
            subtitle={city.region}
            symbol="clock.fill"
            onPress={noop}
          />
        ))}
      </InsetGroupedSection>

      <InsetGroupedSection title="Searching">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow icon={false} subtitle={false} />
      </InsetGroupedSection>

      <InsetGroupedSection
        title="Viewer"
        footer="Values on their own, or with a chevron when the row opens more."
      >
        <ListRow title="Model size" value="1.0×" symbol="cube.fill" symbolTile="systemOrange" />
        <ListRow title="Tracking" value="Normal" symbol="gyroscope" symbolTile="systemPink" />
        <ListRow title="Mode" value="Stereo" symbol="eyeglasses" symbolTile="systemPurple" />
        <ListRow
          title="Headset"
          value="Cardboard"
          symbol="visionpro"
          symbolTile="systemGray"
          onPress={noop}
        />
      </InsetGroupedSection>

      <DemoBlock title="Buttons">
        <PrimaryButton title="Enter Diorama" symbol="visionpro" onPress={noop} />
        <PrimaryButton title="Enter Diorama" onPress={noop} loading />
        <PrimaryButton title="Enter Diorama" onPress={noop} disabled />
      </DemoBlock>

      <DemoBlock title="Glass">
        <GlassDemo />
      </DemoBlock>

      <InsetGroupedSection title="Symbols">
        <SymbolsCard />
      </InsetGroupedSection>

      <InsetGroupedSection title="Type" footer="Each style scales with the user's text size.">
        <TypeRampCard />
      </InsetGroupedSection>
    </Screen>
  );
}
