export {
  codeSchema,
  emailSchema,
  requestEmailCode,
  verifyEmailCode,
  type AuthResult,
} from './email';
export {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from './providers';
export { AuthProvider, signOut } from './provider';
export { useAuthStore, type AuthStatus } from './store';
