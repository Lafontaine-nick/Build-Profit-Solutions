/**
 * Electrical Phase 2H — relocate / removal / abandon pricing.
 *
 * Make-safe / relocate splits are LOCKED. Abandoned circuits remain
 * specialty / confirm. Relocate does not also price a new device/fixture
 * card. Removal does not also price an install card. Wall repair is a
 * separate trade. Do not price electrical_rough or electrical_trim here.
 */

import type { ElectricalProjectCondition } from './electricalPlanConvergence';
import { ELECTRICAL_CONDITION_LABOR_MULTIPLIERS } from './electricalServicePanelPricing';

export const ELECTRICAL_MODIFICATION_ITEM_IDS = [
  'electrical_device_removal',
  'electrical_fixture_removal',
  'electrical_relocate',
  'electrical_abandoned_circuit',
] as const;

export type ElectricalModificationItemId =
  (typeof ELECTRICAL_MODIFICATION_ITEM_IDS)[number];

export const ELECTRICAL_MODIFICATION_RATES_STATUS = 'locked';

export const ELECTRICAL_MODIFICATION_RATE_SOURCE_LABEL =
  'Electrical modification · approved make-safe/relocate split · abandoned circuit specialty / confirm';

type Split = { material: number; labor: number };

/**
 * Locked indoor, new-construction EA splits.
 * Relocate reuses the existing device. Removal is cap/make-safe only.
 */
const MODIFICATION_RATES: Record<ElectricalModificationItemId, Split> = {
  electrical_device_removal: { material: 15, labor: 70 },
  electrical_fixture_removal: { material: 15, labor: 90 },
  electrical_relocate: { material: 35, labor: 165 },
  electrical_abandoned_circuit: { material: 25, labor: 150 },
};

const SPECIALTY_MODIFICATIONS = new Set<ElectricalModificationItemId>([
  'electrical_abandoned_circuit',
]);

export function isElectricalModificationItemId(
  itemId: string | null | undefined
): itemId is ElectricalModificationItemId {
  return Boolean(
    itemId &&
      (ELECTRICAL_MODIFICATION_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalModificationPricingInput = {
  itemId: string;
  quantity?: number | null;
  quantitySource?: string | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
};

export function electricalModificationCardShouldPrice(
  itemId: ElectricalModificationItemId,
  input: ElectricalModificationPricingInput
): boolean {
  const qty = Number(input.quantity);
  return (
    Number.isFinite(qty) && qty > 0 && isElectricalModificationItemId(itemId)
  );
}

export type ElectricalModificationQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_MODIFICATION_RATES_STATUS;
};

export function quoteElectricalModification(
  input: ElectricalModificationPricingInput
): ElectricalModificationQuote | null {
  if (!isElectricalModificationItemId(input.itemId)) return null;
  if (!electricalModificationCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const split = MODIFICATION_RATES[input.itemId];
  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const material = roundMoney(split.material * quantity);
  const labor = roundMoney(split.labor * laborMultiplier * quantity);
  const specialty = SPECIALTY_MODIFICATIONS.has(input.itemId);
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = [
    `${quantity} EA · make-safe / modification`,
    'new device not stacked',
    conditionLabel,
    specialty ? 'specialty / confirm' : 'approved split',
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
    rateSourceLabel: ELECTRICAL_MODIFICATION_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_MODIFICATION_RATES_STATUS,
  };
}

export type ElectricalModificationSuggestedPricing = {
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
    benchmarkScopeKey: string;
    benchmarkAction: 'price_ready';
    pricingRecordId: string;
  };
  comparison: null;
};

export function resolveElectricalModificationSuggestedPricing(
  input: ElectricalModificationPricingInput
): ElectricalModificationSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalModification(input);
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
      pricingRecordId: `bps_electrical_modification:${input.itemId}`,
    },
    comparison: null,
  };
}
