import {
  isPublicExpertUuid,
  loadPublicExpertPageData,
} from "./fetch-public-expert";
import { reliabilityPercent } from "@/lib/cancellation";
import {
  summarizeWeeklyAvailability,
  type WeeklyAvailabilityRow,
} from "@/lib/expert-weekly-availability";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  const filled = Math.round(r);
  return (
    <div
      className="flex gap-0.5"
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${
            i <= filled
              ? "fill-amber-400 text-amber-400"
              : "fill-zinc-200 text-zinc-200"
          }`}
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L10 15.9 4.8 17.8l1-5.9L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isPublicExpertUuid(id)) {
    return { title: "Sensei — Sensei" };
  }
  const { profile } = await loadPublicExpertPageData(id);
  const name = profile?.full_name;
  return {
    title: name ? `${name} — Sensei` : "Sensei — Sensei",
    description: name
      ? `Book a session with ${name} on Sensei.`
      : "Sensei profile on Sensei.",
  };
}

export default async function ExpertPublicPage({ params }: PageProps) {
  const { id } = await params;
  if (!isPublicExpertUuid(id)) {
    notFound();
  }

  const { supabase, profile, expert, services } = await loadPublicExpertPageData(
    id,
  );

  if (!profile) {
    notFound();
  }

  const { data: statsRows, error: rpcError } = await supabase.rpc(
    "get_expert_review_stats",
    {
      p_expert_user_id: profile.user_id,
    },
  );

  let reviewCount = 0;
  let avgRating: number | null = null;

  if (!rpcError && statsRows != null) {
    const statRow = Array.isArray(statsRows) ? statsRows[0] : statsRows;
    reviewCount =
      statRow && typeof statRow === "object" && "review_count" in statRow
        ? Number((statRow as { review_count: number }).review_count)
        : 0;
    const avgRaw =
      statRow && typeof statRow === "object" && "avg_rating" in statRow
        ? (statRow as { avg_rating: string | number | null }).avg_rating
        : null;
    avgRating =
      avgRaw != null && avgRaw !== ""
        ? Number(avgRaw)
        : null;
  } else {
    const { data: ratingRows } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", profile.user_id);
    const ratings = ratingRows ?? [];
    reviewCount = ratings.length;
    avgRating =
      reviewCount > 0
        ? ratings.reduce((s, r) => s + r.rating, 0) / reviewCount
        : null;
  }

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, reviewer_id")
    .eq("reviewee_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(12);

  const reviewerIds = [
    ...new Set((reviewRows ?? []).map((r) => r.reviewer_id)),
  ];

  const { data: reviewerProfiles } =
    reviewerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", reviewerIds)
      : { data: [] };

  const reviewerMap = new Map(
    (reviewerProfiles ?? []).map((p) => [p.user_id, p]),
  );

  const { data: weeklyAvailabilityRows } = expert
    ? await supabase
        .from("availability")
        .select("day_of_week, start_time, end_time")
        .eq("expert_user_id", profile.user_id)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] };

  const availabilitySummaryLines = summarizeWeeklyAvailability(
    (weeklyAvailabilityRows ?? []) as WeeklyAvailabilityRow[],
  );
  const availabilityTzLabel =
    expert?.timezone?.trim() || "Europe/London";

  const reliabilityPct =
    expert != null
      ? reliabilityPercent(
          expert.expert_sessions_kept ?? 0,
          expert.expert_sessions_total ?? 0,
        )
      : null;

  const displayName = profile.full_name?.trim() || "Sensei";
  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function formatSessionRange(a: number, b: number) {
    const fmt = (m: number) =>
      m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`;
    return `${fmt(a)} – ${fmt(b)}`;
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-zinc-200 text-zinc-700">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="72px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-zinc-700">
                    {initials}
                  </div>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text)]">
                {displayName}
              </h1>
              {profile.location || expert?.timezone ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {[profile.location, expert?.timezone].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {expert?.keywords && expert.keywords.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {expert.keywords.slice(0, 5).map((k: string) => (
                    <li
                      key={k}
                      className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
                    >
                      {k}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="md:justify-self-end">
              {avgRating != null && !Number.isNaN(avgRating) ? (
                <p className="text-lg font-bold text-[var(--color-text)]">
                  ★ {avgRating.toFixed(1)}{" "}
                  <span className="text-sm font-normal text-[var(--color-text-muted)]">
                    ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </p>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No reviews yet</p>
              )}
              {expert?.expert_sessions_kept != null ? (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {expert.expert_sessions_kept} sessions completed
                </p>
              ) : null}
              {reliabilityPct != null ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {reliabilityPct}% reliability
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {!expert ? (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
            This Sensei has not published their full marketplace profile yet.
            Booking options and details will appear after they complete Sensei
            setup.
          </div>
        ) : null}

        {expert?.bio ? (
          <section className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-text)]">
              About
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-muted)]">
              {expert.bio}
            </p>
          </section>
        ) : null}

        {expert ? (
          <section className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Availability
            </h2>
            {availabilitySummaryLines.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                No availability set.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {availabilitySummaryLines.map((line) => {
                    const separatorIndex = line.indexOf(": ");
                    const day =
                      separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
                    const range =
                      separatorIndex >= 0
                        ? line.slice(separatorIndex + 2)
                        : "";
                    return (
                      <li key={line} className="flex items-start justify-between gap-4">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {day}
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {range}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Times shown in {availabilityTzLabel}.
                </p>
              </>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">
            Services
          </h2>
          {!expert ? (
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              Services and pricing will be listed here once available.
            </p>
          ) : services.length === 0 ? (
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              This Sensei has not published any services yet.
            </p>
          ) : (
            <ul className="mb-6 space-y-4">
              {services.map((svc) => {
                const book = (type: "messaging" | "audio" | "video") =>
                  `/book/${profile.id}/${svc.id}?type=${type}`;
                return (
                  <li
                    key={svc.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
                  >
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">
                      {svc.name}
                    </h3>
                    {svc.description ? (
                      <p className="mb-4 mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
                        {svc.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Session length:{" "}
                      {formatSessionRange(
                        svc.min_session_minutes,
                        svc.max_session_minutes,
                      )}
                    </p>
                    <ul className="mt-2">
                      {svc.offers_messaging &&
                      svc.messaging_flat_rate != null ? (
                        <li className="flex items-center justify-between border-t border-[var(--color-border)] py-3 first:border-0">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              💬 Messaging
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatGbp(Number(svc.messaging_flat_rate))}
                            </p>
                          </div>
                          <Link
                            href={book("messaging")}
                            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                          >
                            Book now
                          </Link>
                        </li>
                      ) : null}
                      {svc.offers_audio && svc.audio_hourly_rate != null ? (
                        <li className="flex items-center justify-between border-t border-[var(--color-border)] py-3 first:border-0">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              🎙 Audio
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatGbp(Number(svc.audio_hourly_rate))} / hr
                            </p>
                          </div>
                          <Link
                            href={book("audio")}
                            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                          >
                            Book now
                          </Link>
                        </li>
                      ) : null}
                      {svc.offers_video && svc.video_hourly_rate != null ? (
                        <li className="flex items-center justify-between border-t border-[var(--color-border)] py-3 first:border-0">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              📹 Video
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatGbp(Number(svc.video_hourly_rate))} / hr
                            </p>
                          </div>
                          <Link
                            href={book("video")}
                            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                          >
                            Book now
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">
            Reviews
          </h2>
          {!reviewRows?.length ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-8 text-center text-sm text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
              No reviews yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {reviewRows.map((r) => {
                const rev = reviewerMap.get(r.reviewer_id);
                const rName = rev?.full_name?.trim() || "Client";
                const rFirst =
                  rName.split(/\s+/).filter(Boolean)[0] ?? rName;
                const rInitials = rName
                  .split(/\s+/)
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={r.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200 text-zinc-700">
                          {rev?.avatar_url ? (
                            <Image
                              src={rev.avatar_url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="32px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-700">
                              {rInitials}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {rFirst}
                        </span>
                      </div>
                      <time
                        dateTime={r.created_at}
                        className="text-xs text-[var(--color-text-muted)]"
                      >
                        {new Date(r.created_at).toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <div className="mt-1 text-sm text-amber-400">
                      <Stars rating={r.rating} />
                    </div>
                    {r.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                        {r.comment}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
