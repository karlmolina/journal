-- Semantic search over entries. Embeddings come from the `embed` Edge
-- Function (gte-small, 384 dimensions, normalized), so inner product is
-- cosine similarity.
create extension if not exists vector with schema extensions;

alter table public.entries
  add column embedding extensions.vector(384);

create index entries_embedding_idx on public.entries
  using hnsw (embedding extensions.vector_ip_ops);

-- Runs as the caller, so row level security limits results to their entries.
create function public.match_entries(
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int
)
returns table (id uuid, text text, created_at timestamptz, similarity float)
language sql
stable
set search_path = ''
as $$
  select
    e.id,
    e.text,
    e.created_at,
    -(e.embedding operator(extensions.<#>) query_embedding) as similarity
  from public.entries e
  where e.embedding operator(extensions.<#>) query_embedding < -match_threshold
  order by e.embedding operator(extensions.<#>) query_embedding
  limit least(match_count, 50);
$$;
