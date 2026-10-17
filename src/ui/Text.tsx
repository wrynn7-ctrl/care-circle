import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, useTheme, type TypographyVariant } from './theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: 'default' | 'muted' | 'danger' | 'onPrimary';
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const theme = useTheme();
  const color =
    tone === 'muted'
      ? theme.textMuted
      : tone === 'danger'
        ? theme.danger
        : tone === 'onPrimary'
          ? theme.onPrimary
          : theme.text;
  // allowFontScaling stays on (default) so the OS font size setting is respected.
  return <RNText {...rest} style={[typography[variant], { color }, style]} />;
}
