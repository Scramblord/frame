-- Multiple services per expert, each with its own pricing and session bounds.
--
-- IMPORTANT: Apply this file manually in the Supabase Dashboard → SQL Editor
-- (or `supabase db push` / your migration runner). The app expects `public.services`
-- to exist; expert setup and marketplace queries will fail until it is applied.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  expert_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  min_session_minutes integer not null default 30
    constraint services_min_session_chk check (
      min_session_minutes > 0 and min_session_minutes % 15 = 0
    ),
  max_session_minutes integer not null default 120
    constraint services_max_session_chk check (
      max_session_minutes > 0 and max_session_minutes % 15 = 0
    ),
  offers_messaging boolean not null default false,
  messaging_flat_rate numeric(12, 2),
  offers_audio boolean not null default false,
  audio_hourly_rate numeric(12, 2),
  offers_video boolean not null default false,
  video_hourly_rate numeric(12, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_session_range check (max_session_minutes >= min_session_minutes)
);

create index services_expert_user_id_idx on public.services (expert_user_id);

alter table public.services enable row level security;

-- Experts: full CRUD on their own rows (including inactive drafts).
create policy "Experts can insert own services"
  on public.services
  for insert
  to authenticated
  with check (auth.uid() = expert_user_id);

create policy "Experts can update own services"
  on public.services
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

create policy "Experts can delete own services"
  on public.services
  for delete
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Experts can read own services"
  on public.services
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

-- Marketplace: only active services are visible to the public.
create policy "Public can read active services"
  on public.services
  for select
  to anon, authenticated
  using (is_active = true);
