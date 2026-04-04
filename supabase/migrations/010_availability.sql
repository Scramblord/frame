-- Expert weekly availability + new bookings shape (part 1 booking system).
-- Requires public.services (008). Apply manually in Supabase SQL Editor when ready.
-- WARNING: Drops and recreates public.bookings and public.reviews — existing booking/review rows are removed.

drop function if exists public.get_expert_review_stats(uuid);

drop table if exists public.reviews cascade;
drop table if exists public.bookings cascade;

-- ---------------------------------------------------------------------------
-- Availability: one recurring window per day of week (expert-local wall times)
-- ---------------------------------------------------------------------------
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  expert_user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_time_range check (end_time > start_time),
  constraint availability_expert_day_unique unique (expert_user_id, day_of_week)
);

create index availability_expert_user_id_idx on public.availability (expert_user_id);

alter table public.availability enable row level security;

create policy "Experts can insert own availability"
  on public.availability
  for insert
  to authenticated
  with check (auth.uid() = expert_user_id);

create policy "Experts can update own availability"
  on public.availability
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

create policy "Experts can delete own availability"
  on public.availability
  for delete
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Experts can read own availability"
  on public.availability
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Public can read active availability"
  on public.availability
  for select
  to anon, authenticated
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null references auth.users (id) on delete restrict,
  expert_user_id uuid not null references auth.users (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  session_type text not null
    check (session_type in ('messaging', 'audio', 'video')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  stripe_payment_intent_id text,
  total_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  constraint bookings_different_parties check (consumer_user_id <> expert_user_id)
);

create index bookings_consumer_user_id_idx on public.bookings (consumer_user_id);
create index bookings_expert_user_id_idx on public.bookings (expert_user_id);
create index bookings_service_id_idx on public.bookings (service_id);
create index bookings_scheduled_at_idx on public.bookings (scheduled_at);
create index bookings_status_idx on public.bookings (status);

alter table public.bookings enable row level security;

create policy "Users can read own bookings"
  on public.bookings
  for select
  to authenticated
  using (
    auth.uid() = consumer_user_id
    or auth.uid() = expert_user_id
  );

create policy "Consumers can insert bookings"
  on public.bookings
  for insert
  to authenticated
  with check (
    auth.uid() = consumer_user_id
    and consumer_user_id <> expert_user_id
  );

-- ---------------------------------------------------------------------------
-- Reviews (recreated; links to new bookings)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reviewee_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_booking_reviewer_key unique (booking_id, reviewer_id)
);

create index reviews_booking_id_idx on public.reviews (booking_id);
create index reviews_reviewee_id_idx on public.reviews (reviewee_id);

alter table public.reviews enable row level security;

create policy "Public can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

create or replace function public.get_expert_review_stats(p_expert_user_id uuid)
returns table (avg_rating numeric, review_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    avg(rating::numeric),
    count(*)::bigint
  from public.reviews
  where reviewee_id = p_expert_user_id;
$$;

grant execute on function public.get_expert_review_stats(uuid) to anon, authenticated;
