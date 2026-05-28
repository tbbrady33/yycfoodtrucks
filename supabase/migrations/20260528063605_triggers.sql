-- 0005: Triggers — auth user → profile, schedule publish → notification_events,
-- review_flags insert → reviews.status='flagged'.

-- Auto-create a profiles row when an auth.users row is inserted.
-- SECURITY DEFINER required (insert into public.profiles bypasses RLS).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;

-- When a schedule slot becomes published (insert with published=true OR
-- update flipping published from false to true), emit a notification event.
-- This is what Step 9's dispatch-notifications Edge Function reacts to.
create or replace function public.on_schedule_publish() returns trigger
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

create trigger on_template_publish
  after insert or update on public.schedule_template_slots
  for each row execute function public.on_schedule_publish();

create trigger on_dated_publish
  after insert or update on public.schedule_dated_slots
  for each row execute function public.on_schedule_publish();

revoke execute on function public.on_schedule_publish() from public;

-- Any flag transitions the review to 'flagged' for admin review.
-- SECURITY DEFINER because the flagger's RLS update policy on reviews is
-- restricted to their own rows (and even then can't change status).
create or replace function public.handle_review_flag() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.reviews
    set status = 'flagged'
  where id = new.review_id
    and status = 'visible'; -- don't flip already-removed reviews
  return new;
end $$;

create trigger on_review_flag_inserted
  after insert on public.review_flags
  for each row execute function public.handle_review_flag();

revoke execute on function public.handle_review_flag() from public;
