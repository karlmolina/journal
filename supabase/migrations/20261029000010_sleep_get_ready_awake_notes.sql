-- When getting ready for bed started (before bedtime, not counted as sleep),
-- minutes spent awake during the night (subtracted from sleep like the time
-- to fall asleep), and free-text notes. Nights logged before these columns
-- have no get-ready time, 0 minutes awake and no notes.

alter table public.sleep_nights
  add column get_ready_at time,
  add column awake_minutes smallint not null default 0
    check (awake_minutes between 0 and 720),
  add column notes text not null default '';
