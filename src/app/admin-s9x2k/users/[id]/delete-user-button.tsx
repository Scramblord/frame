"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-s9x2k/users/${userId}/delete`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Delete failed");
        setLoading(false);
        return;
      }
      router.push("/admin-s9x2k/users");
      router.refresh();
    } catch {
      setError("Delete failed");
      setLoading(false);
    }
  }

  if (confirm) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
          Are you sure? This will cancel active bookings, refund eligible payments, and permanently
          delete the account.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void performDelete()}
            disabled={loading}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Yes, delete user"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setConfirm(false);
              setError(null);
            }}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-bg)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
      >
        Delete user
      </button>
    </div>
  );
}
