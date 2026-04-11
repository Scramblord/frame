-- RLS policy audit: align public.profiles, expert_profiles, services, availability,
-- availability_overrides, bookings, messages, reviews with FRAME access rules.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Public can read consumer and expert profiles" on public.profiles;
drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Anyone can read profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- expert_profiles
-- ---------------------------------------------------------------------------
alter table public.expert_profiles enable row level security;

drop policy if exists "Experts can read own expert_profile" on public.expert_profiles;
drop policy if exists "Public can read expert_profiles" on public.expert_profiles;
drop policy if exists "Anyone can read expert_profiles" on public.expert_profiles;
drop policy if exists "Experts can insert own expert_profile" on public.expert_profiles;
drop policy if exists "Experts can update own expert_profile" on public.expert_profiles;

create policy "Anyone can read expert_profiles"
  on public.expert_profiles
  for select
  to anon, authenticated
  using (true);

create policy "Experts can insert own expert_profile"
  on public.expert_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Experts can update own expert_profile"
  on public.expert_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
alter table public.services enable row level security;

drop policy if exists "Experts can insert own services" on public.services;
drop policy if exists "Experts can update own services" on public.services;
drop policy if exists "Experts can delete own services" on public.services;
drop policy if exists "Experts can read own services" on public.services;
drop policy if exists "Public can read active services" on public.services;

create policy "Public can read active services"
  on public.services
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Experts can read own services"
  on public.services
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

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

-- ---------------------------------------------------------------------------
-- availability
-- ---------------------------------------------------------------------------
alter table public.availability enable row level security;

drop policy if exists "Experts can insert own availability" on public.availability;
drop policy if exists "Experts can update own availability" on public.availability;
drop policy if exists "Experts can delete own availability" on public.availability;
drop policy if exists "Experts can read own availability" on public.availability;
drop policy if exists "Public can read active availability" on public.availability;
drop policy if exists "Anyone can read availability" on public.availability;

create policy "Anyone can read availability"
  on public.availability
  for select
  to anon, authenticated
  using (true);

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

-- ---------------------------------------------------------------------------
-- availability_overrides
-- ---------------------------------------------------------------------------
alter table public.availability_overrides enable row level security;

drop policy if exists "Experts can insert own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can update own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can delete own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can read own availability overrides"
  on public.availability_overrides;
drop policy if exists "Public can read availability overrides"
  on public.availability_overrides;
drop policy if exists "Anyone can read availability overrides"
  on public.availability_overrides;

create policy "Anyone can read availability overrides"
  on public.availability_overrides
  for select
  to anon, authenticated
  using (true);

create policy "Experts can insert own availability overrides"
  on public.availability_overrides
  for insert
  to authenticated
  with check (auth.uid() = expert_user_id);

create policy "Experts can update own availability overrides"
  on public.availability_overrides
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

create policy "Experts can delete own availability overrides"
  on public.availability_overrides
  for delete
  to authenticated
  using (auth.uid() = expert_user_id);

-- ---------------------------------------------------------------------------
-- bookings — no UPDATE/DELETE for authenticated (service role bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;

drop policy if exists "Users can read own bookings" on public.bookings;
drop policy if exists "Consumers can read own bookings" on public.bookings;
drop policy if exists "Experts can read bookings for self" on public.bookings;
drop policy if exists "Consumers can insert bookings" on public.bookings;

create policy "Consumers can read own bookings"
  on public.bookings
  for select
  to authenticated
  using (auth.uid() = consumer_user_id);

create policy "Experts can read bookings for self"
  on public.bookings
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Consumers can insert bookings"
  on public.bookings
  for insert
  to authenticated
  with check (
    auth.uid() = consumer_user_id
    and consumer_user_id <> expert_user_id
  );

-- ---------------------------------------------------------------------------
-- messages — no UPDATE/DELETE
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists "Booking parties can read messages" on public.messages;
drop policy if exists "Booking parties can insert messages" on public.messages;

create policy "Booking parties can read messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and (
          auth.uid() = b.consumer_user_id
          or auth.uid() = b.expert_user_id
        )
    )
  );

create policy "Booking parties can insert messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and (
          auth.uid() = b.consumer_user_id
          or auth.uid() = b.expert_user_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- reviews — no UPDATE/DELETE for authenticated
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

drop policy if exists "Public can read reviews" on public.reviews;
drop policy if exists "Authenticated users can insert reviews" on public.reviews;

create policy "Public can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert reviews"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = reviewer_id);
