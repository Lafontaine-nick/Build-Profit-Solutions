import type { Metadata } from "next";
import { ButtonLink, ComingSoonButton, PageShell, SectionHeading } from "@/components/marketing";
import { audiences, siteConfig, siteLaunch, siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn why Nicholas Lafontaine built Build Profit Solutions for contractors, builders, remodelers, subcontractors, and developers.",
};

const founderHighlights = [
  "Hands-on construction experience",
  "Estimating & job costing",
  "Profit-first project tracking",
];

const missionCards = [
  {
    title: "Estimate smarter",
    description:
      "Build organized bids from project details, labor, materials, markup, and scope.",
  },
  {
    title: "Track every dollar",
    description:
      "Follow materials, labor, equipment, receipts, and payment schedules as the job runs.",
  },
  {
    title: "Protect profit",
    description:
      "See budget versus actuals and net profit early enough to make better decisions.",
  },
];

const aboutSection = "px-5 py-14 sm:px-6 lg:px-8 lg:py-16";

export default function AboutPage() {
  return (
    <PageShell>
      <section className={`${aboutSection} lg:pb-12`}>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
              About Build Profit Solutions
            </p>
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
              Built from real construction profit problems.
            </h1>
            <p className="mt-5 text-lg leading-8 text-emerald-200/90">
              {siteConfig.mission}
            </p>
          </div>
          <div className="text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            <p>
              Build Profit Solutions helps contractors connect the estimate,
              active project costs, payments, receipts, and profit tracking in
              one place — so you know where a job really stands while the work
              is still happening, not after it is too late.
            </p>
            <p className="mt-5">{siteConfig.location}</p>
          </div>
        </div>
      </section>

      <section className={`${aboutSection} pt-0`}>
        <SectionHeading
          compact
          eyebrow="Why We Exist"
          title="Profit gets lost between the bid and the final cost."
        >
          A job can look profitable when the estimate goes out. Then materials,
          labor, change orders, missed costs, delays, payments, and receipts
          start moving — and it becomes hard to see where the job actually
          stands.
        </SectionHeading>
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/70 p-7 text-base leading-7 text-slate-400 sm:p-8 sm:text-lg sm:leading-8">
          <p>
            I started Build Profit Solutions because I saw how easy it is for
            contractors, builders, and small construction companies to lose
            profit between the original estimate and the final job cost.
          </p>
          <p className="mt-5">
            I wanted to build a tool that helps contractors estimate smarter,
            track every dollar, monitor net profit, and protect margin while the
            project is active — not after the numbers are already settled.
          </p>
        </div>
      </section>

      <section className={`${aboutSection} pt-0`}>
        <SectionHeading
          compact
          eyebrow="Mission"
          title="Estimate smarter. Track every dollar. Protect profit."
        >
          Contractors should not have to choose between moving fast, staying
          accurate, and knowing where the money is going. Build Profit Solutions
          connects estimating, job costing, payments, receipts, and project
          organization so teams can bid with confidence and manage jobs with
          fewer surprises.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {missionCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/60 p-6"
            >
              <h2 className="text-xl font-black text-white">{card.title}</h2>
              <p className="mt-3 leading-7 text-slate-400">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${aboutSection} pt-0`}>
        <SectionHeading
          compact
          eyebrow="Who We Serve"
          title="One platform for many construction roles."
        />
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-5">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="rounded-[1.5rem] border border-cyan-300/12 bg-white/[0.03] p-5"
            >
              <h2 className="text-lg font-black text-white">{audience.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {audience.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-7 text-slate-500 sm:text-base">
          The app includes tools for estimating, project budget tracking,
          materials and equipment costs, payment schedules, AI project
          management, and a Tax Center designed to help users stay organized and
          tax-ready from bid to final payment. Build Profit Solutions does not
          provide tax, legal, or financial advice.
        </p>
      </section>

      <section className={`${aboutSection} pb-16 pt-0 lg:pb-20`}>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-10">
          <div className="rounded-[1.75rem] border border-cyan-300/15 bg-gradient-to-br from-emerald-300/8 to-cyan-400/8 p-7 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-200">
              Founder
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              {siteConfig.founderName}
            </h2>
            <p className="mt-2 text-base font-semibold text-emerald-300">
              {siteConfig.founderTitle}
            </p>
            <div className="mt-6 space-y-2 text-sm text-slate-500">
              <p>
                <span className="font-semibold text-slate-300">Company:</span>{" "}
                {siteConfig.name}
              </p>
              <p>
                <span className="font-semibold text-slate-300">Website:</span>{" "}
                buildprofitsolutions.com
              </p>
              <p>
                <span className="font-semibold text-slate-300">Contact:</span>{" "}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {siteConfig.contactEmail}
                </a>
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {siteLaunch.isPrelaunch ? (
                <>
                  <ComingSoonButton variant="primary" />
                  <ButtonLink href={siteLinks.contact} variant="secondary">
                    Contact Us
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink href={siteLinks.signUp}>Sign Up</ButtonLink>
                  <ButtonLink href={siteLinks.contact} variant="secondary">
                    Contact Us
                  </ButtonLink>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {founderHighlights.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-cyan-300/20 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="space-y-5 text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
              <p>
                My background is in construction project management, estimating,
                job costing, real estate development, and hands-on construction
                labor. I have spent time not only managing projects and reviewing
                numbers, but also doing actual labor myself — which gave me a real
                respect for how hard these trades are and how much effort goes into
                every job.
              </p>
              <p>
                I have worked around real construction projects where budgets,
                bids, material costs, labor, payment schedules, subcontractors,
                and timelines all have to be managed carefully. Through that
                experience, I saw that many contractors are still using
                spreadsheets, notes, texts, receipts, and disconnected tools to
                run jobs.
              </p>
              <p>
                Build Profit Solutions was created from that real-world problem:
                helping contractors connect the estimate, active project costs,
                payments, tax organization, and profit tracking in one practical
                workspace.
              </p>
              <p className="text-sm leading-7 text-slate-500 sm:text-base">
                Built for contractors, builders, subcontractors, remodelers, real
                estate developers, owner-builders, and small construction
                businesses that need a simpler way to estimate projects, manage
                active jobs, track actual costs, monitor net profit, organize
                payments, and stay tax-ready from bid to final payment.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
