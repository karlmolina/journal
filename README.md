# Journal8

A personal journal built with React, Vite, Tailwind/daisyUI, and [Supabase](https://supabase.com) (auth + Postgres). Hosted on Firebase Hosting.

## Setup

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/` (SQL editor, or `supabase db push` with the Supabase CLI).
3. Enable the Google provider under **Authentication → Providers**, and add your app URLs (e.g. `http://localhost:5173/journal`) to **Authentication → URL Configuration → Redirect URLs**.
4. Copy `.env.example` to `.env` and fill in your project URL and publishable key.
5. `bun install && bun run dev`

For CI deploys, set the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` repository secrets.

## Migrating from Firestore

`scripts/migrate-firestore-to-supabase.ts` copies existing Firestore entries into Supabase, matching users by email. Download a Firebase service account key (Project settings → Service accounts), save it as `firebase-service-account.json` (gitignored), set the variables listed in `.env.example`, then:

```sh
bun scripts/migrate-firestore-to-supabase.ts --dry-run
bun scripts/migrate-firestore-to-supabase.ts
```

Re-running is safe: already-copied entries are skipped.
