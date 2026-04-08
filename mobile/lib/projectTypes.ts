/**
 * Canonical estimate project types — keep in sync with estimate-generator PROJECT_TYPES.
 */
export const ESTIMATE_PROJECT_TYPE_ORDER = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "room_addition", label: "Room Add." },
  { value: "home_addition", label: "Home Add." },
  { value: "new_build", label: "New Build" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
] as const;

export type EstimateProjectTypeKey =
  (typeof ESTIMATE_PROJECT_TYPE_ORDER)[number]["value"];

const CANONICAL_VALUES = new Set<string>(
  ESTIMATE_PROJECT_TYPE_ORDER.map((t) => t.value)
);

/** Slugs saved on bids / categories → canonical type */
const CATEGORY_SLUG_TO_TYPE: Record<string, EstimateProjectTypeKey> = {
  "kitchen-remodel": "kitchen",
  "bathroom-remodel": "bathroom",
  addition: "room_addition",
  "home-renovation": "home_addition",
  "new-build": "new_build",
  landscaping: "landscaping",
  other: "other",
};

/**
 * Map arbitrary project/estimate fields to a canonical estimate project type.
 * Mirrors estimate-generator normalizeScope, plus slug and enum handling.
 */
export function normalizeEstimateProjectType(raw: unknown): EstimateProjectTypeKey {
  if (raw == null || raw === "") return "other";

  const slug = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_");

  if (CANONICAL_VALUES.has(slug)) {
    return slug as EstimateProjectTypeKey;
  }

  const fromCategory = CATEGORY_SLUG_TO_TYPE[slug];
  if (fromCategory) return fromCategory;

  if (slug.includes("kitchen")) return "kitchen";
  if (slug.includes("bathroom")) return "bathroom";
  if (slug.includes("room_add")) return "room_addition";
  if (slug.includes("home_add") || slug.includes("home-renov"))
    return "home_addition";
  if (
    slug.includes("new_build") ||
    slug.includes("new-build") ||
    slug.includes("newhome") ||
    slug.includes("custom")
  )
    return "new_build";
  if (slug.includes("landscape")) return "landscaping";

  return "other";
}
