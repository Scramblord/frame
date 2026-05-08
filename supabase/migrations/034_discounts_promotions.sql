-- Discounts & Promotions for expert services.
-- Automatic discounts: code is null.
-- Promo codes: code is non-null and mapped to Stripe promotion code.

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  expert_user_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid references public.services (id) on delete cascade,
  discount_type text not null
    constraint discounts_type_check check (discount_type in ('percentage', 'fixed')),
  amount numeric(12, 2) not null
    constraint discounts_amount_positive_check check (amount > 0),
  code text,
  stripe_coupon_id text not null,
  stripe_promotion_code_id text,
  start_date timestamptz,
  end_date timestamptz,
  max_uses integer
    constraint discounts_max_uses_positive_check check (max_uses is null or max_uses > 0),
  current_uses integer not null default 0
    constraint discounts_current_uses_non_negative_check check (current_uses >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discounts_date_range_check check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint discounts_code_promotion_pair_check check (
    (code is null and stripe_promotion_code_id is null)
    or (code is not null and stripe_promotion_code_id is not null)
  ),
  constraint discounts_percentage_range_check check (
    discount_type <> 'percentage' or (amount > 0 and amount <= 100)
  )
);

create index discounts_expert_user_id_idx on public.discounts (expert_user_id);
create index discounts_service_id_idx on public.discounts (service_id);
create index discounts_active_window_idx on public.discounts (is_active, start_date, end_date);
create index discounts_code_idx on public.discounts (code);

alter table public.discounts enable row level security;

create policy "Experts can read own discounts"
  on public.discounts
  for select
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Experts can insert own discounts"
  on public.discounts
  for insert
  to authenticated
  with check (auth.uid() = expert_user_id);

create policy "Experts can update own discounts"
  on public.discounts
  for update
  to authenticated
  using (auth.uid() = expert_user_id)
  with check (auth.uid() = expert_user_id);

create policy "Experts can delete own discounts"
  on public.discounts
  for delete
  to authenticated
  using (auth.uid() = expert_user_id);

create policy "Authenticated users can read active discounts"
  on public.discounts
  for select
  to authenticated
  using (
    is_active = true
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
    and (max_uses is null or current_uses < max_uses)
  );
