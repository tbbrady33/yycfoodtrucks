-- DEV TEST: flip must_change_password on a specific user's profile so we can
-- exercise the force-change-password redirect in the app.
--
-- *** EDIT THE EMAIL BELOW IF YOUR TEST ACCOUNT USES A DIFFERENT ADDRESS ***
--
-- If the email isn't found, this migration is a silent no-op (the WHERE
-- clause matches zero rows). That's fine — push it once and inspect.
--
-- Once you've tested the flow in the app, the change-password screen will
-- set must_change_password=false. There's no clean-up step required.

update public.profiles
set must_change_password = true
where id = (
  select id from auth.users where email = 'tbbrady33@gmail.com'
);
