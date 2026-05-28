-- 0004: Row-Level Security policies for every public table.
--
-- Conventions (per Supabase agent skill guidance, 2026-05):
--   - Every policy targets a specific role via `to anon` / `to authenticated`
--     (the deprecated `auth.role() = '...'` pattern is not used anywhere).
--   - UPDATE policies always include both `using` and `with check` clauses.
--   - `(select auth.uid())` is wrapped to let Postgres cache the value per query.
--   - Reads from public.profiles inside policies go through public.auth_role()
--     (SECURITY DEFINER) so the profiles SELECT policy doesn't matter to them.
--   - notification_events has no policies — RLS is enabled and the only
--     accessor is the service_role (from Edge Functions).

alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.trucks                 enable row level security;
alter table public.menu_items             enable row level security;
alter table public.schedule_template_slots enable row level security;
alter table public.schedule_dated_slots   enable row level security;
alter table public.follows                enable row level security;
alter table public.push_tokens            enable row level security;
alter table public.notification_events    enable row level security;
alter table public.contact_requests       enable row level security;
alter table public.reviews                enable row level security;
alter table public.review_flags           enable row level security;

----------------------------------------------------------------------
-- profiles
----------------------------------------------------------------------
-- A user can read their own row; admins can read everything.
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.auth_role() = 'admin');

-- A user can update their own row but cannot self-promote.
-- The subquery reads the OLD role (the row isn't updated yet at check time),
-- so `role = (...)` forces NEW.role to equal OLD.role.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select role from public.profiles where id = (select auth.uid()))
  );

-- Admins can update any profile, including role.
create policy profiles_admin_update_any on public.profiles
  for update to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- No INSERT / DELETE policies on profiles: inserts go through the
-- on_auth_user_created trigger; deletes cascade from auth.users.

----------------------------------------------------------------------
-- categories
----------------------------------------------------------------------
create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (true);
-- No write policies — categories are seeded by migration only.

----------------------------------------------------------------------
-- trucks
----------------------------------------------------------------------
create policy trucks_select_public on public.trucks
  for select to anon, authenticated
  using (true);

create policy trucks_owner_or_admin_insert on public.trucks
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or public.auth_role() = 'admin');

create policy trucks_owner_or_admin_update on public.trucks
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.auth_role() = 'admin')
  with check (owner_id = (select auth.uid()) or public.auth_role() = 'admin');

create policy trucks_owner_or_admin_delete on public.trucks
  for delete to authenticated
  using (owner_id = (select auth.uid()) or public.auth_role() = 'admin');

----------------------------------------------------------------------
-- menu_items
----------------------------------------------------------------------
create policy menu_items_select_public on public.menu_items
  for select to anon, authenticated
  using (true);

create policy menu_items_owner_or_admin_insert on public.menu_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = menu_items.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy menu_items_owner_or_admin_update on public.menu_items
  for update to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = menu_items.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = menu_items.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy menu_items_owner_or_admin_delete on public.menu_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = menu_items.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

----------------------------------------------------------------------
-- schedule_template_slots
----------------------------------------------------------------------
-- Public sees published only; owner sees their drafts too.
create policy schedule_template_select_public_or_owner on public.schedule_template_slots
  for select to anon, authenticated
  using (
    published = true
    or exists (
      select 1 from public.trucks t
      where t.id = schedule_template_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_template_owner_insert on public.schedule_template_slots
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_template_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_template_owner_update on public.schedule_template_slots
  for update to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_template_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_template_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_template_owner_delete on public.schedule_template_slots
  for delete to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_template_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

----------------------------------------------------------------------
-- schedule_dated_slots (same shape as template)
----------------------------------------------------------------------
create policy schedule_dated_select_public_or_owner on public.schedule_dated_slots
  for select to anon, authenticated
  using (
    published = true
    or exists (
      select 1 from public.trucks t
      where t.id = schedule_dated_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_dated_owner_insert on public.schedule_dated_slots
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_dated_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_dated_owner_update on public.schedule_dated_slots
  for update to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_dated_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_dated_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

create policy schedule_dated_owner_delete on public.schedule_dated_slots
  for delete to authenticated
  using (
    exists (
      select 1 from public.trucks t
      where t.id = schedule_dated_slots.truck_id
        and (t.owner_id = (select auth.uid()) or public.auth_role() = 'admin')
    )
  );

----------------------------------------------------------------------
-- follows (a.k.a. favorites)
----------------------------------------------------------------------
create policy follows_select_own_or_admin on public.follows
  for select to authenticated
  using (user_id = (select auth.uid()) or public.auth_role() = 'admin');

create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy follows_delete_own on public.follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

----------------------------------------------------------------------
-- push_tokens
----------------------------------------------------------------------
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

----------------------------------------------------------------------
-- contact_requests
----------------------------------------------------------------------
-- Anyone can submit a request. If they're signed in, the submitter_id
-- must match auth.uid() (an anon caller submits with submitter_id = null).
create policy contact_requests_insert_public on public.contact_requests
  for insert to anon, authenticated
  with check (submitter_id is null or submitter_id = (select auth.uid()));

-- Submitter sees their own; admins see all.
create policy contact_requests_select_admin_or_submitter on public.contact_requests
  for select to authenticated
  using (public.auth_role() = 'admin' or submitter_id = (select auth.uid()));

-- Only admins can transition status.
create policy contact_requests_update_admin on public.contact_requests
  for update to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

----------------------------------------------------------------------
-- reviews
----------------------------------------------------------------------
-- Public sees visible only. Authors see their own regardless of status
-- (so they know it's been flagged/removed). Admins see everything.
create policy reviews_select_visible_or_own_or_admin on public.reviews
  for select to anon, authenticated
  using (
    status = 'visible'
    or author_id = (select auth.uid())
    or public.auth_role() = 'admin'
  );

-- Authors insert their own reviews; reviews always start visible.
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'visible');

-- Authors can edit rating/body but not status; status changes go through
-- the admin policy below or the on_review_flag trigger.
create policy reviews_update_own_body on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and status = (select status from public.reviews r2 where r2.id = reviews.id)
  );

create policy reviews_admin_moderate on public.reviews
  for update to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy reviews_delete_own_or_admin on public.reviews
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.auth_role() = 'admin');

----------------------------------------------------------------------
-- review_flags
----------------------------------------------------------------------
-- Any signed-in user can flag a visible review; one flag per (review, user).
create policy review_flags_insert_own on public.review_flags
  for insert to authenticated
  with check (flagger_id = (select auth.uid()));

-- Flagger sees their own flags; admins see all.
create policy review_flags_select_admin_or_own on public.review_flags
  for select to authenticated
  using (public.auth_role() = 'admin' or flagger_id = (select auth.uid()));

create policy review_flags_delete_admin on public.review_flags
  for delete to authenticated
  using (public.auth_role() = 'admin');
