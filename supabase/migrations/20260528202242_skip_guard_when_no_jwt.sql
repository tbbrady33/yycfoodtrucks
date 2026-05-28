-- 0013: Skip the role/status guards when auth.uid() is NULL.
--
-- 0011's triggers raise when a non-admin tries to change profiles.role
-- (or reviews.status). But auth.uid() returns NULL in three contexts
-- we trust:
--
--   1) The SQL editor — runs as postgres (bypasses RLS, no JWT).
--   2) Migrations and psql sessions — same.
--   3) The admin-create-operator Edge Function and any other code using
--      the service_role key — service_role JWTs carry no `sub` claim,
--      so auth.uid() is NULL.
--
-- Anonymous app users also have auth.uid() = NULL, but RLS on profiles
-- and reviews UPDATE is restricted to `to authenticated`, so anon never
-- reaches these triggers. The short-circuit is therefore safe: if we
-- got this far AND auth.uid() is NULL, the caller is a trusted
-- privileged context.

create or replace function private.guard_profile_role_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role
     and private._auth_role() is distinct from 'admin' then
    raise exception 'profiles.role can only be changed by an admin';
  end if;
  return new;
end $$;

create or replace function private.guard_review_status_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status is distinct from old.status
     and private._auth_role() is distinct from 'admin' then
    raise exception 'reviews.status can only be changed by an admin';
  end if;
  return new;
end $$;
