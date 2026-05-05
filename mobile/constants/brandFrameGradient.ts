/**
 * Brand neon green → electric blue frame for 1px `LinearGradient` rings and filled CTAs.
 * Same stops as Project Overview (`overviewGradientRing` in `app/project-detail/[id].tsx`).
 * Use everywhere instead of `rgba(45,255,196,0.8)` / `#22c55e` mixes so borders stay vivid on #000.
 */
export const BRAND_FRAME_GRADIENT_COLORS: [string, string] = ["#2DFFC4", "#00A6FF"];

export const BRAND_FRAME_GRADIENT_START = { x: 0.05, y: 0.15 };

export const BRAND_FRAME_GRADIENT_END = { x: 0.95, y: 0.85 };
