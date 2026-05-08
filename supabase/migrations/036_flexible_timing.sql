-- Flexible timing: enquiry threads + offer negotiation lifecycle.

create extension if not exists pg_cron;

alter table public.services
  add column if not exists booking_mode text not null default 'fixed';

alter table public.services
  drop constraint if exists services_booking_mode_check;

alter table public.services
  add constraint services_booking_mode_check check (
    booking_mode in ('fixed', 'flexible')
  );

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  consumer_user_id uuid not null references auth.users (id) on delete cascade,
  expert_user_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  status text not null default 'open'
    constraint enquiries_status_check check (
      status in ('open', 'offer_sent', 'booked', 'expired', 'closed')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists enquiries_one_active_per_consumer_service_idx
  on public.enquiries (consumer_user_id, service_id)
  where status in ('open', 'offer_sent');

create index if not exists enquiries_consumer_status_idx
  on public.enquiries (consumer_user_id, status, updated_at desc);

create index if not exists enquiries_expert_status_idx
  on public.enquiries (expert_user_id, status, updated_at desc);

create or replace function public.enquiries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enquiries_set_updated_at on public.enquiries;

create trigger trg_enquiries_set_updated_at
  before update on public.enquiries
  for each row
  execute procedure public.enquiries_set_updated_at();

create table if not exists public.enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  is_offer boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists enquiry_messages_enquiry_created_idx
  on public.enquiry_messages (enquiry_id, created_at);

alter table public.bookings
  add column if not exists offer_expires_at timestamptz;

alter table public.bookings
  add column if not exists offer_sent_at timestamptz;

alter table public.bookings
  add column if not exists source_enquiry_id uuid references public.enquiries (id) on delete set null;

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check check (
    status in (
      'offer_pending',
      'pending_payment',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    )
  );

create index if not exists bookings_offer_pending_expiry_idx
  on public.bookings (status, offer_expires_at)
  where status = 'offer_pending';

alter table public.enquiries enable row level security;
alter table public.enquiry_messages enable row level security;

drop policy if exists "Consumers can read own enquiries" on public.enquiries;
drop policy if exists "Consumers can insert own enquiries" on public.enquiries;
drop policy if exists "Participants can update enquiry status" on public.enquiries;
drop policy if exists "Participants can read enquiry messages" on public.enquiry_messages;
drop policy if exists "Participants can insert enquiry messages" on public.enquiry_messages;

create policy "Consumers can read own enquiries"
  on public.enquiries
  for select
  to authenticated
  using (
    auth.uid() = consumer_user_id
    or (
      auth.uid() = expert_user_id
      and exists (
        select 1
        from public.services s
        where s.id = service_id
          and s.expert_user_id = auth.uid()
      )
    )
  );

create policy "Consumers can insert own enquiries"
  on public.enquiries
  for insert
  to authenticated
  with check (auth.uid() = consumer_user_id);

create policy "Participants can update enquiry status"
  on public.enquiries
  for update
  to authenticated
  using (auth.uid() = consumer_user_id or auth.uid() = expert_user_id)
  with check (auth.uid() = consumer_user_id or auth.uid() = expert_user_id);

create policy "Participants can read enquiry messages"
  on public.enquiry_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.enquiries e
      where e.id = enquiry_id
        and (auth.uid() = e.consumer_user_id or auth.uid() = e.expert_user_id)
    )
  );

create policy "Participants can insert enquiry messages"
  on public.enquiry_messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.enquiries e
      where e.id = enquiry_id
        and (auth.uid() = e.consumer_user_id or auth.uid() = e.expert_user_id)
    )
  );

create or replace function public.expire_offer_pending_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update public.bookings b
    set
      status = 'cancelled',
      cancelled_at = coalesce(b.cancelled_at, now())
    where b.status = 'offer_pending'
      and b.offer_expires_at is not null
      and b.offer_expires_at < now()
    returning b.source_enquiry_id
  )
  update public.enquiries e
  set
    status = 'open',
    updated_at = now()
  where e.id in (
    select source_enquiry_id
    from expired
    where source_enquiry_id is not null
  )
    and e.status = 'offer_sent';
end;
$$;

do $$
begin
  begin
    perform cron.unschedule('flexible-timing-offer-expiry');
  exception
    when others then
      null;
  end;
end $$;

select cron.schedule(
  'flexible-timing-offer-expiry',
  '*/15 * * * *',
  $$select public.expire_offer_pending_bookings();$$
);
