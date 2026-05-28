-- 0003: v_trucks_with_status — the join the mobile app actually queries.
-- security_invoker = true so RLS on the underlying tables still applies
-- (otherwise an anon caller would see drafts via the view, defeating RLS).

create or replace view public.v_trucks_with_status
with (security_invoker = true) as
select
  t.id,
  t.slug,
  t.name,
  t.description,
  t.hero_image_path,
  t.owner_id,
  t.category_id,
  c.slug as category_slug,
  c.name as category_name,
  public.current_truck_status(t.id, now()) as status,
  coalesce(r.avg_rating, 0)::numeric(2,1) as avg_rating,
  coalesce(r.review_count, 0)::int as review_count,
  t.created_at,
  t.updated_at
from public.trucks t
join public.categories c on c.id = t.category_id
left join lateral (
  -- Only visible reviews count toward the public-facing average.
  select avg(rating)::numeric(2,1) as avg_rating, count(*)::int as review_count
  from public.reviews
  where truck_id = t.id and status = 'visible'
) r on true;

grant select on public.v_trucks_with_status to anon, authenticated;
