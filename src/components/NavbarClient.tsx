"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavbarClientProps = {
  fullName: string | null;
  initials: string | null;
  avatarUrl: string | null;
  signedIn: boolean;
};

export default function NavbarClient({
  fullName,
  initials,
  avatarUrl,
  signedIn,
}: NavbarClientProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isExpertMode =
    pathname === "/expert" || pathname.startsWith("/expert/");
  const homeHref = isExpertMode ? "/expert/dashboard" : "/dashboard";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = fullName?.trim() || "Account";

  useEffect(() => {
    const navbar = document.getElementById("frame-navbar");
    if (!navbar) return;

    navbar.setAttribute("data-expert-mode", isExpertMode ? "true" : "false");

    const expertLinks = navbar.querySelectorAll<HTMLAnchorElement>("nav a[href^='/expert/']");
    for (const link of expertLinks) {
      const href = link.getAttribute("href") ?? "";
      const active = pathname === href || pathname.startsWith(`${href}/`);
      if (active) {
        link.setAttribute("data-active", "true");
      } else {
        link.removeAttribute("data-active");
      }
    }
  }, [isExpertMode, pathname]);

  useEffect(() => {
    const homeLink = document.getElementById("frame-navbar-home-link");
    if (!(homeLink instanceof HTMLAnchorElement)) return;

    function handleHomeClick(event: MouseEvent) {
      event.preventDefault();
      router.push(homeHref);
    }

    homeLink.addEventListener("click", handleHomeClick);
    return () => {
      homeLink.removeEventListener("click", handleHomeClick);
    };
  }, [homeHref, router]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current) return;
      const target = event.target;
      if (target instanceof Node && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function closeMenu() {
    setOpen(false);
  }

  const dropdownItemClass =
    "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none";

  return (
    <div className="flex items-center justify-end gap-2">
      {signedIn ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold transition focus-visible:outline-none sm:px-3 ${
              isExpertMode
                ? "border-white/20 bg-transparent text-[var(--color-navbar-dark-text)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-text)]"
            }`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
                width={28}
                height={28}
              />
            ) : (
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                  isExpertMode
                    ? "bg-white text-[var(--color-navbar-dark)]"
                    : "bg-[var(--color-text)] text-white"
                }`}
              >
                {initials ?? "?"}
              </span>
            )}
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {displayName}
            </span>
          </button>

          <div
            className={`absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-[var(--color-border)] bg-white p-2 text-sm shadow-[var(--shadow-md)] transition duration-200 ${
              open
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
            role="menu"
            aria-hidden={!open}
          >
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {initials ?? "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {displayName}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {isExpertMode ? "Sensei" : "Student"}
                </p>
              </div>
            </div>

            <div className="my-2 h-px bg-[var(--color-border)]" />

            {isExpertMode ? (
              <>
                <Link
                  href="/expert/dashboard"
                  onClick={closeMenu}
                  className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/expert/bookings"
                  onClick={closeMenu}
                  className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
                >
                  Bookings
                </Link>
                <Link
                  href="/expert/earnings"
                  onClick={closeMenu}
                  className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
                >
                  Earnings
                </Link>
                <Link
                  href="/expert/availability"
                  onClick={closeMenu}
                  className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
                >
                  Availability
                </Link>
                <Link
                  href="/expert/setup"
                  onClick={closeMenu}
                  className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
                >
                  Setup
                </Link>
              </>
            ) : (
              <Link
                href="/bookings"
                onClick={closeMenu}
                className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
              >
                My Bookings
              </Link>
            )}

            <div className="my-2 h-px bg-[var(--color-border)]" />

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                onClick={closeMenu}
                className={`${dropdownItemClass} text-[var(--color-text)] hover:bg-zinc-100`}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500/70 dark:focus-visible:ring-offset-zinc-950"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
