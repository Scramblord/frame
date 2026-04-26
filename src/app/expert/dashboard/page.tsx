import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import Navbar from "@/components/Navbar";
import SyncSenseiModeOnMount from "@/components/SyncSenseiModeOnMount";
import ScheduleTabs from "@/app/expert/dashboard/ScheduleTabs";
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
  const now = new Date();
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

  const { data: completedBookingsForStats } = await supabase
    .from("bookings")
    .select("total_amount, completed_at")
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

  const nowMs = now.getTime();
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

  const expertUpcomingAll =
    expertUpcomingRaw?.filter((b) => {
      if (b.duration_minutes == null || !b.scheduled_at) return false;
      const endMs =
        new Date(b.scheduled_at).getTime() + b.duration_minutes * 60 * 1000;
      return endMs > nowMs;
    }) ?? [];

  const expertUpcomingCards = await enrichBookingsForExpertCards(
    supabase,
    expertUpcomingAll as BookingListRow[],
  );
  const videoAudioBookings = expertUpcomingCards.filter(
    (b) => b.sessionType === "video" || b.sessionType === "audio",
  );
  const messagingBookings = expertUpcomingCards.filter(
    (b) => b.sessionType === "messaging" || b.sessionType === "urgent_messaging",
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

  const hour = now.getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "Sensei";

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const weeklyUpcomingCount = expertUpcomingAll.filter((b) => {
    if (!b.scheduled_at) return false;
    const ms = new Date(b.scheduled_at).getTime();
    return ms >= startOfWeek.getTime() && ms < endOfWeek.getTime();
  }).length;

  const monthLabel = now.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const subtitleLabel =
    weeklyUpcomingCount === 0
      ? monthLabel
      : weeklyUpcomingCount === 1
        ? `${monthLabel} — 1 session this week`
        : `${monthLabel} — ${weeklyUpcomingCount} sessions this week`;

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const completedThisMonth = (completedBookingsForStats ?? []).filter((b) => {
    if (!b.completed_at) return false;
    const ms = new Date(b.completed_at).getTime();
    return ms >= startOfMonth.getTime() && ms < endOfMonth.getTime();
  });

  const thisMonthRevenue = completedThisMonth.reduce((sum, b) => {
    const amount = typeof b.total_amount === "number" ? b.total_amount : Number(b.total_amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const formatGbpWhole = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const allTimeRevenue = (completedBookingsForStats ?? []).reduce((sum, b) => {
    const amount =
      typeof b.total_amount === "number" ? b.total_amount : Number(b.total_amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const avgPerSession =
    (sessionsCompleted ?? 0) > 0 ? allTimeRevenue / (sessionsCompleted ?? 1) : 0;
  const recentCompletedBookings = [...(completedBookingsForStats ?? [])]
    .filter((b) => Boolean(b.completed_at))
    .sort((a, b) => {
      const aMs = new Date(a.completed_at as string).getTime();
      const bMs = new Date(b.completed_at as string).getTime();
      return bMs - aMs;
    })
    .slice(0, 5);
  const activeDaysSummary =
    availability.length > 0
      ? [
          ...new Set(
            availability
              .map((a) => DAY_NAMES[a.day_of_week] ?? null)
              .filter((d): d is string => Boolean(d)),
          ),
        ].join(", ")
      : "No availability set.";
  const bioSummary = expert?.bio?.trim()
    ? expert.bio.trim().length > 60
      ? `${expert.bio.trim().slice(0, 60)}...`
      : expert.bio.trim()
    : "No bio added yet.";
  const activeServicesCount = services.filter((s) => s.is_active !== false).length;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--color-bg)]">
      <Navbar />
      <SyncSenseiModeOnMount senseiMode />
      <ActiveSessionBanner />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-10 sm:px-6">
        <header>
          <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {subtitleLabel}
          </p>
        </header>

        <section className="mb-8 mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              THIS MONTH
            </p>
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {thisMonthRevenue > 0 ? formatGbpWhole.format(thisMonthRevenue) : "£0"}
            </p>
          </article>

          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              SESSIONS
            </p>
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {sessionsCompleted ?? 0}
            </p>
            <p className="mt-1 text-xs font-medium text-green-600">
              +{completedThisMonth.length} this month
            </p>
          </article>

          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              AVG. RATING
            </p>
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {avgRating != null && !Number.isNaN(avgRating)
                ? `${avgRating.toFixed(1)} ★`
                : "—"}
            </p>
          </article>

          <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              RESPONSE
            </p>
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {"< 2h"}
            </p>
          </article>
        </section>

        <section>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">
                Schedule
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Upcoming sessions by format
              </p>
            </div>
            <Link
              href="/expert/availability"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              + Set availability
            </Link>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
            <ScheduleTabs
              videoAudioBookings={videoAudioBookings}
              messagingBookings={messagingBookings}
              hasUnreadMessages={false}
            />
            <div className="border-t border-[var(--color-border)] px-4 pb-1 pt-3 text-right">
              <Link
                href="/expert/bookings"
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                View all bookings →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">Earnings</h2>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Revenue across all session formats
          </p>

          {!canShowStripeEarnings || !earningsResult || !earningsResult.ok ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Connect your Stripe account to track earnings.{" "}
              <Link
                href="/expert/connect"
                className="text-[var(--color-accent)] hover:underline"
              >
                Connect Stripe
              </Link>
            </p>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    This month
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {thisMonthRevenue > 0 ? formatGbpWhole.format(thisMonthRevenue) : "£0"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    All time
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {allTimeRevenue > 0 ? formatGbpWhole.format(allTimeRevenue) : "£0"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    Avg / session
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {avgPerSession > 0 ? formatGbpWhole.format(avgPerSession) : "£0"}
                  </p>
                </div>
              </div>

              <p className="mb-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                RECENT PAYOUTS
              </p>
              {recentCompletedBookings.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No payouts yet.</p>
              ) : (
                <ul>
                  {recentCompletedBookings.map((booking) => {
                    const amount =
                      typeof booking.total_amount === "number"
                        ? booking.total_amount
                        : Number(booking.total_amount);
                    const dateLabel = booking.completed_at
                      ? new Date(booking.completed_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Unknown date";
                    return (
                      <li
                        key={`${booking.completed_at}-${booking.total_amount}`}
                        className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0"
                      >
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {dateLabel}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-text)]">
                          {Number.isFinite(amount) ? formatGbp(amount) : "£0.00"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 text-right">
                <Link
                  href="/expert/earnings"
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  View earnings →
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">Settings</h2>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Your profile, availability, and services
          </p>

          <div className="flex items-center justify-between border-b border-[var(--color-border)] py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">Profile</p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">{bioSummary}</p>
            </div>
            <Link href="/expert/setup" className="text-sm text-[var(--color-accent)] hover:underline">
              Edit →
            </Link>
          </div>

          <div className="flex items-center justify-between border-b border-[var(--color-border)] py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">Availability</p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">{activeDaysSummary}</p>
            </div>
            <Link href="/expert/availability" className="text-sm text-[var(--color-accent)] hover:underline">
              Edit →
            </Link>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Services</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {activeServicesCount > 0
                  ? `${activeServicesCount} active services`
                  : "No services added yet."}
              </p>
            </div>
            <Link href="/expert/setup" className="text-sm text-[var(--color-accent)] hover:underline">
              Edit →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
