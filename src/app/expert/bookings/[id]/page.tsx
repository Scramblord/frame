import { BookingCancelDialog } from "@/components/BookingCancelDialog";
import {
  formatBookingDateTime,
  formatDurationMinutes,
  formatStatusLabel,
  sessionTypeIcon,
  sessionTypeLabel,
  statusBadgeStyles,
} from "@/lib/booking-display";
import { reliabilityPercent } from "@/lib/cancellation";
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
      "id, consumer_user_id, expert_user_id, service_id, session_type, scheduled_at, duration_minutes, status, total_amount, platform_fee, created_at",
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
    .select(
      "full_name, avatar_url, consumer_sessions_kept, consumer_sessions_total",
    )
    .eq("user_id", booking.consumer_user_id)
    .maybeSingle();

  const { data: serviceRow } = await supabase
    .from("services")
    .select("name")
    .eq("id", booking.service_id)
    .maybeSingle();

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
  const consumerSessionsTotalRaw = Number(
    consumerProfile?.consumer_sessions_total ?? 0,
  );
  const consumerSessionsTotal = Number.isFinite(consumerSessionsTotalRaw)
    ? consumerSessionsTotalRaw
    : 0;
  const consumerReliability = reliabilityPercent(
    consumerProfile?.consumer_sessions_kept ?? 0,
    consumerSessionsTotal,
  );
  const startingSoon =
    booking.scheduled_at != null &&
    within15MinutesBeforeStart(booking.scheduled_at);

  const showAvSession =
    booking.session_type === "audio" || booking.session_type === "video";
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

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/expert/bookings"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to bookings
      </Link>

      <div className="mt-8 flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900">
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
          {consumerSessionsTotal < 3 ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              New client
            </p>
          ) : consumerReliability != null ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Client reliability: {consumerReliability}%
            </p>
          ) : null}
        </div>
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Booking details
      </h1>

      {!hideJoinSession || canCancel ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-700/80 dark:bg-zinc-900">
          {!hideJoinSession ? (
            <div>
              {showAvSession && joinActive ? (
                <Link
                  href={`/session/${booking.id}`}
                  className="flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Join session
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Join session
                </button>
              )}
              <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {!showAvSession
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

      <section className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Summary
          </h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles(booking.status)}`}
          >
            {formatStatusLabel(booking.status)}
          </span>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Service</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-50">
              {serviceName}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Session</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">
              <span className="mr-1" aria-hidden>
                {sessionTypeIcon(booking.session_type)}
              </span>
              {sessionTypeLabel(booking.session_type)}
            </dd>
          </div>
          {booking.scheduled_at ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">When</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-50">
                {formatBookingDateTime(booking.scheduled_at)}
              </dd>
            </div>
          ) : null}
          {booking.duration_minutes != null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Duration</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {formatDurationMinutes(booking.duration_minutes)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <dt className="text-zinc-500">Amount</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
              {Number.isFinite(total) ? formatGbp(total) : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
