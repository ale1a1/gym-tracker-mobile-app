-- Per-exercise rest overrides (seconds). NULL = use the workout's general rule.
-- set_rest: rest between this exercise's sets; exercise_rest: rest after its last set.
alter table public.exercises
  add column if not exists set_rest integer check (set_rest is null or set_rest > 0),
  add column if not exists exercise_rest integer check (exercise_rest is null or exercise_rest > 0);
