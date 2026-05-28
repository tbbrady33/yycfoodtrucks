import { useQuery } from '@tanstack/react-query';

import { supabase } from '../supabase';

export type TemplateSlot = {
  id: string;
  truck_id: string;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  start_time: string;  // HH:MM:SS
  end_time: string;
  location_label: string;
  address: string;
};

export type DatedSlot = {
  id: string;
  truck_id: string;
  slot_date: string;   // YYYY-MM-DD
  start_time: string;
  end_time: string;
  location_label: string;
  address: string;
  kind: 'addition' | 'closure' | 'replacement';
};

/**
 * Published schedule for a truck:
 *   - the full weekly template
 *   - dated slots in the next `lookaheadDays` (default 14), so exceptions
 *     and one-offs near today render alongside the recurring grid.
 *
 * RLS on schedule_*_slots already filters to published rows for non-owners.
 */
export function useTruckSchedule(
  truckId: string | undefined,
  opts: { lookaheadDays?: number } = {}
) {
  const lookaheadDays = opts.lookaheadDays ?? 14;
  return useQuery({
    queryKey: ['schedule', truckId, { lookaheadDays }],
    enabled: !!truckId,
    queryFn: async (): Promise<{ template: TemplateSlot[]; dated: DatedSlot[] }> => {
      const today = new Date();
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + lookaheadDays);
      const isoToday = today.toISOString().slice(0, 10);
      const isoHorizon = horizon.toISOString().slice(0, 10);

      const [tpl, dated] = await Promise.all([
        supabase
          .from('schedule_template_slots')
          .select('id, truck_id, day_of_week, start_time, end_time, location_label, address')
          .eq('truck_id', truckId!)
          .eq('published', true)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('schedule_dated_slots')
          .select(
            'id, truck_id, slot_date, start_time, end_time, location_label, address, kind'
          )
          .eq('truck_id', truckId!)
          .eq('published', true)
          .gte('slot_date', isoToday)
          .lte('slot_date', isoHorizon)
          .order('slot_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ]);
      if (tpl.error) throw tpl.error;
      if (dated.error) throw dated.error;
      return {
        template: (tpl.data ?? []) as TemplateSlot[],
        dated: (dated.data ?? []) as DatedSlot[],
      };
    },
  });
}
