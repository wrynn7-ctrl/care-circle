import type { AuthResult } from './email';

// Native identity providers are not wired on web (web is a development/screenshot target only).
export async function signInWithGoogle(): Promise<AuthResult> {
  return { ok: false, message: 'unavailable' };
}
export async function signInWithApple(): Promise<AuthResult> {
  return { ok: false, message: 'unavailable' };
}
export function isAppleSignInAvailable(): Promise<boolean> {
  return Promise.resolve(false);
}
export function isGoogleSignInConfigured(): boolean {
  return false;
}
