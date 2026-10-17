import { useEffect } from 'react';

import { setSentryUser } from '../sentry';
import { clearStorage } from '../storage';
import { getSupabase } from '../supabase';
import { useAuthStore } from './store';

/** Mirrors the Supabase session into the auth store and tags crash reports with the opaque user id. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let active = true;
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setSentryUser(data.session?.user.id ?? null);
      });
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSentryUser(session?.user.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession]);

  return children;
}

/** Signs out and wipes everything cached on this device. */
export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
  clearStorage();
  setSentryUser(null);
}
