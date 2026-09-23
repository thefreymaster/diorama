import { fireEvent, render, screen } from '@testing-library/react-native';

import * as ui from '..';
import { UIGalleryScreen } from '../dev/UIGalleryScreen';
import { InsetGroupedSection } from '../InsetGroupedSection';
import { ListRow } from '../ListRow';
import { PrimaryButton } from '../PrimaryButton';
import { SkeletonRow } from '../SkeletonRow';

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
