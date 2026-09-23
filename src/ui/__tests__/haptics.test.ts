import * as Haptics from 'expo-haptics';

import { actionHaptic, exitHaptic, selectionHaptic } from '../haptics';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual<object>('expo-haptics'),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const mockSelection = jest.mocked(Haptics.selectionAsync);
const mockImpact = jest.mocked(Haptics.impactAsync);

beforeEach(() => {
  mockSelection.mockClear();
  mockImpact.mockClear();
});

describe('haptics', () => {
  it('ticks for picking from a list', () => {
    selectionHaptic();

    expect(mockSelection).toHaveBeenCalledTimes(1);
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('taps lightly for an action', () => {
    actionHaptic();

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('taps firmer for leaving the diorama', () => {
    exitHaptic();

    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });
});
