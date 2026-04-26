import type { SupabaseClient } from "@supabase/supabase-js";

export function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

/** Row from `public.services` (active marketplace listings). */
export type ServiceRow = {
  id: string;
  expert_user_id: string;
  name: string;
  description: string | null;
  min_session_minutes: number;
  max_session_minutes: number;
  offers_messaging: boolean;
  messaging_flat_rate: number | string | null;
  offers_audio: boolean;
  audio_hourly_rate: number | string | null;
  offers_video: boolean;
  video_hourly_rate: number | string | null;
  urgent_messaging_enabled?: boolean;
  urgent_messaging_rate?: number | string | null;
  messaging_response_hours?: number | null;
  is_active: boolean;
  created_at?: string;
};

/** Lowest price for a single service (messaging flat or hourly rates). */
export function lowestPriceForService(
  s: Pick<
    ServiceRow,
    | "offers_messaging"
    | "messaging_flat_rate"
    | "offers_audio"
    | "audio_hourly_rate"
    | "offers_video"
    | "video_hourly_rate"
  >,
): number | null {
  const rates: number[] = [];
  if (s.offers_messaging && s.messaging_flat_rate != null)
    rates.push(Number(s.messaging_flat_rate));
  if (s.offers_audio && s.audio_hourly_rate != null)
    rates.push(Number(s.audio_hourly_rate));
  if (s.offers_video && s.video_hourly_rate != null)
    rates.push(Number(s.video_hourly_rate));
  if (!rates.length) return null;
  return Math.min(...rates);
}

/** Minimum price across all services (ignores services with no enabled rates). */
export function lowestPriceAcrossServices(services: ServiceRow[]): number | null {
  const prices = services
    .map((s) => lowestPriceForService(s))
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (!prices.length) return null;
  return Math.min(...prices);
}

/**
 * Lowest listing price for an expert (uses attached `services` from fetchExpertsWithProfiles).
 */
export function startingPrice(
  expert: ExpertWithProfile,
): number | null {
  const list = expert.services ?? [];
  if (!list.length) return null;
  return lowestPriceAcrossServices(list);
}

/** Expert profile row merged with matching `profiles` row and active `services`. */
export type ExpertWithProfile = Record<string, unknown> & {
  user_id: string;
  keywords?: string[] | null;
  bio?: string | null;
  avg_rating?: number | null;
  review_count?: number;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  services?: ServiceRow[];
};

/**
 * When `search` is non-empty, returns the first active service whose name or
 * description matches any search token (substring, case-insensitive). Used on
 * search results to highlight a matching service; `null` if the expert matched
 * only via profile keywords.
 */
export function matchingServiceNameForSearch(
  expert: ExpertWithProfile,
  search: string,
): string | null {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const svcs = expert.services ?? [];
  for (const s of svcs) {
    if (!s.is_active) continue;
    const name = (s.name ?? "").toLowerCase();
    const desc = (s.description ?? "").toLowerCase();
    if (
      tokens.some(
        (t) => name.includes(t) || (desc.length > 0 && desc.includes(t)),
      )
    ) {
      return s.name;
    }
  }
  return null;
}

export async function fetchExpertsWithProfiles(
  supabase: SupabaseClient,
  query?: string,
): Promise<ExpertWithProfile[]> {
  const trimmed = (query ?? "").trim();

  const { data: idRows, error: rpcError } = await supabase.rpc(
    "search_expert_user_ids",
    { p_search: trimmed.length > 0 ? trimmed : null },
  );

  if (rpcError) {
    console.error("search_expert_user_ids:", rpcError.message);
  }

  let expertProfiles: Record<string, unknown>[] = [];

  if (!rpcError && idRows != null) {
    const ids = (idRows as { user_id: string }[])
      .map((r) => r.user_id)
      .filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const { data: rows } = await supabase
      .from("expert_profiles")
      .select("*")
      .in("user_id", ids);
    expertProfiles = (rows ?? []) as Record<string, unknown>[];
  } else {
    const { data: rows } = await supabase.from("expert_profiles").select("*");
    expertProfiles = (rows ?? []) as Record<string, unknown>[];
  }

  const userIds = [
    ...new Set(expertProfiles.map((ep) => ep.user_id as string)),
  ];

  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("*").in("user_id", userIds)
      : { data: [] as { user_id: string }[] };

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string }) => [p.user_id, p]),
  );

  const { data: allServices } =
    userIds.length > 0
      ? await supabase
          .from("services")
          .select("*")
          .in("expert_user_id", userIds)
          .eq("is_active", true)
      : { data: [] as ServiceRow[] };

  const servicesByExpert = new Map<string, ServiceRow[]>();
  for (const s of allServices ?? []) {
    const uid = s.expert_user_id as string;
    const list = servicesByExpert.get(uid) ?? [];
    list.push(s as ServiceRow);
    servicesByExpert.set(uid, list);
  }

  const { data: reviewStatsRows } =
    userIds.length > 0
      ? await supabase
          .from("expert_review_stats")
          .select("expert_user_id, avg_rating, review_count")
          .in("expert_user_id", userIds)
      : {
          data: [] as {
            expert_user_id: string;
            avg_rating: number | string | null;
            review_count: number | string;
          }[],
        };

  const reviewStatsByExpert = new Map<
    string,
    { review_count: number; avg_rating: number | null }
  >();
  for (const row of reviewStatsRows ?? []) {
    reviewStatsByExpert.set(row.expert_user_id as string, {
      review_count: Number(row.review_count) || 0,
      avg_rating:
        row.avg_rating == null ? null : Number(row.avg_rating),
    });
  }

  let experts = expertProfiles
    .map((ep) => ({
      ...ep,
      profile: profileMap.get(ep.user_id as string) as ExpertWithProfile["profile"],
      services: servicesByExpert.get(ep.user_id as string) ?? [],
      review_count: reviewStatsByExpert.get(ep.user_id as string)?.review_count ?? 0,
      avg_rating: reviewStatsByExpert.get(ep.user_id as string)?.avg_rating ?? null,
    }))
    .filter((ep) => ep.profile?.id) as ExpertWithProfile[];

  if (rpcError) {
    if (trimmed) {
      const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      experts = experts.filter((ep) => {
        const kws = (ep.keywords ?? []).map((k: string) => k.toLowerCase());
        return tokens.some((tok) =>
          kws.some((kw: string) => kw.includes(tok)),
        );
      });
    }
  }

  experts.sort((a, b) =>
    (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? ""),
  );

  return experts;
}
