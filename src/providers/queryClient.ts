import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

/** Shared cache for every async and native call (search, city lookups). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

// React Native has no window focus. Treat "app came to the foreground" as focus,
// so stale queries refresh when the user returns to the app.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => {
    setFocused(state === 'active');
  });
  return () => subscription.remove();
});
