import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { colors } from '@/theme';

// System colors resolve light/dark natively, so both themes share them.
// Without this, native stack headers stay white in dark mode.
const navigationColors: Theme['colors'] = {
  primary: colors.tint,
  background: colors.systemGroupedBackground,
  card: colors.systemGroupedBackground,
  text: colors.label,
  border: colors.separator,
  notification: colors.systemRed,
};

const lightTheme: Theme = { ...DefaultTheme, colors: navigationColors };
const darkTheme: Theme = { ...DarkTheme, colors: navigationColors };

type Props = { children: ReactNode };

/** Gives the native stack (headers, backgrounds) Apple's system colors. */
export function NavigationThemeProvider({ children }: Props) {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? darkTheme : lightTheme}>{children}</ThemeProvider>
  );
}
