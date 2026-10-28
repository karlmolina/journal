-- How long it took to fall asleep, in minutes. Time asleep is wake-up minus
-- bedtime minus this. Nights logged before this column count as 0.

alter table public.sleep_nights
  add column fall_asleep_minutes smallint not null default 0
    check (fall_asleep_minutes between 0 and 720);
