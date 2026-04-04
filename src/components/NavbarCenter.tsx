"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavbarCenterProps = {
  signedIn: boolean;
  hasExpertProfile: boolean;
  publicProfileId: string | null;
};

export default function NavbarCenter({
  signedIn,
  hasExpertProfile,
  publicProfileId,
}: NavbarCenterProps) {
  const pathname = usePathname() ?? "";
  const isExpertMode =
    pathname === "/expert" || pathname.startsWith("/expert/");

  const showViewProfile =
    signedIn && hasExpertProfile && isExpertMode && publicProfileId;

  if (showViewProfile) {
    return (
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <Link
          href={`/experts/${publicProfileId}`}
          className="truncate rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-center text-xs font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 sm:text-sm"
        >
          View my profile
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 px-2">
      <form action="/search" method="get" className="mx-auto max-w-md">
        <label htmlFor="navbar-search" className="sr-only">
          Search experts
        </label>
        <input
          id="navbar-search"
          name="q"
          type="search"
          placeholder="Search experts…"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-1 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
          autoComplete="off"
        />
      </form>
    </div>
  );
}
