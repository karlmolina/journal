-- Get-ready and tech-free are now logged as minutes before bedtime instead of
-- clock times, and a new field records how long you stayed in bed after
-- waking up (counted as time in bed, not as sleep).
--
-- Existing get_ready_at / tech_free_at times are converted to minutes before
-- that night's bedtime (wrapping past midnight). The old time columns are
-- kept, unused, so nothing is lost; they can be dropped later.

alter table public.sleep_nights
  add column get_ready_minutes smallint
    check (get_ready_minutes between 0 and 720),
  add column tech_free_minutes smallint
    check (tech_free_minutes between 0 and 720),
  add column out_of_bed_minutes smallint not null default 0
    check (out_of_bed_minutes between 0 and 720);

update public.sleep_nights
set
  get_ready_minutes = case when get_ready_at is null then null else least(720,
    ((extract(epoch from (bedtime - get_ready_at))::int / 60) % 1440 + 1440) % 1440) end,
  tech_free_minutes = case when tech_free_at is null then null else least(720,
    ((extract(epoch from (bedtime - tech_free_at))::int / 60) % 1440 + 1440) % 1440) end
where get_ready_at is not null or tech_free_at is not null;
