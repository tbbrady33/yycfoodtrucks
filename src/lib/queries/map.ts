import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';

/**
 * Map-side query: for every truck (public read), pick one representative
 * address — the first published template slot, falling back to the first
 * published dated slot. The map screen geocodes these client-side via
 * expo-location.
 *
 * This is intentionally lightweight for v1 — one pin per truck. A future
 * iteration could pin to "today's slot" or animate trucks moving across
 * the week.
 */

export type MapTruck = {
  truck_id: string;
  slug: string;
  name: string;
  status: 'open' | 'closed';
  address: string;
  location_label: string;
};

export function useMapTrucks() {
  return useQuery({
    queryKey: ['map-trucks'],
    queryFn: async (): Promise<MapTruck[]> => {
      // 1. Pull trucks + status from the customer-facing view.
      const { data: trucks, error: tErr } = await supabase
        .from('v_trucks_with_status')
        .select('id, slug, name, status');
      if (tErr) throw tErr;
      if (!trucks || trucks.length === 0) return [];

      // 2. Pull all published template slots in one round-trip.
      const truckIds = trucks.map((t) => t.id as string);
      const { data: tplSlots, error: sErr } = await supabase
        .from('schedule_template_slots')
        .select('truck_id, address, location_label, day_of_week, start_time')
        .in('truck_id', truckIds)
        .eq('published', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      if (sErr) throw sErr;

      // 3. Fallback: first published dated slot.
      const { data: datedSlots, error: dErr } = await supabase
        .from('schedule_dated_slots')
        .select('truck_id, address, location_label, slot_date, start_time')
        .in('truck_id', truckIds)
        .eq('published', true)
        .neq('kind', 'closure')
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (dErr) throw dErr;

      // First-wins per truck for both buckets.
      const firstTemplate = new Map<string, { address: string; location_label: string }>();
      for (const s of tplSlots ?? []) {
        if (!firstTemplate.has(s.truck_id as string)) {
          firstTemplate.set(s.truck_id as string, {
            address: s.address as string,
            location_label: s.location_label as string,
          });
        }
      }
      const firstDated = new Map<string, { address: string; location_label: string }>();
      for (const s of datedSlots ?? []) {
        if (!firstDated.has(s.truck_id as string)) {
          firstDated.set(s.truck_id as string, {
            address: s.address as string,
            location_label: s.location_label as string,
          });
        }
      }

      // Build the output: drop trucks with no published slot at all.
      const out: MapTruck[] = [];
      for (const t of trucks) {
        const id = t.id as string;
        const pick = firstTemplate.get(id) ?? firstDated.get(id);
        if (!pick) continue;
        out.push({
          truck_id: id,
          slug: t.slug as string,
          name: t.name as string,
          status: t.status as 'open' | 'closed',
          address: pick.address,
          location_label: pick.location_label,
        });
      }
      return out;
    },
  });
}
