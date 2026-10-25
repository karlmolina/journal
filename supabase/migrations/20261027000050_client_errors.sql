-- Errors the app runs into in the browser: crashes, failed requests and the
-- messages shown in error banners. Signed-in people can only add rows; they're
-- read from the Supabase dashboard (or SQL) when something goes wrong.

create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- What the person saw, e.g. "Couldn't finish the workout.", or the kind of
  -- crash ("Uncaught error", "Unhandled rejection", "Render crash").
  context text not null check (char_length(context) <= 500),
  message text not null check (char_length(message) <= 2000),
  -- Stack trace, React component stack, or Postgres code/details/hint.
  detail text check (char_length(detail) <= 8000),
  url text check (char_length(url) <= 1000),
  user_agent text check (char_length(user_agent) <= 500),
  -- Build the error came from, to tell old tabs from the latest deploy.
  build text check (char_length(build) <= 100)
);

create index client_errors_created_at on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

create policy "Signed-in users can report their own errors"
  on public.client_errors for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
