-- Movie Night Matchmaker schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  pair_id uuid references pairs(id),
  status text not null default 'waiting_for_b'
    check (status in ('waiting_for_b','collecting_prefs','generating_brief','swiping','matched','final_pick','completed')),
  round int not null default 1,
  partner_a_device_id text not null,
  partner_b_device_id text,
  partner_a_done_round int not null default 0,
  partner_b_done_round int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists preferences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  partner text not null check (partner in ('a','b')),
  mood text[] not null default '{}',
  mood_freetext text,
  languages text[] not null default '{}',
  content_type text not null check (content_type in ('movies','movies_and_series')),
  min_rating numeric not null,
  eras text[] not null default '{}',
  submitted_at timestamptz default now(),
  unique(session_id, partner)
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round int not null,
  brief jsonb not null,
  created_at timestamptz default now()
);

create table if not exists title_pool (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null,
  year int,
  poster_path text,
  rating numeric,
  runtime int,
  synopsis text,
  raw jsonb,
  unique(session_id, round, tmdb_id)
);

create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round int not null,
  partner text not null check (partner in ('a','b')),
  tmdb_id int not null,
  direction text not null check (direction in ('like','pass')),
  created_at timestamptz default now(),
  unique(session_id, round, partner, tmdb_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  method text not null check (method in ('match','final_pick')),
  streaming jsonb,
  imdb_rating numeric,
  matched_at timestamptz default now(),
  -- One true match per round: guards against two near-simultaneous mutual
  -- swipes both slipping past the app-level optimistic lock.
  unique(session_id, round)
);

-- Each partner's tap on the final top-5 screen; a match is only finalized once
-- both partners land on the same tmdb_id (see app/api/sessions/[code]/final-pick).
create table if not exists final_picks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  partner text not null check (partner in ('a','b')),
  tmdb_id int not null,
  created_at timestamptz default now(),
  unique(session_id, partner)
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  partner text not null check (partner in ('a','b')),
  tmdb_id int not null,
  rating int check (rating between 1 and 5),
  note text,
  created_at timestamptz default now(),
  unique(session_id, tmdb_id, partner)
);

create index if not exists idx_preferences_session on preferences(session_id);
create index if not exists idx_title_pool_session_round on title_pool(session_id, round);
create index if not exists idx_swipes_session_round on swipes(session_id, round);
create index if not exists idx_matches_session on matches(session_id);
create index if not exists idx_final_picks_session on final_picks(session_id);
create index if not exists idx_ratings_session on ratings(session_id);
create index if not exists idx_sessions_pair on sessions(pair_id);

-- Realtime: enable row-level change feeds the app subscribes to.
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table preferences;

-- RLS: the app only ever talks to Supabase via the server-side service-role key,
-- so lock every table down from the anon/public role and rely on API routes for access control.
alter table pairs enable row level security;
alter table sessions enable row level security;
alter table preferences enable row level security;
alter table briefs enable row level security;
alter table title_pool enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table final_picks enable row level security;
alter table ratings enable row level security;

-- The browser client still needs read access for Realtime payloads on sessions/matches;
-- grant narrow, read-only anon select policies on just those two tables.
create policy "anon can read sessions" on sessions for select to anon using (true);
create policy "anon can read matches" on matches for select to anon using (true);
