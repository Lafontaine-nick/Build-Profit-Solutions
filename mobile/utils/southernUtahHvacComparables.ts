/**
 * Ground-up / selected-trade HVAC package comparables from SHV Iron Mesa Lots
 * 39/41/49/58 H64 installed HVAC line items.
 *
 * Plan 58 reference = ~$18,500 for a complete 1-system package on 3,660 SF living.
 * Vision takeoff may read multiple systems; the barometer stays 1-system unless
 * the contractor confirms a higher count from mechanical schedules.
 */

import { splitInstalledPackageByMaterialShare } from '@/utils/groundUpFinishPackages';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

const MEP_ROUGH_MATERIAL_SHARE = 0.3;

/** H64 — HVAC installed lump (complete system package). */
export const HVAC_H64_INSTALLED_BY_PROJECT: Record<SouthernUtahProjectId, number> =
  {
    silverLeaf: 12000,
    lot39: 21500,
    lot41: 16500,
    lot49: 19500,
    lot58: 18500,
  };

export type HvacPackageComparable = {
  projectId: SouthernUtahProjectId;
  projectLabel: string;
  h64InstalledTotal: number;
};

export function hvacH64InstalledForProject(
  projectId: SouthernUtahProjectId
): number {
  return HVAC_H64_INSTALLED_BY_PROJECT[projectId] || 0;
}

export function resolveHvacPackageComparable(
  livingSf?: number | null
): HvacPackageComparable | null {
  const project = matchSouthernUtahProjectByLivingSf(Number(livingSf));
  if (!project) return null;
  const h64InstalledTotal = hvacH64InstalledForProject(project.id);
  if (!(h64InstalledTotal > 0)) return null;
  return {
    projectId: project.id,
    projectLabel: project.label,
    h64InstalledTotal,
  };
}

export function hvacPackageComparableHelper(
  comparable: HvacPackageComparable
): string {
  return `${comparable.projectLabel} H64 HVAC package ~$${comparable.h64InstalledTotal.toLocaleString()} (1 system)`;
}

export const HVAC_NATIONAL_COMPLETE_PACKAGE_RANGE = {
  low: 15000,
  high: 22000,
} as const;

/** BPS planning band for a standard ducted new-construction package before mechanical proof. */
export const HVAC_BPS_PLANNING_PACKAGE_RANGE = {
  low: 17000,
  high: 21000,
} as const;

export type HvacPricingEvidenceTier =
  | 'plan_barometer'
  | 'verified_equipment'
  | 'national_planning'
  | 'unpriced';

function isVerifiedHvacProvenanceEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  if (record.pricingEligible === false) return false;
  const normalized = String(record.normalizedSource || '').toUpperCase();
  const status = String(record.status || '').toLowerCase();
  if (
    normalized === 'NEEDS_REVIEW' ||
    normalized === 'NEEDS_CONFIRMATION' ||
    status === 'needs_review'
  ) {
    return false;
  }
  if (
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' &&
    String(record.confirmedFrom || '').toUpperCase() === 'PLAN_REVIEW' &&
    record.pricingEligible !== false
  ) {
    return true;
  }
  if (normalized === 'FROM_PLAN' || status === 'plan_verified') return true;
  const source = String(record.source || '').toLowerCase();
  return (
    source.includes('equipment_schedule') ||
    source === 'pdf_text_instance_tags' ||
    source.includes('pdf_text_equipment')
  );
}

function livingSfFromHvacInput(input: Record<string, unknown>): number | null {
  const fromField = Number(String(input.floorAreaSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const fromFacts = Number(
    (input.planFacts as { buildingAreas?: { totalLivingSqft?: number } } | undefined)
      ?.buildingAreas?.totalLivingSqft
  );
  return Number.isFinite(fromFacts) && fromFacts > 0 ? fromFacts : null;
}

/** Decide whether HVAC should price as a complete package or verified equipment takeoff. */
export function resolveHvacPricingEvidenceTier(
  input: Record<string, unknown>
): HvacPricingEvidenceTier {
  const provenance = (input.measurementProvenance || {}) as Record<
    string,
    unknown
  >;
  const sources = (input.quickMeasurementSources || {}) as Record<
    string,
    string
  >;
  const systemCount = Number(String(input.hvacSystemCount ?? '').replace(/,/g, ''));
  const hasSystemCount = Number.isFinite(systemCount) && systemCount > 0;
  const tonsValue = Number(String(input.hvacSystemTons ?? '').replace(/,/g, ''));
  const countNeedsReview =
    hasSystemCount &&
    sources.hvacSystemCount === 'needs_confirmation';
  const countVerified =
    sources.hvacSystemCount === 'contractor_confirmed_from_plan_review' ||
    sources.hvacSystemCount === 'plan_verified' ||
    isVerifiedHvacProvenanceEntry(provenance.hvacSystemCount);
  const tonsNeedsReview =
    Number.isFinite(tonsValue) &&
    tonsValue > 0 &&
    sources.hvacSystemTons === 'needs_confirmation';
  const tonsVerified =
    !Number.isFinite(tonsValue) ||
    tonsValue <= 0 ||
    sources.hvacSystemTons === 'contractor_confirmed_from_plan_review' ||
    sources.hvacSystemTons === 'plan_verified' ||
    isVerifiedHvacProvenanceEntry(provenance.hvacSystemTons);

  if (hasSystemCount && countVerified && tonsVerified && !countNeedsReview) {
    return 'verified_equipment';
  }

  if (resolveHvacPackageComparable(livingSfFromHvacInput(input))) {
    return 'plan_barometer';
  }

  if (livingSfFromHvacInput(input)) {
    return 'national_planning';
  }

  return 'unpriced';
}

export function hvacUsesInstalledPackagePricing(
  input: Record<string, unknown>
): boolean {
  const tier = resolveHvacPricingEvidenceTier(input);
  return tier === 'plan_barometer' || tier === 'national_planning';
}

export const HVAC_COMPONENT_SCOPE_ITEM_IDS = [
  'ductwork',
  'supply_registers',
  'return_grilles',
  'thermostat',
  'ventilation',
] as const;

export function hvacPlanBarometerComparisonSplit(total: number): {
  material: number;
  labor: number;
} {
  return splitInstalledPackageByMaterialShare(total, MEP_ROUGH_MATERIAL_SHARE);
}

export function isHvacComponentScopeItemId(itemId: string): boolean {
  return (HVAC_COMPONENT_SCOPE_ITEM_IDS as readonly string[]).includes(itemId);
}

export function resolveHvacInstalledPackageSuggestedTotal(
  input: Record<string, unknown>
): {
  total: number;
  material: number;
  labor: number;
  comparable: HvacPackageComparable | null;
  tier: HvacPricingEvidenceTier;
} | null {
  const tier = resolveHvacPricingEvidenceTier(input);
  if (tier === 'verified_equipment' || tier === 'unpriced') return null;
  const livingSf = livingSfFromHvacInput(input);
  if (tier === 'plan_barometer') {
    const comparable = resolveHvacPackageComparable(livingSf);
    if (!comparable) return null;
    const split = hvacPlanBarometerComparisonSplit(comparable.h64InstalledTotal);
    return {
      total: comparable.h64InstalledTotal,
      material: split.material,
      labor: split.labor,
      comparable,
      tier,
    };
  }
  const midpoint = roundHvacPackageTotal(
    (HVAC_BPS_PLANNING_PACKAGE_RANGE.low +
      HVAC_BPS_PLANNING_PACKAGE_RANGE.high) /
      2
  );
  const split = hvacPlanBarometerComparisonSplit(midpoint);
  return {
    total: midpoint,
    material: split.material,
    labor: split.labor,
    comparable: null,
    tier,
  };
}

function roundHvacPackageTotal(value: number): number {
  return Math.round(value / 100) * 100;
}
