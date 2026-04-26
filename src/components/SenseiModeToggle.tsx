"use client";

import { useRouter } from "next/navigation";

type SenseiModeToggleProps = {
  isActive: boolean;
  hasExpertProfile: boolean;
  darkNav: boolean;
};

export default function SenseiModeToggle({
  isActive,
  hasExpertProfile,
  darkNav,
}: SenseiModeToggleProps) {
  const router = useRouter();

  function onToggle() {
    if (isActive) {
      router.push("/dashboard");
      return;
    }
    router.push(hasExpertProfile ? "/expert/dashboard" : "/expert/setup");
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isActive}
      aria-label="Toggle Sensei mode"
      className={`mr-3 cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
        darkNav
          ? isActive
            ? "border border-white bg-white text-zinc-900 hover:bg-white/90"
            : "border border-white/30 bg-transparent text-white/50 hover:border-white/60 hover:text-white/80"
          : isActive
            ? "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700"
            : "border border-zinc-300 bg-transparent text-zinc-500 hover:border-zinc-500 hover:text-zinc-700"
      }`}
    >
      Sensei
    </button>
  );
}
