import {
  isPublicExpertUuid,
  loadPublicExpertPageData,
} from "./fetch-public-expert";
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
              : "fill-zinc-200 text-zinc-200 dark:fill-zinc-600 dark:text-zinc-600"
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
    return { title: "Expert — FRAME" };
  }
  const { profile } = await loadPublicExpertPageData(id);
  const name = profile?.full_name;
  return {
    title: name ? `${name} — FRAME` : "Expert — FRAME",
    description: name
      ? `Book a session with ${name} on FRAME.`
      : "Expert profile on FRAME.",
  };
}

export default async function ExpertPublicPage({ params }: PageProps) {
  const { id } = await params;
  if (!isPublicExpertUuid(id)) {
    notFound();
  }

  const { supabase, profile, expert } = await loadPublicExpertPageData(id);

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

  const displayName = profile.full_name?.trim() || "Expert";
  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const minM = expert?.min_session_minutes ?? 30;
  const maxM = expert?.max_session_minutes ?? 120;

  function formatSessionRange(a: number, b: number) {
    const fmt = (m: number) =>
      m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`;
    return `${fmt(a)} – ${fmt(b)}`;
  }

  const bookBase = `/book/${profile.id}`;

  return (
    <div className="min-h-full flex-1 bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-zinc-900 bg-zinc-900 font-mono text-[10px] font-bold tracking-[0.15em] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
              FR
            </span>
            <span className="font-mono text-lg font-bold tracking-[0.35em] sm:text-xl">
              FRAME
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl shadow-zinc-900/5 dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/40">
          <div className="border-b border-zinc-100 bg-gradient-to-br from-zinc-50 to-white px-6 py-8 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
              <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-inner dark:border-zinc-600 dark:bg-zinc-800 sm:mx-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="112px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-2xl font-semibold text-zinc-500 dark:text-zinc-400">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  {displayName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400 sm:justify-start">
                  {profile.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>📍</span>
                      {profile.location}
                    </span>
                  ) : null}
                  {expert?.timezone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>🕐</span>
                      {expert.timezone}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  {avgRating != null && !Number.isNaN(avgRating) ? (
                    <>
                      <Stars rating={Math.min(5, Math.max(0, avgRating))} />
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {avgRating.toFixed(1)} · {reviewCount}{" "}
                        {reviewCount === 1 ? "review" : "reviews"}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      No reviews yet
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
            {!expert ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                This expert has not published their full marketplace profile yet.
                Booking options and details will appear after they complete expert
                setup.
              </div>
            ) : null}

            {expert?.bio ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  About
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {expert.bio}
                </p>
              </section>
            ) : null}

            {expert?.keywords && expert.keywords.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Specialities
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {expert.keywords.map((k: string) => (
                    <li
                      key={k}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {k}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {expert ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Session length
              </h2>
              <p className="mt-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {formatSessionRange(minM, maxM)}
              </p>
            </section>
            ) : null}

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Consultation types
              </h2>
              {!expert ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Consultation types and pricing will be listed here once available.
                </p>
              ) : (
                <>
              <ul className="mt-4 space-y-4">
                {expert.offers_messaging && expert.messaging_flat_rate != null ? (
                  <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        Messaging
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Live in-app messaging — flat fee per session
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatGbp(Number(expert.messaging_flat_rate))}
                      </p>
                    </div>
                    <Link
                      href={`${bookBase}?consultation=messaging`}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Book now
                    </Link>
                  </li>
                ) : null}
                {expert.offers_audio && expert.audio_hourly_rate != null ? (
                  <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        Audio
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Voice sessions — per hour
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatGbp(Number(expert.audio_hourly_rate))}
                        <span className="text-sm font-normal text-zinc-500">
                          {" "}
                          / hr
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`${bookBase}?consultation=audio`}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Book now
                    </Link>
                  </li>
                ) : null}
                {expert.offers_video && expert.video_hourly_rate != null ? (
                  <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        Video
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Video calls — per hour
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatGbp(Number(expert.video_hourly_rate))}
                        <span className="text-sm font-normal text-zinc-500">
                          {" "}
                          / hr
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`${bookBase}?consultation=video`}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Book now
                    </Link>
                  </li>
                ) : null}
              </ul>
              {expert &&
              !expert.offers_messaging &&
              !expert.offers_audio &&
              !expert.offers_video ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  This expert has not enabled booking types yet.
                </p>
              ) : null}
                </>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Reviews
              </h2>
              {!reviewRows?.length ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  No reviews yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-5">
                  {reviewRows.map((r) => {
                    const rev = reviewerMap.get(r.reviewer_id);
                    const rName = rev?.full_name?.trim() || "Client";
                    const rInitials = rName
                      .split(/\s+/)
                      .map((w: string) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <li
                        key={r.id}
                        className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/30"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            {rev?.avatar_url ? (
                              <Image
                                src={rev.avatar_url}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                {rInitials}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {rName}
                              </span>
                              <Stars rating={r.rating} />
                            </div>
                            <time
                              dateTime={r.created_at}
                              className="text-xs text-zinc-500 dark:text-zinc-400"
                            >
                              {new Date(r.created_at).toLocaleDateString(
                                "en-GB",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </time>
                            {r.comment ? (
                              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                                {r.comment}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
