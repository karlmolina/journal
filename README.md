# Journal8

A personal journal built with React, Vite, Tailwind/daisyUI, and [Supabase](https://supabase.com) (auth + Postgres). Hosted on Firebase Hosting.

## Setup

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/` (SQL editor, or `supabase db push` with the Supabase CLI).
3. Enable the Google provider under **Authentication → Providers**, and add your app URLs (e.g. `http://localhost:5173/journal`) to **Authentication → URL Configuration → Redirect URLs**.
4. Copy `.env.example` to `.env` and fill in your project URL and anon key.
5. Deploy the `embed` Edge Function, which semantic search uses to embed entries and queries: `supabase functions deploy embed`.
6. `bun install && bun run dev`

For CI deploys, set the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository secrets.

## Migrating from Firestore

`scripts/migrate-firestore-to-supabase.ts` copies existing Firestore entries into Supabase, matching users by email. Download a Firebase service account key (Project settings → Service accounts), save it as `firebase-service-account.json` (gitignored), set the variables listed in `.env.example`, then:

```sh
bun scripts/migrate-firestore-to-supabase.ts --dry-run
bun scripts/migrate-firestore-to-supabase.ts
```

Re-running is safe: already-copied entries are skipped.

## Semantic search

Search ranks entries by meaning rather than exact words, using embeddings from Supabase's built-in `gte-small` model (see `supabase/functions/embed`). New entries are embedded when they are saved. To embed entries written before search existed, set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then:

```sh
bun scripts/backfill-embeddings.ts
```
