-- Allow anonymous clients to see active automatic discounts (code is null) for public badges.

create policy "Anon users can read active automatic discounts"
  on public.discounts
  for select
  to anon
  using (
    is_active = true
    and code is null
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
    and (max_uses is null or current_uses < max_uses)
  );
