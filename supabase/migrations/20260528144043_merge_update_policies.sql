-- 0008: Collapse the (self) + (admin) update policy pairs on profiles and
-- reviews into single policies. Same semantics; one auth_role() call per
-- write instead of two. Closes the performance advisor warnings about
-- "multiple permissive policies for action UPDATE".

-- profiles
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_update_any on public.profiles;

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.auth_role() = 'admin')
  with check (
    -- Admin can change anything on any row.
    public.auth_role() = 'admin'
    or (
      -- Otherwise it must be the user's own row AND role must not change.
      id = (select auth.uid())
      and role = (select role from public.profiles where id = (select auth.uid()))
    )
  );

-- reviews
drop policy if exists reviews_update_own_body on public.reviews;
drop policy if exists reviews_admin_moderate on public.reviews;

create policy reviews_update_own_or_admin on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) or public.auth_role() = 'admin')
  with check (
    -- Admin moderates: can set status to anything.
    public.auth_role() = 'admin'
    or (
      -- Author edits: own row, status unchanged (can't un-flag yourself).
      author_id = (select auth.uid())
      and status = (select status from public.reviews r2 where r2.id = reviews.id)
    )
  );
