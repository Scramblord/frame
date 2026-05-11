import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatGbp } from "@/lib/experts-marketplace";
import { AdminDeleteUserButton } from "./delete-user-button";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireAdminPage();
  const { id: userId } = await params;
  if (!userId) notFound();

  const admin = createServiceRoleClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  let email = "—";
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (!authErr && authUser?.user?.email) {
    email = authUser.user.email;
  }

  const { data: consumerBookings } = await admin
    .from("bookings")
    .select(
      "id, status, session_type, total_amount, scheduled_at, created_at, service_id, expert_user_id",
    )
    .eq("consumer_user_id", userId)
    .order("created_at", { ascending: false });

  const expertIds = [
    ...new Set(
      (consumerBookings ?? [])
        .map((b) => (b as { expert_user_id: string }).expert_user_id)
        .filter(Boolean),
    ),
  ];
  const expertNames = new Map<string, string>();
  if (expertIds.length > 0) {
    const { data: expProfiles } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", expertIds);
    for (const p of expProfiles ?? []) {
      expertNames.set(
        (p as { user_id: string }).user_id,
        (p as { full_name: string | null }).full_name?.trim() || "—",
      );
    }
  }

  const serviceIds = [
    ...new Set(
      (consumerBookings ?? [])
        .map((b) => (b as { service_id: string }).service_id)
        .filter(Boolean),
    ),
  ];
  const serviceNames = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: svcs } = await admin.from("services").select("id, name").in("id", serviceIds);
    for (const s of svcs ?? []) {
      serviceNames.set((s as { id: string }).id, (s as { name: string }).name);
    }
  }

  const bookings = (consumerBookings ?? []) as Array<{
    id: string;
    status: string;
    session_type: string;
    total_amount: number | string | null;
    scheduled_at: string | null;
    created_at: string;
    service_id: string;
    expert_user_id: string;
  }>;

  return (
    <div>
      <Link
        href="/admin-s9x2k/users"
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        ← Users
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">User</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{email}</p>

      <section className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Profile
        </h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-text-muted)]">Full name</dt>
            <dd className="font-medium">{profile.full_name?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">User ID</dt>
            <dd className="break-all font-mono text-xs">{userId}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">Role</dt>
            <dd className="font-medium">{String(profile.role ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)]">Created</dt>
            <dd>
              {new Date(profile.created_at as string).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bookings as consumer</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">No bookings.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2">Sensei</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2">{expertNames.get(b.expert_user_id) ?? "—"}</td>
                    <td className="px-3 py-2">{serviceNames.get(b.service_id) ?? "—"}</td>
                    <td className="px-3 py-2">{b.session_type}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {b.total_amount != null && Number.isFinite(Number(b.total_amount))
                        ? formatGbp(Number(b.total_amount))
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{b.status}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {b.scheduled_at
                        ? new Date(b.scheduled_at).toLocaleString("en-GB", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-[var(--color-border)] pt-8">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">Danger zone</h2>
        <div className="mt-4">
          <AdminDeleteUserButton userId={userId} />
        </div>
      </section>
    </div>
  );
}
