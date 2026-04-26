"use client";

import { usePathname, useRouter } from "next/navigation";

type NavModeLinksProps = {
  senseiHref: string;
};

export default function NavModeLinks({ senseiHref }: NavModeLinksProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isSenseiMode = pathname.startsWith("/expert");
  const optionClass = "rounded-full px-4 py-1.5 text-sm font-medium transition";

  return (
    <div className="mr-3 inline-flex rounded-full border border-[var(--color-border)] bg-transparent p-0.5">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className={`${optionClass} ${
          isSenseiMode
            ? "bg-transparent text-[var(--color-navbar-dark-muted)]"
            : "bg-white text-[var(--color-text)]"
        }`}
      >
        Student
      </button>
      <button
        type="button"
        onClick={() => router.push(senseiHref)}
        className={`${optionClass} ${
          isSenseiMode
            ? "bg-white text-[var(--color-navbar-dark)]"
            : "bg-transparent text-[var(--color-text-muted)]"
        }`}
      >
        Sensei
      </button>
    </div>
  );
}
