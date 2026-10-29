-- When screens were put away for the night (before bedtime, not counted as
-- sleep). Nights logged before this column have no tech-free time.

alter table public.sleep_nights
  add column tech_free_at time;
