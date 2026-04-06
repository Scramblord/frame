"use client";

import { supabase } from "@/lib/supabase/client";
import type { OverrideRow, WeeklyDayState } from "./availability-types";
import { newSlotKey, validateSlotsNoOverlap } from "./availability-utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function padHHmm(t: string): string {
  if (!t) return "09:00";
  const s = t.slice(0, 8);
  const p = s.split(":");
  if (p.length >= 2) return `${p[0].padStart(2, "0")}:${p[1].padStart(2, "0")}`;
  return "09:00";
}

/** Group override rows by date string (YYYY-MM-DD). */
function groupOverridesByDate(rows: OverrideRow[]): Map<string, OverrideRow[]> {
  const m = new Map<string, OverrideRow[]>();
  for (const r of rows) {
    const k = r.date;
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  return m;
}

type CellKind = "green" | "red" | "amber" | "grey";

function cellClass(kind: CellKind): string {
  switch (kind) {
    case "green":
      return "bg-emerald-100/90 text-emerald-950 ring-1 ring-emerald-200/80 hover:bg-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-800";
    case "red":
      return "bg-rose-100/90 text-rose-950 ring-1 ring-rose-200/80 hover:bg-rose-200/80 dark:bg-rose-950/45 dark:text-rose-100 dark:ring-rose-900";
    case "amber":
      return "bg-amber-100/90 text-amber-950 ring-1 ring-amber-200/80 hover:bg-amber-200/80 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-900";
    default:
      return "bg-zinc-100/90 text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-200/70 dark:bg-zinc-800/60 dark:text-zinc-400 dark:ring-zinc-700";
  }
}

function resolveCellKind(
  date: Date,
  weeklyDays: WeeklyDayState[],
  overridesByDate: Map<string, OverrideRow[]>,
): CellKind {
  const key = toYMD(date);
  const list = overridesByDate.get(key) ?? [];
  if (list.some((r) => r.is_blocked)) return "red";
  if (
    list.some(
      (r) =>
        !r.is_blocked && r.start_time != null && r.end_time != null,
    )
  ) {
    return "amber";
  }
  const dow = date.getDay();
  const w = weeklyDays.find((d) => d.dayOfWeek === dow);
  if (w?.enabled && w.slots.length > 0) return "green";
  return "grey";
}

type ModalSlot = { clientKey: string; start: string; end: string };

type AvailabilityCalendarProps = {
  weeklyDays: WeeklyDayState[];
  initialOverrides: OverrideRow[];
  timezone: string;
};

export default function AvailabilityCalendar({
  weeklyDays,
  initialOverrides,
  timezone,
}: AvailabilityCalendarProps) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [overridesByDate, setOverridesByDate] = useState<Map<string, OverrideRow[]>>(
    () => groupOverridesByDate(initialOverrides),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalMode, setModalMode] = useState<"block" | "custom">("block");
  const [modalSlots, setModalSlots] = useState<ModalSlot[]>([
    { clientKey: newSlotKey(), start: "09:00", end: "18:00" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverridesByDate(groupOverridesByDate(initialOverrides));
  }, [initialOverrides]);

  const loadOverrides = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: qErr } = await supabase
      .from("availability_overrides")
      .select("id, date, is_blocked, start_time, end_time")
      .eq("expert_user_id", user.id)
      .order("date", { ascending: true });
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setOverridesByDate(groupOverridesByDate((data ?? []) as OverrideRow[]));
    setError(null);
  }, []);

  const gridCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: ({ date: Date } | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(viewYear, viewMonth, d) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  function openModal(d: Date) {
    setModalDate(d);
    const key = toYMD(d);
    const list = overridesByDate.get(key) ?? [];

    if (list.some((r) => r.is_blocked)) {
      setModalMode("block");
      setModalSlots([{ clientKey: newSlotKey(), start: "09:00", end: "18:00" }]);
    } else {
      const customRows = list.filter(
        (r) => !r.is_blocked && r.start_time && r.end_time,
      );
      if (customRows.length > 0) {
        setModalMode("custom");
        setModalSlots(
          customRows.map((r) => ({
            clientKey: newSlotKey(),
            start: padHHmm(String(r.start_time)),
            end: padHHmm(String(r.end_time)),
          })),
        );
      } else {
        setModalMode("custom");
        setModalSlots([
          { clientKey: newSlotKey(), start: "09:00", end: "18:00" },
        ]);
      }
    }
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalDate(null);
  }

  async function handleSaveOverride() {
    if (!modalDate) return;
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const dateStr = toYMD(modalDate);

    try {
      const { error: delErr } = await supabase
        .from("availability_overrides")
        .delete()
        .eq("expert_user_id", user.id)
        .eq("date", dateStr);
      if (delErr) {
        setError(delErr.message);
        return;
      }

      if (modalMode === "block") {
        const { error: insErr } = await supabase
          .from("availability_overrides")
          .insert({
            expert_user_id: user.id,
            date: dateStr,
            is_blocked: true,
            start_time: null,
            end_time: null,
          });
        if (insErr) {
          setError(insErr.message);
          return;
        }
      } else {
        const msg = validateSlotsNoOverlap(modalSlots);
        if (msg) {
          setError(msg);
          return;
        }
        const rows = modalSlots.map((s) => ({
          expert_user_id: user.id,
          date: dateStr,
          is_blocked: false,
          start_time: s.start.length === 5 ? `${s.start}:00` : s.start,
          end_time: s.end.length === 5 ? `${s.end}:00` : s.end,
        }));
        const { error: insErr } = await supabase
          .from("availability_overrides")
          .insert(rows);
        if (insErr) {
          setError(insErr.message);
          return;
        }
      }
      await loadOverrides();
      closeModal();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAllOverrides() {
    if (!modalDate) return;
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const dateStr = toYMD(modalDate);
    try {
      const { error: dErr } = await supabase
        .from("availability_overrides")
        .delete()
        .eq("expert_user_id", user.id)
        .eq("date", dateStr);
      if (dErr) {
        setError(dErr.message);
        return;
      }
      await loadOverrides();
      closeModal();
    } finally {
      setBusy(false);
    }
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const modalKey = modalDate ? toYMD(modalDate) : "";
  const modalList = modalDate ? overridesByDate.get(modalKey) ?? [] : [];
  const hasAnyOverride = modalList.length > 0;

  function updateModalSlot(key: string, patch: Partial<ModalSlot>) {
    setModalSlots((prev) =>
      prev.map((s) => (s.clientKey === key ? { ...s, ...patch } : s)),
    );
  }

  function addModalSlot() {
    setModalSlots((prev) => [
      ...prev,
      { clientKey: newSlotKey(), start: "09:00", end: "18:00" },
    ]);
  }

  function removeModalSlot(key: string) {
    setModalSlots((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.clientKey !== key),
    );
  }

  return (
    <section className="mt-14 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Date overrides
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Block specific dates or set one-off hours. Overrides apply in your
        profile timezone ({timezone}). Colours:{" "}
        <span className="text-emerald-700 dark:text-emerald-400">
          weekly hours
        </span>
        ,{" "}
        <span className="text-rose-700 dark:text-rose-400">blocked</span>,{" "}
        <span className="text-amber-800 dark:text-amber-300">
          custom hours
        </span>
        ,{" "}
        <span className="text-zinc-600 dark:text-zinc-500">no weekly hours</span>
        .
      </p>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Prev
        </button>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Next →
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:gap-2 sm:text-xs">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {gridCells.map((cell, idx) => {
          if (!cell) {
            return (
              <div
                key={`empty-${viewYear}-${viewMonth}-${idx}`}
                className="aspect-square min-h-[2.5rem] sm:min-h-[3rem]"
              />
            );
          }
          const kind = resolveCellKind(
            cell.date,
            weeklyDays,
            overridesByDate,
          );
          return (
            <button
              key={toYMD(cell.date)}
              type="button"
              onClick={() => openModal(cell.date)}
              className={`flex aspect-square min-h-[2.5rem] flex-col items-center justify-center rounded-xl text-sm font-medium transition sm:min-h-[3rem] ${cellClass(kind)}`}
            >
              <span>{cell.date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {modalOpen && modalDate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h4
              id="override-modal-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {modalKey}
            </h4>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-600">
                <input
                  type="radio"
                  name="ovmode"
                  checked={modalMode === "block"}
                  onChange={() => setModalMode("block")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Block this day (unavailable)
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-600">
                <input
                  type="radio"
                  name="ovmode"
                  checked={modalMode === "custom"}
                  onChange={() => setModalMode("custom")}
                  className="mt-1 h-4 w-4"
                />
                <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Custom hours
                </span>
              </label>
            </div>

            {modalMode === "custom" ? (
              <div className="mt-4 space-y-3">
                {modalSlots.map((s) => (
                  <div
                    key={s.clientKey}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Slot
                      </span>
                      <button
                        type="button"
                        disabled={modalSlots.length <= 1}
                        onClick={() => removeModalSlot(s.clientKey)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-30 dark:hover:bg-zinc-700"
                        aria-label="Remove slot"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={s.start}
                        onChange={(e) =>
                          updateModalSlot(s.clientKey, { start: e.target.value })
                        }
                        className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      />
                      <span className="text-zinc-500">–</span>
                      <input
                        type="time"
                        value={s.end}
                        onChange={(e) =>
                          updateModalSlot(s.clientKey, { end: e.target.value })
                        }
                        className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addModalSlot}
                  className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400"
                >
                  Add time slot
                </button>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSaveOverride()}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              {hasAnyOverride ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemoveAllOverrides()}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Remove all overrides
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={closeModal}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
