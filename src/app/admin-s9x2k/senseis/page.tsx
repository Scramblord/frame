import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminSenseisPage() {
  await requireAdminPage();
  const admin = createServiceRoleClient();

  const { data: foundingRows } = await admin
    .from("expert_profiles")
    .select("user_id")
    .eq("stripe_onboarding_complete", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);

  const foundingSet = new Set(
    (foundingRows ?? []).map((r) => r.user_id as string).filter(Boolean),
  );

  const { data: experts, error } = await admin
    .from("expert_profiles")
    .select("id, user_id, stripe_onboarding_complete, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-sm text-red-600">Could not load Senseis.</p>;
  }

  const expertList = experts ?? [];
  const userIds = expertList.map((e) => e.user_id as string);

  if (userIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Senseis</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">No expert profiles.</p>
      </div>
    );
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, user_id, full_name")
    .in("user_id", userIds);

  const nameByUser = new Map<string, string>();
  const publicProfileIdByUser = new Map<string, string>();
  for (const p of profiles ?? []) {
    const row = p as { id: string; user_id: string; full_name: string | null };
    nameByUser.set(row.user_id, row.full_name?.trim() || "—");
    publicProfileIdByUser.set(row.user_id, row.id);
  }

  const { data: services } = await admin.from("services").select("expert_user_id").in("expert_user_id", userIds);

  const serviceCount = new Map<string, number>();
  for (const s of services ?? []) {
    const uid = (s as { expert_user_id: string }).expert_user_id;
    serviceCount.set(uid, (serviceCount.get(uid) ?? 0) + 1);
  }

  const { data: bookingExpertRows } = await admin
    .from("bookings")
    .select("expert_user_id")
    .in("expert_user_id", userIds);

  const bookingCount = new Map<string, number>();
  for (const r of bookingExpertRows ?? []) {
    const uid = (r as { expert_user_id: string }).expert_user_id;
    bookingCount.set(uid, (bookingCount.get(uid) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Senseis</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {expertList.length} expert profile{expertList.length === 1 ? "" : "s"}
      </p>
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Full name</th>
              <th className="px-4 py-3">Stripe onboarded</th>
              <th className="px-4 py-3">Founding</th>
              <th className="px-4 py-3 text-right">Services</th>
              <th className="px-4 py-3 text-right">Bookings (expert)</th>
              <th className="px-4 py-3">Public profile</th>
            </tr>
          </thead>
          <tbody>
            {expertList.map((e) => {
              const uid = e.user_id as string;
              const publicProfileId = publicProfileIdByUser.get(uid);
              const founding = foundingSet.has(uid);
              return (
                <tr
                  key={e.id as string}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]"
                >
                  <td className="px-4 py-3 font-medium">{nameByUser.get(uid) ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.stripe_onboarding_complete ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Yes</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {founding ? (
                      <span className="rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text)]">
                        Founding
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {serviceCount.get(uid) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {bookingCount.get(uid) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {publicProfileId ? (
                      <Link
                        href={`/experts/${publicProfileId}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        View →
                      </Link>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
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
