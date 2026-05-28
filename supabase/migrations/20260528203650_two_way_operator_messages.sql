-- 0015: Make operator_messages two-way so operators can reply to admins.
--
-- Allowed sender→recipient pairs after this migration:
--   admin    → admin       (admin-to-admin notes, ok)
--   admin    → operator    (the original use case from 0014)
--   operator → admin       (replies, the addition here)
--
-- operator→operator is NOT allowed (operators don't communicate via this
-- channel; that channel just doesn't exist). The recipient-role trigger
-- enforces the pair set; RLS just needs to relax "admin only inserts".

drop policy if exists operator_messages_insert_admin on public.operator_messages;
create policy operator_messages_insert on public.operator_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.auth_role() in ('admin', 'operator')
  );

-- Sender should be able to read their own outgoing messages too.
drop policy if exists operator_messages_select_recipient_or_admin on public.operator_messages;
create policy operator_messages_select on public.operator_messages
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or sender_id    = (select auth.uid())
    or public.auth_role() = 'admin'
  );

-- Replace the recipient-role trigger with a pair-aware one.
create or replace function private.guard_operator_message_recipient() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_sender_role    text;
  v_recipient_role text;
begin
  select role into v_sender_role    from public.profiles where id = new.sender_id;
  select role into v_recipient_role from public.profiles where id = new.recipient_id;

  if v_sender_role is null then
    raise exception 'Sender profile not found';
  end if;
  if v_recipient_role is null then
    raise exception 'Recipient profile not found';
  end if;

  if v_sender_role = 'admin'    and v_recipient_role in ('admin', 'operator') then
    return new;
  end if;
  if v_sender_role = 'operator' and v_recipient_role = 'admin' then
    return new;
  end if;

  raise exception
    'Disallowed sender/recipient pair for operator_messages (% -> %)',
    v_sender_role, v_recipient_role;
end $$;
