import {
  ButtonLink,
  CompactScreenshotCard,
  GradientCard,
  HeroScreenshot,
  PageShell,
  PlanCta,
  ProductScreenshotCard,
  SectionHeading,
} from "@/components/marketing";
import { MobileScreenshotCarousel } from "@/components/mobile-screenshot-carousel";
import {
  aiFeatures,
  audiences,
  faqs,
  features,
  heroScreenshot,
  primaryScreenshots,
  pricingPlans,
  secondaryScreenshots,
  siteLaunch,
  siteLinks,
  taxDisclaimer,
  trustCards,
} from "@/lib/site";

export default function HomePage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-200">
              {siteLaunch.isPrelaunch
                ? "Pre-launch contractor beta"
                : "AI-powered tools built for contractors"}
            </p>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              Build profitable projects from bid to closeout.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Build Profit Solutions helps contractors estimate faster, track
              job costs, manage projects, organize materials, create proposals,
              and protect profit with AI-powered construction tools.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-100/85">
              Currently finalizing iOS, Android, and web access for contractor
              testing and early launch users.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {siteLaunch.isPrelaunch ? (
                <>
                  <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
                  <ButtonLink href="#product-screens" variant="secondary">
                    View Product Screens
                  </ButtonLink>
                </>
              ) : (
                <ButtonLink href={siteLinks.download}>Download App</ButtonLink>
              )}
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-400">
              Built for contractors, builders, remodelers, subcontractors, and
              small construction teams that want clearer numbers from estimate
              to final payment.
            </p>
            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {["Bid smarter", "Track the job", "Protect profit", "Stay organized"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 shadow-lg shadow-cyan-950/20">
                  <p className="text-sm font-bold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroScreenshot src={heroScreenshot.src} alt={heroScreenshot.alt} />
        </div>
      </section>

      <section id="features" className="px-5 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="One workspace for the full construction profit cycle."
        >
          From the first estimate to the final payment, Build Profit Solutions
          helps keep bids, budgets, change orders, receipts, payments, and
          project performance connected.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <GradientCard key={feature.title}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/15 text-xl font-black text-emerald-200">
                {feature.title.charAt(0)}
              </div>
              <h3 className="mt-6 text-xl font-black text-white">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{feature.description}</p>
              <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-300">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </GradientCard>
          ))}
        </div>
      </section>

      <section id="audiences" className="px-5 py-24 sm:px-6 lg:px-8">
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

      <section className="px-5 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="AI Tools"
          title="AI built around real construction decisions."
        >
          Build Profit Solutions is not just a chatbot. The AI assistant is
          designed to help contractors understand estimates, project costs,
          change orders, payments, materials, and profit risk.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {aiFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-cyan-950/20"
            >
              <h3 className="text-lg font-black text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6 lg:hidden">
        <SectionHeading eyebrow="Product Tour" title="Swipe through the app without the long scroll.">
          A quick mobile walkthrough of the strongest Build Profit Solutions
          workflows.
        </SectionHeading>
        <MobileScreenshotCarousel
          slides={[
            ...primaryScreenshots,
            ...secondaryScreenshots.map((shot) => ({
              ...shot,
              eyebrow: "Workflow",
              orientation: "mobile",
            })),
          ]}
        />
      </section>

      <section id="product-screens" className="hidden px-5 py-24 sm:px-6 lg:block lg:px-8">
        <SectionHeading eyebrow="Product Screens" title="Real app workflows that sell the product fast.">
          These screens show the strongest parts of Build Profit Solutions:
          estimating, profit tracking, automation, materials, and client-ready
          documents.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          {primaryScreenshots.map((shot) => (
            <ProductScreenshotCard key={shot.title} {...shot} />
          ))}
        </div>
      </section>

      <section className="hidden px-5 py-24 sm:px-6 lg:block lg:px-8">
        <SectionHeading eyebrow="More Features" title="Secondary workflows that prove depth.">
          Payment schedules, tax prep, teams, materials, product search, and AI
          project management round out the construction workflow.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryScreenshots.map((shot) => (
            <CompactScreenshotCard key={shot.title} {...shot} />
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-6 text-slate-500">
          {taxDisclaimer}
        </p>
      </section>

      <section id="pricing" className="px-5 py-24 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Pricing" title="Start lean. Scale when the work grows.">
          {siteLaunch.isPrelaunch
            ? "Pricing is shown for launch planning and may be finalized before subscriptions open."
            : "Choose the plan that matches your crew, project load, and reporting needs."}
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
              <p className="mt-3 text-sm font-semibold text-emerald-200">
                {plan.bestFor}
              </p>
              <p className="mt-6 text-5xl font-black text-white">
                ${plan.price}
                <span className="text-base font-semibold text-slate-400">/mo</span>
              </p>
              <PlanCta label={plan.cta} />
            </GradientCard>
          ))}
        </div>
        <div className="mt-8 text-center">
          <ButtonLink href="/pricing" variant="secondary">
            Compare all plan features
          </ButtonLink>
        </div>
      </section>

      <section id="download" className="px-5 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-300/18 to-cyan-400/18 p-8 text-center sm:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-200">
            Contractor Beta
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {siteLaunch.isPrelaunch
              ? "Currently in pre-launch contractor testing."
              : "Download the app or open the web version."}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {siteLaunch.isPrelaunch
              ? "Build Profit Solutions is being finalized for iOS, Android, and web access. We are currently preparing contractor beta testing, refining the product experience, and improving the workflows that help contractors estimate, manage, and protect project profit."
              : "Store links are ready to plug in when your iOS and Android listings are live. Until then, visitors can sign up through the web app."}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {siteLaunch.isPrelaunch ? (
              <>
                <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
                <ButtonLink href={siteLinks.contact} variant="secondary">
                  Get Launch Updates
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href={siteLinks.iosApp}>App Store</ButtonLink>
                <ButtonLink href={siteLinks.androidApp} variant="secondary">
                  Google Play
                </ButtonLink>
                <ButtonLink href={siteLinks.webApp} variant="secondary">
                  Web App
                </ButtonLink>
              </>
            )}
          </div>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-400">
            Early access may be limited while the product is being tested and
            refined.
          </p>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Trust"
          title="Built for real contractor pain points."
        >
          Construction profit is not lost in one place. It gets lost through
          missed costs, unclear change orders, poor payment tracking, scattered
          receipts, material price changes, and not knowing where the job stands
          until it is too late.
        </SectionHeading>
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trustCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-cyan-950/20"
            >
              <h3 className="text-lg font-black text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-24 sm:px-6 lg:px-8">
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

      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(45,255,196,0.18),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.62))] p-8 text-center shadow-[0_24px_90px_rgba(34,211,238,0.12)] sm:p-12">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Ready to build with better numbers?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Request early access to Build Profit Solutions and follow the launch
            as contractor testing continues.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={siteLinks.contact}>Request Early Access</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary">
              View Pricing
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Pre-launch access may be limited while the product is being tested
            and refined.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
