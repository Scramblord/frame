-- Services + bookings extensions for full session booking (messaging, urgent messaging, audio, video)
-- and Stripe Connect payout metadata. Adds public.messages for booking-scoped threads.
-- Safe patterns: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- public.services — new columns + checks
-- ---------------------------------------------------------------------------
alter table public.services
  add column if not exists messaging_response_hours integer;

alter table public.services
  add column if not exists urgent_messaging_enabled boolean not null default false;

alter table public.services
  add column if not exists urgent_messaging_rate numeric(12, 2);

-- Existing rows with offers_messaging = true need a response window before the new CHECK applies.
update public.services
set messaging_response_hours = 24
where offers_messaging = true
  and messaging_response_hours is null;

alter table public.services
  drop constraint if exists services_urgent_messaging_chk;

alter table public.services
  drop constraint if exists services_messaging_response_chk;

alter table public.services
  add constraint services_urgent_messaging_chk check (
    urgent_messaging_enabled = false
    or urgent_messaging_rate is not null
  );

alter table public.services
  add constraint services_messaging_response_chk check (
    offers_messaging = false
    or (
      messaging_response_hours is not null
      and messaging_response_hours > 0
    )
  );

-- ---------------------------------------------------------------------------
-- public.bookings — status + session_type checks, nullability, new columns
-- ---------------------------------------------------------------------------
-- Migrate legacy status before replacing the CHECK constraint.
update public.bookings
set status = 'pending_payment'
where status = 'pending';

alter table public.bookings
  drop constraint if exists bookings_session_type_check;

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  drop constraint if exists bookings_scheduled_required;

alter table public.bookings
  alter column scheduled_at drop not null;

alter table public.bookings
  alter column duration_minutes drop not null;

alter table public.bookings
  add column if not exists stripe_transfer_id text;

alter table public.bookings
  add column if not exists platform_fee numeric(12, 2);

alter table public.bookings
  add column if not exists daily_room_url text;

alter table public.bookings
  add column if not exists completed_at timestamptz;

alter table public.bookings
  add column if not exists cancelled_at timestamptz;

alter table public.bookings
  alter column status set default 'pending_payment';

alter table public.bookings
  add constraint bookings_session_type_check check (
    session_type in (
      'messaging',
      'urgent_messaging',
      'audio',
      'video'
    )
  );

alter table public.bookings
  add constraint bookings_status_check check (
    status in (
      'pending_payment',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    )
  );

alter table public.bookings
  add constraint bookings_scheduled_required check (
    session_type not in ('audio', 'video')
    or (
      scheduled_at is not null
      and duration_minutes is not null
    )
  );

create index if not exists bookings_completed_at_idx
  on public.bookings (completed_at);

create index if not exists bookings_cancelled_at_idx
  on public.bookings (cancelled_at);

-- ---------------------------------------------------------------------------
-- public.messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  message_number integer not null,
  constraint messages_booking_message_number_unique unique (booking_id, message_number),
  constraint messages_message_number_range check (
    message_number >= 1
    and message_number <= 10
  )
);

create index if not exists messages_booking_id_idx
  on public.messages (booking_id);

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
