import {
  closeOpenSwipeRow,
  hasOpenSwipeRow,
  screenTouched,
  swipeRowDidClose,
  swipeRowTouched,
  swipeRowWillOpen,
  tapClosesOpenSwipeRow,
} from '../openSwipeRow';

beforeEach(() => {
  closeOpenSwipeRow();
  // Forget any tap left over from a previous test.
  tapClosesOpenSwipeRow();
});

describe('the open swipe row', () => {
  it('is one row at a time: opening another closes the first', () => {
    const closeA = jest.fn();
    const closeB = jest.fn();

    swipeRowWillOpen('a', closeA);
    swipeRowWillOpen('b', closeB);

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
    expect(hasOpenSwipeRow()).toBe(true);
  });

  it('does not close a row that opens again (dragged further, then let go)', () => {
    const close = jest.fn();

    swipeRowWillOpen('a', close);
    swipeRowWillOpen('a', close);

    expect(close).not.toHaveBeenCalled();
  });

  it('forgets a row that closes, and only that row', () => {
    swipeRowWillOpen('a', jest.fn());

    swipeRowDidClose('b');
    expect(hasOpenSwipeRow()).toBe(true);

    swipeRowDidClose('a');
    expect(hasOpenSwipeRow()).toBe(false);
  });

  it('closes on scroll', () => {
    const close = jest.fn();
    swipeRowWillOpen('a', close);

    expect(closeOpenSwipeRow()).toBe(true);

    expect(close).toHaveBeenCalledTimes(1);
    expect(hasOpenSwipeRow()).toBe(false);
    expect(closeOpenSwipeRow()).toBe(false);
  });

  it('closes when anything else is touched, and that tap does nothing else', () => {
    const close = jest.fn();
    swipeRowWillOpen('a', close);

    // A touch on another row: the row hears of it first, then the screen.
    swipeRowTouched('b');
    screenTouched();

    expect(close).toHaveBeenCalledTimes(1);
    expect(tapClosesOpenSwipeRow()).toBe(true);
    // The next tap is an ordinary one.
    swipeRowTouched('b');
    screenTouched();
    expect(tapClosesOpenSwipeRow()).toBe(false);
  });

  it('stays open when the touch is on the open row itself (its Delete action)', () => {
    const close = jest.fn();
    swipeRowWillOpen('a', close);

    swipeRowTouched('a');
    screenTouched();

    expect(close).not.toHaveBeenCalled();
    expect(hasOpenSwipeRow()).toBe(true);
  });

  it('closes on a touch outside any row', () => {
    const close = jest.fn();
    swipeRowWillOpen('a', close);

    screenTouched();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('lets a tap through when no row is open', () => {
    swipeRowTouched('b');
    screenTouched();

    expect(tapClosesOpenSwipeRow()).toBe(false);
  });

  it('closes on a tap that never reached the screen, and swallows it', () => {
    const close = jest.fn();
    swipeRowWillOpen('a', close);

    expect(tapClosesOpenSwipeRow()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(tapClosesOpenSwipeRow()).toBe(false);
  });
});
