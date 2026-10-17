import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, spacing, useTheme } from './theme';

export type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** A simple bottom sheet built on the platform Modal. Keeps the dependency list short. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
