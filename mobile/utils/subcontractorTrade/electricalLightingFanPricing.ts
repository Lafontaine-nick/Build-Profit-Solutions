/**
 * Electrical Phase 2E — lighting / fan pricing.
 *
 * Fixture + hang splits are LOCKED. Decorative / chandelier remains
 * specialty / confirm. Homerun stays on circuit cards. Dimmer / occupancy /
 * smart switches stay on switch cards. Do not price electrical_rough here.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_LIGHTING_FAN_ITEM_IDS = [
  'electrical_standard_fixture',
  'electrical_recessed_light',
  'electrical_pendant_light',
  'electrical_decorative_light',
  'electrical_exterior_light',
  'electrical_undercabinet_light',
  'electrical_ceiling_fan',
  'electrical_bath_exhaust_fan',
] as const;

export type ElectricalLightingFanItemId =
  (typeof ELECTRICAL_LIGHTING_FAN_ITEM_IDS)[number];

export const ELECTRICAL_LIGHTING_FAN_RATES_STATUS = 'locked';

export const ELECTRICAL_LIGHTING_FAN_RATE_SOURCE_LABEL =
  'Electrical lighting/fan · approved fixture/hang split · chandelier specialty / confirm';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits for fixture + hang/install.
 * Homerun stays on circuit cards. Decorative/chandelier is specialty / confirm.
 */
const LIGHTING_FAN_RATES: Record<ElectricalLightingFanItemId, Split> = {
  electrical_standard_fixture: { material: 50, labor: 100 },
  electrical_recessed_light: { material: 45, labor: 105 },
  electrical_pendant_light: { material: 50, labor: 110 },
  electrical_decorative_light: { material: 90, labor: 210 },
  electrical_exterior_light: { material: 55, labor: 125 },
  electrical_undercabinet_light: { material: 40, labor: 90 },
  electrical_ceiling_fan: { material: 100, labor: 175 },
  electrical_bath_exhaust_fan: { material: 75, labor: 175 },
};

export function isElectricalLightingFanItemId(
  itemId: string | null | undefined
): itemId is ElectricalLightingFanItemId {
  return Boolean(
    itemId &&
      (ELECTRICAL_LIGHTING_FAN_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalLightingFanPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
};

export function electricalLightingFanCardShouldPrice(
  itemId: ElectricalLightingFanItemId,
  input: ElectricalLightingFanPricingInput
): boolean {
  const qty = Number(input.quantity);
  return Number.isFinite(qty) && qty > 0 && isElectricalLightingFanItemId(itemId);
}

export type ElectricalLightingFanQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_LIGHTING_FAN_RATES_STATUS;
};

export function quoteElectricalLightingFan(
  input: ElectricalLightingFanPricingInput
): ElectricalLightingFanQuote | null {
  if (!isElectricalLightingFanItemId(input.itemId)) return null;
  if (!electricalLightingFanCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = LIGHTING_FAN_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const specialty = input.itemId === 'electrical_decorative_light';
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const scopeBoundary =
    input.itemId === 'electrical_ceiling_fan'
      ? 'fan-rated box/bracing, homerun/circuit, and switch/control separate'
      : input.itemId === 'electrical_bath_exhaust_fan'
        ? 'ducting, roof/wall penetration, exterior termination, HVAC, and homerun separate'
      : 'homerun not included';
  const helper = [
    `${quantity} EA · ${
      input.itemId === 'electrical_ceiling_fan'
        ? 'fan fixture / hang'
        : input.itemId === 'electrical_bath_exhaust_fan'
          ? 'fan unit / standard mounting / electrical connection'
        : 'fixture / hang'
    }`,
    scopeBoundary,
    conditionLabel,
    specialty ? 'specialty / confirm' : 'approved fixture split',
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
    rateSourceLabel: ELECTRICAL_LIGHTING_FAN_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_LIGHTING_FAN_RATES_STATUS,
  };
}

export type ElectricalLightingFanSuggestedPricing = {
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

export function resolveElectricalLightingFanSuggestedPricing(
  input: ElectricalLightingFanPricingInput
): ElectricalLightingFanSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalLightingFan(input);
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
      pricingRecordId: `bps_electrical_lighting:${input.itemId}`,
    },
    comparison: null,
  };
}
