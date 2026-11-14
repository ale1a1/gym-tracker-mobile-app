-- Sessions are created when a workout starts and updated live on every set/reps/weight change,
-- so progress is never lost and the watch can follow the same workout.
alter table public.workout_sessions
  add column if not exists status text not null default 'completed'
    check (status in ('in_progress', 'completed')),
  add column if not exists started_at timestamptz;

alter table public.workout_sessions alter column completed_at drop not null;
alter table public.workout_sessions alter column completed_at drop default;

create index if not exists sessions_user_status_idx on public.workout_sessions (user_id, status);
