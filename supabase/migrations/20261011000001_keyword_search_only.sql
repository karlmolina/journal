-- Drop semantic search; keep only full-text keyword search.
drop function public.hybrid_search(text, extensions.vector, int, float, int);
drop index public.entries_embedding_idx;
alter table public.entries drop column embedding;
drop extension vector;

-- Runs as the caller (security invoker), so RLS limits results to their entries.
create function public.search_entries(query_text text, match_count int default 50)
returns table (id uuid, text text, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.text, e.created_at
  from public.entries e
  where e.fts @@ websearch_to_tsquery('english', query_text)
  order by e.created_at desc
  limit match_count;
$$;
