"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavModeLinksProps = {
  senseiHref: string;
};

export default function NavModeLinks({ senseiHref }: NavModeLinksProps) {
  const pathname = usePathname() ?? "";
  const isSenseiMode = pathname.startsWith("/expert");

  return (
    <div className="mr-3 flex items-center gap-3 text-sm">
      <Link
        href="/dashboard"
        className={`transition hover:opacity-80 ${
          isSenseiMode ? "" : "font-semibold underline underline-offset-4"
        }`}
      >
        Student
      </Link>
      <Link
        href={senseiHref}
        className={`transition hover:opacity-80 ${
          isSenseiMode ? "font-semibold underline underline-offset-4" : ""
        }`}
      >
        Sensei
      </Link>
    </div>
  );
}
