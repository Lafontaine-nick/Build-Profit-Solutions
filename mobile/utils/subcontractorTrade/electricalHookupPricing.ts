/**
 * Electrical Phase 2F — appliance / equipment hookup pricing.
 *
 * Owned circuit + connection splits are LOCKED. EV and HVAC remain
 * specialty / confirm. A hookup card owns the appliance circuit and the
 * connection. Do not also price the generic circuit card or a 240V
 * receptacle for the same appliance. Do not price electrical_rough here.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_HOOKUP_ITEM_IDS = [
  'electrical_range_hookup',
  'electrical_dryer_hookup',
  'electrical_dishwasher_hookup',
  'electrical_disposal_hookup',
  'electrical_microwave_hookup',
  'electrical_refrigerator_hookup',
  'electrical_water_heater_hookup',
  'electrical_hvac_hookup',
  'electrical_ev_charger_hookup',
] as const;

export type ElectricalHookupItemId = (typeof ELECTRICAL_HOOKUP_ITEM_IDS)[number];

export const ELECTRICAL_HOOKUP_RATES_STATUS = 'locked';

export const ELECTRICAL_HOOKUP_RATE_SOURCE_LABEL =
  'Electrical hookup · approved owned-circuit split · EV/HVAC specialty / confirm';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits.
 * Price includes the owned homerun and the appliance connection.
 */
const HOOKUP_RATES: Record<ElectricalHookupItemId, Split> = {
  electrical_range_hookup: { material: 225, labor: 725 },
  electrical_dryer_hookup: { material: 160, labor: 515 },
  electrical_dishwasher_hookup: { material: 85, labor: 415 },
  electrical_disposal_hookup: { material: 70, labor: 380 },
  electrical_microwave_hookup: { material: 85, labor: 415 },
  electrical_refrigerator_hookup: { material: 70, labor: 380 },
  electrical_water_heater_hookup: { material: 150, labor: 500 },
  electrical_hvac_hookup: { material: 175, labor: 425 },
  electrical_ev_charger_hookup: { material: 400, labor: 850 },
};

const SPECIALTY_HOOKUPS = new Set<ElectricalHookupItemId>([
  'electrical_hvac_hookup',
  'electrical_ev_charger_hookup',
]);

export function isElectricalHookupItemId(
  itemId: string | null | undefined
): itemId is ElectricalHookupItemId {
  return Boolean(
    itemId && (ELECTRICAL_HOOKUP_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalHookupPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
};

export function electricalHookupCardShouldPrice(
  itemId: ElectricalHookupItemId,
  input: ElectricalHookupPricingInput
): boolean {
  const qty = Number(input.quantity);
  return Number.isFinite(qty) && qty > 0 && isElectricalHookupItemId(itemId);
}

export type ElectricalHookupQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_HOOKUP_RATES_STATUS;
};

export function quoteElectricalHookup(
  input: ElectricalHookupPricingInput
): ElectricalHookupQuote | null {
  if (!isElectricalHookupItemId(input.itemId)) return null;
  if (!electricalHookupCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = HOOKUP_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const specialty = SPECIALTY_HOOKUPS.has(input.itemId);
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = [
    `${quantity} EA · includes dedicated circuit + connection`,
    'not a plug-in only',
    'generic circuit not stacked',
    conditionLabel,
    specialty ? 'specialty / confirm' : 'approved hookup split',
  ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: 'each',
    laborMultiplier,
    specialty,
    helper,
    rateSourceLabel: ELECTRICAL_HOOKUP_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_HOOKUP_RATES_STATUS,
  };
}

export type ElectricalHookupSuggestedPricing = {
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
    productionStatus: 'production_ready' | 'review_required';
    benchmarkLevel: 'component';
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalHookupSuggestedPricing(
  input: ElectricalHookupPricingInput
): ElectricalHookupSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalHookup(input);
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
      productionStatus: quote.specialty ? 'review_required' : 'production_ready',
      benchmarkLevel: 'component',
      benchmarkScopeKey: input.itemId,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_hookup:${input.itemId}`,
    },
    comparison: null,
  };
}
