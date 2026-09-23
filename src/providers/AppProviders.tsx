import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { NavigationThemeProvider } from './NavigationThemeProvider';
import { queryClient } from './queryClient';

type Props = { children: ReactNode };

/** App-wide context: gestures, the query cache and the navigation theme. Wraps the root Stack. */
export function AppProviders({ children }: Props) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <NavigationThemeProvider>{children}</NavigationThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
