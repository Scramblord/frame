-- Date-specific availability overrides on top of weekly `availability` rows.
-- Safe to re-run: IF NOT EXISTS table, OR REPLACE function, idempotent RLS policies.

create table if not exists public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  expert_user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  is_blocked boolean not null default false,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  constraint availability_overrides_expert_date_unique unique (expert_user_id, date),
  constraint availability_overrides_block_or_custom check (
    (is_blocked = true and start_time is null and end_time is null)
    or (
      is_blocked = false
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
  )
);

create index if not exists availability_overrides_expert_date_idx
  on public.availability_overrides (expert_user_id, date);

alter table public.availability_overrides enable row level security;

drop policy if exists "Experts can insert own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can update own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can delete own availability overrides"
  on public.availability_overrides;
drop policy if exists "Experts can read own availability overrides"
  on public.availability_overrides;
drop policy if exists "Public can read availability overrides"
  on public.availability_overrides;

create policy "Experts can insert own availability overrides"
  on public.availability_overrides
  for insert
  to authenticated
  with check (auth.uid() = expert_user_id);

create policy "Experts can update own availability overrides"
  on public.availability_overrides
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

create policy "Experts can delete own availability overrides"
  on public.availability_overrides
  for delete
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Experts can read own availability overrides"
  on public.availability_overrides
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Public can read availability overrides"
  on public.availability_overrides
  for select
  to anon, authenticated
  using (true);

-- Override wins when present; otherwise use weekly `availability` for that DOW (0=Sun .. 6=Sat).
create or replace function public.get_expert_availability_for_date(
  p_expert_user_id uuid,
  p_date date
)
returns table (
  is_blocked boolean,
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
  v_blocked boolean;
  v_st time;
  v_et time;
  v_wk_st time;
  v_wk_et time;
  v_dow integer;
begin
  select o.is_blocked, o.start_time, o.end_time
  into v_blocked, v_st, v_et
  from public.availability_overrides o
  where o.expert_user_id = p_expert_user_id
    and o.date = p_date
  limit 1;

  if found then
    if v_blocked then
      return query
      select true, null::time, null::time, 'override_blocked'::text;
      return;
    end if;
    if v_st is not null and v_et is not null then
      return query
      select false, v_st, v_et, 'override_custom'::text;
      return;
    end if;
  end if;

  v_dow := extract(dow from p_date)::integer;

  select a.start_time, a.end_time
  into v_wk_st, v_wk_et
  from public.availability a
  where a.expert_user_id = p_expert_user_id
    and a.is_active = true
    and a.day_of_week = v_dow
  limit 1;

  if found then
    return query
    select false, v_wk_st, v_wk_et, 'weekly'::text;
  else
    return query
    select false, null::time, null::time, 'unavailable'::text;
  end if;
end;
$$;

grant execute on function public.get_expert_availability_for_date(uuid, date)
  to anon, authenticated;
