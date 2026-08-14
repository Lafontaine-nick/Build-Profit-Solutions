/**
 * Electrical Phase 2K — rough-in package pricing.
 *
 * Generic rough-point split and the whole-project planning allowance are
 * LOCKED. The $10,000 figure is a fallback estimating allowance, not a
 * universal national-average rough price. Confirm detailed device/circuit
 * takeoff before final bid.
 *
 * DETAILED MODE: any 2A–2I canonical count already owns circuits, boxes,
 * devices, fixtures, hookups, raceway, or modifications. electrical_rough
 * must not auto-price beside those cards.
 *
 * PACKAGE MODE: notes like "electrical rough-in" / "rough-in" with no
 * detailed 2A–2I counts. The package is a whole-project allowance or a
 * user-entered rough-point count — never living SF. A vague "electrical
 * work" note does not activate the $10,000 package. A bare include-rough
 * flag does not invent a circuit count and does not create 2B circuit cards.
 *
 * The $250/EA rate is a generic rough electrical point allowance only when
 * the contractor enters a rough-point count and has not supplied the
 * detailed 2A–2I breakdown. It does not compete with locked $300 standard
 * homeruns, $400 dedicated circuits, $110 receptacles, or $150 fixtures.
 *
 * Package owns: standard residential branch-circuit rough wiring, boxes,
 * cable/conductors, basic supports, and rough-in labor.
 * Does not include service/panel work, trim devices/plates, light fixtures,
 * fans, appliance hookups, low voltage, EV, conduit/trenching, utility work,
 * wall repair, specialty systems, or work already priced on detailed
 * Electrical cards. electrical_trim may stack only in true package mode.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_ROUGH_ITEM_ID = 'electrical_rough';

export const ELECTRICAL_ROUGH_RATES_STATUS = 'locked';

export const ELECTRICAL_ROUGH_RATE_SOURCE_LABEL =
  'Electrical rough-in · approved generic rough-point $250/EA · $10,000 planning allowance when no 2A–2I counts · confirm takeoff before bid';

export const ELECTRICAL_ROUGH_PACKAGE_HELPER =
  'Whole-project electrical rough-in planning allowance — $10,000. Standard residential branch-circuit rough wiring, boxes, cable/conductors, basic supports and rough-in labor. Planning allowance only; confirm detailed device/circuit takeoff before final bid. Does not include service/panel work, trim devices/plates, light fixtures, fans, appliance hookups, low voltage, EV, conduit/trenching, utility work, wall repair, specialty systems, or work already priced on detailed Electrical cards. A rough flag without a point count does not invent a count. Living SF is not the quantity.';

type Split = { material: number; labor: number };

/**
 * Locked generic rough-point allowance. Below locked 2B standard-circuit $300
 * because this is not a priced homerun card.
 */
const ROUGH_PER_COUNT_RATES: Split = { material: 75, labor: 175 };

/**
 * Locked whole-project rough-in planning allowance when no circuit count
 * exists. Not a universal national-average rough price. Not living SF.
 */
const ROUGH_PACKAGE_RATES: Split = { material: 3000, labor: 7000 };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isElectricalRoughItemId(
  itemId: string | null | undefined
): itemId is typeof ELECTRICAL_ROUGH_ITEM_ID {
  return itemId === ELECTRICAL_ROUGH_ITEM_ID;
}

export type ElectricalRoughPricingInput = {
  itemId: string;
  quantity?: number | null;
  unit?: string | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalIncludeRough?: boolean | null;
  electricalScope?: string[] | null;
  roughPackageRequested?: boolean | null;
};

function normalizeUnit(unit: string | null | undefined): string {
  return String(unit || '').trim().toLowerCase();
}

function positiveQuantity(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function electricalRoughUsesPerCountBasis(
  input: ElectricalRoughPricingInput
): boolean {
  const qty = positiveQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  return qty != null && unit === 'each';
}

export function electricalRoughPackageRequested(
  input: ElectricalRoughPricingInput
): boolean {
  if (input.roughPackageRequested === true) return true;
  if (input.electricalIncludeRough === true) return true;
  if (
    Array.isArray(input.electricalScope) &&
    input.electricalScope.includes(ELECTRICAL_ROUGH_ITEM_ID)
  ) {
    return true;
  }
  if (electricalRoughUsesPerCountBasis(input)) return true;
  const qty = positiveQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  if (qty != null && (unit === 'allowance' || unit === 'lump_sum') && qty > 1) {
    return true;
  }
  return false;
}

export function electricalRoughCardShouldPrice(
  input: ElectricalRoughPricingInput
): boolean {
  if (!isElectricalRoughItemId(input.itemId)) return false;
  if (electricalRoughUsesPerCountBasis(input)) return true;
  return electricalRoughPackageRequested(input);
}

export type ElectricalRoughQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each' | 'allowance';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_ROUGH_RATES_STATUS;
};

export function quoteElectricalRough(
  input: ElectricalRoughPricingInput
): ElectricalRoughQuote | null {
  if (!electricalRoughCardShouldPrice(input)) return null;

  const perCount = electricalRoughUsesPerCountBasis(input);
  const quantity = perCount ? Number(input.quantity) : 1;
  const split = perCount ? ROUGH_PER_COUNT_RATES : ROUGH_PACKAGE_RATES;
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    perCount && condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = perCount
    ? [
        `${quantity} EA · generic rough-point allowance`,
        'not a $300 homerun card',
        'devices / plates / fixtures not included',
        conditionLabel,
        'approved split',
      ].join(' · ')
    : [
        'Whole-project electrical rough-in planning allowance — $10,000',
        'use only when detailed 2A–2I counts are unavailable',
        'confirm detailed device/circuit takeoff before final bid',
        'not a national-average rough price',
        'service / trim / fixtures / hookups not included',
      ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: perCount ? 'each' : 'allowance',
    laborMultiplier,
    specialty: !perCount,
    helper,
    rateSourceLabel: ELECTRICAL_ROUGH_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_ROUGH_RATES_STATUS,
  };
}

export type ElectricalRoughSuggestedPricing = {
  fill: {
    material: number;
    labor: number;
    total: number;
    materialSource: 'national_average';
    laborSource: 'national_average';
    rateSourceLabel: string;
    helper: string;
    mode: 'suggested_price';
    splitSource: 'estimated';
    splitConfidence: 'medium';
    basis: { quantity: number; unit: 'each' | 'allowance' };
    productionStatus: 'production_ready' | 'review_required';
    benchmarkLevel: 'component';
    benchmarkScopeKey: string;
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalRoughSuggestedPricing(
  input: ElectricalRoughPricingInput
): ElectricalRoughSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalRough(input);
  if (!quote) return { fill: null, comparison: null };
  return {
    fill: {
      material: quote.material,
      labor: quote.labor,
      total: quote.total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: quote.rateSourceLabel,
      helper: quote.helper,
      mode: 'suggested_price',
      splitSource: 'estimated',
      splitConfidence: 'medium',
      basis: { quantity: quote.quantity, unit: quote.unit },
      productionStatus: quote.specialty ? 'review_required' : 'production_ready',
      benchmarkLevel: 'component',
      benchmarkScopeKey: ELECTRICAL_ROUGH_ITEM_ID,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_rough:${ELECTRICAL_ROUGH_ITEM_ID}`,
    },
    comparison: null,
  };
}
