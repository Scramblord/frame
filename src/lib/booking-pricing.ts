import type { ServiceRow } from "@/lib/experts-marketplace";

export type BookableSessionType =
  | "messaging"
  | "urgent_messaging"
  | "audio"
  | "video";

/** Default Sensei commission rate (5%) when no tier-specific rate is passed. */
export const PLATFORM_FEE_RATE = 0.05;

/** Sensei platform fee from gross total in GBP; `rate` is set at booking creation (e.g. 0.05 or 0.10). */
export function platformFeeFromTotal(
  totalGbp: number,
  rate = 0.05,
): number {
  return Math.round(totalGbp * rate * 100) / 100;
}

/**
 * Computes consumer total in GBP for a session. Returns null if configuration is invalid.
 */
export function totalForBooking(
  service: ServiceRow & {
    urgent_messaging_enabled?: boolean;
    urgent_messaging_rate?: number | string | null;
  },
  sessionType: BookableSessionType,
  durationMinutes: number | null,
): number | null {
  switch (sessionType) {
    case "messaging": {
      if (!service.offers_messaging || service.messaging_flat_rate == null) {
        return null;
      }
      return Number(service.messaging_flat_rate);
    }
    case "urgent_messaging": {
      if (
        !service.urgent_messaging_enabled ||
        service.urgent_messaging_rate == null
      ) {
        return null;
      }
      return Number(service.urgent_messaging_rate);
    }
    case "audio": {
      if (
        !service.offers_audio ||
        service.audio_hourly_rate == null ||
        durationMinutes == null ||
        durationMinutes <= 0
      ) {
        return null;
      }
      return (durationMinutes / 60) * Number(service.audio_hourly_rate);
    }
    case "video": {
      if (
        !service.offers_video ||
        service.video_hourly_rate == null ||
        durationMinutes == null ||
        durationMinutes <= 0
      ) {
        return null;
      }
      return (durationMinutes / 60) * Number(service.video_hourly_rate);
    }
    default:
      return null;
  }
}

export function gbpToPence(amount: number): number {
  return Math.round(amount * 100);
}
