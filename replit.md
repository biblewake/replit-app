# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Supabase Edge Functions

The mobile app calls two Supabase Edge Functions (in `supabase/functions/`) instead of the local API server for production/TestFlight builds:

- `verses` — Bible verse lookup and suggestions (uses OpenAI)
- `transcribe` — Audio transcription (uses Deepgram)

Before deploying the edge functions, set the required secrets in your Supabase project:

```
supabase secrets set OPENAI_API_KEY=<your-key>
supabase secrets set DEEPGRAM_API_KEY=<your-key>
```

Then deploy with:

```
supabase functions deploy verses
supabase functions deploy transcribe
```

The mobile app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (already required for auth) to construct the functions base URL — no additional env vars are needed in the app bundle. The local API server (`artifacts/api-server`) remains available for dev use.

## EAS Build (TestFlight)

The mobile app uses [Expo Application Services (EAS)](https://expo.dev/eas) for building and submitting to TestFlight and the App Store.

### Build profiles (`artifacts/mobile/eas.json`)

| Profile | Distribution | Use case |
|---|---|---|
| `development` | Internal (simulator) | Local dev client builds |
| `preview` | Internal | TestFlight / ad-hoc testing |
| `production` | Store | App Store submission |

**Trigger a TestFlight build:**
```
cd artifacts/mobile
eas build --profile preview --platform ios
```

### Required EAS secrets

These `EXPO_PUBLIC_*` vars are baked into the app bundle at build time — they must be added as EAS project secrets before running any `preview` or `production` build:

```
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value <your-value>
```

### OAuth scheme note

`app.json` uses `scheme: "mobile"`, which means OAuth redirect URIs must be registered as `mobile://` in both the Google Cloud Console and Apple Service ID. The `associatedDomains` entry (`applinks:cmaysraaclfvofiynctl.supabase.co`) is for universal links (Supabase magic-link email auth) and should remain as-is. Verify your Google OAuth client has `mobile://` listed as an authorized redirect URI before a production build.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
