"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavbarCenterProps = {
  signedIn: boolean;
  mobile?: boolean;
};

export default function NavbarCenter({ signedIn, mobile = false }: NavbarCenterProps) {
  const pathname = usePathname() ?? "";
  const isExpertMode =
    pathname === "/expert" || pathname.startsWith("/expert/");

  const linkClass =
    "inline-flex h-10 items-center rounded-xl border border-transparent px-3 text-sm font-semibold text-zinc-600 transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-300 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500/70 dark:focus-visible:ring-offset-zinc-950";

  if (mobile) {
    if (isExpertMode) {
      return null;
    }
    return (
      <div className="mt-3 md:hidden">
        <form action="/search" method="get" className="w-full">
          <label htmlFor="navbar-search-mobile" className="sr-only">
            Search experts
          </label>
          <input
            id="navbar-search-mobile"
            name="q"
            type="search"
            placeholder="Search experts..."
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
            autoComplete="off"
          />
        </form>
      </div>
    );
  }

  if (isExpertMode) {
    return (
      <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" aria-label="Expert navigation">
        <Link
          href="/expert/dashboard"
          className={`${linkClass} ${pathname === "/expert/dashboard" ? "text-zinc-900 dark:text-zinc-100" : ""}`}
        >
          Dashboard
        </Link>
        <Link
          href="/expert/bookings"
          className={`${linkClass} ${(pathname === "/expert/bookings" || pathname.startsWith("/expert/bookings/")) ? "text-zinc-900 dark:text-zinc-100" : ""}`}
        >
          Bookings
        </Link>
        <Link
          href="/expert/availability"
          className={`${linkClass} ${(pathname === "/expert/availability" || pathname.startsWith("/expert/availability/")) ? "text-zinc-900 dark:text-zinc-100" : ""}`}
        >
          Availability
        </Link>
        <Link
          href="/expert/setup"
          className={`${linkClass} ${(pathname === "/expert/setup" || pathname.startsWith("/expert/setup/")) ? "text-zinc-900 dark:text-zinc-100" : ""}`}
        >
          Setup
        </Link>
      </nav>
    );
  }

  return (
    <div className="hidden min-w-0 flex-1 md:flex md:justify-center">
      <form action="/search" method="get" className="w-full max-w-xl">
        <label htmlFor="navbar-search" className="sr-only">
          Search experts
        </label>
        <input
          id="navbar-search"
          name="q"
          type="search"
          placeholder={signedIn ? "Search experts..." : "Search"}
          className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
          autoComplete="off"
        />
        </form>
    </div>
  );
}
