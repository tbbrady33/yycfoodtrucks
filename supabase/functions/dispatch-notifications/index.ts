// Edge Function: dispatch-notifications
//
// Reads pending notification_events (processed_at IS NULL) and fans out
// push messages to each event's truck-followers via the Expo Push API.
//
// Should be invoked on a schedule — recommended every 1–2 minutes,
// either:
//   - From the Supabase Functions Scheduler in the dashboard
//   - From pg_cron + pg_net (the SQL snippet is in the README under
//     "Push notifications setup")
//   - Externally (any cron-as-a-service)
//
// Deduplication: per (user_id, truck_id, kind), no more than one push
// every 30 minutes (private.push_dedupe). Stops flapping spam when an
// operator toggles their override or republishes a slot quickly.
//
// Deploy: supabase functions deploy dispatch-notifications

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const DEDUPE_WINDOW_MIN = 30;
const BATCH_LIMIT = 50; // events per invocation

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

type EventRow = {
  id: string;
  truck_id: string;
  kind: 'opened' | 'schedule_changed';
  payload: Record<string, unknown>;
  created_at: string;
};

type TruckRow = { id: string; name: string; slug: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Pull pending events.
  const { data: events, error: evErr } = await supabase
    .from('notification_events')
    .select('id, truck_id, kind, payload, created_at')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);
  if (evErr) return json({ error: evErr.message }, 500);
  if (!events || events.length === 0) {
    return json({ processed: 0, sent: 0 });
  }

  // 2. Resolve trucks in one shot for nicer push titles.
  const truckIds = Array.from(new Set(events.map((e: EventRow) => e.truck_id)));
  const { data: trucks } = await supabase
    .from('trucks')
    .select('id, name, slug')
    .in('id', truckIds);
  const truckById = new Map<string, TruckRow>(
    (trucks ?? []).map((t: TruckRow) => [t.id, t])
  );

  let sent = 0;
  let processed = 0;

  // 3. For each event, find unsuppressed followers and queue a push.
  for (const ev of events as EventRow[]) {
    const truck = truckById.get(ev.truck_id);
    if (!truck) {
      // Truck deleted between event creation and dispatch; mark processed.
      await markProcessed(supabase, ev.id);
      processed++;
      continue;
    }

    const { data: follows } = await supabase
      .from('follows')
      .select('user_id')
      .eq('truck_id', ev.truck_id);
    const followerIds = (follows ?? []).map((f: { user_id: string }) => f.user_id);
    if (followerIds.length === 0) {
      await markProcessed(supabase, ev.id);
      processed++;
      continue;
    }

    // Filter out users we pushed to recently for the same (truck, kind).
    const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MIN * 60_000).toISOString();
    const { data: recent } = await supabase
      .schema('private')
      .from('push_dedupe')
      .select('user_id')
      .eq('truck_id', ev.truck_id)
      .eq('kind', ev.kind)
      .gt('last_fired_at', sinceIso);
    const suppressed = new Set(
      (recent ?? []).map((r: { user_id: string }) => r.user_id)
    );
    const eligible = followerIds.filter((id) => !suppressed.has(id));
    if (eligible.length === 0) {
      await markProcessed(supabase, ev.id);
      processed++;
      continue;
    }

    // Look up push tokens for the eligible followers.
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', eligible);
    const messages = (tokens ?? []).map((t: { user_id: string; expo_push_token: string }) => ({
      to: t.expo_push_token,
      title: titleFor(ev, truck),
      body: bodyFor(ev, truck),
      data: { truck_slug: truck.slug, truck_id: truck.id, kind: ev.kind },
      sound: 'default',
    }));

    if (messages.length > 0) {
      const resp = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      // We don't fail the whole dispatch if Expo errors on some receipts —
      // the events are still marked processed so we don't retry forever.
      // Receipt details would be polled separately in a more elaborate setup.
      if (!resp.ok) {
        const text = await resp.text();
        console.error('Expo push API error', resp.status, text);
      } else {
        sent += messages.length;
      }
    }

    // Stamp dedupe ledger so the next dispatch within DEDUPE_WINDOW_MIN
    // skips these recipients for this (truck, kind).
    const now = new Date().toISOString();
    const rows = eligible.map((user_id) => ({
      user_id,
      truck_id: ev.truck_id,
      kind: ev.kind,
      last_fired_at: now,
    }));
    if (rows.length > 0) {
      await supabase.schema('private').from('push_dedupe').upsert(rows);
    }

    await markProcessed(supabase, ev.id);
    processed++;
  }

  return json({ processed, sent });
});

async function markProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string
) {
  await supabase
    .from('notification_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventId);
}

function titleFor(ev: EventRow, truck: TruckRow): string {
  if (ev.kind === 'opened') return `${truck.name} just opened`;
  if (ev.kind === 'schedule_changed') return `${truck.name} updated their schedule`;
  return truck.name;
}

function bodyFor(ev: EventRow, truck: TruckRow): string {
  if (ev.kind === 'opened') return 'Tap to see where.';
  if (ev.kind === 'schedule_changed') return 'Check the next few days.';
  return '';
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
