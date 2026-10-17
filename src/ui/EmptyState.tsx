import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { spacing } from './theme';

export type EmptyStateProps = { title: string; body?: string; action?: React.ReactNode };

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={styles.center}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  center: { textAlign: 'center' },
});
