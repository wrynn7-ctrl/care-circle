import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { codeSchema, requestEmailCode, verifyEmailCode } from '@/lib/auth';
import { Button, FormField, Screen, Text, spacing } from '@/ui';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!email) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  async function onVerify() {
    setError(null);
    setNotice(null);
    if (!codeSchema.safeParse(code.trim()).success) {
      setError(t('verify.wrongCode'));
      return;
    }
    setBusy(true);
    const result = await verifyEmailCode(email!, code);
    setBusy(false);
    if (!result.ok) setError(t('verify.wrongCode'));
    // On success the auth store flips to signedIn and the root navigator swaps to (app).
  }

  async function onResend() {
    setError(null);
    setBusy(true);
    const result = await requestEmailCode(email!);
    setBusy(false);
    setNotice(result.ok ? t('verify.resent') : t('auth.sendFailed'));
  }

  return (
    <Screen testID="screen-verify">
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {t('verify.title')}
        </Text>
        <Text tone="muted">{t('verify.subtitle', { email })}</Text>
      </View>
      <FormField
        label={t('verify.codeLabel')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        error={error}
        help={notice ?? undefined}
        inputMode="numeric"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={onVerify}
        testID="input-code"
      />
      <Button title={t('verify.verify')} onPress={onVerify} loading={busy} testID="button-verify" />
      <Button title={t('verify.resend')} variant="ghost" onPress={onResend} disabled={busy} />
      <Button
        title={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
        disabled={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing.sm, marginTop: spacing.xl } });
