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
import Script from "next/script";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { success: successParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/bookings/${id}`)}`);
  }

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, stripe_payment_intent_id, created_at, consumer_reviewed, expert_reviewed",
    )
    .eq("id", id)
    .maybeSingle();

  if (bErr || !booking) {
    notFound();
  }

  if (
    booking.consumer_user_id !== user.id &&
    booking.expert_user_id !== user.id
  ) {
    notFound();
  }

  const isConsumer = booking.consumer_user_id === user.id;

  const { data: expertProfile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("user_id", booking.expert_user_id)
    .maybeSingle();

  const { data: serviceRow } = await supabase
    .from("services")
    .select("name")
    .eq("id", booking.service_id)
    .maybeSingle();

  const { data: consumerReviewRow } =
    isConsumer && booking.consumer_reviewed
      ? await supabase
          .from("reviews")
          .select("rating, comment")
          .eq("booking_id", id)
          .eq("reviewer_id", user.id)
          .maybeSingle()
      : { data: null };

  const expertName = expertProfile?.full_name?.trim() || "Expert";
  const expertInitials = expertName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const expertProfileId = expertProfile?.id;
  const serviceName = serviceRow?.name ?? "Service";
  const total = Number(booking.total_amount);
  const showSuccessBanner = successParam === "true";
  const pendingPayment = booking.status === "pending_payment";
  const showConfirmingPaymentMessage = showSuccessBanner && !pendingPayment;
  const canCancel =
    isConsumer &&
    (booking.status === "pending_payment" ||
      booking.status === "confirmed");
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
  const showJoinSessionActions = booking.status === "confirmed";

  const showMessagingConversation =
    isMessagingSession &&
    (booking.status === "confirmed" ||
      booking.status === "in_progress" ||
      booking.status === "completed");
  const statusLabel =
    isMessagingSession && booking.status === "confirmed"
      ? "Awaiting reply"
      : formatStatusLabel(booking.status);

  const backHref = isConsumer ? "/bookings" : "/expert/bookings";

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)]">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href={backHref}
        className="mb-6 block text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        ← Back to bookings
      </Link>

      {expertProfileId ? (
        <Link
          href={`/experts/${expertProfileId}`}
          className="mt-8 flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-zinc-300"
        >
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
            {expertProfile?.avatar_url ? (
              <Image
                src={expertProfile.avatar_url}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-500 dark:text-zinc-400">
                {expertInitials}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Expert
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {expertName}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              View profile →
            </p>
          </div>
        </Link>
      ) : (
        <div className="mt-8 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-zinc-500">
              {expertInitials}
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {expertName}
            </p>
          </div>
        </div>
      )}

      <h1 className="mb-6 mt-8 text-3xl font-bold tracking-tight text-[var(--color-text)]">
        Booking details
      </h1>

      {showSuccessBanner ? (
        <div className="mt-6 rounded-[var(--radius-md)] border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">You&apos;re booked in!</p>
          <p className="mt-1 text-sm text-green-700">
            {isMessagingSession
              ? "Your payment is confirmed. Your Sensei will respond within their stated response window."
              : "We&apos;ll email you with next steps. You can revisit this page any time."}
          </p>
        </div>
      ) : null}

      {showConfirmingPaymentMessage ? (
        <p className="mt-6 rounded-xl border border-zinc-200 bg-zinc-100/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
          Confirming payment… This usually takes a few seconds. Refresh if the
          status doesn&apos;t update.
        </p>
      ) : null}

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

      {isConsumer ? (
        !isMessagingSession && (!hideJoinSession || canCancel) ? (
          <div className="mt-8 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            {!hideJoinSession && showJoinSessionActions ? (
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
              variant="consumer"
              scheduledAt={booking.scheduled_at}
              totalAmountGbp={total}
              platformFeeGbp={
                booking.platform_fee != null
                  ? Number(booking.platform_fee)
                  : null
              }
              pendingPayment={pendingPayment}
              canCancel={canCancel}
            />
          </div>
        ) : null
      ) : showAvSession && !hideJoinSession && showJoinSessionActions ? (
        <div className="mt-8 space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <>
              {joinActive ? (
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
                {!booking.scheduled_at
                  ? "Time to be arranged for this session."
                  : joinActive || booking.status === "in_progress"
                    ? "Session starting soon or in progress."
                    : startingSoon
                      ? "Session starting soon"
                      : formatBookingDateTime(booking.scheduled_at)}
              </p>
            </>
          </div>
        </div>
      ) : null}

      <section className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
        {pendingPayment ? (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p>
              Payment incomplete — this slot will be released in 15 minutes if
              payment is not completed.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="resume-payment-btn inline-flex w-fit items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-amber-500 dark:hover:bg-amber-400"
                data-booking-id={booking.id}
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
        ) : null}
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

      {isConsumer ? (
        <BookingReviewSection
          bookingId={booking.id}
          reviewerRole="consumer"
          bookingStatus={booking.status}
          reviewed={booking.consumer_reviewed === true}
          revieweeName={expertName}
          existingReview={
            consumerReviewRow
              ? {
                  rating: consumerReviewRow.rating,
                  comment: consumerReviewRow.comment,
                }
              : null
          }
        />
      ) : null}
      <Script
        id="resume-payment-handler-detail"
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
