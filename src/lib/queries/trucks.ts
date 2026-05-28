import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';

export type TruckStatus = 'open' | 'closed';

export type TruckListRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hero_image_path: string | null;
  owner_id: string | null;
  category_id: number;
  category_slug: string;
  category_name: string;
  status: TruckStatus;
  avg_rating: number;
  review_count: number;
};

export type TrucksFilter = {
  categoryId?: number;
  /** When true, only show trucks where v_trucks_with_status.status = 'open'. */
  openNow?: boolean;
  /** Case-insensitive substring match on truck name. */
  search?: string;
};

/**
 * The customer-facing list query. Reads from v_trucks_with_status so the
 * status pill and average rating come straight from Postgres — no client
 * recomputation. RLS on trucks/reviews still applies (view uses
 * security_invoker), so drafts and removed reviews never leak.
 */
export function useTrucks(filter: TrucksFilter = {}) {
  const { categoryId, openNow, search } = filter;
  return useQuery({
    queryKey: ['trucks', { categoryId, openNow, search: search?.trim() ?? null }],
    queryFn: async (): Promise<TruckListRow[]> => {
      let q = supabase
        .from('v_trucks_with_status')
        .select(
          'id, slug, name, description, hero_image_path, owner_id, category_id, category_slug, category_name, status, avg_rating, review_count'
        )
        .order('name', { ascending: true });
      if (categoryId !== undefined) q = q.eq('category_id', categoryId);
      if (openNow) q = q.eq('status', 'open');
      const term = search?.trim();
      if (term) q = q.ilike('name', `%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TruckListRow[];
    },
  });
}

export function useTruckBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['truck', slug],
    enabled: !!slug,
    queryFn: async (): Promise<TruckListRow | null> => {
      const { data, error } = await supabase
        .from('v_trucks_with_status')
        .select(
          'id, slug, name, description, hero_image_path, owner_id, category_id, category_slug, category_name, status, avg_rating, review_count'
        )
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as TruckListRow | null) ?? null;
    },
  });
}
