import {
  act,
  fireEvent,
  isHiddenFromAccessibility,
  render,
  screen,
} from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import { Dimensions, ScrollView, Text as NativeText } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { colors } from '@/theme';

import * as ui from '..';
import { UIGalleryScreen } from '../dev/UIGalleryScreen';
import { GlassButton } from '../GlassButton';
import { InsetGroupedSection } from '../InsetGroupedSection';
import { ListRow } from '../ListRow';
import { PrimaryButton } from '../PrimaryButton';
import { RowPositionContext, useRowPosition } from '../rowPosition';
import { RowSeparator } from '../RowSeparator';
import { Screen } from '../Screen';
import { SkeletonRow } from '../SkeletonRow';
import { SymbolIcon } from '../SymbolIcon';
import { ToggleRow } from '../ToggleRow';

/** Shows what its section told it about its position. */
function PositionProbe({ label }: { label: string }) {
  const { isFirst } = useRowPosition();
  return <NativeText>{`${label}: ${isFirst ? 'first' : 'after another row'}`}</NativeText>;
}

describe('ListRow', () => {
  it('is a button when tappable and calls onPress', () => {
    const onPress = jest.fn();
    render(
      <ListRow title="Paris" subtitle="France" symbol="building.columns.fill" onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('France')).toBeOnTheScreen();
  });

  it('is not a button without onPress', () => {
    render(<ListRow title="Model size" value="1.0×" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1.0×')).toBeOnTheScreen();
  });

  it('reads as one button, title and subtitle together, with its icons hidden', () => {
    render(
      <ListRow
        title="Paris"
        subtitle="France"
        symbol="building.columns.fill"
        onPress={() => {}}
        accessibilityHint="Shows a preview."
      />,
    );

    // One element for the whole row: VoiceOver reads its texts together.
    const row = screen.getByRole('button');
    expect(row).toHaveTextContent(/Paris.*France/);
    expect(row.props.accessibilityHint).toBe('Shows a preview.');
    for (const symbol of screen.UNSAFE_getAllByType(SymbolView)) {
      expect(isHiddenFromAccessibility(symbol)).toBe(true);
    }
  });

  it('puts a value under the title at accessibility text sizes, not beside it', () => {
    /** The nearest native view around some text: the row's text column, or the row. */
    const column = (text: string) => {
      let node: ReactTestInstance | null = screen.getByText(text).parent;
      while (node && String(node.type) !== 'View') node = node.parent;
      return node;
    };
    const setFontScale = (fontScale: number) =>
      act(() =>
        Dimensions.set({
          window: { ...Dimensions.get('window'), fontScale },
          screen: Dimensions.get('screen'),
        }),
      );

    const { fontScale } = Dimensions.get('window');
    try {
      setFontScale(1); // Large, the default
      render(<ListRow title="Headset" value="Cardboard" />);
      expect(column('Cardboard')).not.toBe(column('Headset'));

      setFontScale(53 / 17); // AX5
      expect(column('Cardboard')).toBe(column('Headset'));
    } finally {
      setFontScale(fontScale);
    }
  });

  it('draws a destructive action in red, without a chevron', () => {
    render(<ListRow title="Reset to defaults" destructive chevron={false} onPress={() => {}} />);

    expect(screen.getByText('Reset to defaults')).toHaveStyle({ color: colors.systemRed });
    expect(screen.UNSAFE_queryByType(SymbolView)).toBeNull();
  });
});

describe('ToggleRow', () => {
  it('reads as one switch that VoiceOver can flip from anywhere on the row', () => {
    const onValueChange = jest.fn();
    render(
      <InsetGroupedSection>
        <ToggleRow title="Stereo" value onValueChange={onValueChange} testID="stereo" />
      </InsetGroupedSection>,
    );

    const row = screen.getByRole('switch', { name: 'Stereo' });
    expect(row).toBeChecked();
    // The row is the accessible element, so iOS folds the UISwitch into it.
    expect(row).toContainElement(screen.getByTestId('stereo'));

    fireEvent(row, 'accessibilityTap');
    expect(onValueChange).toHaveBeenCalledWith(false);

    fireEvent(screen.getByTestId('stereo'), 'valueChange', false);
    expect(onValueChange).toHaveBeenLastCalledWith(false);
  });
});

describe('InsetGroupedSection', () => {
  it('shows its header and footer and every row', () => {
    render(
      <InsetGroupedSection title="Featured" footer="Cities with 3D buildings.">
        <ListRow title="Paris" />
        <ListRow title="Rome" />
        <SkeletonRow />
      </InsetGroupedSection>,
    );

    expect(screen.getByRole('header')).toHaveTextContent('Featured');
    expect(screen.getByText('Cities with 3D buildings.')).toBeOnTheScreen();
    expect(screen.getByText('Paris')).toBeOnTheScreen();
    expect(screen.getByText('Rome')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });
});

describe('row separators', () => {
  it('tells only the first visible row it is first, skipping rows left out with null', () => {
    const showHidden = false as boolean;
    render(
      <InsetGroupedSection>
        {showHidden ? <PositionProbe label="Hidden" /> : null}
        <PositionProbe label="Paris" />
        <PositionProbe label="Rome" />
        <PositionProbe label="Tokyo" />
      </InsetGroupedSection>,
    );

    expect(screen.getByText('Paris: first')).toBeOnTheScreen();
    expect(screen.getByText('Rome: after another row')).toBeOnTheScreen();
    expect(screen.getByText('Tokyo: after another row')).toBeOnTheScreen();
  });

  it('draws a line above a row only when another row sits above it', () => {
    const first = render(<RowSeparator />);
    expect(first.toJSON()).toBeNull();

    const later = render(
      <RowPositionContext value={{ isFirst: false }}>
        <RowSeparator />
      </RowPositionContext>,
    );
    expect(later.toJSON()).not.toBeNull();
  });

  it('leaves out the header and footer when there are none', () => {
    render(
      <InsetGroupedSection>
        <ListRow title="Paris" />
      </InsetGroupedSection>,
    );

    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.getByText('Paris')).toBeOnTheScreen();
  });
});

describe('SymbolIcon', () => {
  it('hides decorative symbols from VoiceOver and names meaningful ones', () => {
    render(
      <>
        <SymbolIcon name="chevron.right" />
        <SymbolIcon name="location.fill" accessibilityLabel="Current location" />
      </>,
    );

    const [decorative, meaningful] = screen.UNSAFE_getAllByType(SymbolView);
    expect(isHiddenFromAccessibility(decorative!)).toBe(true);
    expect(isHiddenFromAccessibility(meaningful!)).toBe(false);
    expect(screen.getByRole('image', { name: 'Current location' })).toBeOnTheScreen();
  });
});

describe('GlassButton', () => {
  it('names a symbol-only button with its accessibility label', () => {
    const onPress = jest.fn();
    render(<GlassButton symbol="xmark" accessibilityLabel="Close" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('names a labelled button with its title', () => {
    render(<GlassButton title="Recenter" symbol="scope" onPress={() => {}} />);

    expect(screen.getByRole('button', { name: 'Recenter' })).toBeOnTheScreen();
  });
});

describe('Screen', () => {
  // Automatic insets let the native header collapse its large title on scroll.
  it('scrolls under the header by default', () => {
    render(
      <Screen>
        <NativeText>Content</NativeText>
      </Screen>,
    );

    expect(screen.UNSAFE_getByType(ScrollView).props).toMatchObject({
      contentInsetAdjustmentBehavior: 'automatic',
    });
  });

  it('does not scroll for full-bleed screens', () => {
    render(
      <Screen scroll={false}>
        <NativeText>Map</NativeText>
      </Screen>,
    );

    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(screen.getByText('Map')).toBeOnTheScreen();
  });
});

describe('PrimaryButton', () => {
  it('ignores taps while disabled or loading', () => {
    const onPress = jest.fn();
    const { rerender } = render(<PrimaryButton title="Enter Diorama" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button'));

    rerender(<PrimaryButton title="Enter Diorama" onPress={onPress} loading />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();

    rerender(<PrimaryButton title="Enter Diorama" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('UI gallery', () => {
  it('renders every primitive', () => {
    render(<UIGalleryScreen />);

    expect(screen.getByText('New York')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Loading')).toHaveLength(3);
    expect(screen.getByLabelText('Recenter')).toBeOnTheScreen();
    expect(screen.getByLabelText('Close')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Stereo' })).toBeChecked();
    expect(screen.getByText('Reset to defaults')).toBeOnTheScreen();
    expect(screen.getByText('Large title')).toBeOnTheScreen();
  });
});

describe('ui exports', () => {
  // The React Compiler emits `Symbol.for(...)`. An imported component named
  // `Symbol` shadows the global and crashes every component that uses it.
  it('never shadows a JS built-in like Symbol', () => {
    const exported = Object.keys(ui);
    for (const globalName of ['Symbol', 'Object', 'Array', 'Map', 'Set', 'Promise', 'Error']) {
      expect(exported).not.toContain(globalName);
    }
  });
});
