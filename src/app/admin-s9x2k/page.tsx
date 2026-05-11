import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatGbp } from "@/lib/experts-marketplace";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const admin = createServiceRoleClient();

  const [
    { count: userCount },
    { count: senseiCount },
    { count: bookingCount },
    { data: revenueRows },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("expert_profiles")
      .select("*", { count: "exact", head: true })
      .eq("stripe_onboarding_complete", true),
    admin.from("bookings").select("*", { count: "exact", head: true }),
    admin.from("bookings").select("total_amount").eq("status", "completed"),
  ]);

  let revenueGbp = 0;
  for (const row of revenueRows ?? []) {
    const n = Number((row as { total_amount: unknown }).total_amount);
    if (Number.isFinite(n)) revenueGbp += n;
  }

  const cards = [
    { label: "Total users", value: String(userCount ?? 0) },
    { label: "Active Senseis", value: String(senseiCount ?? 0) },
    { label: "Total bookings", value: String(bookingCount ?? 0) },
    { label: "Total revenue (completed)", value: formatGbp(revenueGbp) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Marketplace stats</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li
            key={c.label}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
