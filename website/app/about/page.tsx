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

const contractorNumberCards = [
  {
    title: "Estimating",
    description:
      "Create cleaner estimates, organize costs, apply markup, and understand expected profit before submitting a bid.",
  },
  {
    title: "Job Costing",
    description:
      "Track actual costs against the original budget so contractors can see where the job stands.",
  },
  {
    title: "Change Orders",
    description:
      "Keep added work connected to the project so extra costs and revenue do not get lost.",
  },
  {
    title: "Payment Tracking",
    description:
      "Organize deposits, progress payments, milestone payments, weekly billing, and holdbacks.",
  },
  {
    title: "Project Records",
    description:
      "Keep receipts, vendors, purchase orders, and project financial history easier to review.",
  },
  {
    title: "Profit Visibility",
    description:
      "Compare bid numbers, actual costs, committed costs, and projected job performance.",
  },
];

const aiGuidanceBullets = [
  "Help review estimates for missing cost areas",
  "Explain how labor, materials, overhead, markup, and profit affect the bid",
  "Surface budget and margin risks during active projects",
  "Help contractors understand where the job stands based on project numbers",
  "Support better decisions from bid to closeout",
];

const aboutSection = "px-5 py-14 sm:px-6 lg:px-8 lg:py-16";

export default function AboutPage() {
  return (
    <PageShell>
      <section className={`${aboutSection} lg:pb-12`}>
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
              Founder-built construction software
            </p>
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
              Built from real construction profit problems.
            </h1>
            <p className="mt-5 text-lg leading-8 text-emerald-200/90">
              Build Profit Solutions was created to help contractors estimate
              smarter, track job costs, manage active projects, organize records,
              and protect profit from bid to closeout.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
              <ButtonLink href="/#features" variant="secondary">
                View Features
              </ButtonLink>
            </div>
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
          A project can look profitable at the estimate stage, but the real
          numbers change once labor, materials, purchase orders, change orders,
          receipts, payments, delays, and unexpected costs start moving.
        </SectionHeading>
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/70 p-7 text-base leading-7 text-slate-400 sm:p-8 sm:text-lg sm:leading-8">
          <p>
            Build Profit Solutions helps contractors connect the bid, the active
            project, and the final closeout so they can see where the money is
            going before profit disappears.
          </p>
          <p className="mt-5">
            Construction profit is not lost in one place. It gets lost through
            missed costs, unclear change orders, scattered receipts, material
            price changes, payment gaps, and not knowing where the job stands
            until it is too late.
          </p>
        </div>
      </section>

      <section className={`${aboutSection} pt-0`}>
        <SectionHeading
          compact
          eyebrow="Mission"
          title="Estimate smarter. Track every dollar. Protect profit."
        >
          Helping contractors estimate smarter, track every dollar, stay
          organized, and protect profit from bid to closeout. Build Profit
          Solutions is being built to bring the moving pieces of estimating,
          job costing, payments, records, and closeout into one connected
          workflow.
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
          eyebrow="What It Helps With"
          title="Built to connect the numbers contractors deal with every day."
        />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {contractorNumberCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 shadow-xl shadow-cyan-950/20"
            >
              <h2 className="text-lg font-black text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${aboutSection} pt-0`}>
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-cyan-300/15 bg-slate-900/70 p-7 shadow-xl shadow-cyan-950/20 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
            AI Guidance
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            AI guidance built around construction decisions.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Build Profit Solutions is not just adding AI for the sake of it. The
            AI tools are being designed around the decisions contractors already
            make every day — estimating costs, reviewing project budgets,
            tracking change orders, understanding payments, and protecting
            profit.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {aiGuidanceBullets.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
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
                I built Build Profit Solutions because I kept seeing the same
                problem in construction: the bid might look good on paper, but
                real profit can get unclear once materials, labor, change orders,
                receipts, payments, delays, and unexpected costs start moving.
              </p>
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
                records, and protect profit from the first bid to final
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
              <p className="mt-5 text-sm leading-6 text-slate-500">
                The goal is simple: help contractors understand the numbers
                before, during, and after the job.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 pt-0 sm:px-6 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(45,255,196,0.18),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.62))] p-8 text-center shadow-[0_24px_90px_rgba(34,211,238,0.12)] sm:p-12">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Built for contractors who want clearer numbers.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Build Profit Solutions is currently preparing contractor beta access
            for estimating, job costing, project tracking, AI guidance, and
            profit visibility.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
            <ButtonLink href={siteLinks.contact} variant="secondary">
              Contact Us
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Early access may be limited while the product is being tested and
            refined.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
