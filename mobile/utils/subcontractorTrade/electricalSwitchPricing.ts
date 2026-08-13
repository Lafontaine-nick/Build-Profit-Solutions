/**
 * Electrical Phase 2D — switch / control pricing.
 *
 * Device + box + plate splits are LOCKED.
 * Homerun / traveler wiring stay on circuit cards.
 * Relocation, fishing, and wall repair are not this card.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_SWITCH_ITEM_IDS = [
  'electrical_single_pole_switch',
  'electrical_3way_switch',
  'electrical_4way_switch',
  'electrical_dimmer_switch',
  'electrical_occupancy_switch',
  'electrical_smart_switch',
] as const;

export type ElectricalSwitchItemId = (typeof ELECTRICAL_SWITCH_ITEM_IDS)[number];

export const ELECTRICAL_SWITCH_RATES_STATUS = 'locked';

export const ELECTRICAL_SWITCH_RATE_SOURCE_LABEL =
  'Electrical switch · approved device/box/plate split · homerun not included';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits for device + box + plate.
 * Homerun / traveler wiring stay on circuit cards.
 */
const SWITCH_RATES: Record<ElectricalSwitchItemId, Split> = {
  electrical_single_pole_switch: { material: 15, labor: 80 },
  electrical_3way_switch: { material: 22, labor: 108 },
  electrical_4way_switch: { material: 28, labor: 122 },
  electrical_dimmer_switch: { material: 42, labor: 108 },
  electrical_occupancy_switch: { material: 48, labor: 122 },
  electrical_smart_switch: { material: 70, labor: 145 },
};

export function isElectricalSwitchItemId(
  itemId: string | null | undefined
): itemId is ElectricalSwitchItemId {
  return Boolean(
    itemId && (ELECTRICAL_SWITCH_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalSwitchPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
};

export function electricalSwitchCardShouldPrice(
  itemId: ElectricalSwitchItemId,
  input: ElectricalSwitchPricingInput
): boolean {
  const qty = Number(input.quantity);
  return Number.isFinite(qty) && qty > 0 && isElectricalSwitchItemId(itemId);
}

export type ElectricalSwitchQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_SWITCH_RATES_STATUS;
};

export function quoteElectricalSwitch(
  input: ElectricalSwitchPricingInput
): ElectricalSwitchQuote | null {
  if (!isElectricalSwitchItemId(input.itemId)) return null;
  if (!electricalSwitchCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = SWITCH_RATES[input.itemId];
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
    `${quantity} EA · device / box / plate`,
    'homerun not included',
    conditionLabel,
    'approved device split',
  ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: 'each',
    laborMultiplier,
    helper,
    rateSourceLabel: ELECTRICAL_SWITCH_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_SWITCH_RATES_STATUS,
  };
}

export type ElectricalSwitchSuggestedPricing = {
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

export function resolveElectricalSwitchSuggestedPricing(
  input: ElectricalSwitchPricingInput
): ElectricalSwitchSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalSwitch(input);
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
      pricingRecordId: `bps_electrical_switch:${input.itemId}`,
    },
    comparison: null,
  };
}
