-- 0007: Close the advisor warnings raised after 0001..0006.
--
-- Three fixes:
--   1) auth_role → SECURITY INVOKER. The caller can already SELECT their own
--      profile row via RLS, so SECURITY DEFINER was never needed. Closes the
--      auth_role warnings cleanly.
--
--   2) handle_new_user stays in public but loses EXECUTE for anon/authenticated.
--      The trigger fires on auth.users INSERT which runs as the service role,
--      so revoking from app-facing roles is safe and closes that warning.
--
--   3) handle_review_flag and on_schedule_publish move to a private schema.
--      They MUST stay SECURITY DEFINER (they write to tables the calling
--      role can't touch via RLS) and authenticated MUST have EXECUTE so the
--      trigger fires on their inserts/updates — but they don't need to be
--      callable via REST RPC. Putting them in a schema absent from the Data
--      API exposed list (default: public, graphql_public, storage) removes
--      the /rest/v1/rpc/<fn> endpoint entirely.

----------------------------------------------------------------------
-- 1. auth_role → SECURITY INVOKER
----------------------------------------------------------------------
create or replace function public.auth_role() returns text
language sql security invoker stable set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;
-- 0002's grants to anon/authenticated still apply; no change needed there.

----------------------------------------------------------------------
-- 2. handle_new_user: revoke from app-facing roles
----------------------------------------------------------------------
revoke execute on function public.handle_new_user() from anon, authenticated;
-- The trigger on auth.users still fires (service role context).

----------------------------------------------------------------------
-- 3. private schema for trigger-only functions
----------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
-- authenticated needs USAGE so its INSERT/UPDATE on review_flags and
-- schedule_*_slots can resolve the private trigger function name. EXECUTE
-- on each function is granted explicitly below — they get nothing else in
-- the schema by default.

-- handle_review_flag → private.handle_review_flag
drop trigger if exists on_review_flag_inserted on public.review_flags;
drop function if exists public.handle_review_flag();

create or replace function private.handle_review_flag() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.reviews
    set status = 'flagged'
  where id = new.review_id
    and status = 'visible';
  return new;
end $$;

revoke execute on function private.handle_review_flag() from public;
grant execute on function private.handle_review_flag() to authenticated;

create trigger on_review_flag_inserted
  after insert on public.review_flags
  for each row execute function private.handle_review_flag();

-- on_schedule_publish → private.on_schedule_publish
drop trigger if exists on_template_publish on public.schedule_template_slots;
drop trigger if exists on_dated_publish on public.schedule_dated_slots;
drop function if exists public.on_schedule_publish();

create or replace function private.on_schedule_publish() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.published = true and (tg_op = 'INSERT' or old.published is distinct from new.published) then
    insert into public.notification_events (truck_id, kind, payload)
    values (
      new.truck_id,
      'schedule_changed',
      jsonb_build_object('slot_table', tg_table_name, 'slot_id', new.id)
    );
  end if;
  return new;
end $$;

revoke execute on function private.on_schedule_publish() from public;
grant execute on function private.on_schedule_publish() to authenticated;

create trigger on_template_publish
  after insert or update on public.schedule_template_slots
  for each row execute function private.on_schedule_publish();

create trigger on_dated_publish
  after insert or update on public.schedule_dated_slots
  for each row execute function private.on_schedule_publish();
