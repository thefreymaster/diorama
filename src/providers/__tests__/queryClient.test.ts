import { focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

// Registers the app-state focus listener as a side effect.
import '../queryClient';

/** The handler queryClient.ts gave AppState (React Native's Jest mock records it). */
function appStateListener(): (state: AppStateStatus) => void {
  const call = jest
    .mocked(AppState.addEventListener)
    .mock.calls.find(([type]) => type === 'change');
  if (!call) throw new Error('queryClient.ts never listened for app state changes');
  return call[1];
}

describe('queryClient focus', () => {
  it('counts the app as focused only while it is in the foreground', () => {
    const onChange = appStateListener();

    onChange('background');
    expect(focusManager.isFocused()).toBe(false);

    onChange('active');
    expect(focusManager.isFocused()).toBe(true);

    // Control Center and the app switcher leave the app visible but inactive.
    onChange('inactive');
    expect(focusManager.isFocused()).toBe(false);

    onChange('active');
    expect(focusManager.isFocused()).toBe(true);
  });
});
