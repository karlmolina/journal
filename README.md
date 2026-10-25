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

The Plan tab doesn't call an AI itself. It builds a prompt from your goals, equipment, current injuries, recent workouts, exercise library (and the current plan, when changing one), plus the reply format the app expects, and copies it. Prompt and reply are short pipe-separated lines rather than JSON, because phone clipboards cut off long text (see `src/functions/planPrompt.ts`). Paste it into any chatbot, then paste the bot's reply into **Import plan**. The reply is checked in the browser (code fences and chatter around the plan are fine) and saved to `workout_plans`; the previous plan stays under **Earlier plans**. Goals, equipment, days and minutes are saved per person in `workout_plan_preferences` and fill the form next time.
