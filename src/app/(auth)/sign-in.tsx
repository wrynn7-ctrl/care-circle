import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import {
  emailSchema,
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  requestEmailCode,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/auth';
import { Button, FormField, Screen, Text, spacing } from '@/ui';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function onSendCode() {
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy('email');
    const result = await requestEmailCode(parsed.data);
    setBusy(null);
    if (!result.ok) {
      setError(t('auth.sendFailed'));
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { email: parsed.data } });
  }

  async function onProvider(kind: 'google' | 'apple') {
    setError(null);
    setBusy(kind);
    const result = kind === 'google' ? await signInWithGoogle() : await signInWithApple();
    setBusy(null);
    if (!result.ok && result.message !== 'cancelled') {
      setError(
        result.message === 'unavailable'
          ? t('auth.providerUnavailable', { provider: kind === 'google' ? 'Google' : 'Apple' })
          : t('auth.providerFailed'),
      );
    }
  }

  const showGoogle = Platform.OS !== 'web' && isGoogleSignInConfigured();

  return (
    <Screen testID="screen-sign-in">
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {t('auth.title')}
        </Text>
        <Text tone="muted">{t('auth.subtitle')}</Text>
      </View>

      <FormField
        label={t('auth.emailLabel')}
        placeholder={t('auth.emailPlaceholder')}
        help={t('auth.emailHelp')}
        error={error}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        inputMode="email"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={onSendCode}
        testID="input-email"
      />
      <Button
        title={t('auth.sendCode')}
        onPress={onSendCode}
        loading={busy === 'email'}
        disabled={busy !== null}
        testID="button-send-code"
      />

      {showGoogle || appleAvailable ? (
        <Text tone="muted" style={styles.or}>
          {t('common.or')}
        </Text>
      ) : null}
      {showGoogle ? (
        <Button
          title={t('auth.google')}
          variant="secondary"
          onPress={() => onProvider('google')}
          loading={busy === 'google'}
          disabled={busy !== null}
        />
      ) : null}
      {appleAvailable ? (
        <Button
          title={t('auth.apple')}
          variant="secondary"
          onPress={() => onProvider('apple')}
          loading={busy === 'apple'}
          disabled={busy !== null}
        />
      ) : null}

      <Text variant="caption" tone="muted" style={styles.footer}>
        {t('privacy.footer')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.xl },
  or: { textAlign: 'center' },
  footer: { marginTop: 'auto', textAlign: 'center' },
});
