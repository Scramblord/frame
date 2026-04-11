-- Booking review tracking + ensure reviews.rating range

alter table public.bookings
  add column if not exists consumer_reviewed boolean not null default false;

alter table public.bookings
  add column if not exists expert_reviewed boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'reviews'
      and c.conname = 'reviews_rating_check'
  ) then
    alter table public.reviews
      add constraint reviews_rating_check check (rating >= 1 and rating <= 5);
  end if;
end $$;
