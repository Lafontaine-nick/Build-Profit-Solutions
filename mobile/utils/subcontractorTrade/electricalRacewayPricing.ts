/**
 * Electrical Phase 2I — conduit / trenching pricing.
 *
 * Standard residential PVC raceway and normal-soil trench splits are LOCKED.
 * Rigid / oversized conduit and rocky / difficult trench stay specialty /
 * confirm and do not auto-fill these rates. These cards are LF takeoff only.
 * A bare "include conduit" or "trenching" flag does not invent a length or
 * a price. Conduit is raceway only — not a homerun. Trenching is dirt work
 * only — not conduit and not landscape restoration. Do not price
 * electrical_rough or electrical_trim here.
 */

import type {
  ElectricalProjectCondition,
  ElectricalTrenchCondition,
} from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_RACEWAY_ITEM_IDS = [
  'electrical_conduit',
  'electrical_trenching',
] as const;

export type ElectricalRacewayItemId =
  (typeof ELECTRICAL_RACEWAY_ITEM_IDS)[number];

export const ELECTRICAL_RACEWAY_RATES_STATUS = 'locked';

export const ELECTRICAL_RACEWAY_RATE_SOURCE_LABEL =
  'Electrical conduit/trench · approved PVC raceway $7/LF · normal-soil trench $10/LF · rocky/rigid specialty / confirm';

type Split = { material: number; labor: number };

/**
 * Locked indoor/site, new-construction LF splits.
 * Conduit = standard residential PVC raceway. Trenching = normal-soil
 * excavation/backfill. They do not include each other.
 */
const RACEWAY_RATES: Record<ElectricalRacewayItemId, Split> = {
  electrical_conduit: { material: 3, labor: 4 },
  electrical_trenching: { material: 1, labor: 9 },
};

export function isElectricalRacewayItemId(
  itemId: string | null | undefined
): itemId is ElectricalRacewayItemId {
  return Boolean(
    itemId &&
      (ELECTRICAL_RACEWAY_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalRacewayPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalTrenchCondition?: ElectricalTrenchCondition | null;
  electricalConduitSpecialty?: boolean | null;
};

export function electricalRacewayCardShouldPrice(
  itemId: ElectricalRacewayItemId,
  input: ElectricalRacewayPricingInput
): boolean {
  const qty = Number(input.quantity);
  if (!(Number.isFinite(qty) && qty > 0 && isElectricalRacewayItemId(itemId))) {
    return false;
  }
  if (itemId === 'electrical_trenching' && input.electricalTrenchCondition === 'rocky') {
    return false;
  }
  if (itemId === 'electrical_conduit' && input.electricalConduitSpecialty === true) {
    return false;
  }
  return true;
}

/**
 * Trenching is outdoor excavation — never use interior finished-wall
 * multipliers. Conduit only applies the finished-wall labor bump when
 * that access condition is actually selected.
 */
function racewayLaborMultiplier(
  itemId: ElectricalRacewayItemId,
  condition: ElectricalProjectCondition | null | undefined
): number {
  if (itemId === 'electrical_trenching') return 1;
  if (condition === 'finished_wall_service') {
    return ELECTRICAL_CONDITION_LABOR_MULTIPLIERS.finished_wall_service;
  }
  return 1;
}

export type ElectricalRacewayQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'lf';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_RACEWAY_RATES_STATUS;
};

export function quoteElectricalRaceway(
  input: ElectricalRacewayPricingInput
): ElectricalRacewayQuote | null {
  if (!isElectricalRacewayItemId(input.itemId)) return null;
  if (!electricalRacewayCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = RACEWAY_RATES[input.itemId];
  const laborMultiplier = racewayLaborMultiplier(
    input.itemId,
    input.electricalProjectCondition
  );
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const isTrench = input.itemId === 'electrical_trenching';
  const work = isTrench
    ? 'trench only · not conduit'
    : 'raceway only · homerun not included';
  const context = isTrench
    ? 'normal soil'
    : laborMultiplier > 1
      ? 'finished wall service'
      : 'standard';
  const helper = [
    `${quantity} LF · ${work}`,
    context,
    'approved split',
  ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: 'lf',
    laborMultiplier,
    specialty: false,
    helper,
    rateSourceLabel: ELECTRICAL_RACEWAY_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_RACEWAY_RATES_STATUS,
  };
}

export type ElectricalRacewaySuggestedPricing = {
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
    basis: { quantity: number; unit: 'lf' };
    productionStatus: 'production_ready' | 'review_required';
    benchmarkLevel: 'component';
    benchmarkScopeKey: string;
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalRacewaySuggestedPricing(
  input: ElectricalRacewayPricingInput
): ElectricalRacewaySuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalRaceway(input);
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
      basis: { quantity: quote.quantity, unit: 'lf' },
      productionStatus: 'production_ready',
      benchmarkLevel: 'component',
      benchmarkScopeKey: input.itemId,
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_electrical_raceway:${input.itemId}`,
    },
    comparison: null,
  };
}
