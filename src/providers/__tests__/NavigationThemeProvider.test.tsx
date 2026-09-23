import { render } from '@testing-library/react-native';
import { DarkTheme, DefaultTheme, useTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

import { colors } from '@/theme';

import { NavigationThemeProvider } from '../NavigationThemeProvider';

// React Native's Jest setup replaces useColorScheme with a jest.fn() that says 'light'.
const mockColorScheme = jest.mocked(useColorScheme);

/** The navigation theme the native stack would get. */
function renderTheme(): Theme {
  let theme: Theme | undefined;
  function Probe() {
    theme = useTheme();
    return null;
  }
  render(
    <NavigationThemeProvider>
      <Probe />
    </NavigationThemeProvider>,
  );
  if (!theme) throw new Error('NavigationThemeProvider rendered no children');
  return theme;
}

const SYSTEM_COLORS: Theme['colors'] = {
  primary: colors.tint,
  background: colors.systemGroupedBackground,
  card: colors.systemGroupedBackground,
  text: colors.label,
  border: colors.separator,
  notification: colors.systemRed,
};

describe('NavigationThemeProvider', () => {
  afterEach(() => {
    mockColorScheme.mockReturnValue('light');
  });

  it('gives the stack the light theme with system colors', () => {
    mockColorScheme.mockReturnValue('light');

    const theme = renderTheme();

    expect(theme.dark).toBe(false);
    expect(theme.colors).toEqual(SYSTEM_COLORS);
    expect(theme.fonts).toEqual(DefaultTheme.fonts);
  });

  // With the light theme in dark mode, native stack headers stay white.
  it('switches to the dark theme in dark mode, keeping the system colors', () => {
    mockColorScheme.mockReturnValue('dark');

    const theme = renderTheme();

    expect(theme.dark).toBe(true);
    expect(theme.colors).toEqual(SYSTEM_COLORS);
    expect(theme.fonts).toEqual(DarkTheme.fonts);
  });

  it('falls back to the light theme when the scheme is unspecified', () => {
    mockColorScheme.mockReturnValue('unspecified');

    expect(renderTheme().dark).toBe(false);
  });
});
