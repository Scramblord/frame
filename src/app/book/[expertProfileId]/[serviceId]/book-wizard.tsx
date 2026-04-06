"use client";

import {
  DEFAULT_EXPERT_TIMEZONE,
  durationOptions,
  expertWallDateTimeToUtc,
  slotStartsInWindow,
} from "@/lib/booking-time";
import { formatInTimeZone } from "date-fns-tz";
import {
  PLATFORM_FEE_RATE,
  platformFeeFromTotal,
  totalForBooking,
  type BookableSessionType,
} from "@/lib/booking-pricing";
import { formatGbp, type ServiceRow } from "@/lib/experts-marketplace";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AvailRpcRow = {
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  resolution: string | null;
};

export type BookWizardProps = {
  expertProfileId: string;
  expertName: string;
  expertUserId: string;
  expertTimezone: string;
  service: ServiceRow & {
    urgent_messaging_enabled?: boolean;
    urgent_messaging_rate?: number | string | null;
  };
  initialSessionType: BookableSessionType | null;
};

const STEPS = [1, 2, 3] as const;

/** Earliest bookable slot start on the expert's calendar "today" (wall clock in expert TZ). */
const BOOKING_LEAD_MS = 15 * 60 * 1000;

function mergeSlotStartsFromAvailRows(
  availRows: AvailRpcRow[],
  minDur: number,
): string[] {
  const set = new Set<string>();
  for (const r of availRows) {
    if (!r.is_available || !r.start_time || !r.end_time) continue;
    const st = String(r.start_time).trim();
    const et = String(r.end_time).trim();
    const startNorm = st.length >= 5 ? st.slice(0, 5) : st;
    const endNorm = et.length >= 5 ? et.slice(0, 5) : et;
    const starts = slotStartsInWindow(startNorm, endNorm, minDur);
    starts.forEach((s) => set.add(s));
  }
  return [...set].sort();
}

function filterSlotsAtLeastMinutesAhead(
  slots: string[],
  dateStr: string,
  expertTz: string,
  leadMs: number,
): string[] {
  const cutoff = Date.now() + leadMs;
  return slots.filter((hhmm) => {
    const utc = expertWallDateTimeToUtc(dateStr, hhmm, expertTz);
    return utc.getTime() >= cutoff;
  });
}

export function BookWizard({
  expertProfileId,
  expertName,
  expertUserId,
  expertTimezone,
  service,
  initialSessionType,
}: BookWizardProps) {
  const tz = expertTimezone?.trim() || DEFAULT_EXPERT_TIMEZONE;

  const [step, setStep] = useState<1 | 2 | 3>(() => {
    const audioVideo =
      initialSessionType === "audio" || initialSessionType === "video";
    if (initialSessionType && !audioVideo) {
      return 3;
    }
    if (initialSessionType && audioVideo) {
      return 2;
    }
    return 1;
  });

  const [sessionType, setSessionType] = useState<BookableSessionType | null>(
    initialSessionType &&
      isOffered(service, initialSessionType)
      ? initialSessionType
      : null,
  );

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [availRows, setAvailRows] = useState<AvailRpcRow[] | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [availableDateSet, setAvailableDateSet] = useState<Set<string>>(
    () => new Set(),
  );
  const [monthDatesLoading, setMonthDatesLoading] = useState(false);
  /** null = pending check; only used when calendar date === expert's today. */
  const [expertTodayHasBookableSlots, setExpertTodayHasBookableSlots] =
    useState<boolean | null>(null);

  const needsSchedule =
    sessionType === "audio" || sessionType === "video";

  const totalGbp = useMemo(() => {
    if (!sessionType) return null;
    return totalForBooking(service, sessionType, durationMinutes);
  }, [service, sessionType, durationMinutes]);

  const platformFee =
    totalGbp != null ? platformFeeFromTotal(totalGbp) : null;

  const maxBookDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  }, []);

  const canGoPrevMonth = useMemo(() => {
    const t = new Date();
    return viewYear > t.getFullYear() || viewMonth > t.getMonth();
  }, [viewYear, viewMonth]);

  const canGoNextMonth = useMemo(() => {
    return (
      viewYear * 12 + viewMonth <
      maxBookDate.getFullYear() * 12 + maxBookDate.getMonth()
    );
  }, [viewYear, viewMonth, maxBookDate]);

  useEffect(() => {
    if (step !== 2 || !needsSchedule) {
      return;
    }
    let cancelled = false;
    async function loadMonthDates() {
      setMonthDatesLoading(true);
      setError(null);
      const start = new Date(viewYear, viewMonth, 1);
      const end = new Date(viewYear, viewMonth + 1, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
      const { data, error: rpcErr } = await supabase.rpc(
        "get_expert_available_dates",
        {
          p_expert_user_id: expertUserId,
          p_start_date: startStr,
          p_end_date: endStr,
        },
      );
      if (cancelled) return;
      setMonthDatesLoading(false);
      if (rpcErr) {
        setError("Could not load available dates for this month.");
        setAvailableDateSet(new Set());
        return;
      }
      const next = new Set<string>();
      for (const row of data ?? []) {
        const r = row as { available_date?: string };
        if (r.available_date) {
          next.add(String(r.available_date).slice(0, 10));
        }
      }
      setAvailableDateSet(next);
    }
    loadMonthDates();
    return () => {
      cancelled = true;
    };
  }, [step, needsSchedule, viewYear, viewMonth, expertUserId]);

  useEffect(() => {
    if (!needsSchedule || step !== 2 || !service || monthDatesLoading) {
      setExpertTodayHasBookableSlots(null);
      return;
    }
    const expertToday = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStartStr = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`;
    const monthEndStr = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
    if (expertToday < monthStartStr || expertToday > monthEndStr) {
      setExpertTodayHasBookableSlots(null);
      return;
    }
    if (!availableDateSet.has(expertToday)) {
      setExpertTodayHasBookableSlots(null);
      return;
    }
    let cancelled = false;
    async function checkExpertTodaySlots() {
      setExpertTodayHasBookableSlots(null);
      const { data, error: rpcErr } = await supabase.rpc(
        "get_expert_availability_for_date",
        {
          p_expert_user_id: expertUserId,
          p_date: expertToday,
        },
      );
      if (cancelled) return;
      if (rpcErr || !data) {
        setExpertTodayHasBookableSlots(false);
        return;
      }
      const rows = (data ?? []) as AvailRpcRow[];
      const merged = mergeSlotStartsFromAvailRows(
        rows,
        service.min_session_minutes,
      );
      const filtered = filterSlotsAtLeastMinutesAhead(
        merged,
        expertToday,
        tz,
        BOOKING_LEAD_MS,
      );
      setExpertTodayHasBookableSlots(filtered.length > 0);
    }
    void checkExpertTodaySlots();
    return () => {
      cancelled = true;
    };
  }, [
    needsSchedule,
    step,
    service,
    tz,
    viewYear,
    viewMonth,
    availableDateSet,
    expertUserId,
    monthDatesLoading,
  ]);

  useEffect(() => {
    setSelectedDate("");
    setSlotTime(null);
    setDurationMinutes(null);
    setAvailRows(null);
  }, [viewYear, viewMonth]);

  const loadAvailability = useCallback(
    async (dateStr: string) => {
      if (!dateStr) {
        setAvailRows(null);
        return;
      }
      setAvailLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc(
        "get_expert_availability_for_date",
        {
          p_expert_user_id: expertUserId,
          p_date: dateStr,
        },
      );
      setAvailLoading(false);
      if (rpcErr) {
        setError("Could not load availability.");
        setAvailRows([]);
        return;
      }
      const rows = (data ?? []) as AvailRpcRow[];
      setAvailRows(rows);
      setSlotTime(null);
    },
    [expertUserId],
  );

  const slotOptionsForStep2 = useMemo(() => {
    if (!availRows?.length || !service) {
      return [] as string[];
    }
    const merged = mergeSlotStartsFromAvailRows(
      availRows,
      service.min_session_minutes,
    );
    const expertToday = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    if (selectedDate === expertToday) {
      return filterSlotsAtLeastMinutesAhead(
        merged,
        selectedDate,
        tz,
        BOOKING_LEAD_MS,
      );
    }
    return merged;
  }, [availRows, service, selectedDate, tz]);

  const durationChoices = useMemo(() => {
    if (!service || !slotTime || !availRows?.length) return [];
    const maxLen = maxDurationMinutesForSlot(availRows, slotTime);
    const maxAllowed = Math.min(service.max_session_minutes, maxLen);
    if (maxAllowed < service.min_session_minutes) return [];
    return durationOptions(service.min_session_minutes, maxAllowed);
  }, [service, slotTime, availRows]);

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!sessionType) {
        setError("Choose a session type.");
        return;
      }
      if (sessionType === "audio" || sessionType === "video") {
        setStep(2);
      } else {
        setStep(3);
      }
    } else if (step === 2) {
      if (!selectedDate || !slotTime || durationMinutes == null) {
        setError("Choose a date, time slot, and duration.");
        return;
      }
      setStep(3);
    }
  }

  function goBack() {
    setError(null);
    if (step === 3) {
      if (needsSchedule) {
        setStep(2);
      } else {
        setStep(1);
      }
    } else if (step === 2) {
      setStep(1);
    }
  }

  async function bookAndPay() {
    if (!sessionType || totalGbp == null) {
      setError("Incomplete booking details.");
      return;
    }
    setPayLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertProfileId,
          serviceId: service.id,
          sessionType,
          scheduledDate: needsSchedule ? selectedDate : null,
          slotTime: needsSchedule ? slotTime : null,
          durationMinutes: needsSchedule ? durationMinutes : null,
        }),
      });
      const data = (await res.json()) as { bookingId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create booking");
        return;
      }
      if (!data.bookingId) {
        setError("No booking ID returned");
        return;
      }
      const pay = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.bookingId }),
      });
      const payJson = (await pay.json()) as { url?: string; error?: string };
      if (!pay.ok) {
        setError(payJson.error ?? "Could not start payment");
        return;
      }
      if (payJson.url) {
        window.location.href = payJson.url;
        return;
      }
      setError("No checkout URL returned");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPayLoading(false);
    }
  }

  const sessionLabel: Record<BookableSessionType, string> = {
    messaging: "Messaging",
    urgent_messaging: "Urgent messaging",
    audio: "Audio",
    video: "Video",
  };

  const expertTodayYmd = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/experts/${expertProfileId}`}
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to {expertName}
      </Link>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Book · {service.name}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Book a session
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Step {step} of 3 · {expertName}
      </p>

      <div className="mt-6 flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              s <= step
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Choose session type
          </h2>
          <ul className="space-y-3">
            {service.offers_messaging && service.messaging_flat_rate != null ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSessionType("messaging")}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    sessionType === "messaging"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                  }`}
                >
                  <p className="font-semibold">Messaging</p>
                  <p className="mt-1 text-sm opacity-90">
                    {formatGbp(Number(service.messaging_flat_rate))} flat
                  </p>
                </button>
              </li>
            ) : null}
            {service.urgent_messaging_enabled &&
            service.urgent_messaging_rate != null ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSessionType("urgent_messaging")}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    sessionType === "urgent_messaging"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                  }`}
                >
                  <p className="font-semibold">Urgent messaging</p>
                  <p className="mt-1 text-sm opacity-90">
                    {formatGbp(Number(service.urgent_messaging_rate))} flat
                  </p>
                </button>
              </li>
            ) : null}
            {service.offers_audio && service.audio_hourly_rate != null ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSessionType("audio")}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    sessionType === "audio"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                  }`}
                >
                  <p className="font-semibold">Audio</p>
                  <p className="mt-1 text-sm opacity-90">
                    {formatGbp(Number(service.audio_hourly_rate))} / hr ·{" "}
                    {service.min_session_minutes}–{service.max_session_minutes}{" "}
                    min
                  </p>
                </button>
              </li>
            ) : null}
            {service.offers_video && service.video_hourly_rate != null ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSessionType("video")}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    sessionType === "video"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                  }`}
                >
                  <p className="font-semibold">Video</p>
                  <p className="mt-1 text-sm opacity-90">
                    {formatGbp(Number(service.video_hourly_rate))} / hr ·{" "}
                    {service.min_session_minutes}–{service.max_session_minutes}{" "}
                    min
                  </p>
                </button>
              </li>
            ) : null}
          </ul>
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && needsSchedule ? (
        <section className="mt-8 space-y-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Date &amp; time
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Times shown in ({tz}).
          </p>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Date
            </label>
            <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!canGoPrevMonth}
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewYear((y) => y - 1);
                      setViewMonth(11);
                    } else {
                      setViewMonth((m) => m - 1);
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  ←
                </button>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {new Date(viewYear, viewMonth, 1).toLocaleString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  type="button"
                  disabled={!canGoNextMonth}
                  onClick={() => {
                    if (viewMonth === 11) {
                      setViewYear((y) => y + 1);
                      setViewMonth(0);
                    } else {
                      setViewMonth((m) => m + 1);
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  →
                </button>
              </div>
              {monthDatesLoading ? (
                <p className="mt-3 text-center text-xs text-zinc-500">
                  Loading calendar…
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d) => (
                        <div key={d}>{d}</div>
                      ),
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {buildCalendarCells(viewYear, viewMonth).map(
                      ({ key, dateStr, inMonth }) => {
                        if (!inMonth) {
                          return (
                            <div
                              key={key}
                              className="aspect-square p-0.5"
                              aria-hidden
                            />
                          );
                        }
                        const t = new Date();
                        const todayStr = toYmd(
                          t.getFullYear(),
                          t.getMonth(),
                          t.getDate(),
                        );
                        const maxStr = toYmd(
                          maxBookDate.getFullYear(),
                          maxBookDate.getMonth(),
                          maxBookDate.getDate(),
                        );
                        const isPast = dateStr < todayStr;
                        const isAfterMax = dateStr > maxStr;
                        const isExpertToday = dateStr === expertTodayYmd;
                        const expertTodayPending =
                          isExpertToday &&
                          availableDateSet.has(dateStr) &&
                          expertTodayHasBookableSlots === null;
                        const expertTodayNoSlots =
                          isExpertToday &&
                          expertTodayHasBookableSlots === false;
                        const hasSlots =
                          availableDateSet.has(dateStr) &&
                          !isPast &&
                          !isAfterMax &&
                          !expertTodayPending &&
                          !expertTodayNoSlots;
                        const isSelected = selectedDate === dateStr;
                        const disabled =
                          isPast ||
                          isAfterMax ||
                          !availableDateSet.has(dateStr) ||
                          expertTodayPending ||
                          expertTodayNoSlots;
                        return (
                          <div
                            key={key}
                            className="flex aspect-square items-center justify-center p-0.5"
                          >
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (!hasSlots) return;
                                setSelectedDate(dateStr);
                                setDurationMinutes(null);
                                loadAvailability(dateStr);
                              }}
                              className={`flex h-full w-full items-center justify-center rounded-lg text-sm font-medium transition ${
                                disabled
                                  ? "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-600"
                                  : isSelected
                                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                    : "bg-zinc-50 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {Number(dateStr.slice(8, 10))}
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {availLoading ? (
            <p className="text-sm text-zinc-500">Loading slots…</p>
          ) : selectedDate && slotOptionsForStep2.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No availability on this date. Try another day.
            </p>
          ) : selectedDate ? (
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Start time
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {slotOptionsForStep2.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSlotTime(t);
                      setDurationMinutes(null);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      slotTime === t
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {slotTime ? (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Duration
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={durationMinutes ?? ""}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">Select duration</option>
                {durationChoices.map((d) => (
                  <option key={d} value={d}>
                    {d} min ·{" "}
                    {sessionType &&
                      formatGbp(
                        totalForBooking(service, sessionType, d) ?? 0,
                      )}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="mt-8 space-y-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Summary &amp; payment
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Expert</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {expertName}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Service</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {service.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Session</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {sessionType ? sessionLabel[sessionType] : "—"}
                </dd>
              </div>
              {needsSchedule && selectedDate && slotTime ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">When</dt>
                  <dd className="text-right text-zinc-900 dark:text-zinc-50">
                    {selectedDate} · {slotTime} ({tz})
                  </dd>
                </div>
              ) : null}
              {needsSchedule && durationMinutes ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Duration</dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {durationMinutes} minutes
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {totalGbp != null ? formatGbp(totalGbp) : "—"}
                </dd>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                FRAME fee ({Math.round(PLATFORM_FEE_RATE * 100)}%):{" "}
                {platformFee != null ? formatGbp(platformFee) : "—"} — included
                in total; the expert receives the remainder after card
                processing.
              </p>
              <div className="mt-3 flex justify-between gap-4 text-base font-semibold">
                <dt className="text-zinc-900 dark:text-zinc-50">Total</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {totalGbp != null ? formatGbp(totalGbp) : "—"}
                </dd>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Back
            </button>
            <button
              type="button"
              disabled={payLoading || totalGbp == null}
              onClick={bookAndPay}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {payLoading ? "Redirecting…" : "Book & Pay"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function toYmd(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Monday-first calendar cells; leading/trailing pads use `inMonth: false`. */
function buildCalendarCells(
  viewYear: number,
  viewMonth: number,
): Array<{ key: string; dateStr: string; inMonth: boolean }> {
  const first = new Date(viewYear, viewMonth, 1);
  const padCount = (first.getDay() + 6) % 7;
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
  const out: Array<{ key: string; dateStr: string; inMonth: boolean }> = [];
  for (let i = 0; i < padCount; i++) {
    out.push({
      key: `pad-${viewYear}-${viewMonth}-${i}`,
      dateStr: "",
      inMonth: false,
    });
  }
  for (let d = 1; d <= dim; d++) {
    const dateStr = toYmd(viewYear, viewMonth, d);
    out.push({ key: dateStr, dateStr, inMonth: true });
  }
  while (out.length % 7 !== 0) {
    out.push({
      key: `trail-${viewYear}-${viewMonth}-${out.length}`,
      dateStr: "",
      inMonth: false,
    });
  }
  return out;
}

function isOffered(
  service: ServiceRow & {
    urgent_messaging_enabled?: boolean;
    urgent_messaging_rate?: unknown;
  },
  t: BookableSessionType,
): boolean {
  switch (t) {
    case "messaging":
      return !!(service.offers_messaging && service.messaging_flat_rate != null);
    case "urgent_messaging":
      return !!(
        service.urgent_messaging_enabled && service.urgent_messaging_rate != null
      );
    case "audio":
      return !!(service.offers_audio && service.audio_hourly_rate != null);
    case "video":
      return !!(service.offers_video && service.video_hourly_rate != null);
    default:
      return false;
  }
}

function timeToMin(t: string): number {
  const s = t.slice(0, 5);
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Normalize Postgres `time` strings to HH:mm for slot helpers. */
function normalizeTime(t: string): string {
  const s = t.trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

/** Max session length (minutes) allowed from slot start within availability windows. */
function maxDurationMinutesForSlot(
  rows: AvailRpcRow[],
  slotHHmm: string,
): number {
  const slotM = timeToMin(slotHHmm);
  let maxRemain = 0;
  for (const r of rows) {
    if (!r.is_available || !r.start_time || !r.end_time) continue;
    const a = timeToMin(normalizeTime(String(r.start_time)));
    const b = timeToMin(normalizeTime(String(r.end_time)));
    if (slotM >= a && slotM < b) {
      maxRemain = Math.max(maxRemain, b - slotM);
    }
  }
  return maxRemain;
}
