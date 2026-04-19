-- Phase 1: messaging feature — schema + RLS + indexes only (no API/UI).
--
-- Pre-flight notes:
-- - sender_role must match the booking party (consumer vs expert); RLS does not
--   validate sender_role against sender_id — enforce in application or add a
--   future CHECK/trigger if you want DB-level enforcement.
-- - messaging_message_count + messaging_last_activity_at: updated by trigger
--   trg_messages_after_insert_booking_counters on each message insert.
-- - messaging_opened_at, messaging_sla_deadline, messaging_first_reply_at are
--   not auto-set here (SLA needs service config); Phase 2 can populate via API
--   or triggers.

-- ---------------------------------------------------------------------------
-- 1. bookings — messaging lifecycle columns
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists messaging_opened_at timestamptz;

alter table public.bookings
  add column if not exists messaging_first_reply_at timestamptz;

alter table public.bookings
  add column if not exists messaging_sla_deadline timestamptz;

alter table public.bookings
  add column if not exists messaging_closed_at timestamptz;

alter table public.bookings
  add column if not exists messaging_closed_by text;

alter table public.bookings
  add column if not exists messaging_message_count integer not null default 0;

alter table public.bookings
  add column if not exists messaging_last_activity_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_messaging_closed_by_check;

alter table public.bookings
  add constraint bookings_messaging_closed_by_check check (
    messaging_closed_by is null
    or messaging_closed_by in (
      'expert',
      'system_inactivity',
      'system_cap',
      'system_sla_expired'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. messages — remove message_number, add sender_role, thread index
-- ---------------------------------------------------------------------------
alter table public.messages
  drop constraint if exists messages_message_number_range;

alter table public.messages
  drop constraint if exists messages_booking_message_number_unique;

alter table public.messages
  drop column if exists message_number;

alter table public.messages
  add column if not exists sender_role text;

update public.messages m
set sender_role = case
  when m.sender_id = b.consumer_user_id then 'consumer'
  else 'expert'
end
from public.bookings b
where m.booking_id = b.id
  and m.sender_role is null;

alter table public.messages
  alter column sender_role set not null;

alter table public.messages
  drop constraint if exists messages_sender_role_check;

alter table public.messages
  add constraint messages_sender_role_check check (
    sender_role in ('consumer', 'expert')
  );

drop index if exists public.messages_booking_id_idx;

create index if not exists messages_booking_id_created_at_idx
  on public.messages (booking_id, created_at);

create or replace function public.trg_messages_after_insert_booking_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set
    messaging_message_count = coalesce(messaging_message_count, 0) + 1,
    messaging_last_activity_at = now()
  where id = new.booking_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_after_insert_booking_counters on public.messages;

create trigger trg_messages_after_insert_booking_counters
  after insert on public.messages
  for each row
  execute procedure public.trg_messages_after_insert_booking_counters();

-- ---------------------------------------------------------------------------
-- 3. messages — RLS: stricter insert + consumer sends first
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert own messages" on public.messages;

create policy "Booking participants can insert messages"
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
    and (
      exists (
        select 1
        from public.messages m
        where m.booking_id = booking_id
      )
      or exists (
        select 1
        from public.bookings b2
        where b2.id = booking_id
          and auth.uid() = b2.consumer_user_id
      )
    )
  );

-- Select policy unchanged (026): "Users can read booking messages they participate in"

-- ---------------------------------------------------------------------------
-- 4. Partial indexes for messaging cron jobs
-- ---------------------------------------------------------------------------
create index if not exists bookings_messaging_sla_idx on public.bookings (
  messaging_sla_deadline
)
where
  status = 'confirmed'
  and session_type in ('messaging', 'urgent_messaging')
  and messaging_first_reply_at is null;

create index if not exists bookings_messaging_inactivity_idx on public.bookings (
  messaging_last_activity_at
)
where
  status in ('confirmed', 'in_progress')
  and session_type in ('messaging', 'urgent_messaging')
  and messaging_closed_at is null;
