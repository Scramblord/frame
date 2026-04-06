-- Dates in [p_start_date, p_end_date] where get_expert_availability_for_date returns at least one real slot.
-- Matches override + weekly logic via the existing RPC (single source of truth).

create or replace function public.get_expert_available_dates(
  p_expert_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (available_date date)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  d date;
begin
  if p_end_date < p_start_date then
    return;
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    if exists (
      select 1
      from public.get_expert_availability_for_date(p_expert_user_id, d) x
      where x.is_available = true
        and x.start_time is not null
        and x.end_time is not null
    ) then
      available_date := d;
      return next;
    end if;
    d := d + 1;
  end loop;
  return;
end;
$$;

grant execute on function public.get_expert_available_dates(uuid, date, date)
  to anon, authenticated;
