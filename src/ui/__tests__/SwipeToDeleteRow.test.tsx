import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { getAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { ReactTestInstance } from 'react-test-renderer';

import { InsetGroupedSection } from '../InsetGroupedSection';
import { closeOpenSwipeRow, hasOpenSwipeRow, tapClosesOpenSwipeRow } from '../openSwipeRow';
import { isFullSwipe, SwipeDeleteAction } from '../SwipeDeleteAction';
import { SwipeToDeleteRow } from '../SwipeToDeleteRow';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockImpact = jest.mocked(Haptics.impactAsync);
const mockSelection = jest.mocked(Haptics.selectionAsync);

const ROW = { width: 370, height: 60 };

let systemReduceMotion = false;

beforeEach(() => {
  jest.useFakeTimers();
  systemReduceMotion = false;
  mockImpact.mockClear();
  mockSelection.mockClear();
  closeOpenSwipeRow();
  tapClosesOpenSwipeRow();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(systemReduceMotion));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Renders, lets the Reduce Motion check come back, and lays each row out like iOS would. */
async function renderSettled(element: ReactElement) {
  render(element);
  await act(async () => {});
  for (const row of screen.getAllByTestId('swipe-row')) {
    fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...ROW } } });
  }
  // One frame, so the swipe watchers on the "UI thread" see the row at rest.
  advance(16);
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

function swipeables(): ReactTestInstance[] {
  return screen.UNSAFE_getAllByType(ReanimatedSwipeable);
}

/** The red action under row `index`; it's always there, uncovered by the swipe. */
function deleteAction(index = 0): ReactTestInstance {
  return screen.UNSAFE_getAllByType(SwipeDeleteAction)[index];
}

/** The row VoiceOver reads as a button: its title, then its subtitle. */
function rowButton(title: string): ReactTestInstance {
  return screen.getByRole('button', { name: new RegExp(`^${title}`) });
}

/** VoiceOver: swipe down to "Delete" on the row, then double-tap. */
function voiceOverDelete(title: string) {
  fireEvent(rowButton(title), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
}

/** The red Delete actions, one per row. VoiceOver doesn't see them. */
function deleteButtons(): ReactTestInstance[] {
  return screen.getAllByTestId('swipe-delete-action', { includeHiddenElements: true });
}

/** The swipeable reports that the finger let go and the row is settling open. */
function letGoOpen(index = 0) {
  act(() => swipeables()[index].props.onSwipeableWillOpen(SwipeDirection.LEFT));
}

function rowStyle(index = 0) {
  return getAnimatedStyle(screen.getAllByTestId('swipe-row')[index]) as {
    height?: number;
    opacity?: number;
  };
}

function Rows({ onDelete = () => {}, onPress = () => {} }) {
  return (
    <InsetGroupedSection>
      <SwipeToDeleteRow title="Paris" subtitle="France" onPress={onPress} onDelete={onDelete} />
      <SwipeToDeleteRow title="Rome" subtitle="Italy" onPress={onPress} onDelete={onDelete} />
    </InsetGroupedSection>
  );
}

describe('SwipeToDeleteRow', () => {
  it('is a list row that still opens with a tap', async () => {
    const onPress = jest.fn();
    await renderSettled(<Rows onPress={onPress} />);

    fireEvent.press(screen.getByText('Paris'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(rowButton('Paris')).toBeOnTheScreen();
  });

  it('offers VoiceOver a Delete action, and keeps the red button out of its way', async () => {
    await renderSettled(<Rows />);

    const row = rowButton('Paris');
    expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete' }]);
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.getAllByText('Delete', { includeHiddenElements: true })).toHaveLength(2);
  });

  it('deletes from VoiceOver with a light tap, once the row has closed up', async () => {
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);

    voiceOverDelete('Paris');

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onDelete).not.toHaveBeenCalled();
    advance(100);
    // Sliding out and closing up, not gone yet.
    expect(rowStyle().height).toBeGreaterThan(0);
    expect(rowStyle().height).toBeLessThanOrEqual(ROW.height);
    advance(1000);
    expect(rowStyle().height).toBeCloseTo(0, 0);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes from the red Delete action', async () => {
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);

    fireEvent.press(deleteButtons()[1]);
    advance(1000);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it('deletes only once, however it is asked', async () => {
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);

    voiceOverDelete('Paris');
    fireEvent.press(deleteButtons()[0]);
    voiceOverDelete('Paris');
    advance(1000);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it('deletes on a full swipe: a tick at the line, then gone on release', async () => {
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);
    const translation = deleteAction().props.translation as SharedValue<number>;

    // The finger drags the row most of the way across.
    act(() => translation.set(-300));
    advance(16);
    expect(mockSelection).toHaveBeenCalledTimes(1);

    letGoOpen();
    advance(1000);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('only opens when let go short of a full swipe, or after backing off', async () => {
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);
    const translation = deleteAction().props.translation as SharedValue<number>;

    act(() => translation.set(-100));
    advance(16);
    letGoOpen();
    advance(1000);
    expect(onDelete).not.toHaveBeenCalled();
    expect(hasOpenSwipeRow()).toBe(true);

    act(() => translation.set(-300));
    advance(16);
    act(() => translation.set(-120));
    advance(16);
    letGoOpen();
    advance(1000);
    expect(onDelete).not.toHaveBeenCalled();
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  it('keeps one row open at a time; a tap elsewhere only closes it', async () => {
    const onPress = jest.fn();
    await renderSettled(<Rows onPress={onPress} />);

    letGoOpen(0);
    expect(hasOpenSwipeRow()).toBe(true);

    // Starting to swipe Rome closes Paris.
    act(() => swipeables()[1].props.onSwipeableOpenStartDrag(SwipeDirection.LEFT));
    act(() => swipeables()[1].props.onSwipeableWillClose(SwipeDirection.RIGHT));
    expect(hasOpenSwipeRow()).toBe(false);

    // With Paris open, tapping Rome closes Paris and opens nothing.
    letGoOpen(0);
    fireEvent.press(screen.getByText('Rome'));
    expect(onPress).not.toHaveBeenCalled();
    expect(hasOpenSwipeRow()).toBe(false);

    fireEvent.press(screen.getByText('Rome'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fades out under Reduce Motion instead of sliding and closing up', async () => {
    systemReduceMotion = true;
    const onDelete = jest.fn();
    await renderSettled(<Rows onDelete={onDelete} />);

    voiceOverDelete('Rome');
    advance(100);

    const style = rowStyle(1);
    expect(style.height).toBeUndefined();
    expect(style.opacity).toBeGreaterThan(0);
    expect(style.opacity).toBeLessThan(1);
    advance(1000);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('isFullSwipe', () => {
  it('needs more than half the row, and always well past the open action', () => {
    expect(isFullSwipe(150, 370, 76)).toBe(false);
    expect(isFullSwipe(210, 370, 76)).toBe(true);
    // A narrow row still needs a real swipe past the button.
    expect(isFullSwipe(110, 160, 76)).toBe(false);
    expect(isFullSwipe(130, 160, 76)).toBe(true);
    // Before layout there is no row to measure against.
    expect(isFullSwipe(500, 0, 76)).toBe(false);
  });
});
