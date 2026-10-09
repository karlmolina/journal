alter table public.entries
  add column fts tsvector
  generated always as (to_tsvector('english', text)) stored;

create index entries_fts_idx on public.entries using gin (fts);
