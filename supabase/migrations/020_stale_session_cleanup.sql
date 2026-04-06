-- Stale session cleanup: mark in_progress bookings completed after session end + 15m grace.
-- Requires pg_cron (enable in Supabase Dashboard if needed).

create extension if not exists pg_cron;

create or replace function public.complete_stale_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings
  set
    status = 'completed',
    completed_at = now()
  where status = 'in_progress'
    and scheduled_at is not null
    and duration_minutes is not null
    and scheduled_at
          + (duration_minutes * interval '1 minute')
          + interval '15 minutes'
        < now();
$$;

-- Run every 15 minutes (at :00, :15, :30, :45).
select cron.schedule(
  'complete-stale-sessions',
  '*/15 * * * *',
  $$select public.complete_stale_sessions();$$
);

-- One immediate run for any currently stuck rows.
select public.complete_stale_sessions();
