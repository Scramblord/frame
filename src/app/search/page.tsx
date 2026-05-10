import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import {
  fetchExpertsWithProfiles,
  matchingServiceNameForSearch,
  startingPrice,
  type ExpertWithProfile,
} from "@/lib/experts-marketplace";
import {
  expertMatchesFoundingSet,
  fetchFoundingSenseiUserIds,
} from "@/lib/founding-sensei";
import type { SearchExpertSerialized } from "@/app/search/search-types";
import SearchBrowseClient from "@/app/search/SearchBrowseClient";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Find Senseis — Sensei",
  description: "Search Sensei guides by topic and speciality.",
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function serializeSearchExperts(
  experts: ExpertWithProfile[],
  keyword: string,
  expertsWithAvailability: Set<string>,
  foundingIds: Set<string>,
): SearchExpertSerialized[] {
  return experts.map((ep, relevanceOrder) => {
    const profile = ep.profile;
    const svcs = ep.services ?? [];
    const name = profile?.full_name?.trim() || "Sensei";
    const initials = name
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      userId: ep.user_id,
      profileId: profile?.id ?? "",
      displayName: name,
      initials,
      avatarUrl: profile?.avatar_url ?? null,
      keywords: ep.keywords ?? [],
      matchedServiceName: keyword.trim()
        ? matchingServiceNameForSearch(ep, keyword)
        : null,
      fromPrice: startingPrice(ep),
      avgRating:
        typeof ep.avg_rating === "number" && Number.isFinite(ep.avg_rating)
          ? ep.avg_rating
          : ep.avg_rating != null
            ? Number(ep.avg_rating)
            : null,
      reviewCount: typeof ep.review_count === "number" ? ep.review_count : 0,
      offersVideo: svcs.some((s) => s.offers_video),
      offersAudio: svcs.some((s) => s.offers_audio),
      offersMessaging: svcs.some(
        (s) =>
          s.offers_messaging ||
          (s as { urgent_messaging_enabled?: boolean }).urgent_messaging_enabled === true,
      ),
      hasAvailabilitySlots: expertsWithAvailability.has(ep.user_id),
      isFounding: expertMatchesFoundingSet(foundingIds, ep, profile as { user_id?: unknown }),
      relevanceOrder,
    };
  });
}

function SearchSkeleton() {
  return (
    <>
      <div className="mb-6 h-14 animate-pulse rounded-xl bg-zinc-200" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[var(--radius-md)] bg-zinc-100" />
        ))}
      </div>
    </>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const trimmed = (q ?? "").trim();

  const [experts, foundingUserIds] = await Promise.all([
    fetchExpertsWithProfiles(supabase, trimmed),
    fetchFoundingSenseiUserIds(supabase),
  ]);

  const expertIds = experts.map((e) => e.user_id);

  const [{ data: discountRows }, { data: availabilityRows }] = await Promise.all([
    expertIds.length > 0
      ? supabase
          .from("discounts")
          .select(
            "expert_user_id, is_active, code, start_date, end_date, max_uses, current_uses",
          )
          .in("expert_user_id", expertIds)
          .is("code", null)
          .eq("is_active", true)
      : {
          data: [] as {
            expert_user_id: string;
            start_date?: string | null;
            end_date?: string | null;
            max_uses?: number | null;
            current_uses?: number | null;
          }[],
        },
    expertIds.length > 0
      ? supabase
          .from("availability")
          .select("expert_user_id")
          .in("expert_user_id", expertIds)
          .eq("is_active", true)
      : { data: [] as { expert_user_id: string }[] },
  ]);

  const nowIso = new Date().toISOString();
  type DiscountRow = {
    expert_user_id: string;
    start_date?: string | null;
    end_date?: string | null;
    max_uses?: number | null;
    current_uses?: number | null;
  };
  const discountExpertIds = (discountRows ?? [] as DiscountRow[])
    .filter((d) => d.start_date == null || d.start_date <= nowIso)
    .filter((d) => d.end_date == null || d.end_date >= nowIso)
    .filter((d) => d.max_uses == null || (d.current_uses ?? 0) < d.max_uses)
    .map((d) => d.expert_user_id);

  const expertsWithAvailability = new Set(
    (availabilityRows ?? []).map((r) => r.expert_user_id),
  );

  const serialized = serializeSearchExperts(
    experts,
    trimmed,
    expertsWithAvailability,
    foundingUserIds,
  );

  return (
    <div className="min-h-screen w-full flex-1 bg-[var(--color-bg)]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6 lg:max-w-6xl">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Find a Sensei
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Search by topic, skill, or speciality.
        </p>

        {experts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {trimmed
                ? `No Senseis found for "${trimmed}". Try a different search.`
                : "No Senseis found yet."}
            </p>
          </div>
        ) : (
          <Suspense fallback={<SearchSkeleton />}>
            <SearchBrowseClient
              experts={serialized}
              discountExpertIds={discountExpertIds}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
