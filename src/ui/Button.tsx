import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { minTouch, radius, spacing, useTheme } from './theme';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const background =
    variant === 'primary' ? theme.primary : variant === 'secondary' ? theme.surface : 'transparent';
  const tone = variant === 'primary' ? 'onPrimary' : 'default';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? theme.border : 'transparent',
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : theme.primary} />
      ) : (
        <Text variant="bodyStrong" tone={tone}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch + 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
