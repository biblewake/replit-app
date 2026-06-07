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

### Automatic re-deployment (GitHub Actions)

`.github/workflows/deploy-edge-functions.yml` watches `supabase/functions/**` and automatically runs `supabase functions deploy` for both functions on every push to `main`. Two repository secrets must be set for this to work:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_ID` | Settings → General → Reference ID in your Supabase project dashboard |

Add them at **GitHub repo → Settings → Secrets and variables → Actions**.

## EAS Build (iOS & Android)

The mobile app uses [Expo Application Services (EAS)](https://expo.dev/eas) for building and submitting to TestFlight, the App Store, and Google Play.

### Build profiles (`artifacts/mobile/eas.json`)

| Profile | Distribution | Use case |
|---|---|---|
| `development` | Internal (simulator/device) | Local dev client builds |
| `preview` | Internal | TestFlight / ad-hoc Android APK testing |
| `production` | Store | App Store + Google Play submission |

**Trigger a TestFlight build:**
```
cd artifacts/mobile
eas build --profile preview --platform ios
```

**Trigger a signed Android AAB for Google Play:**
```
cd artifacts/mobile
eas build --profile production --platform android
```

**Submit to Google Play:**
```
cd artifacts/mobile
eas submit --profile production --platform android
```

### Required EAS secrets

These `EXPO_PUBLIC_*` vars are baked into the app bundle at build time — they must be added as EAS project secrets before running any `preview` or `production` build:

```
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value <your-value>
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value <your-value>
```

### Google Play setup (one-time, manual steps)

Before `eas submit` can upload to Google Play, you need:

1. **Google Play Console listing** — Create the app at [play.google.com/console](https://play.google.com/console):
   - App name: **Bible Wake**
   - Package name: `com.tinochiwara.biblewake`
   - Fill in the store listing (description, screenshots, content rating, etc.)

2. **Service account key** — Grant EAS permission to upload on your behalf:
   - In Google Play Console → Setup → API access, link a Google Cloud project
   - Create a service account with the **Release Manager** role
   - Download the JSON key and save it to `artifacts/mobile/google-play-service-account.json`
   - **Do not commit this file** — add it to `.gitignore`

3. **Initial manual upload** — Google Play requires the very first AAB to be uploaded manually via the console before `eas submit` can automate subsequent ones. Build with `eas build --profile production --platform android`, download the AAB from the EAS dashboard, and upload it manually to the Internal Testing track in Play Console.

The `eas.json` `submit.production.android` block is already configured to use `./google-play-service-account.json` and targets the `internal` track — change `track` to `"production"` when you are ready for the public release.

### OAuth scheme note

`app.json` uses `scheme: "mobile"`, which means OAuth redirect URIs must be registered as `mobile://` in both the Google Cloud Console and Apple Service ID. The `associatedDomains` entry (`applinks:cmaysraaclfvofiynctl.supabase.co`) is for universal links (Supabase magic-link email auth) and should remain as-is. Verify your Google OAuth client has `mobile://` listed as an authorized redirect URI before a production build.

## Gotchas

- **Edge function changes require a re-deploy.** Code edits to `supabase/functions/verses/` or `supabase/functions/transcribe/` are NOT picked up automatically in production unless you push to `main` (which triggers the GitHub Action) or run `supabase functions deploy <name>` manually. Forgetting this step means the app silently uses stale function code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
