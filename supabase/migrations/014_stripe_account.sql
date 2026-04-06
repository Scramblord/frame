-- Stripe Connect: linked Express account id and onboarding completion flag on expert_profiles.

alter table public.expert_profiles
  add column if not exists stripe_account_id text;

alter table public.expert_profiles
  add column if not exists stripe_onboarding_complete boolean not null default false;
