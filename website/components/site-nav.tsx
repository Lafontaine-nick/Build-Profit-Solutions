"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
      className="flex items-center rounded-2xl px-4 py-3.5 text-base font-semibold text-slate-100 transition active:bg-white/10 hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MobileSiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  const menuPortal =
    open
      ? createPortal(
          <>
            <div
              role="presentation"
              aria-hidden="true"
              className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-[2px]"
              onClick={closeMenu}
            />
            <nav
              id="mobile-site-nav"
              aria-label="Mobile navigation"
              className="fixed inset-y-0 right-0 z-[101] flex w-[min(100vw,20rem)] flex-col border-l border-white/10 bg-slate-950/98 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl"
              style={{
                paddingTop: "max(1rem, env(safe-area-inset-top))",
                paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">
                  Menu
                </p>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={closeMenu}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:border-emerald-200 hover:bg-white/10"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="grid gap-1">
                  {navItems.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      onNavigate={closeMenu}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                {siteLaunch.isPrelaunch ? (
                  <a
                    href={siteLinks.contact}
                    onClick={closeMenu}
                    className="block rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3.5 text-center text-sm font-black text-slate-950 transition hover:brightness-110"
                  >
                    Request Early Access
                  </a>
                ) : (
                  <div className="grid gap-2">
                    <Link
                      href={siteLinks.webApp}
                      onClick={closeMenu}
                      className="block rounded-full border border-emerald-300/35 bg-white/10 px-4 py-3.5 text-center text-sm font-bold text-white transition hover:border-emerald-200 hover:bg-white/15"
                    >
                      Open Web App
                    </Link>
                    <Link
                      href={siteLinks.signUp}
                      onClick={closeMenu}
                      className="block rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3.5 text-center text-sm font-black text-slate-950 transition hover:brightness-110"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </>,
          document.body,
        )
      : null;

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
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {menuPortal}
    </div>
  );
}
