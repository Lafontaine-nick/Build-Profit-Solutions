import { isWholeHomeQuickMeasurementTemplate } from '@/utils/scopeQuickMeasurements';

type ChecklistRow = {
  id?: string;
  label?: string;
  state?: string;
  choiceId?: string | null;
  choiceIds?: string[] | null;
};

type ScopeIntentRow = {
  id?: string;
  state?: string;
  evidence?: string;
};

type PricingAcceptance = {
  pricingSourceKind?: string;
  pricingSourceLabel?: string;
  rateSourceLabel?: string;
  pricingTypeLabel?: string;
};

export type ProposalDraftScope = {
  inclusions?: string[] | null;
  exclusions?: string[] | null;
  scopeChecklist?: {
    templateKey?: string | null;
    items?: ChecklistRow[] | null;
  } | null;
  scopeIntent?: { items?: ScopeIntentRow[] | null } | null;
  scopeMeasurements?: {
    planImportMode?: string | null;
    planImportTradeKey?: string | null;
    pricingAcceptance?: Record<string, PricingAcceptance> | null;
  } | null;
  projectType?: string | null;
};

function uniqueLines(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    lines.push(text);
  }
  return lines;
}

function rowIsExcluded(item: ChecklistRow): boolean {
  if (item.state === 'excluded') return true;
  if (item.choiceId === 'not_in_scope') return true;
  return (item.choiceIds || []).includes('not_in_scope');
}

/** Included and excluded lines the PDF should print from the confirmed draft. */
export function proposalScopeLists(draft: ProposalDraftScope | null | undefined): {
  inclusions: string[];
  exclusions: string[];
} {
  const items = draft?.scopeChecklist?.items || [];
  const excludedKeys = new Set(
    items
      .filter(rowIsExcluded)
      .map(item => String(item.label || '').trim().toLowerCase())
      .filter(Boolean)
  );
  return {
    inclusions: uniqueLines(
      (draft?.inclusions || []).filter(
        line => !excludedKeys.has(String(line || '').trim().toLowerCase())
      )
    ),
    exclusions: uniqueLines([
      ...(draft?.exclusions || []),
      ...items.filter(rowIsExcluded).map(item => item.label),
      ...(draft?.scopeIntent?.items || [])
        .filter(item => item.state === 'excluded')
        .map(item => item.evidence),
    ]),
  };
}

/** Whole-home wet area uses the combined bath layout. A single-trade plan does not. */
export function proposalUsesWholeHomeWetArea(params: {
  templateKey?: string | null;
  projectType?: string | null;
  planImportMode?: string | null;
  planImportTradeKey?: string | null;
}): boolean {
  const mode = String(params.planImportMode || '');
  const trade = String(params.planImportTradeKey || '');
  if (mode === 'whole_project') return !trade;
  return (
    isWholeHomeQuickMeasurementTemplate(params.templateKey) ||
    isWholeHomeQuickMeasurementTemplate(params.projectType)
  );
}

/**
 * Saved bid material lines are the export. An AI bid with no saved lines
 * must not pick up the materials cart from another job.
 */
export function proposalMaterialSource<T>(
  savedLines: T[] | null | undefined,
  cartLines: T[] | null | undefined,
  hasAiSnapshot: boolean
): T[] {
  const saved = Array.isArray(savedLines) ? savedLines : [];
  if (saved.length > 0) return saved;
  if (hasAiSnapshot) return [];
  return Array.isArray(cartLines) ? cartLines : [];
}

function acceptanceBlob(acceptance: PricingAcceptance | null | undefined): string {
  if (!acceptance) return '';
  return [
    acceptance.pricingSourceKind,
    acceptance.pricingSourceLabel,
    acceptance.rateSourceLabel,
    acceptance.pricingTypeLabel,
  ]
    .filter(Boolean)
    .join(' ');
}

const PAINT_LINE_IDS: Record<string, string[]> = {
  'Combined paintable area': ['interior_paint', 'paint', 'paint_repair', 'ceiling_paint'],
  'Wall paint': ['interior_paint', 'paint', 'paint_repair'],
  'Ceiling paint': ['ceiling_paint', 'interior_paint', 'paint'],
  'Baseboard / trim': ['trim_paint', 'baseboard_install', 'interior_trim'],
  'Interior doors': ['door_paint', 'interior_door_install', 'interior_doors'],
  'Exterior doors': ['exterior_door_paint', 'exterior_doors', 'exterior_door_install'],
  'Cabinet run length': ['cabinet_paint', 'cabinets'],
  'Cabinet paint area': ['cabinet_paint'],
  'Exterior paint': ['exterior_paint'],
};

const WET_AREA_IDS = new Set([
  'wet_area_install',
  'shower_tile',
  'shower_floor_tile',
  'floor_tile',
  'shower_pan',
  'tub_install',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'glass_door',
]);

const PAINT_TRADES = new Set(['painting', 'paint']);
const WET_TRADES = new Set(['bathroom', 'bath', 'plumbing']);
const ELECTRICAL_TRADES = new Set(['electrical']);

function rowIsOnSnapshot(item: ChecklistRow): boolean {
  return !rowIsExcluded(item);
}

function includedIds(items: ChecklistRow[]): Set<string> {
  return new Set(
    items
      .filter(rowIsOnSnapshot)
      .map(item => String(item.id || '').trim())
      .filter(Boolean)
  );
}

function lineIsOnSnapshot(ids: string[] | undefined, included: Set<string>): boolean {
  if (!ids?.length) return false;
  return ids.some(id => included.has(id));
}

export type ProposalExportParts<TCard, TAllowance> = {
  paintingLines: Array<{ label: string; quantity: string }>;
  wetAreaCard: TCard | null;
  electricalCard: TCard | null;
  allowances: TAllowance[];
};

/**
 * Measurements, allowances, and single-trade cards follow the confirmed rows.
 * A quantity the screen dropped does not get its own PDF section.
 */
export function filterProposalExportToSnapshot<TCard, TAllowance extends {
  checklistItemId?: string | null;
  costCode?: string | null;
  sourceItemId?: string | null;
  name?: string | null;
}>(params: {
  items?: ChecklistRow[] | null;
  confirmed?: boolean;
  planImportTradeKey?: string | null;
  paintingLines?: Array<{ label: string; quantity: string }> | null;
  wetAreaCard?: TCard | null;
  electricalCard?: TCard | null;
  allowances?: TAllowance[] | null;
}): ProposalExportParts<TCard, TAllowance> {
  const paintingLines = [...(params.paintingLines || [])];
  let wetAreaCard = params.wetAreaCard ?? null;
  let electricalCard = params.electricalCard ?? null;
  const allowances = [...(params.allowances || [])];
  const items = params.items || [];
  if (!params.confirmed || !items.length) {
    return { paintingLines, wetAreaCard, electricalCard, allowances };
  }

  const included = includedIds(items);
  const keptPaint = paintingLines.filter(line =>
    lineIsOnSnapshot(PAINT_LINE_IDS[line.label], included)
  );
  const hasElectrical = [...included].some(id => id === 'electrical' || id.startsWith('electrical_'));
  const trade = String(params.planImportTradeKey || '').toLowerCase();

  let nextPaint = keptPaint;
  let nextWet = includedHasWetArea(included) ? wetAreaCard : null;
  let nextElectrical = hasElectrical ? electricalCard : null;
  if (trade) {
    if (!PAINT_TRADES.has(trade)) nextPaint = [];
    if (!WET_TRADES.has(trade)) nextWet = null;
    if (!ELECTRICAL_TRADES.has(trade)) nextElectrical = null;
  }

  const labels = new Set(
    items
      .filter(rowIsOnSnapshot)
      .map(item => String(item.label || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const keptAllowances = allowances.filter(line => {
    const id = String(line.checklistItemId || line.costCode || line.sourceItemId || '').trim();
    if (id) return included.has(id);
    const name = String(line.name || '').trim().toLowerCase();
    return Boolean(name) && labels.has(name);
  });

  return {
    paintingLines: nextPaint,
    wetAreaCard: nextWet,
    electricalCard: nextElectrical,
    allowances: keptAllowances,
  };
}

function includedHasWetArea(included: Set<string>): boolean {
  for (const id of included) {
    if (WET_AREA_IDS.has(id)) return true;
  }
  return false;
}

/** Planning-rate money stays the same. The PDF name says it is an allowance. */
export function proposalAllowanceLineName(
  name: string,
  acceptance: PricingAcceptance | null | undefined
): string {
  const base = String(name || '').trim();
  if (!base || /\ballowance\b/i.test(base)) return base;
  const blob = acceptanceBlob(acceptance);
  if (
    acceptance?.pricingSourceKind === 'allowance' ||
    /planning allowance/i.test(blob)
  ) {
    return `${base} — allowance`;
  }
  return base;
}

export function proposalAcceptanceForLine(
  draft: ProposalDraftScope | null | undefined,
  line: { checklistItemId?: string | null; costCode?: string | null; sourceItemId?: string | null }
): PricingAcceptance | null {
  const acceptance = draft?.scopeMeasurements?.pricingAcceptance || {};
  const keys = [line.checklistItemId, line.costCode, line.sourceItemId]
    .map(key => String(key || '').trim())
    .filter(Boolean);
  for (const key of keys) {
    if (acceptance[key]) return acceptance[key];
  }
  return null;
}
