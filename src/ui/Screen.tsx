import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from './theme';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  testID?: string;
};

/** Page container: safe area, theme background, keyboard avoidance, optional scrolling. */
export function Screen({ children, scroll = true, contentStyle, testID }: ScreenProps) {
  const theme = useTheme();
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <KeyboardAvoidingView style={[styles.content, contentStyle]}>{children}</KeyboardAvoidingView>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} testID={testID}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
});
