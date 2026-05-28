import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import type { DatedSlot, TemplateSlot } from './schedule';

/**
 * Operator mutations for both schedule_template_slots and
 * schedule_dated_slots. RLS lets the truck's owner write either.
 *
 * Toggling `published` from false → true (or inserting with published=true)
 * fires the private.on_schedule_publish trigger, which inserts a
 * notification_events(kind='schedule_changed') row. That's the engine
 * behind Step 9's "tracked truck published a schedule change" push.
 *
 * Invalidations cover:
 *   - operator-schedule    (this editor's own data)
 *   - schedule             (customer-facing useTruckSchedule)
 *   - truck / trucks       (avg-rating doesn't change but the public view
 *                           is cheap to refetch and avoids drift)
 */

// ---------------------------------------------------------------------------
// Template slots
// ---------------------------------------------------------------------------

export type TemplateSlotInput = Omit<TemplateSlot, 'id' | 'truck_id'> & {
  published: boolean;
};

export function useCreateTemplateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { truckId: string; slot: TemplateSlotInput }) => {
      const { error } = await supabase.from('schedule_template_slots').insert({
        truck_id: input.truckId,
        day_of_week: input.slot.day_of_week,
        start_time: input.slot.start_time,
        end_time: input.slot.end_time,
        location_label: input.slot.location_label,
        address: input.slot.address,
        published: input.slot.published,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

export function useUpdateTemplateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      truckId: string;
      patch: Partial<TemplateSlotInput>;
    }) => {
      const { error } = await supabase
        .from('schedule_template_slots')
        .update(input.patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

export function useDeleteTemplateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; truckId: string }) => {
      const { error } = await supabase
        .from('schedule_template_slots')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

// ---------------------------------------------------------------------------
// Dated slots
// ---------------------------------------------------------------------------

export type DatedSlotInput = Omit<DatedSlot, 'id' | 'truck_id'> & {
  published: boolean;
};

export function useCreateDatedSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { truckId: string; slot: DatedSlotInput }) => {
      const { error } = await supabase.from('schedule_dated_slots').insert({
        truck_id: input.truckId,
        slot_date: input.slot.slot_date,
        start_time: input.slot.start_time,
        end_time: input.slot.end_time,
        location_label: input.slot.location_label,
        address: input.slot.address,
        kind: input.slot.kind,
        published: input.slot.published,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

export function useUpdateDatedSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      truckId: string;
      patch: Partial<DatedSlotInput>;
    }) => {
      const { error } = await supabase
        .from('schedule_dated_slots')
        .update(input.patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

export function useDeleteDatedSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; truckId: string }) => {
      const { error } = await supabase
        .from('schedule_dated_slots')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateScheduleQueries(qc, vars.truckId),
  });
}

// ---------------------------------------------------------------------------
// Operator-side fetch — needs drafts too, so it can't reuse the public
// useTruckSchedule (which filters published=true on the customer side via
// RLS, but the operator's own drafts are visible via the policy's "or owns
// the truck" branch). Both sides hit the same RLS path; we just don't add
// our own `.eq('published', true)` filter.
// ---------------------------------------------------------------------------

import { useQuery } from '@tanstack/react-query';

export function useOperatorSchedule(truckId: string | undefined) {
  return useQuery({
    queryKey: ['operator-schedule', truckId],
    enabled: !!truckId,
    queryFn: async (): Promise<{ template: (TemplateSlot & { published: boolean })[]; dated: (DatedSlot & { published: boolean })[] }> => {
      const [tpl, dated] = await Promise.all([
        supabase
          .from('schedule_template_slots')
          .select(
            'id, truck_id, day_of_week, start_time, end_time, location_label, address, published'
          )
          .eq('truck_id', truckId!)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('schedule_dated_slots')
          .select(
            'id, truck_id, slot_date, start_time, end_time, location_label, address, kind, published'
          )
          .eq('truck_id', truckId!)
          .order('slot_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ]);
      if (tpl.error) throw tpl.error;
      if (dated.error) throw dated.error;
      return {
        template: (tpl.data ?? []) as (TemplateSlot & { published: boolean })[],
        dated: (dated.data ?? []) as (DatedSlot & { published: boolean })[],
      };
    },
  });
}

function invalidateScheduleQueries(
  qc: ReturnType<typeof useQueryClient>,
  truckId: string
) {
  qc.invalidateQueries({ queryKey: ['operator-schedule', truckId] });
  qc.invalidateQueries({ queryKey: ['schedule', truckId] });
  qc.invalidateQueries({ queryKey: ['truck'] });
  qc.invalidateQueries({ queryKey: ['trucks'] });
}
