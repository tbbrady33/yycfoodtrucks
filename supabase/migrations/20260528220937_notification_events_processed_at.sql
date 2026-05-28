-- 0017: Add notification_events.processed_at + dedupe index.
--
-- The dispatch-notifications Edge Function reads rows where
-- processed_at IS NULL and stamps them after fanning out to push
-- tokens. The partial index keeps the "what's pending" query fast even
-- as the events table grows.
--
-- Also adds a 30-min dedupe column (last_fired_at on push_tokens) so we
-- can avoid spamming users when a truck's status flaps (override on/off,
-- or schedule-publish triggers in quick succession).

alter table public.notification_events
  add column if not exists processed_at timestamptz;

create index if not exists idx_notification_events_pending
  on public.notification_events (created_at)
  where processed_at is null;

-- Per-(user, truck, kind) dedupe ledger used by dispatch-notifications.
create table if not exists private.push_dedupe (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  truck_id   uuid not null references public.trucks(id)   on delete cascade,
  kind       text not null,
  last_fired_at timestamptz not null default now(),
  primary key (user_id, truck_id, kind)
);
