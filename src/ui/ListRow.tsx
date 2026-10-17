import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { minTouch, spacing, useTheme } from './theme';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({ title, subtitle, trailing, onPress, accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: theme.border }];
  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: theme.surfaceMuted }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1, gap: 2 },
});
