"use client";

import { usePathname, useRouter } from "next/navigation";

type NavModeLinksProps = {
  senseiHref: string;
};

export default function NavModeLinks({ senseiHref }: NavModeLinksProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isSenseiMode = pathname.startsWith("/expert");
  const optionClass =
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 transition-all duration-200";

  return (
    <div
      className={`mr-3 inline-flex rounded-full border p-0.5 ${
        isSenseiMode
          ? "border-white/20 bg-white/5"
          : "border-[var(--color-border-strong)] bg-transparent"
      }`}
    >
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className={`${optionClass} ${
          isSenseiMode
            ? "bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
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
            : "bg-transparent text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text)]"
        }`}
      >
        Sensei
      </button>
    </div>
  );
}
