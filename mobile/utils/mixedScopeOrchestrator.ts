import type {
  EstimateAiDraft,
  ScopeChecklistItem,
} from '@/utils/estimateAiDraft';
import {
  syncQmPanelScopeItems,
} from '@/utils/qmScopePanels';
import {
  syncElectricalScopeItems,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  syncFramingScopeItems,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  syncGarageDoorsScopeItems,
} from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';
import {
  syncPlumbingScopeItems,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  syncWindowsDoorsScopeItems,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';

export type MixedScopeTradeKey =
  | 'bathroom'
  | 'concrete'
  | 'deck_patio'
  | 'electrical'
  | 'flooring'
  | 'framing'
  | 'garage_doors'
  | 'hvac'
  | 'kitchen'
  | 'landscaping'
  | 'painting'
  | 'plumbing'
  | 'roofing'
  | 'windows_doors'
  | 'drywall'
  | 'insulation'
  | 'stucco';

export type MixedScopeOrchestratorInput = {
  draft?: EstimateAiDraft | null;
  templateKey?: string | null;
  projectType?: string | null;
  notes?: string | null;
  measurements: Record<string, unknown>;
  detectedTrades?: string[];
  scopeMode?: string | null;
  mixedScopeTrades?: string[];
  wholeHomeLayout?: boolean;
  singleTradeImport?: boolean;
  selectedTrade?: string | null;
};

const TRADE_ALIASES: Record<string, MixedScopeTradeKey> = {
  bath: 'bathroom',
  bathroom: 'bathroom',
  concrete: 'concrete',
  electrical: 'electrical',
  flooring: 'flooring',
  framing: 'framing',
  garage: 'garage_doors',
  garage_door: 'garage_doors',
  garage_doors: 'garage_doors',
  drywall: 'drywall',
  insulation: 'insulation',
  deck: 'deck_patio',
  deck_patio: 'deck_patio',
  hvac: 'hvac',
  kitchen: 'kitchen',
  landscape: 'landscaping',
  landscaping: 'landscaping',
  hardscape: 'concrete',
  paint: 'painting',
  painting: 'painting',
  plumbing: 'plumbing',
  plumbing_service: 'plumbing',
  roofing: 'roofing',
  stucco: 'stucco',
  windows: 'windows_doors',
  windows_doors: 'windows_doors',
  openings: 'windows_doors',
};

export function normalizeMixedScopeTradeKey(
  trade: string | null | undefined
): MixedScopeTradeKey | null {
  return TRADE_ALIASES[String(trade || '').trim().toLowerCase()] || null;
}

export function mixedScopeTradesFromDraft(
  draft?: EstimateAiDraft | null
): MixedScopeTradeKey[] {
  const canonicalTrades = draft?.scopeChecklist?.canonicalMixedScope
    ?.detectedTrades;
  const detectedTrades =
    canonicalTrades?.length
      ? canonicalTrades
      : draft?.classification?.detectedTrades?.length
        ? draft.classification.detectedTrades
        : draft?.detectedTrades || [];
  return Array.from(
    new Set(
      detectedTrades
        .map(normalizeMixedScopeTradeKey)
        .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
    )
  );
}

/**
 * Trade set for Quick Measurement panel activation.
 *
 * `detectedTrades` is intentionally broad and remains authoritative for
 * mixed-scope checklist convergence. QM panels need a narrower boundary:
 * activate only trades represented by canonical checklist items. If the
 * canonical contract is unavailable, preserve the existing detected-trade
 * fallback so older drafts do not lose measurement access.
 */
export function mixedScopeQmTradesFromDraft(
  draft?: EstimateAiDraft | null,
  templateKey?: string | null,
  fallbackTrades?: string[]
): MixedScopeTradeKey[] {
  const canonicalItems = draft?.scopeChecklist?.canonicalMixedScope?.items;
  const canonicalTrades = Array.from(
    new Set(
      (canonicalItems || [])
        .filter(item => !item.excluded && item.checklistState !== 'excluded')
        .flatMap(item => [item.trade, item.catalog?.trade])
        .map(normalizeMixedScopeTradeKey)
        .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
    )
  );
  if (canonicalItems?.length) return canonicalTrades;

  const templateTrade = normalizeMixedScopeTradeKey(templateKey);
  if (templateTrade) return [templateTrade];
  const fallback = fallbackTrades?.length
    ? fallbackTrades
    : mixedScopeTradesFromDraft(draft);
  return Array.from(
    new Set(
      fallback
        .map(normalizeMixedScopeTradeKey)
        .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
    )
  );
}

export function isCanonicalMixedScope(
  input: Pick<
    MixedScopeOrchestratorInput,
    | 'draft'
    | 'detectedTrades'
    | 'scopeMode'
    | 'singleTradeImport'
    | 'selectedTrade'
  >
): boolean {
  if (input.singleTradeImport || input.selectedTrade) return false;
  const scopeMode =
    input.scopeMode ||
    input.draft?.scopeMode ||
    input.draft?.classification?.scopeMode;
  const detectedTrades =
    input.detectedTrades?.length
      ? input.detectedTrades
      : mixedScopeTradesFromDraft(input.draft);
  const normalizedTrades = new Set(
    detectedTrades
      .map(normalizeMixedScopeTradeKey)
      .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
  );
  return String(scopeMode || '').toLowerCase() === 'mixed' || normalizedTrades.size > 1;
}

function syncTradeSpecificItems(
  items: ScopeChecklistItem[],
  input: MixedScopeOrchestratorInput,
  trades: Set<MixedScopeTradeKey>
): ScopeChecklistItem[] {
  let next = items;
  const measurements = input.measurements;

  if (trades.has('plumbing')) {
    next = syncPlumbingScopeItems(next, {
      plumbingScope: measurements.plumbingScope as string[] | null | undefined,
      quantities: measurements,
    });
  }
  if (trades.has('framing')) {
    next = syncFramingScopeItems(next, {
      framingScope: measurements.framingScope as string[] | null | undefined,
      quantities: measurements,
    });
  }
  if (trades.has('windows_doors')) {
    next = syncWindowsDoorsScopeItems(next, measurements);
  }
  if (trades.has('garage_doors')) {
    next = syncGarageDoorsScopeItems(next, measurements);
  }
  if (trades.has('electrical')) {
    next = syncElectricalScopeItems(next, {
      templateKey: input.templateKey,
      projectType: input.projectType,
      notes: input.notes,
      electricalScope: measurements.electricalScope as string[] | null | undefined,
      quantities: measurements,
    });
  }
  return next;
}

function mergeCanonicalScopeItems(
  items: ScopeChecklistItem[],
  input: MixedScopeOrchestratorInput
): ScopeChecklistItem[] {
  const canonicalItems = input.draft?.scopeChecklist?.canonicalMixedScope?.items;
  if (!canonicalItems?.length) return items;
  const existingIds = new Set(items.map(item => item.id));
  const additions = canonicalItems
    .filter(item => !existingIds.has(item.scopeId) && !item.excluded)
    .map(item => ({
      id: item.scopeId,
      inputType: 'yes_no' as const,
      label:
        item.catalog?.displayName ||
        item.scopeId.replace(/_/g, ' '),
      helperText:
        item.quantity == null
          ? 'Work detected in notes. Measurement is required before pricing.'
          : 'Work detected in notes and mapped to the existing pricing catalog.',
      category: item.catalog?.category || 'from_notes',
      state:
        item.checklistState === 'included' ? 'included' as const : 'unsure' as const,
      noteBacked: true,
      catalogBacked: true,
      catalogScopeId: item.scopeId,
      quantityRuleKey: item.catalog?.quantityRuleKey || null,
      pricingRuleKey: item.catalog?.pricingRuleKey || null,
      confidence: item.certainty || 'explicit',
      sourceText: item.sourceText || '',
    }));
  return additions.length ? [...items, ...additions] : items;
}

export function orchestrateMixedScopeItems(
  items: ScopeChecklistItem[],
  input: MixedScopeOrchestratorInput
): ScopeChecklistItem[] {
  if (!isCanonicalMixedScope(input)) return items;
  if (input.wholeHomeLayout) return items;

  const detectedTrades = input.detectedTrades?.length
    ? input.detectedTrades
    : input.mixedScopeTrades?.length
      ? input.mixedScopeTrades
      : mixedScopeTradesFromDraft(input.draft);
  const trades = new Set(
    detectedTrades
      .map(normalizeMixedScopeTradeKey)
      .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
  );
  if (!trades.size) return items;

  let next = mergeCanonicalScopeItems(items, input);
  next = syncTradeSpecificItems(next, input, trades);
  const qmTrades = mixedScopeQmTradesFromDraft(
    input.draft,
    input.templateKey,
    input.mixedScopeTrades
  );
  next = syncQmPanelScopeItems(
    next,
    {
      templateKey: input.templateKey,
      wholeHomeLayout: false,
      mixedScopeTrades: qmTrades,
    },
    input.measurements
  );
  return next;
}
