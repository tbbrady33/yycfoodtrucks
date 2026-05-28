import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';

export type ReviewStatus = 'visible' | 'flagged' | 'removed';

export type Review = {
  id: string;
  truck_id: string;
  author_id: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

/**
 * Reviews on a truck. RLS shows public callers visible reviews only;
 * the row author additionally sees their own flagged/removed rows.
 */
export function useTruckReviews(truckId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', truckId],
    enabled: !!truckId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, truck_id, author_id, rating, body, status, created_at, updated_at')
        .eq('truck_id', truckId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

/** Convenience: the current user's review of a given truck, if any. */
export function useMyReview(truckId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['my-review', truckId, user?.id ?? null],
    enabled: !!truckId && !!user,
    queryFn: async (): Promise<Review | null> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, truck_id, author_id, rating, body, status, created_at, updated_at')
        .eq('truck_id', truckId!)
        .eq('author_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Review | null) ?? null;
    },
  });
}

/**
 * Write (or replace) the current user's review on a truck.
 * UNIQUE (truck_id, author_id) means upsert behaves as expected: there is at
 * most one row per (user, truck), and re-submitting overwrites it.
 *
 * On insert: RLS forces status = 'visible'. On update: RLS forbids changing
 * status (only admins moderate), so we omit it from the payload.
 */
export function useUpsertReview() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (input: { truckId: string; rating: number; body: string | null }) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('reviews')
        .upsert(
          {
            truck_id: input.truckId,
            author_id: user.id,
            rating: input.rating,
            body: input.body,
          },
          { onConflict: 'truck_id,author_id' }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['reviews', vars.truckId] });
      qc.invalidateQueries({ queryKey: ['my-review', vars.truckId] });
      // avg_rating / review_count live on v_trucks_with_status; refresh both
      // the all-trucks list and the specific truck.
      qc.invalidateQueries({ queryKey: ['truck'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
    },
  });
}

export function useFlagReview() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (input: { reviewId: string; reason: string | null }) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('review_flags')
        .insert({ review_id: input.reviewId, flagger_id: user.id, reason: input.reason });
      // Duplicate flag (same flagger, same review) is a no-op for us.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}
