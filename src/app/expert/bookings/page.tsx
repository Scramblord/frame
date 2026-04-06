import { ExpertBookingCard } from "@/components/ExpertBookingCard";
import { PastBookingsFilteredList } from "@/components/PastBookingsFilteredList";
import type { BookingListRow } from "@/lib/consumer-bookings";
import { enrichBookingsForExpertCards } from "@/lib/expert-bookings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const SELECT_FIELDS =
  "id, scheduled_at, duration_minutes, status, session_type, service_id, expert_user_id, consumer_user_id, created_at";

export default async function ExpertBookingsPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "past" ? "past" : "upcoming";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/expert/bookings");
  }

  const { data: expertRow } = await supabase
    .from("expert_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!expertRow) {
    redirect("/expert/setup");
  }

  const nowIso = new Date().toISOString();

  let cards: Awaited<ReturnType<typeof enrichBookingsForExpertCards>> = [];

  if (tab === "upcoming") {
    const { data: rows } = await supabase
      .from("bookings")
      .select(SELECT_FIELDS)
      .eq("expert_user_id", user.id)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", nowIso)
      .in("status", ["confirmed", "pending_payment", "in_progress"])
      .order("scheduled_at", { ascending: true });

    cards = await enrichBookingsForExpertCards(
      supabase,
      (rows ?? []) as BookingListRow[],
    );
  } else {
    const { data: pastData } = await supabase
      .from("bookings")
      .select(SELECT_FIELDS)
      .eq("expert_user_id", user.id)
      .in("status", ["completed", "cancelled", "no_show"])
      .order("scheduled_at", { ascending: false });

    cards = await enrichBookingsForExpertCards(
      supabase,
      (pastData ?? []) as BookingListRow[],
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/expert/dashboard"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Bookings
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Sessions with your clients.
      </p>

      <div className="mt-8 flex gap-2 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
        <Link
          href="/expert/bookings?tab=upcoming"
          className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
            tab === "upcoming"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/expert/bookings?tab=past"
          className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
            tab === "past"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Past
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/60">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tab === "upcoming"
              ? "No upcoming sessions yet — they will show here when clients book you."
              : "No past sessions in this list yet."}
          </p>
        </div>
      ) : tab === "past" ? (
        <PastBookingsFilteredList variant="expert" cards={cards} />
      ) : (
        <ul className="mt-8 space-y-3">
          {cards.map((c) => (
            <li key={c.bookingId}>
              <ExpertBookingCard {...c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
