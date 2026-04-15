create extension if not exists pg_cron;

do $$
begin
  begin
    perform cron.unschedule('cleanup-pending-payment-bookings');
  exception
    when others then
      null;
  end;
end $$;

select cron.schedule(
  'cleanup-pending-payment-bookings',
  '*/15 * * * *',
  $$delete from public.bookings where status = 'pending_payment' and created_at < now() - interval '15 minutes'$$
);
