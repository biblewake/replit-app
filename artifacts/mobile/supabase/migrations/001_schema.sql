-- ============================================================
-- Bible Wake — Full Database Schema
-- Run this in Supabase Dashboard → SQL Editor (or via CLI)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. public.users
--    One row per authenticated user. Extends auth.users.
-- ──────────────────────────────────────────────────────────
create table if not exists public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  created_at            timestamptz default now(),
  display_name          text,
  email                 text,
  avatar_url            text,
  preferred_translation text default 'NIV',
  updated_at            timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can view own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own row"
  on public.users for insert
  with check (auth.uid() = id);

-- ──────────────────────────────────────────────────────────
-- 2. public.verse_background_images
--    Manually populated via Supabase dashboard.
--    App randomly picks from active rows.
-- ──────────────────────────────────────────────────────────
create table if not exists public.verse_background_images (
  id         uuid primary key default gen_random_uuid(),
  url        text not null,
  label      text,
  is_active  boolean default true,
  created_at timestamptz default now()
);

alter table public.verse_background_images enable row level security;

-- All authenticated users can read; only service role writes (managed via dashboard)
create policy "Authenticated users can read verse background images"
  on public.verse_background_images for select
  to authenticated
  using (true);

-- ──────────────────────────────────────────────────────────
-- 3. public.alarms
--    Mirrors the full Alarm type including verse mode and wake-up check.
-- ──────────────────────────────────────────────────────────
create table if not exists public.alarms (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.users(id) on delete cascade,
  name                      text,
  hour                      int not null,
  minute                    int not null,
  is_pm                     boolean not null,
  days                      boolean[] not null default '{false,false,false,false,false,false,false}',
  alarm_type                text not null check (alarm_type in ('verse', 'normal')),
  schedule_type             text not null check (schedule_type in ('scheduled', 'one-time')),
  enabled                   boolean default true,
  verse_ref                 text,
  verse_text                text,
  verse_mode                text check (verse_mode in ('memory', 'declare')),
  sound_id                  text,
  wake_up_check             boolean default false,
  verse_background_image_id uuid references public.verse_background_images(id) on delete set null,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table public.alarms enable row level security;

create policy "Users can manage own alarms"
  on public.alarms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 4. public.wake_history
--    One row per alarm firing/dismissal event.
-- ──────────────────────────────────────────────────────────
create table if not exists public.wake_history (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.users(id) on delete cascade,
  alarm_id                  uuid references public.alarms(id) on delete set null,
  alarm_name                text,
  dismissed_at              timestamptz not null default now(),
  verse_ref                 text,
  verse_text                text,
  verse_mode                text check (verse_mode in ('memory', 'declare')),
  -- Wake-up phrase check
  wake_up_check_required    boolean default false,
  wake_up_check_completed   boolean default false,
  wake_up_phrase_attempts   int default 0,
  -- Verse recital
  recital_transcript        text,
  recital_accuracy          float4,
  recital_duration_seconds  int,
  recital_success           boolean,
  -- Visual
  verse_background_image_id uuid references public.verse_background_images(id) on delete set null,
  created_at                timestamptz default now()
);

alter table public.wake_history enable row level security;

create policy "Users can manage own wake history"
  on public.wake_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 5. public.streaks
--    One row per user. Updated on each successful wake event.
-- ──────────────────────────────────────────────────────────
create table if not exists public.streaks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  current_streak  int default 0,
  longest_streak  int default 0,
  last_wake_date  date,
  updated_at      timestamptz default now()
);

alter table public.streaks enable row level security;

create policy "Users can manage own streak"
  on public.streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 6. public.verse_stats
--    One row per (user, verse_ref). Drives Insights page.
-- ──────────────────────────────────────────────────────────
create table if not exists public.verse_stats (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  verse_ref             text not null,
  verse_text            text,
  times_shown           int default 0,
  times_recited         int default 0,
  times_succeeded       int default 0,
  total_recital_seconds int default 0,
  is_memorized          boolean default false,
  memorized_at          timestamptz,
  last_used_at          timestamptz,
  unique (user_id, verse_ref)
);

alter table public.verse_stats enable row level security;

create policy "Users can manage own verse stats"
  on public.verse_stats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 7. Views
-- ──────────────────────────────────────────────────────────

-- user_insight_summary: per-user aggregated stats for the Insights page.
--
-- SECURITY INVOKER means the view executes with the calling user's identity,
-- so RLS on public.wake_history is enforced (only the user's own rows are
-- visible).  The explicit WHERE wh.user_id = auth.uid() is a second layer of
-- defence so the filter is visible and auditable even if the RLS policy ever
-- changes.
create or replace view public.user_insight_summary
  with (security_invoker = on)
as
select
  wh.user_id,
  -- Average wake time expressed as fractional hour (e.g. 7.5 = 7:30 AM)
  avg(
    extract(hour from wh.dismissed_at)
    + extract(minute from wh.dismissed_at) / 60.0
  ) as avg_wake_hour,
  -- Average recital response time in seconds (only rows with a recital)
  avg(wh.recital_duration_seconds) filter (where wh.recital_duration_seconds is not null) as avg_recital_seconds,
  count(*) filter (where wh.recital_success = true) as total_successful_recitals,
  -- Success rate: successful / attempted
  case
    when count(*) filter (where wh.recital_duration_seconds is not null) = 0 then null
    else count(*) filter (where wh.recital_success = true)::float
       / count(*) filter (where wh.recital_duration_seconds is not null)::float
  end as recital_success_rate,
  -- Favorite verse: most frequently used verse_ref
  mode() within group (order by wh.verse_ref) as favorite_verse_ref
from public.wake_history wh
-- Explicit per-user filter (defence-in-depth alongside SECURITY INVOKER + RLS)
where wh.user_id = auth.uid()
group by wh.user_id;

-- Grant SELECT on the view.  Because SECURITY INVOKER is set, authenticated
-- users can only read their own aggregated row — the underlying RLS on
-- wake_history ensures no cross-user data leakage.
grant select on public.user_insight_summary to authenticated;

-- ──────────────────────────────────────────────────────────
-- 8. Trigger: auto-update updated_at on users and alarms
-- ──────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger alarms_updated_at
  before update on public.alarms
  for each row execute function public.handle_updated_at();

create trigger streaks_updated_at
  before update on public.streaks
  for each row execute function public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- 9. public.onboarding_answers
--    One row per user. Stores the first-launch onboarding quiz
--    responses as a JSONB key/value map.
-- ──────────────────────────────────────────────────────────
create table if not exists public.onboarding_answers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.users(id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.onboarding_answers enable row level security;

create policy "Users can manage own onboarding answers"
  on public.onboarding_answers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- delete_user() RPC lives in 002_delete_user_rpc.sql
