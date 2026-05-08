"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type DashboardAlertItem = {
  id: string;
  tone: "warning" | "attention";
  message: string;
  href: string;
  linkLabel: string;
};

type Props = {
  storageScope: string;
  alerts: DashboardAlertItem[];
};

export default function DashboardAlertStrip({ storageScope, alerts }: Props) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<string, boolean> = {};
    for (const alert of alerts) {
      const key = `sensei:alert-dismissed:${storageScope}:${alert.id}`;
      next[alert.id] = localStorage.getItem(key) === "1";
    }
    setDismissed(next);
  }, [alerts, storageScope]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissed[a.id]),
    [alerts, dismissed],
  );

  function dismiss(alertId: string) {
    if (typeof window !== "undefined") {
      const key = `sensei:alert-dismissed:${storageScope}:${alertId}`;
      localStorage.setItem(key, "1");
    }
    setDismissed((prev) => ({ ...prev, [alertId]: true }));
  }

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
            alert.tone === "attention"
              ? "bg-red-600/10 text-red-900 dark:bg-red-900/30 dark:text-red-100"
              : "bg-amber-500/20 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
          }`}
        >
          <p className="min-w-0 flex-1 truncate">
            {alert.message}{" "}
            <Link href={alert.href} className="font-semibold underline underline-offset-2">
              {alert.linkLabel}
            </Link>
          </p>
          <button
            type="button"
            onClick={() => dismiss(alert.id)}
            aria-label="Dismiss alert"
            className="shrink-0 rounded p-1 text-current/80 transition hover:bg-black/10 hover:text-current dark:hover:bg-white/10"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
