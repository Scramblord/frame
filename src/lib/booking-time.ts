import { fromZonedTime } from "date-fns-tz";

/** Default IANA zone when expert_profiles.timezone is missing (UK marketplace). */
export const DEFAULT_EXPERT_TIMEZONE = "Europe/London";

/**
 * Interprets a calendar date + wall time as being in the expert's timezone and returns UTC.
 */
export function expertWallDateTimeToUtc(
  dateStr: string,
  timeHHmm: string,
  timeZone: string,
): Date {
  const normalized = timeHHmm.length === 5 ? `${timeHHmm}:00` : timeHHmm;
  const isoLocal = `${dateStr}T${normalized}`;
  return fromZonedTime(isoLocal, timeZone);
}

/** 15-minute slot start times (HH:mm) that fit [start, end) with at least minDuration minutes remaining. */
export function slotStartsInWindow(
  startTime: string,
  endTime: string,
  minDurationMinutes: number,
): string[] {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start || minDurationMinutes <= 0) return [];

  const lastStart = end - minDurationMinutes;
  const out: string[] = [];
  for (let m = start; m <= lastStart; m += 15) {
    out.push(minutesToHHmm(m));
  }
  return out;
}

function parseTimeToMinutes(t: string): number {
  const part = t.length >= 5 ? t.slice(0, 5) : t;
  const [h, min] = part.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0;
  return h * 60 + min;
}

function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duration options: 15-minute steps from min to max (inclusive). */
export function durationOptions(minM: number, maxM: number): number[] {
  const out: number[] = [];
  for (let d = minM; d <= maxM; d += 15) {
    out.push(d);
  }
  return out;
}
