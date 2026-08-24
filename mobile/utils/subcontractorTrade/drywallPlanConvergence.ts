/**
 * Canonical drywall measurements for plan export, notes, and manual entry.
 *
 * Drywall is an interior wall + ceiling surface quantity. Living area is only
 * a transparent planning fallback; it is never treated as a plan takeoff.
 */

export const DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS = [
  'drywallSqft',
  'drywallWallSqft',
  'drywallCeilingSqft',
  'drywallOpeningDeductionSqft',
  'floorAreaSqft',
  'garageSqft',
  'storyCount',
  'wallHeightFt',
  'plateHeightFt',
] as const;

export const DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS = [
  'drywallSqft',
  'drywallWallSqft',
  'drywallCeilingSqft',
  'drywallOpeningDeductionSqft',
] as const;

export type DrywallMeasurementKey =
  (typeof DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS)[number];

export const DRYWALL_PLAN_ALIASES: Record<string, DrywallMeasurementKey> = {
  drywallSurfaceSqft: 'drywallSqft',
  drywallSurfaceAreaSqft: 'drywallSqft',
  wallCeilingDrywallSqft: 'drywallSqft',
  drywallWallsSqft: 'drywallWallSqft',
  drywallWallSurfaceSqft: 'drywallWallSqft',
  drywallCeilingsSqft: 'drywallCeilingSqft',
  drywallCeilingSurfaceSqft: 'drywallCeilingSqft',
  drywallOpeningsSqft: 'drywallOpeningDeductionSqft',
};

export const DRYWALL_PLAN_SCOPE_ALLOWLIST = [
  'drywall',
  'hang',
  'finish_tape',
  'texture',
  'patch_repair',
  'demo_removal',
  'cleanup',
];

/** Installed drywall assembly split for SHV-matched production planning. */
export const DRYWALL_PRODUCTION_ASSEMBLY_BASELINE = {
  material: 0.9,
  labor: 1.31,
} as const;

export const DRYWALL_PRODUCTION_RATE_CARD_LABEL = 'Production planning rate';

const PROTECTED_QUANTITY_SOURCES = new Set([
  'user_entered',
  'manual_override',
  'user_confirmed_suggestion',
  'contractor_confirmed_from_plan_review',
  'plan_verified',
  'plan_detected',
  'plan_vision',
  'calculated_from_components',
  'measured_from_geometry',
]);

function positiveNumber(value: unknown): number | null {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rounded(value: number): number {
  return Math.round(value);
}

function numberFromMatch(match: RegExpMatchArray | null): number | null {
  return match?.[1] ? positiveNumber(match[1]) : null;
}

function quantitySource(
  input: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const sources = input.quickMeasurementSources;
  if (sources && typeof sources === 'object' && !Array.isArray(sources)) {
    const source = (sources as Record<string, unknown>)[key];
    if (typeof source === 'string' && source) return source;
  }
  const itemQuantities = input.itemQuantities;
  if (
    itemQuantities &&
    typeof itemQuantities === 'object' &&
    !Array.isArray(itemQuantities)
  ) {
    const item = (itemQuantities as Record<string, unknown>)[key];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const source = (item as Record<string, unknown>).quantitySource;
      if (typeof source === 'string' && source) return source;
    }
  }
  return fallback;
}

/** True when an existing quantity must not be replaced by a planning fallback. */
export function isProtectedDrywallQuantity(
  input: Record<string, unknown>,
  key = 'drywallSqft'
): boolean {
  return PROTECTED_QUANTITY_SOURCES.has(quantitySource(input, key, ''));
}

/**
 * Plan/notes quantities below 2.5× living area are generally floor-area
 * proxies rather than wall + ceiling surfaces. This intentionally matches the
 * existing Plan 39 correction threshold.
 */
export function isUndercountedDrywallSurface(
  drywallSqft: number,
  livingSqft: number | null | undefined
): boolean {
  const living = positiveNumber(livingSqft);
  if (!(drywallSqft > 0) || living == null) return false;
  if (Math.abs(drywallSqft - living) < 0.51) return true;
  return drywallSqft / living < 2.5;
}

export function drywallSurfacePlanningQuantity(
  livingSqft: number | null | undefined
): number | null {
  const living = positiveNumber(livingSqft);
  return living == null ? null : rounded(living * 3.5);
}

/**
 * Resolve a canonical total from explicit wall/ceiling components. Returns
 * null when the plan did not provide enough surface information.
 */
export function drywallSurfaceFromComponents(
  input: Record<string, unknown>
): number | null {
  const walls =
    positiveNumber(input.drywallWallSqft) ??
    positiveNumber(input.drywallWallsSqft);
  const ceilings =
    positiveNumber(input.drywallCeilingSqft) ??
    positiveNumber(input.drywallCeilingsSqft);
  if (walls == null && ceilings == null) return null;
  const openings =
    positiveNumber(input.drywallOpeningDeductionSqft) ??
    positiveNumber(input.drywallOpeningsSqft) ??
    0;
  return rounded(Math.max(0, (walls ?? 0) + (ceilings ?? 0) - openings));
}

/** True when the input contains an actual wall/ceiling surface takeoff. */
export function hasDrywallSurfaceComponentTakeoff(
  input: Record<string, unknown>
): boolean {
  return drywallSurfaceFromComponents(input) != null;
}

/**
 * Normalize plan output without manufacturing a quantity from living area.
 * A total is calculated only when wall and/or ceiling surface components are
 * explicitly supplied.
 */
export function normalizeDrywallPlanMeasurements(
  input: Record<string, unknown>
): Record<string, unknown> {
  const aliased = { ...input };
  for (const [alias, canonical] of Object.entries(DRYWALL_PLAN_ALIASES)) {
    if (positiveNumber(aliased[canonical]) != null) continue;
    const value = positiveNumber(aliased[alias]);
    if (value != null) aliased[canonical] = value;
  }

  const out: Record<string, unknown> = {};
  for (const key of DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveNumber(aliased[key]);
    if (value != null) out[key] = value;
  }

  const componentTotal = drywallSurfaceFromComponents(aliased);
  const existingTotal = positiveNumber(out.drywallSqft);
  const shouldUseComponentTotal =
    componentTotal != null &&
    (existingTotal == null ||
      isUndercountedDrywallSurface(
        existingTotal,
        positiveNumber(out.floorAreaSqft)
      )) &&
    !isProtectedDrywallQuantity(aliased);
  if (shouldUseComponentTotal) {
    out.drywallSqft = componentTotal;
  }
  return out;
}

/**
 * Small, deliberately conservative notes adapter. It only accepts quantities
 * that are adjacent to drywall/surface language; generic living-area numbers
 * are ignored.
 */
export function parseDrywallMeasurementsFromNotes(
  notes: string
): Record<string, number> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, number> = {};
  const assign = (key: string, value: number | null) => {
    if (value != null && value > 0) out[key] = rounded(value);
  };
  const number = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const unit = '(?:sf|sq\\.?\\s*ft\\.?|sqft|square\\s+feet)';

  assign(
    'drywallWallSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:interior\\s+)?wall(?:s)?\\s+drywall`,
          'i'
        )
      )
    ) ??
      numberFromMatch(
        text.match(
          new RegExp(
            `wall(?:s)?\\s*(?:area\\s*)?(?:is|are|=|:)\\s*${number}\\s*${unit}`,
            'i'
          )
        )
      )
  );
  assign(
    'drywallCeilingSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:interior\\s+)?ceiling(?:s)?\\s+drywall`,
          'i'
        )
      )
    ) ??
      numberFromMatch(
        text.match(
          new RegExp(
            `ceiling(?:s)?\\s*(?:area\\s*)?(?:is|are|=|:)\\s*${number}\\s*${unit}`,
            'i'
          )
        )
      )
  );
  assign(
    'drywallOpeningDeductionSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:drywall\\s*)?(?:opening|deduction)s?`,
          'i'
        )
      )
    )
  );

  const total =
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:wall\\s*(?:and|&)\\s*ceiling\\s*)?drywall`,
          'i'
        )
      )
    ) ??
    numberFromMatch(
      text.match(
        new RegExp(
          `drywall(?:\\s+(?:surface|area))?\\s*(?:is|=|:)\\s*${number}\\s*${unit}`,
          'i'
        )
      )
    );
  assign('drywallSqft', total);

  const componentTotal = drywallSurfaceFromComponents(out);
  if (out.drywallSqft == null && componentTotal != null) {
    out.drywallSqft = componentTotal;
  }
  return out;
}

export type DrywallStructuredMeasurements = {
  drywallScope?: string[] | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

export function buildDrywallStructuredMeasurements(
  input: Record<string, unknown>,
  quantitySource = 'user_entered'
): DrywallStructuredMeasurements {
  const normalized = normalizeDrywallPlanMeasurements(input);
  const total = positiveNumber(normalized.drywallSqft);
  if (total == null) return {};

  return {
    drywallScope: ['drywall'],
    itemQuantities: {
      drywall: {
        quantity: total,
        unit: 'sqft',
        quantitySource,
      },
    },
  };
}
