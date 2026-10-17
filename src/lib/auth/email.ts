import { z } from 'zod';

import { getSupabase } from '../supabase';

export const emailSchema = z.email();
export const codeSchema = z.string().regex(/^\d{6}$/);

export type AuthResult = { ok: true } | { ok: false; message: string };

/** Sends a 6-digit one-time code. Creates the account on first use. */
export async function requestEmailCode(email: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}
