/**
 * Electrical Phase 2C — receptacle pricing.
 *
 * Device + box + plate splits are LOCKED.
 * Homerun / breaker stay on circuit cards.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';
import {
  electrical240VReceptacleOverlapWarning,
  type ElectricalOwnershipInput,
} from './electricalPricingOwnership';

export const ELECTRICAL_RECEPTACLE_ITEM_IDS = [
  'electrical_standard_receptacle',
  'electrical_gfci_receptacle',
  'electrical_afci_receptacle',
  'electrical_exterior_receptacle',
  'electrical_floor_receptacle',
  'electrical_usb_receptacle',
  'electrical_240v_receptacle',
] as const;

export type ElectricalReceptacleItemId =
  (typeof ELECTRICAL_RECEPTACLE_ITEM_IDS)[number];

export const ELECTRICAL_RECEPTACLE_RATES_STATUS = 'locked';

export const ELECTRICAL_RECEPTACLE_RATE_SOURCE_LABEL =
  'Electrical receptacle · approved device/box/plate split · homerun not included';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits for device + box + plate.
 * Homerun / breaker stay on circuit cards.
 */
const RECEPTACLE_RATES: Record<ElectricalReceptacleItemId, Split> = {
  electrical_standard_receptacle: { material: 20, labor: 90 },
  electrical_gfci_receptacle: { material: 35, labor: 140 },
  electrical_afci_receptacle: { material: 50, labor: 160 },
  electrical_exterior_receptacle: { material: 45, labor: 170 },
  electrical_floor_receptacle: { material: 85, labor: 210 },
  electrical_usb_receptacle: { material: 35, labor: 110 },
  electrical_240v_receptacle: { material: 55, labor: 175 },
};

export function isElectricalReceptacleItemId(
  itemId: string | null | undefined
): itemId is ElectricalReceptacleItemId {
  return Boolean(
    itemId &&
    (ELECTRICAL_RECEPTACLE_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalReceptaclePricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
} & ElectricalOwnershipInput;

export function electricalReceptacleCardShouldPrice(
  itemId: ElectricalReceptacleItemId,
  input: ElectricalReceptaclePricingInput
): boolean {
  const qty = Number(input.quantity);
  return (
    Number.isFinite(qty) && qty > 0 && isElectricalReceptacleItemId(itemId)
  );
}

export type ElectricalReceptacleQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_RECEPTACLE_RATES_STATUS;
};

export function quoteElectricalReceptacle(
  input: ElectricalReceptaclePricingInput
): ElectricalReceptacleQuote | null {
  if (!isElectricalReceptacleItemId(input.itemId)) return null;
  if (!electricalReceptacleCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = RECEPTACLE_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const conditionLabel = condition ? condition.replace(/_/g, ' ') : 'standard';
  const helper = [
    input.itemId === 'electrical_240v_receptacle'
      ? `${quantity} EA · receptacle / device / standard termination`
      : `${quantity} EA · device / box / plate`,
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
    rateSourceLabel: ELECTRICAL_RECEPTACLE_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_RECEPTACLE_RATES_STATUS,
  };
}

export type ElectricalReceptacleSuggestedPricing = {
  fill: {
    material: number;
    labor: number;
    total: number;
    materialSource: 'national_average';
    laborSource: 'national_average';
    rateSourceLabel: string;
    helper: string;
    pricingDetail?: string | null;
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

export function resolveElectricalReceptacleSuggestedPricing(
  input: ElectricalReceptaclePricingInput
): ElectricalReceptacleSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalReceptacle(input);
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
      pricingDetail:
        input.itemId === 'electrical_240v_receptacle'
          ? electrical240VReceptacleOverlapWarning(input)
          : null,
      mode: 'suggested_price',
      splitSource: 'estimated',
      splitConfidence: 'medium',
      basis: { quantity: quote.quantity, unit: 'each' },
      productionStatus: 'production_ready',
      benchmarkLevel: 'component',
      benchmarkScopeKey: input.itemId,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_receptacle:${input.itemId}`,
    },
    comparison: null,
  };
}
