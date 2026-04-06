"use client";

import { supabase } from "@/lib/supabase/client";
import type { OverrideRow, WeeklyDayState } from "./availability-types";
import { newSlotKey, validateSlotsNoOverlap } from "./availability-utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AvailabilityCalendar from "./AvailabilityCalendar";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AvRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

function toHHmm(t: string): string {
  const s = t.slice(0, 8);
  const parts = s.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return "09:00";
}

function buildInitialState(rows: AvRow[]): WeeklyDayState[] {
  const byDay = new Map<number, AvRow[]>();
  for (const r of rows) {
    if (r.is_active === false) continue;
    const list = byDay.get(r.day_of_week) ?? [];
    list.push(r);
    byDay.set(r.day_of_week, list);
  }
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const list = (byDay.get(dow) ?? []).sort((a, b) =>
      String(a.start_time).localeCompare(String(b.start_time)),
    );
    if (list.length > 0) {
      return {
        dayOfWeek: dow,
        enabled: true,
        slots: list.map((r) => ({
          clientKey: newSlotKey(),
          start: toHHmm(r.start_time),
          end: toHHmm(r.end_time),
        })),
      };
    }
    return {
      dayOfWeek: dow,
      enabled: dow >= 1 && dow <= 5,
      slots: [{ clientKey: newSlotKey(), start: "09:00", end: "18:00" }],
    };
  });
}

type AvailabilityClientProps = {
  initialRows: AvRow[];
  initialOverrides: OverrideRow[];
  timezone: string;
};

export default function AvailabilityClient({
  initialRows,
  initialOverrides,
  timezone,
}: AvailabilityClientProps) {
  const router = useRouter();
  const [days, setDays] = useState<WeeklyDayState[]>(() =>
    buildInitialState(initialRows),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tzLabel = useMemo(() => {
    try {
      return timezone || "UTC";
    } catch {
      return timezone;
    }
  }, [timezone]);

  function setDay(dow: number, next: WeeklyDayState) {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dow ? next : d)));
    setSaved(false);
  }

  function updateSlot(
    dow: number,
    clientKey: string,
    patch: Partial<{ start: string; end: string }>,
  ) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d;
        return {
          ...d,
          slots: d.slots.map((s) =>
            s.clientKey === clientKey ? { ...s, ...patch } : s,
          ),
        };
      }),
    );
    setSaved(false);
  }

  function addSlot(dow: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dow
          ? {
              ...d,
              slots: [
                ...d.slots,
                { clientKey: newSlotKey(), start: "09:00", end: "18:00" },
              ],
            }
          : d,
      ),
    );
    setSaved(false);
  }

  function removeSlot(dow: number, clientKey: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dow) return d;
        if (d.slots.length <= 1) return d;
        return {
          ...d,
          slots: d.slots.filter((s) => s.clientKey !== clientKey),
        };
      }),
    );
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    for (const d of days) {
      if (!d.enabled) continue;
      const err = validateSlotsNoOverlap(d.slots);
      if (err) {
        setError(`${DAY_LABELS[d.dayOfWeek]}: ${err}`);
        return;
      }
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      setSaving(false);
      return;
    }

    const { error: delErr } = await supabase
      .from("availability")
      .delete()
      .eq("expert_user_id", user.id);

    if (delErr) {
      setError(delErr.message);
      setSaving(false);
      return;
    }

    const payload: {
      expert_user_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }[] = [];

    for (const d of days) {
      if (!d.enabled) continue;
      for (const s of d.slots) {
        payload.push({
          expert_user_id: user.id,
          day_of_week: d.dayOfWeek,
          start_time: s.start.length === 5 ? `${s.start}:00` : s.start,
          end_time: s.end.length === 5 ? `${s.end}:00` : s.end,
          is_active: true,
        });
      }
    }

    if (payload.length === 0) {
      setSaved(true);
      setSaving(false);
      router.refresh();
      return;
    }

    const { error: insErr } = await supabase.from("availability").insert(payload);

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <div className="mb-2">
        <Link
          href="/expert/dashboard"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Expert dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Availability
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Set your weekly hours. Times are in your profile timezone:{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {tzLabel}
        </span>
        .
      </p>

      <div className="mt-8 overflow-x-auto pb-2">
        <div className="grid min-w-[640px] grid-cols-7 gap-3 sm:min-w-0 sm:gap-4">
          {days.map((d) => (
            <div
              key={d.dayOfWeek}
              className={`rounded-2xl border p-3 sm:p-4 ${
                d.enabled
                  ? "border-zinc-900/20 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                  : "border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/50"
              }`}
            >
              <div className="flex flex-col gap-2">
                <span className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {DAY_LABELS[d.dayOfWeek]}
                </span>
                <label className="flex cursor-pointer items-center justify-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDay(d.dayOfWeek, {
                        ...d,
                        enabled: on,
                        slots: on
                          ? d.slots.length > 0
                            ? d.slots
                            : [
                                {
                                  clientKey: newSlotKey(),
                                  start: "09:00",
                                  end: "18:00",
                                },
                              ]
                          : d.slots,
                      });
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    On
                  </span>
                </label>
              </div>
              {d.enabled ? (
                <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-700">
                  {d.slots.map((s) => (
                    <div
                      key={s.clientKey}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/40"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-medium uppercase text-zinc-500 dark:text-zinc-400">
                          Slot
                        </span>
                        <button
                          type="button"
                          disabled={d.slots.length <= 1}
                          onClick={() => removeSlot(d.dayOfWeek, s.clientKey)}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-30 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                          aria-label="Remove slot"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Start
                          </label>
                          <input
                            type="time"
                            value={s.start}
                            onChange={(e) =>
                              updateSlot(d.dayOfWeek, s.clientKey, {
                                start: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            End
                          </label>
                          <input
                            type="time"
                            value={s.end}
                            onChange={(e) =>
                              updateSlot(d.dayOfWeek, s.clientKey, {
                                end: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSlot(d.dayOfWeek)}
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Add time slot
                  </button>
                </div>
              ) : (
                <p className="mt-3 border-t border-zinc-100 pt-3 text-center text-[10px] text-zinc-400 dark:border-zinc-700">
                  Off
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/60 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Save weekly hours
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Save your weekly grid before using date overrides below. Date
          overrides are saved separately when you edit a day on the calendar.
        </p>
        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Weekly availability saved.
          </p>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Saving…" : "Save weekly availability"}
        </button>
      </div>

      <AvailabilityCalendar
        weeklyDays={days}
        initialOverrides={initialOverrides}
        timezone={tzLabel}
      />
    </div>
  );
}
