import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { KnowledgeIsPowerMoney } from "@/components/KnowledgeIsPowerMoney";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { ScrollToHowItWorksButton } from "./ScrollToHowItWorksButton";

export const metadata: Metadata = {
  title: "Become a Sensei — Sensei",
  description:
    "Turn your expertise into income. Offer live video, audio, or messaging sessions on your schedule, at your rates.",
};

export const revalidate = 3600;

const EXPERT_SETUP_LOGIN = "/login?next=%2Fexpert%2Fsetup";

const opportunityStats = [
  {
    title: "Keep up to 95%",
    body: "Founding Senseis keep 95% of every session. Standard rate is 90%.",
  },
  {
    title: "Your rates, your schedule",
    body: "Set your own prices. Set your own availability. Take bookings 24/7.",
  },
  {
    title: "100 founding spots",
    body: "The first 100 Senseis lock in 5% commission for 2 years. Don't miss out.",
  },
] as const;

const teachSectors = [
  {
    title: "BJJ & Grappling",
    body: "Technique, game plans, competition prep. Students worldwide want your knowledge.",
  },
  {
    title: "Physiotherapy & Rehab",
    body: "Injury assessment, recovery plans, movement coaching. Help people get better.",
  },
  {
    title: "Strength & Conditioning",
    body: "Programming, nutrition, performance. Build better athletes.",
  },
  {
    title: "Business & Mentoring",
    body: "Strategy, growth, accountability. Your experience is worth more than you think.",
  },
  {
    title: "Creative Skills",
    body: "Design, music, writing, photography. Teach what you love.",
  },
  {
    title: "Anything else",
    body: "If people ask you for advice, you can monetise it on Sensei.",
  },
] as const;

const howItWorksSteps = [
  {
    title: "Create your profile",
    body: "Set up your Sensei profile, add your services, and set your availability. Takes 10 minutes.",
  },
  {
    title: "Get discovered",
    body: "Students search by topic, skill, or name. Your profile does the selling.",
  },
  {
    title: "Get paid",
    body: "Students book and pay upfront. You show up and share your knowledge. We handle the rest.",
  },
] as const;

export default async function BecomeASenseiPage() {
  const admin = createServiceRoleClient();
  const { count: foundingCountRaw } = await admin
    .from("expert_profiles")
    .select("*", { count: "exact", head: true })
    .eq("stripe_onboarding_complete", true);

  const foundingCount = foundingCountRaw ?? 0;
  const foundingSpotsTarget = 100;
  const foundingProgress = Math.min(
    100,
    Math.round(
      (Math.min(foundingCount, foundingSpotsTarget) / foundingSpotsTarget) * 100,
    ),
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        {/* Hero */}
        <section className="text-center">
          <KnowledgeIsPowerMoney
            as="h1"
            className="text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl lg:text-6xl"
          />
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
            Whatever you know, someone needs to learn it. Turn your expertise into income by
            offering live video, audio, or messaging sessions — on your schedule, at your rates.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href={EXPERT_SETUP_LOGIN}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-accent-hover)] sm:w-auto"
            >
              Become a Founding Sensei
            </Link>
            <ScrollToHowItWorksButton className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-3 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)] sm:w-auto">
              See how it works
            </ScrollToHowItWorksButton>
          </div>
        </section>

        {/* The opportunity */}
        <section className="mt-20">
          <div className="grid gap-5 md:grid-cols-3">
            {opportunityStats.map((stat) => (
              <article
                key={stat.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)]"
              >
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
                  {stat.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {stat.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* What can you teach? */}
        <section id="how-it-works" className="mt-20 scroll-mt-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
            If you know it, you can teach it.
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teachSectors.map((sector) => (
              <li
                key={sector.title}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {sector.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {sector.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="mt-20 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <li key={step.title}>
                <p className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-sm font-semibold text-[var(--color-accent)]">
                  {index + 1}
                </p>
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Founding Sensei CTA */}
        <section className="mt-20 rounded-[var(--radius-lg)] bg-[var(--color-navbar-dark)] p-6 text-[var(--color-navbar-dark-text)] shadow-[var(--shadow-md)] sm:p-8">
          <KnowledgeIsPowerMoney
            as="h2"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--color-navbar-dark-muted)] sm:text-base">
            We&apos;re onboarding our first 100 Senseis. Founding Senseis lock in a 5% commission
            rate for 2 years — half our standard rate. Once the 100 spots are gone, they&apos;re
            gone.
          </p>

          <div className="mt-6 max-w-xl">
            <p className="text-sm font-medium">
              {foundingCount} of 100 founding spots taken
            </p>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${foundingProgress}%` }}
              />
            </div>
          </div>

          <Link
            href={EXPERT_SETUP_LOGIN}
            className="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-navbar-dark)] transition hover:bg-zinc-100"
          >
            Apply now
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
