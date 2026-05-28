-- 0002: Helper functions used by RLS policies (0004) and the status view (0003).

-- auth_role: returns the calling user's role.
-- SECURITY DEFINER so it bypasses RLS on profiles when called from policies.
-- Safe to expose: only ever returns the row matching auth.uid().
create or replace function public.auth_role() returns text
language sql security definer stable set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.auth_role() from public;
grant execute on function public.auth_role() to anon, authenticated;

-- current_truck_status: derives open/closed for a truck at a given moment.
-- Precedence: manual override > today's dated closure > today's dated open > today's template > closed.
-- SECURITY INVOKER so RLS on schedule tables still applies (anon only sees published rows).
create or replace function public.current_truck_status(p_truck_id uuid, p_now timestamptz default now())
returns text language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_override text;
  v_expires timestamptz;
  v_local_date date;
  v_local_time time;
  v_local_dow smallint;
begin
  select manual_override_status, manual_override_expires_at
    into v_override, v_expires
    from public.trucks where id = p_truck_id;

  if v_override is not null and (v_expires is null or v_expires > p_now) then
    return v_override;
  end if;

  v_local_date := (p_now at time zone 'America/Edmonton')::date;
  v_local_time := (p_now at time zone 'America/Edmonton')::time;
  v_local_dow  := extract(dow from (p_now at time zone 'America/Edmonton'))::smallint;

  -- Dated closure overrides everything else for the window
  if exists (
    select 1 from public.schedule_dated_slots
    where truck_id = p_truck_id
      and published = true
      and slot_date = v_local_date
      and kind = 'closure'
      and v_local_time between start_time and end_time
  ) then
    return 'closed';
  end if;

  -- Dated addition / replacement opens the truck for its window
  if exists (
    select 1 from public.schedule_dated_slots
    where truck_id = p_truck_id
      and published = true
      and slot_date = v_local_date
      and kind in ('addition', 'replacement')
      and v_local_time between start_time and end_time
  ) then
    return 'open';
  end if;

  -- Fall back to the weekly template
  if exists (
    select 1 from public.schedule_template_slots
    where truck_id = p_truck_id
      and published = true
      and day_of_week = v_local_dow
      and v_local_time between start_time and end_time
  ) then
    return 'open';
  end if;

  return 'closed';
end $$;

grant execute on function public.current_truck_status(uuid, timestamptz) to anon, authenticated;
