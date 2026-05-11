import Link from "next/link";
import Image from "next/image";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";

const base = "/admin-s9x2k";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href={base} className="flex items-center gap-2">
            <Image
              src="/Asset 4@3x.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-sm font-semibold tracking-tight">Admin</span>
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">
            <Link
              href={base}
              className="rounded-lg px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              Overview
            </Link>
            <Link
              href={`${base}/users`}
              className="rounded-lg px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              Users
            </Link>
            <Link
              href={`${base}/senseis`}
              className="rounded-lg px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              Senseis
            </Link>
            <Link
              href={`${base}/bookings`}
              className="rounded-lg px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              Bookings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
