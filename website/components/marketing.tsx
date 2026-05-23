import Image from "next/image";
import Link from "next/link";
import { LogoLink, MobileSiteNav, SiteNavLinks } from "@/components/site-nav";
import { siteConfig, siteLaunch, siteLinks } from "@/lib/site";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

function buttonClassName(variant: ButtonLinkProps["variant"] = "primary") {
  return variant === "primary"
    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-[0_20px_70px_rgba(34,211,238,0.22)] hover:brightness-110"
    : variant === "secondary"
      ? "border border-emerald-300/35 bg-white/10 text-white hover:border-emerald-200 hover:bg-white/15"
      : "border border-white/35 bg-transparent text-white hover:border-emerald-200 hover:bg-white/10";
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition ${buttonClassName(variant)}`}
    >
      {children}
    </Link>
  );
}

export function ComingSoonButton({
  variant = "secondary",
}: {
  variant?: ButtonLinkProps["variant"];
}) {
  return (
    <span
      className={`inline-flex cursor-default items-center justify-center rounded-full px-5 py-3 text-sm font-bold opacity-75 ${buttonClassName(variant)}`}
      aria-disabled="true"
    >
      Coming soon
    </span>
  );
}

export function PrelaunchBanner() {
  if (!siteLaunch.isPrelaunch) return null;

  return (
    <div className="border-b border-amber-300/20 bg-amber-400/10 px-5 py-3 text-center text-sm leading-6 text-amber-100">
      <span className="font-bold text-amber-200">Pre-launch preview.</span> Sign-up,
      subscriptions, and app downloads are not open yet.{" "}
      <a href={siteLinks.contact} className="font-bold underline hover:text-white">
        Contact us
      </a>{" "}
      for updates.
    </div>
  );
}

export function PlanCta({ label }: { label: string }) {
  if (siteLaunch.isPrelaunch) {
    return (
      <div className="mt-7 grid gap-2">
        <ComingSoonButton />
        <p className="text-center text-xs text-slate-500">
          {label} — available at public launch
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7">
      <ButtonLink href={siteLinks.signUp}>{label}</ButtonLink>
    </div>
  );
}

export function Logo() {
  return <LogoLink />;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/82 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-7xl items-center gap-4 px-5 py-4 sm:px-6 lg:px-8">
        <Logo />
        <SiteNavLinks />
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            {siteLaunch.isPrelaunch ? (
              <ButtonLink href={siteLinks.contact} variant="secondary">
                Contact
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href={siteLinks.webApp} variant="secondary">
                  Open Web App
                </ButtonLink>
                <ButtonLink href={siteLinks.signUp}>Sign Up</ButtonLink>
              </>
            )}
          </div>
          <MobileSiteNav />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">
            {siteConfig.description}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Built for contractors who want every bid, job, and decision connected
            to profit.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Product</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <Link href="/#features" className="hover:text-white">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-white">
              Pricing
            </Link>
            {siteLaunch.isPrelaunch ? null : (
              <Link href={siteLinks.webApp} className="hover:text-white">
                Web App
              </Link>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Company</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <a href={siteLinks.contact} className="hover:text-white">
              Contact
            </a>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Legal</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500">
        © 2026 Build Profit Solutions. All rights reserved.
      </div>
    </footer>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`mx-auto max-w-3xl text-center ${compact ? "mb-8" : "mb-12"}`}>
      {eyebrow ? (
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {children ? (
        <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">{children}</p>
      ) : null}
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PrelaunchBanner />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function GradientCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[2rem] bg-gradient-to-br from-emerald-300 to-cyan-400 p-px ${className}`}>
      <div className="h-full rounded-[calc(2rem-1px)] bg-slate-900/96 p-6 shadow-2xl shadow-cyan-950/30">
        {children}
      </div>
    </div>
  );
}

export function ScreenshotPlaceholder({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  return (
    <GradientCard>
      <div className="aspect-[4/3] rounded-3xl border border-dashed border-cyan-300/35 bg-slate-950/80 p-5">
        <div className="flex h-full flex-col justify-between rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(45,255,196,0.18),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.62))] p-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
            <span className="h-3 w-3 rounded-full bg-cyan-300" />
            <span className="h-3 w-3 rounded-full bg-slate-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
              Screenshot slot
            </p>
            <h3 className="mt-3 text-2xl font-black text-white">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{caption}</p>
          </div>
        </div>
      </div>
    </GradientCard>
  );
}

function ProductScreenshotFrame({
  image,
  title,
  label,
  desktop,
}: {
  image: string;
  title: string;
  label?: string;
  desktop: boolean;
}) {
  return (
    <div
      className={`relative mx-auto shrink-0 overflow-hidden rounded-[1.4rem] border border-cyan-300/16 bg-black/70 p-2 shadow-[0_16px_55px_rgba(34,211,238,0.08)] ${
        desktop
          ? "aspect-[16/10] w-full max-w-2xl"
          : "aspect-[9/16] w-full max-w-[11.5rem] sm:max-w-[12.5rem]"
      }`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.1rem] bg-slate-950">
        <Image
          src={image}
          alt={`${title}${label ? ` ${label}` : ""} screenshot`}
          fill
          sizes={desktop ? "(min-width: 1024px) 672px, 90vw" : "200px"}
          quality={desktop ? 100 : 85}
          unoptimized={desktop}
          className="object-contain"
        />
      </div>
    </div>
  );
}

export function ProductScreenshotCard({
  title,
  eyebrow,
  description,
  image,
  secondaryImage,
  orientation = "mobile",
}: {
  title: string;
  eyebrow?: string;
  description: string;
  image: string;
  secondaryImage: string;
  orientation?: string;
}) {
  const desktop = orientation === "desktop";

  return (
    <div
      className={`rounded-[1.75rem] bg-gradient-to-br from-emerald-300/20 via-cyan-300/12 to-sky-500/16 p-px shadow-[0_20px_70px_rgba(0,255,200,0.07)] ring-1 ring-white/[0.04] ${
        desktop ? "lg:col-span-2" : ""
      }`}
    >
      <div className="overflow-hidden rounded-[calc(1.75rem-1px)] bg-slate-900/78 p-4">
        <div
          className={
            desktop
              ? "mx-auto grid max-w-2xl gap-4"
              : "mx-auto grid max-w-xl grid-cols-2 gap-3 sm:gap-4"
          }
        >
          <ProductScreenshotFrame image={image} title={title} desktop={desktop} />
          <ProductScreenshotFrame
            image={secondaryImage}
            title={title}
            label={desktop ? "CPA summary" : "companion"}
            desktop={desktop}
          />
        </div>
        <div className="pt-5">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function CompactScreenshotCard({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: string;
}) {
  return (
    <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-300/20 via-cyan-300/12 to-sky-500/16 p-px shadow-[0_20px_70px_rgba(0,255,200,0.07)] ring-1 ring-white/[0.04]">
      <div className="overflow-hidden rounded-[calc(1.75rem-1px)] bg-slate-900/78 p-4">
        <div className="relative mx-auto flex aspect-[9/16] max-h-[28rem] w-full max-w-[16rem] items-center justify-center overflow-hidden rounded-[1.4rem] border border-cyan-300/16 bg-black/70 p-2 shadow-[0_16px_55px_rgba(34,211,238,0.08)]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.1rem] bg-slate-950">
            <Image
              src={image}
              alt={`${title} screenshot`}
              fill
              sizes="256px"
              className="object-contain"
            />
          </div>
        </div>
        <div className="pt-5">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function HeroScreenshot({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[22rem] rounded-[2.25rem] bg-gradient-to-br from-emerald-300/25 via-cyan-300/18 to-sky-500/20 p-px shadow-[0_20px_80px_rgba(0,255,200,0.08)] ring-1 ring-white/[0.04] lg:max-w-[24rem]">
      <div className="rounded-[calc(2.25rem-1px)] bg-slate-900/88 p-5 sm:p-6">
        <div className="relative mx-auto flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black/70 p-3 shadow-[0_20px_70px_rgba(34,211,238,0.10)] ring-1 ring-white/[0.04]">
          <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] bg-slate-950">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 384px, 320px"
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
