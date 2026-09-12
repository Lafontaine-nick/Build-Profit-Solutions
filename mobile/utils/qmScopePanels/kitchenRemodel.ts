import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseMeasurementQty(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Combined perimeter + island countertop SF for kitchen pricing. */
export function resolveKitchenCountertopTakeoffSqft(
  measurements: Record<string, unknown>
): number {
  const perimeter = parseMeasurementQty(measurements.countertopSqft);
  // Island countertop area is part of the countertop takeoff, not a separate
  // pricing card. A saved island SF value remains authoritative even if the
  // island stepper was toggled after the measurement was entered.
  const island = parseMeasurementQty(measurements.kitchenIslandCounterSqft);
  if (perimeter <= 0 && island <= 0) return 0;
  return Math.round((perimeter + island) * 100) / 100;
}

function kitchenCountertopSourceLabel(
  measurements: Record<string, unknown>
): string {
  const perimeter = parseMeasurementQty(measurements.countertopSqft);
  const island = parseMeasurementQty(measurements.kitchenIslandCounterSqft);
  if (perimeter > 0 && island > 0) {
    return 'Kitchen counters · perimeter + island SF';
  }
  if (island > 0) return 'Kitchen island counter · Quick Measurements';
  return 'User-entered Quick Measurement';
}

export function resolveKitchenCountertopQuantity(
  itemId: string,
  measurements: Record<string, unknown>,
  ctx: { templateKey?: string | null },
  rule: { quantityHelper?: string }
): {
  quantity: number;
  unit: 'sqft';
  quantitySource: 'user_entered';
  sourceLabel: string;
  pricingReady: true;
  quantityHelper?: string;
  showInput: true;
} | null {
  if (String(ctx.templateKey || '').toLowerCase() !== 'kitchen') return null;
  if (itemId !== 'countertops' && itemId !== 'countertop_demo') return null;
  const sqft = resolveKitchenCountertopTakeoffSqft(measurements);
  if (!(sqft > 0)) return null;
  return {
    quantity: sqft,
    unit: 'sqft',
    quantitySource: 'user_entered',
    sourceLabel: kitchenCountertopSourceLabel(measurements),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
  };
}

const KITCHEN_MEASUREMENT_ITEM_MAP: Partial<
  Record<string, { id: string; unit: 'sqft' | 'lf' | 'each' }>
> = {
  backsplashSqft: { id: 'backsplash', unit: 'sqft' },
  countertopSqft: { id: 'countertops', unit: 'sqft' },
  cabinetLf: { id: 'cabinets', unit: 'lf' },
  kitchenFloorSqft: { id: 'flooring', unit: 'sqft' },
};

/** Install scope for area/LF lines — sqft/LF replaces the old +/- steppers. */
export function resolveKitchenInstallScopeCounts(
  measurements: Record<string, unknown>
): KitchenInstallCounts {
  const saved = readKitchenInstallCounts(measurements);
  return {
    kitchenInstallCabinetCount:
      parseMeasurementQty(measurements.cabinetLf) > 0
        ? 1
        : positiveCount(saved.kitchenInstallCabinetCount),
    kitchenInstallCounterCount:
      parseMeasurementQty(measurements.countertopSqft) > 0
        ? 1
        : positiveCount(saved.kitchenInstallCounterCount),
    kitchenInstallBacksplashCount:
      parseMeasurementQty(measurements.backsplashSqft) > 0
        ? 1
        : positiveCount(saved.kitchenInstallBacksplashCount),
    kitchenInstallFlooringCount:
      parseMeasurementQty(measurements.kitchenFloorSqft) > 0
        ? 1
        : positiveCount(saved.kitchenInstallFlooringCount),
    kitchenInstallApplianceCount: saved.kitchenInstallApplianceCount,
    kitchenInstallIslandCount: saved.kitchenInstallIslandCount,
  };
}

/** Pre-fill demo rows from existing + install measurements; respects manual demo overrides. */
export function suggestKitchenDemoFromExistingInstall(params: {
  existing: KitchenExistingCounts;
  install: KitchenInstallCounts;
  demo: KitchenDemoCounts;
  measurements: Record<string, unknown>;
  overrides?: Partial<Record<KitchenDemoOverrideKey, boolean>>;
}): KitchenDemoCounts {
  const next = { ...params.demo };
  const overrides = params.overrides || {};
  const backsplashSqft = parseMeasurementQty(params.measurements.backsplashSqft);
  const kitchenFloorSqft = parseMeasurementQty(params.measurements.kitchenFloorSqft);
  const counterInScope =
    parseMeasurementQty(params.measurements.countertopSqft) > 0 ||
    positiveCount(params.install.kitchenInstallCounterCount) != null;
  const cabinetInScope =
    parseMeasurementQty(params.measurements.cabinetLf) > 0 ||
    positiveCount(params.install.kitchenInstallCabinetCount) != null;

  if (!overrides.kitchenDemoCabinetCount) {
    next.kitchenDemoCabinetCount = cabinetInScope ? 1 : null;
  }
  if (!overrides.kitchenDemoCounterCount) {
    next.kitchenDemoCounterCount = counterInScope ? 1 : null;
  }
  if (!overrides.kitchenDemoBacksplashCount) {
    next.kitchenDemoBacksplashCount = backsplashSqft > 0 ? 1 : null;
  }
  if (!overrides.kitchenDemoFloorCount) {
    next.kitchenDemoFloorCount = kitchenFloorSqft > 0 ? 1 : null;
  }
  if (!overrides.kitchenDemoApplianceCount) {
    next.kitchenDemoApplianceCount =
      positiveCount(params.existing.kitchenExistingApplianceCount) != null &&
      positiveCount(params.install.kitchenInstallApplianceCount) != null
        ? 1
        : null;
  }
  if (!overrides.kitchenDemoIslandCount) {
    next.kitchenDemoIslandCount =
      positiveCount(params.install.kitchenInstallIslandCount) != null ? 1 : null;
  }
  return next;
}

export function patchKitchenMeasurementItemQuantities(
  itemQuantities: Record<string, { quantity?: string | number; unit?: string; quantitySource?: string }>,
  key: string,
  value: string,
  measurements?: Record<string, unknown>
): Record<string, { quantity?: string | number; unit?: string; quantitySource?: string }> {
  const next = { ...itemQuantities };
  if (
    measurements &&
    (key === 'countertopSqft' || key === 'kitchenIslandCounterSqft')
  ) {
    const sqft = resolveKitchenCountertopTakeoffSqft({
      ...measurements,
      [key]: value,
    });
    if (sqft > 0) {
      const patch = {
        quantity: String(sqft),
        unit: 'sqft',
        quantitySource: 'user_entered',
      };
      next.countertops = patch;
      next.countertop_demo = patch;
    } else {
      delete next.countertops;
      delete next.countertop_demo;
    }
    return next;
  }
  const mapped = KITCHEN_MEASUREMENT_ITEM_MAP[key];
  if (!mapped) return next;
  if (String(value || '').trim()) {
    next[mapped.id] = {
      quantity: value,
      unit: mapped.unit,
      quantitySource: 'user_entered',
    };
  } else {
    delete next[mapped.id];
  }
  return next;
}

export type KitchenExistingCounts = {
  kitchenExistingCabinetCount: number | null;
  kitchenExistingCounterCount: number | null;
  kitchenExistingApplianceCount: number | null;
  kitchenExistingBacksplashCount: number | null;
  kitchenExistingFloorCount: number | null;
};

export type KitchenInstallCounts = {
  kitchenInstallCabinetCount: number | null;
  kitchenInstallCounterCount: number | null;
  kitchenInstallApplianceCount: number | null;
  kitchenInstallBacksplashCount: number | null;
  kitchenInstallFlooringCount: number | null;
  kitchenInstallIslandCount: number | null;
};

export type KitchenDemoCounts = {
  kitchenDemoCabinetCount: number | null;
  kitchenDemoCounterCount: number | null;
  kitchenDemoBacksplashCount: number | null;
  kitchenDemoIslandCount: number | null;
  kitchenDemoApplianceCount: number | null;
  kitchenDemoFloorCount: number | null;
  kitchenDemoWallCount: number | null;
};

export type KitchenDemoOverrideKey = keyof KitchenDemoCounts;

export const KITCHEN_QM_EMBEDDED_IDS = new Set([
  'cabinet_demo',
  'countertop_demo',
  'backsplash_demo',
  'floor_demo',
  'island_demo',
  'appliance_removal',
  'countertops',
  'backsplash',
  'flooring',
  'appliances',
  'island',
  'cabinet_hardware',
]);

const EXISTING_KEYS: (keyof KitchenExistingCounts)[] = [
  'kitchenExistingCabinetCount',
  'kitchenExistingCounterCount',
  'kitchenExistingApplianceCount',
  'kitchenExistingBacksplashCount',
  'kitchenExistingFloorCount',
];

const INSTALL_KEYS: (keyof KitchenInstallCounts)[] = [
  'kitchenInstallCabinetCount',
  'kitchenInstallCounterCount',
  'kitchenInstallApplianceCount',
  'kitchenInstallBacksplashCount',
  'kitchenInstallFlooringCount',
  'kitchenInstallIslandCount',
];

const DEMO_KEYS: (keyof KitchenDemoCounts)[] = [
  'kitchenDemoCabinetCount',
  'kitchenDemoCounterCount',
  'kitchenDemoBacksplashCount',
  'kitchenDemoIslandCount',
  'kitchenDemoApplianceCount',
  'kitchenDemoFloorCount',
  'kitchenDemoWallCount',
];

export function readKitchenExistingCounts(m: Record<string, unknown>): KitchenExistingCounts {
  return {
    kitchenExistingCabinetCount: positiveCount(m.kitchenExistingCabinetCount),
    kitchenExistingCounterCount: positiveCount(m.kitchenExistingCounterCount),
    kitchenExistingApplianceCount: positiveCount(m.kitchenExistingApplianceCount),
    kitchenExistingBacksplashCount: positiveCount(m.kitchenExistingBacksplashCount),
    kitchenExistingFloorCount: positiveCount(m.kitchenExistingFloorCount),
  };
}

export function readKitchenInstallCounts(m: Record<string, unknown>): KitchenInstallCounts {
  return {
    kitchenInstallCabinetCount: positiveCount(m.kitchenInstallCabinetCount),
    kitchenInstallCounterCount: positiveCount(m.kitchenInstallCounterCount),
    kitchenInstallApplianceCount: positiveCount(m.kitchenInstallApplianceCount),
    kitchenInstallBacksplashCount: positiveCount(m.kitchenInstallBacksplashCount),
    kitchenInstallFlooringCount: positiveCount(m.kitchenInstallFlooringCount),
    kitchenInstallIslandCount: positiveCount(m.kitchenInstallIslandCount),
  };
}

export function readKitchenDemoCounts(m: Record<string, unknown>): KitchenDemoCounts {
  return {
    kitchenDemoCabinetCount: positiveCount(m.kitchenDemoCabinetCount),
    kitchenDemoCounterCount:
      m.kitchenDemoCounterCount === undefined
        ? positiveCount(m.kitchenDemoCabinetCount)
        : positiveCount(m.kitchenDemoCounterCount),
    kitchenDemoBacksplashCount: positiveCount(m.kitchenDemoBacksplashCount),
    kitchenDemoIslandCount: positiveCount(m.kitchenDemoIslandCount),
    kitchenDemoApplianceCount: positiveCount(m.kitchenDemoApplianceCount),
    kitchenDemoFloorCount: positiveCount(m.kitchenDemoFloorCount),
    kitchenDemoWallCount: positiveCount(m.kitchenDemoWallCount),
  };
}

export function emptyKitchenExistingCounts(): KitchenExistingCounts {
  return {
    kitchenExistingCabinetCount: null,
    kitchenExistingCounterCount: null,
    kitchenExistingApplianceCount: null,
    kitchenExistingBacksplashCount: null,
    kitchenExistingFloorCount: null,
  };
}

function notesMentionExistingCabinets(n: string): boolean {
  return /\b(existing|current|old)\s+cabinets?\b|\bcabinets?\s+and\s+counters?\b/.test(n);
}

function notesMentionExistingCounters(n: string): boolean {
  return /\b(existing|current|old)\s+(?:countertops?|counters?)\b/.test(n);
}

function notesMentionExistingAppliances(n: string): boolean {
  return /\b(existing|current)\s+(?:appliances?|range|dishwasher|refrigerator)\b/.test(n);
}

export function inferExistingKitchenFromNotes(notes: string | null | undefined): KitchenExistingCounts {
  const n = String(notes || '').toLowerCase();
  const out = emptyKitchenExistingCounts();
  if (notesMentionExistingCabinets(n)) out.kitchenExistingCabinetCount = 1;
  if (notesMentionExistingCounters(n)) out.kitchenExistingCounterCount = 1;
  if (notesMentionExistingAppliances(n)) out.kitchenExistingApplianceCount = 1;
  if (/\b(existing|current)\s+backsplash\b/.test(n)) out.kitchenExistingBacksplashCount = 1;
  if (/\b(existing|current)\s+(?:kitchen\s+)?(?:floor|flooring|tile|lvp)\b/.test(n)) {
    out.kitchenExistingFloorCount = 1;
  }
  return out;
}

function checklistIncluded(items: ScopeChecklistItem[], id: string): boolean {
  return items.find((r) => r.id === id)?.state === 'included';
}

function namedKitchenApplianceCount(notes: string): number {
  const appliances = new Set<string>();
  if (/\brange\b|\boven\b/.test(notes)) appliances.add('range');
  if (/\bdishwasher\b/.test(notes)) appliances.add('dishwasher');
  if (/\brefrigerator\b|\bfridge\b/.test(notes)) appliances.add('refrigerator');
  if (/\bmicrowave\b/.test(notes)) appliances.add('microwave');
  return appliances.size;
}

export function inferKitchenInstallFromIntent(params: {
  notes?: string | null;
  checklistItems?: ScopeChecklistItem[];
}): KitchenInstallCounts {
  const n = String(params.notes || '').toLowerCase();
  const items = params.checklistItems || [];
  const out: KitchenInstallCounts = {
    kitchenInstallCabinetCount: null,
    kitchenInstallCounterCount: null,
    kitchenInstallApplianceCount: null,
    kitchenInstallBacksplashCount: null,
    kitchenInstallFlooringCount: null,
    kitchenInstallIslandCount: null,
  };
  if (checklistIncluded(items, 'cabinets') || inferItemStateFromNotes('cabinets', n) === 'included') {
    out.kitchenInstallCabinetCount = 1;
  }
  if (
    checklistIncluded(items, 'countertops') ||
    inferItemStateFromNotes('countertops', n) === 'included'
  ) {
    out.kitchenInstallCounterCount = 1;
  }
  const namedAppliances = namedKitchenApplianceCount(n);
  if (
    checklistIncluded(items, 'appliances') ||
    inferItemStateFromNotes('appliances', n) === 'included'
  ) {
    out.kitchenInstallApplianceCount = namedAppliances || null;
  }
  if (
    checklistIncluded(items, 'backsplash') ||
    inferItemStateFromNotes('backsplash', n) === 'included'
  ) {
    out.kitchenInstallBacksplashCount = 1;
  }
  if (checklistIncluded(items, 'flooring') || inferItemStateFromNotes('flooring', n) === 'included') {
    out.kitchenInstallFlooringCount = 1;
  }
  const islandCountertopOnly =
    /\bisland\s+(?:countertops?|counters?)\b|\b(?:countertops?|counters?)\s+on\s+(?:the\s+)?island\b/.test(n);
  const notesRequestIslandBase =
    /\b(?:new|install|build|add|replace)\b[^.]{0,30}\bisland\b(?!\s+(?:countertops?|counters?)\b)/.test(n);
  if ((checklistIncluded(items, 'island') && !islandCountertopOnly) || notesRequestIslandBase) {
    out.kitchenInstallIslandCount = 1;
  }
  if (/\bnew\s+cabinets?\b/.test(n) && !out.kitchenInstallCabinetCount) out.kitchenInstallCabinetCount = 1;
  if (/\bnew\s+(?:countertops?|counters?|quartz|granite)\b/.test(n) && !out.kitchenInstallCounterCount) {
    out.kitchenInstallCounterCount = 1;
  }
  return out;
}

export function resolveKitchenDemoFromIntent(params: {
  notes?: string | null;
  existing: KitchenExistingCounts;
  install: KitchenInstallCounts;
  tubDemoIncluded?: boolean;
  checklistItems?: ScopeChecklistItem[];
}): KitchenDemoCounts {
  const n = String(params.notes || '').toLowerCase();
  const ex = params.existing;
  const ins = params.install;
  const items = params.checklistItems || [];
  const demo: KitchenDemoCounts = {
    kitchenDemoCabinetCount: null,
    kitchenDemoCounterCount: null,
    kitchenDemoBacksplashCount: null,
    kitchenDemoIslandCount: null,
    kitchenDemoApplianceCount: null,
    kitchenDemoFloorCount: null,
    kitchenDemoWallCount: null,
  };
  const islandCountertopOnly =
    /\bisland\s+(?:countertops?|counters?)\b|\b(?:countertops?|counters?)\s+on\s+(?:the\s+)?island\b/.test(n);

  const explicitCabinetDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(?:cabinets?|built[\s-]?ins?)\b/.test(n);
  const explicitCounterDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(?:countertops?|counters?)\b/.test(n) ||
    /\b(?:countertops?|counters?)\b[^.]{0,50}\b(?:demo|remove|tear[\s-]?out)\b/.test(n);
  const cabinetDemo =
    checklistIncluded(items, 'cabinet_demo') ||
    inferItemStateFromNotes('cabinet_demo', n) === 'included' ||
    (explicitCabinetDemo &&
      (positiveCount(ex.kitchenExistingCabinetCount) || positiveCount(ex.kitchenExistingCounterCount)));
  const counterDemo =
    checklistIncluded(items, 'countertop_demo') ||
    inferItemStateFromNotes('countertop_demo', n) === 'included' ||
    explicitCounterDemo;
  if (explicitCabinetDemo) {
    demo.kitchenDemoCabinetCount = 1;
  }
  if (explicitCounterDemo) {
    demo.kitchenDemoCounterCount = 1;
  }
  if (
    checklistIncluded(items, 'backsplash_demo') ||
    inferItemStateFromNotes('backsplash_demo', n) === 'included'
  ) {
    demo.kitchenDemoBacksplashCount = 1;
  }
  if (
    cabinetDemo &&
    (positiveCount(ex.kitchenExistingCabinetCount) ||
      positiveCount(ex.kitchenExistingCounterCount)) &&
    (positiveCount(ins.kitchenInstallCabinetCount) ||
      positiveCount(ins.kitchenInstallCounterCount) ||
      cabinetDemo)
  ) {
    demo.kitchenDemoCabinetCount = 1;
  } else if (
    (positiveCount(ex.kitchenExistingCabinetCount) || positiveCount(ex.kitchenExistingCounterCount)) &&
    (positiveCount(ins.kitchenInstallCabinetCount) || positiveCount(ins.kitchenInstallCounterCount))
  ) {
    demo.kitchenDemoCabinetCount = 1;
  }

  if (
    counterDemo &&
    (positiveCount(ex.kitchenExistingCounterCount) ||
      positiveCount(ex.kitchenExistingCabinetCount)) &&
    (positiveCount(ins.kitchenInstallCounterCount) ||
      positiveCount(ins.kitchenInstallCabinetCount) ||
      counterDemo)
  ) {
    demo.kitchenDemoCounterCount = 1;
  } else if (
    positiveCount(ex.kitchenExistingCounterCount) &&
    positiveCount(ins.kitchenInstallCounterCount)
  ) {
    demo.kitchenDemoCounterCount = 1;
  }

  const explicitIslandBaseDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,40}\b(?:island\s+(?:cabinet|base)|island)\b/.test(n) ||
    /\b(?:island\s+(?:cabinet|base)|island)\b[^.]{0,40}\b(?:demo|remove|tear[\s-]?out)\b/.test(n);
  if (
    (checklistIncluded(items, 'island_demo') ||
      inferItemStateFromNotes('island_demo', n) === 'included' ||
      explicitIslandBaseDemo) &&
    !islandCountertopOnly
  ) {
    demo.kitchenDemoIslandCount = 1;
  }

  if (
    (checklistIncluded(items, 'appliance_removal') ||
      inferItemStateFromNotes('appliance_removal', n) === 'included' ||
      (positiveCount(ex.kitchenExistingApplianceCount) && positiveCount(ins.kitchenInstallApplianceCount))) &&
    positiveCount(ex.kitchenExistingApplianceCount)
  ) {
    demo.kitchenDemoApplianceCount =
      namedKitchenApplianceCount(n) ||
      positiveCount(ex.kitchenExistingApplianceCount) ||
      null;
  }

  if (
    (checklistIncluded(items, 'floor_demo') ||
      inferItemStateFromNotes('floor_demo', n) === 'included' ||
      (positiveCount(ex.kitchenExistingFloorCount) && positiveCount(ins.kitchenInstallFlooringCount))) &&
    positiveCount(ex.kitchenExistingFloorCount)
  ) {
    demo.kitchenDemoFloorCount = 1;
  }

  return demo;
}

function checklistRowInScope(item: ScopeChecklistItem): boolean {
  return (
    item.state === 'included' ||
    (item.inputType === 'choice' &&
      Boolean(item.choiceId) &&
      item.choiceId !== 'not_in_scope' &&
      item.choiceId !== 'unsure')
  );
}

/** Show the normal Confirm Scope pricing card when QM steppers or checklist say this line is in scope. */
export function kitchenQmScopeCardVisible(
  itemId: string,
  measurements: Record<string, unknown>,
  items?: ScopeChecklistItem[]
): boolean {
  if (!KITCHEN_QM_EMBEDDED_IDS.has(itemId)) return false;

  const install = resolveKitchenInstallScopeCounts(measurements);
  const demo = readKitchenDemoCounts(measurements);
  const row = items?.find((r) => r.id === itemId);
  const rowInScope = Boolean(row && checklistRowInScope(row));

  switch (itemId) {
    case 'countertops':
      return (
        parseMeasurementQty(measurements.countertopSqft) > 0 ||
        positiveCount(install.kitchenInstallCounterCount) != null ||
        rowInScope
      );
    case 'backsplash':
      return (
        parseMeasurementQty(measurements.backsplashSqft) > 0 ||
        positiveCount(install.kitchenInstallBacksplashCount) != null ||
        rowInScope
      );
    case 'flooring':
      return (
        parseMeasurementQty(measurements.kitchenFloorSqft) > 0 ||
        positiveCount(install.kitchenInstallFlooringCount) != null ||
        rowInScope
      );
    case 'appliances':
      return positiveCount(install.kitchenInstallApplianceCount) != null || rowInScope;
    case 'island':
      return positiveCount(install.kitchenInstallIslandCount) != null || rowInScope;
    case 'cabinet_demo':
      return (
        positiveCount(demo.kitchenDemoCabinetCount) != null ||
        parseMeasurementQty(measurements.cabinetLf) > 0 ||
        rowInScope
      );
    case 'island_demo':
      return positiveCount(demo.kitchenDemoIslandCount) != null || rowInScope;
    case 'countertop_demo':
      return (
        positiveCount(demo.kitchenDemoCounterCount) != null ||
        parseMeasurementQty(measurements.countertopSqft) > 0 ||
        rowInScope
      );
    case 'floor_demo':
      return (
        positiveCount(demo.kitchenDemoFloorCount) != null ||
        (parseMeasurementQty(measurements.kitchenFloorSqft) > 0 &&
          positiveCount(readKitchenExistingCounts(measurements).kitchenExistingFloorCount) != null) ||
        rowInScope
      );
    case 'backsplash_demo':
      return (
        positiveCount(demo.kitchenDemoBacksplashCount) != null ||
        parseMeasurementQty(measurements.backsplashSqft) > 0 ||
        rowInScope
      );
    case 'appliance_removal':
      return positiveCount(demo.kitchenDemoApplianceCount) != null || rowInScope;
    default:
      break;
  }

  return rowInScope;
}

/** Hide from the scope list only while QM embed is active and the line is not in scope yet. */
export function shouldHideKitchenScopeCardInQmEmbed(
  itemId: string,
  measurements: Record<string, unknown>,
  items?: ScopeChecklistItem[]
): boolean {
  // Basic hardware is included in the stock cabinet supply/install allowance.
  // Keep the separate card available only for explicitly selected specialty or
  // upgrade hardware.
  if (itemId === 'cabinet_hardware') {
    const cabinetRow = items?.find((r) => r.id === 'cabinets');
    const hardwareRow = items?.find((r) => r.id === 'cabinet_hardware');
    return (
      Boolean(cabinetRow && checklistRowInScope(cabinetRow)) &&
      !Boolean(hardwareRow && checklistRowInScope(hardwareRow))
    );
  }
  if (!KITCHEN_QM_EMBEDDED_IDS.has(itemId)) return false;
  return !kitchenQmScopeCardVisible(itemId, measurements, items);
}

export function migrateKitchenDemoSplit(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  measurements?: Record<string, unknown>
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'kitchen') return items;
  const withoutRetired = items.filter((row) => row.id !== 'wall_demo');
  const withIslandDemo = ensureKitchenIslandDemoItem(withoutRetired);
  if (withIslandDemo.some((row) => row.id === 'cabinet_demo')) {
    return withIslandDemo.filter((row) => row.id !== 'demo');
  }

  const demoIdx = withIslandDemo.findIndex((row) => row.id === 'demo');
  if (demoIdx < 0) return withIslandDemo;

  const legacy = withIslandDemo[demoIdx];
  const demo = measurements ? readKitchenDemoCounts(measurements) : null;
  const hasQmDemo =
    demo != null &&
    (positiveCount(demo.kitchenDemoCabinetCount) != null ||
      positiveCount(demo.kitchenDemoCounterCount) != null);

  let cabinetState = legacy.state;
  let counterState = legacy.state;
  if (hasQmDemo && demo) {
    cabinetState = positiveCount(demo.kitchenDemoCabinetCount) != null
      ? 'included'
      : 'excluded';
    counterState = positiveCount(demo.kitchenDemoCounterCount) != null
      ? 'included'
      : 'excluded';
  } else if (legacy.state === 'included') {
    cabinetState = 'included';
    counterState = 'included';
  }

  const cabinetDemo: ScopeChecklistItem = {
    id: 'cabinet_demo',
    inputType: 'yes_no',
    label: 'Cabinet demo / removal',
    helperText:
      'Disconnect, remove, and haul kitchen cabinet boxes — countertop demo is a separate line.',
    category: 'demo',
    state: cabinetState,
  };
  const countertopDemo: ScopeChecklistItem = {
    id: 'countertop_demo',
    inputType: 'yes_no',
    label: 'Countertop demo / removal',
    helperText:
      'Remove and haul existing countertops — cabinet demo is a separate line.',
    category: 'demo',
    state: counterState,
  };

  const next = [...withIslandDemo];
  next.splice(demoIdx, 1, cabinetDemo, countertopDemo);
  return next;
}

function ensureKitchenIslandDemoItem(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  if (items.some((row) => row.id === 'island_demo')) return items;
  const islandDemo: ScopeChecklistItem = {
    id: 'island_demo',
    inputType: 'yes_no',
    label: 'Island demo / removal',
    helperText:
      'Detach, remove, and haul one standard kitchen island cabinet/base. Countertop, appliances, utility disconnections, and floor repair are separate.',
    category: 'demo',
    state: 'unsure',
  };
  const floorDemoIdx = items.findIndex((row) => row.id === 'floor_demo');
  if (floorDemoIdx >= 0) {
    const next = [...items];
    next.splice(floorDemoIdx + 1, 0, islandDemo);
    return next;
  }
  const backsplashDemoIdx = items.findIndex((row) => row.id === 'backsplash_demo');
  if (backsplashDemoIdx >= 0) {
    const next = [...items];
    next.splice(backsplashDemoIdx + 1, 0, islandDemo);
    return next;
  }
  return [...items, islandDemo];
}

export function mergeKitchenCounts<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>
): T {
  const out = { ...base };
  for (const key of [...EXISTING_KEYS, ...INSTALL_KEYS, ...DEMO_KEYS]) {
    if (patch[key] != null) (out as Record<string, unknown>)[key] = patch[key];
    else if (key in patch) (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

function mergeCountLayers(
  ...layers: Array<Record<string, number | null | undefined>>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (positiveCount(v)) out[k] = 1;
    }
  }
  return out;
}

export function syncKitchenQmScopeItems(
  items: ScopeChecklistItem[],
  m: Record<string, unknown>
): ScopeChecklistItem[] {
  const install = resolveKitchenInstallScopeCounts(m);
  const demo = suggestKitchenDemoFromExistingInstall({
    existing: readKitchenExistingCounts(m),
    install,
    demo: readKitchenDemoCounts(m),
    measurements: m,
  });
  let changed = false;
  const next = items.map((row) => {
    const syncIncluded = (cond: boolean) => {
      if (cond && row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      // The QM stepper is the source of truth for embedded kitchen scopes.
      // Remove a previously synced scope when its stepper is turned off, but
      // preserve an explicit note-backed row so brief notes can still collect
      // its missing measurement on the scope card.
      if (!cond && row.state === 'included') {
        if (row.noteBacked) return row;
        changed = true;
        return { ...row, state: 'excluded' as const };
      }
      return row;
    };
    switch (row.id) {
      case 'cabinets':
        return syncIncluded(positiveCount(install.kitchenInstallCabinetCount) != null);
      case 'countertops':
        return syncIncluded(positiveCount(install.kitchenInstallCounterCount) != null);
      case 'backsplash':
        return syncIncluded(positiveCount(install.kitchenInstallBacksplashCount) != null);
      case 'flooring':
        return syncIncluded(positiveCount(install.kitchenInstallFlooringCount) != null);
      case 'appliances':
        return syncIncluded(positiveCount(install.kitchenInstallApplianceCount) != null);
      case 'island':
        return syncIncluded(positiveCount(install.kitchenInstallIslandCount) != null);
      case 'cabinet_demo':
        return syncIncluded(
          positiveCount(demo.kitchenDemoCabinetCount) != null ||
            parseMeasurementQty(m.cabinetLf) > 0
        );
      case 'island_demo':
        return syncIncluded(
          positiveCount(demo.kitchenDemoIslandCount) != null ||
            positiveCount(m.kitchenDemoIslandCount) != null
        );
      case 'countertop_demo':
        return syncIncluded(
          positiveCount(demo.kitchenDemoCounterCount) != null ||
            parseMeasurementQty(m.countertopSqft) > 0
        );
      case 'backsplash_demo':
        return syncIncluded(
          positiveCount(demo.kitchenDemoBacksplashCount) != null ||
            parseMeasurementQty(m.backsplashSqft) > 0
        );
      case 'appliance_removal':
        return syncIncluded(
          positiveCount(demo.kitchenDemoApplianceCount) != null ||
            positiveCount(m.kitchenDemoApplianceCount) != null
        );
      case 'floor_demo':
        return syncIncluded(positiveCount(demo.kitchenDemoFloorCount) != null);
      default:
        return row;
    }
  });
  return changed ? next : items;
}

function hydrateKitchen(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const hasSavedInstall = INSTALL_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedDemo = DEMO_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedExisting = EXISTING_KEYS.some((k) => positiveCount(saved[k]));

  let existing = readKitchenExistingCounts(saved);
  if (ctx.hasSitePhotos) {
    existing = {
      ...existing,
      ...mergeCountLayers(
        inferExistingKitchenFromNotes(ctx.notes),
        readKitchenExistingCounts(saved)
      ),
    } as KitchenExistingCounts;
  } else if (!hasSavedExisting) {
    existing = emptyKitchenExistingCounts();
  }

  const install = hasSavedInstall
    ? readKitchenInstallCounts(saved)
    : inferKitchenInstallFromIntent({ notes: ctx.notes, checklistItems: ctx.checklistItems });

  const demo = hasSavedDemo
    ? readKitchenDemoCounts(saved)
    : resolveKitchenDemoFromIntent({
        notes: ctx.notes,
        existing,
        install,
        checklistItems: ctx.checklistItems,
      });

  return mergeKitchenCounts(saved, { ...existing, ...install, ...demo });
}

export const kitchenQmPanel: QmPanelDefinition = {
  id: 'kitchen_remodel',
  templateKeys: ['kitchen'],
  embeddedScopeItemIds: [...KITCHEN_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'kitchen',
  hydrateMeasurements: hydrateKitchen,
  syncScopeItems: syncKitchenQmScopeItems,
};
