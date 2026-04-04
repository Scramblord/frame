-- Row Level Security for expert_profiles

alter table public.expert_profiles enable row level security;

create policy "Experts can read own expert_profile"
  on public.expert_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Experts can insert own expert_profile"
  on public.expert_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Experts can update own expert_profile"
  on public.expert_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
