import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';
import type { TruckListRow } from './trucks';

/**
 * The current user's followed trucks, joined to v_trucks_with_status so the
 * favorites screen shows the same status pill the truck profile does.
 *
 * RLS on follows already scopes the query to the current user.
 */
export function useFollows() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['follows', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<TruckListRow[]> => {
      const { data: rows, error: fErr } = await supabase
        .from('follows')
        .select('truck_id')
        .order('created_at', { ascending: false });
      if (fErr) throw fErr;

      const ids = (rows ?? []).map((r) => r.truck_id as string);
      if (ids.length === 0) return [];

      const { data: trucks, error: tErr } = await supabase
        .from('v_trucks_with_status')
        .select(
          'id, slug, name, description, hero_image_path, owner_id, category_id, category_slug, category_name, status, avg_rating, review_count'
        )
        .in('id', ids);
      if (tErr) throw tErr;

      // Preserve the follows ordering (most-recently-followed first).
      const byId = new Map((trucks ?? []).map((t) => [t.id as string, t as TruckListRow]));
      return ids.map((id) => byId.get(id)).filter((t): t is TruckListRow => !!t);
    },
  });
}

/** True if the current user follows the given truck. False when signed out. */
export function useIsFollowing(truckId: string | undefined): boolean {
  const follows = useFollows().data;
  if (!truckId || !follows) return false;
  return follows.some((t) => t.id === truckId);
}

export function useFollow() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (truckId: string) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('follows')
        .insert({ user_id: user.id, truck_id: truckId });
      if (error && error.code !== '23505') throw error; // ignore duplicate-PK
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  });
}

export function useUnfollow() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (truckId: string) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('user_id', user.id)
        .eq('truck_id', truckId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follows'] }),
  });
}
