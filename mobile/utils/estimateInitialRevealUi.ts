import { filterBathroomRevealAttentionItems } from '@/utils/bathroomPlanningMeasurements';
import {
  filterConcreteRevealAttentionItems,
  summarizeConcreteNoteBullets,
  concreteRevealHasPlanningInputs,
} from '@/utils/concretePlanningMeasurements';
import {
  formatDraftMoney,
  formatPlanningMoney,
  getScopePackages,
  isComplexEstimateTier,
} from '@/utils/estimateAiDraft';
import type { EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  summarizePlumbingNoteBullets,
  parsePlumbingMeasurementsFromNotes,
  plumbingRevealNoteBackedItemIds,
  resolvePlumbingRevealAttentionItemId,
  standalonePlumbingRevealDraft,
  notesCustomerSuppliesPlumbingFixtures,
  notesExplicitPlumbingFixtureAllowance,
  notesExcludePlumbingScopePhrase,
  notesSuggestStandalonePlumbingTrade,
  plumbingMeasurementKeyForItemId,
  plumbingNoteScopeItemIds,
  standalonePlumbingProjectTitle,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import { planScopeRecordSummaryLines } from '@/utils/planScopeRecords';
import { notesRequireInteriorPaintMeasurements } from '@/utils/scopeQuickMeasurements';
import {
  getCompactProjectSummary,
  getCompactStillNeeded,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  scopePackageIndicativePricedAmount,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
  formatScopeQuantity,
  summarizeWhatAiDidForDisplay,
  sumIndicativeScopePackageTotals,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';
import {
  collectRoofingInferenceNotes,
  inferItemStateFromNotes,
  notesExcludeElectricalServiceUpgrade,
  parseRoofingDeckingAllowanceFromNotes,
} from '@/utils/scopeItemNoteHints';
import { filterRoomRemodelNoteScopeItems } from '@/utils/estimateScopeChecklistUi';
import {
  initialScopeMeasurementInputExtended,
  checklistItemInScope,
} from '@/utils/scopeItemQuantities';
import { hasDetailedElectricalQuantities } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { parseInsulationAssembliesFromNotes } from '@/utils/scopeMeasurementParser';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import { confirmedPlanTakeoffLines } from '@/utils/planTakeoffReviewUi';

export type InitialRevealStatusTone = 'ready' | 'mostly' | 'review';

export type InitialRevealTotals = {
  heroTotal: number | null;
  heroTotalLabel: string;
  /** Markup % included in hero total (not shown for note-stated totals). */
  markupPct: number | null;
  material: number | null;
  labor: number | null;
  allowance: number | null;
  estimatedWithMarkup: number | null;
  scopeItemCount: number;
};

type InitialRevealScopeRow = {
  id: string;
  name: string;
  /** A note-derived display value takes precedence over stale package data. */
  quantityOverride?: string | null;
};

const ADDITION_REVEAL_SCOPE_OWNERS: Record<string, string> = {
  roofing: 'roof_tie_in',
  windows: 'windows_doors',
  window_install: 'windows_doors',
  exterior_doors: 'windows_doors',
  exterior_door_install: 'windows_doors',
  sliding_doors: 'windows_doors',
  cabinets: 'cabinets_counters',
  cabinet_install: 'cabinets_counters',
  plumbing: 'plumbing_rough',
  electrical: 'electrical_rough',
  trim: 'interior_trim',
  trim_paint: 'interior_trim',
  door_casing_paint: 'interior_trim',
  exterior_trim_paint: 'interior_trim',
};

function isAdditionRevealDraft(draft: EstimateAiDraft): boolean {
  return (
    String(draft.scopeChecklist?.templateKey || '').toLowerCase() ===
    'addition'
  );
}

function positiveRevealNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function additionRevealPackageOwner(
  pkg: EstimateDraftScopePackage
): string | null {
  const id = String(pkg.checklistItemId || pkg.costCode || '')
    .trim()
    .toLowerCase();
  if (id) return ADDITION_REVEAL_SCOPE_OWNERS[id] || id;
  const name = `${pkg.name || ''} ${pkg.scope || ''}`.toLowerCase();
  if (/\bwindow\s+(?:install|installation)\b/.test(name)) {
    return 'windows_doors';
  }
  if (/\bexterior\s+door\s+(?:install|installation)\b/.test(name)) {
    return 'windows_doors';
  }
  if (/\broofing\b/.test(name)) return 'roof_tie_in';
  if (/\bcabinet\b/.test(name)) return 'cabinets_counters';
  return null;
}

function dedupeAdditionRevealPackages(
  draft: EstimateAiDraft,
  packages: EstimateDraftScopePackage[]
): EstimateDraftScopePackage[] {
  if (!isAdditionRevealDraft(draft)) return packages;

  const grouped = new Map<string, EstimateDraftScopePackage[]>();
  packages.forEach(pkg => {
    const owner = additionRevealPackageOwner(pkg);
    if (!owner) return;
    const group = grouped.get(owner) || [];
    group.push(pkg);
    grouped.set(owner, group);
  });

  const winners = new Set<EstimateDraftScopePackage>();
  grouped.forEach((group, owner) => {
    const canonical = group.find(pkg => {
      const id = String(pkg.checklistItemId || pkg.costCode || '')
        .trim()
        .toLowerCase();
      return id === owner;
    });
    winners.add(canonical || group[0]);
  });

  return packages.filter(pkg => {
    const owner = additionRevealPackageOwner(pkg);
    return !owner || winners.has(pkg);
  });
}

function normalizeAdditionRevealPreviewRows(
  draft: EstimateAiDraft,
  rows: Array<{ name: string; amount: number; quantity?: string | null }>
): Array<{ name: string; amount: number; quantity?: string | null }> {
  if (!isAdditionRevealDraft(draft)) return rows;

  const assemblies = parseInsulationAssembliesFromNotes(
    draft.originalNotes || ''
  );
  if (!assemblies.length) return rows;

  const insulationName = assemblies
    .map(row => {
      const location =
        row.location === 'exterior_wall'
          ? 'Wall insulation'
          : row.location === 'attic_ceiling'
            ? 'Attic insulation'
            : row.location === 'floor'
              ? 'Floor insulation'
              : 'Insulation';
      return `${location} · ${row.rValue}`;
    })
    .join(' · ');
  const hasAssemblyRow = rows.some(row => row.name === insulationName);
  const filtered = rows.filter(row => {
    if (hasAssemblyRow) return true;
    return !/^(?:wall|attic|floor)?\s*insulation(?:\s*·\s*R-\d{2,3})?$/i.test(
      row.name.trim()
    );
  });
  if (hasAssemblyRow) return filtered;

  const insertAt = filtered.findIndex(row => /insulation/i.test(row.name));
  const assemblyRow = { name: insulationName, amount: 0 };
  if (insertAt < 0) return [...filtered, assemblyRow];
  return [
    ...filtered.slice(0, insertAt),
    assemblyRow,
    ...filtered.slice(insertAt),
  ];
}

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const REVEAL_BID_DETAIL =
  /customer name|project address|client name|email|phone|permit responsibility|permit requirements|permit fees|license|start date|payment terms|labor vs material breakdown/i;
const REVEAL_LOW_PRIORITY = REVEAL_BID_DETAIL;
const REVEAL_HIGH_PRIORITY =
  /pricing for|price needed|missing price|please check|measurement|quantity/i;

/** Plain-language labels for review / confidence copy (display only). */
export function plainLanguageReviewItem(text: string): string {
  let s = String(text || '').trim();
  if (!s) return s;

  if (/overall bid total|room lump sum|\$\/sqft rates with square/i.test(s)) {
    return 'Pricing total not found in notes';
  }
  if (/labor vs material breakdown/i.test(s)) {
    return 'Labor vs material breakdown';
  }
  if (/permit responsibility not mentioned/i.test(s)) {
    return 'Permit responsibility not mentioned';
  }
  if (/^pricing for /i.test(s)) {
    return s.replace(/^pricing for /i, 'Price needed for ');
  }

  s = s.replace(/\bhigh-confidence extraction\b/gi, 'Ready');
  s = s.replace(/\blow-confidence quantity\b/gi, 'Please check quantity');
  s = s.replace(/\bpricing gap\b/gi, 'Price needed');
  s = s.replace(/\bunsupported plan fact\b/gi, 'Not found on plan');
  s = s.replace(/\bconflicting sources\b/gi, 'Two values found — tap to pick');
  s = s.replace(/\bneeds review\b/gi, 'Please check');
  s = s.replace(/\bmissing price\b/gi, 'Price needed');
  return s;
}

export function isInitialRevealBidDetailItem(text: string): boolean {
  return REVEAL_BID_DETAIL.test(String(text || ''));
}

export type InitialRevealConfirmBuckets = {
  pricingScope: string[];
  bidDetails: string[];
};

export function splitInitialRevealConfirmItems(
  items: string[]
): InitialRevealConfirmBuckets {
  const pricingScope: string[] = [];
  const bidDetails: string[] = [];
  for (const item of items) {
    const plain = plainLanguageReviewItem(item);
    if (isInitialRevealBidDetailItem(item)) {
      bidDetails.push(plain);
    } else {
      pricingScope.push(plain);
    }
  }
  return { pricingScope, bidDetails };
}

/** All confirm items on Initial estimate — scope/pricing only (bid admin lives on estimate step 1). */
export function getInitialRevealConfirmItems(
  draft: EstimateAiDraft
): InitialRevealConfirmBuckets {
  const planPriceLines = confirmedPlanLinesForDraft(draft).filter(
    line => !/spaces detected on the plan/i.test(line)
  );
  if (planPriceLines.length > 0) {
    return splitInitialRevealConfirmItems(
      planPriceLines.map(line => `Pricing for ${line}`)
    );
  }
  // Before Confirm Scope, one package can generate several generic "still
  // needed" messages. Keep the attention card aligned to actual scope rows so
  // a ten-item job does not present twenty-plus pricing alerts.
  if (
    draftNeedsScopeConfirmation(draft) &&
    Array.isArray(draft.scopePackages) &&
    draft.scopePackages.length > 0
  ) {
    const packages = dedupeAdditionRevealPackages(
      draft,
      getScopePackagesForReview(draft)
    );
    if (packages.length > 0) {
      const packageAttentionItems = packages
        .filter(pkg => scopePackageNeedsManualPrice(pkg, draft))
        .map(
          pkg =>
            `Pricing for ${String(pkg.name || pkg.scope || 'Scope item').trim()}`
        );
      const fallbackScopeAttentionItems =
        packageAttentionItems.length === 0 &&
        draftNeedsScopeConfirmation(draft) &&
        getRevealClassification(draft).scopeMode === 'mixed'
          ? getInitialRevealScopeRows(draft).map(
              row => `Pricing for ${row.name}`
            )
          : [];
      return splitInitialRevealConfirmItems(
        filterMixedScopeAttentionItems(draft, [
          ...packageAttentionItems,
          ...fallbackScopeAttentionItems,
          ...plumbingMissingQuantityAttentionItems(draft),
        ])
      );
    }
  }
  if (
    draftNeedsScopeConfirmation(draft) &&
    getRevealClassification(draft).scopeMode === 'mixed'
  ) {
    const fallbackScopeAttentionItems = getInitialRevealScopeRows(draft).map(
      row => `Pricing for ${row.name}`
    );
    if (fallbackScopeAttentionItems.length > 0) {
      return splitInitialRevealConfirmItems(
        filterMixedScopeAttentionItems(draft, fallbackScopeAttentionItems)
      );
    }
  }
  const { items } = getCompactStillNeeded(draft, 50);
  const prioritized = filterMixedScopeAttentionItems(
    draft,
    filterBathroomRevealAttentionItems(
      draft,
      filterConcreteRevealAttentionItems(
        draft,
        filterPlumbingRevealAttentionItems(
          draft,
          filterRoofingRevealAttentionItems(
            draft,
            [...items]
              .filter(item => !isInitialRevealBidDetailItem(item))
              .sort((a, b) => revealItemPriority(a) - revealItemPriority(b))
          )
        )
      )
    )
  );
  const withPlumbingAttention = [
    ...prioritized,
    ...plumbingMissingQuantityAttentionItems(draft),
  ].filter((item, index, all) => all.indexOf(item) === index);
  return splitInitialRevealConfirmItems(withPlumbingAttention);
}

export function countInitialRevealAttentionItems(
  draft: EstimateAiDraft
): number {
  return getInitialRevealConfirmItems(draft).pricingScope.length;
}

function confirmedPlanLinesForDraft(draft: EstimateAiDraft): string[] {
  const measurements = draft.scopeMeasurements as
    | (Record<string, unknown> & {
        planImportFingerprint?: string | null;
        planImportMode?: string | null;
        planRooms?: Array<{ name?: string | null; areaSqft?: number | null }>;
        quickMeasurementSources?: Record<string, string> | null;
      })
    | null
    | undefined;
  if (!measurements?.planImportFingerprint) return [];
  const records = (
    measurements as { planScopeRecords?: Parameters<typeof planScopeRecordSummaryLines>[0] }
  ).planScopeRecords;
  if (
    measurements.planImportMode !== 'selected_trade' &&
    Array.isArray(records) &&
    records.length
  ) {
    return planScopeRecordSummaryLines(records);
  }
  const rooms = measurements.planRooms?.length
    ? measurements.planRooms
    : draft.rooms;
  return confirmedPlanTakeoffLines({
    measurements,
    rooms,
    sources: measurements.quickMeasurementSources as
      | Record<string, string>
      | null
      | undefined,
    wholeProject: measurements.planImportMode !== 'selected_trade',
  });
}

/** Plan export already lists these quantities under Pricing needed and Scope. */
export function planRevealOmitsWhatWeFound(draft: EstimateAiDraft): boolean {
  return confirmedPlanLinesForDraft(draft).length > 0;
}

export function getInitialRevealScopeMetaLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 scope item' : `${count} scope items`;
}

function isPlumbingTemplateDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return ['plumbing', 'plumbing_service'].includes(templateKey);
}

function isPlumbingRevealDraft(draft: EstimateAiDraft): boolean {
  const classificationMode =
    draft.classification?.scopeMode || draft.scopeMode;
  if (String(classificationMode || '').toLowerCase() === 'mixed') {
    return false;
  }
  return isPlumbingTemplateDraft(draft);
}

function isRoofingRevealDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return templateKey === 'roofing';
}

function isConcreteRevealDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return templateKey === 'concrete';
}

function roofingRevealHasPlanningInputs(draft: EstimateAiDraft): boolean {
  if (!isRoofingRevealDraft(draft)) return false;
  const measurements = initialScopeMeasurementInputExtended(draft);
  return Number(measurements.roofSquares) > 0;
}

/** Drop pre-Confirm Scope pricing noise when national planning can price on Step 2. */
export function filterRoofingRevealAttentionItems(
  draft: EstimateAiDraft,
  items: string[]
): string[] {
  if (!isRoofingRevealDraft(draft)) return items;

  const scopeConfirmed = Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );
  const inferenceNotes = collectRoofingInferenceNotes(
    draft,
    draft.originalNotes
  );
  const deckingAllowance =
    parseRoofingDeckingAllowanceFromNotes(inferenceNotes);
  const hasPlanning = roofingRevealHasPlanningInputs(draft);
  const packages = getScopePackagesForReview(draft);

  return items.filter(item => {
    const text = item.trim().toLowerCase();

    if (!scopeConfirmed) {
      if (
        /pricing total not found|overall bid total|no overall bid total/.test(
          text
        )
      ) {
        return false;
      }
      if (/permit requirements|permit fees|permit responsibility/.test(text)) {
        return false;
      }
      if (/^payment terms\b/.test(text)) return false;
      if (
        deckingAllowance != null &&
        deckingAllowance > 0 &&
        (/decking allowance|bad wood|decking.*allowance|allowance.*decking/.test(
          text
        ) ||
          /clarification of whether decking allowance/.test(text))
      ) {
        return false;
      }
      if (/^pricing for underlayment\b/.test(text)) return false;
      if (/^pricing for drip edge\b/.test(text)) return false;
      if (/^pricing for pipe boots?\b/.test(text)) return false;
      if (/^pricing for (cleanup|disposal|haul)/.test(text)) return false;
      if (deckingAllowance != null && /^pricing for decking/.test(text)) {
        return false;
      }
    }

    if (!hasPlanning) return true;

    if (/^pricing for roofing\b/.test(text)) return false;
    if (
      /full reroof contract|contract price.*roof|roofing contract price/.test(
        text
      )
    ) {
      return false;
    }
    if (/shingle color|roofing color|color selection/.test(text)) return false;
    const pricingMatch = item.match(/^pricing for (.+?)(?:\s*\(|$)/i);
    if (pricingMatch) {
      const name = pricingMatch[1].trim().toLowerCase();
      const pkg = packages.find(
        row =>
          String(row.name || row.scope || '')
            .trim()
            .toLowerCase() === name
      );
      if (pkg && scopePackageIndicativePricedAmount(pkg, draft) > 0)
        return false;
    }
    return true;
  });
}

/** Drop pre-Confirm Scope pricing noise when note-backed plumbing qty exists. */
export function filterPlumbingRevealAttentionItems(
  draft: EstimateAiDraft,
  items: string[]
): string[] {
  if (!standalonePlumbingRevealDraft(draft)) return items;
  const noteBacked = plumbingRevealNoteBackedItemIds(draft);
  if (!noteBacked.size) return items;
  return items.filter(item => {
    const pricingMatch = item.match(/^pricing for (.+?)(?:\s*\(|$)/i);
    if (!pricingMatch) return true;
    const itemId = resolvePlumbingRevealAttentionItemId(pricingMatch[1]);
    return !(itemId && noteBacked.has(itemId));
  });
}

function mixedInteriorScopeNotes(draft: EstimateAiDraft): boolean {
  const notes = String(draft.originalNotes || '');
  const signals = [
    /\b(?:paint(?:ing)?|repaint)\b/i,
    /\b(?:drywall|sheetrock)\b/i,
    /\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet)\b/i,
    /\b(?:doors?|baseboards?|windows?|insulat(?:e|ion))\b/i,
  ];
  return signals.filter(pattern => pattern.test(notes)).length >= 3;
}

function filterMixedScopeAttentionItems(
  draft: EstimateAiDraft,
  items: string[]
): string[] {
  const notes = String(draft.originalNotes || '');
  const crossTradeExteriorScope =
    /\b(?:stucco|roof(?:ing)?|gutters?|windows?|exterior\s+doors?)\b/i.test(
      notes
    ) &&
    /\b(?:replace|replacement|install|repair|deduct|gross|net)\b/i.test(notes);
  const serviceUpgradeUserSelected =
    Number(draft.scopeMeasurements?.serviceUpgradeCount || 0) > 0;
  const withoutExcludedElectricalService = (rows: string[]) =>
    notesExcludeElectricalServiceUpgrade(notes) && !serviceUpgradeUserSelected
      ? rows.filter(row => !/\bservice\s+upgrade\b/i.test(String(row || '')))
      : rows;
  if (!mixedInteriorScopeNotes(draft) && !crossTradeExteriorScope) {
    return withoutExcludedElectricalService(items);
  }

  const hasFlooringDemo =
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;\n]{0,60}\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b|\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b[^.;\n]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
      notes
    );
  const hasExplicitShowerDemo =
    /\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?)|tub|bathtub)\b|\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?)|tub|bathtub)\b[^.;\n]{0,80}\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i.test(
      notes
    );
  const hasNotePaintRepair =
    /\b(?:paint(?:ing)?|repaint(?:ing)?)\b/i.test(notes) &&
    /\b(?:drywall|sheetrock)\s+(?:patch|repair)\b|\b(?:patch|repair)\b[^.;\n]{0,30}\b(?:drywall|sheetrock)\b/i.test(
      notes
    );
  const scopeRows = getInitialRevealScopeRows(draft);
  const hasPaintRepairScope = scopeRows.some(
    row =>
      row.id === 'paint_repair' ||
      /interior\s+painting\/patch\s+and\s+repair/i.test(row.name)
  );
  const rowForAttentionItem = (item: string) => {
    const match = item.match(
      /^(?:pricing for|price needed for)\s+(.+?)(?:\s*\(|$)/i
    );
    if (!match) return item;
    const requested = match[1].trim();
    const requestedLower = requested.toLowerCase();
    if (
      crossTradeExteriorScope &&
      /\binterior\s+doors?\b|\binterior\s+door\s+install/.test(requestedLower) &&
      !/\binterior\s+doors?\b/i.test(notes)
    ) {
      return null;
    }
    if (
      crossTradeExteriorScope &&
      /\b(?:door\s*\/\s*window|window\s*\/\s*door|door\s+and\s+window|window\s+and\s+door)\s+openings?\b/.test(
        requestedLower
      ) &&
      /\bwindows?\b/i.test(notes) &&
      /\bexterior\s+doors?\b/i.test(notes)
    ) {
      return null;
    }
    if (
      crossTradeExteriorScope &&
      /\btrim\b/i.test(requestedLower) &&
      !/\b(?:baseboards?|casing|interior\s+trim|finish\s+trim|door\s+trim|window\s+trim)\b/i.test(
        notes
      )
    ) {
      return null;
    }
    if (
      !hasFlooringDemo &&
      /\b(?:tile|floor(?:ing)?|lvp|laminate|vinyl|carpet)\s+demo\b|\bexisting\s+floor(?:ing)?\s+removal\b/i.test(
        requested
      )
    ) {
      return null;
    }
    if (
      !hasExplicitShowerDemo &&
      /\bshower\s+tile\s+demo\b|\bshower\s+(?:pan|base|liner|surround)\s+(?:demo|removal|tear[\s-]?out)\b/i.test(
        requested
      )
    ) {
      return null;
    }
    if (
      hasNotePaintRepair &&
      hasPaintRepairScope &&
      /^interior\s+paint$/i.test(requested)
    ) {
      return null;
    }

    const preferredIds = /painting\/patch|paint\s+repair/.test(requestedLower)
      ? ['paint_repair']
      : /\binterior\s+paint(?:ing)?\b/.test(requestedLower)
        ? ['paint', 'interior_paint']
        : /\binterior\s+doors?\b|\bdoor\s+install/.test(requestedLower)
          ? ['interior_door_install', 'doors']
          : /\b(?:remove\s+existing|fixture\s+demo|toilet\s+demo|plumbing\s+fixtures?)\b/.test(
                requestedLower
              )
            ? ['fixture_demo']
            : /\bvanity\b/.test(requestedLower)
              ? ['vanity']
              : /\bcabinets?\b/.test(requestedLower)
                ? ['cabinets']
                : /\bplumbing\s+reroute\b/.test(requestedLower)
                  ? ['plumbing', 'plumbing_rough', 'note:plumbing_reroute']
                  : /\bfaucet\b|\bshower\s+valve\b/.test(requestedLower)
                    ? ['note:plumbing_fixture_finish']
                    : /\bdrywall\b/.test(requestedLower)
                      ? ['drywall', 'demo']
                      : /\binsulat/.test(requestedLower)
                        ? ['insulation']
                        : /\bstucco\b|\bexterior\s+(?:wall\s+)?finish\b/.test(
                              requestedLower
                            )
                          ? [
                              'stucco',
                              'stucco_wrb',
                              'stucco_lath',
                              'stucco_base_coat',
                              'stucco_finish_coat',
                            ]
                          : /\b(?:exterior|sliding|patio|entry)\s+doors?\b/.test(
                                requestedLower
                              )
                            ? [
                                'exterior_doors',
                                'exterior_door_install',
                                'sliding_doors',
                              ]
                        : /\bwindows?\b/.test(requestedLower)
                          ? ['window_install', 'windows']
                          : /\b(?:roof(?:ing)?|shingles?)\b/.test(requestedLower)
                            ? ['roofing', 'shingles_roofing']
                            : /\bgutters?\b/.test(requestedLower)
                              ? ['gutters']
                          : /\bbaseboards?\b|\btrim\b/.test(requestedLower)
                            ? ['trim', 'baseboard_install']
                            : /\bfloor(?:ing)?\b|\blvp\b|\blaminate\b|\bvinyl\b|\bcarpet\b/.test(
                                  requestedLower
                                )
                              ? ['flooring']
                              : [];
    const row = scopeRows.find(candidate =>
      preferredIds.includes(candidate.id)
    );
    if (!row) return null;
    return `Pricing for ${row.name}`;
  };

  return withoutExcludedElectricalService(items)
    .map(rowForAttentionItem)
    .filter((item): item is string => Boolean(item));
}

function revealChecklistItemVisible(
  draft: EstimateAiDraft,
  item: {
    id: string;
    state?: string;
    inputType?: string;
    choiceId?: string | null;
    choiceIds?: string[];
  }
): boolean {
  if (!checklistItemInScope(item)) return false;
  if (
    item.id === 'electrical_service_upgrade' &&
    notesExcludeElectricalServiceUpgrade(draft.originalNotes) &&
    Number(draft.scopeMeasurements?.serviceUpgradeCount || 0) <= 0
  ) {
    return false;
  }
  if (!isPlumbingRevealDraft(draft)) return true;
  const notes = String(draft.originalNotes || '').trim();
  if (
    item.id === 'plumbing_fixtures_hardware' &&
    notes &&
    notesCustomerSuppliesPlumbingFixtures(notes)
  ) {
    return false;
  }
  if (
    item.id === 'plumbing_fixtures_hardware' &&
    notes &&
    notesSuggestStandalonePlumbingTrade(notes) &&
    !notesExplicitPlumbingFixtureAllowance(notes)
  ) {
    return false;
  }
  if (
    item.id === 'water_heater' &&
    notes &&
    notesExcludePlumbingScopePhrase(
      notes,
      /\b(?:water\s+)?heater(?:\s+tie[\s-]?in)?\b/i
    )
  ) {
    return false;
  }
  return true;
}

function countInitialRevealScopeItems(draft: EstimateAiDraft): number {
  const planLines = confirmedPlanLinesForDraft(draft);
  if (planLines.length > 0) return planLines.length;
  const checklistCount = getInitialRevealScopeRows(draft).length;
  if (checklistCount > 0) return checklistCount;
  const packageCount = getScopePackages(draft).length;
  return packageCount;
}

const PLUMBING_NOTE_SCOPE_LABELS: Record<string, string> = {
  plumbing_rough: 'Plumbing rough-in',
  plumbing_trim: 'Plumbing trim / hookups',
  water_line: 'Water line piping',
  sewer_line: 'Sewer / DWV piping',
  gas_line: 'Gas line piping',
  water_heater: 'Water heater',
  gas_appliance_connections: 'Gas appliance connections',
  plumbing_fixtures_hardware: 'Fixtures & hardware allowance',
};

function plumbingNoteScopeRows(
  draft: EstimateAiDraft,
  rows: Array<{ id: string; name: string }>
): Array<{ id: string; name: string }> {
  if (
    !standalonePlumbingRevealDraft(draft) ||
    getRevealClassification(draft).scopeMode === 'mixed'
  ) {
    return rows;
  }
  const ids = new Set(rows.map(row => row.id));
  for (const id of plumbingNoteScopeItemIds(draft.originalNotes || '')) {
    if (ids.has(id)) continue;
    rows.push({
      id,
      name: PLUMBING_NOTE_SCOPE_LABELS[id] || id.replace(/_/g, ' '),
    });
    ids.add(id);
  }
  return rows;
}

function plumbingMissingQuantityAttentionItems(
  draft: EstimateAiDraft
): string[] {
  if (!standalonePlumbingRevealDraft(draft)) return [];
  const measurements = initialScopeMeasurementInputExtended(draft) as Record<
    string,
    unknown
  >;
  const rows = plumbingNoteScopeItemIds(draft.originalNotes || '');
  const parsedNotes = parsePlumbingMeasurementsFromNotes(
    draft.originalNotes || ''
  );
  return [...rows]
    .filter(id => {
      const key = plumbingMeasurementKeyForItemId(id);
      return Boolean(
        key &&
          !(Number(measurements[key]) > 0) &&
          !(Number(parsedNotes[key]) > 0)
      );
    })
    .map(
      id =>
        `Measurement needed for ${PLUMBING_NOTE_SCOPE_LABELS[id] || id.replace(/_/g, ' ')}`
    );
}

function isDedicatedElectricalRevealDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(draft.scopeChecklist?.templateKey || '').toLowerCase();
  if (templateKey === 'electrical') return true;
  if (String(draft.projectType || '').toLowerCase() === 'electrical') return true;

  const notes = String(draft.originalNotes || '');
  const hasElectricalSignal =
    /\b(?:electrical|wiring|outlets?|receptacles?|panel|circuits?|switch(?:es)?|gfci|recessed\s+(?:lights?|cans?)|conduit)\b/i.test(
      notes
    );
  const hasCompanionTrade =
    /\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|flooring|lvp|tile|cabinets?|concrete|foundation|insulat(?:e|ion|ed)|windows?|doors?|paint(?:ing)?|landscap(?:e|ing)|sod|pavers?)\b/i.test(
      notes
    );
  return hasElectricalSignal && !hasCompanionTrade;
}

function shouldHideDuplicateElectricalPreviewPackage(
  draft: EstimateAiDraft,
  pkg: EstimateDraftScopePackage
): boolean {
  if (!isDedicatedElectricalRevealDraft(draft)) return false;

  const notes = String(draft.originalNotes || '');
  const measurements = initialScopeMeasurementInputExtended(draft, notes);
  if (
    !hasDetailedElectricalQuantities(
      measurements as Record<string, unknown> | null
    )
  ) {
    return false;
  }

  const id = String(pkg.checklistItemId || pkg.costCode || '').trim().toLowerCase();
  const text = `${pkg.name || ''} ${pkg.scope || ''}`.toLowerCase();
  if (
    id === 'electrical_rough' ||
    id === 'electrical' ||
    /electrical\s+(?:rough|work)\b/.test(text) ||
    /electrical\s+outlets?,\s*gfci\s*&?\s*circuits?/.test(text)
  ) {
    return true;
  }
  if (
    id === 'electrical_recessed_light' ||
    /recessed\s*\/\s*canless\s*\/\s*wafer\s+light/.test(text)
  ) {
    return inferItemStateFromNotes('electrical_recessed_light', notes) === 'excluded';
  }
  return false;
}

function getInitialRevealScopeRows(
  draft: EstimateAiDraft
): InitialRevealScopeRow[] {
  const notes = String(draft.originalNotes || '');
  const wholeHomeMixedRemodelNote =
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i.test(
      notes
    ) &&
    /\b(?:kitchen|bathroom|flooring|drywall|windows?|doors?|insulat(?:e|ion|ed)|plumbing|electrical|paint(?:ing)?|cabinets?|fixtures?|air[\s-]+sealing)\b/i.test(
      notes
    );
  const wholeHomeRemodelContext =
    wholeHomeMixedRemodelNote ||
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b|\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i.test(
      notes
    );
  const kitchenContext = [
    draft.scopeChecklist?.templateKey,
    draft.projectType,
    draft.projectTitle,
  ]
    .map(value => String(value || '').toLowerCase())
    .some(value => /\bkitchen\b/.test(value)) ||
    (!wholeHomeRemodelContext && /\bkitchen\b/i.test(notes));
  const additionReveal = isAdditionRevealDraft(draft);
  const roomRemodelReveal =
    String(draft.scopeChecklist?.templateKey || draft.projectType || '').toLowerCase() ===
      'room_remodel' ||
    wholeHomeMixedRemodelNote;
  const classification = getRevealClassification(draft);
  const mixedScopeHint =
    classification.scopeMode === 'mixed' ||
    String(draft.scopeMode || draft.classification?.scopeMode || '').toLowerCase() ===
      'mixed';
  const parsedRoomRemodelMeasurements = roomRemodelReveal || mixedScopeHint
    ? initialScopeMeasurementInputExtended(draft, notes)
    : null;
  const parsedAdditionMeasurements = additionReveal
    ? initialScopeMeasurementInputExtended(draft, notes)
    : null;
  const noteWindowCount = positiveRevealNumber(
    parsedAdditionMeasurements?.windowCount
  );
  const noteExteriorDoorCount = positiveRevealNumber(
    parsedAdditionMeasurements?.exteriorDoorCount
  );
  const noteInsulationAssemblies = additionReveal
    ? parseInsulationAssembliesFromNotes(notes)
    : [];
  const parsedPlumbing = parsePlumbingMeasurementsFromNotes(notes);
  const mixedScopeReveal =
    classification.scopeMode === 'mixed' ||
    String(draft.scopeMode || draft.classification?.scopeMode || '').toLowerCase() ===
      'mixed';
  const crossTradeRemodelNote =
    mixedScopeReveal &&
    /\b(?:stucco|roof(?:ing)?|gutters?|windows?|exterior\s+doors?)\b/i.test(
      notes
    ) &&
    /\b(?:replace|replacement|install|repair|deduct|gross|net)\b/i.test(notes);
  const bathroomNotesContext =
    /\b(?:bath(?:room)?|shower|toilet|vanity)\b/i.test(notes);
  const hasNotePaintRepair =
    /\b(?:paint(?:ing)?|repaint(?:ing)?)\b/i.test(notes) &&
    /\b(?:drywall|sheetrock)\s+(?:patch|repair)\b|\b(?:patch|repair)\b[^.;\n]{0,30}\b(?:drywall|sheetrock)\b/i.test(
      notes
    );
  const explicitShowerDemo =
    /\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?)|tub|bathtub)\b|\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?)|tub|bathtub)\b[^.;\n]{0,80}\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i.test(
      notes
    );
  const explicitCountertop =
    /\b(?:countertops?|counters?|quartz|granite)\b/i.test(notes);
  const explicitCabinetLfMatch =
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b[^.;\n]{0,25}\bcabinets?\b/i.exec(
      notes
    );
  const plumbingRerouteMatch =
    /\b(?:reroute|re-route|relocat(?:e|ed|ing|ion))\b[^.;\n]{0,30}\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b[^.;\n]{0,35}\bplumb(?:ing)?\b|\bplumb(?:ing)?\b[^.;\n]{0,35}\b(?:reroute|re-route|relocat(?:e|ed|ing|ion))\b[^.;\n]{0,30}\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b/i.exec(
      notes
    );
  const plumbingRerouteLf =
    plumbingRerouteMatch?.[1] || plumbingRerouteMatch?.[2];
  const explicitFlooringDemo =
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;\n]{0,40}\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b|\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b[^.;\n]{0,40}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
      notes
    );
  const explicitDrywallDemo =
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.,;\n]{0,60}\b(?:drywall|sheetrock|gypsum)\b|\b(?:drywall|sheetrock|gypsum)\b[^.,;\n]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
      notes
    );
  const drywallRepairMatch =
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|sf|square\s+(?:feet|foot))\b[^.;,\n]{0,12}\b(?:drywall|sheetrock)\s+(?:patch|repair)\b|\b(?:drywall|sheetrock)\s+(?:patch|repair)\b[^.;,\n]{0,12}\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|sf|square\s+(?:feet|foot))\b/i.exec(
      notes
    );
  const drywallRepairVerbFirstMatch =
    /\b(?:repair|patch(?:ing)?)\b[^.;,\n]{0,20}\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|sf|square\s+(?:feet|foot))\b[^.;,\n]{0,20}\b(?:of\s+)?(?:drywall|sheetrock)\b/i.exec(
      notes
    );
  const drywallRepairSqft =
    drywallRepairMatch?.[1] ||
    drywallRepairMatch?.[2] ||
    drywallRepairVerbFirstMatch?.[1];
  const explicitInsulationMention =
    bathroomNotesContext && /\binsulat(?:e|ion|ed)\b/i.test(notes);
  const explicitFixtureFinishMention =
    /\binstall(?:ed|ation)?\b[^.;\n]{0,60}\b(?:faucet|shower\s+valve)\b/i.test(
      notes
    );
  const explicitInsulationRemoval =
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.,;\n]{0,60}\binsulat(?:e|ion|ed)\b|\binsulat(?:e|ion|ed)\b[^.,;\n]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
      notes
    );
  const explicitWallDemolition =
    /\b(?:demolish|demolition|demo|remove|removal|tear[\s-]?out)\b[^.;\n]{0,60}\b(?:nonstructural\s+)?walls?\b|\b(?:nonstructural\s+)?walls?\b[^.;\n]{0,60}\b(?:demolish|demolition|demo|remove|removal|tear[\s-]?out)\b/i.test(
      notes
    );
  const specifiedFlooringProduct =
    /\b(?:lvp|luxury\s+vinyl|laminate|engineered\s+hardwood|solid\s+hardwood|carpet|floor\s+tile|tile\s+floor)\b/i.test(
      notes
    );
  const hasBaseboardScope = /\bbaseboards?\b/i.test(notes);
  const paintWallsMentioned =
    /\b(?:paint|painting|repaint|repainting)\b[^.;\n]{0,20}\bwalls?\b|\bwalls?\b[^.;\n]{0,20}\b(?:paint|painting|repaint|repainting)\b/i.test(
      notes
    );
  const paintWallsAndCeilingsMentioned =
    /\b(?:paint|painting|repaint|repainting)\b[^.;\n]{0,35}\bwalls?\b[^.;\n]{0,20}\band\s+ceilings?\b|\b(?:paint|painting|repaint|repainting)\b[^.;\n]{0,35}\bceilings?\b[^.;\n]{0,20}\band\s+walls?\b/i.test(
      notes
    );
  const paintCeilingsMentioned =
    /\b(?:paint|painting|repaint|repainting)\b[^.;\n]{0,20}\bceilings?\b|\bceilings?\b[^.;\n]{0,20}\b(?:paint|painting|repaint|repainting)\b/i.test(
      notes
    );
  const displayNameForScopeRow = (id: string, name: string) =>
    additionReveal && id === 'windows_doors'
      ? noteWindowCount && noteExteriorDoorCount
        ? 'Windows & exterior doors'
        : noteWindowCount
          ? 'Windows'
          : noteExteriorDoorCount
            ? 'Exterior doors'
            : name
      : additionReveal &&
          id === 'insulation' &&
          noteInsulationAssemblies.length
        ? noteInsulationAssemblies
            .map(row => {
              const location =
                row.location === 'exterior_wall'
                  ? 'Wall insulation'
                  : row.location === 'attic_ceiling'
                    ? 'Attic insulation'
                    : row.location === 'floor'
                      ? 'Floor insulation'
                      : 'Insulation';
              return `${location} · ${row.rValue}`;
            })
            .join(' · ')
        : kitchenContext && id === 'floor_demo'
      ? 'Kitchen flooring demo / removal'
      : id === 'demo' &&
          !explicitShowerDemo &&
          /\b(?:bathroom|bath)\b/i.test(notes)
        ? 'Bathroom fixture demo / removal'
        : id === 'vanity' && notes.trim() && !explicitCountertop
          ? 'Vanity installation'
          : id === 'cabinets' &&
              explicitCabinetLfMatch &&
              !/\bstock\s+cabinets?\b/i.test(notes)
            ? `${explicitCabinetLfMatch[1]} LF cabinets`
            : (id === 'plumbing' || id === 'plumbing_rough') &&
                plumbingRerouteLf
              ? `Plumbing reroute · ${plumbingRerouteLf} LF`
              : (id === 'demo' || id === 'floor_demo') &&
                  explicitFlooringDemo &&
                  !explicitDrywallDemo &&
                  !explicitWallDemolition
                ? 'Flooring demo / removal'
                : id === 'demo' && explicitDrywallDemo && !explicitFlooringDemo
                  ? 'Drywall demo / removal'
                  : id === 'flooring' && !specifiedFlooringProduct
                    ? 'Flooring installation'
                    : ['paint', 'interior_paint', 'ceiling_paint'].includes(id)
                      ? paintWallsAndCeilingsMentioned ||
                        (paintWallsMentioned && paintCeilingsMentioned)
                        ? 'Interior wall and ceiling painting'
                        : paintWallsMentioned
                          ? 'Interior wall painting'
                          : paintCeilingsMentioned
                            ? 'Ceiling painting'
                            : 'Interior paint'
                      : id === 'window_install'
                        ? 'Window install'
                        : id === 'trim' && hasBaseboardScope
                          ? 'Baseboard installation'
                          : id === 'plants' && /\bshrubs?\b/i.test(notes)
                            ? 'Shrubs'
                            : id === 'decking_repair'
                              ? 'Roof decking repair'
                              : name;
  const facts = draft.scopeChecklist?.scopeFacts || [];
  const resolvedFactIds = new Set(
    facts
      .filter(fact => fact.status !== 'excluded')
      .map(fact => String(fact.scopeId || '').trim())
      .filter(Boolean)
  );
  const hasResolvedFacts = facts.length > 0;
  const roomRemodelQuantityOverride = (id: string): string | null | undefined => {
    if (
      (!roomRemodelReveal && !mixedScopeReveal) ||
      !parsedRoomRemodelMeasurements
    ) {
      return undefined;
    }
    const measurements = parsedRoomRemodelMeasurements as Record<string, unknown>;
    const sqft = (value: unknown) => {
      const quantity = positiveRevealNumber(value);
      return quantity ? `${quantity} sqft` : null;
    };
    const each = (value: unknown) => {
      const quantity = positiveRevealNumber(value);
      return quantity ? `${quantity} each` : null;
    };
    if (id === 'flooring') return sqft(measurements.flooringSqft);
    if (id === 'baseboard_install' || id === 'trim') {
      const quantity = positiveRevealNumber(measurements.baseboardLf);
      return quantity ? `${quantity} LF` : null;
    }
    if (id === 'stucco') return sqft(measurements.stuccoNetWallSqft);
    if (id === 'roofing' || id === 'shingles_roofing') {
      const squares = positiveRevealNumber(measurements.roofSquares);
      return squares ? `${squares} squares` : null;
    }
    if (id === 'drywall') {
      return sqft(measurements.patchRepairSqft ?? measurements.drywallSqft);
    }
    if (id === 'interior_door_install' || id === 'interior_doors') {
      return each(measurements.interiorDoorCount);
    }
    if (id === 'window_install' || id === 'windows') {
      return each(measurements.windowCount);
    }
    if (id === 'exterior_door_install' || id === 'exterior_doors') {
      return each(measurements.exteriorDoorCount);
    }
    if (id === 'electrical_main_panel') {
      const count = each(measurements.mainPanelCount);
      const amperage = positiveRevealNumber(measurements.serviceAmperage);
      return count && amperage ? `${count} · ${amperage}A` : count;
    }
    if (id === 'electrical_dedicated_20a') {
      return each(measurements.dedicated20aCircuitCount);
    }
    if (id === 'electrical_standard_receptacle') {
      return each(measurements.standardReceptacleCount);
    }
    if (id === 'electrical_gfci_receptacle') {
      return each(measurements.gfciReceptacleCount);
    }
    if (id === 'electrical_single_pole_switch') {
      return each(measurements.singlePoleSwitchCount);
    }
    if (id === 'electrical_recessed_light') {
      return each(measurements.recessedLightCount);
    }
    if (id === 'electrical_conduit') {
      const quantity = positiveRevealNumber(measurements.conduitLf);
      return quantity ? `${quantity} LF` : null;
    }
    if (
      id === 'insulation' &&
      /\binsulat(?:e|ion|ed)\b|\bR[-\s]?\d{2,3}\b/i.test(notes)
    ) {
      const hasLocationSpecificInsulationArea =
        /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;,\n]{0,40}\b(?:wall|walls|attic|ceiling|floor)\b[^.;,\n]{0,20}\binsulat(?:e|ion|ed)\b|\binsulat(?:e|ion|ed)\b[^.;,\n]{0,40}\b(?:wall|walls|attic|ceiling|floor)\b[^.;,\n]{0,40}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(
          notes
        );
      if (!hasLocationSpecificInsulationArea) return null;
      const quantity =
        positiveRevealNumber(measurements.exteriorWallInsulationSqft) ||
        positiveRevealNumber(measurements.atticInsulationSqft) ||
        positiveRevealNumber(measurements.floorInsulationSqft);
      return quantity ? `${quantity} sqft` : null;
    }
    if (id === 'air_sealing' && /\bair[\s-]+sealing\b/i.test(notes)) {
      return null;
    }
    if (
      ['floor_demo', 'cabinet_demo', 'fixture_demo', 'baseboard_install', 'trim'].includes(
        id
      )
    ) {
      return null;
    }
    return undefined;
  };
  const checklistItems =
    (roomRemodelReveal || mixedScopeReveal) &&
    draft.scopeChecklist?.items
      ? filterRoomRemodelNoteScopeItems(draft.scopeChecklist.items, notes)
      : draft.scopeChecklist?.items;
  const dedicatedElectricalReveal = isDedicatedElectricalRevealDraft(draft);
  const electricalMeasurements = dedicatedElectricalReveal
    ? initialScopeMeasurementInputExtended(draft, notes)
    : null;
  const hideElectricalRoughPackage =
    dedicatedElectricalReveal &&
    hasDetailedElectricalQuantities(
      electricalMeasurements as Record<string, unknown> | null
    );
  const electricalFixtureIds = new Set([
    'electrical_standard_fixture',
    'electrical_recessed_light',
    'electrical_pendant_light',
    'electrical_decorative_light',
    'electrical_exterior_light',
    'electrical_undercabinet_light',
  ]);
  let rows =
    checklistItems
      ?.filter(item => revealChecklistItemVisible(draft, item))
      .filter(item => {
        if (!dedicatedElectricalReveal) return true;
        if (
          (hideElectricalRoughPackage && item.id === 'electrical_rough') ||
          item.id === 'electrical'
        ) {
          return false;
        }
        if (
          electricalFixtureIds.has(item.id) &&
          inferItemStateFromNotes(item.id, notes) === 'excluded'
        ) {
          return false;
        }
        return true;
      })
      .filter(
        item =>
          !hasResolvedFacts ||
          item.noteBacked === true ||
          resolvedFactIds.has(String(item.id || '').trim()) ||
          resolvedFactIds.has(String(item.catalogScopeId || '').trim())
      )
      .map(item => ({
        id: String(item.id || '').trim(),
        name: displayNameForScopeRow(
          String(item.id || '').trim(),
          String(item.label || item.id || 'Scope item').trim()
        ),
        ...(additionReveal &&
        String(item.id || '').trim() === 'windows_doors' &&
        (noteWindowCount || noteExteriorDoorCount)
          ? {
              quantityOverride:
                noteWindowCount && noteExteriorDoorCount
                  ? `${noteWindowCount} windows · ${noteExteriorDoorCount} doors`
                  : `${noteWindowCount || noteExteriorDoorCount} each`,
            }
          : {}),
        ...(additionReveal &&
        String(item.id || '').trim() === 'insulation' &&
        noteInsulationAssemblies.length
          ? { quantityOverride: null }
          : {}),
        ...((!additionReveal || mixedScopeReveal) &&
        roomRemodelQuantityOverride(String(item.id || '').trim()) !== undefined
          ? {
              quantityOverride: roomRemodelQuantityOverride(
                String(item.id || '').trim()
              ),
            }
          : {}),
      }))
      .filter(row => row.id && row.name) || [];
  if (additionReveal) {
    const presentIds = new Set(rows.map(row => row.id));
    const explicitInteriorTrim =
      /\binterior\s+trim\b|\b(?:door|window)\s+(?:casing|trim)\b|\b(?:crown|moulding|molding)\b/i.test(
        notes
      );
    const explicitlyPaintedTrim =
      /\b(?:baseboards?|door\s+casing|casing|trim)\b[^.;\n]{0,30}\b(?:paint|painting|painted)\b|\b(?:paint|painting|painted)\b[^.;\n]{0,30}\b(?:baseboards?|door\s+casing|casing|trim)\b/i.test(
        notes
      );
    const explicitExteriorFinish =
      /\b(?:siding|soffit|fascia|house\s*wrap|weather\s+barrier|stucco|eifs|exterior\s+trim)\b/i.test(
        notes
      );
    rows = rows.filter(row => {
      const owner = ADDITION_REVEAL_SCOPE_OWNERS[row.id];
      if (owner && presentIds.has(owner)) {
        if (row.id === 'trim_paint' && explicitlyPaintedTrim) return true;
        if (row.id === 'door_casing_paint' && /\b(?:door\s+)?casing\b/i.test(notes)) {
          return true;
        }
        if (row.id === 'exterior_trim_paint' && explicitExteriorFinish) {
          return true;
        }
        return false;
      }
      if (row.id === 'interior_trim' && !explicitInteriorTrim) {
        return false;
      }
      if (row.id === 'exterior_finishes' && !explicitExteriorFinish) {
        return false;
      }
      return true;
    });
  }
  if (
    classification.scopeMode === 'mixed' &&
    isPlumbingTemplateDraft(draft) &&
    /\bbath(?:room)?\b/i.test(notes)
  ) {
    const existingIds = new Set(rows.map(row => row.id));
    const existingNames = new Set(
      rows.map(row => row.name.trim().toLowerCase())
    );
    const addMixedRow = (id: string, name: string) => {
      if (existingIds.has(id) || existingNames.has(name.toLowerCase())) return;
      rows.push({ id, name });
      existingIds.add(id);
      existingNames.add(name.toLowerCase());
    };
    if (
      /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.;\n]{0,50}\b(?:bathroom\s+)?fixtures?\b/i.test(
        notes
      )
    ) {
      addMixedRow(
        'fixture_demo',
        'Remove existing toilet & plumbing fixtures'
      );
    }
    if (/\binstall(?:ed|ation)?\b[^.;\n]{0,45}\bvanity\b/i.test(notes)) {
      addMixedRow('vanity', 'Vanity installation');
    }
    if (/\binstall(?:ed|ation)?\b[^.;\n]{0,45}\btoilet\b/i.test(notes)) {
      addMixedRow('toilet', 'Toilet installation');
    }
    if (/\b(?:flooring|floor\s+tile)\b/i.test(notes)) {
      addMixedRow('flooring', 'Flooring installation');
    }
    const cabinetLfMatch =
      /\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b[^.;\n]{0,25}\bcabinets?\b/i.exec(
        notes
      );
    if (cabinetLfMatch) {
      addMixedRow('cabinets', `${cabinetLfMatch[1]} LF cabinets`);
    } else if (/\bcabinets?\b/i.test(notes)) {
      addMixedRow('cabinets', 'Cabinet installation');
    }
    if (/\b(?:two|2)\s+windows?\b|\bwindows?\b/i.test(notes)) {
      addMixedRow('windows', 'Window install');
    }
    if (/\bpaint(?:ing)?\b/i.test(notes)) {
      addMixedRow(
        'paint_repair',
        'Interior painting/patch and repair'
      );
    }
  }
  rows = plumbingNoteScopeRows(draft, rows);
  const hasConcreteFlatworkRow = rows.some(
    row =>
      row.id === 'pour_flatwork' &&
      /\bconcrete\b|\bpatio\b|\bflatwork\b/i.test(row.name)
  );
  if (hasConcreteFlatworkRow) {
    rows = rows.filter(row => row.id !== 'concrete');
  }
  const hasSpecificLandscapeRow = rows.some(row =>
    [
      'sod_turf',
      'artificial_turf',
      'rock',
      'mulch',
      'plants',
      'trees',
      'landscape_boulders',
      'pavers',
      'irrigation',
      'concrete_edging',
    ].includes(row.id)
  );
  if (hasSpecificLandscapeRow) {
    rows = rows.filter(row => row.id !== 'landscaping');
  }
  const hasGenericDoorMention =
    /\bdoors?\b/i.test(notes) &&
    !/\b(?:exterior|sliding|patio|garage|shower)\s+doors?\b/i.test(notes);
  if (hasGenericDoorMention) {
    rows = rows.filter(row => row.id !== 'doors');
    if (!rows.some(row => row.id === 'interior_door_install')) {
      rows.push({
        id: 'interior_door_install',
        name: 'Interior door installation',
      });
    }
  }
  if (
    roomRemodelReveal &&
    /\binterior\s+doors?\b/i.test(notes) &&
    !rows.some(row => row.id === 'interior_door_install')
  ) {
    rows.push({ id: 'interior_door_install', name: 'Interior door installation' });
  }
  if (roomRemodelReveal) {
    const addRoomRemodelRow = (id: string, name: string) => {
      if (rows.some(row => row.id === id)) return;
      rows.push({ id, name });
    };
    const removalFor = (term: string) =>
      new RegExp(
        `\\b(?:demolition|demo|remove|removal|tear[\\s-]?out)\\b[^.;,\\n]{0,70}\\b${term}\\b|\\b${term}\\b[^.;,\\n]{0,70}\\b(?:demolition|demo|remove|removal|tear[\\s-]?out)\\b`,
        'i'
      ).test(notes);
    if (removalFor('cabinets?')) {
      addRoomRemodelRow('cabinet_demo', 'Cabinet removal / demolition');
    }
    if (removalFor('fixtures?')) {
      addRoomRemodelRow('fixture_demo', 'Fixture removal / demolition');
    }
    if (removalFor('floor(?:ing)?|lvp|vinyl|carpet|tile')) {
      addRoomRemodelRow('floor_demo', 'Flooring demo / removal');
    }
    if (
      /\binsulat(?:e|ion|ed)\b|\bR[-\s]?\d{2,3}\b/i.test(notes) &&
      !rows.some(row => /\binsulation\b/i.test(row.name))
    ) {
      addRoomRemodelRow('insulation', 'Wall & attic insulation');
    }
    if (
      /\bair[\s-]+sealing\b/i.test(notes) &&
      !rows.some(row => row.id === 'air_sealing')
    ) {
      addRoomRemodelRow('air_sealing', 'Air sealing');
    }
    if (
      /\btrim\b|\bbaseboards?\b/i.test(notes) &&
      !rows.some(row => row.id === 'trim' || row.id === 'baseboard_install')
    ) {
      addRoomRemodelRow('trim', 'Trim / baseboard installation');
    }
    if (
      /\bplumbing\b/i.test(notes) &&
      !rows.some(row => row.id === 'plumbing' || /plumbing/i.test(row.name))
    ) {
      addRoomRemodelRow('plumbing', 'Plumbing');
    }
    if (
      /\belectrical\b/i.test(notes) &&
      !rows.some(row => row.id === 'electrical' || /electrical/i.test(row.name))
    ) {
      addRoomRemodelRow('electrical', 'Electrical');
    }
    if (
      /\binterior\s+paint\b|\bpaint(?:ing)?\b/i.test(notes) &&
      !rows.some(row => /interior\s+paint|painting/i.test(row.name))
    ) {
      addRoomRemodelRow('interior_paint', 'Interior paint');
    }
  }
  if (roomRemodelReveal) {
    const explicitDoorPaint =
      /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?(?:interior\s+)?doors?\b|\b(?:interior\s+)?doors?\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
        notes
      );
    const explicitDoorCasingPaint =
      /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?door\s+casing\b|\bdoor\s+casing\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
        notes
      );
    const explicitExteriorTrimPaint =
      /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?(?:exterior\s+)?(?:trim|window\s+trim|door\s+trim|windows?|doors?)\b|\b(?:exterior\s+)?(?:trim|window\s+trim|door\s+trim|windows?|doors?)\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
        notes
      );
    const explicitBaseboardPaint =
      /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?(?:baseboards?|trim)\b|\b(?:baseboards?|trim)\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
        notes
      );
    rows = rows.filter(row => {
      if (
        (row.id === 'door_paint' ||
          /^(?:interior\s+)?door painting$/i.test(row.name)) &&
        !explicitDoorPaint
      ) {
        return false;
      }
      if (
        (row.id === 'door_casing_paint' ||
          /door casing|door casing \/ trim painting/i.test(row.name)) &&
        !explicitDoorCasingPaint
      ) {
        return false;
      }
      if (
        (row.id === 'exterior_trim_paint' ||
          /exterior trim.*windows?.*doors?/i.test(row.name)) &&
        !explicitExteriorTrimPaint
      ) {
        return false;
      }
      if (
        (row.id === 'trim_paint' ||
          /baseboard and trim painting/i.test(row.name)) &&
        !explicitBaseboardPaint
      ) {
        return false;
      }
      return true;
    });
  }
  const ids = new Set(rows.map(row => row.id));
  if (mixedScopeReveal || crossTradeRemodelNote) {
    const addCrossTradeRow = (
      id: string,
      name: string,
      quantityOverride?: string | null
    ) => {
      if (ids.has(id)) return;
      rows.push({
        id,
        name,
        ...(quantityOverride ? { quantityOverride } : {}),
      });
      ids.add(id);
    };
    if (/\bstucco\b/i.test(notes)) {
      addCrossTradeRow(
        'stucco',
        'Stucco / exterior wall finish',
        roomRemodelQuantityOverride('stucco')
      );
    }
    if (
      /\b(?:roof(?:ing)?|shingles?)\b/i.test(notes) &&
      /\b(?:replace|replacement|install|new|re[\s-]?roof|reroof)\b/i.test(
        notes
      )
    ) {
      addCrossTradeRow(
        'roofing',
        'Roofing replacement',
        roomRemodelQuantityOverride('roofing')
      );
    }
    if (/\bgutters?\b/i.test(notes)) {
      const gutterQuantity = positiveRevealNumber(
        parsedRoomRemodelMeasurements?.roofGutterLf
      );
      addCrossTradeRow(
        'gutters',
        'Gutters',
        gutterQuantity ? `${gutterQuantity} LF` : null
      );
    }
  }
  for (const fact of facts) {
    const id = String(fact.scopeId || '').trim();
    if (hasConcreteFlatworkRow && id === 'concrete') continue;
    if (!id || fact.status === 'excluded' || ids.has(id)) continue;
    rows.push({
      id,
      name: displayNameForScopeRow(
        id,
        String(fact.catalogEntry?.displayName || id.replace(/_/g, ' ')).trim()
      ),
    });
    ids.add(id);
  }
  const noteBackedExteriorScopeFallbacks = [
    {
      id: 'plants',
      pattern: /\b(?:plants?|shrubs?)\b/i,
      name: 'Shrubs',
    },
    {
      id: 'concrete_edging',
      pattern: /\bedging\b/i,
      name: 'Edging',
    },
    {
      id: 'irrigation',
      pattern: /\birrigation\b/i,
      name: 'Irrigation',
    },
  ];
  for (const fallback of noteBackedExteriorScopeFallbacks) {
    if (ids.has(fallback.id) || !fallback.pattern.test(notes)) continue;
    rows.push({ id: fallback.id, name: fallback.name });
    ids.add(fallback.id);
  }
  if (
    rows.some(row =>
      [
        'sod_turf',
        'artificial_turf',
        'rock',
        'mulch',
        'plants',
        'trees',
        'landscape_boulders',
        'pavers',
        'irrigation',
        'concrete_edging',
      ].includes(row.id)
    )
  ) {
    rows = rows.filter(row => row.id !== 'landscaping');
  }
  const hasPaintRepairFactScope = rows.some(
    row =>
      row.id === 'paint_repair' ||
      /interior\s+painting\/patch\s+and\s+repair/i.test(row.name)
  );
  if (hasNotePaintRepair && hasPaintRepairFactScope) {
    rows = rows.filter(
      row =>
        row.id !== 'interior_paint' &&
        !/^interior\s+paint$/i.test(row.name.trim())
    );
  }
  if (
    !ids.has('exterior_doors') &&
    inferItemStateFromNotes('exterior_doors', draft.originalNotes) ===
      'included'
  ) {
    rows.push({ id: 'exterior_doors', name: 'Exterior doors' });
    ids.add('exterior_doors');
  }
  const hasDetailedScopeRow = rows.some(row =>
    /(?:\b\d[\d,]*(?:\.\d+)?\s*(?:lf|sqft|sf|each)\b|\bR[-\s]?\d{2,3}\b|\btwo\s+new\s+windows?\b|\bone\s+new\s+exterior\s+door\b)/i.test(
      row.name
    )
  );
  rows = rows.filter(row => {
    const name = row.name.trim();
    const notes = String(draft.originalNotes || '');
    const explicitWallLayoutWork =
      /\b(?:remove|removing|demo|demolish|tear[\s-]?out|add|adding|move|moving|relocat(?:e|ed|ing)|reframe|frame|framing)\b[^.;\n]{0,60}\bwalls?\b|\bwalls?\b[^.;\n]{0,60}\b(?:remove|removing|demo|demolish|tear[\s-]?out|add|adding|move|moving|relocat(?:e|ed|ing)|reframe|frame|framing)\b|\bwall\s+layout\s+changes?\b/i.test(
        notes
      );
    // These are default room-remodel checklist rows, not note-backed work.
    // “R-21 wall insulation” must not promote wall construction/layout work.
    if (row.id === 'walls_moving' && !explicitWallLayoutWork) {
      return false;
    }
    if (notes && row.id === 'floor_demo' && !explicitFlooringDemo) {
      return false;
    }
    if (
      row.id === 'demo' &&
      explicitFlooringDemo &&
      !explicitDrywallDemo &&
      !explicitWallDemolition
    ) {
      return false;
    }
    if (
      row.id === 'demo' &&
      explicitInsulationRemoval &&
      !explicitFlooringDemo &&
      !explicitDrywallDemo
    ) {
      return false;
    }
    if (
      row.id === 'demo' &&
      /\b(?:bathroom|bath)\b/i.test(notes) &&
      !explicitShowerDemo
    ) {
      return false;
    }
    if (notes.trim() && row.id === 'countertops' && !explicitCountertop) {
      return false;
    }
    if (row.id === 'wall_demo' && explicitDrywallDemo) {
      return false;
    }
    if (
      row.id === 'electrical_service_upgrade' &&
      notesExcludeElectricalServiceUpgrade(notes) &&
      Number(draft.scopeMeasurements?.serviceUpgradeCount || 0) <= 0
    ) {
      return false;
    }
    // The kitchen checklist can contain a generic “Walls” paint row in
    // addition to the explicit Interior painting row. Keep the priced,
    // note-backed painting scope and suppress the duplicate label.
    if (
      /^walls$/i.test(name) &&
      rows.some(
        candidate =>
          candidate.id !== row.id &&
          /\binterior\s+paint(?:ing)?\b/i.test(candidate.name)
      )
    ) {
      return false;
    }
    if (
      /\b(?:style|manufacturer|hardware|color|edge profile|specification|selection|details|schedule|payment terms|permit|engineering|inspection|labor and material|cost breakdown)\b/i.test(
        name
      )
    ) {
      return false;
    }
    if (
      /^(?:kitchen|kitchen remodel|plumbing|electrical|drywall and insulation|material\/labor pricing for flooring|windows and exterior door)$/i.test(
        name
      )
    ) {
      if (
        roomRemodelReveal &&
        /\b(?:plumbing|electrical)\b/i.test(name) &&
        new RegExp(`\\b${name}\\b`, 'i').test(notes)
      ) {
        return true;
      }
      return false;
    }
    if (
      hasDetailedScopeRow &&
      /^(?:drywall repair|drywall patch \/ repair|insulation)$/i.test(name)
    ) {
      const hasNoteBackedDetailedDrywall = rows.some(
        candidate =>
          candidate.id !== row.id &&
          /\bdrywall\s+(?:repair|patch)\b.*\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:feet|foot))\b/i.test(
            candidate.name
          )
      );
      return !hasNoteBackedDetailedDrywall;
    }
    if (
      /^plumbing fixture and appliance scope$/i.test(name) &&
      !/\b(?:fixture|faucet|sink|toilet|vanity|appliance|disposal)\b/i.test(
        String(draft.originalNotes || '')
      )
    ) {
      return false;
    }
    return true;
  });
  if (crossTradeRemodelNote) {
    rows = rows.filter(
      row =>
        ![
          'interior_door_install',
          'interior_doors',
          'trim',
          'interior_trim',
          'interior_paint',
          'paint',
          'trim_paint',
          'door_paint',
          'door_casing_paint',
          'exterior_trim_paint',
        ].includes(row.id)
    );
  }
  if (standalonePlumbingRevealDraft(draft)) {
    if (
      parsedPlumbing.fixtureReplacementCount &&
      !rows.some(row => row.id === 'fixture_replace')
    ) {
      rows.push({
        id: 'fixture_replace',
        name: `Plumbing fixture replacement · ${parsedPlumbing.fixtureReplacementCount}`,
      });
    }
    if (
      parsedPlumbing.fixtureRepairCount &&
      !rows.some(row => row.id === 'fixture_repair')
    ) {
      rows.push({
        id: 'fixture_repair',
        name: `Plumbing fixture repair · ${parsedPlumbing.fixtureRepairCount}`,
      });
    }
    if (
      parsedPlumbing.plumbingCleanupCount &&
      !rows.some(row => row.id === 'cleanup')
    ) {
      rows.push({ id: 'cleanup', name: 'Cleanup / disposal' });
    }
  }
  if (drywallRepairSqft) {
    const drywallRowIndex = rows.findIndex(
      row =>
        row.id === 'drywall' ||
        /\bdrywall\s+(?:patch|repair)\b/i.test(row.name)
    );
    if (drywallRowIndex >= 0) {
      rows[drywallRowIndex] = {
        ...rows[drywallRowIndex],
        name: 'Drywall repair',
      };
    } else {
      rows.push({
        id: 'note:drywall_repair',
        name: `Drywall repair · ${drywallRepairSqft} sqft`,
      });
    }
  }
  if (
    explicitInsulationMention &&
    !rows.some(row => /\binsulation\b/i.test(row.name))
  ) {
    rows.push({ id: 'note:insulation', name: 'Insulation' });
  }
  if (
    explicitFixtureFinishMention &&
    !rows.some(row => /faucet|shower\s+valve/i.test(row.name))
  ) {
    rows.push({
      id: 'note:plumbing_fixture_finish',
      name: 'Faucet & shower valve',
    });
  }
  if (
    plumbingRerouteLf &&
    !rows.some(row => /plumbing\s+reroute/i.test(row.name))
  ) {
    rows.push({
      id: 'note:plumbing_reroute',
      name: `Plumbing reroute · ${plumbingRerouteLf} LF`,
    });
  }
  const seenScopeRowNames = new Set<string>();
  rows = rows.filter(row => {
    const key = row.name.trim().toLowerCase();
    if (!key || seenScopeRowNames.has(key)) return false;
    seenScopeRowNames.add(key);
    return true;
  });
  if (
    explicitFlooringDemo &&
    !explicitDrywallDemo &&
    !explicitWallDemolition &&
    !rows.some(row => row.id === 'floor_demo')
  ) {
    rows.unshift({ id: 'floor_demo', name: 'Flooring demo / removal' });
  }
  const hasAggregateInteriorPainting = rows.some(row => row.id === 'paint');
  if (hasAggregateInteriorPainting) {
    rows = rows.filter(
      row => row.id !== 'interior_paint' && row.id !== 'ceiling_paint'
    );
  }
  const hasPaintRepairScope = rows.some(
    row =>
      row.id === 'paint_repair' ||
      /interior\s+painting\/patch\s+and\s+repair/i.test(row.name)
  );
  if (hasPaintRepairScope) {
    rows = rows.filter(row => row.id !== 'interior_paint');
  }
  const bathroomContext = [
    draft.scopeChecklist?.templateKey,
    draft.projectType,
    draft.projectTitle,
    draft.originalNotes,
  ]
    .map(value => String(value || '').toLowerCase())
    .some(value => /\bbathroom\b|\bbathrooms\b|\bbaths?\b/.test(value));
  if (bathroomContext) {
    const hasSpecificTile = rows.some(row =>
      /shower|bathroom floor tile/i.test(row.name)
    );
    const hasPaintRepair = rows.some(row =>
      /painting\/patch|paint repair/i.test(row.name)
    );
    const seenNames = new Set<string>();
    rows = rows.filter(row => {
      const name = row.name.trim();
      if (/^kitchen flooring install$/i.test(name)) return false;
      if (hasSpecificTile && /^tile$/i.test(name)) return false;
      if (hasPaintRepair && /^interior painting$/i.test(name)) return false;
      const key = name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
    const bathroomDemoRows = [
      {
        pattern:
          /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,50}\bvanity\b|\bvanity\b[^.;\n]{0,50}\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i,
        id: 'note:bathroom vanity demo',
        name: 'Vanity demo / removal',
      },
      {
        pattern:
          /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,50}\btoilet\b|\btoilet\b[^.;\n]{0,50}\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i,
        id: 'note:bathroom toilet demo',
        name: 'Toilet demo / removal',
      },
      {
        pattern:
          /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;,\n]{0,60}\bdrywall\b|\bdrywall\b[^.;,\n]{0,60}\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i,
        id: 'note:bathroom drywall demo',
        name: 'Drywall demo / removal',
      },
    ];
    const noteText = String(draft.originalNotes || '');
    const existingNames = new Set(rows.map(row => row.name.toLowerCase()));
    for (const demo of bathroomDemoRows) {
      if (
        demo.pattern.test(noteText) &&
        !existingNames.has(demo.name.toLowerCase())
      ) {
        rows.push(demo);
        existingNames.add(demo.name.toLowerCase());
      }
    }
  }
  const hydratedKitchenDemoSource = `${String(draft.originalNotes || '')} ${rows
    .map(row => row.name)
    .join(' ')}`;
  if (
    kitchenContext &&
    /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out)\b/i.test(
      hydratedKitchenDemoSource
    )
  ) {
    const demoRows = [
      {
        pattern: /\b(?:cabinet|cabinets)\b/i,
        id: 'note:kitchen cabinet demo',
        name: 'Cabinet demo / removal',
      },
      {
        pattern: /\b(?:counter|counters|countertop|countertops)\b/i,
        id: 'note:kitchen countertop demo',
        name: 'Countertop demo / removal',
      },
      {
        pattern: /\bbacksplash\b/i,
        id: 'note:kitchen backsplash demo',
        name: 'Backsplash demo / removal',
      },
      {
        pattern: /\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b/i,
        id: 'note:kitchen flooring demo',
        name: 'Kitchen flooring demo / removal',
      },
    ];
    const existingNames = new Set(rows.map(row => row.name.toLowerCase()));
    const expandedRows: Array<{ id: string; name: string }> = [];
    for (const row of rows) {
      if (
        /demolition(?: and disposal)? of existing|kitchen demolition/i.test(
          row.name
        )
      ) {
        for (const demo of demoRows) {
          if (!demo.pattern.test(hydratedKitchenDemoSource)) continue;
          if (existingNames.has(demo.name.toLowerCase())) continue;
          expandedRows.push({ id: demo.id, name: demo.name });
          existingNames.add(demo.name.toLowerCase());
        }
        continue;
      }
      expandedRows.push(row);
    }
    rows = expandedRows;
  }
  if (!rows.length) {
    const fallbackItems = [
      ...(draft.stillNeededReview || []),
      ...(draft.needsReviewItems || []),
      ...getCompactStillNeeded(draft, 100).items,
    ];
    const notes = String(draft.originalNotes || '');
    const kitchenDemoRows = [
      {
        pattern: /\b(?:cabinet|cabinets)\b/i,
        name: 'Cabinet demo / removal',
      },
      {
        pattern: /\b(?:counter|counters|countertop|countertops)\b/i,
        name: 'Countertop demo / removal',
      },
      {
        pattern: /\bbacksplash\b/i,
        name: 'Backsplash demo / removal',
      },
      {
        pattern: /\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b/i,
        name: 'Kitchen flooring demo / removal',
      },
    ];
    const fallbackNames = new Set<string>();
    for (const item of fallbackItems) {
      const plain = plainLanguageReviewItem(item)
        .replace(/^price needed for\s+/i, '')
        .replace(/^pricing for\s+/i, '')
        .trim();
      if (
        /kitchen demolition/i.test(plain) &&
        /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out)\b/i.test(notes)
      ) {
        for (const demo of kitchenDemoRows) {
          if (!demo.pattern.test(notes)) continue;
          const key = demo.name.toLowerCase();
          if (fallbackNames.has(key)) continue;
          fallbackNames.add(key);
          rows.push({ id: `note:${key}`, name: demo.name });
        }
        continue;
      }
      if (
        !plain ||
        /^(all|project price|labor vs material|pricing total|customer|project address)\b/i.test(
          plain
        ) ||
        /\b(?:style|manufacturer|finish|hardware|color|edge profile|specification|selection|details|schedule|payment terms|permit requirements|labor and material|cost breakdown)\b/i.test(
          plain
        ) ||
        (/^plumbing fixture and appliance scope$/i.test(plain) &&
          !/\b(?:fixture|faucet|sink|toilet|vanity|appliance|disposal)\b/i.test(
            notes
          )) ||
        /^(?:kitchen remodel|plumbing|electrical|drywall and insulation|material\/labor pricing for flooring|windows and exterior door)$/i.test(
          plain
        ) ||
        fallbackNames.has(plain.toLowerCase())
      ) {
        continue;
      }
      fallbackNames.add(plain.toLowerCase());
      rows.push({ id: `note:${plain.toLowerCase()}`, name: plain });
    }
  }
  return rows;
}

/** Checklist rows for Scope found when priced packages are not built yet. */
export function getInitialRevealChecklistScopePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> {
  const planLines = confirmedPlanLinesForDraft(draft);
  if (planLines.length > 0) {
    return planLines.map(name => ({ name, amount: 0 }));
  }
  const showAmounts = initialRevealPricingVisible(draft);
  const scopeRows = getInitialRevealScopeRows(draft);
  const visibleChecklistItems =
    draft.scopeChecklist?.items?.filter(item =>
      revealChecklistItemVisible(draft, item)
    ) || [];

  if (
    standalonePlumbingRevealDraft(draft) &&
    visibleChecklistItems.length > 0
  ) {
    return scopeRows.slice(0, 50).map(row => ({
      name: row.name,
      amount: 0,
    }));
  }

  const inScopeIds = new Set(scopeRows.map(row => row.id));
  const packages = dedupeAdditionRevealPackages(
    draft,
    getScopePackagesForReview(draft)
  ).filter(pkg => {
    if (shouldHideDuplicateElectricalPreviewPackage(draft, pkg)) {
      return false;
    }
    const id = String(pkg.checklistItemId || pkg.costCode || '').trim();
    return !inScopeIds.size || (id && inScopeIds.has(id));
  });
  if (packages.length > 0) {
    const packageById = new Map(
      packages.map(pkg => [
        String(pkg.checklistItemId || pkg.costCode || '').trim(),
        pkg,
      ])
    );
    // The checklist is the canonical interpretation. Packages only decorate
    // those rows with pricing; they must not decide which scope is visible.
    const checklistRows = scopeRows
      .map(row => {
        const id = row.id;
        const pkg = packageById.get(id);
        const quantity =
          row.quantityOverride !== undefined
            ? row.quantityOverride
            : formatScopeQuantity(
                {
                  ...(pkg || {}),
                  checklistItemId: row.id,
                } as EstimateDraftScopePackage,
                draft
              );
        return {
          name: row.name,
          amount:
            showAmounts && pkg
              ? scopePackageIndicativePricedAmount(pkg, draft)
              : 0,
          ...(quantity ? { quantity } : {}),
        };
      })
      .filter(row => row.name);
    const representedIds = new Set(scopeRows.map(row => row.id));
    const packageOnlyRows = packages
      .filter(
        pkg =>
          !representedIds.has(
            String(pkg.checklistItemId || pkg.costCode || '').trim()
          )
      )
      .map(pkg => {
        const quantity = formatScopeQuantity(pkg, draft);
        return {
          name: String(pkg.name || pkg.scope || 'Scope item').trim(),
          amount: showAmounts
            ? scopePackageIndicativePricedAmount(pkg, draft)
            : 0,
          ...(quantity ? { quantity } : {}),
        };
      })
      .filter(row => row.name);
    return normalizeAdditionRevealPreviewRows(draft, [
      ...checklistRows,
      ...packageOnlyRows,
    ]).slice(0, 50);
  }
  if (!scopeRows.length) return [];
  return scopeRows.slice(0, 50).map(row => ({
    name: row.name,
    amount: 0,
  }));
}

export function shouldDefaultExpandInitialRevealScope(
  _scopeItemCount: number
): boolean {
  return _scopeItemCount > 0;
}

export function getInitialRevealHeaderCopy(input: {
  hasAmount: boolean;
  needsScopeConfirmation: boolean;
}): { title: string; subtitle: string } {
  if (!input.hasAmount || input.needsScopeConfirmation) {
    return {
      title: 'Scope found',
      subtitle: 'Review what BPS identified before pricing',
    };
  }
  return {
    title: 'Initial estimate',
    subtitle: 'Quick summary before detailed review',
  };
}

export function getInitialRevealPlanningDisclaimer(
  totals: InitialRevealTotals,
  attentionCount: number
): string | null {
  if (totals.heroTotal == null || totals.heroTotal <= 0) return null;
  if (attentionCount === 0) return null;
  return 'Planning estimate — review before sending';
}

export function getScopeTotalCoverageLine(
  draft: EstimateAiDraft,
  options?: { missingPriceCount?: number; scopeItemCount?: number }
): string | null {
  const pkgs = getScopePackagesForReview(draft);
  const scopeItemCount = options?.scopeItemCount ?? pkgs.length;
  const useIndicative =
    roofingRevealHasPlanningInputs(draft) && !draft.scopeAssumptionsConfirmed;
  const needingPrice = pkgs.filter(pkg => {
    if (useIndicative && scopePackageIndicativePricedAmount(pkg, draft) > 0)
      return false;
    return scopePackageNeedsManualPrice(pkg, draft);
  });
  const missingPriceCount = options?.missingPriceCount ?? needingPrice.length;
  if (scopeItemCount <= 0 || missingPriceCount <= 0) return null;
  const included = Math.max(0, scopeItemCount - missingPriceCount);
  const names = needingPrice
    .map(pkg => String(pkg.name || pkg.scope || '').trim())
    .filter(Boolean);
  const missingDetail =
    names.length === 1
      ? `${names[0]} is not included`
      : missingPriceCount === 1
        ? '1 item is not included'
        : `${missingPriceCount} items are not included`;
  return `Includes ${included} of ${scopeItemCount} scope items. ${missingDetail}.`;
}

export function shouldShowInitialRevealWhatWeFound(
  understood: string[],
  tagline: string | null
): boolean {
  if (understood.length === 0) return false;
  if (!tagline) return true;
  const norm = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  const tagNorm = norm(tagline);
  return understood.some(line => {
    const lineNorm = norm(line);
    if (!lineNorm || lineNorm === tagNorm) return false;
    if (lineNorm.includes(tagNorm) || tagNorm.includes(lineNorm)) return false;
    return true;
  });
}

export function getInitialRevealStatusLabel(
  draft: EstimateAiDraft,
  attentionCount: number
): { label: string; tone: InitialRevealStatusTone } {
  const level = draft.estimateConfidence?.level as
    EstimateConfidenceLevel | undefined;
  if (attentionCount === 0 && level === 'high') {
    return { label: 'Ready to send', tone: 'ready' };
  }
  if (attentionCount === 0) {
    return { label: 'Mostly ready', tone: 'mostly' };
  }
  if (attentionCount === 1) {
    return { label: 'Mostly ready · 1 to check', tone: 'review' };
  }
  return { label: `Mostly ready · ${attentionCount} to check`, tone: 'review' };
}

export function getInitialRevealDisplayTitle(draft: EstimateAiDraft): string {
  const classification = getRevealClassification(draft);
  if (classification.scopeMode === 'mixed') {
    return classification.scopeSummary?.trim() || 'Mixed-scope remodel';
  }
  if (isPlumbingRevealDraft(draft) && standalonePlumbingRevealDraft(draft)) {
    const roomTitle = standalonePlumbingProjectTitle(
      draft.originalNotes || '',
      draft.scopeMeasurements?.plumbingRoomContext ?? null
    );
    if (roomTitle !== 'Plumbing bid') return roomTitle;
  }
  if (draft.projectTitle?.trim()) {
    return draft.projectTitle.trim();
  }
  if (draft.projectType && draft.projectType !== 'other') {
    const label = draft.projectType.replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (draft.customerName?.trim()) {
    return draft.customerName.trim();
  }
  return 'Your project';
}

function revealItemPriority(text: string): number {
  if (REVEAL_HIGH_PRIORITY.test(text)) return 0;
  if (REVEAL_LOW_PRIORITY.test(text)) return 2;
  return 1;
}

function getRevealClassification(draft: EstimateAiDraft) {
  const classification = draft.classification;
  const tradeLabels: Record<string, string> = {
    framing: 'Framing',
    flooring: 'Flooring',
    drywall: 'Drywall',
    concrete: 'Concrete',
    painting: 'Painting',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    hvac: 'HVAC',
    roofing: 'Roofing',
    windows_doors: 'Windows & doors',
    insulation: 'Insulation',
    trim: 'Trim',
  };
  const notes = String(draft.originalNotes || '');
  const hasMixedExteriorHardscape =
    /\b(?:concrete|flatwork|patio|pavers?|retaining\s+walls?)\b/i.test(
      notes
    ) &&
    /\b(?:landscap(?:e|ing)|sod|turf|rock|mulch|shrubs?|plants?|irrigation|edging|exterior\s+doors?)\b/i.test(
      notes
    );
  const mixedNoteSignals = [
    /\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet)\b/i,
    /\b(?:drywall|sheetrock|gypsum|patch|repair)\b/i,
    /\b(?:paint(?:ing)?|repaint)\b/i,
    /\b(?:insulat(?:e|ion|ed)|R[-\s]?\d{2,3})\b/i,
    /\bwindows?\b|\b(?:interior\s+)?doors?\b/i,
  ].filter(pattern => pattern.test(notes)).length;
  const notesImplyMixedScope =
    mixedNoteSignals >= 3 &&
    !/\b(?:new\s+build|ground[-\s]?up|addition|adu|garage\s+conversion)\b/i.test(
      notes
    );
  const resolvedScopeMode =
    classification?.scopeMode ||
    draft.scopeMode ||
    (notesImplyMixedScope ? 'mixed' : 'unknown');
  const existingTradeLabels = classification?.detectedTrades?.length
    ? classification.detectedTrades.map(
        trade => tradeLabels[trade] || trade.replace(/_/g, ' ')
      )
    : draft.scopeTradeLabels || draft.detectedTrades || [];
  const normalizedExistingTradeLabels = existingTradeLabels
    .map(label => {
      const value = String(label || '').trim();
      const normalized = value.toLowerCase();
      if (
        normalized === 'electrical' &&
        notesExcludeElectricalServiceUpgrade(notes) &&
        !/\b(?:electrical|wiring|outlets?|receptacles?|circuits?|panel)\b/i.test(
          notes.replace(/\belectrical\s+service\s+upgrades?\b/gi, '')
        )
      ) {
        return null;
      }
      if (
        /deck\s*\/?\s*patio|deck_patio/.test(normalized) &&
        !/\bdeck(?:ing)?\b|\brailing\b/i.test(notes)
      ) {
        return null;
      }
      if (/\blandscap/.test(normalized)) return 'Landscaping';
      if (
        /windows?\s*&\s*doors?|windows?\s+and\s+doors?/.test(normalized) &&
        !/\bwindows?\b/i.test(notes)
      ) {
        return 'Exterior doors';
      }
      if (normalized === 'concrete') return 'Concrete';
      return value || null;
    })
    .filter((label): label is string => Boolean(label));
  const inferredExteriorTradeLabels = [
    /\b(?:concrete|flatwork|patio)\b/i.test(notes) ? 'Concrete' : null,
    /\b(?:landscap(?:e|ing)|sod|turf|rock|mulch|shrubs?|plants?|irrigation|edging|pavers?|retaining\s+walls?)\b/i.test(
      notes
    )
      ? 'Landscaping'
      : null,
    /\b(?:exterior|entry|front|back|side|service)\s+doors?\b/i.test(notes)
      ? 'Exterior doors'
      : null,
  ].filter((label): label is string => Boolean(label));
  const combinedTradeLabels = Array.from(
    new Set([...normalizedExistingTradeLabels, ...inferredExteriorTradeLabels])
  );
  const activeStuccoNotes = notes.replace(
    /\b(?:no|without|exclude(?:d|s|ing)?|not\s+included|not\s+in\s+scope|owner[-\s]+provided)\b[^.;\n]*(?:[.;\n]|$)/gi,
    ' '
  );
  const stuccoInternalTrimOnly =
    /\bstucco\b|\b(?:exterior\s+wall\s+finish|exterior\s+plaster|synthetic\s+stucco|eifs?)\b/i.test(
      activeStuccoNotes
    ) &&
    !/\b(?:baseboards?|casing|crown\s+(?:molding|moulding)|interior\s+trim|window\s+trim|door\s+trim|exterior\s+trim)\b/i.test(
      activeStuccoNotes
    );
  const displayTradeLabels = normalizedExistingTradeLabels.filter(
    label =>
      !(stuccoInternalTrimOnly && label.toLowerCase() === 'trim') &&
      !(
        label.toLowerCase() === 'hvac' &&
        !/\b(?:hvac|furnace|heat\s*pump|air\s*condition(?:er|ing)?)\b/i.test(
          activeStuccoNotes
        )
      )
  );
  const hasDedicatedStuccoIntent =
    (draft.projectType === 'stucco' ||
      classification?.primaryTrade === 'stucco' ||
      classification?.detectedTrades?.includes('stucco')) &&
    /\b(?:stucco|exterior\s+wall\s+finish|exterior\s+plaster|synthetic\s+stucco|eifs?)\b/i.test(
      notes
    ) &&
    !/\b(?:frame|framing|framed|headers?|blocking|structural\s+sheathing|sheathing)\b/i.test(
      activeStuccoNotes
    ) &&
    !notesRequireInteriorPaintMeasurements(activeStuccoNotes) &&
    !/\b(?:install|replace|remove|demo|demolition|new)\b[^.;\n]{0,60}\b(?:windows?|doors?)\b|\b(?:windows?|doors?)\b[^.;\n]{0,60}\b(?:install|replace|remove|demo|demolition)\b/i.test(
      activeStuccoNotes
    ) &&
    !/\b(?:baseboards?|casing|crown\s+(?:molding|moulding)|interior\s+trim)\b/i.test(
      activeStuccoNotes
    );
  if (hasDedicatedStuccoIntent) {
    return {
      scopeMode: 'dedicated',
      scopeSummary: null,
      scopeTradeLabels: ['Stucco / exterior finish'],
    };
  }
  const scopeTradeLabels = hasMixedExteriorHardscape
    ? [
        'Concrete',
        'Landscaping',
        'Exterior doors',
        ...combinedTradeLabels.filter(
          label => !['Concrete', 'Landscaping', 'Exterior doors'].includes(label)
        ),
      ].filter(label => combinedTradeLabels.includes(label))
    : displayTradeLabels;
  return {
    scopeMode:
      (notesImplyMixedScope || hasMixedExteriorHardscape) &&
      resolvedScopeMode !== 'mixed'
        ? 'mixed'
        : resolvedScopeMode,
    scopeSummary: hasMixedExteriorHardscape
      ? classification?.scopeSummary ||
        draft.scopeSummary ||
        'Mixed exterior hardscape'
      : classification?.scopeSummary || draft.scopeSummary || null,
    scopeTradeLabels,
  };
}

/** Top items for the reveal screen — scope/pricing first, admin details later. */
export function getInitialRevealPriorityItems(
  draft: EstimateAiDraft,
  max = 3
): { items: string[]; overflow: number } {
  const { items, overflow } = getCompactStillNeeded(draft, 50);
  const prioritized = filterMixedScopeAttentionItems(
    draft,
    filterBathroomRevealAttentionItems(
      draft,
      filterConcreteRevealAttentionItems(
        draft,
        filterPlumbingRevealAttentionItems(
          draft,
          filterRoofingRevealAttentionItems(
            draft,
            [...items]
              .filter(item => !isInitialRevealBidDetailItem(item))
              .sort((a, b) => revealItemPriority(a) - revealItemPriority(b))
          )
        )
      )
    )
  );
  const visible = prioritized.slice(0, max).map(plainLanguageReviewItem);
  const hidden = Math.max(0, prioritized.length - max) + overflow;
  return { items: visible, overflow: hidden };
}

/** One-line positive summary for the hero area. */
export function getInitialRevealTagline(draft: EstimateAiDraft): string | null {
  const planMeasurements = draft.scopeMeasurements as
    | { planImportFingerprint?: string | null; planImportMode?: string | null }
    | null
    | undefined;
  if (
    planMeasurements?.planImportFingerprint &&
    planMeasurements.planImportMode !== 'selected_trade'
  ) {
    return 'Read from the sheets. Unprinted trades stay planning allowances.';
  }
  const classification = getRevealClassification(draft);
  if (classification.scopeMode === 'mixed') {
    const summary =
      classification.scopeSummary?.trim() || 'Mixed-scope remodel';
    const trades = classification.scopeTradeLabels
      .map(label => String(label).trim())
      .filter(Boolean);
    return trades.length > 0 ? `${summary} · ${trades.join(' · ')}` : summary;
  }
  if (isPlumbingRevealDraft(draft)) {
    const scopeCount = getInitialRevealScopeRows(draft).length;
    if (scopeCount > 0) {
      const title = standalonePlumbingRevealDraft(draft)
        ? standalonePlumbingProjectTitle(
            draft.originalNotes || '',
            draft.scopeMeasurements?.plumbingRoomContext ?? null
          )
        : getInitialRevealDisplayTitle(draft);
      const taglineTitle =
        title === 'Master bath plumbing' ? 'Bathroom plumbing' : title;
      return `${taglineTitle} · ${scopeCount} scope line${scopeCount === 1 ? '' : 's'}`;
    }
  }
  const bullets = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 6);
  const titleNorm = getInitialRevealDisplayTitle(draft).toLowerCase();
  const positive = bullets.find(line => {
    const plain = plainLanguageReviewItem(line);
    if (
      /kitchen remodel/i.test(plain) &&
      /paint|repaint|exterior|interior/i.test(titleNorm)
    ) {
      return false;
    }
    return !/no material or labor|rates were provided|no pricing was calculated|could not|unable to/i.test(
      line
    );
  });
  if (positive) return plainLanguageReviewItem(positive);

  if (isPlumbingRevealDraft(draft)) {
    return 'Plumbing scope ready to confirm';
  }

  if (draft.projectType && draft.projectType !== 'other') {
    return `${getInitialRevealDisplayTitle(draft)} scope identified`;
  }
  return null;
}

export type InitialRevealHeroDisplay = {
  hasAmount: boolean;
  amountText: string;
  hint: string;
  markupSubline: string | null;
};

function formatHeroMarkupSubline(markupPct: number): string {
  const rounded = Math.round(markupPct * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${label}% markup`;
}

export function getInitialRevealHeroDisplay(
  totals: InitialRevealTotals,
  needsScopeConfirmation: boolean
): InitialRevealHeroDisplay {
  if (needsScopeConfirmation) {
    return {
      hasAmount: false,
      amountText: '—',
      hint: 'Confirm scope to calculate pricing',
      markupSubline: null,
    };
  }
  if (totals.heroTotal != null && totals.heroTotal > 0) {
    return {
      hasAmount: true,
      amountText: formatPlanningMoney(totals.heroTotal),
      hint: totals.heroTotalLabel,
      markupSubline:
        totals.markupPct != null && totals.markupPct > 0
          ? formatHeroMarkupSubline(totals.markupPct)
          : null,
    };
  }
  return {
    hasAmount: false,
    amountText: '—',
    hint: 'Add rates or confirm scope to see your total',
    markupSubline: null,
  };
}

export function getInitialRevealUnderstoodBullets(
  draft: EstimateAiDraft,
  max = 3
): string[] {
  const planLines = confirmedPlanLinesForDraft(draft);
  if (planLines.length > 0) return planLines.slice(0, Math.max(max, 8));
  const classification = getRevealClassification(draft);
  if (
    classification.scopeMode === 'mixed' &&
    classification.scopeTradeLabels.length
  ) {
    return classification.scopeTradeLabels
      .map(label => String(label).trim())
      .filter(Boolean)
      .slice(0, max);
  }
  const plumbingMax = isPlumbingRevealDraft(draft)
    ? Math.max(
        max,
        draft.scopeMeasurements?.plumbingRoomContext === 'whole_house' ? 8 : 6
      )
    : max;
  if (isConcreteRevealDraft(draft) && concreteRevealHasPlanningInputs(draft)) {
    const fromNotes = summarizeConcreteNoteBullets(
      draft.originalNotes || '',
      max + 3
    );
    if (fromNotes.length > 0) return fromNotes.slice(0, max);
  }

  if (isPlumbingRevealDraft(draft)) {
    const fromNotes = summarizePlumbingNoteBullets(
      draft.originalNotes || '',
      plumbingMax
    );
    const parsedNotes = parsePlumbingMeasurementsFromNotes(
      draft.originalNotes || ''
    );
    const measurements = initialScopeMeasurementInputExtended(
      draft
    ) as Record<string, unknown>;
    const noteScopeIds = plumbingNoteScopeItemIds(draft.originalNotes || '');
    const missingTextualScopeNames = getInitialRevealScopeRows(draft)
      .filter(row => noteScopeIds.has(row.id))
      .filter(row => {
        const key = plumbingMeasurementKeyForItemId(row.id);
        return Boolean(
          key &&
            !(Number(measurements[key]) > 0) &&
            !(Number(parsedNotes[key]) > 0)
        );
      })
      .map(row => row.name.trim())
      .filter(Boolean);
    const combined = [...fromNotes, ...missingTextualScopeNames].filter(
      (item, index, all) => all.indexOf(item) === index
    );
    if (combined.length > 0) return combined.slice(0, plumbingMax);
    const fromChecklist = getInitialRevealScopeRows(draft)
      .slice(0, plumbingMax)
      .map(row => row.name.trim())
      .filter(Boolean);
    if (fromChecklist.length > 0) return fromChecklist;
  }

  if (!initialRevealPricingVisible(draft)) {
    const fromChecklist = getInitialRevealScopeRows(draft)
      .map(row => row.name)
      .filter(Boolean);
    if (fromChecklist.length > 0) return fromChecklist.slice(0, max);
  }

  if (
    isRoofingRevealDraft(draft) &&
    roofingRevealHasPlanningInputs(draft) &&
    initialRevealPricingVisible(draft)
  ) {
    const fromPackages = getScopePackagesForReview(draft)
      .map(pkg => {
        const name = String(pkg.name || pkg.scope || 'Scope item').trim();
        const amount = scopePackageIndicativePricedAmount(pkg, draft);
        if (amount > 0) return `${name} · ${formatPlanningMoney(amount)}`;
        return name;
      })
      .filter(Boolean);
    if (fromPackages.length > 0) return fromPackages.slice(0, max);
  }

  if (isRoofingRevealDraft(draft) && roofingRevealHasPlanningInputs(draft)) {
    const fromPackages = getScopePackagesForReview(draft)
      .map(pkg => String(pkg.name || pkg.scope || 'Scope item').trim())
      .filter(Boolean);
    if (fromPackages.length > 0) return fromPackages.slice(0, max);
  }

  const fromAi = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], max + 2)
    .map(plainLanguageReviewItem)
    .filter(
      line =>
        !/no material or labor|rates were provided|no pricing was calculated/i.test(
          line
        )
    );
  if (fromAi.length > 0) return fromAi.slice(0, max);

  const pkgs = getScopePackagesForReview(draft);
  if (pkgs.length > 0) {
    return pkgs.slice(0, max).map(pkg => {
      const name = String(pkg.name || pkg.scope || 'Scope item').trim();
      if (!initialRevealPricingVisible(draft)) return name;
      const amount = scopePackagePricedAmount(pkg, draft);
      if (amount > 0) return `${name} · ${formatPlanningMoney(amount)}`;
      return name;
    });
  }

  const tagline = getInitialRevealTagline(draft);
  return tagline ? [tagline] : ['Built from your notes and inputs'];
}

export function getInitialRevealTotals(
  draft: EstimateAiDraft,
  markupPct = 0
): InitialRevealTotals {
  const scopePackages = getScopePackagesForReview(draft);
  const appliedScopeBreakdown = sumStep3ReviewBudgetTotals(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const liveScopeTotal = sumLiveScopePackageTotals(draft);
  const indicativeScopeTotal =
    initialRevealPricingVisible(draft) && roofingRevealHasPlanningInputs(draft)
      ? sumIndicativeScopePackageTotals(draft)
      : 0;

  const calculatedTotal =
    appliedScopeBreakdown && appliedScopeBreakdown.total > 0
      ? appliedScopeBreakdown.total
      : liveScopeTotal > 0
        ? liveScopeTotal
        : indicativeScopeTotal > 0
          ? indicativeScopeTotal
          : (draft.calculatedLineItemTotal ??
            draft.calculatedTotal ??
            draft.totalValidation?.calculatedLineItemsTotal ??
            (pendingTotal > 0 ? pendingTotal : null));

  const scopeBudgetTotals = appliedScopeBreakdown
    ? {
        material: appliedScopeBreakdown.material,
        labor: appliedScopeBreakdown.labor,
        allowance: appliedScopeBreakdown.allowance,
      }
    : scopePackages.reduce(
        (sum, pkg) => {
          const isSoftCost = isSoftCostScopePackage(pkg, draft);
          const breakdown = isSoftCost
            ? null
            : resolveScopePackageBudgetBreakdown(pkg, draft);
          const numericAmount = scopePackagePricedAmount(pkg, draft);
          if (numericAmount <= 0) return sum;
          if (isSoftCost || !breakdown) {
            return isSoftCost
              ? { ...sum, allowance: sum.allowance + numericAmount }
              : { ...sum, labor: sum.labor + numericAmount };
          }
          const material = Math.min(breakdown.material, numericAmount);
          const labor = Math.min(
            breakdown.labor,
            Math.max(0, numericAmount - material)
          );
          const allowance = Math.max(0, numericAmount - material - labor);
          return {
            material: sum.material + material,
            labor: sum.labor + labor,
            allowance: sum.allowance + allowance,
          };
        },
        { material: 0, labor: 0, allowance: 0 }
      );

  const material =
    scopeBudgetTotals.material > 0
      ? roundedMoney(scopeBudgetTotals.material)
      : null;
  const labor =
    scopeBudgetTotals.labor > 0 ? roundedMoney(scopeBudgetTotals.labor) : null;
  const allowance =
    scopeBudgetTotals.allowance > 0
      ? roundedMoney(scopeBudgetTotals.allowance)
      : null;

  const directSubtotal =
    calculatedTotal != null && calculatedTotal > 0
      ? calculatedTotal
      : material != null || labor != null || allowance != null
        ? roundedMoney((material || 0) + (labor || 0) + (allowance || 0))
        : null;

  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const estimatedWithMarkup =
    directSubtotal != null && directSubtotal > 0 && normalizedMarkupPct > 0
      ? roundedMoney(directSubtotal * (1 + normalizedMarkupPct / 100))
      : null;

  const heroTotal =
    statedTotal != null && statedTotal > 0
      ? statedTotal
      : estimatedWithMarkup != null && estimatedWithMarkup > 0
        ? estimatedWithMarkup
        : directSubtotal != null && directSubtotal > 0
          ? directSubtotal
          : null;

  const heroTotalLabel =
    statedTotal != null && statedTotal > 0
      ? 'Total from your notes'
      : indicativeScopeTotal > 0 && !draft.scopeAssumptionsConfirmed
        ? 'Planning estimate from scope'
        : estimatedWithMarkup != null && normalizedMarkupPct > 0
          ? 'Initial estimate (incl. markup)'
          : 'Initial estimate';

  const markupPctOnHero =
    statedTotal != null && statedTotal > 0
      ? null
      : estimatedWithMarkup != null && normalizedMarkupPct > 0
        ? normalizedMarkupPct
        : null;

  return {
    heroTotal,
    heroTotalLabel,
    markupPct: markupPctOnHero,
    material,
    labor,
    allowance,
    estimatedWithMarkup,
    scopeItemCount: countInitialRevealScopeItems(draft),
  };
}

export function initialRevealPricingVisible(
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft) return false;
  return Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );
}

export function draftNeedsScopeConfirmation(
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft || !isComplexEstimateTier(draft)) return false;
  if (draft.scopeAssumptionsConfirmed) return false;
  if (draft.requiresScopeConfirmation) return true;
  // A saved checklist can contain partial in-progress choices. Those are not
  // confirmation just because one or more rows have been touched.
  if (draft.scopeProgressItems?.length) return true;
  return !draft.confirmedAssumptions?.length;
}

export function getInitialRevealPrimaryCtaLabel(
  attentionCount: number,
  needsScopeConfirmation = false
): string {
  if (needsScopeConfirmation) {
    return 'Confirm scope';
  }
  if (attentionCount > 0) {
    return attentionCount === 1
      ? 'Continue to review · 1 to check'
      : `Continue to review · ${attentionCount} to check`;
  }
  return 'Review & apply estimate';
}

export function scopePackagesNeedingPriceCount(draft: EstimateAiDraft): number {
  return getScopePackagesForReview(draft).filter(pkg =>
    scopePackageNeedsManualPrice(pkg, draft)
  ).length;
}
