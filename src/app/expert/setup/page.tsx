"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const SESSION_OPTIONS: number[] = [];
for (let m = 15; m <= 8 * 60; m += 15) {
  SESSION_OPTIONS.push(m);
}

function newClientKey() {
  return `svc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ServiceForm = {
  clientKey: string;
  id?: string;
  name: string;
  description: string;
  min_session_minutes: number;
  max_session_minutes: number;
  offers_messaging: boolean;
  messaging_flat_rate: string;
  offers_audio: boolean;
  audio_hourly_rate: string;
  offers_video: boolean;
  video_hourly_rate: string;
};

function emptyService(): ServiceForm {
  return {
    clientKey: newClientKey(),
    name: "",
    description: "",
    min_session_minutes: 30,
    max_session_minutes: 120,
    offers_messaging: false,
    messaging_flat_rate: "",
    offers_audio: false,
    audio_hourly_rate: "",
    offers_video: false,
    video_hourly_rate: "",
  };
}

export default function ExpertSetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timezones, setTimezones] = useState<string[]>(["UTC"]);

  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [timezone, setTimezone] = useState("");

  const [services, setServices] = useState<ServiceForm[]>([emptyService()]);

  const sessionSelectClass =
    "mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/20";

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      router.replace("/onboarding");
      return;
    }

    const { data: row } = await supabase
      .from("expert_profiles")
      .select("bio, keywords, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (row) {
      if (row.bio) setBio(row.bio);
      if (row.keywords?.length) setTags(row.keywords);
      if (row.timezone) setTimezone(row.timezone);
    }

    const { data: serviceRows } = await supabase
      .from("services")
      .select("*")
      .eq("expert_user_id", user.id)
      .order("created_at", { ascending: true });

    if (serviceRows?.length) {
      setServices(
        serviceRows.map((r) => ({
          clientKey: newClientKey(),
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          min_session_minutes: r.min_session_minutes,
          max_session_minutes: r.max_session_minutes,
          offers_messaging: r.offers_messaging,
          messaging_flat_rate:
            r.messaging_flat_rate != null ? String(r.messaging_flat_rate) : "",
          offers_audio: r.offers_audio,
          audio_hourly_rate:
            r.audio_hourly_rate != null ? String(r.audio_hourly_rate) : "",
          offers_video: r.offers_video,
          video_hourly_rate:
            r.video_hourly_rate != null ? String(r.video_hourly_rate) : "",
        })),
      );
    }

    try {
      setTimezones(Intl.supportedValuesOf("timeZone"));
    } catch {
      setTimezones(["UTC"]);
    }

    if (!row?.timezone) {
      const guess =
        typeof Intl.DateTimeFormat().resolvedOptions().timeZone === "string"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC";
      setTimezone((t) => t || guess);
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  function formatMinutesLabel(m: number) {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (rem === 0) return `${h} hr`;
    return `${h} hr ${rem} min`;
  }

  function updateService(
    clientKey: string,
    patch: Partial<ServiceForm>,
  ) {
    setServices((prev) =>
      prev.map((s) => (s.clientKey === clientKey ? { ...s, ...patch } : s)),
    );
  }

  function addService() {
    setServices((prev) => [...prev, emptyService()]);
  }

  function removeService(clientKey: string) {
    setServices((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.clientKey !== clientKey),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!bio.trim()) {
      setError("Please add a short bio.");
      return;
    }
    if (!timezone) {
      setError("Please select your timezone.");
      return;
    }

    if (services.length === 0) {
      setError("Add at least one service.");
      return;
    }

    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      const label = `Service ${i + 1}`;
      if (!s.name.trim()) {
        setError(`${label}: enter a service name.`);
        return;
      }
      if (!s.offers_messaging && !s.offers_audio && !s.offers_video) {
        setError(`${label}: enable at least one consultation type.`);
        return;
      }
      if (s.offers_messaging) {
        const v = parseFloat(s.messaging_flat_rate);
        if (!Number.isFinite(v) || v <= 0) {
          setError(`${label}: enter a valid messaging flat rate (GBP).`);
          return;
        }
      }
      if (s.offers_audio) {
        const v = parseFloat(s.audio_hourly_rate);
        if (!Number.isFinite(v) || v <= 0) {
          setError(`${label}: enter a valid audio hourly rate (GBP).`);
          return;
        }
      }
      if (s.offers_video) {
        const v = parseFloat(s.video_hourly_rate);
        if (!Number.isFinite(v) || v <= 0) {
          setError(`${label}: enter a valid video hourly rate (GBP).`);
          return;
        }
      }
      if (s.min_session_minutes > s.max_session_minutes) {
        setError(`${label}: minimum session length cannot exceed maximum.`);
        return;
      }
    }

    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      setSubmitting(false);
      return;
    }

    const { data: existingEp } = await supabase
      .from("expert_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profilePayload = {
      bio: bio.trim(),
      keywords: tags,
      timezone,
    };

    if (existingEp) {
      const { error: upErr } = await supabase
        .from("expert_profiles")
        .update(profilePayload)
        .eq("user_id", user.id);
      if (upErr) {
        setError(upErr.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("expert_profiles").insert({
        user_id: user.id,
        ...profilePayload,
      });
      if (insErr) {
        setError(insErr.message);
        setSubmitting(false);
        return;
      }
    }

    const keptIds = services.map((s) => s.id).filter(Boolean) as string[];
    const { data: existingSvc } = await supabase
      .from("services")
      .select("id")
      .eq("expert_user_id", user.id);

    const toDelete =
      (existingSvc ?? [])
        .map((r) => r.id)
        .filter((id) => !keptIds.includes(id)) ?? [];

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("services")
        .delete()
        .in("id", toDelete);
      if (delErr) {
        setError(delErr.message);
        setSubmitting(false);
        return;
      }
    }

    for (const s of services) {
      const row = {
        expert_user_id: user.id,
        name: s.name.trim(),
        description: s.description.trim() || null,
        min_session_minutes: s.min_session_minutes,
        max_session_minutes: s.max_session_minutes,
        offers_messaging: s.offers_messaging,
        messaging_flat_rate: s.offers_messaging
          ? parseFloat(s.messaging_flat_rate)
          : null,
        offers_audio: s.offers_audio,
        audio_hourly_rate: s.offers_audio
          ? parseFloat(s.audio_hourly_rate)
          : null,
        offers_video: s.offers_video,
        video_hourly_rate: s.offers_video
          ? parseFloat(s.video_hourly_rate)
          : null,
        is_active: true,
      };

      if (s.id) {
        const { error: u } = await supabase
          .from("services")
          .update(row)
          .eq("id", s.id)
          .eq("expert_user_id", user.id);
        if (u) {
          setError(u.message);
          setSubmitting(false);
          return;
        }
      } else {
        const { error: ins } = await supabase.from("services").insert(row);
        if (ins) {
          setError(ins.message);
          setSubmitting(false);
          return;
        }
      }
    }

    router.replace("/expert/dashboard");
  }

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-full flex-1 overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900 sm:px-6 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(113 113 122 / 0.35) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img
              src="/logo.png"
              alt=""
              className="h-12 w-auto"
              width={87}
              height={48}
            />
          </div>
          <h1 className="font-mono text-3xl font-bold tracking-[0.35em] text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            FRAME
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Expert profile setup
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/40 sm:p-8"
        >
          <div>
            <label
              htmlFor="bio"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you do, who you help, and what clients can expect…"
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/20"
            />
          </div>

          <div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Keywords & specialities
            </span>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Add tags; press Enter to save each one.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-2.5 pr-1 text-xs font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="e.g. career coaching"
                className="min-w-[10rem] flex-1 border-0 bg-transparent py-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={sessionSelectClass}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-zinc-200 pt-8 dark:border-zinc-700">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Your services
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Add one or more offerings — each can have its own session length
              and pricing.
            </p>

            <div className="mt-6 space-y-8">
              {services.map((s, idx) => (
                <ServiceFields
                  key={s.clientKey}
                  index={idx}
                  s={s}
                  sessionSelectClass={sessionSelectClass}
                  minOptions={SESSION_OPTIONS.filter(
                    (m) => m <= s.max_session_minutes,
                  )}
                  maxOptions={SESSION_OPTIONS.filter(
                    (m) => m >= s.min_session_minutes,
                  )}
                  formatMinutesLabel={formatMinutesLabel}
                  onChange={(patch) => updateService(s.clientKey, patch)}
                  onRemove={() => removeService(s.clientKey)}
                  canRemove={services.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addService}
              className="mt-6 w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-zinc-500"
            >
              Add another service
            </button>
          </div>

          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ServiceFields({
  index,
  s,
  sessionSelectClass,
  minOptions,
  maxOptions,
  formatMinutesLabel,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  s: ServiceForm;
  sessionSelectClass: string;
  minOptions: number[];
  maxOptions: number[];
  formatMinutesLabel: (m: number) => string;
  onChange: (patch: Partial<ServiceForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-600 dark:bg-zinc-800/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Service {index + 1}
        </h3>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Service name
        </label>
        <input
          type="text"
          value={s.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. BJJ Coaching"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          rows={3}
          value={s.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this service includes…"
          className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Min session length
          </label>
          <select
            value={s.min_session_minutes}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > s.max_session_minutes) {
                onChange({ min_session_minutes: v, max_session_minutes: v });
              } else {
                onChange({ min_session_minutes: v });
              }
            }}
            className={sessionSelectClass}
          >
            {minOptions.map((m) => (
              <option key={m} value={m}>
                {formatMinutesLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Max session length
          </label>
          <select
            value={s.max_session_minutes}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v < s.min_session_minutes) {
                onChange({ max_session_minutes: v, min_session_minutes: v });
              } else {
                onChange({ max_session_minutes: v });
              }
            }}
            className={sessionSelectClass}
          >
            {maxOptions.map((m) => (
              <option key={m} value={m}>
                {formatMinutesLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Consultation types & pricing (GBP £)
        </legend>
        <div className="mt-3 space-y-3">
          <div
            className={`rounded-xl border px-4 py-3 ${
              s.offers_messaging
                ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                : "border-zinc-200 bg-white/60 dark:border-zinc-600"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={s.offers_messaging}
                onChange={(e) => onChange({ offers_messaging: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span className="flex-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Messaging
                </span>
                {s.offers_messaging ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={s.messaging_flat_rate}
                    onChange={(e) =>
                      onChange({ messaging_flat_rate: e.target.value })
                    }
                    placeholder="Flat rate"
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                ) : null}
              </span>
            </label>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 ${
              s.offers_audio
                ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                : "border-zinc-200 bg-white/60 dark:border-zinc-600"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={s.offers_audio}
                onChange={(e) => onChange({ offers_audio: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span className="flex-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Audio (hourly)
                </span>
                {s.offers_audio ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={s.audio_hourly_rate}
                    onChange={(e) =>
                      onChange({ audio_hourly_rate: e.target.value })
                    }
                    placeholder="£ / hour"
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                ) : null}
              </span>
            </label>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 ${
              s.offers_video
                ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                : "border-zinc-200 bg-white/60 dark:border-zinc-600"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={s.offers_video}
                onChange={(e) => onChange({ offers_video: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span className="flex-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Video (hourly)
                </span>
                {s.offers_video ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={s.video_hourly_rate}
                    onChange={(e) =>
                      onChange({ video_hourly_rate: e.target.value })
                    }
                    placeholder="£ / hour"
                    className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                ) : null}
              </span>
            </label>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
