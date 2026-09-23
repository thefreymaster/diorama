import type { RefObject } from 'react';
import { useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

/**
 * A ref for the header search bar that types `initialText` into it once,
 * for links like diorama://?q=par.
 *
 * The native bar mounts with the header, a render after the screen, so an
 * effect in the screen would run before it exists. React fills in
 * `ref.current` the moment the bar is ready, so this ref does its one job
 * right there, in the `current` setter.
 */
export function useSeededSearchBarRef(initialText: string): RefObject<SearchBarCommands | null> {
  const [ref] = useState(() => {
    let commands: SearchBarCommands | null = null;
    let pendingText = initialText;

    return {
      get current() {
        return commands;
      },
      set current(next: SearchBarCommands | null) {
        commands = next;
        if (next && pendingText !== '') {
          next.setText(pendingText);
          pendingText = '';
        }
      },
    };
  });

  return ref;
}
