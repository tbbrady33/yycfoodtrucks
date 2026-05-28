-- 0014: Admin → operator messaging.
--
-- A one-way channel from admin/management to a specific operator.
-- Operators can mark read; admins can read all and send any.
--
-- Not in the original v1 plan; added 2026-05-28 per user request after
-- Step 8 lit up. Push notifications for these messages are deferred to
-- Phase 2 — the in-app inbox is enough for the brief.

create table public.operator_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_operator_messages_recipient
  on public.operator_messages(recipient_id, created_at desc);

create index idx_operator_messages_unread
  on public.operator_messages(recipient_id)
  where read_at is null;

----------------------------------------------------------------------
-- RLS
----------------------------------------------------------------------
alter table public.operator_messages enable row level security;

-- Insert: caller must be admin and stamp themselves as sender.
create policy operator_messages_insert_admin on public.operator_messages
  for insert to authenticated
  with check (
    public.auth_role() = 'admin'
    and sender_id = (select auth.uid())
  );

-- Select: recipients see their own; admins see all.
create policy operator_messages_select_recipient_or_admin on public.operator_messages
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or public.auth_role() = 'admin'
  );

-- Update: recipients (to set read_at) and admins. Column-level enforcement
-- lives in the trigger below — RLS only enforces ownership.
create policy operator_messages_update_recipient_or_admin on public.operator_messages
  for update to authenticated
  using (
    recipient_id = (select auth.uid())
    or public.auth_role() = 'admin'
  )
  with check (
    recipient_id = (select auth.uid())
    or public.auth_role() = 'admin'
  );

----------------------------------------------------------------------
-- Triggers
----------------------------------------------------------------------

-- On INSERT: recipient must be operator or admin (no customers).
create or replace function private.guard_operator_message_recipient() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = new.recipient_id;
  if v_role is null then
    raise exception 'Recipient profile not found';
  end if;
  if v_role not in ('operator', 'admin') then
    raise exception 'Operator messages can only be sent to operators or admins';
  end if;
  return new;
end $$;

revoke execute on function private.guard_operator_message_recipient() from public;
grant execute on function private.guard_operator_message_recipient() to authenticated;

create trigger guard_operator_message_recipient
  before insert on public.operator_messages
  for each row execute function private.guard_operator_message_recipient();

-- On UPDATE: recipients may only modify read_at. Same NULL-auth.uid()
-- escape hatch as the other guards (Step 8 fix) so service_role / SQL
-- editor aren't blocked.
create or replace function private.guard_operator_message_update() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if private._auth_role() = 'admin' then
    return new;
  end if;
  if new.id           is distinct from old.id
     or new.sender_id    is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.subject      is distinct from old.subject
     or new.body         is distinct from old.body
     or new.created_at   is distinct from old.created_at then
    raise exception 'Only read_at may be updated on operator_messages by non-admins';
  end if;
  return new;
end $$;

revoke execute on function private.guard_operator_message_update() from public;
grant execute on function private.guard_operator_message_update() to authenticated;

create trigger guard_operator_message_update
  before update on public.operator_messages
  for each row execute function private.guard_operator_message_update();
