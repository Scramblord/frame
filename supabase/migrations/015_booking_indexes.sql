-- Supporting indexes for bookings list/filter queries (idempotent if 010 already created them).

create index if not exists bookings_consumer_user_id_idx
  on public.bookings (consumer_user_id);

create index if not exists bookings_expert_user_id_idx
  on public.bookings (expert_user_id);

create index if not exists bookings_status_idx
  on public.bookings (status);
