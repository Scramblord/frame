create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Allow plain 'system' for automated closures/refunds.
alter table public.bookings
  drop constraint if exists bookings_messaging_closed_by_check;

alter table public.bookings
  add constraint bookings_messaging_closed_by_check check (
    messaging_closed_by is null
    or messaging_closed_by in (
      'expert',
      'system',
      'system_inactivity',
      'system_cap',
      'system_sla_expired'
    )
  );

create or replace function public.enqueue_messaging_sla_refunds()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  app_base_url text;
  worker_secret text;
begin
  app_base_url := trim(coalesce(current_setting('app.settings.app_url', true), ''));
  worker_secret := trim(coalesce(current_setting('app.settings.payout_worker_secret', true), ''));

  if app_base_url = '' or worker_secret = '' then
    return;
  end if;

  for b in
    select bk.id
    from public.bookings bk
    join public.services s on s.id = bk.service_id
    where bk.session_type in ('messaging', 'urgent_messaging')
      and bk.status = 'in_progress'
      and bk.messaging_opened_at is not null
      and bk.messaging_closed_at is null
      and now() > bk.messaging_opened_at + (coalesce(s.messaging_response_hours, 24) * interval '1 hour')
      and not exists (
        select 1
        from public.messages m
        where m.booking_id = bk.id
          and m.sender_id = bk.expert_user_id
          and m.created_at > bk.messaging_opened_at
      )
  loop
    perform net.http_post(
      url := app_base_url || '/api/messages/sla-refund',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-payout-worker-secret', worker_secret
      ),
      body := jsonb_build_object('bookingId', b.id)
    );
  end loop;
end;
$$;

create or replace function public.enqueue_messaging_inactivity_closures()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  app_base_url text;
  worker_secret text;
begin
  app_base_url := trim(coalesce(current_setting('app.settings.app_url', true), ''));
  worker_secret := trim(coalesce(current_setting('app.settings.payout_worker_secret', true), ''));

  if app_base_url = '' or worker_secret = '' then
    return;
  end if;

  for b in
    select bk.id
    from public.bookings bk
    where bk.session_type in ('messaging', 'urgent_messaging')
      and bk.status = 'in_progress'
      and bk.messaging_closed_at is null
      and exists (
        select 1
        from public.messages m0
        where m0.booking_id = bk.id
      )
      and (
        select max(m.created_at)
        from public.messages m
        where m.booking_id = bk.id
      ) < now() - interval '48 hours'
  loop
    perform net.http_post(
      url := app_base_url || '/api/messages/inactivity-close',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-payout-worker-secret', worker_secret
      ),
      body := jsonb_build_object('bookingId', b.id)
    );
  end loop;
end;
$$;

do $$
begin
  begin
    perform cron.unschedule('messaging-sla-breach-check');
  exception
    when others then
      null;
  end;
end $$;

select cron.schedule(
  'messaging-sla-breach-check',
  '*/15 * * * *',
  $$select public.enqueue_messaging_sla_refunds();$$
);

do $$
begin
  begin
    perform cron.unschedule('messaging-inactivity-close');
  exception
    when others then
      null;
  end;
end $$;

select cron.schedule(
  'messaging-inactivity-close',
  '0 * * * *',
  $$select public.enqueue_messaging_inactivity_closures();$$
);
