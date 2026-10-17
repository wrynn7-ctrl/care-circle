import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { minTouch, radius, spacing, typography, useTheme } from './theme';

export type FormFieldProps = TextInputProps & {
  label: string;
  help?: string;
  error?: string | null;
};

export function FormField({ label, help, error, style, ...rest }: FormFieldProps) {
  const theme = useTheme();
  const hint = error ?? help;
  return (
    <View style={styles.wrap}>
      <Text variant="bodyStrong">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          typography.body,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {hint ? (
        <Text variant="caption" tone={error ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: {
    minHeight: minTouch + 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
