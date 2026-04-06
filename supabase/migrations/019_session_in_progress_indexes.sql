-- Faster lookups for ActiveSessionBanner (in_progress + party + time window).
-- bookings.completed_at exists since migration 013; bookings_status_idx since 015.

create index if not exists bookings_consumer_in_progress_idx
  on public.bookings (consumer_user_id, status, scheduled_at)
  where status = 'in_progress';

create index if not exists bookings_expert_in_progress_idx
  on public.bookings (expert_user_id, status, scheduled_at)
  where status = 'in_progress';
