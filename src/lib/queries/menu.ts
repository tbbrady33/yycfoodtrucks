import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';

export type MenuItem = {
  id: string;
  truck_id: string;
  name: string;
  price_cents: number;
  position: number;
};

/** A truck's menu, ordered by `position`. Public read; no auth required. */
export function useTruckMenu(truckId: string | undefined) {
  return useQuery({
    queryKey: ['menu', truckId],
    enabled: !!truckId,
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, truck_id, name, price_cents, position')
        .eq('truck_id', truckId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });
}
