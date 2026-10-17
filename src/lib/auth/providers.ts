import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { env } from '../env';
import { getSupabase } from '../supabase';
import type { AuthResult } from './email';

/**
 * Native identity providers. Both hand Supabase an ID token; no OAuth redirect, no browser session.
 * Google requires a Web client ID (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID); Apple only works on iOS devices.
 */
let googleConfigured = false;

export function isGoogleSignInConfigured(): boolean {
  return Boolean(env.googleWebClientId);
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!env.googleWebClientId) return { ok: false, message: 'unavailable' };
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: env.googleWebClientId });
    googleConfigured = true;
  }
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { ok: false, message: 'cancelled' };
    const token = response.data.idToken;
    if (!token) return { ok: false, message: 'no_id_token' };
    const { error } = await getSupabase().auth.signInWithIdToken({ provider: 'google', token });
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'failed' };
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { ok: false, message: 'no_id_token' };
    const { error } = await getSupabase().auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { ok: false, message: error.message };
    // Apple sends the name only on the first sign-in; keep it so onboarding can prefill.
    const given = credential.fullName?.givenName;
    if (given) {
      const name = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
      await getSupabase().auth.updateUser({ data: { full_name: name } });
    }
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ERR_REQUEST_CANCELED') return { ok: false, message: 'cancelled' };
    return { ok: false, message: e instanceof Error ? e.message : 'failed' };
  }
}
