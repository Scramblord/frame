import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
};

export default async function AdminUsersPage() {
  await requireAdminPage();
  const admin = createServiceRoleClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, user_id, full_name, created_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return <p className="text-sm text-red-600">Could not load users.</p>;
  }

  const emailByUserId = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) {
      emailByUserId.set(u.id, u.email ?? "—");
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const { data: bookingRows } = await admin.from("bookings").select("consumer_user_id");
  const consumerBookingCount = new Map<string, number>();
  for (const row of bookingRows ?? []) {
    const uid = (row as { consumer_user_id: string }).consumer_user_id;
    consumerBookingCount.set(uid, (consumerBookingCount.get(uid) ?? 0) + 1);
  }

  const rows = (profiles ?? []) as ProfileRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {rows.length} profile{rows.length === 1 ? "" : "s"}
      </p>
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Full name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Bookings (consumer)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/admin-s9x2k/users/${p.user_id}`}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    {p.full_name?.trim() || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">
                  {emailByUserId.get(p.user_id) ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">
                  {new Date(p.created_at).toLocaleString("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {consumerBookingCount.get(p.user_id) ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
