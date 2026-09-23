import { act, render, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { useReduceMotion } from '../useReduceMotion';

/** What iOS answers when asked for the setting. */
let systemAnswer: Promise<boolean>;
/** iOS's "Reduce Motion changed" callbacks. */
let listeners: ((enabled: boolean) => void)[];
const removeListener = jest.fn();

beforeEach(() => {
  systemAnswer = Promise.resolve(false);
  listeners = [];
  removeListener.mockClear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => systemAnswer);
  const addEventListener = (event: string, listener: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') listeners.push(listener);
    return { remove: removeListener };
  };
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The user flips the switch in Settings > Accessibility > Motion. */
function flip(enabled: boolean) {
  act(() => listeners.forEach((listener) => listener(enabled)));
}

/** Lets iOS's answer to "is it on?" arrive. */
async function settle() {
  await act(async () => {});
}

/** Every value each probe rendered with, so a test can see its very first one. */
let renders: Record<string, boolean[]> = {};

function Probe({ name }: { name: string }) {
  const reduceMotion = useReduceMotion();
  (renders[name] ??= []).push(reduceMotion);
  return <Text>{name}</Text>;
}

function Probes({ names }: { names: string[] }) {
  return names.map((name) => <Probe key={name} name={name} />);
}

describe('useReduceMotion', () => {
  it('starts from what iOS reports', async () => {
    systemAnswer = Promise.resolve(true);
    const { result } = renderHook(() => useReduceMotion());

    await settle();

    expect(result.current).toBe(true);
  });

  it('follows the setting while the app runs', async () => {
    const { result } = renderHook(() => useReduceMotion());
    await settle();
    expect(result.current).toBe(false);

    flip(true);
    expect(result.current).toBe(true);

    flip(false);
    expect(result.current).toBe(false);
  });

  it('listens to iOS once, and a newly shown component starts from the current value', async () => {
    renders = {};
    const { rerender } = render(<Probes names={['first']} />);
    await settle();
    flip(true);

    rerender(<Probes names={['first', 'second']} />);

    expect(renders.first?.at(-1)).toBe(true);
    // Never a frame with the stale value: no flash of motion.
    expect(renders.second).toEqual([true]);
    expect(listeners).toHaveLength(1);
  });

  it('keeps a change made while it was still asking iOS', async () => {
    let answer: (enabled: boolean) => void = () => {};
    systemAnswer = new Promise((resolve) => (answer = resolve));
    const { result } = renderHook(() => useReduceMotion());

    flip(true);
    await act(async () => answer(false));

    expect(result.current).toBe(true);
  });

  it('stops listening when nothing on screen uses it', async () => {
    const { unmount } = renderHook(() => useReduceMotion());
    await settle();

    unmount();

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
