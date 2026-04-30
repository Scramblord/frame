import BookingsView from "@/app/expert/bookings/BookingsView";
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
  "id, scheduled_at, duration_minutes, status, session_type, service_id, expert_user_id, consumer_user_id, created_at, consumer_reviewed, expert_reviewed";

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
    const [{ data: scheduledRows }, { data: messagingRows }] = await Promise.all([
      supabase
        .from("bookings")
        .select(SELECT_FIELDS)
        .eq("expert_user_id", user.id)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", nowIso)
        .in("status", ["confirmed", "pending_payment", "in_progress"])
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("bookings")
        .select(SELECT_FIELDS)
        .eq("expert_user_id", user.id)
        .in("session_type", ["messaging", "urgent_messaging"])
        .in("status", ["confirmed", "pending_payment", "in_progress"])
        .order("created_at", { ascending: false }),
    ]);

    const scheduled = (scheduledRows ?? []) as BookingListRow[];
    const scheduledIds = new Set(scheduled.map((r) => r.id));
    const messagingExtra = (messagingRows ?? []).filter(
      (r) => !scheduledIds.has(r.id),
    ) as BookingListRow[];
    const rows = [...scheduled, ...messagingExtra];

    cards = await enrichBookingsForExpertCards(supabase, rows);
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
    <main className="mx-auto min-h-screen w-full max-w-4xl flex-1 bg-[var(--color-bg)] px-4 pb-16 pt-10 sm:px-6">
      <Link
        href="/expert/dashboard"
        className="mb-6 block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
        Bookings
      </h1>
      <p className="mb-8 text-sm text-[var(--color-text-muted)]">
        Sessions with your clients.
      </p>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-[var(--color-border)]">
        <Link
          href="/expert/bookings?tab=upcoming"
          className={`text-sm ${
            tab === "upcoming"
              ? "border-b-2 border-[var(--color-accent)] pb-3 px-4 text-[var(--color-text)]"
              : "px-4 pb-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/expert/bookings?tab=past"
          className={`text-sm ${
            tab === "past"
              ? "border-b-2 border-[var(--color-accent)] pb-3 px-4 text-[var(--color-text)]"
              : "px-4 pb-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Past
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {tab === "upcoming"
              ? "No upcoming sessions yet — they will show here when clients book you."
              : "No past sessions in this list yet."}
          </p>
          <Link
            href="/expert/dashboard"
            className="mt-4 inline-flex rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            View dashboard
          </Link>
        </div>
      ) : (
        <BookingsView allBookings={cards} isPast={tab === "past"} />
      )}
    </main>
  );
}
