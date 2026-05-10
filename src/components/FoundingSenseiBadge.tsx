type FoundingSenseiBadgeProps = {
  size?: "sm" | "md";
  className?: string;
};

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

const sizeStyles = {
  sm: {
    wrap: "gap-1 px-2 py-0.5 text-[10px] leading-tight sm:text-xs",
    icon: "h-3 w-3 shrink-0",
  },
  md: {
    wrap: "gap-1.5 px-3 py-1 text-xs sm:text-sm",
    icon: "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
  },
} as const;

/** Gold/amber “Founding Sensei” badge — Airbnb Superhost–style accent. */
export function FoundingSenseiBadge({
  size = "sm",
  className = "",
}: FoundingSenseiBadgeProps) {
  const s = sizeStyles[size];
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-50 to-amber-100/90 font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200/60 dark:border-amber-500/35 dark:from-amber-950/60 dark:to-amber-900/40 dark:text-amber-100 dark:ring-amber-700/40 ${s.wrap} ${className}`.trim()}
    >
      <StarIcon className={s.icon} />
      <span className="truncate">Founding Sensei</span>
    </span>
  );
}
