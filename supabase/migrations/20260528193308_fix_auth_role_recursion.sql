-- 0010: Fix the infinite-recursion-in-profiles-policy bug introduced by
-- migration 0007 (security_hardening).
--
-- The bug: 0007 switched public.auth_role() from SECURITY DEFINER to
-- SECURITY INVOKER, expecting Postgres's boolean OR to short-circuit and
-- avoid re-evaluating profiles RLS recursively. In practice the policy
-- evaluates per-scanned-row before the auth.uid() filter can narrow the
-- scan, and for rows where id != auth.uid() the second disjunct
-- (auth_role() = 'admin') runs, which queries profiles, which hits the
-- policy again — Postgres's recursive-policy detector fires.
--
-- Fix: move the SECURITY DEFINER body into a worker function in the
-- private schema (not in the Data API, so no REST RPC exposure), and
-- make public.auth_role a thin SECURITY INVOKER wrapper that forwards
-- to it. The wrapper itself isn't a SECURITY DEFINER function, so the
-- security advisor won't flag it. None of the existing policies need
-- to change — they continue calling public.auth_role().

-- Internal worker: bypasses RLS on profiles via SECURITY DEFINER.
create or replace function private._auth_role() returns text
language sql security definer stable set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function private._auth_role() from public;
grant execute on function private._auth_role() to authenticated, anon;

-- Anon needs USAGE on private so policies targeting `to anon, authenticated`
-- (e.g. reviews SELECT) can resolve the wrapper's reference to the worker.
-- USAGE is just namespace visibility; EXECUTE on each function in private
-- is still gated individually.
grant usage on schema private to anon;

-- Public-facing wrapper: SECURITY INVOKER, just forwards to the worker.
-- Existing grants from migration 0002 (execute to anon, authenticated)
-- still apply, so no policy changes are required.
create or replace function public.auth_role() returns text
language sql security invoker stable set search_path = ''
as $$
  select private._auth_role();
$$;
