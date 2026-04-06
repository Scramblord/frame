-- Multiple time slots per day for weekly availability and date overrides.
-- Drops unique-per-day constraints; keeps data; replaces get_expert_availability_for_date.

alter table public.availability
  drop constraint if exists availability_expert_day_unique;

create index if not exists availability_expert_user_dow_idx
  on public.availability (expert_user_id, day_of_week);

alter table public.availability_overrides
  drop constraint if exists availability_overrides_expert_date_unique;

create index if not exists availability_overrides_expert_date_lookup_idx
  on public.availability_overrides (expert_user_id, date);

-- Replace RPC: multiple rows per date; blocked day returns a single unavailable row.
drop function if exists public.get_expert_availability_for_date(uuid, date);

create or replace function public.get_expert_availability_for_date(
  p_expert_user_id uuid,
  p_date date
)
returns table (
  is_available boolean,
  start_time time,
  end_time time,
  resolution text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_dow integer;
  r record;
  v_any_override boolean;
  v_blocked boolean;
  v_any_weekly boolean;
  v_custom_n integer;
begin
  select exists (
    select 1
    from public.availability_overrides o
    where o.expert_user_id = p_expert_user_id
      and o.date = p_date
  )
  into v_any_override;

  if v_any_override then
    select exists (
      select 1
      from public.availability_overrides o
      where o.expert_user_id = p_expert_user_id
        and o.date = p_date
        and o.is_blocked = true
    )
    into v_blocked;

    if v_blocked then
      return query
      select
        false,
        null::time,
        null::time,
        'override_blocked'::text;
      return;
    end if;

    select count(*)::integer
    into v_custom_n
    from public.availability_overrides o
    where o.expert_user_id = p_expert_user_id
      and o.date = p_date
      and o.is_blocked = false
      and o.start_time is not null
      and o.end_time is not null;

    if v_custom_n = 0 then
      return query
      select
        false,
        null::time,
        null::time,
        'unavailable'::text;
      return;
    end if;

    for r in
      select o.start_time, o.end_time
      from public.availability_overrides o
      where o.expert_user_id = p_expert_user_id
        and o.date = p_date
        and o.is_blocked = false
        and o.start_time is not null
        and o.end_time is not null
      order by o.start_time
    loop
      return query
      select true, r.start_time, r.end_time, 'override_custom'::text;
    end loop;
    return;
  end if;

  v_dow := extract(dow from p_date)::integer;

  v_any_weekly := false;
  for r in
    select a.start_time, a.end_time
    from public.availability a
    where a.expert_user_id = p_expert_user_id
      and a.is_active = true
      and a.day_of_week = v_dow
    order by a.start_time
  loop
    v_any_weekly := true;
    return query
    select true, r.start_time, r.end_time, 'weekly'::text;
  end loop;

  if not v_any_weekly then
    return query
    select
      false,
      null::time,
      null::time,
      'unavailable'::text;
  end if;
end;
$$;

grant execute on function public.get_expert_availability_for_date(uuid, date)
  to anon, authenticated;
