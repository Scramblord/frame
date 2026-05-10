import type { SupabaseClient } from "@supabase/supabase-js";

const FOUNDING_LIMIT = 100;

/**
 * User IDs of the first {@link FOUNDING_LIMIT} experts with Stripe onboarding complete,
 * ordered by expert_profiles.created_at ascending, then id for stable ordering.
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
  return new Set((data ?? []).map((r) => r.user_id as string));
}
