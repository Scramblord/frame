"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavbarClientProps = {
  fullName: string | null;
  initials: string | null;
  hasExpertProfile: boolean;
  signedIn: boolean;
};

export default function NavbarClient({
  fullName,
  initials,
  hasExpertProfile,
  signedIn,
}: NavbarClientProps) {
  const pathname = usePathname() ?? "";
  const isExpertMode =
    pathname === "/expert" || pathname.startsWith("/expert/");
  const modeHomeHref = isExpertMode ? "/expert/dashboard" : "/dashboard";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {signedIn ? (
        <>
          {hasExpertProfile ? (
            <div
              className="flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 dark:border-zinc-600 dark:bg-zinc-800/80"
              role="group"
              aria-label="Account mode"
            >
              <Link
                href="/dashboard"
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                  !isExpertMode
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Consumer
              </Link>
              <Link
                href="/expert/dashboard"
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                  isExpertMode
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Expert
              </Link>
            </div>
          ) : (
            <Link
              href="/expert/setup"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
            >
              Become an expert
            </Link>
          )}

          <Link
            href={modeHomeHref}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {initials ?? "?"}
            </span>
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {fullName ?? "Account"}
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900 hover:shadow dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </form>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900 hover:shadow dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
