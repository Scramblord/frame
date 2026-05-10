import Navbar from "@/components/Navbar";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Sensei",
  description: "Terms of Service for the Sensei booking platform.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: May 2026</p>

        <article className="mt-10 max-w-none space-y-8 text-[var(--color-text)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              1. About Sensei
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              Sensei (bookasensei.com) is an online marketplace that connects students with
              independent expert coaches and clinicians (&quot;Senseis&quot;). Sensei is a booking
              platform only. We do not employ, train, supervise, or endorse any Sensei listed on
              the platform. All sessions are provided by independent third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              2. Eligibility
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              You must be at least 18 years old to use Sensei. By creating an account, you confirm
              you are 18 or over.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              3. Acceptable Use
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              You agree to use Sensei only for lawful purposes. You must not use the platform to
              facilitate, discuss, or engage in any illegal activity. You must not harass, abuse, or
              harm other users. You must not impersonate any person or misrepresent your
              qualifications. Violation of these terms may result in immediate account
              suspension.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              4. Sensei Responsibilities
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              Senseis are independent contractors, not employees of Sensei. Senseis are solely
              responsible for the accuracy of their profiles, the quality of their services, and
              compliance with all applicable laws and professional regulations. Sensei (the
              platform) makes no warranties about the quality, safety, or legality of services
              offered.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              5. Payments and Refunds
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              All payments are processed securely via Stripe. Sensei takes a platform commission on
              each transaction. Refund eligibility is determined by our cancellation policy,
              which is displayed at the time of booking. In the event of a verified technical
              failure preventing a session from taking place, a full refund will be issued.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              6. Limitation of Liability
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              To the fullest extent permitted by law, Sensei (the platform) shall not be liable for
              any indirect, incidental, or consequential damages arising from your use of the
              platform, including any harm resulting from sessions booked through the platform.
              Your use of Sensei is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              7. Intellectual Property
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              All platform content, branding, and software is owned by Sensei. You may not
              reproduce or redistribute any part of the platform without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              8. Changes to These Terms
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              We may update these Terms at any time. Continued use of the platform after changes
              constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
              9. Contact
            </h2>
            <p className="mt-2 leading-relaxed text-[var(--color-text-muted)]">
              For any questions about these Terms, contact us at{" "}
              <a
                href="mailto:hello@bookasensei.com"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                hello@bookasensei.com
              </a>
              .
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
