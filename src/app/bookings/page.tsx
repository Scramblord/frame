import { ConsumerBookingCard } from "@/components/ConsumerBookingCard";
import { PastBookingsFilteredList } from "@/components/PastBookingsFilteredList";
import {
  formatBookingDateTime,
  formatDurationMinutes,
  formatStatusLabel,
  sessionTypeIcon,
  sessionTypeLabel,
  statusBadgeStyles,
} from "@/lib/booking-display";
import {
  enrichBookingsForConsumerCards,
  type BookingListRow,
} from "@/lib/consumer-bookings";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
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
              Find a Sensei
            </Link>
          ) : null}
        </div>
      ) : tab === "past" ? (
        <PastBookingsFilteredList variant="consumer" cards={cards} />
      ) : (
        <ul className="mt-8 space-y-3">
          {cards.map((c) =>
            c.status === "pending_payment" ? (
              <li key={c.bookingId}>
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
                  <Link href={`/bookings/${c.bookingId}`} className="block">
                    <div className="flex gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                        {c.expertAvatarUrl ? (
                          <Image
                            src={c.expertAvatarUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                            {c.expertInitials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {c.expertName}
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles(c.status)}`}
                          >
                            {(
                              (c.sessionType === "messaging" ||
                                c.sessionType === "urgent_messaging") &&
                              c.status === "confirmed"
                                ? "Awaiting reply"
                                : formatStatusLabel(c.status)
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {c.serviceName}
                        </p>
                        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="mr-1.5" aria-hidden>
                            {sessionTypeIcon(c.sessionType)}
                          </span>
                          {sessionTypeLabel(c.sessionType)}
                        </p>
                        {c.scheduledAt ? (
                          <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {formatBookingDateTime(c.scheduledAt)}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {c.sessionType === "messaging" ||
                            c.sessionType === "urgent_messaging"
                              ? "Messaging session"
                              : "Time to be arranged"}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDurationMinutes(c.durationMinutes)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                    <p>
                      Payment incomplete — this slot will be released in 15
                      minutes if payment is not completed.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        className="resume-payment-btn rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-amber-500 dark:hover:bg-amber-400"
                        data-booking-id={c.bookingId}
                        data-default-label="Complete payment"
                      >
                        Complete payment
                      </button>
                      <p
                        className="resume-payment-error hidden text-sm text-rose-700 dark:text-rose-300"
                        aria-live="polite"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ) : (
              <li key={c.bookingId}>
                <ConsumerBookingCard {...c} />
              </li>
            ),
          )}
        </ul>
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
  );
}
