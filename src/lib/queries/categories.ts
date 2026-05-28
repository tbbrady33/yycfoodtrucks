import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';

export type Category = {
  id: number;
  slug: string;
  name: string;
  position: number;
};

const CATEGORIES_KEY = ['categories'] as const;

/** All 6 categories, ordered by `position`. Cached for the session. */
export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    // Categories rarely change; keep them around between renders.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug, name, position')
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useCategoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['category', slug],
    enabled: !!slug,
    queryFn: async (): Promise<Category | null> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug, name, position')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as Category | null) ?? null;
    },
  });
}
