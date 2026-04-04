-- Expert setup: session lengths, messaging, separate audio/video rates

alter table public.expert_profiles
  add column if not exists min_session_minutes integer
    not null default 30
    constraint expert_profiles_min_session_chk
      check (min_session_minutes > 0 and min_session_minutes % 15 = 0),
  add column if not exists max_session_minutes integer
    not null default 120
    constraint expert_profiles_max_session_chk
      check (max_session_minutes > 0 and max_session_minutes % 15 = 0),
  add column if not exists offers_messaging boolean not null default false,
  add column if not exists messaging_flat_rate numeric(12, 2),
  add column if not exists audio_hourly_rate numeric(12, 2),
  add column if not exists video_hourly_rate numeric(12, 2);

alter table public.expert_profiles
  drop constraint if exists expert_profiles_session_range;

alter table public.expert_profiles
  add constraint expert_profiles_session_range check (
    max_session_minutes >= min_session_minutes
  );
