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
      className={`mr-3 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? "border border-white bg-white text-zinc-900 shadow-md shadow-white/20 hover:bg-zinc-100"
          : "border border-white/40 bg-white/5 text-white/60 shadow-inner hover:border-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      Sensei
    </button>
  );
}
