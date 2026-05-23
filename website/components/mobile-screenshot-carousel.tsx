"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type ScreenshotSlide = {
  title: string;
  eyebrow?: string;
  description: string;
  image: string;
  orientation?: string;
};

export function MobileScreenshotCarousel({
  slides,
}: {
  slides: ScreenshotSlide[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];

  const canNavigate = slides.length > 1;
  const imageFrameClass = useMemo(
    () =>
      activeSlide.orientation === "desktop"
        ? "aspect-[16/10] max-w-full"
        : "aspect-[9/16] max-h-[35rem] max-w-[19rem]",
    [activeSlide.orientation],
  );

  function goToPrevious() {
    setActiveIndex((current) => (current === 0 ? slides.length - 1 : current - 1));
  }

  function goToNext() {
    setActiveIndex((current) => (current + 1) % slides.length);
  }

  return (
    <div className="mx-auto max-w-xl rounded-[2rem] bg-gradient-to-br from-emerald-300/25 via-cyan-300/18 to-sky-500/20 p-px shadow-[0_20px_80px_rgba(0,255,200,0.08)] ring-1 ring-white/[0.04]">
      <div className="rounded-[calc(2rem-1px)] bg-slate-900/88 p-5 shadow-2xl shadow-cyan-950/20">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
          {activeSlide.eyebrow ?? "Product Tour"}
        </p>
        <h3 className="mt-3 text-2xl font-black text-white">{activeSlide.title}</h3>
        <p className="mt-3 leading-7 text-slate-300">{activeSlide.description}</p>

        <div
          className={`relative mx-auto mt-6 flex w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black/70 p-3 shadow-[0_20px_70px_rgba(34,211,238,0.10)] ring-1 ring-white/[0.04] ${imageFrameClass}`}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] bg-slate-950">
            <Image
              src={activeSlide.image}
              alt={`${activeSlide.title} screenshot`}
              fill
              sizes="(max-width: 1024px) 85vw"
              className="object-contain"
              priority={activeIndex === 0}
            />
          </div>
        </div>

        {canNavigate ? (
          <>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goToPrevious}
                className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-emerald-200 hover:bg-white/10"
              >
                Previous
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {activeIndex + 1} / {slides.length}
              </p>
              <button
                type="button"
                onClick={goToNext}
                className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:brightness-110"
              >
                Next
              </button>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  aria-label={`Show ${slide.title}`}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition ${
                    index === activeIndex
                      ? "w-8 bg-emerald-300"
                      : "w-2.5 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
