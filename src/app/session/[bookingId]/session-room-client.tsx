"use client";

import DailyIframe from "@daily-co/daily-js";
import type { DailyCall } from "@daily-co/daily-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type JoinPayload = {
  token: string;
  roomUrl: string;
  roomName: string;
  participantName: string;
  otherParticipantName: string;
  isOwner: boolean;
  durationMinutes: number;
  scheduledAt: string;
};

type Props = { bookingId: string; exitHref: string };

export function SessionRoomClient({ bookingId, exitHref }: Props) {
  const router = useRouter();
  const callObjectRef = useRef<DailyCall | null>(null);
  const userClosedRef = useRef(false);
  /** Set only after POST /api/session/complete succeeds — avoids silent failure + blocked retries. */
  const completionDoneRef = useRef(false);
  const completionInFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingSec, setRemainingSec] = useState(0);
  const [remoteInRoom, setRemoteInRoom] = useState(false);
  const [remoteHadJoined, setRemoteHadJoined] = useState(false);
  const [quality, setQuality] = useState<"good" | "poor" | "—">("—");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [otherLabel, setOtherLabel] = useState("Participant");
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });
  const pipDragState = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const completeSession = useCallback(
    async (reason: string) => {
      if (completionDoneRef.current || completionInFlightRef.current) {
        console.log(
          "[frame:session-complete] skip (already done or in flight)",
          { reason, bookingId, done: completionDoneRef.current },
        );
        return;
      }
      completionInFlightRef.current = true;
      console.log("[frame:session-complete] starting POST /api/session/complete", {
        reason,
        bookingId,
        at: new Date().toISOString(),
      });
      try {
        const res = await fetch("/api/session/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const raw = await res.text();
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = raw;
        }
        console.log("[frame:session-complete] response", {
          reason,
          bookingId,
          ok: res.ok,
          status: res.status,
          body: parsed,
        });
        if (res.ok) {
          completionDoneRef.current = true;
        } else {
          console.warn(
            "[frame:session-complete] completion failed (will not mark done; may retry)",
            { reason, bookingId, status: res.status, body: parsed },
          );
        }
      } catch (e) {
        console.error("[frame:session-complete] fetch error", {
          reason,
          bookingId,
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        completionInFlightRef.current = false;
      }
    },
    [bookingId],
  );

  const leaveRoom = useCallback(async () => {
    console.log(
      "[frame:session-complete] leaveRoom (user left voluntarily) — userClosed set; left-meeting will not auto-complete",
      { bookingId },
    );
    const co = callObjectRef.current;
    if (co) {
      userClosedRef.current = true;
      await co.leave();
      co.destroy();
      callObjectRef.current = null;
    }
    router.push(exitHref);
  }, [bookingId, exitHref, router]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const cr = await fetch("/api/session/create-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        if (!cr.ok) {
          const j = (await cr.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not create room");
        }

        const jt = await fetch("/api/session/join-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        if (!jt.ok) {
          const j = (await jt.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Could not join session");
        }

        const data = (await jt.json()) as JoinPayload;
        if (cancelled) return;
        setOtherLabel(data.otherParticipantName);

        const callObject = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        callObjectRef.current = callObject;

        function refreshRemotePresence() {
          const parts = callObject.participants();
          const hasRemote = Object.values(parts).some((p) => !p.local);
          setRemoteInRoom(hasRemote);
          if (hasRemote) setRemoteHadJoined(true);
        }

        callObject.on("joined-meeting", () => {
          refreshRemotePresence();
        });

        callObject.on("participant-joined", (ev) => {
          if (!ev.participant?.local) {
            setRemoteInRoom(true);
            setRemoteHadJoined(true);
          }
        });

        callObject.on("participant-left", (ev) => {
          if (!ev.participant?.local) {
            setRemoteInRoom(false);
          }
        });

        callObject.on("track-started", (ev) => {
          if (!ev.participant || ev.track.kind !== "video") return;
          const el = ev.participant.local
            ? localVideoRef.current
            : remoteVideoRef.current;
          if (el && ev.track) {
            el.srcObject = new MediaStream([ev.track]);
            void el.play();
          }
        });

        callObject.on("network-quality-change", (ev) => {
          const ns = ev.networkState;
          if (ns === "good") setQuality("good");
          else if (ns === "bad" || ns === "warning") setQuality("poor");
          else setQuality("—");
        });

        callObject.on("left-meeting", () => {
          if (userClosedRef.current) {
            console.log(
              "[frame:session-complete] left-meeting (user had left voluntarily, skipped)",
              { bookingId },
            );
            return;
          }
          const scheduledMs = new Date(data.scheduledAt).getTime();
          const durMs = data.durationMinutes * 60 * 1000;
          const elapsed = Date.now() - scheduledMs;
          const endMs = scheduledMs + durMs;
          console.log("[frame:session-complete] left-meeting event", {
            bookingId,
            scheduledAt: data.scheduledAt,
            durationMinutes: data.durationMinutes,
            elapsedMs: elapsed,
            elapsedRatio: durMs > 0 ? elapsed / durMs : 0,
            endMsIso: new Date(endMs).toISOString(),
            willComplete: elapsed >= 0.8 * durMs,
          });
          if (elapsed >= 0.8 * durMs) {
            void completeSession("left-meeting");
          } else {
            console.log(
              "[frame:session-complete] left-meeting below 80% elapsed, not calling complete",
              { bookingId },
            );
          }
        });

        await callObject.join({
          url: data.roomUrl,
          token: data.token,
        });

        await callObject.setLocalVideo(true);
        await callObject.setLocalAudio(true);

        const endMs =
          new Date(data.scheduledAt).getTime() +
          data.durationMinutes * 60 * 1000;

        const tick = () => {
          const rem = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
          setRemainingSec(rem);
          if (rem <= 0) {
            console.log("[frame:session-complete] timer hit zero", {
              bookingId,
              endMsIso: new Date(endMs).toISOString(),
              nowIso: new Date().toISOString(),
              scheduledAt: data.scheduledAt,
              durationMinutes: data.durationMinutes,
            });
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            if (!completionDoneRef.current && !completionInFlightRef.current) {
              void completeSession("timer-zero").then(() => {
                void callObject.leave().then(() => {
                  callObject.destroy();
                  router.push(exitHref);
                });
              });
            } else {
              console.log(
                "[frame:session-complete] timer-zero skip complete (already done or in flight), still leaving room",
                { bookingId },
              );
              void callObject.leave().then(() => {
                callObject.destroy();
                router.push(exitHref);
              });
            }
          }
        };
        tick();
        timerRef.current = setInterval(tick, 1000);

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not start session");
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const co = callObjectRef.current;
      if (co) {
        co.destroy();
        callObjectRef.current = null;
      }
    };
  }, [bookingId, completeSession, exitHref, router]);

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const timeLabel = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const timerColor =
    remainingSec <= 60
      ? "text-red-400"
      : remainingSec <= 300
        ? "text-amber-400"
        : "text-white";

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-white"
        >
          FRAME
        </Link>
        <div className={`font-mono text-lg tabular-nums ${timerColor}`}>
          {loading ? "—:—" : timeLabel}
        </div>
        <div className="text-xs text-zinc-400">
          {quality === "—" ? "…" : `Connection: ${quality}`}
        </div>
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <Link
            href={exitHref}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900"
          >
            Back to booking
          </Link>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1 bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            {!remoteInRoom && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <p className="animate-pulse text-center text-sm text-zinc-300">
                  {remoteHadJoined
                    ? `Waiting for ${otherLabel} to rejoin…`
                    : `${otherLabel} has not joined yet`}
                </p>
              </div>
            )}
            <div className="absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-xs text-white">
              {otherLabel}
            </div>
          </div>

          <div
            className="absolute bottom-24 right-4 z-10 h-36 w-28 cursor-grab overflow-hidden rounded-lg border border-zinc-600 bg-zinc-900 shadow-lg active:cursor-grabbing"
            style={{
              transform: `translate(${pipOffset.x}px, ${pipOffset.y}px)`,
            }}
            onMouseDown={(e) => {
              pipDragState.current = {
                sx: e.clientX,
                sy: e.clientY,
                ox: pipOffset.x,
                oy: pipOffset.y,
              };
              const onMove = (ev: MouseEvent) => {
                if (!pipDragState.current) return;
                setPipOffset({
                  x: pipDragState.current.ox + (ev.clientX - pipDragState.current.sx),
                  y: pipDragState.current.oy + (ev.clientY - pipDragState.current.sy),
                });
              };
              const onUp = () => {
                pipDragState.current = null;
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
              You
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-center gap-3 border-t border-zinc-800 bg-zinc-950 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                const co = callObjectRef.current;
                if (!co) return;
                void co.setLocalAudio(!co.localAudio());
              }}
              className="rounded-full border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Mic
            </button>
            <button
              type="button"
              onClick={() => {
                const co = callObjectRef.current;
                if (!co) return;
                void co.setLocalVideo(!co.localVideo());
              }}
              className="rounded-full border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Camera
            </button>
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Leave session
            </button>
          </div>
        </div>
      )}

      {leaveOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <p className="text-sm text-zinc-100">
              Are you sure you want to leave? Your session will continue and you
              can rejoin.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveOpen(false);
                  void leaveRoom();
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
