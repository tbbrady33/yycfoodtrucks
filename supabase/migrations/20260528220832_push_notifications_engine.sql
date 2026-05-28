-- 0016: Push notification engine — SQL side.
--
-- Two pieces:
--   1) private.compute_open_transitions(): minute-tick function that
--      compares each truck's current open/closed status (via
--      current_truck_status) against the prior tick's recorded state in
--      private.notify_state. Closed → open insert a
--      notification_events(kind='opened') row; open → closed just
--      updates state.
--   2) A pg_cron schedule that runs the function every minute.
--
-- Required extensions (enable in Supabase Dashboard → Database →
-- Extensions if not already on):
--   pg_cron   — for the minute schedule
--   pg_net    — used by the dispatch trigger in 0017 (next migration)
--
-- The schedule line at the bottom is wrapped in a DO block so the
-- migration succeeds even if pg_cron isn't enabled yet — the schedule
-- just won't get installed, and you can run it manually after enabling.

----------------------------------------------------------------------
-- State table — one row per truck, "was open at last tick"
----------------------------------------------------------------------
create table if not exists private.notify_state (
  truck_id uuid primary key references public.trucks(id) on delete cascade,
  was_open boolean not null default false,
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- compute_open_transitions
----------------------------------------------------------------------
create or replace function private.compute_open_transitions() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_truck record;
  v_now_open boolean;
  v_was_open boolean;
begin
  for v_truck in select id from public.trucks loop
    v_now_open := public.current_truck_status(v_truck.id, v_now) = 'open';

    select was_open into v_was_open
      from private.notify_state
     where truck_id = v_truck.id;

    if v_was_open is null then
      -- First time we've seen this truck — record state without firing.
      insert into private.notify_state (truck_id, was_open, updated_at)
      values (v_truck.id, v_now_open, v_now);
    elsif v_now_open and not v_was_open then
      -- Closed → open: fire the event, flip state.
      insert into public.notification_events (truck_id, kind, payload)
      values (v_truck.id, 'opened', jsonb_build_object('via', 'cron'));
      update private.notify_state
         set was_open = true, updated_at = v_now
       where truck_id = v_truck.id;
    elsif not v_now_open and v_was_open then
      -- Open → closed: just update state, no event.
      update private.notify_state
         set was_open = false, updated_at = v_now
       where truck_id = v_truck.id;
    end if;
  end loop;
end $$;

revoke execute on function private.compute_open_transitions() from public;

----------------------------------------------------------------------
-- pg_cron schedule — wrapped so missing extension doesn't kill the migration
----------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Idempotent: unschedule any previous version with the same name first.
    perform cron.unschedule('compute-open-transitions')
    where exists (
      select 1 from cron.job where jobname = 'compute-open-transitions'
    );
    perform cron.schedule(
      'compute-open-transitions',
      '* * * * *',
      $cron$select private.compute_open_transitions()$cron$
    );
  else
    raise notice 'pg_cron is not enabled; skipping cron schedule. Enable in dashboard, then run: select cron.schedule(''compute-open-transitions'', ''* * * * *'', $$select private.compute_open_transitions()$$);';
  end if;
end $$;
