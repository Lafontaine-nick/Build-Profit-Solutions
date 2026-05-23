"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/site";

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
