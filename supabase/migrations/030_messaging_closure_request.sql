alter table public.bookings
add column if not exists messaging_closure_requested_at timestamptz;
