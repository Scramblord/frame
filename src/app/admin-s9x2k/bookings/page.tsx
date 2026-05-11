import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatGbp } from "@/lib/experts-marketplace";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  await requireAdminPage();
  const admin = createServiceRoleClient();

  const { data: rows, error } = await admin
    .from("bookings")
    .select(
      "id, consumer_user_id, expert_user_id, service_id, session_type, total_amount, status, scheduled_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-sm text-red-600">Could not load bookings.</p>;
  }

  const list = rows ?? [];
  const userIds = [...new Set(list.flatMap((b) => [b.consumer_user_id, b.expert_user_id] as string[]))];
  const serviceIds = [...new Set(list.map((b) => b.service_id as string))];

  const nameByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      nameByUser.set(
        (p as { user_id: string }).user_id,
        (p as { full_name: string | null }).full_name?.trim() || "—",
      );
    }
  }

  const serviceName = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await admin.from("services").select("id, name").in("id", serviceIds);
    for (const s of services ?? []) {
      serviceName.set((s as { id: string }).id, (s as { name: string }).name);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {list.length} booking{list.length === 1 ? "" : "s"}
      </p>
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Consumer</th>
              <th className="px-4 py-3">Sensei</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3"> </th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => {
              const bid = b.id as string;
              const consumer = b.consumer_user_id as string;
              const expert = b.expert_user_id as string;
              const sid = b.service_id as string;
              const amt = b.total_amount != null ? Number(b.total_amount) : null;
              return (
                <tr
                  key={bid}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]"
                >
                  <td className="px-4 py-3">{nameByUser.get(consumer) ?? "—"}</td>
                  <td className="px-4 py-3">{nameByUser.get(expert) ?? "—"}</td>
                  <td className="px-4 py-3">{serviceName.get(sid) ?? "—"}</td>
                  <td className="px-4 py-3">{String(b.session_type)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {amt != null && Number.isFinite(amt) ? formatGbp(amt) : "—"}
                  </td>
                  <td className="px-4 py-3">{String(b.status)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {b.scheduled_at
                      ? new Date(b.scheduled_at as string).toLocaleString("en-GB", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin-s9x2k/bookings/${bid}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
