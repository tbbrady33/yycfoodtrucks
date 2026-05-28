import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';

/**
 * Operator-side truck record. Includes the override fields the operator
 * dashboard cares about (which the public v_trucks_with_status doesn't
 * expose). RLS already scopes writes to the truck's owner.
 */
export type OperatorTruck = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_id: number;
  owner_id: string | null;
  hero_image_path: string | null;
  manual_override_status: 'open' | 'closed' | null;
  manual_override_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

/** The current user's owned trucks. RLS keeps this scoped. */
export function useMyOperatedTrucks() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['my-operated-trucks', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<OperatorTruck[]> => {
      const { data, error } = await supabase
        .from('trucks')
        .select(
          'id, slug, name, description, category_id, owner_id, hero_image_path, manual_override_status, manual_override_expires_at, created_at, updated_at'
        )
        .eq('owner_id', user!.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OperatorTruck[];
    },
  });
}

export function useOperatorTruck(id: string | undefined) {
  return useQuery({
    queryKey: ['operator-truck', id],
    enabled: !!id,
    queryFn: async (): Promise<OperatorTruck | null> => {
      const { data, error } = await supabase
        .from('trucks')
        .select(
          'id, slug, name, description, category_id, owner_id, hero_image_path, manual_override_status, manual_override_expires_at, created_at, updated_at'
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (data as OperatorTruck | null) ?? null;
    },
  });
}

export function useUpdateTruckBasics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description: string | null;
      category_id: number;
    }) => {
      const { error } = await supabase
        .from('trucks')
        .update({
          name: input.name,
          description: input.description,
          category_id: input.category_id,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['operator-truck', vars.id] });
      qc.invalidateQueries({ queryKey: ['my-operated-trucks'] });
      // Public-facing views refresh too.
      qc.invalidateQueries({ queryKey: ['trucks'] });
      qc.invalidateQueries({ queryKey: ['truck'] });
    },
  });
}

export function useSetManualOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: 'open' | 'closed';
      expiresAt: string | null;
    }) => {
      const { error } = await supabase
        .from('trucks')
        .update({
          manual_override_status: input.status,
          manual_override_expires_at: input.expiresAt,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['operator-truck', vars.id] });
      qc.invalidateQueries({ queryKey: ['my-operated-trucks'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
      qc.invalidateQueries({ queryKey: ['truck'] });
    },
  });
}

export function useClearManualOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('trucks')
        .update({ manual_override_status: null, manual_override_expires_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['operator-truck', id] });
      qc.invalidateQueries({ queryKey: ['my-operated-trucks'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
      qc.invalidateQueries({ queryKey: ['truck'] });
    },
  });
}
