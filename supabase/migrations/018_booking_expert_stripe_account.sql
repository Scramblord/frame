-- Persist expert Connect account on booking at payment time (for future payout after session completion).

alter table public.bookings
  add column if not exists expert_stripe_account_id text;
