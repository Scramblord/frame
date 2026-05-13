"use client";

import {
  applyDiscountToTotal,
  discountBadgeLabel,
  type DiscountRow,
} from "@/lib/discounts";
import { formatGbp, type ServiceRow } from "@/lib/experts-marketplace";
import { totalForBooking, type BookableSessionType } from "@/lib/booking-pricing";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type EnquiryMessage = {
  id: string;
  enquiry_id: string;
  sender_id: string;
  content: string;
  is_offer: boolean;
  created_at: string;
};

type OfferRow = {
  id: string;
  status: string;
  session_type: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  total_amount: number | string;
  offer_sent_at: string | null;
  offer_expires_at: string | null;
};

type ThreadPayload = {
  messages: EnquiryMessage[];
  offers: OfferRow[];
  enquiry: {
    id: string;
    status: string;
  };
};

type Props = {
  enquiryId: string;
  backHref: string;
  currentUserId: string;
  role: "consumer" | "expert";
  enquiryStatus: string;
  service: ServiceRow & {
    urgent_messaging_enabled?: boolean;
    urgent_messaging_rate?: number | string | null;
  };
  expertName: string;
  consumerName: string;
  expertProfileId: string | null;
  initialMessages: EnquiryMessage[];
  initialOffers: OfferRow[];
  automaticDiscount: DiscountRow | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return "Expired";
  const targetMs = new Date(targetIso).getTime();
  const diff = targetMs - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "Expired";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return `${hours}h ${remMins}m`;
}

function formatSessionTypeLabel(sessionType?: string): string {
  if (!sessionType) return "Session";
  return sessionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseOfferPayload(raw: string): null | {
  bookingId?: string;
  sessionType?: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  totalAmount?: number | string;
  offerExpiresAt?: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed as ReturnType<typeof parseOfferPayload>;
  } catch {
    return null;
  }
}

function isMessagingOfferSessionType(sessionType?: string): boolean {
  return sessionType === "messaging" || sessionType === "urgent_messaging";
}

function sessionTypeOfferIcon(sessionType?: string): string {
  switch (sessionType) {
    case "video":
      return "📹 ";
    case "audio":
      return "🎙 ";
    case "messaging":
      return "💬 ";
    case "urgent_messaging":
      return "⚡ ";
    default:
      return "";
  }
}

function enquiryThreadStatusBadgeClass(status: string): string {
  const base =
    "inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium";
  if (status === "open") {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200`;
  }
  if (status === "offer_sent") {
    return `${base} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200`;
  }
  if (status === "closed") {
    return `${base} border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`;
  }
  return `${base} border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]`;
}

function enquiryThreadStatusBadgeLabel(status: string): string {
  if (status === "open") return "Open";
  if (status === "offer_sent") return "Offer sent";
  if (status === "closed") return "Closed";
  return status.replace(/_/g, " ");
}

export default function EnquiryThreadClient({
  enquiryId,
  backHref,
  currentUserId,
  role,
  enquiryStatus,
  service,
  expertName,
  consumerName,
  expertProfileId,
  initialMessages,
  initialOffers,
  automaticDiscount,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [offers, setOffers] = useState(initialOffers);
  const [status, setStatus] = useState(enquiryStatus);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [busyAccept, setBusyAccept] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerSessionType, setOfferSessionType] = useState<BookableSessionType>(
    service.offers_video
      ? "video"
      : service.offers_audio
        ? "audio"
        : service.offers_messaging
          ? "messaging"
          : "urgent_messaging",
  );
  const [offerDateTime, setOfferDateTime] = useState("");
  const [offerDuration, setOfferDuration] = useState<string>("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [cancelEnquiryStep, setCancelEnquiryStep] = useState<"idle" | "confirm">(
    "idle",
  );

  const canSendOffer = role === "expert" && (status === "open" || status === "offer_sent");
  const canChat = status === "open" || status === "offer_sent";
  const isClosed = status === "closed";
  const offerAlreadySent = role === "expert" && status === "offer_sent";
  const counterpart = role === "expert" ? consumerName : expertName;

  const durationOptions = useMemo(() => {
    const out: number[] = [];
    for (let m = service.min_session_minutes; m <= service.max_session_minutes; m += 15) {
      out.push(m);
    }
    return out;
  }, [service.max_session_minutes, service.min_session_minutes]);

  const offerBasePrice = useMemo(() => {
    const duration =
      offerSessionType === "audio" || offerSessionType === "video"
        ? Number(offerDuration || "0")
        : null;
    return totalForBooking(service, offerSessionType, duration);
  }, [offerDuration, offerSessionType, service]);

  const offerLockedPrice =
    offerBasePrice == null
      ? null
      : automaticDiscount
        ? applyDiscountToTotal(offerBasePrice, automaticDiscount)
        : offerBasePrice;

  async function refresh() {
    const res = await fetch(`/api/enquiries/${enquiryId}`);
    if (!res.ok) return;
    const json = (await res.json()) as ThreadPayload;
    setMessages(json.messages ?? []);
    setOffers(json.offers ?? []);
    setStatus(json.enquiry?.status ?? status);
  }

  useEffect(() => {
    const channel = supabase
      .channel(`enquiry-${enquiryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enquiry_messages",
          filter: `enquiry_id=eq.${enquiryId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enquiryId]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not send message");
        return;
      }
      setInput("");
      await refresh();
    } finally {
      setSending(false);
    }
  }

  async function closeEnquiry() {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/close`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not cancel enquiry");
        return;
      }
      await refresh();
      router.refresh();
      setCancelEnquiryStep("idle");
    } finally {
      setClosing(false);
    }
  }

  async function acceptAndPay() {
    if (busyAccept) return;
    setBusyAccept("pending");
    setError(null);
    try {
      const acceptRes = await fetch(`/api/enquiries/${enquiryId}/accept`, {
        method: "POST",
      });
      const acceptJson = (await acceptRes.json()) as {
        error?: string;
        bookingId?: string;
      };
      if (!acceptRes.ok || !acceptJson.bookingId) {
        setError(acceptJson.error ?? "Could not accept offer");
        return;
      }

      const payRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: acceptJson.bookingId }),
      });
      const payJson = (await payRes.json()) as { url?: string; error?: string };
      if (!payRes.ok || !payJson.url) {
        setError(payJson.error ?? "Could not start checkout");
        return;
      }
      window.location.href = payJson.url;
    } finally {
      setBusyAccept(null);
    }
  }

  async function sendOffer() {
    if (!canSendOffer || sendingOffer) return;
    const needsSchedule = offerSessionType === "audio" || offerSessionType === "video";
    if (needsSchedule && !offerDateTime) {
      setError("Select date and time for this offer.");
      return;
    }
    if (needsSchedule && !offerDuration) {
      setError("Select duration for this offer.");
      return;
    }
    setSendingOffer(true);
    setError(null);
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: offerSessionType,
          scheduledAt: needsSchedule ? new Date(offerDateTime).toISOString() : null,
          durationMinutes: needsSchedule ? Number(offerDuration) : null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not send offer");
        return;
      }
      setShowOfferModal(false);
      setOfferDateTime("");
      setOfferDuration("");
      await refresh();
      router.refresh();
    } finally {
      setSendingOffer(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href={backHref}
        className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back
      </Link>

      <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">
            {service.name} · {counterpart}
          </h1>
          <span className={enquiryThreadStatusBadgeClass(status)}>
            {enquiryThreadStatusBadgeLabel(status)}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {role === "consumer"
              ? "Send a message to introduce yourself and explain what you're looking for."
              : "No messages yet."}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            const payload = m.is_offer ? parseOfferPayload(m.content) : null;
            const expired =
              payload?.offerExpiresAt != null &&
              new Date(payload.offerExpiresAt).getTime() <= Date.now();
            const offerMessaging = Boolean(
              payload && isMessagingOfferSessionType(payload.sessionType),
            );

            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                  }`}
                >
                  {m.is_offer && payload ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        Booking offer
                      </p>
                      <p>
                        <span aria-hidden>{sessionTypeOfferIcon(payload.sessionType)}</span>
                        {formatSessionTypeLabel(payload.sessionType)} ·{" "}
                        {offerMessaging
                          ? "Flexible"
                          : `${payload.durationMinutes ?? "TBC"} min`}
                      </p>
                      <p>
                        {offerMessaging
                          ? "On demand"
                          : formatDateTime(payload.scheduledAt ?? null)}
                      </p>
                      <p className="text-xl font-bold tracking-tight">
                        {payload.totalAmount != null
                          ? formatGbp(Number(payload.totalAmount))
                          : "Price pending"}
                      </p>
                      <p className="text-xs opacity-80">
                        Expires in {formatCountdown(payload.offerExpiresAt ?? null)}
                      </p>
                      {role === "consumer" && !expired && status === "offer_sent" ? (
                        <button
                          type="button"
                          onClick={() => void acceptAndPay()}
                          disabled={busyAccept != null}
                          className="mt-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          {busyAccept ? "Processing..." : "Accept & Pay"}
                        </button>
                      ) : null}
                      {role === "consumer" && expired ? (
                        <p className="mt-2 text-xs opacity-80">This offer has expired.</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                  <p
                    className={`mt-1 text-[11px] tabular-nums ${
                      mine
                        ? "opacity-70"
                        : "text-[var(--color-text-muted)] opacity-90"
                    }`}
                  >
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canChat ? (
        <div className="mt-4 flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Type a message..."
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim()}
            className="self-end rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      ) : null}

      {isClosed ? (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          This enquiry has been closed.
        </p>
      ) : null}

      {canSendOffer ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowOfferModal(true)}
            disabled={offerAlreadySent}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
              offerAlreadySent
                ? "bg-zinc-400 cursor-not-allowed dark:bg-zinc-600"
                : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
            }`}
          >
            {offerAlreadySent ? "Offer sent" : "Send booking offer"}
          </button>
        </div>
      ) : null}

      {showOfferModal ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-semibold">Create booking offer</p>
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-medium">
              Session type
              <select
                value={offerSessionType}
                onChange={(e) =>
                  setOfferSessionType(e.target.value as BookableSessionType)
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {service.offers_messaging ? (
                  <option value="messaging">Messaging</option>
                ) : null}
                {service.urgent_messaging_enabled ? (
                  <option value="urgent_messaging">Urgent messaging</option>
                ) : null}
                {service.offers_audio ? <option value="audio">Audio</option> : null}
                {service.offers_video ? <option value="video">Video</option> : null}
              </select>
            </label>
            {offerSessionType === "audio" || offerSessionType === "video" ? (
              <>
                <label className="text-xs font-medium">
                  Date & time
                  <input
                    type="datetime-local"
                    value={offerDateTime}
                    onChange={(e) => setOfferDateTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="text-xs font-medium">
                  Duration
                  <select
                    value={offerDuration}
                    onChange={(e) => setOfferDuration(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Select duration</option>
                    {durationOptions.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Locked price:{" "}
              <span className="font-semibold">
                {offerLockedPrice != null ? formatGbp(offerLockedPrice) : "—"}
              </span>
              {automaticDiscount ? ` (${discountBadgeLabel(automaticDiscount)})` : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOfferModal(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendOffer()}
                disabled={sendingOffer}
                className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sendingOffer ? "Sending..." : "Send offer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {!isClosed && status !== "booked" ? (
        <div className="mt-6 flex flex-col items-start gap-2 border-t border-[var(--color-border)] pt-4">
          {cancelEnquiryStep === "confirm" ? (
            <>
              <p className="max-w-md text-sm text-[var(--color-text-muted)]">
                Are you sure? This will permanently close the conversation.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void closeEnquiry()}
                  disabled={closing}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {closing ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelEnquiryStep("idle")}
                  disabled={closing}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Keep open
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCancelEnquiryStep("confirm")}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            >
              Cancel enquiry
            </button>
          )}
        </div>
      ) : null}
    </main>
  );
}
