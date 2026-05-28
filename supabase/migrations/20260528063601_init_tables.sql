-- 0001: Tables, indexes, and the generic updated_at trigger.
-- All tables live in `public`. RLS is enabled in 0004 (a later migration),
-- so this file is intentionally policy-free.

-- profiles: one row per auth.users entry.
-- Role lives here (not in user_metadata) so it cannot be self-edited.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'operator', 'admin')),
  display_name text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- categories: the 6 top-level browse filters. Seeded in 0006.
create table public.categories (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  position smallint not null default 0
);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  category_id smallint not null references public.categories(id),
  slug text not null unique,
  name text not null,
  description text,
  hero_image_path text,
  -- Hybrid open/closed: when override is set and not expired, it wins over schedule.
  manual_override_status text check (manual_override_status in ('open', 'closed')),
  manual_override_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Recurring weekly template; one row per (truck, dow, time-range, location).
create table public.schedule_template_slots (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  location_label text not null,
  address text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- One-offs and exceptions. `kind` controls how this interacts with the template:
--   addition  : extra slot the template didn't have
--   closure   : cancels any template slot that overlaps this date+window
--   replacement: same idea as addition but signals "moved my Tuesday lunch"
create table public.schedule_dated_slots (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  location_label text not null,
  address text not null,
  kind text not null check (kind in ('addition', 'closure', 'replacement')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- "Favorites" in the UI; called follows in the schema for queryability.
create table public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  truck_id uuid not null references public.trucks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, truck_id)
);

-- One row per (user, device). Refreshed on each app launch.
create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Append-only fan-out log. Edge Functions read and dispatch.
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  kind text not null check (kind in ('opened', 'schedule_changed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Customer-to-management form. submitter_id is null for anon submissions.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid references public.profiles(id) on delete set null,
  truck_id uuid references public.trucks(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  status text not null default 'visible' check (status in ('visible', 'flagged', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (truck_id, author_id) -- one review per user per truck; edits replace
);

-- Any single flag transitions the review to 'flagged' via the trigger in 0005.
create table public.review_flags (
  review_id uuid not null references public.reviews(id) on delete cascade,
  flagger_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (review_id, flagger_id)
);

-- Indexes
create index idx_trucks_category on public.trucks(category_id);
create index idx_trucks_owner on public.trucks(owner_id);
create index idx_menu_items_truck on public.menu_items(truck_id, position);
create index idx_template_truck_day on public.schedule_template_slots(truck_id, day_of_week) where published = true;
create index idx_dated_truck_date on public.schedule_dated_slots(truck_id, slot_date) where published = true;
create index idx_follows_truck on public.follows(truck_id);
create index idx_push_user on public.push_tokens(user_id);
create index idx_notification_events_truck_created on public.notification_events(truck_id, created_at);
create index idx_contact_requests_status on public.contact_requests(status, created_at);
create index idx_reviews_truck_visible on public.reviews(truck_id) where status = 'visible';
create index idx_reviews_author on public.reviews(author_id);
create index idx_review_flags_review on public.review_flags(review_id);

-- updated_at maintenance trigger (SECURITY INVOKER; harmless if called directly).
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trucks_updated_at before update on public.trucks
  for each row execute function public.tg_set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.tg_set_updated_at();
create trigger schedule_template_updated_at before update on public.schedule_template_slots
  for each row execute function public.tg_set_updated_at();
create trigger schedule_dated_updated_at before update on public.schedule_dated_slots
  for each row execute function public.tg_set_updated_at();
