# YYC Street Food

A native mobile directory + live-status tracker for Calgary street food trucks.

> Phase 1 in progress. Approved plan: `~/.claude/plans/project-yyc-street-federated-lobster.md`

## Stack

- **Expo SDK 56** + TypeScript + Expo Router
- **NativeWind v4 + Tailwind v3** for styling
- **gluestack-ui v3** for component primitives (scaffolded into `src/components/ui/`)
- **Supabase** (Postgres + Auth + Storage + RLS + Edge Functions) for backend
- **TanStack Query** + **supabase-js** for data
- **React Hook Form + Zod** for forms
- **expo-secure-store** for session, **expo-notifications** for push
- **EAS** Build / Submit / Update for shipping

## Get started

```bash
npm install
npm run ios      # iOS simulator (needs Xcode + a simulator runtime installed)
# or
npm run start    # Metro only; scan QR with Expo Go on a physical device
```

For push notifications you'll need a custom dev client — `npm run ios` with Expo Go won't deliver pushes. That's Step 9 of the plan; for browse / auth / forms during Steps 1–8 the simulator is fine.

## Project layout

```
app.json                       Expo config; bundle id com.tbbrady33.yycfoodtruck
eas.json                       EAS Build profiles (development, preview, production)
src/
  app/                         Expo Router screens (file-based routing)
  components/                  Themed components + UI primitives
    ui/gluestack-ui-provider/  gluestack v3 provider (scaffolded by `gluestack-ui init`)
  constants/theme.ts           Color tokens (light/dark)
  hooks/                       useColorScheme, useTheme
  global.css                   Tailwind entry; consumed by Metro via metro.config.js
supabase/                      (Step 2) migrations, Edge Functions, RLS tests
```

## EAS

```bash
eas build -p ios --profile development   # dev client (Step 9)
eas build -p ios --profile production    # release build
eas submit -p ios                        # App Store upload
```

EAS projectId: `5ded073b-6fc1-4d02-badf-9e390affba8d` (`@tbbrady33/yyc-foodtruck`).

## License

See [LICENSE](./LICENSE).
