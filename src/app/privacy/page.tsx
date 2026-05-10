import Navbar from "@/components/Navbar";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Sensei",
  description: "Privacy Policy for the Sensei booking platform.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: May 2026</p>

        <article className="mt-10 max-w-none space-y-8 text-[var(--color-text)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              1. Who We Are
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              Sensei (bookasensei.com) operates this platform. For privacy enquiries, contact{" "}
              <a
                href="mailto:hello@bookasensei.com"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                hello@bookasensei.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              2. What Data We Collect
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              Name and email address (via Google OAuth). Profile information you choose to provide
              (bio, location, avatar). Booking and session history. Payment information — note: we
              do not store card details; all payment data is handled by Stripe. Usage data and
              cookies necessary for the platform to function.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              3. How We Use Your Data
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              To operate and improve the platform. To process bookings and payments. To send
              transactional emails (booking confirmations, cancellations, session reminders). To
              display your profile to other users where relevant.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              4. Third Parties We Share Data With
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed text-[var(--color-text-muted)]">
              <li>
                Stripe (payment processing) —{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  stripe.com/privacy
                </a>
              </li>
              <li>
                Daily.co (video sessions) —{" "}
                <a
                  href="https://www.daily.co/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  daily.co/privacy
                </a>
              </li>
              <li>
                Resend (transactional email) —{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  resend.com/privacy
                </a>
              </li>
              <li>
                Supabase (database and authentication) —{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  supabase.com/privacy
                </a>
              </li>
              <li>
                Google (OAuth login) —{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-accent)] hover:underline"
                >
                  policies.google.com/privacy
                </a>
              </li>
            </ul>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              5. Data Retention
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              We retain your data for as long as your account is active. You may request deletion
              of your account and associated data by contacting{" "}
              <a
                href="mailto:hello@bookasensei.com"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                hello@bookasensei.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              6. Your Rights (GDPR)
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              As a UK/EU user, you have the right to access, correct, or delete your personal data.
              You have the right to object to processing and to data portability. To exercise these
              rights, contact{" "}
              <a
                href="mailto:hello@bookasensei.com"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                hello@bookasensei.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              7. Cookies
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              We use only essential cookies necessary for the platform to function. We do not use
              advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              8. Changes to This Policy
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              9. Contact
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              <a
                href="mailto:hello@bookasensei.com"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                hello@bookasensei.com
              </a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
