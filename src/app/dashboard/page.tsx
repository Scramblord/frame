import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import { ConsumerBookingCard } from "@/components/ConsumerBookingCard";
import { enrichBookingsForConsumerCards } from "@/lib/consumer-bookings";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
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
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <Navbar />
      <ActiveSessionBanner />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Hey {displayName} — discover Senseis and manage your bookings.
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Find your next session
            </h1>
          </div>
          <Link
            href="/bookings"
            className="shrink-0 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
          >
            My bookings
          </Link>
        </div>

        <form
          action="/search"
          method="get"
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            id="dashboard-q"
            name="q"
            type="search"
            placeholder="Search by topic — BJJ, physio, mobility…"
            className="w-full flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
            autoComplete="off"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Search
          </button>
        </form>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Featured Senseis
            </h2>
            <Link
              href="/search"
              className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Browse all
            </Link>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Coaches and clinicians on Sensei right now.
          </p>

          {featuredExperts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/60">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No Senseis listed yet. Check back soon.
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

                return (
                  <li key={ep.user_id as string}>
                    <Link
                      href={`/experts/${p.id}`}
                      className="flex gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900 dark:hover:border-zinc-600"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                        {p.avatar_url ? (
                          <Image
                            src={p.avatar_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-500">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {name}
                          </span>
                          {fromPrice != null ? (
                            <span className="shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                              From {formatGbp(fromPrice)}
                            </span>
                          ) : null}
                        </div>
                        {tags.length > 0 ? (
                          <ul className="mt-2 flex flex-wrap gap-1">
                            {tags.map((tag: string) => (
                              <li
                                key={tag}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              >
                                {tag}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Upcoming bookings
          </h2>
          {upcomingCards.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No upcoming sessions. Find a Sensei to get started.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/bookings"
                  className="inline-flex rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  My bookings
                </Link>
                <Link
                  href="/search"
                  className="inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
              <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Link
                  href="/bookings"
                  className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
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
