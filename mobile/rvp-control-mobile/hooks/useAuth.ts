import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentAdmin, signIn as signInApi, signOut as signOutApi } from '@/lib/auth';
import type { AdminUser } from '@/types';

export function useAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getCurrentAdmin();
    setAdmin(current);
    return current;
  }, []);

  useEffect(() => {
    (async () => {
      setInitializing(true);
      await refresh();
      setInitializing(false);
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await signInApi(email, password);
    setAdmin(user);
    return user;
  }, []);

  const signOut = useCallback(async () => {
    await signOutApi();
    setAdmin(null);
  }, []);

  return { admin, loading, initializing, signIn, signOut, refresh };
}
