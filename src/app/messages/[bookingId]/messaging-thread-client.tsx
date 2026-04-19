"use client";

import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const MESSAGE_CAP = 15;

export type ThreadMessage = {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_role: "consumer" | "expert";
};

export type ThreadMeta = {
  messaging_message_count: number;
  messaging_closed_at: string | null;
  messaging_sla_deadline: string | null;
  messaging_first_reply_at: string | null;
};

type Props = {
  bookingId: string;
  backHref: string;
  currentUserId: string;
  role: "consumer" | "expert";
  expertDisplayName: string;
  consumerDisplayName: string;
  serviceName: string;
  sessionTypeLabel: "Messaging" | "Urgent messaging";
  bookingStatus: string;
  initialMessages: ThreadMessage[];
  initialMeta: ThreadMeta;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function fetchThread(bookingId: string): Promise<{
  messages: ThreadMessage[];
  booking: ThreadMeta;
} | null> {
  const res = await fetch(`/api/messages/thread?bookingId=${encodeURIComponent(bookingId)}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ messages: ThreadMessage[]; booking: ThreadMeta }>;
}

export function MessagingThreadClient({
  bookingId,
  backHref,
  currentUserId,
  role,
  expertDisplayName,
  consumerDisplayName,
  serviceName,
  sessionTypeLabel,
  bookingStatus,
  initialMessages,
  initialMeta,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [meta, setMeta] = useState<ThreadMeta>(initialMeta);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const messageCount = meta.messaging_message_count ?? 0;
  const isClosed =
    meta.messaging_closed_at != null ||
    bookingStatus === "completed" ||
    bookingStatus === "cancelled" ||
    bookingStatus === "no_show";
  const atCap = messageCount >= MESSAGE_CAP;
  const baseOpen =
    !isClosed &&
    !atCap &&
    (bookingStatus === "confirmed" || bookingStatus === "in_progress");

  const hasRealMessage = messages.some((m) => !m.id.startsWith("temp-"));
  /** Expert cannot send until the consumer has sent the first message (API + RLS). */
  const canCompose =
    baseOpen && (role === "consumer" || hasRealMessage);

  const showNearLimit =
    messageCount >= 10 && messageCount < MESSAGE_CAP && canCompose;

  const showExpertResolve =
    role === "expert" &&
    baseOpen &&
    (bookingStatus === "confirmed" || bookingStatus === "in_progress");

  const slaDeadlineMs = meta.messaging_sla_deadline
    ? new Date(meta.messaging_sla_deadline).getTime()
    : null;
  const showSlaCountdown =
    bookingStatus !== "completed" &&
    meta.messaging_first_reply_at == null &&
    slaDeadlineMs != null &&
    !isClosed;

  const slaExpiredNoReply =
    bookingStatus !== "completed" &&
    meta.messaging_first_reply_at == null &&
    slaDeadlineMs != null &&
    Date.now() > slaDeadlineMs;

  useEffect(() => {
    if (!showSlaCountdown) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showSlaCountdown]);

  const slaRemainingMs = useMemo(() => {
    if (slaDeadlineMs == null) return null;
    return slaDeadlineMs - nowTick;
  }, [slaDeadlineMs, nowTick]);

  const refreshThread = useCallback(async () => {
    const data = await fetchThread(bookingId);
    if (data) {
      setMessages(data.messages);
      setMeta(data.booking);
    }
  }, [bookingId]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages-booking-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          void refreshThread();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, refreshThread]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendLoading || !canCompose) return;
    setSendError(null);
    setSendLoading(true);
    const optimistic: ThreadMessage = {
      id: `temp-${Date.now()}`,
      booking_id: bookingId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      sender_role: role,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, content: text }),
      });
      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
        const err =
          parsed && typeof parsed === "object" && "error" in parsed
            ? String((parsed as { error?: string }).error)
            : "Could not send";
        setSendError(err);
        return;
      }
      if (parsed && typeof parsed === "object" && "id" in parsed) {
        const saved = parsed as ThreadMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? saved : m)),
        );
      }
      await refreshThread();
      router.refresh();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
      setSendError("Could not send");
    } finally {
      setSendLoading(false);
    }
  };

  const handleCloseThread = async () => {
    setCloseError(null);
    setCloseLoading(true);
    try {
      const res = await fetch("/api/messages/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCloseError(json.error ?? "Could not close thread");
        return;
      }
      await refreshThread();
      router.refresh();
    } catch {
      setCloseError("Could not close thread");
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-6 pt-6 sm:px-6">
      <Link
        href={backHref}
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to booking
      </Link>

      <header className="mt-6 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {role === "consumer"
                ? `With ${expertDisplayName}`
                : `With ${consumerDisplayName}`}
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {serviceName}
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
            {sessionTypeLabel}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={
              isClosed
                ? "text-zinc-500 dark:text-zinc-400"
                : "font-medium text-emerald-700 dark:text-emerald-400"
            }
          >
            {isClosed ? "Closed" : "Open"}
          </span>
          {showSlaCountdown && slaRemainingMs != null && !slaExpiredNoReply ? (
            <span className="text-zinc-600 dark:text-zinc-300">
              Expert reply window:{" "}
              <span className="font-mono tabular-nums">
                {formatCountdown(slaRemainingMs)}
              </span>
            </span>
          ) : null}
        </div>
      </header>

      {slaExpiredNoReply && !isClosed ? (
        <div
          className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Expert has not responded within the guaranteed window. FRAME support may
          follow up according to your booking terms.
        </div>
      ) : null}

      {showNearLimit ? (
        <div
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          You&apos;re nearing your message limit — make sure you get what you
          need!
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            {messageCount} / {MESSAGE_CAP} messages used
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-800 transition-[width] dark:bg-zinc-200"
            style={{
              width: `${Math.min(100, (messageCount / MESSAGE_CAP) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex min-h-[240px] flex-1 flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-700/80 dark:bg-zinc-900 sm:min-h-[320px]">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {role === "consumer"
              ? "Send the first message to start the conversation."
              : "Waiting for the client to send the first message."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => {
              const isExpert = m.sender_role === "expert";
              const label = isExpert ? expertDisplayName : consumerDisplayName;
              return (
                <li
                  key={m.id}
                  className={`flex w-full ${isExpert ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                      isExpert
                        ? "rounded-tl-sm border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        : "rounded-tr-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    }`}
                  >
                    <p className="text-xs font-medium opacity-80">{label}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={`mt-1.5 text-[11px] tabular-nums opacity-70 ${
                        isExpert ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canCompose ? (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="message-input">
              Message
            </label>
            <textarea
              id="message-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type a message…"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/20"
              disabled={sendLoading}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sendLoading || !input.trim()}
              className="shrink-0 self-end rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {sendLoading ? "Sending…" : "Send"}
            </button>
          </div>
          {sendError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
          {atCap
            ? "Message limit reached."
            : isClosed
              ? "This thread has been closed."
              : "Messaging is not available for this booking."}
        </div>
      )}

      {showExpertResolve ? (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => void handleCloseThread()}
            disabled={closeLoading}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {closeLoading ? "Closing…" : "Mark as resolved"}
          </button>
          {closeError ? (
            <p className="mt-2 text-center text-sm text-rose-600 dark:text-rose-400">
              {closeError}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
