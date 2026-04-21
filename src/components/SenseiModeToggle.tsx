"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SenseiModeToggleProps = {
  enabled: boolean;
};

export default function SenseiModeToggle({ enabled }: SenseiModeToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onToggle() {
    if (loading) return;
    const nextMode = !enabled;
    setLoading(true);
    try {
      const res = await fetch("/api/profile/set-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensei_mode: nextMode }),
      });
      if (!res.ok) return;
      router.refresh();
      if (!nextMode) {
        router.push("/dashboard");
        return;
      }
      const expertStatusRes = await fetch("/api/profile/expert-status");
      if (!expertStatusRes.ok) return;
      const expertStatus = (await expertStatusRes.json()) as {
        hasExpertProfile?: boolean;
      };
      router.push(
        expertStatus.hasExpertProfile ? "/expert/dashboard" : "/expert/setup",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={loading}
      aria-pressed={enabled}
      aria-label="Toggle Sensei mode"
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? "border-zinc-700 bg-zinc-800 text-white hover:border-zinc-500 hover:bg-zinc-700"
          : "border-zinc-300 bg-transparent text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
      }`}
    >
      Sensei
    </button>
  );
}
