/**
 * Electrical Phase 2G — life safety / low-voltage pricing.
 *
 * Device / drop splits are LOCKED. These cards are the device or drop
 * only. They do not include a new homerun unless that circuit card is
 * explicitly selected. Camera prewire is cable/drop only — not cameras
 * or equipment. Do not also count the same drop as CAT6 and security
 * prewire. Do not price electrical_rough here.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_SPECIAL_SYSTEM_ITEM_IDS = [
  'electrical_smoke_detector',
  'electrical_co_detector',
  'electrical_doorbell',
  'electrical_cat6_drop',
  'electrical_tv_coax',
  'electrical_security_prewire',
  'electrical_camera_prewire',
] as const;

export type ElectricalSpecialSystemItemId =
  (typeof ELECTRICAL_SPECIAL_SYSTEM_ITEM_IDS)[number];

export const ELECTRICAL_SPECIAL_SYSTEM_RATES_STATUS = 'locked';

export const ELECTRICAL_SPECIAL_SYSTEM_RATE_SOURCE_LABEL =
  'Electrical life-safety/low-voltage · approved device/drop split · homerun not included';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits for device or drop install.
 */
const SPECIAL_SYSTEM_RATES: Record<ElectricalSpecialSystemItemId, Split> = {
  electrical_smoke_detector: { material: 45, labor: 130 },
  electrical_co_detector: { material: 40, labor: 120 },
  electrical_doorbell: { material: 35, labor: 90 },
  electrical_cat6_drop: { material: 40, labor: 85 },
  electrical_tv_coax: { material: 25, labor: 70 },
  electrical_security_prewire: { material: 30, labor: 85 },
  electrical_camera_prewire: { material: 35, labor: 90 },
};

export function isElectricalSpecialSystemItemId(
  itemId: string | null | undefined
): itemId is ElectricalSpecialSystemItemId {
  return Boolean(
    itemId &&
      (ELECTRICAL_SPECIAL_SYSTEM_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalSpecialSystemPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
};

export function electricalSpecialSystemCardShouldPrice(
  itemId: ElectricalSpecialSystemItemId,
  input: ElectricalSpecialSystemPricingInput
): boolean {
  const qty = Number(input.quantity);
  return (
    Number.isFinite(qty) && qty > 0 && isElectricalSpecialSystemItemId(itemId)
  );
}

export type ElectricalSpecialSystemQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_SPECIAL_SYSTEM_RATES_STATUS;
};

export function quoteElectricalSpecialSystem(
  input: ElectricalSpecialSystemPricingInput
): ElectricalSpecialSystemQuote | null {
  if (!isElectricalSpecialSystemItemId(input.itemId)) return null;
  if (!electricalSpecialSystemCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = SPECIAL_SYSTEM_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = [
    `${quantity} EA · device / drop`,
    'homerun not included',
    conditionLabel,
    'approved split',
  ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: 'each',
    laborMultiplier,
    helper,
    rateSourceLabel: ELECTRICAL_SPECIAL_SYSTEM_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_SPECIAL_SYSTEM_RATES_STATUS,
  };
}

export type ElectricalSpecialSystemSuggestedPricing = {
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
    basis: { quantity: number; unit: 'each' };
    productionStatus: 'production_ready';
    benchmarkLevel: 'component';
    benchmarkScopeKey: string;
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalSpecialSystemSuggestedPricing(
  input: ElectricalSpecialSystemPricingInput
): ElectricalSpecialSystemSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalSpecialSystem(input);
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
      basis: { quantity: quote.quantity, unit: 'each' },
      productionStatus: 'production_ready',
      benchmarkLevel: 'component',
      benchmarkScopeKey: input.itemId,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_special:${input.itemId}`,
    },
    comparison: null,
  };
}
