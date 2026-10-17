import { useColorScheme } from 'react-native';

/**
 * Design tokens. Calm, warm palette; generous sizes because many users are 50–70 and read at large
 * font scales. Never hard-code colors in components; use `useTheme()`.
 */
export const palette = {
  light: {
    background: '#F4F1EA',
    surface: '#FFFFFF',
    surfaceMuted: '#ECE7DC',
    text: '#1F2A26',
    textMuted: '#5B6965',
    primary: '#4B6B5C',
    onPrimary: '#FFFFFF',
    border: '#D8D2C4',
    danger: '#A33A2E',
    success: '#3C7A5A',
    focus: '#2F5D8A',
  },
  dark: {
    background: '#161A18',
    surface: '#1F2522',
    surfaceMuted: '#262D29',
    text: '#F1EFE8',
    textMuted: '#A9B3AE',
    primary: '#8FB7A3',
    onPrimary: '#13201A',
    border: '#38423D',
    danger: '#E07A6F',
    success: '#7FC39E',
    focus: '#7FA9D6',
  },
} as const;

export type Theme = { readonly [K in keyof typeof palette.light]: string };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
/** Minimum touch target per the working rules (44pt). */
export const minTouch = 44;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}
