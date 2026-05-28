-- 0011: Move the "value-unchanged" guards out of WITH CHECK clauses into
-- BEFORE UPDATE triggers.
--
-- 0010 fixed the auth_role wrapper so direct calls to it no longer recurse,
-- but the profiles UPDATE policy and reviews UPDATE policy still contain
-- scalar subqueries on the same table:
--
--   profiles WITH CHECK:
--     role = (select role from public.profiles where id = (select auth.uid()))
--
--   reviews WITH CHECK:
--     status = (select status from public.reviews r2 where r2.id = reviews.id)
--
-- Even when those subqueries resolve to a single PK-indexed row that
-- short-circuits the inner policy, Postgres's recursion detector looks at
-- the evaluation stack and refuses to evaluate "policy on T calls a
-- subquery on T". The change-password flow hits this because operators
-- updating their own profile must pass the WITH CHECK.
--
-- Fix: keep the policies simple ownership/admin checks, and enforce the
-- "can't change role/status unless admin" rule via SECURITY DEFINER
-- triggers that bypass RLS (and live in the private schema so they aren't
-- reachable via /rest/v1/rpc).

----------------------------------------------------------------------
-- profiles: trigger-guarded role changes + simplified policy
----------------------------------------------------------------------
create or replace function private.guard_profile_role_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and private._auth_role() is distinct from 'admin' then
    raise exception 'profiles.role can only be changed by an admin';
  end if;
  return new;
end $$;

revoke execute on function private.guard_profile_role_change() from public;
grant execute on function private.guard_profile_role_change() to authenticated;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function private.guard_profile_role_change();

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.auth_role() = 'admin')
  with check (id = (select auth.uid()) or public.auth_role() = 'admin');

----------------------------------------------------------------------
-- reviews: trigger-guarded status changes + simplified policy
----------------------------------------------------------------------
create or replace function private.guard_review_status_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and private._auth_role() is distinct from 'admin' then
    raise exception 'reviews.status can only be changed by an admin';
  end if;
  return new;
end $$;

revoke execute on function private.guard_review_status_change() from public;
grant execute on function private.guard_review_status_change() to authenticated;

drop trigger if exists guard_review_status on public.reviews;
create trigger guard_review_status
  before update on public.reviews
  for each row execute function private.guard_review_status_change();

drop policy if exists reviews_update_own_or_admin on public.reviews;
create policy reviews_update_own_or_admin on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) or public.auth_role() = 'admin')
  with check (author_id = (select auth.uid()) or public.auth_role() = 'admin');
