import type { Metadata } from "next";
import { ButtonLink, PageShell, SectionHeading } from "@/components/marketing";
import { audiences, siteConfig, siteLaunch, siteLinks, taxDisclaimer } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn why Nicholas LaFontaine built Build Profit Solutions for contractors, builders, remodelers, subcontractors, and developers.",
};

const founderHighlights = [
  "Hands-on construction experience",
  "Estimating & job costing",
  "Profit-first project tracking",
];

const founderCredibility = [
  "Construction project management",
  "Estimating and job costing",
  "Real estate development",
  "Hands-on labor experience",
  "Budget and profitability tracking",
  "Contractor workflow planning",
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
            I built Build Profit Solutions because I kept seeing the same problem
            in construction: the bid might look good on paper, but real profit
            can get unclear once materials, labor, change orders, receipts,
            payments, delays, and unexpected costs start moving.
          </p>
          <p className="mt-5">
            Build Profit Solutions was created to give contractors a clearer way
            to estimate, manage active jobs, track real costs, organize tax
            records, and protect profit from the first bid to final closeout.
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
          {taxDisclaimer}
        </p>
      </section>

      <section className={`${aboutSection} pb-16 pt-0 lg:pb-20`}>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-10">
          <div className="rounded-[1.75rem] border border-cyan-300/15 bg-gradient-to-br from-emerald-300/8 to-cyan-400/8 p-7 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-200">
              Founder
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Nicholas LaFontaine
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
                  <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
                  <ButtonLink href={siteLinks.contact} variant="secondary">
                    Get Launch Updates
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
                job costing, and real estate development. I have worked around
                real construction projects where budgets, bids, material costs,
                subcontractor pricing, and project timelines all affect whether a
                job actually makes money.
              </p>
              <p>
                I have also spent a lot of time doing actual labor myself, so I
                understand how hard the trades are — not just from the office
                side, but from the jobsite side too.
              </p>
              <p>
                Build Profit Solutions was created to give contractors a clearer
                way to estimate, manage active jobs, track real costs, organize
                tax records, and protect profit from the first bid to final
                closeout.
              </p>
              <p className="text-sm leading-7 text-slate-500 sm:text-base">
                This app is being built for contractors, builders, remodelers,
                subcontractors, and construction business owners who want better
                visibility into their numbers without needing enterprise software
                that feels too expensive, too complicated, or too disconnected
                from the field.
              </p>
            </div>
            <div className="mt-8 rounded-[1.5rem] border border-cyan-300/15 bg-white/[0.03] p-6">
              <h3 className="text-lg font-black text-white">
                Built from real construction experience:
              </h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {founderCredibility.map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-slate-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
