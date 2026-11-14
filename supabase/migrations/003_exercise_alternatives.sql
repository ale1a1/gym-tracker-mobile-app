-- Alternative exercises ("oppure"): e.g. Low row -> Diverging seated row when the machine is busy.
-- Each item: { id, name, sets, reps, weight, settings, notes, videos }
alter table public.exercises
  add column if not exists alternatives jsonb not null default '[]'::jsonb;
