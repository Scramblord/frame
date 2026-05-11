import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-s9x2k/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatGbp } from "@/lib/experts-marketplace";
import { AdminBookingActions } from "./admin-booking-actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBookingDetailPage({ params }: PageProps) {
  await requireAdminPage();
  const { id: bookingId } = await params;
  if (!bookingId) notFound();

  const admin = createServiceRoleClient();
  const { data: booking, error } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();

  if (error || !booking) {
    notFound();
  }

  const b = booking as Record<string, unknown>;
  const consumerId = b.consumer_user_id as string;
  const expertId = b.expert_user_id as string;
  const serviceId = b.service_id as string;
  const status = String(b.status ?? "");
  const pi = typeof b.stripe_payment_intent_id === "string" ? b.stripe_payment_intent_id.trim() : "";

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", [consumerId, expertId]);

  const names = new Map<string, string>();
  for (const p of profiles ?? []) {
    names.set(
      (p as { user_id: string }).user_id,
      (p as { full_name: string | null }).full_name?.trim() || "—",
    );
  }

  const { data: svc } = await admin.from("services").select("name").eq("id", serviceId).maybeSingle();
  const serviceName = (svc as { name?: string } | null)?.name ?? "—";

  const terminal = status === "cancelled" || status === "completed" || status === "no_show";
  const canForceCancel = !terminal;
  const canForceRefund = Boolean(pi);

  return (
    <div>
      <Link
        href="/admin-s9x2k/bookings"
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        ← Bookings
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Booking</h1>
      <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{bookingId}</p>

      <dl className="mt-8 grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-text-muted)]">Consumer</dt>
          <dd className="font-medium">{names.get(consumerId) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Sensei</dt>
          <dd className="font-medium">{names.get(expertId) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Service</dt>
          <dd>{serviceName}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Session type</dt>
          <dd>{String(b.session_type)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Status</dt>
          <dd className="font-semibold">{status}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Total amount</dt>
          <dd className="tabular-nums">
            {b.total_amount != null && Number.isFinite(Number(b.total_amount))
              ? formatGbp(Number(b.total_amount))
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Scheduled</dt>
          <dd>
            {b.scheduled_at
              ? new Date(b.scheduled_at as string).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Created</dt>
          <dd>
            {b.created_at
              ? new Date(b.created_at as string).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--color-text-muted)]">Stripe payment intent</dt>
          <dd className="break-all font-mono text-xs">{pi || "—"}</dd>
        </div>
      </dl>

      <AdminBookingActions
        bookingId={bookingId}
        canForceCancel={canForceCancel}
        canForceRefund={canForceRefund}
      />
    </div>
  );
}
