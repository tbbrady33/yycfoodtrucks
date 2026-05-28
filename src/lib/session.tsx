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
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
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
