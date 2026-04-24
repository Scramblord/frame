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
      const setModeResult = (await res.json()) as {
        ok?: boolean;
        hasExpertProfile?: boolean;
      };
      if (!nextMode) {
        router.push("/dashboard");
        return;
      }
      router.push(
        setModeResult.hasExpertProfile ? "/expert/dashboard" : "/expert/setup",
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
      className={`mr-3 cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? "border border-white bg-white text-zinc-900 hover:bg-white/90"
          : "border border-white/30 bg-transparent text-white/50 hover:border-white/60 hover:text-white/80"
      }`}
    >
      Sensei
    </button>
  );
}
