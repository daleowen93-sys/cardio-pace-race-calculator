-- Cardio Pace & Race Calculator — My Performance schema
-- Per PROJECT_BIBLE.md Section 27 / Decision #35.
-- Paste this into the Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query)
-- and run it once, after the project is created.
--
-- Design notes (see Section 27 for full reasoning):
-- - Every table carries user_id and is protected by Row-Level Security: a user
--   can only read/write their own rows. auth.users is managed by Supabase itself
--   and is not created here.
-- - performance_entries is ONE table with a `type` discriminator column rather
--   than separate strength/endurance tables, since V1 only has two shapes.
-- - "Current PB" is deliberately NOT a stored column anywhere — it's always
--   computed by querying performance_entries (best estimated 1RM for strength,
--   fastest time for running), per Section 27.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, separate from the auth record itself so it can
-- grow (bio, photo, settings) later without touching auth.
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- sport_categories: reference data, not user-owned. V1 ships with 'running'
-- only; cycling/swimming/triathlon/hyrox are added later as new rows, no
-- schema change needed (Section 27).
-- ---------------------------------------------------------------------------
create table sport_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into sport_categories (name) values ('running');

alter table sport_categories enable row level security;

create policy "Anyone can read sport categories"
  on sport_categories for select
  using (true);

-- ---------------------------------------------------------------------------
-- exercise_definitions: the strength catalog, reference data. A starter list
-- is seeded below; add more with plain INSERTs as needed.
-- ---------------------------------------------------------------------------
create table exercise_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into exercise_definitions (name) values
  ('Bench Press'),
  ('Back Squat'),
  ('Deadlift'),
  ('Overhead Press'),
  ('Barbell Row');

alter table exercise_definitions enable row level security;

create policy "Anyone can read exercise definitions"
  on exercise_definitions for select
  using (true);

-- ---------------------------------------------------------------------------
-- performance_entries: the single historical ledger (Section 27). Every
-- logged attempt is kept — "current PB" is a query over this table, never a
-- separately stored field. Exactly one of sport_category_id /
-- exercise_definition_id is set, matching `type`.
-- ---------------------------------------------------------------------------
create table performance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('strength', 'endurance')),
  sport_category_id uuid references sport_categories(id),
  exercise_definition_id uuid references exercise_definitions(id),
  entry_date date not null,

  -- strength-only fields
  weight_kg numeric,
  reps integer,
  bodyweight_kg numeric,
  notes text,

  -- endurance-only fields
  distance_meters numeric,
  duration_seconds numeric,

  created_at timestamptz not null default now(),

  constraint exactly_one_category check (
    (sport_category_id is not null and exercise_definition_id is null)
    or (sport_category_id is null and exercise_definition_id is not null)
  ),
  constraint strength_fields_present check (
    type <> 'strength' or (weight_kg is not null and reps is not null)
  ),
  constraint endurance_fields_present check (
    type <> 'endurance' or (distance_meters is not null and duration_seconds is not null)
  )
);

alter table performance_entries enable row level security;

create policy "Users manage their own performance entries"
  on performance_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- goals: one active goal per user + exercise/category (Section 27 — no
-- deadlines, no history/versioning in V1).
-- ---------------------------------------------------------------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_category_id uuid references sport_categories(id),
  exercise_definition_id uuid references exercise_definitions(id),
  target_value numeric not null,
  created_at timestamptz not null default now(),

  constraint goal_exactly_one_category check (
    (sport_category_id is not null and exercise_definition_id is null)
    or (sport_category_id is null and exercise_definition_id is not null)
  ),
  constraint goal_unique_per_target unique (user_id, sport_category_id, exercise_definition_id)
);

alter table goals enable row level security;

create policy "Users manage their own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
