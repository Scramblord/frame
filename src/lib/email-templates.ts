/** Escape text for safe insertion into HTML email bodies. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatScheduledLondon(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") {
    return "Messaging session";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "Messaging session";
  }
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const day = get("day");
  const month = get("month");
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod =
    parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";
  return `${weekday} ${day} ${month}, ${hour}:${minute} ${dayPeriod}`;
}

export function sessionTypeLabel(sessionType: string): string {
  switch (sessionType) {
    case "messaging":
      return "Messaging";
    case "urgent_messaging":
      return "Urgent messaging";
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    default:
      return sessionType;
  }
}

function emailShell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f7f6f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f6f3;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;padding:32px;">
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <div style="width:40px;height:40px;background-color:#e03131;border-radius:50%;text-align:center;line-height:40px;color:#ffffff;font-weight:bold;font-size:18px;">S</div>
                  </td>
                  <td style="vertical-align:middle;font-size:20px;font-weight:bold;color:#1a1917;">Sensei</td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #e8e6e1;margin:20px 0 24px;"/>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1917;">
                ${inner}
              </div>
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#706d66;margin:32px 0 0;">
                You're receiving this because you have an account on Sensei.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<p style="margin:24px 0 0;"><a href="${safeHref}" style="display:inline-block;background-color:#e03131;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:6px;">${safeLabel}</a></p>`;
}

function detailsTable(rows: { label: string; value: string }[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #eceae6;color:#706d66;font-size:14px;vertical-align:top;">${escapeHtml(r.label)}</td><td style="padding:8px 0;border-bottom:1px solid #eceae6;font-size:14px;color:#1a1917;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse;">${body}</table>`;
}

export function bookingConfirmedExpert(params: {
  expertName: string;
  studentName: string;
  serviceName: string;
  sessionType: string;
  scheduledAt: string | null | undefined;
  bookingUrl: string;
}): string {
  const when =
    params.scheduledAt == null || String(params.scheduledAt).trim() === ""
      ? "Messaging session"
      : formatScheduledLondon(params.scheduledAt);
  const inner = `
    <p>Hi ${escapeHtml(params.expertName)}, you have a new ${escapeHtml(sessionTypeLabel(params.sessionType))} booking.</p>
    ${detailsTable([
      { label: "Service", value: params.serviceName },
      { label: "Student", value: params.studentName },
      { label: "When", value: when },
    ])}
    ${ctaButton("View booking", params.bookingUrl)}
  `;
  return emailShell(inner);
}

export function bookingConfirmedStudent(params: {
  studentName: string;
  senseiName: string;
  serviceName: string;
  sessionType: string;
  scheduledAt: string | null | undefined;
  bookingUrl: string;
}): string {
  const when =
    params.scheduledAt == null || String(params.scheduledAt).trim() === ""
      ? "Messaging session"
      : formatScheduledLondon(params.scheduledAt);
  const inner = `
    <p>Hi ${escapeHtml(params.studentName)}, your booking is confirmed.</p>
    ${detailsTable([
      { label: "Service", value: params.serviceName },
      { label: "Sensei", value: params.senseiName },
      { label: "When", value: when },
    ])}
    ${ctaButton("View booking", params.bookingUrl)}
  `;
  return emailShell(inner);
}

export function newMessage(params: {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
}): string {
  const inner = `
    <p>Hi ${escapeHtml(params.recipientName)}, ${escapeHtml(params.senderName)} sent you a message:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #e03131;background:#f7f6f3;font-size:14px;color:#1a1917;">
      ${escapeHtml(params.messagePreview)}
    </blockquote>
    ${ctaButton("View conversation", params.conversationUrl)}
  `;
  return emailShell(inner);
}

export function bookingCancelled(params: {
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  scheduledAt: string | null | undefined;
  refundAmount: number;
  bookingUrl: string;
  /** When true and refundAmount is positive, show consumer refund copy (only for the consumer recipient). */
  includeRefundNotice?: boolean;
}): string {
  const when =
    params.scheduledAt == null || String(params.scheduledAt).trim() === ""
      ? "Messaging session"
      : formatScheduledLondon(params.scheduledAt);
  const refundLine =
    params.includeRefundNotice === true && params.refundAmount > 0
      ? `<p style="margin-top:16px;">A refund of £${escapeHtml(params.refundAmount.toFixed(2))} will be returned to your original payment method.</p>`
      : "";
  const inner = `
    <p>Hi ${escapeHtml(params.recipientName)}, your booking with ${escapeHtml(params.otherPartyName)} has been cancelled.</p>
    ${detailsTable([
      { label: "Service", value: params.serviceName },
      { label: "When", value: when },
    ])}
    ${refundLine}
    ${ctaButton("View details", params.bookingUrl)}
  `;
  return emailShell(inner);
}

export function payoutSent(params: {
  expertName: string;
  amount: string;
  earningsUrl: string;
}): string {
  const inner = `
    <p>Hi ${escapeHtml(params.expertName)}, £${escapeHtml(params.amount)} has been transferred to your Stripe account.</p>
    ${ctaButton("View earnings", params.earningsUrl)}
  `;
  return emailShell(inner);
}
