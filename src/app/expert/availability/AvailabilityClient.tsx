"use client";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AvRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

type DayState = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function toHHmm(t: string): string {
  const s = t.slice(0, 8);
  const parts = s.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return "09:00";
}

function buildInitialState(rows: AvRow[]): DayState[] {
  const byDay = new Map<number, AvRow>();
  for (const r of rows) {
    if (r.is_active !== false) byDay.set(r.day_of_week, r);
  }
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const r = byDay.get(dow);
    if (r) {
      return {
        dayOfWeek: dow,
        enabled: true,
        startTime: toHHmm(r.start_time),
        endTime: toHHmm(r.end_time),
      };
    }
    return {
      dayOfWeek: dow,
      enabled: dow >= 1 && dow <= 5,
      startTime: "09:00",
      endTime: "18:00",
    };
  });
}

type AvailabilityClientProps = {
  initialRows: AvRow[];
  timezone: string;
};

export default function AvailabilityClient({
  initialRows,
  timezone,
}: AvailabilityClientProps) {
  const router = useRouter();
  const [days, setDays] = useState<DayState[]>(() =>
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

  function updateDay(dow: number, patch: Partial<DayState>) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)),
    );
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    for (const d of days) {
      if (!d.enabled) continue;
      if (d.startTime >= d.endTime) {
        setError(
          `${DAY_LABELS[d.dayOfWeek]}: end time must be after start time.`,
        );
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

    const enabled = days.filter((d) => d.enabled);
    if (enabled.length === 0) {
      setSaved(true);
      setSaving(false);
      router.refresh();
      return;
    }

    const payload = enabled.map((d) => ({
      expert_user_id: user.id,
      day_of_week: d.dayOfWeek,
      start_time: d.startTime.length === 5 ? `${d.startTime}:00` : d.startTime,
      end_time: d.endTime.length === 5 ? `${d.endTime}:00` : d.endTime,
      is_active: true,
    }));

    const { error: insErr } = await supabase
      .from("availability")
      .insert(payload);

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
                    onChange={(e) =>
                      updateDay(d.dayOfWeek, { enabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    On
                  </span>
                </label>
              </div>
              {d.enabled ? (
                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-700">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Start
                    </label>
                    <input
                      type="time"
                      value={d.startTime}
                      onChange={(e) =>
                        updateDay(d.dayOfWeek, { startTime: e.target.value })
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
                      value={d.endTime}
                      onChange={(e) =>
                        updateDay(d.dayOfWeek, { endTime: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                    />
                  </div>
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

      {error ? (
        <p
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Availability saved.
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="mt-8 w-full max-w-xs rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
