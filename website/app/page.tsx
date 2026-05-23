import {
  ButtonLink,
  CompactScreenshotCard,
  GradientCard,
  HeroScreenshot,
  PageShell,
  ProductScreenshotCard,
  SectionHeading,
} from "@/components/marketing";
import {
  audiences,
  faqs,
  features,
  heroScreenshot,
  primaryScreenshots,
  pricingPlans,
  secondaryScreenshots,
  siteLinks,
} from "@/lib/site";

export default function HomePage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-200">
              AI-powered tools built for contractors
            </p>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              Build profitable projects from bid to closeout.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Build Profit Solutions brings estimating, job costing, project
              tracking, leads, proposals, and AI guidance into one construction
              management workspace.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={siteLinks.download}>Download App</ButtonLink>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center">
              {["AI Estimates", "Profit Tracking", "Team Management"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4">
                  <p className="text-sm font-bold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroScreenshot src={heroScreenshot.src} alt={heroScreenshot.alt} />
        </div>
      </section>

      <section id="features" className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything contractors need to protect profit."
        >
          Plan the bid, manage the work, and understand the money without
          stitching together disconnected tools.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <GradientCard key={feature.title}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-xl font-black text-emerald-200">
                {feature.title.charAt(0)}
              </div>
              <h3 className="mt-6 text-xl font-black text-white">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{feature.description}</p>
            </GradientCard>
          ))}
        </div>
      </section>

      <section id="audiences" className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Who It Helps" title="Built for the whole construction workflow.">
          Whether you run crews, manage remodels, develop projects, or owner-build,
          the app keeps cost and scope decisions connected.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-5">
          {audiences.map((audience) => (
            <div key={audience.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-black text-white">{audience.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{audience.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Product Screens" title="Real app workflows that sell the product fast.">
          These screens show the strongest parts of Build Profit Solutions:
          estimating, profit tracking, automation, subcontractors, and
          client-ready documents.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          {primaryScreenshots.map((shot) => (
            <ProductScreenshotCard key={shot.title} {...shot} />
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="More Features" title="Secondary workflows that prove depth.">
          Payment schedules, tax prep, teams, materials, product search, and AI
          project management round out the construction workflow.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryScreenshots.map((shot) => (
            <CompactScreenshotCard key={shot.title} {...shot} />
          ))}
        </div>
      </section>

      <section id="pricing" className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Pricing" title="Start lean. Scale when the work grows.">
          Choose the plan that matches your crew, project load, and reporting needs.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <GradientCard
              key={plan.id}
              className={plan.recommended ? "shadow-2xl shadow-emerald-500/10" : ""}
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  {plan.tag}
                </span>
              </div>
              <p className="mt-4 text-slate-300">{plan.description}</p>
              <p className="mt-6 text-5xl font-black text-white">
                ${plan.price}
                <span className="text-base font-semibold text-slate-400">/mo</span>
              </p>
              <ButtonLink href={siteLinks.signUp}>
                {plan.cta}
              </ButtonLink>
            </GradientCard>
          ))}
        </div>
        <div className="mt-8 text-center">
          <ButtonLink href="/pricing" variant="secondary">
            Compare all plan features
          </ButtonLink>
        </div>
      </section>

      <section id="download" className="px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-300/18 to-cyan-400/18 p-8 text-center sm:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-200">
            Get Started
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Download the app or open the web version.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Store links are ready to plug in when your iOS and Android listings
            are live. Until then, visitors can sign up through the web app.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={siteLinks.iosApp}>App Store</ButtonLink>
            <ButtonLink href={siteLinks.androidApp} variant="secondary">
              Google Play
            </ButtonLink>
            <ButtonLink href={siteLinks.webApp} variant="secondary">
              Web App
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Quick answers before launch." />
        <div className="mx-auto grid max-w-5xl gap-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-lg font-black text-white">{faq.question}</h3>
              <p className="mt-3 leading-7 text-slate-300">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
