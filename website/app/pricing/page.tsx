import type { Metadata } from "next";
import { ButtonLink, GradientCard, PageShell, SectionHeading } from "@/components/marketing";
import { pricingPlans, siteConfig, siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Build Profit Solutions plans for contractors, remodelers, subcontractors, developers, and owner-builders.",
};

export default function PricingPage() {
  return (
    <PageShell>
      <section className="px-5 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
          Pricing
        </p>
        <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl">
          Plans for solo contractors, growing crews, and construction teams.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          Start with the essentials, then scale into AI estimating, live job
          costing, advanced analytics, team permissions, and integrations.
        </p>
      </section>

      <section className="px-5 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <GradientCard
              key={plan.id}
              className={plan.recommended ? "lg:-mt-6 shadow-2xl shadow-emerald-500/10" : ""}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                    {plan.tag}
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-white">{plan.name}</h2>
                </div>
                {plan.recommended ? (
                  <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-slate-950">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-5 min-h-14 leading-7 text-slate-300">{plan.description}</p>
              <p className="mt-7 text-5xl font-black text-white">
                ${plan.price}
                <span className="text-base font-semibold text-slate-400">/month</span>
              </p>
              <div className="mt-7">
                <ButtonLink href={siteLinks.signUp}>
                  {plan.cta}
                </ButtonLink>
              </div>
              <ul className="mt-8 grid gap-3 text-sm leading-6 text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </GradientCard>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Need help choosing?" title="Start where you are today.">
          Most solo operators can begin with Basic. Contractors managing
          multiple jobs and margin controls should start with Professional.
          Teams that need permissions, forecasting, and integrations should
          look at Business.
        </SectionHeading>
        <div className="text-center">
          <ButtonLink href={`mailto:${siteConfig.contactEmail}`} variant="secondary">
            Ask a pricing question
          </ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
