import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import { ExpertBookingCard } from "@/components/ExpertBookingCard";
import Navbar from "@/components/Navbar";
import type { BookingListRow } from "@/lib/consumer-bookings";
import { enrichBookingsForExpertCards } from "@/lib/expert-bookings";
import { fetchExpertStripeEarnings } from "@/lib/expert-stripe-earnings";
import { createClient } from "@/lib/supabase/server";
import {
  formatGbp,
  lowestPriceForService,
} from "@/lib/experts-marketplace";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, location")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!expert) {
    redirect("/expert/setup");
  }

  const { data: serviceRows } = await supabase
    .from("services")
    .select("*")
    .eq("expert_user_id", user.id)
    .order("created_at", { ascending: true });

  const services = serviceRows ?? [];

  const { data: availabilityRows } = await supabase
    .from("availability")
    .select("id, day_of_week, start_time, end_time, is_active")
    .eq("expert_user_id", user.id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const availability = availabilityRows ?? [];

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function formatAvailTime(t: string) {
    return t.length >= 5 ? t.slice(0, 5) : t;
  }

  const { count: sessionsCompleted } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("expert_user_id", user.id)
    .eq("status", "completed");

  const { data: statsRows, error: statsError } = await supabase.rpc(
    "get_expert_review_stats",
    { p_expert_user_id: user.id },
  );

  let avgRating: number | null = null;
  let reviewCount = 0;

  if (!statsError && statsRows != null) {
    const row = Array.isArray(statsRows) ? statsRows[0] : statsRows;
    if (row && typeof row === "object") {
      const rc = (row as { review_count?: number }).review_count;
      const ar = (row as { avg_rating?: string | number | null }).avg_rating;
      reviewCount = rc != null ? Number(rc) : 0;
      avgRating =
        ar != null && ar !== ""
          ? Number(ar)
          : null;
    }
  } else {
    const { data: revs } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", user.id);
    const list = revs ?? [];
    reviewCount = list.length;
    avgRating =
      reviewCount > 0
        ? list.reduce((s, r) => s + r.rating, 0) / reviewCount
        : null;
  }

  const nowMs = Date.now();
  const { data: expertUpcomingRaw } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, duration_minutes, status, session_type, service_id, expert_user_id, consumer_user_id",
    )
    .eq("expert_user_id", user.id)
    .not("scheduled_at", "is", null)
    .in("status", ["confirmed", "in_progress"])
    .order("scheduled_at", { ascending: true })
    .limit(50);

  const expertUpcomingRows =
    expertUpcomingRaw?.filter((b) => {
      if (b.duration_minutes == null || !b.scheduled_at) return false;
      const endMs =
        new Date(b.scheduled_at).getTime() + b.duration_minutes * 60 * 1000;
      return endMs > nowMs;
    }).slice(0, 3) ?? [];

  const expertUpcomingCards = await enrichBookingsForExpertCards(
    supabase,
    expertUpcomingRows as BookingListRow[],
  );

  const keywords = expert?.keywords ?? [];

  const hasPublishedRates = services.some(
    (s) => lowestPriceForService(s) != null,
  );

  const stripeOnboardingComplete = expert?.stripe_onboarding_complete === true;
  const stripeAccountId =
    typeof expert?.stripe_account_id === "string"
      ? expert.stripe_account_id.trim()
      : "";
  const canShowStripeEarnings =
    stripeOnboardingComplete && Boolean(stripeAccountId);

  const earningsResult = canShowStripeEarnings
    ? await fetchExpertStripeEarnings(stripeAccountId)
    : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />
      <ActiveSessionBanner />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {!stripeOnboardingComplete ? (
          <div className="mb-8 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 shadow-sm dark:border-amber-700/80 dark:bg-amber-950/40 sm:px-5 sm:py-4">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              You need to connect your bank account before you can accept
              bookings and receive payouts.
            </p>
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
              Complete Stripe Connect onboarding to receive earnings from
              completed sessions.
            </p>
            <Link
              href="/expert/connect"
              className="mt-3 inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            >
              Connect bank account
            </Link>
          </div>
        ) : null}

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Expert dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile and sessions.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Profile
              </h2>
              <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.full_name?.trim() || "Expert"}
              </p>
              {profile.location ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {profile.location}
                </p>
              ) : null}
            </div>
            <Link
              href="/expert/setup"
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Edit profile
            </Link>
          </div>

          {expert?.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {String(expert.bio)}
            </p>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No bio yet — add one when you edit your profile.
            </p>
          )}

          {keywords.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Specialities
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {keywords.map((k: string) => (
                  <li
                    key={k}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Services
            </p>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                No services yet — add them in profile setup.
              </p>
            ) : (
              <ul className="mt-3 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                {services.map((svc) => (
                  <li
                    key={svc.id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {svc.name}
                      {!svc.is_active ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          (inactive)
                        </span>
                      ) : null}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {svc.offers_messaging &&
                      svc.messaging_flat_rate != null ? (
                        <li>
                          Messaging:{" "}
                          {formatGbp(Number(svc.messaging_flat_rate))} flat
                        </li>
                      ) : null}
                      {svc.offers_audio && svc.audio_hourly_rate != null ? (
                        <li>
                          Audio: {formatGbp(Number(svc.audio_hourly_rate))} / hr
                        </li>
                      ) : null}
                      {svc.offers_video && svc.video_hourly_rate != null ? (
                        <li>
                          Video: {formatGbp(Number(svc.video_hourly_rate))} / hr
                        </li>
                      ) : null}
                      {!svc.offers_messaging &&
                      !svc.offers_audio &&
                      !svc.offers_video ? (
                        <li className="text-zinc-500">No rates configured</li>
                      ) : null}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {!hasPublishedRates && services.length > 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Enable consultation types and pricing in profile setup.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Availability
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your timezone:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {expert?.timezone?.trim() || "UTC"}
                </span>
              </p>
            </div>
            <Link
              href="/expert/availability"
              className="shrink-0 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
            >
              Edit availability
            </Link>
          </div>
          {availability.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No weekly hours set yet. Add your schedule so clients know when you
              can take bookings.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {availability.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {DAY_NAMES[a.day_of_week] ?? "Day"}
                  </span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatAvailTime(String(a.start_time))} –{" "}
                    {formatAvailTime(String(a.end_time))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Earnings
          </h2>
          {!canShowStripeEarnings ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-6 dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Connect your bank account to start receiving payments
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Once Stripe Connect is complete, your balance and payouts from
                completed sessions will appear here.
              </p>
              <Link
                href="/expert/connect"
                className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Connect bank account
              </Link>
            </div>
          ) : earningsResult && !earningsResult.ok ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Earnings data unavailable
            </p>
          ) : earningsResult && earningsResult.ok ? (
            <>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Available balance
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatGbp(earningsResult.data.availablePence / 100)}
                  </dd>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Ready to pay out
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Pending balance
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatGbp(earningsResult.data.pendingPence / 100)}
                  </dd>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    On the way, not yet available
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    This month
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatGbp(earningsResult.data.thisMonthPence / 100)}
                  </dd>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Last month
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatGbp(earningsResult.data.lastMonthPence / 100)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Lifetime earnings:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {formatGbp(earningsResult.data.lifetimePence / 100)}
                </span>
              </p>
              <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Recent payouts
                </h3>
                {earningsResult.data.recentTransfers.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    No payouts yet — earnings will appear here after completed
                    sessions.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {earningsResult.data.recentTransfers.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-800/40"
                      >
                        <time
                          dateTime={new Date(t.created * 1000).toISOString()}
                          className="text-zinc-600 dark:text-zinc-400"
                        >
                          {new Date(t.created * 1000).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </time>
                        <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatGbp(t.amountPence / 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Upcoming bookings
          </h2>
          {expertUpcomingCards.length === 0 ? (
            <>
              <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
                No upcoming sessions yet.
              </p>
              <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Link
                  href="/expert/bookings"
                  className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  View all bookings
                </Link>
              </div>
            </>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {expertUpcomingCards.map((card) => (
                  <li key={card.bookingId}>
                    <ExpertBookingCard {...card} />
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Link
                  href="/expert/bookings"
                  className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  View all bookings
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your stats
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Sessions completed
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {sessionsCompleted ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Average rating
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {avgRating != null && !Number.isNaN(avgRating)
                  ? avgRating.toFixed(1)
                  : "—"}
                {avgRating != null && !Number.isNaN(avgRating) ? (
                  <span className="text-lg text-amber-500"> ★</span>
                ) : null}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reviews
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {reviewCount}
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
