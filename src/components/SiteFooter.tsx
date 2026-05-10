import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-[var(--color-border)] bg-[var(--color-surface)] py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-center sm:px-6">
        <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] sm:text-xs">
          Sensei is a booking platform. We do not employ or endorse any Sensei listed on the
          platform.
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] sm:text-xs">
          © 2026 Sensei. All rights reserved.{" "}
          <Link
            href="/terms"
            className="text-[var(--color-text)] underline-offset-2 hover:underline"
          >
            Terms
          </Link>
          {" · "}
          <Link
            href="/privacy"
            className="text-[var(--color-text)] underline-offset-2 hover:underline"
          >
            Privacy
          </Link>
        </p>
      </div>
    </footer>
  );
}
