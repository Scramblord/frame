"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const SESSION_OPTIONS: number[] = [];
for (let m = 15; m <= 8 * 60; m += 15) {
  SESSION_OPTIONS.push(m);
}

type ExpertRow = {
  bio: string | null;
  keywords: string[] | null;
  timezone: string | null;
  min_session_minutes: number | null;
  max_session_minutes: number | null;
  offers_messaging: boolean | null;
  messaging_flat_rate: number | null;
  offers_audio: boolean | null;
  offers_video: boolean | null;
  audio_hourly_rate: number | null;
  video_hourly_rate: number | null;
};

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

  const [minSession, setMinSession] = useState(30);
  const [maxSession, setMaxSession] = useState(120);

  const [offersMessaging, setOffersMessaging] = useState(false);
  const [messagingFlatRate, setMessagingFlatRate] = useState("");
  const [offersAudio, setOffersAudio] = useState(false);
  const [audioHourly, setAudioHourly] = useState("");
  const [offersVideo, setOffersVideo] = useState(false);
  const [videoHourly, setVideoHourly] = useState("");

  const sessionSelectClass =
    "mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/20";

  const minOptions = useMemo(
    () => SESSION_OPTIONS.filter((m) => m <= maxSession),
    [maxSession],
  );
  const maxOptions = useMemo(
    () => SESSION_OPTIONS.filter((m) => m >= minSession),
    [minSession],
  );

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
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "expert") {
      router.replace("/dashboard");
      return;
    }

    const { data: row } = await supabase
      .from("expert_profiles")
      .select(
        "bio, keywords, timezone, min_session_minutes, max_session_minutes, offers_messaging, messaging_flat_rate, offers_audio, offers_video, audio_hourly_rate, video_hourly_rate",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (row) {
      const r = row as ExpertRow;
      if (r.bio) setBio(r.bio);
      if (r.keywords?.length) setTags(r.keywords);
      if (r.timezone) setTimezone(r.timezone);
      if (r.min_session_minutes != null) setMinSession(r.min_session_minutes);
      if (r.max_session_minutes != null) setMaxSession(r.max_session_minutes);
      if (r.offers_messaging) {
        setOffersMessaging(true);
        if (r.messaging_flat_rate != null) {
          setMessagingFlatRate(String(r.messaging_flat_rate));
        }
      }
      if (r.offers_audio) {
        setOffersAudio(true);
        if (r.audio_hourly_rate != null) {
          setAudioHourly(String(r.audio_hourly_rate));
        }
      }
      if (r.offers_video) {
        setOffersVideo(true);
        if (r.video_hourly_rate != null) {
          setVideoHourly(String(r.video_hourly_rate));
        }
      }
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
    if (!offersMessaging && !offersAudio && !offersVideo) {
      setError("Enable at least one consultation type.");
      return;
    }

    let messagingRate: number | null = null;
    if (offersMessaging) {
      messagingRate = parseFloat(messagingFlatRate);
      if (!Number.isFinite(messagingRate) || messagingRate <= 0) {
        setError("Enter a valid flat rate for messaging (greater than 0).");
        return;
      }
    }

    let audioRate: number | null = null;
    if (offersAudio) {
      audioRate = parseFloat(audioHourly);
      if (!Number.isFinite(audioRate) || audioRate <= 0) {
        setError("Enter a valid hourly rate for audio.");
        return;
      }
    }

    let vidRate: number | null = null;
    if (offersVideo) {
      vidRate = parseFloat(videoHourly);
      if (!Number.isFinite(vidRate) || vidRate <= 0) {
        setError("Enter a valid hourly rate for video.");
        return;
      }
    }

    if (minSession > maxSession) {
      setError("Minimum session length cannot be greater than maximum.");
      return;
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

    const payload = {
      user_id: user.id,
      bio: bio.trim(),
      keywords: tags,
      timezone,
      min_session_minutes: minSession,
      max_session_minutes: maxSession,
      offers_messaging: offersMessaging,
      messaging_flat_rate: offersMessaging ? messagingRate : null,
      offers_audio: offersAudio,
      offers_video: offersVideo,
      audio_hourly_rate: offersAudio ? audioRate : null,
      video_hourly_rate: offersVideo ? vidRate : null,
    };

    const { error: saveError } = await supabase
      .from("expert_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (saveError) {
      setError(saveError.message);
      setSubmitting(false);
      return;
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
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-zinc-900 bg-zinc-900 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
            <span className="font-mono text-[10px] font-bold tracking-[0.2em]">
              FR
            </span>
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

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
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

            <div>
              <label
                htmlFor="minSession"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Minimum session length
              </label>
              <select
                id="minSession"
                value={minSession}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinSession(v);
                  if (v > maxSession) setMaxSession(v);
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
              <label
                htmlFor="maxSession"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Maximum session length
              </label>
              <select
                id="maxSession"
                value={maxSession}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxSession(v);
                  if (v < minSession) setMinSession(v);
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

          <fieldset>
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Consultation types offered
            </legend>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Enable one or more. Set pricing for each type you offer.
            </p>
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-xl border px-4 py-4 transition ${
                  offersMessaging
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/80"
                    : "border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900/50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={offersMessaging}
                    onChange={(e) => setOffersMessaging(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Messaging
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      Live in-app messaging — flat fee per session
                    </span>
                    {offersMessaging ? (
                      <div className="mt-3">
                        <label
                          htmlFor="messagingFlat"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Flat rate (GBP)
                        </label>
                        <input
                          id="messagingFlat"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={messagingFlatRate}
                          onChange={(e) => setMessagingFlatRate(e.target.value)}
                          placeholder="£49.00"
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </div>
                    ) : null}
                  </span>
                </label>
              </div>

              <div
                className={`rounded-xl border px-4 py-4 transition ${
                  offersAudio
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/80"
                    : "border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900/50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={offersAudio}
                    onChange={(e) => setOffersAudio(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Audio
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      Voice sessions — priced per hour
                    </span>
                    {offersAudio ? (
                      <div className="mt-3">
                        <label
                          htmlFor="audioHourly"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Hourly rate (GBP)
                        </label>
                        <input
                          id="audioHourly"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={audioHourly}
                          onChange={(e) => setAudioHourly(e.target.value)}
                          placeholder="£120.00"
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </div>
                    ) : null}
                  </span>
                </label>
              </div>

              <div
                className={`rounded-xl border px-4 py-4 transition ${
                  offersVideo
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/80"
                    : "border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900/50"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={offersVideo}
                    onChange={(e) => setOffersVideo(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Video
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      Video calls — priced per hour
                    </span>
                    {offersVideo ? (
                      <div className="mt-3">
                        <label
                          htmlFor="videoHourly"
                          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                        >
                          Hourly rate (GBP)
                        </label>
                        <input
                          id="videoHourly"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={videoHourly}
                          onChange={(e) => setVideoHourly(e.target.value)}
                          placeholder="£150.00"
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        />
                      </div>
                    ) : null}
                  </span>
                </label>
              </div>
            </div>
          </fieldset>

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
