# Journal8

A personal journal built with React, Vite, Tailwind/daisyUI, and [Supabase](https://supabase.com) (auth + Postgres). Hosted on Firebase Hosting.

## Setup

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/` (SQL editor, or `supabase db push` with the Supabase CLI).
3. Enable the Google provider under **Authentication → Providers**, and add your app URLs (e.g. `http://localhost:5173/journal`) to **Authentication → URL Configuration → Redirect URLs**.
4. Copy `.env.example` to `.env` and fill in your project URL and publishable key.
5. `bun install && bun run dev`

For CI deploys, set the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` repository secrets.

## AI workout planning

The Plan tab calls the `plan-workout` Edge Function (`supabase/functions/plan-workout`), which asks Claude for a weekly plan using your goals, current injuries and recent workouts. The Anthropic API key stays server-side as a Supabase secret:

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy plan-workout
```

Create the key at https://console.anthropic.com/settings/keys. Without it the Plan tab shows "AI planning isn't set up yet".

## Migrating from Firestore

`scripts/migrate-firestore-to-supabase.ts` copies existing Firestore entries into Supabase, matching users by email. Download a Firebase service account key (Project settings → Service accounts), save it as `firebase-service-account.json` (gitignored), set the variables listed in `.env.example`, then:

```sh
node --experimental-strip-types --env-file=.env scripts/migrate-firestore-to-supabase.ts --dry-run
node --experimental-strip-types --env-file=.env scripts/migrate-firestore-to-supabase.ts
```

Use Node rather than Bun, since Firestore's gRPC client hangs under Bun. Pass `--skip-email=user@example.com` (repeatable) to leave an account out. Re-running is safe: already-copied entries are skipped.
