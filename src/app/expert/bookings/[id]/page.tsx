import { BookingCancelDialog } from "@/components/BookingCancelDialog";
import { BookingReviewSection } from "@/components/BookingReviewSection";
import {
  formatBookingDateTime,
  formatDurationMinutes,
  formatStatusLabel,
  sessionTypeIcon,
  sessionTypeLabel,
} from "@/lib/booking-display";
import { formatGbp } from "@/lib/experts-marketplace";
import { canShowJoinSession } from "@/lib/session-access";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function within15MinutesBeforeStart(scheduledAt: string | null): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  const now = Date.now();
  return now >= start - 15 * 60 * 1000 && now < start;
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-green-100 text-green-700";
  if (status === "confirmed") return "bg-blue-100 text-blue-700";
  if (status === "in_progress") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-zinc-100 text-zinc-600";
  return "bg-zinc-100 text-zinc-600";
}

export default async function ExpertBookingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/expert/bookings/${id}`)}`);
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, created_at, consumer_reviewed, expert_reviewed",
    )
    .eq("id", id)
    .maybeSingle();

  if (bErr || !booking) {
    notFound();
  }

  if (booking.expert_user_id !== user.id) {
    redirect("/expert/dashboard");
  }

  const { data: consumerProfile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", booking.consumer_user_id)
    .maybeSingle();

  const { data: consumerBookingStatusRows } = await supabase
    .from("bookings")
    .select("status")
    .eq("consumer_user_id", booking.consumer_user_id);

  const { data: serviceRow } = await supabase
    .from("services")
    .select("name")
    .eq("id", booking.service_id)
    .maybeSingle();

  const { data: expertReviewRow } = booking.expert_reviewed
    ? await supabase
        .from("reviews")
        .select("rating, comment")
        .eq("booking_id", id)
        .eq("reviewer_id", user.id)
        .maybeSingle()
    : { data: null };

  const consumerName = consumerProfile?.full_name?.trim() || "Client";
  const consumerInitials = consumerName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const serviceName = serviceRow?.name ?? "Service";
  const total = Number(booking.total_amount);
  const pendingPayment = booking.status === "pending_payment";
  const canCancel =
    booking.status === "pending_payment" ||
    booking.status === "confirmed";
  const statusRows = consumerBookingStatusRows ?? [];
  const totalConsumerBookings = statusRows.length;
  let completedForReliability = 0;
  let cancelledForReliability = 0;
  let noShowForReliability = 0;
  for (const row of statusRows) {
    const s = row.status;
    if (s === "completed") completedForReliability += 1;
    else if (s === "cancelled") cancelledForReliability += 1;
    else if (s === "no_show") noShowForReliability += 1;
  }
  const reliabilityDenominator =
    completedForReliability + cancelledForReliability + noShowForReliability;
  const consumerReliabilityPct =
    totalConsumerBookings >= 3 && reliabilityDenominator > 0
      ? Math.round(
          (completedForReliability / reliabilityDenominator) * 100,
        )
      : null;
  const startingSoon =
    booking.scheduled_at != null &&
    within15MinutesBeforeStart(booking.scheduled_at);

  const showAvSession =
    booking.session_type === "audio" || booking.session_type === "video";
  const isMessagingSession =
    booking.session_type === "messaging" ||
    booking.session_type === "urgent_messaging";
  const joinActive = canShowJoinSession({
    sessionType: booking.session_type,
    status: booking.status,
    scheduledAt: booking.scheduled_at,
    durationMinutes: booking.duration_minutes,
  });

  const hideJoinSession =
    booking.status === "completed" ||
    booking.status === "cancelled" ||
    booking.status === "no_show";

  const showMessagingConversation =
    isMessagingSession &&
    (booking.status === "confirmed" ||
      booking.status === "in_progress" ||
      booking.status === "completed");
  const statusLabel =
    isMessagingSession && booking.status === "confirmed"
      ? "Awaiting reply"
      : formatStatusLabel(booking.status);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/expert/bookings"
        className="mb-6 block text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        ← Back to bookings
      </Link>

      <div className="mt-8 flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
          {consumerProfile?.avatar_url ? (
            <Image
              src={consumerProfile.avatar_url}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-500 dark:text-zinc-400">
              {consumerInitials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Client
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {consumerName}
          </p>
          {totalConsumerBookings < 3 ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              New client
            </p>
          ) : consumerReliabilityPct != null ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Reliability: {consumerReliabilityPct}%
            </p>
          ) : null}
          {consumerReliabilityPct != null && noShowForReliability > 0 ? (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ {noShowForReliability} no-show
              {noShowForReliability === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>

      <h1 className="mb-6 mt-8 text-3xl font-bold tracking-tight text-[var(--color-text)]">
        Booking details
      </h1>

      {showMessagingConversation ? (
        <div className="mt-8">
          <Link
            href={`/messages/${booking.id}`}
            className="flex w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            {booking.status === "completed"
              ? "View conversation"
              : "Open conversation"}
          </Link>
        </div>
      ) : null}

      {!hideJoinSession || canCancel ? (
        <div className="mt-8 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {!hideJoinSession ? (
            <div>
              {isMessagingSession ? (
                showMessagingConversation ? (
                  <Link
                    href={`/messages/${booking.id}`}
                    className="flex w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                  >
                    Go to conversation
                  </Link>
                ) : null
              ) : showAvSession && joinActive ? (
                <Link
                  href={`/session/${booking.id}`}
                  className="flex w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  Join session
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white opacity-60"
                >
                  Join session
                </button>
              )}
              <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {isMessagingSession
                  ? "Messaging session is active in your conversation thread."
                  : !showAvSession
                  ? "Join is available for audio and video sessions."
                  : !booking.scheduled_at
                    ? "Time to be arranged for this session."
                    : joinActive || booking.status === "in_progress"
                      ? "Session starting soon or in progress — tap Join when you are ready."
                      : startingSoon
                        ? "Session starting soon"
                        : formatBookingDateTime(booking.scheduled_at)}
              </p>
            </div>
          ) : null}
          <BookingCancelDialog
            bookingId={booking.id}
            variant="expert"
            scheduledAt={booking.scheduled_at}
            totalAmountGbp={total}
            platformFeeGbp={
              booking.platform_fee != null ? Number(booking.platform_fee) : null
            }
            pendingPayment={pendingPayment}
            canCancel={canCancel}
          />
        </div>
      ) : null}

      <section className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Summary
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(booking.status)}`}
          >
            {statusLabel}
          </span>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--color-text-muted)]">Service</dt>
            <dd className="text-right text-sm font-medium text-[var(--color-text)]">
              {serviceName}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--color-text-muted)]">Session</dt>
            <dd className="text-sm font-medium text-[var(--color-text)]">
              <span className="mr-1" aria-hidden>
                {sessionTypeIcon(booking.session_type)}
              </span>
              {sessionTypeLabel(booking.session_type)}
            </dd>
          </div>
          {booking.scheduled_at ? (
            <div className="flex justify-between gap-4">
              <dt className="text-sm text-[var(--color-text-muted)]">When</dt>
              <dd className="text-right text-sm font-medium text-[var(--color-text)]">
                {formatBookingDateTime(booking.scheduled_at)}
              </dd>
            </div>
          ) : null}
          {booking.duration_minutes != null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-sm text-[var(--color-text-muted)]">Duration</dt>
              <dd className="text-sm font-medium text-[var(--color-text)]">
                {formatDurationMinutes(booking.duration_minutes)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <dt className="text-sm text-[var(--color-text-muted)]">Amount</dt>
            <dd className="text-sm font-semibold text-[var(--color-text)]">
              {Number.isFinite(total) ? formatGbp(total) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <BookingReviewSection
        bookingId={booking.id}
        reviewerRole="expert"
        bookingStatus={booking.status}
        reviewed={booking.expert_reviewed === true}
        revieweeName={consumerName}
        existingReview={
          expertReviewRow
            ? {
                rating: expertReviewRow.rating,
                comment: expertReviewRow.comment,
              }
            : null
        }
      />
      </main>
    </div>
  );
}
