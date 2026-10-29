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
import { notesNameReceptaclesWithToilet } from '@/utils/electricalNoteScope';
import {
  syncWindowsDoorsScopeItems,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import { notesDescribeMixedProjectScope } from '@/utils/noteClauseReader';

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

const MIXED_SCOPE_NOTE_TRADE_PATTERNS: ReadonlyArray<
  readonly [MixedScopeTradeKey, RegExp]
> = [
  ['bathroom', /\b(?:bath(?:room)?s?|showers?|tubs?|vanit(?:y|ies)|toilets?)\b/i],
  ['kitchen', /\bkitchen\b|\b(?:cabinets?|countertops?|backsplashes?|islands?)\b/i],
  ['flooring', /\b(?:floor(?:ing)?|lvp|carpet|laminate|vinyl\s+plank)\b/i],
  ['painting', /\b(?:paint(?:ing)?|repaint)\b/i],
  ['windows_doors', /\b(?:windows?|doors?)\b/i],
  ['drywall', /\b(?:drywall|sheetrock|gypsum)\b/i],
  ['insulation', /\binsulat(?:e|ion|ed)\b/i],
  ['roofing', /\b(?:roof(?:ing)?|reroof|re[\s-]?roof|shingles?)\b/i],
  ['hvac', /\b(?:hvac|heating|cooling|furnace|heat[\s-]*pumps?|air\s*condition(?:er|ing)?)\b/i],
  ['stucco', /\bstucco\b/i],
  ['plumbing', /\b(?:plumbing|toilets?|faucets?|drains?|water\s+lines?)\b/i],
  ['electrical', /\b(?:electrical|wiring|outlets?|receptacles?|panels?|circuits?)\b/i],
  ['concrete', /\b(?:concrete|flatwork|patio|slab|footings?|foundation)\b/i],
  ['landscaping', /\b(?:landscap(?:e|ing)|sod|turf|mulch|pavers?|irrigation)\b/i],
  ['framing', /\b(?:frame|framing|framed|headers?|blocking|sheathing)\b/i],
];

const MIXED_SCOPE_KEY_TRADE_PATTERNS: ReadonlyArray<
  readonly [MixedScopeTradeKey, RegExp]
> = [
  ['bathroom', /\bbath(?:room)?|wet_area|shower|tub|vanity|toilet/i],
  ['kitchen', /\bkitchen|cabinet|countertop|backsplash|island/i],
  ['flooring', /\bfloor(?:ing)?|lvp|tile_floor/i],
  ['painting', /\bpaint(?:ing)?|repaint/i],
  ['drywall', /\bdrywall|sheetrock|gypsum/i],
  ['insulation', /\binsulat/i],
  ['roofing', /\broof|shingle/i],
  ['hvac', /\bhvac|ductwork|thermostat|register|grille/i],
  ['stucco', /\bstucco/i],
  ['plumbing', /\bplumbing|fixture|drain|toilet|faucet/i],
  ['electrical', /\belectrical|receptacle|outlet|panel|circuit/i],
  ['concrete', /\bconcrete|flatwork|patio|slab|foundation/i],
  ['landscaping', /\blandscap|sod|turf|mulch|paver/i],
  ['framing', /\bframe|framing|sheath|header|opening/i],
];

export function mixedScopeTradesFromNotes(
  notes: string | null | undefined
): MixedScopeTradeKey[] {
  const text = String(notes || '');
  if (!text.trim() || !notesDescribeMixedProjectScope(text)) return [];
  return MIXED_SCOPE_NOTE_TRADE_PATTERNS.filter(([, pattern]) =>
    pattern.test(text)
  ).map(([trade]) => trade);
}

function mixedScopeTradesFromScopeKeys(
  scopeKeys?: string[]
): MixedScopeTradeKey[] {
  const text = (scopeKeys || []).join(' ');
  if (!text.trim()) return [];
  return MIXED_SCOPE_KEY_TRADE_PATTERNS.filter(([, pattern]) =>
    pattern.test(text)
  ).map(([trade]) => trade);
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
  const trades = Array.from(
    new Set(
      [
        ...detectedTrades,
        ...mixedScopeTradesFromNotes(draft?.originalNotes),
      ]
        .map(normalizeMixedScopeTradeKey)
        .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
    )
  );
  const notes = String(draft?.originalNotes || '');
  const explicitHvac = /\b(?:hvac|heating|cooling|furnace|heat[\s-]*pumps?|air\s*condition(?:er|ing)?|ductwork|(?:supply\s+)?registers?|return\s+grilles?|thermostats?)\b/i.test(
    notes
  );
  return notes.trim() && !explicitHvac && !notesDescribeMixedProjectScope(notes)
    ? trades.filter(trade => trade !== 'hvac')
    : trades;
}

/**
 * Trade set for Quick Measurement panel activation. Mixed-scope notes and
 * active scope selections supplement canonical checklist items so a partial
 * checklist cannot hide a named trade. Dedicated jobs keep their existing
 * canonical/fallback behavior.
 */
export function mixedScopeQmTradesFromDraft(
  draft?: EstimateAiDraft | null,
  templateKey?: string | null,
  fallbackTrades?: string[],
  notes?: string | null,
  activeScopeKeys?: string[]
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
  if (canonicalItems?.length) {
    const notesText = String(notes || draft?.originalNotes || '');
    const noteIsMixedScope = notesDescribeMixedProjectScope(notesText);
    const explicitHvac = /\b(?:hvac|heating|cooling|furnace|heat[\s-]*pumps?|air\s*condition(?:er|ing)?|ductwork|(?:supply\s+)?registers?|return\s+grilles?|thermostats?)\b/i.test(
      notesText
    );
    const excludedTrades = new Set(
      canonicalItems
        .filter(item => item.excluded || item.checklistState === 'excluded')
        .flatMap(item => [item.trade, item.catalog?.trade])
        .map(normalizeMixedScopeTradeKey)
        .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
    );
    const inferredTrades = noteIsMixedScope
      ? [
          ...mixedScopeTradesFromNotes(notesText),
          ...mixedScopeTradesFromScopeKeys(activeScopeKeys),
        ].filter(trade => !excludedTrades.has(trade))
      : [];
    const mergedTrades = Array.from(
      new Set([...canonicalTrades, ...inferredTrades])
    );
    return notesText.trim() &&
      !explicitHvac &&
      !noteIsMixedScope
      ? mergedTrades.filter(trade => trade !== 'hvac')
      : mergedTrades;
  }

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
  const scopeMode = String(
    input.scopeMode ||
      input.draft?.scopeMode ||
      input.draft?.classification?.scopeMode ||
      ''
  ).toLowerCase();
  // An explicit dedicated classification stays on that job's template.
  // Extra package trades must not pull it into the mixed layout.
  if (scopeMode === 'dedicated') return false;
  if (scopeMode === 'mixed') return true;
  const detectedTrades =
    input.detectedTrades?.length
      ? input.detectedTrades
      : mixedScopeTradesFromDraft(input.draft);
  const normalizedTrades = new Set(
    [...detectedTrades, ...mixedScopeTradesFromNotes(input.draft?.originalNotes)]
      .map(normalizeMixedScopeTradeKey)
      .filter((trade): trade is MixedScopeTradeKey => Boolean(trade))
  );
  return normalizedTrades.size > 1;
}

/** Confirm-scope layout switch. Dedicated notes stay single even if packages add trades. */
export function isMixedScopeLayout(draft?: {
  scopeMode?: string | null;
  classification?: { scopeMode?: string | null; detectedTrades?: string[] } | null;
  detectedTrades?: string[];
} | null): boolean {
  return isCanonicalMixedScope({
    draft: draft as EstimateAiDraft | null,
    scopeMode: draft?.scopeMode,
    detectedTrades:
      draft?.classification?.detectedTrades || draft?.detectedTrades,
  });
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
  if (notesNameReceptaclesWithToilet(input.notes)) return items;
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
