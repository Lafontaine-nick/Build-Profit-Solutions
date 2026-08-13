/**
 * Electrical Phase 2B — circuit pricing.
 *
 * Circuit splits are LOCKED. 60A+ remains specialty / confirm.
 * A circuit card is the homerun + breaker + wire. Devices and appliance
 * connections are later buckets.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_CIRCUIT_ITEM_IDS = [
  'electrical_standard_circuit',
  'electrical_dedicated_20a',
  'electrical_circuit_30a',
  'electrical_circuit_40a',
  'electrical_circuit_50a',
  'electrical_circuit_60a_plus',
] as const;

export type ElectricalCircuitItemId = (typeof ELECTRICAL_CIRCUIT_ITEM_IDS)[number];

export const ELECTRICAL_CIRCUIT_RATES_STATUS = 'locked';

export const ELECTRICAL_CIRCUIT_RATE_SOURCE_LABEL =
  'Electrical circuit · approved homerun/breaker split · 60A+ specialty / confirm';

type Split = { material: number; labor: number };

/**
 * Proposed indoor, new-construction EA splits for a homerun + breaker.
 * 60A+ is a specialty review tier because feeder length/equipment varies widely.
 */
const CIRCUIT_RATES: Record<ElectricalCircuitItemId, Split> = {
  electrical_standard_circuit: { material: 55, labor: 245 },
  electrical_dedicated_20a: { material: 75, labor: 325 },
  electrical_circuit_30a: { material: 120, labor: 380 },
  electrical_circuit_40a: { material: 150, labor: 450 },
  electrical_circuit_50a: { material: 190, labor: 560 },
  electrical_circuit_60a_plus: { material: 300, labor: 700 },
};

export function isElectricalCircuitItemId(
  itemId: string | null | undefined
): itemId is ElectricalCircuitItemId {
  return Boolean(
    itemId && (ELECTRICAL_CIRCUIT_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalCircuitPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  rangeHookupCount?: number | null;
  dryerHookupCount?: number | null;
  waterHeaterHookupCount?: number | null;
  evChargerHookupCount?: number | null;
  dishwasherHookupCount?: number | null;
  disposalHookupCount?: number | null;
  microwaveHookupCount?: number | null;
  refrigeratorHookupCount?: number | null;
};

/**
 * Appliance hookups own their circuit. Notes-inferred generic cards do not
 * stack on top unless the contractor entered them independently.
 */
export function electricalCircuitCardShouldPrice(
  itemId: ElectricalCircuitItemId,
  input: ElectricalCircuitPricingInput
): boolean {
  const qty = Number(input.quantity);
  if (!(Number.isFinite(qty) && qty > 0)) return false;
  if (input.quantitySource === 'user_entered') return true;

  if (itemId === 'electrical_circuit_50a' && Number(input.rangeHookupCount) > 0) {
    return false;
  }
  if (
    itemId === 'electrical_circuit_30a' &&
    (Number(input.dryerHookupCount) > 0 ||
      Number(input.waterHeaterHookupCount) > 0)
  ) {
    return false;
  }
  if (
    itemId === 'electrical_dedicated_20a' &&
    (Number(input.dishwasherHookupCount) > 0 ||
      Number(input.disposalHookupCount) > 0 ||
      Number(input.microwaveHookupCount) > 0 ||
      Number(input.refrigeratorHookupCount) > 0)
  ) {
    return false;
  }
  if (
    itemId === 'electrical_circuit_60a_plus' &&
    Number(input.evChargerHookupCount) > 0
  ) {
    return false;
  }
  return true;
}

export type ElectricalCircuitQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_CIRCUIT_RATES_STATUS;
};

export function quoteElectricalCircuit(
  input: ElectricalCircuitPricingInput
): ElectricalCircuitQuote | null {
  if (!isElectricalCircuitItemId(input.itemId)) return null;
  if (!electricalCircuitCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = CIRCUIT_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const specialty = input.itemId === 'electrical_circuit_60a_plus';
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = [
    `${quantity} EA · homerun / breaker`,
    conditionLabel,
    specialty ? 'specialty / confirm' : 'approved homerun split',
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
    rateSourceLabel: ELECTRICAL_CIRCUIT_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_CIRCUIT_RATES_STATUS,
  };
}

export type ElectricalCircuitSuggestedPricing = {
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
    productionStatus: 'review_required' | 'production_ready';
    benchmarkLevel: 'component';
    benchmarkScopeKey: string;
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalCircuitSuggestedPricing(
  input: ElectricalCircuitPricingInput
): ElectricalCircuitSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalCircuit(input);
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
      pricingRecordId: `bps_electrical_circuit:${input.itemId}`,
    },
    comparison: null,
  };
}
