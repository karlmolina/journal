-- Also return the entry text with matches wrapped in private-use characters
-- (U+E000 before, U+E001 after) for the client to turn into highlights.
drop function public.search_entries(text, int);

create function public.search_entries(query_text text, match_count int default 50)
returns table (id uuid, text text, created_at timestamptz, highlighted text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id,
    e.text,
    e.created_at,
    ts_headline(
      'english',
      e.text,
      websearch_to_tsquery('english', query_text),
      'HighlightAll=true, StartSel=' || chr(57344) || ', StopSel=' || chr(57345)
    )
  from public.entries e
  where e.fts @@ websearch_to_tsquery('english', query_text)
  order by e.created_at desc
  limit match_count;
$$;
