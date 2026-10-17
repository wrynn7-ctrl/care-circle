import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { signOut, useAuthStore } from '@/lib/auth';
import { isStorageEncrypted } from '@/lib/storage';
import { Button, Card, EmptyState, Screen, Text, spacing } from '@/ui';

export default function HomeScreen() {
  const session = useAuthStore((s) => s.session);
  return (
    <Screen testID="screen-home">
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {t('home.title')}
        </Text>
      </View>
      <EmptyState title={t('app.name')} body={t('home.empty')} />
      <Card>
        <Text variant="caption" tone="muted">
          {t('home.signedInAs')}
        </Text>
        <Text variant="bodyStrong" testID="text-user-id">
          {session?.user.id ?? '—'}
        </Text>
        <Text variant="caption" tone="muted">
          {isStorageEncrypted()
            ? 'On-device cache: encrypted'
            : 'On-device cache: not encrypted (web)'}
        </Text>
      </Card>
      <Button title={t('common.signOut')} variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing.sm, marginTop: spacing.xl } });
