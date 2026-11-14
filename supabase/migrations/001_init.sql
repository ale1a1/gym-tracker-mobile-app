-- Gym Tracker schema. Every row belongs to the signed-in user (auth.uid()); RLS enforces it.
-- Ids are text so existing on-device ids can be uploaded unchanged.

create table if not exists public.workouts (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  total_time integer not null default 60,
  set_rest integer not null default 60,
  exercise_rest integer not null default 120,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id text not null references public.workouts (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  sets integer not null default 4,
  reps integer not null default 10,
  weight numeric(6, 2),
  weight_step numeric(5, 2) not null default 2,
  settings text not null default '',
  notes text not null default '',
  videos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A finished workout
create table if not exists public.workout_sessions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id text references public.workouts (id) on delete set null,
  title text not null,
  completed_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

-- One row per set done in a session
create table if not exists public.session_sets (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id text not null references public.workout_sessions (id) on delete cascade,
  exercise_id text,
  exercise_name text not null,
  exercise_position integer not null default 0,
  set_index integer not null,
  target_reps integer not null,
  reps integer not null,
  weight numeric(6, 2),
  completed boolean not null default false
);

create index if not exists workouts_user_idx on public.workouts (user_id);
create index if not exists exercises_workout_idx on public.exercises (workout_id, position);
create index if not exists sessions_user_workout_idx on public.workout_sessions (user_id, workout_id, completed_at desc);
create index if not exists session_sets_session_idx on public.session_sets (session_id);

-- updated_at maintenance
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workouts_updated_at on public.workouts;
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

drop trigger if exists exercises_updated_at on public.exercises;
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

-- Row level security: users only see and change their own rows
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own exercises" on public.exercises;
create policy "own exercises" on public.exercises
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sessions" on public.workout_sessions;
create policy "own sessions" on public.workout_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own session sets" on public.session_sets;
create policy "own session sets" on public.session_sets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
