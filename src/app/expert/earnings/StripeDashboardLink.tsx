"use client";

import { useState } from "react";

export default function StripeDashboardLink() {
  const [loading, setLoading] = useState(false);

  async function openDashboard() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/dashboard-link");
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // Fallback below.
    } finally {
      setLoading(false);
    }
    window.open("https://connect.stripe.com", "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={() => void openDashboard()}
      disabled={loading}
      className="text-sm font-medium text-[var(--color-accent)] hover:underline disabled:opacity-60"
    >
      {loading ? "Opening…" : "Manage account →"}
    </button>
  );
}
