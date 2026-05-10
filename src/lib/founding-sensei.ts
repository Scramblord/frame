import type { SupabaseClient } from "@supabase/supabase-js";

const FOUNDING_LIMIT = 100;

/** Canonical auth user id for founding checks (matches expert_profiles.user_id / profiles.user_id). */
function foundingExpertUserIdKey(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * User IDs of the first {@link FOUNDING_LIMIT} experts with Stripe onboarding complete,
 * ordered by expert_profiles.created_at ascending, then id for stable ordering.
 * Values are `expert_profiles.user_id` as normalized strings.
 */
export async function fetchFoundingSenseiUserIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("expert_profiles")
    .select("user_id")
    .eq("stripe_onboarding_complete", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(FOUNDING_LIMIT);

  if (error) return new Set();
  const keys = (data ?? [])
    .map((r) => foundingExpertUserIdKey(r.user_id))
    .filter((k): k is string => k != null);
  return new Set(keys);
}
