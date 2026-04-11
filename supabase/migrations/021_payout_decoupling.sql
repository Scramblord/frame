-- Decouple session completion from Stripe transfers: payout metadata + worker query index.
-- Stale-session cleanup sets transfer_after + stripe_transfer_status when completing rows.

-- ---------------------------------------------------------------------------
-- bookings: payout columns
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists transfer_after timestamptz;

alter table public.bookings
  add column if not exists stripe_transfer_status text;

alter table public.bookings
  add column if not exists stripe_transfer_last_error text;

alter table public.bookings
  add column if not exists stripe_transfer_attempt_count integer not null default 0;

alter table public.bookings
  drop constraint if exists bookings_stripe_transfer_status_check;

alter table public.bookings
  add constraint bookings_stripe_transfer_status_check check (
    stripe_transfer_status is null
    or stripe_transfer_status in (
      'pending',
      'succeeded',
      'failed',
      'not_applicable'
    )
  );

create index if not exists bookings_stripe_transfer_payout_worker_idx
  on public.bookings (stripe_transfer_status, transfer_after)
  where status = 'completed';

-- ---------------------------------------------------------------------------
-- Stale session cleanup: also set payout scheduling fields
-- ---------------------------------------------------------------------------
create or replace function public.complete_stale_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings b
  set
    status = 'completed',
    completed_at = now(),
    transfer_after = now() + interval '20 minutes',
    stripe_transfer_status = case
      when coalesce(b.total_amount, 0) = 0 then 'not_applicable'
      when b.expert_stripe_account_id is null
        or trim(b.expert_stripe_account_id) = '' then 'not_applicable'
      else 'pending'
    end
  where b.status = 'in_progress'
    and b.scheduled_at is not null
    and b.duration_minutes is not null
    and b.scheduled_at
          + (b.duration_minutes * interval '1 minute')
          + interval '15 minutes'
        < now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: completed rows that already have a Stripe transfer id
-- ---------------------------------------------------------------------------
update public.bookings
set stripe_transfer_status = 'succeeded'
where status = 'completed'
  and stripe_transfer_id is not null
  and trim(stripe_transfer_id) <> ''
  and stripe_transfer_status is null;

-- ---------------------------------------------------------------------------
-- RPC: claim one booking row for payout (FOR UPDATE SKIP LOCKED)
-- Used by the payout worker to avoid concurrent duplicate processing per row.
-- ---------------------------------------------------------------------------
create or replace function public.claim_booking_for_payout(p_booking_id uuid)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select b.*
  from public.bookings b
  where b.id = p_booking_id
    and b.status = 'completed'
    and b.stripe_transfer_status = 'pending'
    and b.transfer_after is not null
    and b.transfer_after <= now()
  for update of b skip locked;
end;
$$;

revoke all on function public.claim_booking_for_payout(uuid) from public;
grant execute on function public.claim_booking_for_payout(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: record payout failure (atomic increment + status)
-- ---------------------------------------------------------------------------
create or replace function public.apply_booking_payout_failure(
  p_booking_id uuid,
  p_error text
)
returns table (new_attempt_count int, new_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.bookings b
  set
    stripe_transfer_attempt_count = b.stripe_transfer_attempt_count + 1,
    stripe_transfer_last_error = left(coalesce(p_error, ''), 10000),
    stripe_transfer_status = case
      when b.stripe_transfer_attempt_count + 1 >= 3 then 'failed'
      else 'pending'
    end
  where b.id = p_booking_id
    and b.status = 'completed'
    and b.stripe_transfer_status = 'pending'
  returning b.stripe_transfer_attempt_count, b.stripe_transfer_status;
end;
$$;

revoke all on function public.apply_booking_payout_failure(uuid, text) from public;
grant execute on function public.apply_booking_payout_failure(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- pg_cron cannot call Stripe or Next.js directly. Options:
-- 1) Supabase: enable pg_net and schedule net.http_post to your deployed URL.
-- 2) Vercel / external cron: POST /api/session/process-payouts every */15 * * * *
--    with header x-payout-worker-secret: <PAYOUT_WORKER_SECRET>.
--
-- Example (uncomment and set url + secret via Vault — do not commit secrets):
--
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'process-payouts-http',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_APP_HOST/api/session/process-payouts',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-payout-worker-secret', '<PAYOUT_WORKER_SECRET>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
