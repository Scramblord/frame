import BookingsView from "@/app/bookings/BookingsView";
import {
  enrichBookingsForConsumerCards,
  type BookingListRow,
} from "@/lib/consumer-bookings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import Script from "next/script";

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
    const [{ data: scheduledRows }, { data: messagingRows }] = await Promise.all([
      supabase
        .from("bookings")
        .select(SELECT_FIELDS)
        .eq("consumer_user_id", user.id)
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", nowIso)
        .in("status", ["confirmed", "pending_payment", "in_progress"])
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("bookings")
        .select(SELECT_FIELDS)
        .eq("consumer_user_id", user.id)
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

    cards = await enrichBookingsForConsumerCards(supabase, rows);
  } else {
    const terminalStatuses = ["completed", "cancelled", "no_show"];
    const [{ data: scheduledPastRows }, { data: messagingPastRows }] =
      await Promise.all([
        supabase
          .from("bookings")
          .select(SELECT_FIELDS)
          .eq("consumer_user_id", user.id)
          .not("scheduled_at", "is", null)
          .lt("scheduled_at", nowIso)
          .in("status", terminalStatuses)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("bookings")
          .select(SELECT_FIELDS)
          .eq("consumer_user_id", user.id)
          .in("session_type", ["messaging", "urgent_messaging"])
          .in("status", terminalStatuses)
          .order("created_at", { ascending: false }),
      ]);

    const scheduledPast = (scheduledPastRows ?? []) as BookingListRow[];
    const scheduledPastIds = new Set(scheduledPast.map((r) => r.id));
    const messagingPastExtra = (messagingPastRows ?? []).filter(
      (r) => !scheduledPastIds.has(r.id),
    ) as BookingListRow[];
    const pastData = [...scheduledPast, ...messagingPastExtra];

    cards = await enrichBookingsForConsumerCards(
      supabase,
      (pastData ?? []) as BookingListRow[],
    );
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)]">
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-6 block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
        My bookings
      </h1>
      <p className="mb-8 text-sm text-[var(--color-text-muted)]">
        Upcoming sessions and your history.
      </p>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-[var(--color-border)]">
        <Link
          href="/bookings?tab=upcoming"
          className={`text-sm ${
            tab === "upcoming"
              ? "border-b-2 border-[var(--color-accent)] pb-3 px-4 text-[var(--color-text)]"
              : "px-4 pb-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Upcoming
        </Link>
        <Link
          href="/bookings?tab=past"
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
              ? "You have no upcoming sessions. Book one when you're ready."
              : "No past bookings yet — they'll appear here after your sessions."}
          </p>
          {tab === "upcoming" ? (
            <Link
              href="/search"
              className="mt-4 inline-flex rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Find a Sensei
            </Link>
          ) : null}
        </div>
      ) : (
        <BookingsView allBookings={cards} isPast={tab === "past"} />
      )}
      <Script
        id="resume-payment-handler"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const buttons = document.querySelectorAll('.resume-payment-btn');
              for (const button of buttons) {
                if (!(button instanceof HTMLButtonElement)) continue;
                button.addEventListener('click', async () => {
                  const bookingId = button.dataset.bookingId || '';
                  if (!bookingId) return;
                  const errorNode = button.parentElement?.querySelector('.resume-payment-error');
                  if (errorNode instanceof HTMLElement) {
                    errorNode.textContent = '';
                    errorNode.classList.add('hidden');
                  }
                  const defaultLabel = button.dataset.defaultLabel || 'Complete payment';
                  button.disabled = true;
                  button.textContent = 'Loading...';
                  try {
                    const res = await fetch('/api/bookings/resume-payment', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bookingId }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || typeof json?.url !== 'string' || !json.url) {
                      throw new Error(json?.error || 'Could not start payment');
                    }
                    window.location.href = json.url;
                  } catch (error) {
                    if (errorNode instanceof HTMLElement) {
                      errorNode.textContent = error instanceof Error ? error.message : 'Could not start payment';
                      errorNode.classList.remove('hidden');
                    }
                  } finally {
                    button.disabled = false;
                    button.textContent = defaultLabel;
                  }
                });
              }
            })();
          `,
        }}
      />
      </main>
    </div>
  );
}
