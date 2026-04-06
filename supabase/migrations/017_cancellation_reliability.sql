-- Cancellation metadata, refunds, and reliability counters for consumers and experts.

alter table public.bookings
  add column if not exists cancelled_by text;

alter table public.bookings
  add column if not exists cancellation_reason text;

alter table public.bookings
  add column if not exists refund_amount numeric(12, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_cancelled_by_check'
  ) then
    alter table public.bookings
      add constraint bookings_cancelled_by_check check (
        cancelled_by is null
        or cancelled_by in ('consumer', 'expert')
      );
  end if;
end $$;

alter table public.profiles
  add column if not exists consumer_cancellations integer not null default 0;

alter table public.profiles
  add column if not exists consumer_sessions_kept integer not null default 0;

alter table public.profiles
  add column if not exists consumer_sessions_total integer not null default 0;

alter table public.expert_profiles
  add column if not exists expert_cancellations integer not null default 0;

alter table public.expert_profiles
  add column if not exists expert_sessions_kept integer not null default 0;

alter table public.expert_profiles
  add column if not exists expert_sessions_total integer not null default 0;
