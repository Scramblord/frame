import { Resend } from "resend";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  bookingConfirmedExpert,
  bookingConfirmedStudent,
} from "@/lib/email-templates";

const FROM = "Sensei <onboarding@resend.dev>";

let resendSingleton: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return null;
  }
  if (!resendSingleton) {
    resendSingleton = new Resend(key);
  }
  return resendSingleton;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) {
      console.error("sendEmail: RESEND_API_KEY is not set");
      return;
    }
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("sendEmail: Resend API error", error);
    }
  } catch (e) {
    console.error("sendEmail: unexpected error", e);
  }
}

export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      return null;
    }
    return data.user.email;
  } catch {
    return null;
  }
}

function displayName(fullName: string | null | undefined, fallback: string): string {
  const t = typeof fullName === "string" ? fullName.trim() : "";
  return t.length > 0 ? t : fallback;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/**
 * Sends booking-confirmed emails to expert and consumer after payment.
 * Does not throw; logs internally.
 */
export async function notifyBookingConfirmedEmails(bookingId: string): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { data: row, error: rowErr } = await admin
      .from("bookings")
      .select(
        "consumer_user_id, expert_user_id, session_type, scheduled_at, service_id",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (rowErr || !row) {
      console.error("notifyBookingConfirmedEmails: booking lookup failed", rowErr);
      return;
    }

    const consumerId = row.consumer_user_id as string;
    const expertId = row.expert_user_id as string;
    const sessionType = String(row.session_type ?? "");
    const scheduledAt = row.scheduled_at as string | null;
    const serviceId = row.service_id as string | undefined;

    let serviceLabel = "Service";
    if (serviceId) {
      const { data: svcRow } = await admin
        .from("services")
        .select("name")
        .eq("id", serviceId)
        .maybeSingle();
      const n = svcRow?.name;
      if (typeof n === "string" && n.trim() !== "") {
        serviceLabel = n.trim();
      }
    }

    const [{ data: consumerProf }, { data: expertProf }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("user_id", consumerId).maybeSingle(),
      admin.from("profiles").select("full_name").eq("user_id", expertId).maybeSingle(),
    ]);

    const studentName = displayName(consumerProf?.full_name as string | undefined, "Student");
    const senseiName = displayName(expertProf?.full_name as string | undefined, "Sensei");

    const [expertEmail, consumerEmail] = await Promise.all([
      getUserEmail(expertId),
      getUserEmail(consumerId),
    ]);

    const base = siteUrl();
    const expertUrl = `${base}/expert/bookings/${bookingId}`;
    const studentUrl = `${base}/bookings/${bookingId}`;

    const tasks: Promise<void>[] = [];
    if (expertEmail) {
      tasks.push(
        sendEmail({
          to: expertEmail,
          subject: `New booking from ${studentName}`,
          html: bookingConfirmedExpert({
            expertName: senseiName,
            studentName,
            serviceName: serviceLabel,
            sessionType,
            scheduledAt,
            bookingUrl: expertUrl,
          }),
        }),
      );
    }
    if (consumerEmail) {
      tasks.push(
        sendEmail({
          to: consumerEmail,
          subject: `Your booking with ${senseiName} is confirmed`,
          html: bookingConfirmedStudent({
            studentName,
            senseiName,
            serviceName: serviceLabel,
            sessionType,
            scheduledAt,
            bookingUrl: studentUrl,
          }),
        }),
      );
    }

    await Promise.all(tasks);
  } catch (e) {
    console.error("notifyBookingConfirmedEmails", e);
  }
}

/** GBP amount from Stripe transfer (minor units) for email subject/body. */
export function formatGbpFromStripeAmount(amountPence: number): string {
  if (!Number.isFinite(amountPence)) {
    return "0.00";
  }
  return (amountPence / 100).toFixed(2);
}
