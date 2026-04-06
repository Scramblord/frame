/** Minutes since midnight for "HH:mm" or "HH:mm:ss". */
export function timeToMinutes(t: string): number {
  const p = t.trim().slice(0, 8).split(":");
  const h = parseInt(p[0] ?? "0", 10);
  const m = parseInt(p[1] ?? "0", 10);
  return h * 60 + m;
}

export function validateSlotsNoOverlap(
  slots: { start: string; end: string }[],
): string | null {
  if (slots.length === 0) {
    return "Add at least one time slot.";
  }
  for (const s of slots) {
    if (timeToMinutes(s.start) >= timeToMinutes(s.end)) {
      return "Each slot needs an end time after its start time.";
    }
  }
  const sorted = [...slots].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
  );
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (
        timeToMinutes(a.start) < timeToMinutes(b.end) &&
        timeToMinutes(b.start) < timeToMinutes(a.end)
      ) {
        return "Time slots must not overlap.";
      }
    }
  }
  return null;
}

export function newSlotKey(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
