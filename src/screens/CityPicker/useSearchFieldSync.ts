import { useEffect, useRef, type RefObject } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

/**
 * Keeps the header search field showing `?q=` when a link changes it while
 * the picker is open (diorama://?q=rome over diorama://?q=par). Typing
 * changes `q` too, a moment later and maybe behind newer keystrokes, so
 * call the returned `noteTyped` with every typed text: those values are
 * never written back into the field, where they would jump the cursor or
 * break a half-typed accent.
 */
export function useSearchFieldSync(ref: RefObject<SearchBarCommands | null>, query: string) {
  const typed = useRef<string[]>([]);

  useEffect(() => {
    const index = typed.current.indexOf(query);
    if (index >= 0) {
      // It came from typing; so did anything typed before it.
      typed.current.splice(0, index + 1);
      return;
    }
    ref.current?.setText(query);
  }, [ref, query]);

  return function noteTyped(text: string) {
    typed.current.push(text);
  };
}
