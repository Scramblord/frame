import { ConsumerBookingCard } from "@/components/ConsumerBookingCard";
import { PastBookingsFilteredList } from "@/components/PastBookingsFilteredList";
import {
  enrichBookingsForConsumerCards,
  type BookingListRow,
} from "@/lib/consumer-bookings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const SELECT_FIELDS =
  "id, scheduled_at, duration_minutes, status, session_type, service_id, expert_user_id, created_at, consumer_reviewed, expert_reviewed";

export default async function ConsumerBookingsPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "past" ? "past" : "upcoming";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/bookings");
  }

  const nowIso = new Date().toISOString();

  let cards: Awaited<ReturnType<typeof enrichBookingsForConsumerCards>> = [];

  if (tab === "upcoming") {
    const { data: rows } = await supabase
      .from("bookings")
      .select(SELECT_FIELDS)
      .eq("consumer_user_id", user.id)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", nowIso)
      .in("status", ["confirmed", "pending_payment", "in_progress"])
      .order("scheduled_at", { ascending: true });

    cards = await enrichBookingsForConsumerCards(
      supabase,
      (rows ?? []) as BookingListRow[],
    );
  } else {
    const { data: pastData } = await supabase
      .from("bookings")
      .select(SELECT_FIELDS)
      .eq("consumer_user_id", user.id)
      .in("status", ["completed", "cancelled", "no_show"])
      .order("scheduled_at", { ascending: false });

    cards = await enrichBookingsForConsumerCards(
      supabase,
      (pastData ?? []) as BookingListRow[],
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        My bookings
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Upcoming sessions and your history.
      </p>

      <div className="mt-8 flex gap-2 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
        <Link
          href="/bookings?tab=upcoming"
          className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
            tab === "upcoming"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/bookings?tab=past"
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
              ? "You have no upcoming sessions. Book one when you're ready."
              : "No past bookings yet — they'll appear here after your sessions."}
          </p>
          {tab === "upcoming" ? (
            <Link
              href="/search"
              className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Find an expert
            </Link>
          ) : null}
        </div>
      ) : tab === "past" ? (
        <PastBookingsFilteredList variant="consumer" cards={cards} />
      ) : (
        <ul className="mt-8 space-y-3">
          {cards.map((c) => (
            <li key={c.bookingId}>
              <ConsumerBookingCard {...c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
