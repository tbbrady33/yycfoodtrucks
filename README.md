# YYC Street Food

Native mobile directory + live-status tracker for Calgary street food trucks.

Three roles share one Expo app, gated by `profiles.role` + RLS:

- **Customer** — anonymous browse; account required to favorite a truck, submit reviews, and submit contact requests
- **Operator** — admin-invited only; edits their truck(s), menu, weekly schedule; toggles open/closed override; draft → Publish
- **Admin** — invites/removes operators; sees customer contact requests; moderates flagged reviews; two-way messaging with operators

Approved plan: `~/.claude/plans/project-yyc-street-federated-lobster.md`

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 56 + TypeScript + Expo Router (file-based) |
| Styling | NativeWind v4 + Tailwind v3 |
| Components | gluestack-ui v3 (scaffolded into `src/components/ui/`) |
| Maps | `expo-maps` + client-side geocoding via `expo-location` |
| Forms | React Hook Form + Zod |
| Data | TanStack Query over `@supabase/supabase-js` |
| Auth | Supabase Auth + `expo-secure-store` for session persistence |
| Backend | Supabase Postgres + RLS + Edge Functions (Deno) |
| Push | `expo-notifications` + Expo Push API |
| Build | EAS Build / Submit / Update |

## Local development

```bash
cp .env.example .env       # then fill EXPO_PUBLIC_SUPABASE_URL + _KEY
npm install
npm run ios                # iOS simulator (Expo Go)
# or
npm run start              # Metro only, scan QR with Expo Go
```

Cache busting after babel / metro config changes:

```bash
npm run ios -- --clear
```

### Push notifications + map require a dev client

Both features need a custom dev client (Expo Go can't receive APNs pushes since SDK 53, and expo-maps' marker rendering needs native code). For browse / auth / forms / operator / admin flows, plain Expo Go in the simulator works.

```bash
# Build once per major iOS change
eas build -p ios --profile development

# Install the resulting .ipa on the simulator or a physical device,
# then:
npm run ios:dev-client     # uses the dev client instead of Expo Go
```

## Test accounts (local SQL)

After seeding `supabase/seed_dev.sql`, promote yourself to an operator + assign the seeded `Big Cheese` truck:

```sql
update public.profiles
   set role = 'operator'
 where id = (select id from auth.users where email = 'YOUR_EMAIL');

update public.trucks
   set owner_id = (select id from auth.users where email = 'YOUR_EMAIL')
 where slug = 'big-cheese';
```

Or to flip to admin:

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

## Project layout

```
app.json                    Expo config: bundle id com.tbbrady33.yycfoodtruck, scheme yycfoodtruck
eas.json                    EAS Build profiles
src/
  app/                      Expo Router screens (file-based routing)
    index.tsx               Landing — dispatches on role (customer/operator/admin)
    sign-in.tsx             Email + password
    change-password.tsx     Force-change flow for first sign-in
    auth-callback.tsx       PKCE invite-link landing (currently unused; flip
                            admin-create-operator back to inviteUserByEmail to enable)
    contact.tsx             Anonymous → admin contact form
    map.tsx                 Truck map (expo-maps + geocoded slot addresses)
    operator-messages.tsx   Admin ↔ operator thread
    (public)/               Truck list, truck profile, category listing
    (customer)/             Auth-required: favorites, inbox, write-review
    (operator)/             Operator-or-admin: dashboard, edit, menu, schedule
    (admin)/                Admin-only: operators, contact requests, flagged reviews
  components/               TruckCard + StatusPill + AuthRedirect + gluestack UI
  lib/
    supabase.ts             Client init (SecureStore session, PKCE)
    session.tsx             SessionProvider context + push token registration
    push.ts                 expo-notifications registration (no-ops in Expo Go/sim)
    geocode.ts              Address → coords cache for the map
    auth-gates.tsx          useRequireAuth / useRequireOperator / useRequireAdmin
    error-message.ts        Extracts readable text from Supabase / Error / unknown
    queries/                One file per table-ish concern
supabase/
  config.toml               Supabase CLI config
  migrations/               17 migrations, latest at the bottom
  functions/                Edge Functions (Deno)
    admin-create-operator/  Creates operator (temp password mode) or invite link mode
    admin-delete-operator/  Removes operator; trucks survive ownerless
    dispatch-notifications/ Cron-fired fan-out to Expo Push
  seed_dev.sql              ~8 sample trucks + menus + schedules; paste manually
```

## Backend setup (one-time per Supabase project)

### 1. Push migrations

```bash
supabase login
supabase link --project-ref <REF>
supabase db push -p <DB_PASSWORD>
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy admin-create-operator
supabase functions deploy admin-delete-operator
supabase functions deploy dispatch-notifications
```

### 3. Enable Postgres extensions

Dashboard → Database → Extensions → enable:

- `pg_cron` — minute schedule for `compute-open-transitions`
- `pg_net` — Postgres → Edge Function HTTP calls

### 4. Install cron jobs

In SQL editor:

```sql
-- Open/closed transitions every minute
select cron.schedule(
  'compute-open-transitions',
  '* * * * *',
  $$select private.compute_open_transitions()$$
);

-- Service-role JWT stored in Vault (read full key from Project Settings → API)
select vault.create_secret(
  'eyJ...PASTE_FULL_SERVICE_ROLE_JWT_HERE',
  'service_role_key',
  'Used by dispatch-notifications cron'
);

create or replace function private.dispatch_notifications_via_http()
returns void language plpgsql security definer set search_path = '' as $body$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  perform net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    )
  );
end $body$;

revoke execute on function private.dispatch_notifications_via_http() from public;

select cron.schedule(
  'dispatch-notifications',
  '* * * * *',
  $$select private.dispatch_notifications_via_http()$$
);
```

### 5. Seed dev data

Paste `supabase/seed_dev.sql` into the SQL editor — idempotent; safe to re-run.

### 6. (Optional) Enable leaked-password protection

Dashboard → Authentication → Providers → Email → toggle on "Check for compromised passwords". Closes the lone advisor warning.

## Push notification delivery setup (Apple)

Required for pushes to reach a real device. Skip until you're ready to TestFlight.

1. Apple Developer Program ($99/yr): https://developer.apple.com/programs/
2. Generate an APNs Auth Key in App Store Connect → Keys (`.p8` file)
3. Upload to EAS: `eas credentials -p ios` → "Push Notifications: Manage your Apple Push Notifications Key" → upload the `.p8`
4. Build dev client: `eas build -p ios --profile development`
5. Install on a physical device — signing in registers a real Expo push token in `push_tokens`

Trigger a test push from the SQL editor:

```sql
-- Find a truck you follow
insert into public.notification_events (truck_id, kind, payload)
select id, 'opened', jsonb_build_object('via', 'manual-test')
  from public.trucks where slug = 'big-cheese';
```

Within ~60 seconds (next cron tick) the dispatcher fans it out via Expo Push API and the device receives it.

## EAS

```bash
eas build -p ios --profile development   # dev client (push + maps testing)
eas build -p ios --profile production    # release build
eas submit -p ios                        # App Store upload
```

EAS projectId: `5ded073b-6fc1-4d02-badf-9e390affba8d` (`@tbbrady33/yyc-foodtruck`).

### TestFlight checklist

- [ ] APNs key uploaded to EAS
- [ ] Production build green: `eas build -p ios --profile production`
- [ ] App Store Connect listing created (name, subtitle, primary category)
- [ ] Screenshots: 6.5" + 5.5" iPhone (use simulator screenshots from a few key flows)
- [ ] Privacy nutrition labels (collects: email, name, contact info via `contact_requests`; uses precise location for the map)
- [ ] Review notes describing the demo admin / operator / customer accounts
- [ ] `eas submit -p ios` and wait for App Store review (~24-48h typically)

## Outstanding items / known TODOs

- **Email-based invites**: scaffolding is in place (`flowType: pkce`, `auth-callback.tsx`) but `admin-create-operator` is currently in temp-password mode. To enable: flip the Edge Function back to `inviteUserByEmail` and whitelist `yycfoodtruck://auth-callback` in Supabase Auth → URL Configuration → Redirect URLs.
- **Map markers' tap callback**: expo-maps' onMarkerPress is platform-spotty in SDK 56; the chip row below the map is the fallback nav.
- **Drag-reorder for menus**: deferred (4-item menus didn't warrant the dep). Position is append-on-create.
- **Schedule conflict detection**: an operator can create overlapping template slots for the same day. Add a check trigger in a future migration if needed.
- **Operator reply for reviews**: deliberately deferred per the original brief — moderation only, no operator response.
- **pgTAP tests**: written-out RLS expectations live in commit history; running them needs Docker + the local Supabase stack. Set up in CI when ready.

## License

See [LICENSE](./LICENSE).
