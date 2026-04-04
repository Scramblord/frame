-- FRAME booking marketplace — initial schema

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  location text,
  role text not null default 'consumer'
    check (role in ('consumer', 'expert', 'admin')),
  created_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id)
);

create table public.expert_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bio text,
  keywords text[] not null default '{}',
  hourly_rate numeric(12, 2),
  timezone text,
  offers_video boolean not null default false,
  offers_audio boolean not null default false,
  created_at timestamptz not null default now(),
  constraint expert_profiles_user_id_key unique (user_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references auth.users (id) on delete restrict,
  expert_id uuid not null references auth.users (id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'cancelled',
        'completed',
        'refunded'
      )
    ),
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  constraint bookings_different_parties check (consumer_id <> expert_id)
);

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

create index profiles_role_idx on public.profiles (role);

create index bookings_consumer_id_idx on public.bookings (consumer_id);
create index bookings_expert_id_idx on public.bookings (expert_id);
create index bookings_scheduled_at_idx on public.bookings (scheduled_at);
create index bookings_status_idx on public.bookings (status);

create index reviews_booking_id_idx on public.reviews (booking_id);
create index reviews_reviewee_id_idx on public.reviews (reviewee_id);
