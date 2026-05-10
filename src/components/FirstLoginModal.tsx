"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sensei_terms_accepted";

export default function FirstLoginModal() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const accepted = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
      setOpen(!accepted);
    } catch {
      setOpen(true);
    }
  }, []);

  const acknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore quota / private mode */
    }
    setOpen(false);
  };

  if (!mounted || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 pb-8 sm:items-center sm:p-6"
      aria-modal="true"
      role="dialog"
      aria-labelledby="first-login-modal-title"
      aria-describedby="first-login-modal-desc"
    >
      {/* Backdrop — no click handler; user must use the button */}
      <div className="absolute inset-0" aria-hidden />

      <div
        className="relative z-[1] w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 shadow-[var(--shadow-md)] sm:px-6 sm:py-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-center gap-2">
          <Image
            src="/Asset 4@3x.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-auto shrink-0"
          />
          <Image
            src="/Asset 5@3x.png"
            alt="Sensei"
            width={132}
            height={20}
            className="h-5 w-auto shrink-0"
          />
        </div>

        <h2
          id="first-login-modal-title"
          className="text-center text-xl font-bold tracking-tight text-[var(--color-text)] sm:text-2xl"
        >
          Welcome to Sensei
        </h2>
        <p
          id="first-login-modal-desc"
          className="mt-3 text-center text-sm leading-relaxed text-[var(--color-text-muted)]"
        >
          Before you get started, please read and acknowledge the following.
        </p>

        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-[var(--color-text)]">
          <li>
            Sensei is a booking platform. We do not employ or endorse any Sensei listed here.
          </li>
          <li>You must be 18 or over to use this platform.</li>
          <li>You agree not to use Sensei for any illegal activity.</li>
          <li>
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </li>
        </ul>

        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-accent-hover)]"
          onClick={acknowledge}
        >
          I understand, let&apos;s go
        </button>
      </div>
    </div>
  );
}
