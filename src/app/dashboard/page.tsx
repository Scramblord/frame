import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import { ConsumerBookingCard } from "@/components/ConsumerBookingCard";
import { enrichBookingsForConsumerCards } from "@/lib/consumer-bookings";
import Navbar from "@/components/Navbar";
import SyncSenseiModeOnMount from "@/components/SyncSenseiModeOnMount";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  fetchExpertsWithProfiles,
  formatGbp,
  startingPrice,
} from "@/lib/experts-marketplace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || "there";

  const nowMs = Date.now();
  const { data: upcomingRaw } = await supabase
    .from("bookings")
    .select(
      "id, scheduled_at, duration_minutes, status, session_type, service_id, expert_user_id",
    )
    .eq("consumer_user_id", user.id)
    .not("scheduled_at", "is", null)
    .in("status", ["pending_payment", "confirmed", "in_progress"])
    .order("scheduled_at", { ascending: true })
    .limit(50);

  const upcomingRows =
    upcomingRaw?.filter((b) => {
      if (b.duration_minutes == null || !b.scheduled_at) return false;
      const endMs =
        new Date(b.scheduled_at).getTime() + b.duration_minutes * 60 * 1000;
      return endMs > nowMs;
    }).slice(0, 3) ?? [];

  const upcomingCards = await enrichBookingsForConsumerCards(
    supabase,
    upcomingRows,
  );

  const featuredExperts = await fetchExpertsWithProfiles(supabase);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      <Navbar />
      <SyncSenseiModeOnMount senseiMode={false} />
      <ActiveSessionBanner />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-10 sm:px-6">
        <section>
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Hey {displayName}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Find your next session
          </h1>

          <form
            action="/search"
            method="get"
            className="mt-6 flex h-14 items-center rounded-xl border border-[var(--color-border)] bg-white px-2 shadow-[var(--shadow-sm)]"
          >
            <input
              id="dashboard-q"
              name="q"
              type="search"
              placeholder="Search by topic — BJJ, physio, mobility…"
              className="h-full w-full border-0 bg-transparent px-3 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)]"
              autoComplete="off"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Search
            </button>
          </form>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              Featured Senseis
            </h2>
            <Link
              href="/search"
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              Browse all
            </Link>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Coaches and clinicians on Sensei right now.
          </p>

          {featuredExperts.length === 0 ? (
            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center shadow-[var(--shadow-sm)]">
              <p className="text-sm text-[var(--color-text-muted)]">
                No Senseis available yet.
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {featuredExperts.map((ep) => {
                const p = ep.profile;
                if (!p?.id) return null;
                const name = p.full_name?.trim() || "Sensei";
                const initials = name
                  .split(/\s+/)
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const fromPrice = startingPrice(ep);
                const tags = (ep.keywords ?? []).slice(0, 4);
                const bio =
                  typeof ep.bio === "string" ? ep.bio.trim() : "";
                const truncatedBio =
                  bio.length > 100 ? `${bio.slice(0, 100)}...` : bio;
                const reviewCount =
                  typeof ep.review_count === "number" ? ep.review_count : 0;
                const avgRating =
                  typeof ep.avg_rating === "number" ? ep.avg_rating : null;

                return (
                  <li key={ep.user_id as string}>
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200 text-zinc-700">
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                            width={44}
                            height={44}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                            {initials}
                          </div>
                        )}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {name}
                            </p>
                            {tags.length > 0 ? (
                              <ul className="mt-2 flex flex-wrap gap-1">
                                {tags.map((tag: string) => (
                                  <li
                                    key={tag}
                                    className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                                  >
                                    {tag}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          {fromPrice != null ? (
                            <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
                              From {formatGbp(fromPrice)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {truncatedBio ? (
                        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                          {truncatedBio}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {reviewCount > 0 && avgRating != null
                            ? `★ ${avgRating.toFixed(1)} (${reviewCount} reviews)`
                            : "No reviews yet"}
                        </p>
                        <Link
                          href={`/experts/${p.id}`}
                          className="text-xs text-[var(--color-accent)] hover:underline"
                        >
                          View profile →
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-12 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            Upcoming bookings
          </h2>
          {upcomingCards.length === 0 ? (
            <div className="mt-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                No upcoming sessions. Find a Sensei to get started.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/bookings"
                  className="inline-flex rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm text-[var(--color-text)] transition hover:bg-zinc-50"
                >
                  My bookings
                </Link>
                <Link
                  href="/search"
                  className="inline-flex rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  Search Senseis
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {upcomingCards.map((card) => (
                  <li key={card.bookingId}>
                    <ConsumerBookingCard {...card} />
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                <Link
                  href="/bookings"
                  className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
                >
                  My bookings
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
