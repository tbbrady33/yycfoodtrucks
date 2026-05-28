import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from './supabase';
import { registerPushToken } from './push';

type SessionContextValue = {
  /** True until the initial getSession() resolves; gates auth-aware UI. */
  loading: boolean;
  session: Session | null;
  user: User | null;
};

const SessionContext = createContext<SessionContextValue>({
  loading: true,
  session: null,
  user: null,
});

/**
 * Wraps the app and tracks Supabase auth state.
 *
 * Reads the persisted session via supabase-js on mount, then subscribes to
 * auth state changes (sign in, sign out, token refresh) and re-renders
 * consumers. The subscription unsubscribes on unmount so we don't leak it
 * during fast refresh.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) {
        void registerPushToken(data.session.user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Re-register on fresh sign-in so the token belongs to the new user.
      if (event === 'SIGNED_IN' && next?.user?.id) {
        void registerPushToken(next.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ loading, session, user: session?.user ?? null }),
    [loading, session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
