create extension if not exists vector with schema extensions;

-- 384 dimensions matches Supabase's built-in gte-small model.
alter table public.entries
  add column embedding extensions.vector(384),
  add column fts tsvector generated always as (to_tsvector('english', text)) stored;

create index entries_embedding_idx
  on public.entries using hnsw (embedding extensions.vector_cosine_ops);

create index entries_fts_idx on public.entries using gin (fts);

-- Merges semantic and keyword rankings with reciprocal rank fusion.
-- Runs as the caller (security invoker), so RLS limits results to their entries.
create function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(384),
  match_count int default 20,
  match_threshold float default 0.5,
  rrf_k int default 60
)
returns table (id uuid, text text, created_at timestamptz, score float)
language sql
stable
security invoker
set search_path = ''
as $$
  with semantic as (
    select
      e.id,
      row_number() over (order by e.embedding operator(extensions.<=>) query_embedding) as rank
    from public.entries e
    where e.embedding is not null
      and 1 - (e.embedding operator(extensions.<=>) query_embedding) > match_threshold
    order by e.embedding operator(extensions.<=>) query_embedding
    limit match_count * 2
  ),
  keyword as (
    select
      e.id,
      row_number() over (order by ts_rank_cd(e.fts, websearch_to_tsquery('english', query_text)) desc) as rank
    from public.entries e
    where e.fts @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(e.fts, websearch_to_tsquery('english', query_text)) desc
    limit match_count * 2
  )
  select
    e.id,
    e.text,
    e.created_at,
    (coalesce(1.0 / (rrf_k + s.rank), 0) + coalesce(1.0 / (rrf_k + k.rank), 0))::float as score
  from semantic s
  full outer join keyword k on k.id = s.id
  join public.entries e on e.id = coalesce(s.id, k.id)
  order by score desc
  limit match_count;
$$;
