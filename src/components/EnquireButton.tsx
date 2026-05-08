"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EnquireButtonProps = {
  serviceId: string;
  className?: string;
};

export default function EnquireButton({
  serviceId,
  className,
}: EnquireButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = (await res.json()) as {
        enquiry?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.enquiry?.id) {
        throw new Error(json.error ?? "Could not create enquiry");
      }
      router.push(`/enquiries/${json.enquiry.id}`);
    } catch (error) {
      console.error("[sensei:enquire]", error);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      }
    >
      {loading ? "Creating..." : "Enquire"}
    </button>
  );
}
