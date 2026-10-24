# Journal8

A personal journal built with React, Vite, Tailwind/daisyUI, and [Supabase](https://supabase.com) (auth + Postgres). Hosted on Firebase Hosting.

## Setup

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/` (SQL editor, or `supabase db push` with the Supabase CLI).
3. Enable the Google provider under **Authentication → Providers**, and add your app URLs (e.g. `http://localhost:5173/journal`) to **Authentication → URL Configuration → Redirect URLs**.
4. Copy `.env.example` to `.env` and fill in your project URL and publishable key.
5. `bun install && bun run dev`

## Invites

Accounts are invite-only. Anyone can sign in with Google, but they can't use the app until they enter an invite code. Accounts that existed before invites were added are already members, and the migration makes karlgmolina@gmail.com the admin. Admins find **Invite codes** in the profile menu, where they can make, copy, and revoke codes. Each code works once. To make someone else an admin, run `update public.members set is_admin = true where user_id = '<their user id>';` in the SQL editor.

For CI deploys, set the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` repository secrets.

## AI workout planning

The Plan tab calls the `plan-workout` Edge Function (`supabase/functions/plan-workout`), which asks Gemini for a weekly plan using your goals, current injuries and recent workouts. The Gemini API key stays server-side as a Supabase secret:

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set GEMINI_API_KEY=...
# Optional; defaults to gemini-2.5-pro
supabase secrets set GEMINI_MODEL=gemini-3.8-flash
supabase functions deploy plan-workout
```

Create the key at https://aistudio.google.com/apikey. Without it the Plan tab shows "AI planning isn't set up yet". On the free tier Google may use prompts to improve its products, and daily request limits are low.
