import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';

/**
 * Operator-side menu mutations. RLS on menu_items checks the parent truck's
 * owner_id, so these only succeed when the caller owns the truck (or is
 * admin). The customer-facing useTruckMenu query is reused; we just need
 * to invalidate it on writes.
 */

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { truckId: string; name: string; priceCents: number }) => {
      // New items go at the end. With ~4 items per truck this is cheap.
      const { data: existing, error: cErr } = await supabase
        .from('menu_items')
        .select('position')
        .eq('truck_id', input.truckId)
        .order('position', { ascending: false })
        .limit(1);
      if (cErr) throw cErr;
      const nextPos = ((existing?.[0]?.position as number) ?? 0) + 1;

      const { error } = await supabase.from('menu_items').insert({
        truck_id: input.truckId,
        name: input.name,
        price_cents: input.priceCents,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['menu', vars.truckId] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      truckId: string;
      name: string;
      priceCents: number;
    }) => {
      const { error } = await supabase
        .from('menu_items')
        .update({ name: input.name, price_cents: input.priceCents })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['menu', vars.truckId] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; truckId: string }) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['menu', vars.truckId] }),
  });
}
