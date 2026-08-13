/**
 * Electrical Phase 2A — service / panel pricing.
 *
 * 100–200A residential splits are LOCKED.
 * 400A remains specialty / confirm.
 * Do not price electrical_rough here.
 *
 * Ownership: a service-size change prices Service upgrade only. Main panel and
 * panel upgrade do not auto-stack onto that card unless independently selected.
 */

import type {
  ElectricalPanelLocation,
  ElectricalProjectCondition,
} from './electricalPlanConvergence';

export const ELECTRICAL_SERVICE_PANEL_ITEM_IDS = [
  'electrical_main_panel',
  'electrical_subpanel',
  'electrical_panel_upgrade',
  'electrical_service_upgrade',
] as const;

export type ElectricalServicePanelItemId =
  (typeof ELECTRICAL_SERVICE_PANEL_ITEM_IDS)[number];

export type ElectricalAmperageTier = 60 | 100 | 125 | 150 | 200 | 400;

export type { ElectricalPanelLocation };

export const ELECTRICAL_SERVICE_PANEL_RATES_STATUS = 'locked_100_200';

export const ELECTRICAL_SERVICE_PANEL_RATE_SOURCE_LABEL =
  'Electrical service/panel · 100–200A approved · 400A specialty / confirm';

/** Labor-only modifiers. Materials stay on the base split. */
export const ELECTRICAL_CONDITION_LABOR_MULTIPLIERS: Record<
  ElectricalProjectCondition,
  number
> = {
  new_construction: 1,
  remodel_open_wall: 1.15,
  finished_wall_service: 1.4,
};

const OUTDOOR_MATERIAL_MULTIPLIER = 1.1;
const OUTDOOR_LABOR_MULTIPLIER = 1.15;
const METER_MAIN_MATERIAL_ADD = 275;
const METER_MAIN_LABOR_ADD = 225;

type Split = { material: number; labor: number };

/**
 * Proposed indoor, new-construction, panel-only EA splits.
 * 400A is a specialty review tier, not a locked production rate.
 */
const MAIN_PANEL_RATES: Record<100 | 125 | 150 | 200 | 400, Split> = {
  100: { material: 450, labor: 750 },
  125: { material: 525, labor: 825 },
  150: { material: 625, labor: 925 },
  200: { material: 850, labor: 1200 },
  400: { material: 1800, labor: 2400 },
};

const SUBPANEL_RATES: Record<60 | 100 | 125 | 200, Split> = {
  60: { material: 275, labor: 450 },
  100: { material: 350, labor: 575 },
  125: { material: 400, labor: 650 },
  200: { material: 650, labor: 950 },
};

const PANEL_UPGRADE_RATES: Record<100 | 125 | 150 | 200 | 400, Split> = {
  100: { material: 400, labor: 950 },
  125: { material: 475, labor: 1050 },
  150: { material: 575, labor: 1200 },
  200: { material: 800, labor: 1450 },
  400: { material: 1600, labor: 2800 },
};

/** Service upgrade includes meter/main, grounding/bonding, and utility coordination. */
const SERVICE_UPGRADE_RATES: Record<'replace_200' | 'increase_200' | 'specialty_400', Split> = {
  replace_200: { material: 1600, labor: 2400 },
  increase_200: { material: 2000, labor: 3250 },
  specialty_400: { material: 3800, labor: 5200 },
};

export function isElectricalServicePanelItemId(
  itemId: string | null | undefined
): itemId is ElectricalServicePanelItemId {
  return Boolean(
    itemId &&
      (ELECTRICAL_SERVICE_PANEL_ITEM_IDS as readonly string[]).includes(itemId)
  );
}

export function snapElectricalAmperageTier(
  amps: number | null | undefined,
  itemId: ElectricalServicePanelItemId
): ElectricalAmperageTier {
  const n = Number(amps);
  if (!Number.isFinite(n) || n <= 0) {
    return itemId === 'electrical_subpanel' ? 100 : 200;
  }
  if (itemId === 'electrical_subpanel') {
    if (n <= 70) return 60;
    if (n <= 110) return 100;
    if (n <= 140) return 125;
    return 200;
  }
  if (n <= 110) return 100;
  if (n <= 135) return 125;
  if (n <= 175) return 150;
  if (n <= 250) return 200;
  return 400;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ElectricalServicePanelPricingInput = {
  itemId: string;
  quantity?: number | null;
  serviceAmperage?: number | null;
  existingServiceAmperage?: number | null;
  electricalProjectCondition?: ElectricalProjectCondition | null;
  electricalPanelLocation?: ElectricalPanelLocation | null;
  electricalMeterMainCombo?: boolean | null;
  mainPanelCount?: number | null;
  panelUpgradeCount?: number | null;
  serviceUpgradeCount?: number | null;
  subpanelCount?: number | null;
  electricalScope?: string[] | null;
  quantitySource?: string | null;
};

/**
 * Service upgrade owns a service-size change. Main panel and panel upgrade
 * auto-price only when they are independent scopes (explicit extra selection
 * or a quantity with no service-upgrade owner).
 */
export function electricalServicePanelCardShouldPrice(
  itemId: ElectricalServicePanelItemId,
  input: ElectricalServicePanelPricingInput
): boolean {
  const qty = Number(input.quantity);
  if (!(Number.isFinite(qty) && qty > 0)) return false;

  const serviceCount = Number(input.serviceUpgradeCount) > 0;
  const explicitIndependent = input.quantitySource === 'user_entered';

  if (itemId === 'electrical_subpanel') return true;
  if (itemId === 'electrical_service_upgrade') return true;

  if (
    serviceCount &&
    (itemId === 'electrical_main_panel' || itemId === 'electrical_panel_upgrade')
  ) {
    return explicitIndependent;
  }
  if (
    itemId === 'electrical_main_panel' &&
    Number(input.panelUpgradeCount) > 0 &&
    !explicitIndependent
  ) {
    return false;
  }
  return true;
}

function baseSplitFor(
  itemId: ElectricalServicePanelItemId,
  tier: ElectricalAmperageTier,
  fromAmps: number | null
): Split | null {
  if (itemId === 'electrical_subpanel') {
    const key = (tier === 400 ? 200 : tier === 150 ? 125 : tier) as 60 | 100 | 125 | 200;
    return SUBPANEL_RATES[key];
  }
  if (itemId === 'electrical_main_panel') {
    const key = (tier === 60 ? 100 : tier) as 100 | 125 | 150 | 200 | 400;
    return MAIN_PANEL_RATES[key];
  }
  if (itemId === 'electrical_panel_upgrade') {
    const key = (tier === 60 ? 100 : tier) as 100 | 125 | 150 | 200 | 400;
    return PANEL_UPGRADE_RATES[key];
  }
  const to = tier;
  const from = Number(fromAmps);
  if (to >= 400) return SERVICE_UPGRADE_RATES.specialty_400;
  if (Number.isFinite(from) && from > 0) {
    if (from >= 200 && to <= 200) return SERVICE_UPGRADE_RATES.replace_200;
    if (from < to) return SERVICE_UPGRADE_RATES.increase_200;
    return SERVICE_UPGRADE_RATES.replace_200;
  }
  return SERVICE_UPGRADE_RATES.increase_200;
}

export type ElectricalServicePanelQuote = {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  amperageTier: ElectricalAmperageTier;
  laborMultiplier: number;
  specialty: boolean;
  helper: string;
  rateSourceLabel: string;
  ratesStatus: typeof ELECTRICAL_SERVICE_PANEL_RATES_STATUS;
};

export function quoteElectricalServicePanel(
  input: ElectricalServicePanelPricingInput
): ElectricalServicePanelQuote | null {
  if (!isElectricalServicePanelItemId(input.itemId)) return null;
  if (!electricalServicePanelCardShouldPrice(input.itemId, input)) return null;

  const quantity = Number(input.quantity);
  if (!(Number.isFinite(quantity) && quantity > 0)) return null;

  const tier = snapElectricalAmperageTier(input.serviceAmperage, input.itemId);
  const split = baseSplitFor(input.itemId, tier, input.existingServiceAmperage ?? null);
  if (!split) return null;

  const condition = input.electricalProjectCondition;
  const laborMultiplier =
    condition && ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      ? ELECTRICAL_CONDITION_LABOR_MULTIPLIERS[condition]
      : 1;
  const outdoor = input.electricalPanelLocation === 'outdoor';
  let material = split.material * (outdoor ? OUTDOOR_MATERIAL_MULTIPLIER : 1);
  let labor = split.labor * laborMultiplier * (outdoor ? OUTDOOR_LABOR_MULTIPLIER : 1);

  if (
    input.electricalMeterMainCombo &&
    (input.itemId === 'electrical_main_panel' ||
      input.itemId === 'electrical_panel_upgrade')
  ) {
    material += METER_MAIN_MATERIAL_ADD;
    labor += METER_MAIN_LABOR_ADD * laborMultiplier;
  }

  material = roundMoney(material * quantity);
  labor = roundMoney(labor * quantity);
  const specialty = tier >= 400;
  const conditionLabel = condition
    ? condition.replace(/_/g, ' ')
    : 'standard';
  const helper = [
    `${quantity} EA · ${tier}A`,
    outdoor ? 'outdoor' : 'indoor',
    conditionLabel,
    specialty ? 'specialty / confirm' : 'approved 100–200A split',
  ].join(' · ');

  return {
    material,
    labor,
    total: roundMoney(material + labor),
    quantity,
    unit: 'each',
    amperageTier: tier,
    laborMultiplier,
    specialty,
    helper,
    rateSourceLabel: ELECTRICAL_SERVICE_PANEL_RATE_SOURCE_LABEL,
    ratesStatus: ELECTRICAL_SERVICE_PANEL_RATES_STATUS,
  };
}

export function hasServiceUpgradeLanguage(text: string): boolean {
  return /\bservice\s+upgrade\b|\bupgrade\s+(?:the\s+|an\s+|existing\s+)?(?:\d+\s*(?:amp(?:ere)?s?|a)\s+)?service\b|\b\d+\s*(?:amp(?:ere)?s?|a)\s+(?:service\s+)?(?:to|→)\s*\d+\s*(?:amp(?:ere)?s?|a)\b|\bupgrade\s+existing\s+\d+\s*(?:amp(?:ere)?s?|a)\b|\bmeter[\s/-]?main\s+upgrade\b/i.test(
    text
  );
}

export function hasPanelUpgradeLanguage(text: string): boolean {
  return /\bpanel\s+upgrade|\bupgrade\s+(?:the\s+|an\s+|existing\s+)?(?:\d+\s*amp(?:ere)?s?\s+)?panel\b|\breplace(?:ment)?\s+(?:the\s+)?(?:existing\s+)?(?:main\s+)?panel\b/i.test(
    text
  );
}

export function hasIndependentMainPanelLanguage(text: string): boolean {
  return /\b(?:install|new)\s+(?:a\s+)?(?:\d+\s*amp(?:ere)?s?\s+)?(?:main\s+)?panel\b|\bnew\s+main\s+panel\b/i.test(
    text
  );
}

export function hasIndependentServicePanelJoiner(text: string): boolean {
  return /\balso\b|\bin addition\b|\bplus\b|\bas well as\b/i.test(text);
}

export function parseServiceAmperageRange(text: string): {
  from: number | null;
  to: number | null;
} {
  const source = String(text || '');
  const range = source.match(
    /(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:service\s+)?(?:to|→|-)\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i
  );
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    return {
      from: Number.isFinite(from) && from > 0 ? from : null,
      to: Number.isFinite(to) && to > 0 ? to : null,
    };
  }
  const toOnly = source.match(/\b(?:to|→)\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i);
  if (toOnly) {
    const to = Number(toOnly[1]);
    return {
      from: null,
      to: Number.isFinite(to) && to > 0 ? to : null,
    };
  }
  return { from: null, to: null };
}

/**
 * One owner for a service-size change. Subpanels stay independent.
 */
export function applyElectricalServicePanelOwnership<T extends Record<string, unknown>>(
  parsed: T,
  notes: string
): T {
  const text = String(notes || '');
  const next = { ...parsed };
  const range = parseServiceAmperageRange(text);
  if (range.to) next.serviceAmperage = range.to;
  if (range.from) next.existingServiceAmperage = range.from;

  const serviceLang = hasServiceUpgradeLanguage(text);
  const panelLang = hasPanelUpgradeLanguage(text);
  const newMainLang = hasIndependentMainPanelLanguage(text);
  const joiner = hasIndependentServicePanelJoiner(text);

  if (serviceLang) {
    if (!(Number(next.serviceUpgradeCount) > 0)) next.serviceUpgradeCount = 1;
    if (!joiner || !newMainLang) delete next.mainPanelCount;
    else if (!(Number(next.mainPanelCount) > 0)) next.mainPanelCount = 1;
    if (!joiner || !panelLang) delete next.panelUpgradeCount;
    else if (!(Number(next.panelUpgradeCount) > 0)) next.panelUpgradeCount = 1;
  } else if (panelLang) {
    if (!(Number(next.panelUpgradeCount) > 0)) next.panelUpgradeCount = 1;
    if (!joiner || !newMainLang) delete next.mainPanelCount;
    delete next.serviceUpgradeCount;
  }

  if (/\boutdoor\s+panel|\bexterior\s+panel|\bnema\s*3r\b/i.test(text)) {
    next.electricalPanelLocation = 'outdoor';
  } else if (/\bindoor\s+panel\b/i.test(text)) {
    next.electricalPanelLocation = 'indoor';
  }
  if (/\bmeter[\s/-]?main\b|\bcombo\s+panel\b/i.test(text)) {
    next.electricalMeterMainCombo = true;
  }

  return next;
}

export type ElectricalServicePanelSuggestedPricing = {
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

export function resolveElectricalServicePanelSuggestedPricing(
  input: ElectricalServicePanelPricingInput
): ElectricalServicePanelSuggestedPricing | { fill: null; comparison: null } {
  const quote = quoteElectricalServicePanel(input);
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
      pricingRecordId: `bps_electrical_service_panel:${input.itemId}:${quote.amperageTier}`,
    },
    comparison: null,
  };
}
