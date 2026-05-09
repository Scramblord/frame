"use client";

import AvatarUpload from "@/components/AvatarUpload";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type SettingsFormProps = {
  userId: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
};

function initialsFromDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsForm({
  userId,
  initialFullName,
  initialAvatarUrl,
}: SettingsFormProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [displayName, setDisplayName] = useState(initialFullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const onAvatarUploaded = useCallback(
    (url: string) => {
      setAvatarUrl(url);
      router.refresh();
    },
    [router],
  );

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    setNameSaving(true);
    setNameFeedback(null);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmed || null })
      .eq("user_id", userId);

    setNameSaving(false);

    if (error) {
      setNameFeedback({
        tone: "error",
        message: error.message || "Could not save your name.",
      });
      return;
    }

    setNameFeedback({
      tone: "success",
      message: "Display name saved.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Profile photo</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Shown in the navigation bar and anywhere your profile appears.
        </p>
        <div className="mt-5">
          <AvatarUpload
            userId={userId}
            currentAvatarUrl={avatarUrl}
            currentInitials={initialsFromDisplayName(displayName)}
            onUploadComplete={onAvatarUploaded}
          />
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Display name</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          How you appear to Senseis and other members.
        </p>
        <form onSubmit={saveDisplayName} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="settings-display-name" className="sr-only">
              Display name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-base text-[var(--color-text)] outline-none ring-0 transition placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
              placeholder="Your name"
            />
          </div>
          <button
            type="submit"
            disabled={nameSaving}
            className="shrink-0 rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {nameSaving ? "Saving…" : "Save"}
          </button>
        </form>
        {nameFeedback ? (
          <p
            className={
              nameFeedback.tone === "success"
                ? "mt-3 text-sm font-medium text-emerald-700"
                : "mt-3 text-sm font-medium text-red-600"
            }
            role="status"
          >
            {nameFeedback.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
