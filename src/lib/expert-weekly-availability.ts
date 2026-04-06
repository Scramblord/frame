/** PostgreSQL `extract(dow)` / `availability.day_of_week`: 0 = Sunday … 6 = Saturday */
export const DOW_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

const DOW_LABEL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export type WeeklyAvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

function formatTime12h(timeStr: string): string {
  const s = timeStr.trim();
  const hhmm = s.length >= 5 ? s.slice(0, 5) : s;
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;
  const d = new Date(2000, 0, 1, h, m, 0, 0);
  return d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** One day: sorted windows → "9:00am – 5:00pm" or multiple ranges joined by comma. */
export function formatDayWindows(rows: WeeklyAvailabilityRow[]): string {
  const sorted = [...rows].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  return sorted
    .map((r) => {
      const a = formatTime12h(r.start_time);
      const b = formatTime12h(r.end_time);
      return `${a} – ${b}`;
    })
    .join(", ");
}

function signatureForDay(
  byDay: Map<number, WeeklyAvailabilityRow[]>,
  dow: number,
): string {
  const list = byDay.get(dow);
  if (!list?.length) return "";
  return formatDayWindows(list);
}

type Run = { startDow: number; endDow: number; label: string };

/**
 * Human-readable lines, e.g. "Monday – Friday, 9:00am – 5:00pm" when consecutive
 * days share identical windows.
 */
export function summarizeWeeklyAvailability(
  rows: WeeklyAvailabilityRow[],
): string[] {
  if (!rows.length) return [];

  const byDay = new Map<number, WeeklyAvailabilityRow[]>();
  for (const r of rows) {
    const d = r.day_of_week;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(r);
  }

  const runs: Run[] = [];
  let i = 0;
  const order = [...DOW_ORDER_MON_FIRST];

  while (i < order.length) {
    const dow = order[i]!;
    const sig = signatureForDay(byDay, dow);
    if (!sig) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < order.length) {
      const nextDow = order[j]!;
      if (signatureForDay(byDay, nextDow) !== sig) break;
      j += 1;
    }
    const startDow = order[i]!;
    const endDow = order[j - 1]!;
    const startName = DOW_LABEL[startDow] ?? String(startDow);
    const endName = DOW_LABEL[endDow] ?? String(endDow);
    const rangeLabel =
      startDow === endDow
        ? startName
        : `${startName} – ${endName}`;
    runs.push({ startDow, endDow, label: `${rangeLabel}, ${sig}` });
    i = j;
  }

  return runs.map((r) => r.label);
}
