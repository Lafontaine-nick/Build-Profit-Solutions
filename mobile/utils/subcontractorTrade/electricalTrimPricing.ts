/**
 * Electrical Phase 2J — trim-out package pricing.
 *
 * Existing-box per-device split and the whole-project planning allowance
 * are LOCKED. The $2,500 figure is a fallback estimating allowance, not a
 * universal national-average trim price. Confirm actual quantity before
 * final bid.
 *
 * DETAILED MODE: receptacle / switch / fixture / fan counts already own
 * device + box + plate (and fixture + hang). electrical_trim must not
 * auto-price beside those cards.
 *
 * PACKAGE MODE: notes like "electrical trim-out", "finish electrical", or
 * "install devices and plates" with no detailed device counts. The package
 * is a whole-project allowance or a user-entered trim device count — never
 * living SF. A bare include-trim flag does not invent a device count.
 *
 * Package owns: setting/replacing standard receptacles and switches,
 * plates/covers, final trim-out labor, basic testing, labeling / punch.
 * Does not include light fixtures, fans, appliance hookups, specialty
 * devices, or new circuits. Also excludes service/panel, low voltage,
 * relocations, conduit/trenching, wall repair, and anything already on
 * detailed 2A–2I cards. Do not price electrical_rough here.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_TRIM_ITEM_ID = 'electrical_trim';

export const ELECTRICAL_TRIM_RATES_STATUS = 'locked';

export const ELECTRICAL_TRIM_RATE_SOURCE_LABEL =
  'Electrical trim-out · approved existing-box $55/EA · $2,500 planning allowance when no device count · confirm quantity before bid';

export const ELECTRICAL_TRIM_PACKAGE_HELPER =
  'Existing box/wiring electrical trim-out — standard receptacles/switches/plates, device installation, testing and labeling. No new circuit/homerun. Does not include light fixtures, fans, appliance hookups, specialty devices, or new circuits. Detailed receptacle / switch / fixture / fan counts own those cards instead. A trim flag without a device count does not invent a count. The $2,500 whole-project figure is a planning allowance only — confirm actual quantity before final bid.';

type Split = { material: number; labor: number };

/** Locked existing-box device + plate average. Below locked 2C $110 new-install. */
const TRIM_PER_DEVICE_RATES: Split = { material: 20, labor: 35 };

/**
 * Locked whole-project trim-out planning allowance when no device count exists.
 * Not a universal national-average trim price. Not derived from living SF.
 */
const TRIM_PACKAGE_RATES: Split = { material: 750, labor: 1750 };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isElectricalTrimItemId(
  itemId: string | null | undefined
): itemId is typeof ELECTRICAL_TRIM_ITEM_ID {
  return itemId === ELECTRICAL_TRIM_ITEM_ID;
}

export type ElectricalTrimPricingInput = {
  itemId: string;
  quantity?: number | null;
  unit?: string | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalIncludeTrim?: boolean | null;
  electricalScope?: string[] | null;
  trimPackageRequested?: boolean | null;
};

function normalizeUnit(unit: string | null | undefined): string {
  return String(unit || '').trim().toLowerCase();
}

function positiveQuantity(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function electricalTrimUsesPerDeviceBasis(
  input: ElectricalTrimPricingInput
): boolean {
  const qty = positiveQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  return qty != null && unit === 'each';
}

export function electricalTrimPackageRequested(
  input: ElectricalTrimPricingInput
): boolean {
  if (input.trimPackageRequested === true) return true;
  if (input.electricalIncludeTrim === true) return true;
  if (
    Array.isArray(input.electricalScope) &&
    input.electricalScope.includes(ELECTRICAL_TRIM_ITEM_ID)
  ) {
    return true;
  }
  if (electricalTrimUsesPerDeviceBasis(input)) return true;
  const qty = positiveQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  if (qty != null && (unit === 'allowance' || unit === 'lump_sum') && qty > 1) {
    return true;
  }
  return false;
}

export function electricalTrimCardShouldPrice(
  input: ElectricalTrimPricingInput
): boolean {
  if (!isElectricalTrimItemId(input.itemId)) return false;
  if (electricalTrimUsesPerDeviceBasis(input)) return true;
  return electricalTrimPackageRequested(input);
}

export type ElectricalTrimQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each' | 'allowance';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_TRIM_RATES_STATUS;
};

export function quoteElectricalTrim(
  input: ElectricalTrimPricingInput
): ElectricalTrimQuote | null {
  if (!electricalTrimCardShouldPrice(input)) return null;

  const perDevice = electricalTrimUsesPerDeviceBasis(input);
  const quantity = perDevice ? Number(input.quantity) : 1;
  const split = perDevice ? TRIM_PER_DEVICE_RATES : TRIM_PACKAGE_RATES;
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    perDevice && condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = perDevice
    ? [
        `${quantity} EA · existing-box device / plate`,
        'no new circuit/homerun',
        'fixtures / fans not included',
        conditionLabel,
        'approved split',
      ].join(' · ')
    : [
        'Electrical trim-out planning allowance — $2,500',
        'use only when detailed device/fixture counts are unavailable',
        'confirm actual quantity before final bid',
        'not a national-average trim price',
        'fixtures / fans not included',
      ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: perDevice ? 'each' : 'allowance',
    laborMultiplier,
    specialty: !perDevice,
    helper,
    rateSourceLabel: ELECTRICAL_TRIM_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_TRIM_RATES_STATUS,
  };
}

export type ElectricalTrimSuggestedPricing = {
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

export function resolveElectricalTrimSuggestedPricing(
  input: ElectricalTrimPricingInput
): ElectricalTrimSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalTrim(input);
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
      benchmarkScopeKey: ELECTRICAL_TRIM_ITEM_ID,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_trim:${ELECTRICAL_TRIM_ITEM_ID}`,
    },
    comparison: null,
  };
}
