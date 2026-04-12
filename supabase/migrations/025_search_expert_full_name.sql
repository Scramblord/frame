-- Marketplace search: also match each token against profiles.full_name.

create or replace function public.search_expert_user_ids(p_search text)
returns table (user_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct ep.user_id
  from public.expert_profiles ep
  inner join public.profiles pr on pr.user_id = ep.user_id
  where
    exists (
      select 1
      from public.services s0
      where s0.expert_user_id = ep.user_id
        and s0.is_active = true
    )
    and (
      p_search is null
      or trim(p_search) = ''
      or exists (
        select 1
        from unnest(
          regexp_split_to_array(trim(p_search), '[[:space:]]+')
        ) as tok
        where tok <> ''
          and (
            exists (
              select 1
              from unnest(ep.keywords) kw
              where kw ilike '%' || tok || '%'
            )
            or exists (
              select 1
              from public.services sv
              where sv.expert_user_id = ep.user_id
                and sv.is_active = true
                and (
                  sv.name ilike '%' || tok || '%'
                  or coalesce(sv.description, '') ilike '%' || tok || '%'
                )
            )
            or coalesce(pr.full_name, '') ilike '%' || tok || '%'
          )
      )
    );
$$;

grant execute on function public.search_expert_user_ids(text) to anon, authenticated;
