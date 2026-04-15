"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BecomeExpertBannerProps = {
  signedIn: boolean;
  hasExpertProfile: boolean;
};

export default function BecomeExpertBanner({
  signedIn,
  hasExpertProfile,
}: BecomeExpertBannerProps) {
  const pathname = usePathname() ?? "";
  const isExpertMode =
    pathname === "/expert" || pathname.startsWith("/expert/");
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem("frame_become_expert_dismissed");
      setDismissed(value === "1");
    } catch {
      setDismissed(false);
    } finally {
      setReady(true);
    }
  }, []);

  function dismissBanner() {
    setDismissed(true);
    try {
      window.localStorage.setItem("frame_become_expert_dismissed", "1");
    } catch {
      // Ignore localStorage errors and keep the in-memory dismissed state.
    }
  }

  if (!ready || !signedIn || hasExpertProfile || isExpertMode || dismissed) {
    return null;
  }

  return (
    <div className="border-b border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Share your expertise on FRAME.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/expert/setup"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500/70"
          >
            Become an expert
          </Link>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss become an expert banner"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500/70"
          >
            <span aria-hidden>&times;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
