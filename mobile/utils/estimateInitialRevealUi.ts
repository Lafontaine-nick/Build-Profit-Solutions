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
import {
  summarizePlumbingNoteBullets,
  plumbingRevealNoteBackedItemIds,
  resolvePlumbingRevealAttentionItemId,
  standalonePlumbingRevealDraft,
  inferPlumbingRoomContextFromNotes,
  notesCustomerSuppliesPlumbingFixtures,
  notesExplicitPlumbingFixtureAllowance,
  notesExcludePlumbingScopePhrase,
  notesSuggestStandalonePlumbingTrade,
  standalonePlumbingProjectTitle,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  getCompactProjectSummary,
  getCompactStillNeeded,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  scopePackageIndicativePricedAmount,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
  summarizeWhatAiDidForDisplay,
  sumIndicativeScopePackageTotals,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';
import {
  collectRoofingInferenceNotes,
  inferItemStateFromNotes,
  parseRoofingDeckingAllowanceFromNotes,
} from '@/utils/scopeItemNoteHints';
import { initialScopeMeasurementInputExtended, checklistItemInScope } from '@/utils/scopeItemQuantities';
import { isSoftCostScopePackage } from '@/utils/softCostScope';

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

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const REVEAL_BID_DETAIL =
  /customer name|project address|client name|email|phone|permit responsibility|permit requirements|permit fees|license|start date|payment terms|labor vs material breakdown/i;
const REVEAL_LOW_PRIORITY = REVEAL_BID_DETAIL;
const REVEAL_HIGH_PRIORITY = /pricing for|price needed|missing price|please check|measurement|quantity/i;

/** Plain-language labels for review / confidence copy (display only). */
export function plainLanguageReviewItem(text: string): string {
  let s = String(text || '').trim();
  if (!s) return s;

  if (
    /overall bid total|room lump sum|\$\/sqft rates with square/i.test(s)
  ) {
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
  const { items } = getCompactStillNeeded(draft, 50);
  const prioritized = filterBathroomRevealAttentionItems(
    draft,
    filterConcreteRevealAttentionItems(
      draft,
      filterPlumbingRevealAttentionItems(
        draft,
        filterRoofingRevealAttentionItems(
          draft,
          [...items]
            .filter((item) => !isInitialRevealBidDetailItem(item))
            .sort((a, b) => revealItemPriority(a) - revealItemPriority(b))
        )
      )
    )
  );
  return splitInitialRevealConfirmItems(prioritized);
}

export function countInitialRevealAttentionItems(draft: EstimateAiDraft): number {
  return getInitialRevealConfirmItems(draft).pricingScope.length;
}

export function getInitialRevealScopeMetaLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 scope item' : `${count} scope items`;
}

function isPlumbingRevealDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return ['plumbing', 'plumbing_service'].includes(templateKey);
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
  const inferenceNotes = collectRoofingInferenceNotes(draft, draft.originalNotes);
  const deckingAllowance = parseRoofingDeckingAllowanceFromNotes(inferenceNotes);
  const hasPlanning = roofingRevealHasPlanningInputs(draft);
  const packages = getScopePackagesForReview(draft);

  return items.filter((item) => {
    const text = item.trim().toLowerCase();

    if (!scopeConfirmed) {
      if (/pricing total not found|overall bid total|no overall bid total/.test(text)) {
        return false;
      }
      if (/permit requirements|permit fees|permit responsibility/.test(text)) {
        return false;
      }
      if (/^payment terms\b/.test(text)) return false;
      if (
        deckingAllowance != null &&
        deckingAllowance > 0 &&
        (/decking allowance|bad wood|decking.*allowance|allowance.*decking/.test(text) ||
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
    if (/full reroof contract|contract price.*roof|roofing contract price/.test(text)) {
      return false;
    }
    if (/shingle color|roofing color|color selection/.test(text)) return false;
    const pricingMatch = item.match(/^pricing for (.+?)(?:\s*\(|$)/i);
    if (pricingMatch) {
      const name = pricingMatch[1].trim().toLowerCase();
      const pkg = packages.find(
        (row) => String(row.name || row.scope || '').trim().toLowerCase() === name
      );
      if (pkg && scopePackageIndicativePricedAmount(pkg, draft) > 0) return false;
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

function revealChecklistItemVisible(
  draft: EstimateAiDraft,
  item: { id: string; state?: string; inputType?: string; choiceId?: string | null; choiceIds?: string[] }
): boolean {
  if (!checklistItemInScope(item)) return false;
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
  const checklistCount = getInitialRevealScopeRows(draft).length;
  if (checklistCount > 0) return checklistCount;
  const packageCount = getScopePackages(draft).length;
  return packageCount;
}

function getInitialRevealScopeRows(
  draft: EstimateAiDraft
): Array<{ id: string; name: string }> {
  const kitchenContext = [
    draft.scopeChecklist?.templateKey,
    draft.projectType,
    draft.projectTitle,
    draft.originalNotes,
  ]
    .map((value) => String(value || '').toLowerCase())
    .some((value) => /\bkitchen\b/.test(value));
  const displayNameForScopeRow = (id: string, name: string) =>
    kitchenContext && id === 'floor_demo'
      ? 'Kitchen flooring demo / removal'
      : name;
  const facts = draft.scopeChecklist?.scopeFacts || [];
  const resolvedFactIds = new Set(
    facts
      .filter((fact) => fact.status !== 'excluded')
      .map((fact) => String(fact.scopeId || '').trim())
      .filter(Boolean)
  );
  const hasResolvedFacts = facts.length > 0;
  let rows =
    draft.scopeChecklist?.items
      ?.filter((item) => revealChecklistItemVisible(draft, item))
      .filter(
        (item) =>
          !hasResolvedFacts ||
          item.noteBacked === true ||
          resolvedFactIds.has(String(item.id || '').trim()) ||
          resolvedFactIds.has(String(item.catalogScopeId || '').trim())
      )
      .map((item) => ({
        id: String(item.id || '').trim(),
        name: displayNameForScopeRow(
          String(item.id || '').trim(),
          String(item.label || item.id || 'Scope item').trim()
        ),
      }))
      .filter((row) => row.id && row.name) || [];
  const ids = new Set(rows.map((row) => row.id));
  for (const fact of facts) {
    const id = String(fact.scopeId || '').trim();
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
  if (
    !ids.has('exterior_doors') &&
    inferItemStateFromNotes('exterior_doors', draft.originalNotes) ===
      'included'
  ) {
    rows.push({ id: 'exterior_doors', name: 'Exterior doors' });
    ids.add('exterior_doors');
  }
  const hasDetailedScopeRow = rows.some((row) =>
    /(?:\b\d[\d,]*(?:\.\d+)?\s*(?:lf|sqft|sf|each)\b|\bR[-\s]?\d{2,3}\b|\btwo\s+new\s+windows?\b|\bone\s+new\s+exterior\s+door\b)/i.test(
      row.name
    )
  );
  rows = rows.filter((row) => {
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
    // The kitchen checklist can contain a generic “Walls” paint row in
    // addition to the explicit Interior painting row. Keep the priced,
    // note-backed painting scope and suppress the duplicate label.
    if (
      /^walls$/i.test(name) &&
      rows.some(
        (candidate) =>
          candidate.id !== row.id &&
          /\binterior\s+paint(?:ing)?\b/i.test(candidate.name)
      )
    ) {
      return false;
    }
    if (
      /\b(?:style|manufacturer|finish|hardware|color|edge profile|specification|selection|details|schedule|payment terms|permit|engineering|inspection|labor and material|cost breakdown)\b/i.test(
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
      return false;
    }
    if (
      hasDetailedScopeRow &&
      /^(?:drywall repair|drywall patch \/ repair|insulation)$/i.test(name)
    ) {
      return false;
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
  const bathroomContext = [
    draft.scopeChecklist?.templateKey,
    draft.projectType,
    draft.projectTitle,
    draft.originalNotes,
  ]
    .map((value) => String(value || '').toLowerCase())
    .some((value) => /\bbathroom\b|\bbathrooms\b|\bbaths?\b/.test(value));
  if (bathroomContext) {
    const hasSpecificTile = rows.some((row) =>
      /shower|bathroom floor tile/i.test(row.name)
    );
    const hasPaintRepair = rows.some((row) =>
      /painting\/patch|paint repair/i.test(row.name)
    );
    const seenNames = new Set<string>();
    rows = rows.filter((row) => {
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
          /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,50}\bdrywall\b|\bdrywall\b[^.;\n]{0,50}\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i,
        id: 'note:bathroom drywall demo',
        name: 'Drywall demo / removal',
      },
    ];
    const noteText = String(draft.originalNotes || '');
    const existingNames = new Set(rows.map(row => row.name.toLowerCase()));
    for (const demo of bathroomDemoRows) {
      if (demo.pattern.test(noteText) && !existingNames.has(demo.name.toLowerCase())) {
        rows.push(demo);
        existingNames.add(demo.name.toLowerCase());
      }
    }
  }
  const hydratedKitchenDemoSource = `${String(draft.originalNotes || '')} ${rows
    .map((row) => row.name)
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
    const existingNames = new Set(rows.map((row) => row.name.toLowerCase()));
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
        /^(all|project price|labor vs material|pricing total|customer|project address)\b/i.test(plain) ||
        /\b(?:style|manufacturer|finish|hardware|color|edge profile|specification|selection|details|schedule|payment terms|permit requirements|labor and material|cost breakdown)\b/i.test(
          plain
        ) ||
        (/^plumbing fixture and appliance scope$/i.test(plain) &&
          !/\b(?:fixture|faucet|sink|toilet|vanity|appliance|disposal)\b/i.test(notes)) ||
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
): Array<{ name: string; amount: number }> {
  const showAmounts = initialRevealPricingVisible(draft);
  const scopeRows = getInitialRevealScopeRows(draft);
  const visibleChecklistItems =
    draft.scopeChecklist?.items?.filter((item) =>
      revealChecklistItemVisible(draft, item)
    ) || [];

  if (standalonePlumbingRevealDraft(draft) && visibleChecklistItems.length > 0) {
    return scopeRows.slice(0, 50).map((row) => ({
      name: row.name,
      amount: 0,
    }));
  }

  const inScopeIds = new Set(scopeRows.map((row) => row.id));
  const packages = getScopePackagesForReview(draft).filter((pkg) => {
    const id = String(pkg.checklistItemId || pkg.costCode || '').trim();
    return !inScopeIds.size || (id && inScopeIds.has(id));
  });
  if (packages.length > 0) {
    const packageById = new Map(
      packages.map((pkg) => [
        String(pkg.checklistItemId || pkg.costCode || '').trim(),
        pkg,
      ]),
    );
    // The checklist is the canonical interpretation. Packages only decorate
    // those rows with pricing; they must not decide which scope is visible.
    const checklistRows = scopeRows
      .map((row) => {
        const id = row.id;
        const pkg = packageById.get(id);
        return {
          name: row.name,
          amount:
            showAmounts && pkg
              ? scopePackageIndicativePricedAmount(pkg, draft)
              : 0,
        };
      })
      .filter((row) => row.name);
    const representedIds = new Set(
      scopeRows.map((row) => row.id),
    );
    const packageOnlyRows = packages
      .filter(
        (pkg) =>
          !representedIds.has(
            String(pkg.checklistItemId || pkg.costCode || '').trim(),
          ),
      )
      .map((pkg) => ({
        name: String(pkg.name || pkg.scope || 'Scope item').trim(),
        amount: showAmounts ? scopePackageIndicativePricedAmount(pkg, draft) : 0,
      }))
      .filter((row) => row.name);
    return [...checklistRows, ...packageOnlyRows].slice(0, 50);
  }
  if (!scopeRows.length) return [];
  return scopeRows.slice(0, 50).map((row) => ({
    name: row.name,
    amount: 0,
  }));
}

export function shouldDefaultExpandInitialRevealScope(_scopeItemCount: number): boolean {
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
  const useIndicative = roofingRevealHasPlanningInputs(draft) && !draft.scopeAssumptionsConfirmed;
  const needingPrice = pkgs.filter((pkg) => {
    if (useIndicative && scopePackageIndicativePricedAmount(pkg, draft) > 0) return false;
    return scopePackageNeedsManualPrice(pkg, draft);
  });
  const missingPriceCount = options?.missingPriceCount ?? needingPrice.length;
  if (scopeItemCount <= 0 || missingPriceCount <= 0) return null;
  const included = Math.max(0, scopeItemCount - missingPriceCount);
  const names = needingPrice
    .map((pkg) => String(pkg.name || pkg.scope || '').trim())
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
    value.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const tagNorm = norm(tagline);
  return understood.some((line) => {
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
  const level = draft.estimateConfidence?.level as EstimateConfidenceLevel | undefined;
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

/** Top items for the reveal screen — scope/pricing first, admin details later. */
export function getInitialRevealPriorityItems(
  draft: EstimateAiDraft,
  max = 3
): { items: string[]; overflow: number } {
  const { items, overflow } = getCompactStillNeeded(draft, 50);
  const prioritized = filterBathroomRevealAttentionItems(
    draft,
    filterConcreteRevealAttentionItems(
      draft,
      filterPlumbingRevealAttentionItems(
        draft,
        filterRoofingRevealAttentionItems(
          draft,
          [...items]
            .filter((item) => !isInitialRevealBidDetailItem(item))
            .sort((a, b) => revealItemPriority(a) - revealItemPriority(b))
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
  const bullets = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 6);
  const titleNorm = getInitialRevealDisplayTitle(draft).toLowerCase();
  const positive = bullets.find((line) => {
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
    const included =
      draft.scopeChecklist?.items?.filter((item) =>
        revealChecklistItemVisible(draft, item)
      ).length || 0;
    if (included > 0) {
      const notes = String(draft.originalNotes || '').trim();
      const room = inferPlumbingRoomContextFromNotes(notes);
      const roomLabel =
        room === 'kitchen'
          ? 'Kitchen plumbing'
          : room === 'bathroom'
            ? 'Bathroom plumbing'
            : 'Plumbing';
      return `${roomLabel} · ${included} scope line${included === 1 ? '' : 's'}`;
    }
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

export function getInitialRevealUnderstoodBullets(draft: EstimateAiDraft, max = 3): string[] {
  const plumbingMax = isPlumbingRevealDraft(draft)
    ? Math.max(
        max,
        draft.scopeMeasurements?.plumbingRoomContext === 'whole_house' ? 8 : 6
      )
    : max;
  if (isConcreteRevealDraft(draft) && concreteRevealHasPlanningInputs(draft)) {
    const fromNotes = summarizeConcreteNoteBullets(draft.originalNotes || '', max + 3);
    if (fromNotes.length > 0) return fromNotes.slice(0, max);
  }

  if (isPlumbingRevealDraft(draft)) {
    const fromNotes = summarizePlumbingNoteBullets(draft.originalNotes || '', plumbingMax);
    if (fromNotes.length > 0) return fromNotes;
    const fromChecklist = (draft.scopeChecklist?.items || [])
      .filter((item) => revealChecklistItemVisible(draft, item))
      .slice(0, plumbingMax)
      .map((item) => String(item.label || item.id || '').trim())
      .filter(Boolean);
    if (fromChecklist.length > 0) return fromChecklist;
  }

  if (!initialRevealPricingVisible(draft)) {
    const fromChecklist = (draft.scopeChecklist?.items || [])
      .filter((item) => revealChecklistItemVisible(draft, item))
      .map((item) => String(item.label || item.id || '').trim())
      .filter(Boolean);
    if (fromChecklist.length > 0) return fromChecklist.slice(0, max);
  }

  if (
    isRoofingRevealDraft(draft) &&
    roofingRevealHasPlanningInputs(draft) &&
    initialRevealPricingVisible(draft)
  ) {
    const fromPackages = getScopePackagesForReview(draft)
      .map((pkg) => {
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
      .map((pkg) => String(pkg.name || pkg.scope || 'Scope item').trim())
      .filter(Boolean);
    if (fromPackages.length > 0) return fromPackages.slice(0, max);
  }

  const fromAi = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], max + 2)
    .map(plainLanguageReviewItem)
    .filter(
      (line) =>
        !/no material or labor|rates were provided|no pricing was calculated/i.test(line)
    );
  if (fromAi.length > 0) return fromAi.slice(0, max);

  const pkgs = getScopePackagesForReview(draft);
  if (pkgs.length > 0) {
    return pkgs.slice(0, max).map((pkg) => {
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
    initialRevealPricingVisible(draft) &&
    roofingRevealHasPlanningInputs(draft)
      ? sumIndicativeScopePackageTotals(draft)
      : 0;

  const calculatedTotal =
    appliedScopeBreakdown && appliedScopeBreakdown.total > 0
      ? appliedScopeBreakdown.total
      : liveScopeTotal > 0
        ? liveScopeTotal
        : indicativeScopeTotal > 0
          ? indicativeScopeTotal
          : draft.calculatedLineItemTotal ??
            draft.calculatedTotal ??
            draft.totalValidation?.calculatedLineItemsTotal ??
            (pendingTotal > 0 ? pendingTotal : null);

  const scopeBudgetTotals = appliedScopeBreakdown
    ? {
        material: appliedScopeBreakdown.material,
        labor: appliedScopeBreakdown.labor,
        allowance: appliedScopeBreakdown.allowance,
      }
    : scopePackages.reduce(
        (sum, pkg) => {
          const isSoftCost = isSoftCostScopePackage(pkg, draft);
          const breakdown = isSoftCost ? null : resolveScopePackageBudgetBreakdown(pkg, draft);
          const numericAmount = scopePackagePricedAmount(pkg, draft);
          if (numericAmount <= 0) return sum;
          if (isSoftCost || !breakdown) {
            return isSoftCost
              ? { ...sum, allowance: sum.allowance + numericAmount }
              : { ...sum, labor: sum.labor + numericAmount };
          }
          const material = Math.min(breakdown.material, numericAmount);
          const labor = Math.min(breakdown.labor, Math.max(0, numericAmount - material));
          const allowance = Math.max(0, numericAmount - material - labor);
          return {
            material: sum.material + material,
            labor: sum.labor + labor,
            allowance: sum.allowance + allowance,
          };
        },
        { material: 0, labor: 0, allowance: 0 }
      );

  const material = scopeBudgetTotals.material > 0 ? roundedMoney(scopeBudgetTotals.material) : null;
  const labor = scopeBudgetTotals.labor > 0 ? roundedMoney(scopeBudgetTotals.labor) : null;
  const allowance = scopeBudgetTotals.allowance > 0 ? roundedMoney(scopeBudgetTotals.allowance) : null;

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
  return Boolean(draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length);
}

export function draftNeedsScopeConfirmation(draft: EstimateAiDraft | null | undefined): boolean {
  if (!draft || !isComplexEstimateTier(draft)) return false;
  if (draft.scopeAssumptionsConfirmed) return false;
  if (draft.requiresScopeConfirmation) return true;
  // A saved checklist can contain partial in-progress choices. Those are not
  // confirmation just because one or more rows have been touched.
  if (draft.scopeProgressItems?.length) return true;
  return !(draft.confirmedAssumptions?.length);
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
  return getScopePackagesForReview(draft).filter((pkg) => scopePackageNeedsManualPrice(pkg, draft)).length;
}
