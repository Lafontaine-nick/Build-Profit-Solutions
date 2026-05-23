"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems, siteLaunch, siteLinks } from "@/lib/site";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleHomeClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  pathname: string
) {
  if (pathname === "/") {
    event.preventDefault();
    scrollToTop();
  }
}

export function LogoLink() {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      onClick={(event) => handleHomeClick(event, pathname)}
      className="flex items-center gap-3"
      aria-label="Build Profit Solutions home"
    >
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-cyan-300/25">
        <Image
          src="/bps-logo.png"
          alt=""
          fill
          sizes="44px"
          className="object-contain"
          priority
        />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-black tracking-[0.24em] text-white">
          BUILD PROFIT
        </span>
        <span className="block text-xs font-semibold tracking-[0.18em] text-emerald-300">
          SOLUTIONS
        </span>
      </span>
    </Link>
  );
}

export function SiteNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={
            item.href === "/"
              ? (event) => handleHomeClick(event, pathname)
              : undefined
          }
          className="text-sm font-semibold text-slate-300 transition hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function MobileNavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (href === "/") {
          handleHomeClick(event, pathname);
        }
        onNavigate();
      }}
      className="block rounded-xl px-4 py-3 text-base font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

export function MobileSiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-site-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:border-emerald-200 hover:bg-white/10"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav
            id="mobile-site-nav"
            aria-label="Mobile navigation"
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl"
          >
            <div className="grid gap-1">
              {navItems.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
            <div className="mt-2 border-t border-white/10 p-2">
              {siteLaunch.isPrelaunch ? (
                <a
                  href={siteLinks.contact}
                  onClick={() => setOpen(false)}
                  className="block rounded-full border border-emerald-300/35 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white transition hover:border-emerald-200 hover:bg-white/15"
                >
                  Contact
                </a>
              ) : (
                <div className="grid gap-2">
                  <Link
                    href={siteLinks.webApp}
                    onClick={() => setOpen(false)}
                    className="block rounded-full border border-emerald-300/35 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white transition hover:border-emerald-200 hover:bg-white/15"
                  >
                    Open Web App
                  </Link>
                  <Link
                    href={siteLinks.signUp}
                    onClick={() => setOpen(false)}
                    className="block rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:brightness-110"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
