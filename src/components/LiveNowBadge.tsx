/** Pulsing “Live now” indicator for active session windows (brand accent red). */
export function LiveNowBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent-light)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)] dark:border-[var(--color-accent)]/45 dark:bg-[var(--color-accent)]/15 dark:text-[var(--color-accent-text)]"
      aria-label="Session live now"
    >
      <span
        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--color-accent)]"
        aria-hidden
      />
      Live now
    </span>
  );
}
