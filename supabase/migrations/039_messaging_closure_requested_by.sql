ALTER TABLE bookings ADD COLUMN IF NOT EXISTS messaging_closure_requested_by text CHECK (messaging_closure_requested_by IN ('expert', 'consumer'));
