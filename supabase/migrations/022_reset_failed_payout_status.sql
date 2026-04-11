-- Retry failed payouts after processBookingPayout uses source_transaction (charge-linked transfers).

update public.bookings
set
  stripe_transfer_status = 'pending',
  stripe_transfer_attempt_count = 0,
  stripe_transfer_last_error = null
where stripe_transfer_status = 'failed';
