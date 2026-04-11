import {
  formatBookingDateTime,
  formatDurationMinutes,
  formatStatusLabel,
  sessionTypeIcon,
  sessionTypeLabel,
  statusBadgeStyles,
} from "@/lib/booking-display";
import Image from "next/image";
import Link from "next/link";

export type ConsumerBookingCardProps = {
  bookingId: string;
  expertName: string;
  expertAvatarUrl: string | null;
  expertInitials: string;
  serviceName: string;
  sessionType: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  status: string;
  showLeaveReviewLink?: boolean;
};

export function ConsumerBookingCard({
  bookingId,
  expertName,
  expertAvatarUrl,
  expertInitials,
  serviceName,
  sessionType,
  scheduledAt,
  durationMinutes,
  status,
  showLeaveReviewLink = false,
}: ConsumerBookingCardProps) {
  return (
    <Link
      href={`/bookings/${bookingId}`}
      className="block rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
          {expertAvatarUrl ? (
            <Image
              src={expertAvatarUrl}
              alt=""
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {expertInitials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">
              {expertName}
            </p>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyles(status)}`}
            >
              {formatStatusLabel(status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {serviceName}
          </p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="mr-1.5" aria-hidden>
              {sessionTypeIcon(sessionType)}
            </span>
            {sessionTypeLabel(sessionType)}
          </p>
          {scheduledAt ? (
            <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {formatBookingDateTime(scheduledAt)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Time to be arranged
            </p>
          )}
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {formatDurationMinutes(durationMinutes)}
          </p>
          {showLeaveReviewLink ? (
            <p className="mt-2 text-xs text-zinc-500 underline decoration-zinc-400/50 underline-offset-2 dark:text-zinc-400 dark:decoration-zinc-500/50">
              Leave a review
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
