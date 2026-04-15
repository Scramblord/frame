-- 023: Full RLS audit — enable RLS and set correct policies on all tables

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy "Anyone can read profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- expert_profiles
-- ---------------------------------------------------------------------------
alter table public.expert_profiles enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'expert_profiles'
  loop
    execute format('drop policy if exists %I on public.expert_profiles', p.policyname);
  end loop;
end $$;

create policy "Anyone can read expert_profiles"
  on public.expert_profiles
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert own expert_profile"
  on public.expert_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own expert_profile"
  on public.expert_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
alter table public.services enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'services'
  loop
    execute format('drop policy if exists %I on public.services', p.policyname);
  end loop;
end $$;

create policy "Anyone can read active services"
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

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'availability'
  loop
    execute format('drop policy if exists %I on public.availability', p.policyname);
  end loop;
end $$;

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

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'availability_overrides'
  loop
    execute format('drop policy if exists %I on public.availability_overrides', p.policyname);
  end loop;
end $$;

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
-- bookings
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
  loop
    execute format('drop policy if exists %I on public.bookings', p.policyname);
  end loop;
end $$;

create policy "Consumers can read own bookings"
  on public.bookings
  for select
  to authenticated
  using (auth.uid() = consumer_user_id);

create policy "Experts can read bookings where they are expert"
  on public.bookings
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Consumers can insert own bookings"
  on public.bookings
  for insert
  to authenticated
  with check (auth.uid() = consumer_user_id);

create policy "Consumers can update own bookings"
  on public.bookings
  for update
  to authenticated
  using (auth.uid() = consumer_user_id)
  with check (auth.uid() = consumer_user_id);

create policy "Experts can update bookings where they are expert"
  on public.bookings
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy if exists %I on public.messages', p.policyname);
  end loop;
end $$;

create policy "Users can read booking messages they participate in"
  on public.messages
  for select
  to authenticated
  using (
    booking_id in (
      select id
      from public.bookings
      where consumer_user_id = auth.uid() or expert_user_id = auth.uid()
    )
  );

create policy "Users can insert own messages"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'reviews'
  loop
    execute format('drop policy if exists %I on public.reviews', p.policyname);
  end loop;
end $$;

create policy "Anyone can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

create policy "Users can insert own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (auth.uid() = reviewer_id);
