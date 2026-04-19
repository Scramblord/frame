"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MODE_PREF_KEY = "frame_mode_preference";

type ModePref = "consumer" | "expert";

function readModePref(): ModePref | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(MODE_PREF_KEY);
  if (v === "consumer" || v === "expert") return v;
  return null;
}

function writeModePref(mode: ModePref) {
  localStorage.setItem(MODE_PREF_KEY, mode);
}

type NavbarClientProps = {
  fullName: string | null;
  initials: string | null;
  avatarUrl: string | null;
  hasExpertProfile: boolean;
  signedIn: boolean;
};

export default function NavbarClient({
  fullName,
  initials,
  avatarUrl,
  hasExpertProfile,
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

  /** Apply preference-based routing once paths are known (client-only). Avoids SSR/localStorage mismatch; pathname-driven mode stays consistent after navigation. */
  useLayoutEffect(() => {
    if (!signedIn || !hasExpertProfile) return;

    const pref = readModePref();
    const onDashboard = pathname === "/dashboard";
    const onExpert =
      pathname === "/expert" || pathname.startsWith("/expert/");
    const onExpertSetup = pathname.startsWith("/expert/setup");

    if (pref === "expert" && onDashboard) {
      router.replace("/expert/dashboard");
      return;
    }

    if (pref === "consumer" && onExpert && !onExpertSetup) {
      router.replace("/dashboard");
      return;
    }

    if (pref === null && onDashboard) {
      writeModePref("expert");
      router.replace("/expert/dashboard");
    }
  }, [signedIn, hasExpertProfile, pathname, router]);

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

  function goConsumerMode() {
    writeModePref("consumer");
    router.push("/dashboard");
  }

  function goExpertMode() {
    writeModePref("expert");
    router.push("/expert/dashboard");
  }

  const dropdownItemClass =
    "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500/70 dark:focus-visible:ring-offset-zinc-900";

  const pillWrapClass = isExpertMode
    ? "inline-flex rounded-md border border-zinc-600/90 bg-zinc-800/80 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "inline-flex rounded-md border border-zinc-300/90 bg-zinc-100/90 p-0.5 shadow-[inset_0_1px_0_rgba(0,0,0,0.06)] dark:border-zinc-600 dark:bg-zinc-800/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

  const segmentInactive = isExpertMode
    ? "text-zinc-400 hover:text-zinc-200"
    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100";

  const segmentActive = isExpertMode
    ? "bg-zinc-700 text-white shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]"
    : "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-zinc-700 dark:text-zinc-50 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]";

  return (
    <div className="flex items-center justify-end gap-2">
      {signedIn && hasExpertProfile ? (
        <div
          className={pillWrapClass}
          role="group"
          aria-label="Account mode"
        >
          <button
            type="button"
            onClick={() => goConsumerMode()}
            className={`rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              !isExpertMode ? segmentActive : segmentInactive
            }`}
          >
            Consumer
          </button>
          <button
            type="button"
            onClick={() => goExpertMode()}
            className={`rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              isExpertMode ? segmentActive : segmentInactive
            }`}
          >
            Expert
          </button>
        </div>
      ) : null}

      {signedIn ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-500/70 dark:focus-visible:ring-offset-zinc-950 sm:px-3 ${
              isExpertMode
                ? "border-zinc-700/80 bg-zinc-800/70 text-white hover:border-zinc-500 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
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
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
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
            className={`absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-zinc-200 bg-white p-2 shadow-lg ring-1 ring-zinc-900/5 transition duration-200 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-100/10 ${
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
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isExpertMode ? "Expert Dashboard" : "Consumer Dashboard"}
                </p>
              </div>
            </div>

            <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />

            {isExpertMode ? (
              <>
                <div className="md:hidden">
                  <Link
                    href="/expert/dashboard"
                    onClick={closeMenu}
                    className={`${dropdownItemClass} ${pathname === "/expert/dashboard" ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/expert/bookings"
                    onClick={closeMenu}
                    className={`${dropdownItemClass} ${(pathname === "/expert/bookings" || pathname.startsWith("/expert/bookings/")) ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
                  >
                    Bookings
                  </Link>
                  <Link
                    href="/expert/availability"
                    onClick={closeMenu}
                    className={`${dropdownItemClass} ${(pathname === "/expert/availability" || pathname.startsWith("/expert/availability/")) ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
                  >
                    Availability
                  </Link>
                  <Link
                    href="/expert/setup"
                    onClick={closeMenu}
                    className={`${dropdownItemClass} ${(pathname === "/expert/setup" || pathname.startsWith("/expert/setup/")) ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
                  >
                    Setup
                  </Link>
                  <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />
                </div>
              </>
            ) : (
              <>
                <Link href="/bookings" onClick={closeMenu} className={dropdownItemClass}>
                  My bookings
                </Link>
                {!hasExpertProfile ? (
                  <Link href="/expert/setup" onClick={closeMenu} className={dropdownItemClass}>
                    Become an expert
                  </Link>
                ) : null}
              </>
            )}

            <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />

            <form action="/auth/signout" method="post">
              <button type="submit" onClick={closeMenu} className={dropdownItemClass}>
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
