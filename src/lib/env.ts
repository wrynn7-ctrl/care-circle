import { z } from 'zod';

/**
 * Public configuration. Only EXPO_PUBLIC_* variables exist in the bundle. Missing required values fail
 * loudly at startup instead of producing confusing network errors later.
 */
const schema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(10),
  sentryDsn: z.string().optional(),
  googleWebClientId: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function read(): Env {
  const parsed = schema.safeParse({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      'Care Circle is missing configuration. Copy .env.example to .env.local and set ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return parsed.data;
}

export const env: Env = read();
