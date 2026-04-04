-- Allow anonymous reads for public expert profile pages (marketplace)

create policy "Public can read consumer and expert profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (role in ('consumer', 'expert'));

create policy "Public can read expert_profiles"
  on public.expert_profiles
  for select
  to anon, authenticated
  using (true);

alter table public.reviews enable row level security;

create policy "Public can read reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

create or replace function public.get_expert_review_stats(p_expert_user_id uuid)
returns table (avg_rating numeric, review_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    avg(rating::numeric),
    count(*)::bigint
  from public.reviews
  where reviewee_id = p_expert_user_id;
$$;

grant execute on function public.get_expert_review_stats(uuid) to anon, authenticated;
