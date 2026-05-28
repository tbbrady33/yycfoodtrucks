import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';

export type Role = 'customer' | 'operator' | 'admin';

export type Profile = {
  id: string;
  role: Role;
  display_name: string | null;
  must_change_password: boolean;
};

/**
 * Read the current user's profile row. Returns null when signed out.
 *
 * Cached under ['profile', userId] so role checks across the app reuse the
 * same fetch. RLS guarantees this only returns the caller's own row.
 */
export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['profile', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, display_name, must_change_password')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

/** Convenience: just the role. Returns undefined while loading or signed out. */
export function useRole(): Role | undefined {
  return useProfile().data?.role;
}
