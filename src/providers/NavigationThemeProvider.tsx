import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import type { ReactNode } from 'react';
import { PlatformColor, useColorScheme } from 'react-native';

// iOS system colors resolve light/dark natively, so both themes share them.
// Without this, native stack headers stay white in dark mode.
const colors: Theme['colors'] = {
  primary: PlatformColor('systemBlue'),
  background: PlatformColor('systemGroupedBackground'),
  card: PlatformColor('systemGroupedBackground'),
  text: PlatformColor('label'),
  border: PlatformColor('separator'),
  notification: PlatformColor('systemRed'),
};

const lightTheme: Theme = { ...DefaultTheme, colors };
const darkTheme: Theme = { ...DarkTheme, colors };

type Props = { children: ReactNode };

/** Gives the native stack (headers, backgrounds) Apple's system colors. */
export function NavigationThemeProvider({ children }: Props) {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? darkTheme : lightTheme}>{children}</ThemeProvider>
  );
}
