function looksLikeOffsetOnly(longName: string): boolean {
  const t = longName.trim();
  if (t === "GMT" || t === "UTC") return true;
  if (t.startsWith("GMT+") || t.startsWith("GMT-")) return true;
  return false;
}

/** Strip Region/ prefix and turn underscores into spaces (e.g. Europe/London → London). */
function ianaCityFallback(tz: string): string {
  const slash = tz.indexOf("/");
  const tail = slash >= 0 ? tz.slice(slash + 1) : tz;
  return tail.replace(/_/g, " ");
}

/**
 * Converts an IANA timezone to a short friendly label for UI copy.
 * Never throws; on failure returns the input (trimmed) or a simple city fallback.
 */
export function formatTimezone(tz: string): string {
  let raw = "";
  try {
    raw = String(tz ?? "").trim();
    if (raw === "") return "";
    if (raw === "UTC") return "UTC";

    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: raw,
      timeZoneName: "long",
    });
    const longName = dtf.formatToParts(new Date()).find((p) => p.type === "timeZoneName")
      ?.value;
    if (longName && !looksLikeOffsetOnly(longName)) {
      return longName;
    }

    return ianaCityFallback(raw) || raw;
  } catch {
    try {
      const t = String(tz ?? "").trim();
      if (t === "") return "";
      if (t === "UTC") return "UTC";
      return ianaCityFallback(t) || t;
    } catch {
      return raw || String(tz ?? "");
    }
  }
}
