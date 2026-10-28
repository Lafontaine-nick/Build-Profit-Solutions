import { filterBathroomRevealAttentionItems } from '@/utils/bathroomPlanningMeasurements';
import {
  concretePatioWithSodAreas,
  notesIgnoringPaverSurfaces,
  notesNameConcretePatioWithSod,
} from '@/utils/foundationPlanningMeasurements';
import {
  alignDedicatedBathroomScopeRows,
  bathroomAffirmativeNotes,
  filterDedicatedBathroomConfirmItems,
  notesNameBathroomFloorRemoval,
  notesNameShowerTileWithFlooring,
  notesReplaceShowerTile,
  showerRemovalItemIdForRevealName,
  showerTileWithFlooringAreas,
  shouldLimitBathroomChecklistToNotes,
} from '@/utils/bathroomNoteScope';
import {
  filterDedicatedKitchenConfirmItems,
  measuredKitchenBathInteriorLines,
  notesDescribeDedicatedKitchenRemodel,
  notesNameKitchenSurfaceInstall,
  shouldLimitKitchenChecklistToNotes,
} from '@/utils/kitchenNoteScope';
import {
  notesNameStuccoWithWindows,
  stuccoWithWindowsRevealRows,
} from '@/utils/stuccoNoteScope';
import { receptaclesWithToiletRevealRows } from '@/utils/electricalNoteScope';
import {
  dedicatedDrywallRevealQuantity,
  notesDescribeNoteRatedDrywallJob,
  notesDescribeSheetrockFinishJob,
  notesUseDedicatedDrywallScope,
  drywallBesideFlooringRevealRows,
} from '@/utils/drywallNoteScope';
import { notesDescribeDrywallAndFlooringJob } from '@/utils/noteScopeLines';
import { separateJobRevealRows } from '@/utils/noteClauseReader';
import { vagueScopeQuestion, vagueScopeTitle } from '@/utils/vagueScopeNote';
import {
  notesDescribeMeasuredWholeHomeRemodel,
  notesNameRemovalOf,
  notesOpeningMentionIsKeepOnly,
  statedCabinetInstallLf,
  wholeHomeRemodelNamedItemIds,
  wholeHomeWallAndAtticInsulationLabel,
} from '@/utils/wholeHomeRemodelNote';
import { notesDoorMentionIsPaintOrKeepOnly } from '@/utils/scopeItemNoteHints';
import { estimatedIceWaterShieldSqft } from '@/utils/roofingPlanningMeasurements';
import { roofCoveringLabelForReveal } from '@/utils/qmScopePanels/simpleTradeRemodel';
import { getQuickMeasurementEstimate } from '@/utils/quickMeasurementEstimates';
import { infersRoofingUnderlaymentUpgradeFromNotes } from '@/utils/scopeItemNoteHints';
import {
  deckInstallMaterialCopy,
  dedicatedDeckRevealQuantity,
  filterDedicatedDeckConfirmItems,
  notesDescribeDedicatedDeckJob,
  selectedDeckInstallMaterial,
} from '@/utils/deckNoteScope';
import {
  dedicatedElectricalRevealLines,
  dedicatedElectricalRevealRows,
  notesDescribeDedicatedElectricalDeviceJob,
} from '@/utils/electricalNoteScope';
import {
  dedicatedWindowsDoorsRevealLines,
  dedicatedWindowsDoorsRevealRows,
  notesDescribeDedicatedWindowsDoorsJob,
} from '@/utils/windowsDoorsNoteScope';
import {
  windowsDoorsPlanFilledCounts,
  windowsDoorsPlanImport,
  windowsDoorsPlanTagline,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import {
  atticInsulationWithDrywallAreas,
  dedicatedInsulationRevealLines,
  dedicatedInsulationRevealRows,
  notesNameAtticInsulationWithDrywallHang,
  notesDescribeDedicatedInsulationJob,
} from '@/utils/insulationNoteScope';
import {
  dedicatedStuccoRevealLines,
  dedicatedStuccoRevealRows,
  notesDescribeDedicatedStuccoJob,
} from '@/utils/stuccoNoteScope';
import {
  areaOnlyAdditionSqft,
  notesDescribeAreaOnlyAddition,
} from '@/utils/additionConversionPlanning';
import {
  AREA_ONLY_BRICK_RATE,
  areaOnlyExteriorCladding,
  areaOnlyExteriorFinishLabel,
  areaOnlyStuccoSystemRate,
  resolveAreaOnlyExteriorFinishes,
  resolveAreaOnlyStuccoSystem,
} from '@/utils/areaOnlyExteriorFinish';
import {
  dedicatedFlooringRevealQuantity,
  filterDedicatedFlooringConfirmItems,
  notesDescribeDedicatedFlooringJob,
} from '@/utils/flooringNoteScope';
import {
  dedicatedPaintingCeilingSqft,
  dedicatedPaintingNamesCeilings,
  dedicatedPaintingNamesWalls,
  dedicatedPaintingRevealQuantity,
  dedicatedPaintingWallSqft,
  notesDescribeDedicatedPaintingJob,
} from '@/utils/paintingNoteScope';
import {
  FRAMING_COVER_SHEET_TAGLINE,
  framingCoverSheetPackage,
  notesFrameExplicitWallArea,
  notesNameDedicatedWallAreaFraming,
  notesNameFramingOnlyAddition,
  notesNameLinearFootStudWall,
  notesNameRoughOpeningsOnly,
  notesNameWallAreaFramingWithFlooring,
  parseFramingMeasurementsFromNotes,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  filterConcreteRevealAttentionItems,
  notesAreImportedPlanSummary,
  notesNameConcreteDecorativeFinish,
  summarizeConcreteNoteBullets,
  concreteRevealHasPlanningInputs,
} from '@/utils/concretePlanningMeasurements';
import {
  formatDraftMoney,
  formatPlanningMoney,
  getScopePackages,
  isComplexEstimateTier,
} from '@/utils/estimateAiDraft';
import type {
  EstimateDraftScopePackage,
  ScopeChecklistItem,
} from '@/utils/estimateAiDraft';
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
  PLUMBING_CARDS,
  plumbingMeasurementKeyForItemId,
  plumbingNoteScopeItemIds,
  plumbingPlanHasPrintedQuantity,
  plumbingPlanLabeledBathNames,
  plumbingUnprintedPlanTagline,
  standalonePlumbingProjectTitle,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  resolveAppliedScopeMoneyTotal,
  sumStep3ReviewBudgetTotals,
  wholeProjectGroupDisplayTotal,
} from '@/utils/benchmarkReasonablenessContext';
import {
  hasAcceptedScopePricing,
  type ScopePricingAcceptanceMetadata,
} from '@/utils/acceptedPricingSummaryUi';
import { resolveAppliedConfirmScopePackageAmount } from '@/utils/appliedScopePackagePricing';
import {
  hasDetailedElectricalTrimDeviceQuantities,
  lightingQuantityDuplicatesRecessedTakeoff,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  confirmScopeDisplayItemsFromDraft,
  getScopePackagesForReview,
  noteMentionsGeneralWallDemolition,
} from '@/utils/scopePackagesForReview';
import {
  clearSupersededStageHostPricing,
  listConfirmScopeAppliedPricingLines,
  mergeConfirmScopeSavedMeasurements,
} from '@/utils/benchmarkReasonablenessContext';
import {
  PLAN_SCOPE_CONFIRM_COUNT_SUFFIX,
  planScopeRecordSummaryLines,
  planScopeRecordsHaveGroundUpAllowances,
} from '@/utils/planScopeRecords';
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
  hvacNotesDropSystemPackage,
  hvacNotesLeaveOptionAlone,
  inferItemStateFromNotes,
  notesDescribeGroundUpHome,
  inferRoofingSystemFromNotes,
  inferRoofingTearOffFromNotes,
  inferRoofingTradeScopeSelectionsFromNotes,
  noteExclusionNotices,
  noteMentionIsOnlyNegated,
  notesAskForPlumbingConnections,
  notesExcludeElectricalServiceUpgrade,
  notesNameAffirmativeDeckOrPatio,
  notesOwnerHandlesScopeCategory,
  parseRoofingDeckingAllowanceFromNotes,
  shouldLimitRoofingChecklistToNotes,
} from '@/utils/scopeItemNoteHints';
import {
  interiorPaintSurfacesAnswered,
  ROOF_TEAR_OFF_CARDS,
} from '@/utils/scopeFoundClarification';
import {
  hvacPlanImportStatesNewBuildSystem,
  NEW_BUILD_HVAC_SYSTEM_ASSUMPTION_COPY,
  notesNameDedicatedHvacEquipmentJob,
  notesNameDedicatedHvacServiceVisit,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import {
  areaOnlyAdditionScopeIds,
  filterRoomRemodelNoteScopeItems,
} from '@/utils/estimateScopeChecklistUi';
import {
  areaOnlyAdditionResolvedQuantity,
  checklistItemInScope,
  getNationalAverageBudgetSplit,
  initialScopeMeasurementInputExtended,
  measuredWholeHomeStatedScopeFill,
  measuredWholeHomeTrimSuggestedFill,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  wallAreaFramingWithFlooringPrices,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  ELECTRICAL_CARDS,
  ELECTRICAL_CARD_GROUPS,
  hasDetailedElectricalQuantities,
  syncElectricalScopeItems,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { unresolvedElectricalConflictFields } from '@/utils/electricalQuickMeasurementUi';
import type { ElectricalCardDefinition } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import type { ScopeItemQuantityValue } from '@/utils/scopeItemQuantities';
import {
  parseInsulationAssembliesFromNotes,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import {
  concreteCoverPatioProvenance,
  confirmedPlanTakeoffLines,
} from '@/utils/planTakeoffReviewUi';
import { drywallCoverSheetPackage } from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  INSULATION_PLAN_FOOTPRINT_TAGLINE,
  insulationPlanFootprintPackage,
} from '@/utils/insulationEnvelopeQuantity';

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
/** A draft summary must not mention paint the note never named. */
/** A stated total is a dollar amount. Inches, counts, and sqft are not totals. */
function notesStateADollarTotal(notes: string | null | undefined): boolean {
  return /\$\s*\d|\b\d[\d,]*(?:\.\d+)?\s*(?:dollars|bucks)\b/i.test(
    String(notes || '')
  );
}

function whatAiDidClaimsUnstatedTotals(
  line: string,
  notes: string | null | undefined
): boolean {
  if (!/preserved (?:your total|\d+ room totals)/i.test(line)) return false;
  const text = String(notes || '').trim();
  if (!text) return false;
  return !notesStateADollarTotal(text);
}

function whatAiDidNamesUnstatedPaint(
  line: string,
  notes: string | null | undefined
): boolean {
  if (/\bpaint(?:ing|ed)?\b/i.test(String(notes || ''))) return false;
  return /\bpaint(?:ing)?\b/i.test(line);
}

/** "Found 1 each for Bathroom" when Bathroom is not a scope line. */
function whatAiDidNamesUnlistedScope(
  line: string,
  draft: EstimateAiDraft
): boolean {
  const match = String(line)
    .trim()
    .match(/^Found\s+.+?\s+for\s+(.+?)\.\s*$/i);
  if (!match) return false;
  const named = match[1].trim().toLowerCase();
  const labels = (draft.scopeChecklist?.items || [])
    .filter(item => String(item.state || 'included') !== 'excluded')
    .map(item => String(item.label || '').trim().toLowerCase())
    .filter(Boolean);
  if (!labels.length) return false;
  return !labels.some(label => label === named);
}

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
  const buckets = collectInitialRevealConfirmItems(draft);
  const notes = draft.originalNotes;
  const pricingScope = buckets.pricingScope.filter(item => {
    if (
      hvacNotesLeaveOptionAlone(notes, 'ductwork') &&
      /\bductwork\b/i.test(item)
    ) {
      return false;
    }
    if (
      hvacNotesDropSystemPackage(notes) &&
      /\bhvac\s+(?:install|work)\b|equipment replacement/i.test(item)
    ) {
      return false;
    }
    if (
      hvacNamedCount(notes, 'thermostats?') != null &&
      !hvacNotesLeaveOptionAlone(notes, 'thermostat') &&
      /\bhvac\s+controls\b|\bthermostats?\b/i.test(item)
    ) {
      return false;
    }
    if (hvacDuctworkFeet(notes) != null && /\bductwork\b/i.test(item)) {
      return false;
    }
    if (
      notesNameDedicatedHvacEquipmentJob(notes) &&
      /\bpric(?:e|ing)\b/i.test(item) &&
      hvacPricedEquipmentAttention(notes, item)
    ) {
      return false;
    }
    if (ownerHandledRevealItem(notes, item)) return false;
    if (
      notesOpeningMentionIsKeepOnly(notes, 'windows') &&
      /\bwindows?\b/i.test(item)
    ) {
      return false;
    }
    if (
      (notesDoorMentionIsPaintOrKeepOnly(notes) ||
        notesOpeningMentionIsKeepOnly(notes, 'doors')) &&
      /\bdoors?\b/i.test(item)
    ) {
      return false;
    }
    if (
      notesDescribeGroundUpHome(notes) &&
      /\bdrywall\s+finish\b/i.test(item)
    ) {
      return false;
    }
    return true;
  });
  const filtered = {
    ...buckets,
    pricingScope: dropPricedRoofingAttention(draft, pricingScope),
  };
  const pricedSelection =
    initialRevealPricingVisible(draft) && draftHasSelectedScopePrices(draft);
  if (!namedScopeReaderOwnsPricing(notes) && !pricedSelection) {
    return appendRevealAttentionExtras(draft, filtered);
  }
  return appendRevealAttentionExtras(draft, {
    ...filtered,
    pricingScope: filtered.pricingScope.filter(
      item => !/\b(?:pric(?:e|ing)|price needed)\b/i.test(item)
    ),
  });
}

function ownerHandledRevealItem(
  notes: string | null | undefined,
  idOrName: string
): boolean {
  const text = String(idOrName || '');
  if (
    notesOwnerHandlesScopeCategory(notes, 'sitework') &&
    /\b(?:sitework|site\s*work|excavation|grading|site\s+prep)\b/i.test(text)
  ) {
    return true;
  }
  if (
    notesOwnerHandlesScopeCategory(notes, 'landscaping') &&
    /\blandscap/i.test(text)
  ) {
    return true;
  }
  if (
    notesOwnerHandlesScopeCategory(notes, 'utilities') &&
    /\butilit/i.test(text)
  ) {
    return true;
  }
  return false;
}

function groundUpLivingRevealLine(
  notes: string | null | undefined
): string | null {
  if (!notesDescribeGroundUpHome(notes)) return null;
  const text = String(notes || '');
  const match = text.match(
    /\b([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b[^.]{0,96}\b(?:two[\s-]?story\s+|single[\s-]?story\s+)?(?:home|house)\b/i
  );
  if (!match) return null;
  const qty = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(qty) || qty < 200) return null;
  const stories = /\btwo[\s-]?story\b/i.test(text)
    ? 'two-story '
    : /\bsingle[\s-]?story\b/i.test(text)
      ? 'single-story '
      : '';
  return `${qty.toLocaleString()} sqft ${stories}home`.trim();
}

function statedGarageSqftFromNotes(notes: string): number | null {
  const after = notes.match(
    /\bgarages?\b(?:\s+area)?\s*(?:is|:|of|=)?\s*([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)/i
  );
  if (after) {
    const sqft = Number(after[1].replace(/,/g, ''));
    if (Number.isFinite(sqft) && sqft >= 100) return sqft;
  }
  const garage = /\bgarages?\b/i.exec(notes);
  if (!garage || garage.index == null) return null;
  const window = notes.slice(Math.max(0, garage.index - 60), garage.index);
  const matches = [
    ...window.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)/gi),
  ];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const token = matches[i];
    const between = window.slice((token.index ?? 0) + token[0].length);
    if (/\b(?:home|house)\b/i.test(between)) continue;
    const sqft = Number(token[1].replace(/,/g, ''));
    if (Number.isFinite(sqft) && sqft >= 100) return sqft;
  }
  return null;
}

function groundUpGarageRevealLine(notes: string): string | null {
  if (!/\bgarages?\b/i.test(notes)) return null;
  const cars = notes.match(/\b(1|one|2|two|3|three)[\s-]?car\b/i);
  const carCount = cars
    ? cars[1].toLowerCase().replace('one', '1').replace('two', '2').replace('three', '3')
    : '';
  const carLabel = carCount ? `${carCount}-car ` : '';
  const garageSqft = statedGarageSqftFromNotes(notes);
  if (garageSqft) {
    return `${Math.round(garageSqft).toLocaleString()} sqft ${carLabel}garage`;
  }
  if (carLabel) return `Attached ${carLabel}garage`;
  return null;
}

function mentionIsAffirmative(notes: string, pattern: RegExp): boolean {
  return pattern.test(notes) && !noteMentionIsOnlyNegated(notes, pattern);
}

function groundUpPatioRevealLine(
  notes: string,
  deckSqft?: number | null
): string | null {
  const coveredPatio = mentionIsAffirmative(notes, /\bcovered\s+patio\b/i);
  const coveredPorch = mentionIsAffirmative(notes, /\bcovered\s+porch\b/i);
  const deck = mentionIsAffirmative(notes, /\bdecks?\b/i);
  const patio = mentionIsAffirmative(notes, /\bpatios?\b/i);
  const porch = mentionIsAffirmative(notes, /\bporches?\b/i);
  if (!coveredPatio && !coveredPorch && !deck && !patio && !porch) return null;
  if (/\bconcrete\s+patio\b/i.test(notes) && !coveredPatio && !deck) return null;
  const kind = coveredPatio
    ? 'covered patio'
    : coveredPorch
      ? 'covered porch'
      : deck
        ? 'deck'
        : patio
          ? 'patio'
          : 'porch';
  if (deckSqft && deckSqft > 0) {
    return `${Math.round(deckSqft).toLocaleString()} sqft ${kind}`;
  }
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function groundUpExteriorFinishRevealLine(notes: string): string | null {
  if (/\bbrick\b/i.test(notes)) return 'Brick exterior';
  if (/\bstucco\b/i.test(notes)) return 'Stucco exterior';
  if (/\b(?:fiber\s*cement|hardie)\b/i.test(notes)) return 'Fiber cement exterior';
  if (/\bvinyl\s+siding\b/i.test(notes)) return 'Vinyl siding';
  if (/\bstone\s+(?:exterior|veneer)\b/i.test(notes)) return 'Stone exterior';
  if (/\bsiding\b/i.test(notes)) return 'Siding';
  return null;
}

/** Garage, patio, and exterior finish the note names, in that order. */
function groundUpNamedRevealLines(notes: string | null | undefined): string[] {
  if (!notesDescribeGroundUpHome(notes)) return [];
  const text = String(notes || '');
  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: 'ground_up',
    projectType: 'new_build',
  });
  return [
    groundUpGarageRevealLine(text),
    groundUpPatioRevealLine(text, parsed.deckSqft),
    groundUpExteriorFinishRevealLine(text),
  ].filter((line): line is string => Boolean(line));
}

function groundUpHomeRevealTitle(draft: EstimateAiDraft): string | null {
  if (noteOwnedRevealSkippedForPlan(draft)) return null;
  const line = groundUpLivingRevealLine(draft.originalNotes);
  if (!line) return null;
  const titled = line.replace(/\bsqft\b/i, 'Sq Ft').replace(/\b[a-z]+/gi, word => {
    if (word === 'Sq' || word === 'Ft') return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  return `New ${titled}`;
}

function hvacDuctworkFeet(notes: string | null | undefined): number | null {
  const text = String(notes || '');
  if (!text.trim() || hvacNotesLeaveOptionAlone(text, 'ductwork')) return null;
  const match = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet))\s+of\s+(?:new\s+)?duct(?:work|s)?\b/i
  );
  if (!match) return null;
  const count = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function hvacPricedEquipmentAttention(
  notes: string | null | undefined,
  item: string
): boolean {
  const text = String(notes || '');
  const priced = [
    ['furnace', /\bfurnaces?\b/i],
    ['condenser', /\bcondensers?\b/i],
    ['heat_pump', /\bheat[\s-]*pumps?\b/i],
    ['air_handler', /\bair\s*handlers?\b/i],
    ['mini_split', /\bmini[\s-]?splits?\b/i],
    ['registers', /\b(?:supply\s+)?registers?\b/i],
    ['returns', /\breturn(?:\s+air)?\s+grilles?\b|\breturns?\b/i],
  ] as const;
  return priced.some(
    ([id, pattern]) =>
      pattern.test(text) &&
      !hvacNotesLeaveOptionAlone(text, id) &&
      pattern.test(item)
  );
}

function hvacReturnGrilleLabel(
  notes: string | null | undefined
): string | null {
  if (
    !notesNameDedicatedHvacEquipmentJob(notes) ||
    hvacNotesLeaveOptionAlone(notes, 'returns')
  ) {
    return null;
  }
  const count = hvacNamedCount(notes, 'return(?:\\s+air)?\\s+grilles?');
  if (count == null) return null;
  return `${count} return grille${count === 1 ? '' : 's'}`;
}

function hvacSupplyRegisterLabel(
  notes: string | null | undefined
): string | null {
  if (
    !notesNameDedicatedHvacEquipmentJob(notes) ||
    hvacNotesLeaveOptionAlone(notes, 'registers')
  ) {
    return null;
  }
  const count = hvacNamedCount(notes, '(?:supply\\s+)?registers?');
  if (count == null) return null;
  return `${count} supply register${count === 1 ? '' : 's'}`;
}

function hvacNamedCount(
  notes: string | null | undefined,
  subject: string
): number | null {
  const match = String(notes || '').match(
    new RegExp(
      `\\b(\\d[\\d,]*(?:\\.\\d+)?|one|two|three|four|five)\\s+${subject}\\b`,
      'i'
    )
  );
  if (!match) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  const count =
    words[match[1].toLowerCase()] || Number(match[1].replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function dedicatedHvacEquipmentScopeLabel(
  notes: string | null | undefined
): string | null {
  const text = String(notes || '');
  if (!notesNameDedicatedHvacEquipmentJob(text)) return null;
  const named = (
    [
      ['air_handler', 'Air handler', /\bair\s*handlers?\b/i],
      ['condenser', 'Condenser', /\bcondensers?\b/i],
      ['furnace', 'Furnace', /\bfurnaces?\b/i],
      ['heat_pump', 'Heat pump', /\bheat[\s-]*pumps?\b/i],
      ['mini_split', 'Mini-split', /\bmini[\s-]?splits?\b/i],
    ] as const
  ).filter(
    ([id, , pattern]) =>
      pattern.test(text) && !hvacNotesLeaveOptionAlone(text, id)
  );
  if (named.length !== 1) return null;
  const [id, label] = named[0];
  const countSubject: Record<string, string> = {
    air_handler: 'air\\s*handlers?',
    condenser: 'condensers?',
    furnace: 'furnaces?',
    heat_pump: 'heat[\\s-]*pumps?',
    mini_split: 'mini[\\s-]?splits?',
  };
  const count = hvacNamedCount(text, countSubject[id] || id);
  if (count != null && count > 1) {
    const plural: Record<string, string> = {
      air_handler: 'air handlers',
      condenser: 'condensers',
      furnace: 'furnaces',
      heat_pump: 'heat pumps',
      mini_split: 'mini-splits',
    };
    return `${count} ${plural[id] || label.toLowerCase()}`;
  }
  return label;
}

function namedScopeReaderOwnsPricing(
  notes: string | null | undefined
): boolean {
  return (
    notesUseDedicatedDrywallScope(notes) ||
    notesDescribeSheetrockFinishJob(notes) ||
    notesDescribeNoteRatedDrywallJob(notes) ||
    notesDescribeDrywallAndFlooringJob(notes) ||
    notesDescribeDedicatedFlooringJob(notes) ||
    notesDescribeDedicatedPaintingJob(notes) ||
    notesDescribeDedicatedDeckJob(notes) ||
    notesDescribeDedicatedElectricalDeviceJob(notes) ||
    notesDescribeDedicatedWindowsDoorsJob(notes) ||
    notesDescribeDedicatedInsulationJob(notes)
  );
}

function areaOnlyAdditionAttention(draft: EstimateAiDraft): string[] {
  const measurements = initialScopeMeasurementInputExtended(draft);
  const filled = (key: string) => {
    const value = Number(
      String(
        (measurements as Record<string, unknown>)[key] ?? ''
      ).replace(/,/g, '')
    );
    return Number.isFinite(value) && value > 0;
  };
  const finishItem = draft.scopeChecklist?.items?.find(
    item => item.id === 'exterior_finishes'
  );
  const finishes = resolveAreaOnlyExteriorFinishes({
    stored: measurements.exteriorFinish,
    storedMany: Array.isArray(measurements.exteriorFinishes)
      ? measurements.exteriorFinishes
      : null,
    choiceId: finishItem?.choiceId,
    choiceIds: finishItem?.choiceIds,
    notes: draft.originalNotes,
  });
  const finish = areaOnlyExteriorCladding(finishes);
  const system = resolveAreaOnlyStuccoSystem({
    finish,
    stored: measurements.exteriorStuccoSystem,
    notes: draft.originalNotes,
  });
  const items: string[] = [];
  if (!finish) items.push('Price needed for Exterior finish');
  else if (finish === 'stucco' && !system) items.push('Price needed for Stucco');
  else if (finish === 'siding') items.push('Price needed for Exterior siding');
  if (!filled('windowCount')) items.push('Price needed for Windows');
  if (!filled('exteriorDoorCount')) items.push('Price needed for Exterior doors');
  if (!filled('interiorDoorCount')) items.push('Price needed for Interior doors');
  if (!filled('baseboardLf')) items.push('Price needed for Interior trim');
  return items;
}

function collectInitialRevealConfirmItems(
  draft: EstimateAiDraft
): InitialRevealConfirmBuckets {
  const vagueQuestion = vagueScopeQuestion(draft.originalNotes);
  if (
    vagueQuestion &&
    !interiorPaintSurfacesAnswered(draft.scopeMeasurements)
  ) {
    return splitInitialRevealConfirmItems([vagueQuestion]);
  }
  const paintingMissing = dedicatedPaintingMissingAreas(draft);
  if (paintingMissing.length > 0) {
    return splitInitialRevealConfirmItems(paintingMissing);
  }
  if (notesDescribeAreaOnlyAddition(draft.originalNotes)) {
    return splitInitialRevealConfirmItems(areaOnlyAdditionAttention(draft));
  }
  if (roofingPlanScopeOwnsReveal(draft)) {
    return splitInitialRevealConfirmItems(
      roofingPlanOnlyExport(draft)
        ? ['Roof surface area / squares: needs measurement']
        : []
    );
  }
  if (stuccoPlanExport(draft)) {
    const gross = positiveRevealNumber(
      (draft.scopeMeasurements as { stuccoGrossWallSqft?: unknown } | null)
        ?.stuccoGrossWallSqft
    );
    return splitInitialRevealConfirmItems(
      gross ? [] : ['Exterior wall area — gross: needs measurement']
    );
  }
  if (
    framingCoverSheetPackage(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return splitInitialRevealConfirmItems([]);
  }
  if (flooringPlanExport(draft)) {
    const flooringRow = flooringPlanScopeRows(draft).find(
      row => row.name === 'Flooring'
    );
    if (flooringRow?.quantity && flooringRow.quantity !== 'Needs measurement') {
      return splitInitialRevealConfirmItems([]);
    }
    return splitInitialRevealConfirmItems(['Flooring: needs measurement']);
  }
  const planPriceLines = confirmedPlanLinesForDraft(draft).filter(
    line =>
      !/spaces detected on the plan/i.test(line) &&
      !/unclassified lighting fixtures/i.test(line)
  );
  // Nothing is priced before Confirm scope, so a whole-house plan only asks
  // for the drawing counts the takeoff left unconfirmed.
  if (wholeHousePlanExport(draft) && draftNeedsScopeConfirmation(draft)) {
    return splitInitialRevealConfirmItems(
      planPriceLines
        .filter(line => line.endsWith(PLAN_SCOPE_CONFIRM_COUNT_SUFFIX))
        .map(line => line.slice(0, -PLAN_SCOPE_CONFIRM_COUNT_SUFFIX.length))
    );
  }
  // A painting plan asks for a price only where the surface has no quantity.
  // Walls, ceilings, trim, and door paint are the bid, not extra checks.
  if (paintingPlanExport(draft) && planTakeoffLinesOwnRevealScope(draft)) {
    return splitInitialRevealConfirmItems(
      planPriceLines
        .filter(line => /Needs SF/i.test(line))
        .map(line => line.replace(/\s*·\s*Needs SF/i, ': needs SF'))
    );
  }
  // After Confirm scope, the applied cards are the scope. Leftover symbol
  // counts (GFCI, switches, ceiling fans) stay off this list.
  if (planTakeoffLinesOwnRevealScope(draft)) {
    if (
      insulationPlanFootprintPackage(
        draft.scopeMeasurements as Record<string, unknown> | null
      )
    ) {
      return splitInitialRevealConfirmItems([]);
    }
    const unpricedPlanPriceLines = planPriceLines.filter(
      line => appliedElectricalPlanLineAmount(draft, line) == null
    );
    if (unpricedPlanPriceLines.length > 0) {
      return splitInitialRevealConfirmItems(
        unpricedPlanPriceLines.map(line => `Pricing for ${line}`)
      );
    }
    if (planPriceLines.length > 0) {
      return splitInitialRevealConfirmItems([]);
    }
  }
  if (plumbingPlanImportReveal(draft)) {
    return splitInitialRevealConfirmItems(plumbingPlanCountAttention(draft));
  }
  const bathroomNoteLimit = shouldLimitBathroomChecklistToNotes({
    notes: draft.originalNotes,
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    scopeMode: draft.scopeMode || draft.classification?.scopeMode || null,
    planBacked: Boolean(
      draft.scopeMeasurements?.planImportMode ||
        draft.scopeMeasurements?.planImportFingerprint
    ),
    wholeHome: notesDescribeMeasuredWholeHomeRemodel(draft.originalNotes),
  });
  if (draftNeedsScopeConfirmation(draft) && bathroomNoteLimit) {
    const packages = getScopePackagesForReview(draft);
    const unpricedScope = getInitialRevealScopeRows(draft).filter(row => {
      const name = String(row.name || '').trim().toLowerCase();
      if (!name) return false;
      // Confirm Scope already has a national average for this line. A known
      // door, toilet, or measured install is not a missing price.
      if (bathroomSuggestedRevealAmount(draft, row.id) > 0) return false;
      const pkg = packages.find(
        item =>
          String(item.name || item.scope || '').trim().toLowerCase() === name
      );
      return !pkg || scopePackageNeedsManualPrice(pkg, draft);
    });
    return splitInitialRevealConfirmItems(
      unpricedScope.map(row => `Pricing for ${row.name}`)
    );
  }
  const kitchenNoteLimit = shouldLimitKitchenChecklistToNotes({
    notes: draft.originalNotes,
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    planBacked: Boolean(
      draft.scopeMeasurements?.planImportMode ||
        draft.scopeMeasurements?.planImportFingerprint
    ),
    wholeHome: notesDescribeMeasuredWholeHomeRemodel(draft.originalNotes),
  });
  if (draftNeedsScopeConfirmation(draft) && kitchenNoteLimit) {
    const packages = getScopePackagesForReview(draft);
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const unpricedScope = getInitialRevealScopeRows(draft).filter(row => {
      const name = String(row.name || '').trim().toLowerCase();
      if (!name) return false;
      const resolved = resolveChecklistItemQuantity(row.id, suggestedMeasurements, {
        templateKey,
        notes,
      });
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      // Confirm Scope already has a national average for this line. Scope
      // found stays unpriced, and the row is not a missing price.
      if (Number(suggested.fill?.total) > 0) return false;
      const pkg = packages.find(
        item =>
          String(item.name || item.scope || '').trim().toLowerCase() === name
      );
      return !pkg || scopePackageNeedsManualPrice(pkg, draft);
    });
    if (unpricedScope.length > 0) {
      return splitInitialRevealConfirmItems(
        unpricedScope.map(row => `Pricing for ${row.name}`)
      );
    }
  }
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesDescribeMeasuredWholeHomeRemodel(draft.originalNotes)
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const unpricedScope = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(
        row.id,
        suggestedMeasurements,
        { templateKey, notes }
      );
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      unpricedScope.map(row => `Pricing for ${row.name}`)
    );
  }
  // Stucco plus a window count already has national averages on Confirm Scope.
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesNameStuccoWithWindows(draft.originalNotes)
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const missing = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(row.id, suggestedMeasurements, {
        templateKey,
        notes,
      });
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      missing.map(row => `Pricing for ${row.name}`)
    );
  }
  if (
    draftNeedsScopeConfirmation(draft) &&
    receptaclesWithToiletRevealRows(draft.originalNotes).length > 0
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const missing = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(row.id, suggestedMeasurements, {
        templateKey,
        notes,
      });
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      missing.map(row => `Pricing for ${row.name}`)
    );
  }
  // Wall framing and LVP are two cards. A known LVP area already has a
  // national price, so Scope found does not ask for it again. Wall framing
  // asks for a price only while the note still has no wall area.
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesNameWallAreaFramingWithFlooring(draft.originalNotes)
  ) {
    if (
      wallAreaFramingWithFlooringPrices(
        draft.originalNotes,
        draft.scopeMeasurements
      )
    ) {
      return splitInitialRevealConfirmItems([]);
    }
    const framingNotes = String(draft.originalNotes || '');
    const storedWall = Number(
      String(draft.scopeMeasurements?.wallFramingSqft ?? '').replace(/,/g, '')
    );
    const wallSqft =
      (Number.isFinite(storedWall) && storedWall > 0 ? storedWall : null) ||
      parseFramingMeasurementsFromNotes(framingNotes).wallFramingSqft;
    return splitInitialRevealConfirmItems(
      wallSqft ? [] : ['Pricing for Wall framing']
    );
  }
  // Shower tile and LVP are different jobs. The LVP area can price. The
  // shower still needs its own square footage.
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesNameShowerTileWithFlooring(draft.originalNotes)
  ) {
    const areas = showerTileWithFlooringAreas(draft.originalNotes);
    const measured = Number(
      String(draft.scopeMeasurements?.showerWallTileSqft ?? '').replace(
        /,/g,
        ''
      )
    );
    const showerSqft =
      areas.showerWallTileSqft ||
      (Number.isFinite(measured) &&
      measured > 0 &&
      measured !== areas.flooringSqft
        ? measured
        : null);
    const attention: string[] = [];
    // Demo and waterproofing price from the shower wall area, so one
    // missing measurement covers those lines.
    if (!showerSqft) attention.push('Pricing for Shower wall tile');
    if (!areas.flooringSqft) {
      if (notesNameBathroomFloorRemoval(draft.originalNotes)) {
        attention.push('Pricing for Bathroom floor demo');
      }
      attention.push('Pricing for LVP flooring');
    }
    return splitInitialRevealConfirmItems(attention);
  }
  // A concrete patio and sod already have areas and national averages on
  // Confirm Scope. The extra flatwork catalog line is the same patio.
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesNameConcretePatioWithSod(draft.originalNotes)
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const missing = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(
        row.id,
        suggestedMeasurements,
        {
          templateKey,
          notes,
        }
      );
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      missing.map(row => `Pricing for ${row.name}`)
    );
  }
  // Attic insulation and a drywall hang already have areas and national
  // averages on Confirm Scope. Scope found stays unpriced, and those rows
  // are not missing prices.
  if (
    draftNeedsScopeConfirmation(draft) &&
    notesNameAtticInsulationWithDrywallHang(draft.originalNotes)
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const missing = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(
        row.id,
        suggestedMeasurements,
        {
          templateKey,
          notes,
        }
      );
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      missing.map(row => `Pricing for ${row.name}`)
    );
  }
  // An unseen mix is one card per named job. A line with a national average
  // is not a missing price. Scope found stays unpriced.
  if (
    draftNeedsScopeConfirmation(draft) &&
    separateJobRevealRows(draft.originalNotes).length > 0
  ) {
    const suggestedMeasurements = initialScopeMeasurementInputExtended(
      draft,
      draft.originalNotes
    );
    const templateKey = draft.scopeChecklist?.templateKey ?? null;
    const notes = String(draft.originalNotes || '');
    const missing = getInitialRevealScopeRows(draft).filter(row => {
      const resolved = resolveChecklistItemQuantity(
        row.id,
        suggestedMeasurements,
        {
          templateKey,
          notes,
        }
      );
      const suggested = resolveScopeItemSuggestedPricing(
        row.id,
        suggestedMeasurements,
        templateKey,
        resolved,
        null,
        null,
        notes
      );
      return !(Number(suggested.fill?.total) > 0);
    });
    return splitInitialRevealConfirmItems(
      missing.map(row => `Pricing for ${row.name}`)
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
  const attention = dropPricedElectricalAttention(
    draft,
    withPlumbingAttention
  ).filter(item => {
    const notes = draft.originalNotes;
    if (
      hvacNotesLeaveOptionAlone(notes, 'ductwork') &&
      /\bductwork\b/i.test(item)
    ) {
      return false;
    }
    if (
      hvacNotesDropSystemPackage(notes) &&
      /\bhvac\s+(?:install|work)\b/i.test(item)
    ) {
      return false;
    }
    if (!notesNameDedicatedHvacServiceVisit(notes)) return true;
    return !/equipment replacement|\bhvac work\b|\bfurnace\b/i.test(item);
  });
  if (notesDescribeAreaOnlyAddition(draft.originalNotes)) {
    return splitInitialRevealConfirmItems(
      attention.filter(item => /window|exterior door|interior trim/i.test(item))
    );
  }
  return splitInitialRevealConfirmItems(attention);
}

export function countInitialRevealAttentionItems(
  draft: EstimateAiDraft
): number {
  return getInitialRevealConfirmItems(draft).pricingScope.length;
}

/** An unanswered Scope found question is one check, same as a missing price. */
export function initialRevealStatusAttentionCount(
  pricingAttentionCount: number,
  clarificationOpen: boolean
): number {
  return pricingAttentionCount + (clarificationOpen ? 1 : 0);
}

function electricalCardForPlanLine(line: string) {
  const label = String(line || '')
    .split(' · ')[0]
    ?.trim()
    .toLowerCase();
  if (!label) return null;
  return (
    ELECTRICAL_CARDS.find(
      card => card.label.trim().toLowerCase() === label
    ) || null
  );
}

/** Applied Confirm Scope dollars for a plan-takeoff line, when that card is already priced. */
function appliedElectricalPlanLineAmount(
  draft: EstimateAiDraft,
  line: string
): number | null {
  const card = electricalCardForPlanLine(line);
  if (!card) return null;
  const measurements = (draft.scopeMeasurements || {}) as {
    itemQuantities?: Record<string, ScopeItemQuantityValue>;
    pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
  };
  const quantities = measurements.itemQuantities || {};
  const acceptance = measurements.pricingAcceptance || {};
  if (!hasAcceptedScopePricing(card.itemId, quantities, acceptance)) return null;
  const amount = resolveAppliedScopeMoneyTotal(
    card.itemId,
    quantities,
    acceptance[card.itemId]
  );
  return amount > 0 ? amount : null;
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
    return planScopeRecordSummaryLines(records, {
      sources: measurements.quickMeasurementSources,
      provenance: (
        measurements as { measurementProvenance?: Record<string, unknown> | null }
      ).measurementProvenance,
    });
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
    provenance: (
      measurements as { measurementProvenance?: Record<string, unknown> | null }
    ).measurementProvenance,
    wholeProject: measurements.planImportMode !== 'selected_trade',
  }).filter(line => !/spaces detected on the plan/i.test(line));
}

/** A general-contractor plan export: whole house, with unprinted trades as allowances. */
function wholeHousePlanExport(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportFingerprint?: string | null;
        planImportMode?: string | null;
        planScopeRecords?: unknown[] | null;
      }
    | null
    | undefined;
  if (!measurements?.planImportFingerprint) return false;
  if (measurements.planImportMode === 'selected_trade') return false;
  return planScopeRecordsHaveGroundUpAllowances(
    measurements.planScopeRecords as never
  );
}

function wholeHousePlanTitle(draft: EstimateAiDraft): string | null {
  if (!wholeHousePlanExport(draft)) return null;
  const living = Number(
    String(draft.scopeMeasurements?.floorAreaSqft ?? '').replace(/,/g, '')
  );
  return Number.isFinite(living) && living > 0
    ? `New home · ${living.toLocaleString()} sqft`
    : 'New home';
}

/** Plan export already lists these quantities under Pricing needed and Scope. */
export function planRevealOmitsWhatWeFound(draft: EstimateAiDraft): boolean {
  return (
    roofingPlanScopeOwnsReveal(draft) ||
    stuccoPlanExport(draft) ||
    flooringPlanExport(draft) ||
    confirmedPlanLinesForDraft(draft).length > 0
  );
}

export function getInitialRevealScopeMetaLabel(
  count: number,
  options?: { planLines?: boolean }
): string {
  if (count <= 0) return '';
  if (options?.planLines) {
    return count === 1 ? '1 plan line' : `${count} plan lines`;
  }
  return count === 1 ? '1 scope item' : `${count} scope items`;
}

/** Whole-house Scope found counts plan lines. Confirm Scope counts the bid. */
export function initialRevealListsPlanLines(draft: EstimateAiDraft): boolean {
  return wholeHousePlanExport(draft);
}

function isPlumbingTemplateDraft(draft: EstimateAiDraft): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return ['plumbing', 'plumbing_service'].includes(templateKey);
}

function isPlumbingRevealDraft(draft: EstimateAiDraft): boolean {
  if (notesNameDedicatedHvacServiceVisit(draft.originalNotes)) return false;
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

/** A roofing plan export. Scope found is the roof, not the story count. */
function roofingPlanScopeOwnsReveal(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportMode?: string | null;
        planImportTradeKey?: string | null;
        planImportFingerprint?: string | null;
      }
    | null
    | undefined;
  return (
    measurements?.planImportMode === 'selected_trade' &&
    measurements?.planImportTradeKey === 'roofing' &&
    Boolean(String(measurements?.planImportFingerprint || '').trim())
  );
}

function roofingPlanOnlyExport(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportMode?: string | null;
        planImportTradeKey?: string | null;
        planImportFingerprint?: string | null;
        roofSquares?: string | number | null;
        roofAreaSqft?: string | number | null;
      }
    | null
    | undefined;
  if (
    measurements?.planImportMode !== 'selected_trade' ||
    measurements?.planImportTradeKey !== 'roofing' ||
    !measurements?.planImportFingerprint
  ) {
    return false;
  }
  if (
    positiveRevealNumber(measurements.roofSquares) ||
    positiveRevealNumber(measurements.roofAreaSqft)
  ) {
    return false;
  }
  const notes = String(draft.originalNotes || '');
  // A plan export can have a generated title or file note without being a
  // note-backed roofing scope. Preserve this dedicated plan-only flow unless
  // the notes explicitly document roofing work.
  return !(
    /\b(?:roof(?:ing)?|shingles?)\b/i.test(notes) &&
    /\b(?:replace|replacement|install|remove|removal|tear[\s-]?off|repair|reroof|squares?|underlayment|flashing|gutters?|vents?)\b/i.test(
      notes
    )
  );
}

function roofCoveringName(draft: EstimateAiDraft): string {
  const item = (draft.scopeChecklist?.items || []).find(
    row => row.id === 'shingles_roofing'
  );
  return roofCoveringLabelForReveal({
    measurements: draft.scopeMeasurements as {
      roofingSystemChoice?: string | null;
    } | null,
    checklistLabel: item?.label,
  });
}

function noteRoofCoveringLabel(notes: string): string {
  const system = inferRoofingSystemFromNotes(notes);
  if (system === 'architectural_shingles') return 'Architectural shingles';
  if (system === 'three_tab_shingles') return '3-tab shingles';
  if (system === 'concrete_clay_tile') return 'Clay tile';
  if (system === 'standing_seam_metal') return 'Standing seam';
  if (system === 'exposed_fastener_metal') return 'Metal panel';
  return 'Roofing system';
}

/** Named re-roof lines for Scope found. Negated accessories stay off this list. */
function dedicatedRoofingNoteRevealRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) {
    return null;
  }
  if (roofingPlanScopeOwnsReveal(draft)) return null;
  const notes = collectRoofingInferenceNotes(draft, draft.originalNotes);
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const planBacked = Boolean(
    measurements.planImportMode ||
      measurements.planImportFingerprint ||
      measurements.planImportSession
  );
  if (
    !shouldLimitRoofingChecklistToNotes({
      notes,
      templateKey: draft.scopeChecklist?.templateKey,
      projectType: draft.projectType,
      scopeMode: draft.scopeMode || draft.classification?.scopeMode || null,
      planBacked,
    })
  ) {
    return null;
  }
  const selected = new Set(inferRoofingTradeScopeSelectionsFromNotes(notes));
  const parsed = parseScopeMeasurementsFromNotes(notes, {
    templateKey: 'roofing',
    projectType: 'roofing',
  });
  const squares =
    positiveRevealNumber(measurements.roofSquares) ||
    positiveRevealNumber(parsed.roofSquares);
  const allowance = parseRoofingDeckingAllowanceFromNotes(notes);
  const tearOff = inferRoofingTearOffFromNotes(notes);
  const statedDripLf = positiveRevealNumber(parsed.roofDripEdgeLf);
  const rows: Array<{ name: string; amount: number; quantity?: string | null }> =
    [];
  if (selected.has('shingles') || selected.has('tear_off')) {
    rows.push({
      name: noteRoofCoveringLabel(notes),
      amount: 0,
      ...(squares
        ? { quantity: `${squares.toLocaleString('en-US')} squares` }
        : {}),
    });
  }
  if (selected.has('tear_off') && tearOff && tearOff !== 'new_construction') {
    const quantity =
      tearOff === 'one_layer'
        ? '1 layer'
        : tearOff === 'two_layers'
          ? '2 layers'
          : tearOff === 'three_plus_custom'
            ? '3+ layers'
            : null;
    rows.push({
      name: 'Existing roof / tear-off',
      amount: 0,
      ...(quantity ? { quantity } : {}),
    });
  }
  if (selected.has('drip_edge')) {
    rows.push({
      name: 'Drip edge',
      amount: 0,
      ...(statedDripLf
        ? { quantity: `${statedDripLf.toLocaleString('en-US')} LF` }
        : {}),
    });
  }
  if (selected.has('decking_repair')) {
    rows.push({
      name: 'Deck repair allowance',
      amount: 0,
      ...(allowance
        ? { quantity: `$${allowance.toLocaleString('en-US')}` }
        : {}),
    });
  }
  if (selected.has('cleanup')) {
    rows.push({ name: 'Cleanup, haul-off & disposal', amount: 0 });
  }
  return rows.length ? rows : null;
}

function appendRevealAttentionExtras(
  draft: EstimateAiDraft,
  buckets: InitialRevealConfirmBuckets
): InitialRevealConfirmBuckets {
  const extras = noteExclusionNotices(draft.originalNotes);
  if (!extras.length) return buckets;
  // Exclusions lead so "not in this bid" is visible before missing prices.
  const pricingScope = [...extras];
  for (const item of buckets.pricingScope) {
    if (pricingScope.some(extra => extra.toLowerCase() === item.toLowerCase())) {
      continue;
    }
    pricingScope.push(item);
  }
  return { ...buckets, pricingScope };
}

function roofingPlanOnlyScopeRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string }> {
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const planFacts =
    measurements.planFacts && typeof measurements.planFacts === 'object'
      ? (measurements.planFacts as Record<string, unknown>)
      : {};
  const pitch = String(
    measurements.roofPitch || planFacts.roofPitch || ''
  ).trim();
  const rows: Array<{ name: string; amount: number; quantity?: string }> = [];
  if (pitch) rows.push({ name: 'Roof pitch', amount: 0, quantity: pitch });
  const squares =
    positiveRevealNumber(measurements.roofSquares) ||
    (() => {
      const area = positiveRevealNumber(measurements.roofAreaSqft);
      return area ? Math.round((area / 100) * 100) / 100 : 0;
    })();
  if (squares) {
    rows.push({
      name: roofCoveringName(draft),
      amount: 0,
      quantity: `${squares.toLocaleString('en-US')} squares`,
    });
  } else {
    rows.push({
      name: 'Roof surface area / squares',
      amount: 0,
      quantity: 'Needs measurement',
    });
  }
  return rows;
}

function stuccoPlanExport(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportMode?: string | null;
        planImportTradeKey?: string | null;
        planImportFingerprint?: string | null;
      }
    | null
    | undefined;
  return (
    measurements?.planImportMode === 'selected_trade' &&
    measurements?.planImportTradeKey === 'stucco' &&
    Boolean(measurements?.planImportFingerprint)
  );
}

function stuccoPlanScopeRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string }> {
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const gross = positiveRevealNumber(measurements.stuccoGrossWallSqft);
  const rows: Array<{ name: string; amount: number; quantity?: string }> = [];
  rows.push({
    name: 'Stucco / exterior wall finish',
    amount: 0,
    quantity: gross ? `${gross.toLocaleString()} sqft` : 'Needs measurement',
  });
  return rows;
}

function flooringPlanExport(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportMode?: string | null;
        planImportTradeKey?: string | null;
        planImportFingerprint?: string | null;
      }
    | null
    | undefined;
  return (
    measurements?.planImportMode === 'selected_trade' &&
    measurements?.planImportTradeKey === 'flooring' &&
    Boolean(measurements?.planImportFingerprint)
  );
}

function flooringPlanScopeRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string }> {
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const productKeys = [
    'flooringLvpSqft',
    'flooringLaminateSqft',
    'flooringEngineeredHardwoodSqft',
    'flooringSolidHardwoodSqft',
    'flooringTileSqft',
    'flooringCarpetSqft',
    'flooringSheetVinylSqft',
  ];
  const productTotal = productKeys.reduce(
    (sum, key) => sum + (positiveRevealNumber(measurements[key]) || 0),
    0
  );
  const flooring = positiveRevealNumber(measurements.flooringSqft);
  const living = positiveRevealNumber(measurements.floorAreaSqft);
  const area = living ?? (productTotal > 0 ? productTotal : flooring);
  return [
    {
      name: 'Flooring',
      amount: 0,
      quantity: area
        ? `${Math.round(area).toLocaleString('en-US')} SF`
        : 'Needs measurement',
    },
  ];
}

const WINDOWS_DOORS_REVEAL_LINES: Array<{
  ids: string[];
  key: 'windowCount' | 'exteriorDoorCount' | 'slidingDoorCount' | 'interiorDoorCount';
  name: string;
}> = [
  { ids: ['windows', 'window_install'], key: 'windowCount', name: 'Windows' },
  {
    ids: ['exterior_doors', 'exterior_door_install'],
    key: 'exteriorDoorCount',
    name: 'Exterior swing doors',
  },
  {
    ids: ['sliding_doors'],
    key: 'slidingDoorCount',
    name: 'Sliding / patio doors',
  },
  {
    ids: ['interior_doors', 'interior_door_install'],
    key: 'interiorDoorCount',
    name: 'Interior doors',
  },
];

/** Plan counts stay on the estimate list before and after Confirm Scope. */
function windowsDoorsPlanRevealRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  const measurements = (draft.scopeMeasurements || null) as Record<
    string,
    unknown
  > | null;
  if (!windowsDoorsPlanImport(measurements)) return null;
  const filled = new Map(
    windowsDoorsPlanFilledCounts(measurements).map(row => [row.key, row.count])
  );
  const showAmounts = showRevealAmounts(draft);
  const packages = showAmounts ? getScopePackagesForReview(draft) : [];
  return WINDOWS_DOORS_REVEAL_LINES.flatMap(line => {
    const count = filled.get(line.key);
    if (!count) return [];
    const pkg = packages.find(candidate =>
      line.ids.includes(
        String(candidate.checklistItemId || candidate.costCode || '').trim()
      )
    );
    const applied = pkg
      ? revealRowAmount(draft, pkg)
      : appliedAliasRevealAmount(draft, line.ids[0]);
    const indicative =
      !(applied > 0) && pkg
        ? scopePackageIndicativePricedAmount(pkg, draft)
        : 0;
    return [
      {
        name: line.name,
        amount: applied > 0 ? applied : indicative,
        quantity: `${count.toLocaleString('en-US')} each`,
      },
    ];
  });
}

/**
 * A dedicated paint note that names walls and ceilings in separate sentences
 * lists each surface. A blank ceiling area stays blank so Scope found can
 * mark it as the thing to check.
 */
function dedicatedPaintingScopeFoundRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  const notes = draft.originalNotes;
  if (!notesDescribeDedicatedPaintingJob(notes)) return null;
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) {
    return null;
  }
  const wallsNamed = dedicatedPaintingNamesWalls(notes);
  const ceilingsNamed = dedicatedPaintingNamesCeilings(notes);
  if (!wallsNamed && !ceilingsNamed) return null;
  // The number has to sit in that surface's own sentence. A stored ceiling
  // area that only repeats the wall sqft is not a ceiling measurement.
  const wallSqft = wallsNamed ? dedicatedPaintingWallSqft(notes) : null;
  const ceilingSqft = ceilingsNamed ? dedicatedPaintingCeilingSqft(notes) : null;
  const rows: Array<{ name: string; amount: number; quantity?: string | null }> =
    [];
  if (wallsNamed) {
    rows.push({
      name: 'Interior wall painting',
      amount: 0,
      ...(wallSqft
        ? { quantity: `${wallSqft.toLocaleString('en-US')} sqft` }
        : {}),
    });
  }
  if (ceilingsNamed) {
    rows.push({
      name: 'Ceiling painting',
      amount: 0,
      ...(ceilingSqft
        ? { quantity: `${ceilingSqft.toLocaleString('en-US')} sqft` }
        : {}),
    });
  }
  return rows.length ? rows : null;
}

function dedicatedPaintingMissingAreas(draft: EstimateAiDraft): string[] {
  if (!draftNeedsScopeConfirmation(draft)) return [];
  const notes = draft.originalNotes;
  if (!notesDescribeDedicatedPaintingJob(notes)) return [];
  const missing: string[] = [];
  if (
    dedicatedPaintingNamesWalls(notes) &&
    dedicatedPaintingWallSqft(notes) == null
  ) {
    missing.push('Interior wall painting');
  }
  if (
    dedicatedPaintingNamesCeilings(notes) &&
    dedicatedPaintingCeilingSqft(notes) == null
  ) {
    missing.push('Ceiling painting');
  }
  return missing;
}

function paintingPlanExport(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | {
        planImportMode?: string | null;
        planImportTradeKey?: string | null;
        planImportFingerprint?: string | null;
      }
    | null
    | undefined;
  return (
    measurements?.planImportMode === 'selected_trade' &&
    measurements?.planImportTradeKey === 'painting' &&
    Boolean(measurements?.planImportFingerprint)
  );
}

const PAINTING_INSTALL_REVEAL_IDS = new Set([
  'exterior_doors',
  'exterior_door_install',
  'interior_doors',
  'interior_door_install',
  'baseboard_install',
  'door_casing_install',
  'window_install',
]);

/**
 * After Confirm Scope, the initial estimate lists the paint lines that were
 * applied. Door installation is not part of a painting bid, and an unpriced
 * prep row is not a second scope item beside those prices.
 */
const COVERED_COMBINED_PAINT_PLACEHOLDER =
  /^(?:interior wall paint|ceiling paint)$/i;

/**
 * Combined walls and ceilings are one priced line. The Scope found
 * placeholders for those surfaces are not a second unpriced row.
 */
export function omitPricedPaintPlaceholders<
  T extends { name: string; amount: number },
>(rows: T[], pricingVisible: boolean): T[] {
  if (!pricingVisible) return rows;
  const ownsCombined = rows.some(
    row =>
      row.amount > 0 &&
      /interior paint/i.test(row.name) &&
      !/\bdoor\b/i.test(row.name)
  );
  if (!ownsCombined) return rows;
  return rows.filter(row => {
    if (row.amount > 0) return true;
    return !COVERED_COMBINED_PAINT_PLACEHOLDER.test(row.name.trim());
  });
}

/** After Confirm Scope, a notes painting bid lists the same priced rows as Step 2. */
function confirmedPaintingNotePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (paintingPlanExport(draft)) return null;
  const template = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (template !== 'painting') return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return null;
  }
  const rows = getScopePackagesForReview(draft).flatMap(pkg => {
    const amount = scopePackagePricedAmount(pkg, draft);
    if (!(amount > 0)) return [];
    const name = String(pkg.name || pkg.scope || '').trim();
    if (!name) return [];
    const quantity = formatScopeQuantity(pkg, draft);
    return [
      {
        name,
        amount,
        ...(quantity ? { quantity } : {}),
      },
    ];
  });
  return rows.length ? rows : null;
}

function appliedPaintingConfirmScopePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (!paintingPlanExport(draft)) return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return null;
  }
  const rows = getScopePackagesForReview(draft)
    .map(pkg => {
      const id = String(pkg.checklistItemId || pkg.costCode || '').trim();
      if (PAINTING_INSTALL_REVEAL_IDS.has(id)) return null;
      const name = String(pkg.name || pkg.scope || '').trim();
      if (!name || /exterior door installation/i.test(name)) return null;
      const amount = scopePackagePricedAmount(pkg, draft);
      if (!(amount > 0)) return null;
      const quantity = formatScopeQuantity(pkg, draft);
      return {
        name,
        amount,
        ...(quantity ? { quantity } : {}),
      };
    })
    .filter(
      (row): row is { name: string; amount: number; quantity?: string | null } =>
        Boolean(row)
    );
  return rows.length ? rows : null;
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

/** National average Confirm Scope will show for a roofing line. */
function roofingSuggestedRevealAmount(
  draft: EstimateAiDraft,
  rowId: string
): number {
  if (!rowId || !isRoofingRevealDraft(draft)) return 0;
  const notes = collectRoofingInferenceNotes(draft, draft.originalNotes);
  const templateKey = draft.scopeChecklist?.templateKey ?? 'roofing';
  const measurements = initialScopeMeasurementInputExtended(draft, notes);
  const storedChoice = String(
    (draft.scopeChecklist?.items || []).find(item => item.id === rowId)
      ?.choiceId ||
      (rowId === 'roofing_system' || rowId === 'shingles_roofing'
        ? measurements.roofingSystemChoice
        : '') ||
      ''
  );
  const inferred =
    rowId === 'roofing_system' || rowId === 'shingles_roofing'
      ? inferRoofingSystemFromNotes(notes)
      : null;
  const choice =
    storedChoice && !['unsure', 'not_in_scope'].includes(storedChoice)
      ? storedChoice
      : inferred;
  if (
    (rowId === 'roofing_system' || rowId === 'shingles_roofing') &&
    (!choice || choice === 'custom_other')
  ) {
    return 0;
  }
  const resolved = resolveChecklistItemQuantity(rowId, measurements, {
    templateKey,
    notes,
    choiceId: choice,
  });
  const suggested = resolveScopeItemSuggestedPricing(
    rowId,
    measurements,
    templateKey,
    resolved,
    null,
    choice,
    notes
  );
  const total = Number(suggested.fill?.total);
  return total > 0 ? Math.round(total * 100) / 100 : 0;
}

/**
 * A roofing line with squares and a national rate is not a missing price.
 * Scope found stays unpriced until Confirm scope.
 */
function dropPricedRoofingAttention(
  draft: EstimateAiDraft,
  items: string[]
): string[] {
  if (!isRoofingRevealDraft(draft) || roofingPlanScopeOwnsReveal(draft)) {
    return items;
  }
  if (!roofingRevealHasPlanningInputs(draft)) return items;
  const pricedNames = getInitialRevealScopeRows(draft)
    .filter(row => roofingSuggestedRevealAmount(draft, row.id) > 0)
    .map(row => row.name.trim().toLowerCase())
    .filter(Boolean);
  if (!pricedNames.length) return items;
  return items.filter(item => {
    const plain = item
      .replace(/^price needed for /i, '')
      .trim()
      .toLowerCase();
    return !pricedNames.some(
      name => plain === name || plain.startsWith(`${name} `)
    );
  });
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
  items = items.filter(item => {
    if (
      noteMentionIsOnlyNegated(notes, /\bhvac\b/i) &&
      /\bhvac\b/i.test(item)
    ) {
      return false;
    }
    if (
      noteMentionIsOnlyNegated(notes, /\bplumb(?:ing)?\b/i) &&
      /\bplumb(?:ing)?\b/i.test(item)
    ) {
      return false;
    }
    if (
      noteMentionIsOnlyNegated(notes, /\bcabinets?\b/i) &&
      /\bcabinets?\b/i.test(item)
    ) {
      return false;
    }
    return true;
  });
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

function confirmedWholeHousePlan(draft: EstimateAiDraft): boolean {
  return (
    wholeHousePlanExport(draft) &&
    Boolean(draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length)
  );
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
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const quantityRecord =
    measurements.itemQuantities &&
    typeof measurements.itemQuantities === 'object' &&
    !Array.isArray(measurements.itemQuantities)
      ? (measurements.itemQuantities as Record<string, { quantity?: unknown; unit?: unknown }>)
      : {};
  if (
    item.id === 'lighting' &&
    lightingQuantityDuplicatesRecessedTakeoff(measurements) &&
    (String(draft.scopeChecklist?.templateKey || draft.projectType || '').toLowerCase() ===
      'ground_up' ||
      Number(quantityRecord.electrical_recessed_light?.quantity) > 0)
  ) {
    return false;
  }
  if (
    item.id === 'electrical_trim' &&
    hasDetailedElectricalTrimDeviceQuantities(measurements)
  ) {
    return false;
  }
  const acceptedWholeHouseAllowance =
    confirmedWholeHousePlan(draft) &&
    hasAcceptedScopePricing(
      item.id,
      quantityRecord as never,
      measurements.pricingAcceptance as never
    );
  if (!checklistItemInScope(item) && !acceptedWholeHouseAllowance) return false;
  if (
    item.id === 'grading' &&
    inferItemStateFromNotes('grading', draft.originalNotes) !== 'included'
  ) {
    return false;
  }
  if (ownerHandledRevealItem(draft.originalNotes, item.id)) return false;
  if (
    item.id === 'decorative_finish' &&
    !notesNameConcreteDecorativeFinish(draft.originalNotes)
  ) {
    return false;
  }
  if (
    item.id === 'hvac' &&
    String(
      (draft.scopeMeasurements as { planImportTradeKey?: string } | null)
        ?.planImportTradeKey || ''
    ) !== 'hvac' &&
    /\b(?:heat[\s-]*pumps?|furnaces?|condensers?|air\s*handlers?|mini[\s-]?splits?)\b/i.test(
      String(draft.originalNotes || '')
    )
  ) {
    return false;
  }
  if (
    item.id === 'ductwork' &&
    hvacNotesLeaveOptionAlone(draft.originalNotes, 'ductwork')
  ) {
    return false;
  }
  if (item.id === 'hvac' && hvacNotesDropSystemPackage(draft.originalNotes)) {
    return false;
  }
  if (
    notesNameDedicatedHvacServiceVisit(draft.originalNotes) &&
    (item.id === 'equipment_replace' ||
      item.id === 'hvac' ||
      item.id === 'heat_pump' ||
      item.id === 'furnace')
  ) {
    return false;
  }
  if (
    (item.id === 'equipment_replace' ||
      item.id === 'hvac' ||
      item.id === 'heat_pump' ||
      item.id === 'furnace') &&
    hvacNotesLeaveOptionAlone(draft.originalNotes, item.id)
  ) {
    return false;
  }
  const revealTemplate = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (revealTemplate === 'painting') {
    const paintingNotes = String(draft.originalNotes || '');
    const deniesCeilings =
      /\b(?:no|not|without|don'?t|do not)\s+(?:the\s+)?ceilings?\b/i.test(
        paintingNotes
      );
    const deniesDoors =
      /\b(?:no|not|without|don'?t|do not)\s+(?:the\s+)?(?:interior\s+)?doors?\b/i.test(
        paintingNotes
      );
    const deniesCabinets =
      /\b(?:no|not|without|don'?t|do not)\s+(?:the\s+)?cabinets?\b/i.test(
        paintingNotes
      );
    const mentionsTrim =
      /\b(?:baseboards?|casings?|interior\s+trim|door\s+trim)\b/i.test(
        paintingNotes
      );
    const mentionsWindowTrim = /\bwindow\s+trim\b|\bwindows?\b/i.test(
      paintingNotes
    );
    if (deniesCeilings && item.id === 'ceiling_paint') return false;
    if (
      deniesDoors &&
      (item.id === 'door_paint' ||
        item.id === 'door_casing_paint' ||
        item.id === 'interior_door_install')
    ) {
      return false;
    }
    if (deniesCabinets && item.id === 'cabinet_paint') return false;
    if (
      !mentionsTrim &&
      (item.id === 'trim_paint' || item.id === 'baseboard_install')
    ) {
      return false;
    }
    if (!mentionsWindowTrim && item.id === 'exterior_trim_paint') return false;
  }
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

/** Plan takeoff lines are the scope list only before Confirm scope. */
function planTakeoffLinesOwnRevealScope(draft: EstimateAiDraft): boolean {
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) {
    return false;
  }
  return confirmedPlanLinesForDraft(draft).length > 0;
}

function electricalConfirmScopeIsSource(draft: EstimateAiDraft): boolean {
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return false;
  }
  const template = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  const trade = String(
    (draft.scopeMeasurements as { planImportTradeKey?: string } | null)
      ?.planImportTradeKey || ''
  ).toLowerCase();
  return template === 'electrical' || trade === 'electrical';
}

function electricalMeasurementNeedsConfirmation(
  measurements: Record<string, unknown>,
  key: string
): boolean {
  const overrides = measurements.quickMeasurementUserOverrides;
  if (
    overrides &&
    typeof overrides === 'object' &&
    !Array.isArray(overrides) &&
    (overrides as Record<string, unknown>)[key]
  ) {
    return false;
  }
  const sources = measurements.quickMeasurementSources;
  if (!sources || typeof sources !== 'object' || Array.isArray(sources)) {
    return false;
  }
  return (sources as Record<string, unknown>)[key] === 'needs_confirmation';
}

function electricalCardCount(
  card: ElectricalCardDefinition,
  measurements: Record<string, unknown>
): number | null {
  const itemQuantities =
    measurements.itemQuantities &&
    typeof measurements.itemQuantities === 'object' &&
    !Array.isArray(measurements.itemQuantities)
      ? (measurements.itemQuantities as Record<string, { quantity?: unknown }>)
      : {};
  const scalar = Number(
    String(measurements[card.measurementKey] ?? '').replace(/,/g, '')
  );
  const itemQuantity = Number(
    String(itemQuantities[card.itemId]?.quantity ?? '').replace(/,/g, '')
  );
  const value = scalar > 0 ? scalar : itemQuantity;
  return value > 0 && card.unit !== 'amp' ? value : null;
}

function formatElectricalCardQuantity(
  card: ElectricalCardDefinition,
  measurements: Record<string, unknown>
): string | null {
  const value = electricalCardCount(card, measurements);
  if (value == null) return null;
  const formatted = value.toLocaleString();
  return card.unit === 'lf' ? `${formatted} LF` : `${formatted} each`;
}

function formatElectricalGroupQuantity(
  cards: ElectricalCardDefinition[],
  measurements: Record<string, unknown>
): string | null {
  if (cards.length === 1) {
    return formatElectricalCardQuantity(cards[0], measurements);
  }
  const units = new Set(cards.map(card => card.unit));
  if (units.size === 1 && !units.has('amp')) {
    const total = cards.reduce(
      (sum, card) => sum + (electricalCardCount(card, measurements) || 0),
      0
    );
    if (total > 0) {
      const unit = units.has('lf') ? 'LF' : 'each';
      return `${total.toLocaleString()} ${unit}`;
    }
  }
  return null;
}

function electricalCardMoney(
  draft: EstimateAiDraft,
  card: ElectricalCardDefinition,
  measurements: ScopeMeasurementsInputExtended,
  templateKey: string,
  notes: string
): number {
  const quantities = measurements.itemQuantities || {};
  const acceptance = measurements.pricingAcceptance || {};
  if (hasAcceptedScopePricing(card.itemId, quantities, acceptance)) {
    const applied = resolveAppliedScopeMoneyTotal(
      card.itemId,
      quantities,
      acceptance[card.itemId]
    );
    if (applied > 0) return applied;
  }
  const packaged = getScopePackages(draft).find(
    row => String(row.checklistItemId || '').trim() === card.itemId
  );
  const packagedAmount = packaged
    ? scopePackagePricedAmount(packaged, draft)
    : 0;
  if (packagedAmount > 0) return packagedAmount;
  const suggested = wholeProjectGroupDisplayTotal({
    items: [
      {
        id: card.itemId,
        label: card.label,
        state: 'included',
        inputType: 'yes_no',
      } as ScopeChecklistItem,
    ],
    measurements,
    templateKey,
    notes,
  });
  return suggested > 0 ? suggested : 0;
}

/** Confirm-scope card groups and dollars for Initial estimate and Step 3. */
export function getElectricalConfirmScopeCardRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  return appliedElectricalConfirmScopePreview(draft);
}

function appliedElectricalConfirmScopePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (!electricalConfirmScopeIsSource(draft)) return null;
  const notes = String(draft.originalNotes || '');
  // Confirm scope prices the saved measurements. The normalized reveal input
  // drops electrical device counts, which made these rows disagree with the cards.
  const measurements = {
    ...(draft.scopeMeasurements || {}),
  } as ScopeMeasurementsInputExtended;
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || 'electrical'
  );
  const measurementRecord = measurements as Record<string, unknown>;
  const synced = syncElectricalScopeItems(draft.scopeChecklist?.items || [], {
    templateKey,
    projectType: draft.projectType,
    notes,
    electricalScope: measurements.electricalScope,
    quantities: measurements,
  });
  const includedIds = new Set(
    synced.filter(item => item.state === 'included').map(item => item.id)
  );
  const unresolved = unresolvedElectricalConflictFields(
    measurements.measurementConflicts || []
  );
  const selected = ELECTRICAL_CARDS.filter(card => {
    if (!includedIds.has(card.itemId)) return false;
    if (
      electricalMeasurementNeedsConfirmation(
        measurementRecord,
        card.measurementKey
      )
    ) {
      return false;
    }
    if (unresolved.has(card.measurementKey)) return false;
    return true;
  });
  if (!selected.length) return null;
  const rows = ELECTRICAL_CARD_GROUPS.flatMap(group => {
    const cards = selected.filter(card => card.groupId === group.id);
    if (!cards.length) return [];
    const amount = cards.reduce(
      (total, card) =>
        total +
        electricalCardMoney(draft, card, measurements, templateKey, notes),
      0
    );
    if (!(amount > 0)) return [];
    const quantity = formatElectricalGroupQuantity(cards, measurementRecord);
    return [
      {
        name: group.title,
        amount: Math.round(amount * 100) / 100,
        ...(quantity ? { quantity } : {}),
      },
    ];
  });
  return rows.length ? rows : null;
}

function dropPricedElectricalAttention(
  draft: EstimateAiDraft,
  items: string[]
): string[] {
  const rows = appliedElectricalConfirmScopePreview(draft);
  if (!rows?.length) return items;
  const pricedLabels = ELECTRICAL_CARDS.filter(card =>
    rows.some(row => row.name === card.groupTitle && row.amount > 0)
  ).map(card => card.label.trim().toLowerCase());
  if (!pricedLabels.length) return items;
  return items.filter(item => {
    const plain = item.toLowerCase();
    if (!/price needed|pricing for/.test(plain)) return true;
    return !pricedLabels.some(label => plain.includes(label));
  });
}

function noteOwnedRevealSkippedForPlan(draft: EstimateAiDraft): boolean {
  return Boolean(
    draft.scopeMeasurements?.planImportMode ||
      draft.scopeMeasurements?.planImportFingerprint
  );
}

function electricalDeviceNoteOwnsReveal(draft: EstimateAiDraft): boolean {
  if (noteOwnedRevealSkippedForPlan(draft)) return false;
  return notesDescribeDedicatedElectricalDeviceJob(draft.originalNotes);
}

function windowsDoorsNoteOwnsReveal(draft: EstimateAiDraft): boolean {
  if (noteOwnedRevealSkippedForPlan(draft)) return false;
  return notesDescribeDedicatedWindowsDoorsJob(draft.originalNotes);
}

function insulationNoteOwnsReveal(draft: EstimateAiDraft): boolean {
  if (noteOwnedRevealSkippedForPlan(draft)) return false;
  return notesDescribeDedicatedInsulationJob(draft.originalNotes);
}

function stuccoNoteOwnsReveal(draft: EstimateAiDraft): boolean {
  if (noteOwnedRevealSkippedForPlan(draft)) return false;
  return notesDescribeDedicatedStuccoJob(draft.originalNotes);
}

function countInitialRevealScopeItems(draft: EstimateAiDraft): number {
  if (vagueScopeQuestion(draft.originalNotes)) return 0;
  const roofingApplied = appliedRoofingConfirmScopePreview(draft);
  if (roofingApplied.length) return roofingApplied.length;
  const paintingApplied = appliedPaintingConfirmScopePreview(draft);
  if (paintingApplied) return paintingApplied.length;
  const paintingNotes = confirmedPaintingNotePreview(draft);
  if (paintingNotes) return paintingNotes.length;
  const windowsDoorsPlan = windowsDoorsPlanRevealRows(draft);
  if (windowsDoorsPlan) return windowsDoorsPlan.length;
  if (electricalDeviceNoteOwnsReveal(draft)) {
    return dedicatedElectricalRevealRows(draft.originalNotes).length;
  }
  if (windowsDoorsNoteOwnsReveal(draft)) {
    return dedicatedWindowsDoorsRevealRows(draft.originalNotes).length;
  }
  if (insulationNoteOwnsReveal(draft)) {
    return dedicatedInsulationRevealRows(draft.originalNotes).length;
  }
  if (stuccoNoteOwnsReveal(draft)) {
    return dedicatedStuccoRevealRows(draft.originalNotes).length;
  }
  if (notesDescribeAreaOnlyAddition(draft.originalNotes)) {
    return areaOnlyAdditionRevealRows(draft)?.length || 0;
  }
  if (roofingPlanScopeOwnsReveal(draft)) {
    return roofingPlanOnlyScopeRows(draft).length;
  }
  if (stuccoPlanExport(draft)) {
    return stuccoPlanScopeRows(draft).length;
  }
  if (flooringPlanExport(draft)) {
    return flooringPlanScopeRows(draft).length;
  }
  const appliedElectrical = appliedElectricalConfirmScopePreview(draft);
  if (appliedElectrical) return appliedElectrical.length;
  const planLines = confirmedPlanLinesForDraft(draft);
  if (planTakeoffLinesOwnRevealScope(draft) && planLines.length > 0) {
    return planLines.length;
  }
  if (groundUpLivingRevealLine(draft.originalNotes)) {
    const previewCount = getInitialRevealChecklistScopePreview(draft).length;
    if (previewCount > 0) return previewCount;
  }
  if (plumbingPlanImportReveal(draft)) {
    return getInitialRevealChecklistScopePreview(draft).length;
  }
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

function plumbingPlanImportReveal(draft: EstimateAiDraft): boolean {
  const measurements = draft.scopeMeasurements as
    | { planImportTradeKey?: string | null; planImportMode?: string | null }
    | null
    | undefined;
  return (
    measurements?.planImportTradeKey === 'plumbing' &&
    measurements?.planImportMode === 'selected_trade'
  );
}

function plumbingPlanRooms(
  draft: EstimateAiDraft
): Array<{ name?: string | null }> {
  const measurements = draft.scopeMeasurements as
    | { planRooms?: Array<{ name?: string | null }> }
    | null
    | undefined;
  if (measurements?.planRooms?.length) return measurements.planRooms;
  return draft.rooms || [];
}

function plumbingPlanAwaitsContractorCounts(draft: EstimateAiDraft): boolean {
  return (
    plumbingPlanImportReveal(draft) &&
    !plumbingPlanHasPrintedQuantity(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  );
}

function plumbingPlanCountAttention(draft: EstimateAiDraft): string[] {
  if (!plumbingPlanImportReveal(draft)) return [];
  // The new-home cards stay on with blank quantities. That is the contractor's entry, not a missed count.
  return [];
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

function appendNamedRoofingRevealRows(
  draft: EstimateAiDraft,
  rows: InitialRevealScopeRow[]
): InitialRevealScopeRow[] {
  const template = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (template !== 'roofing') return rows;
  const notes = String(draft.originalNotes || '');
  if (!notes.trim()) return rows;
  const next = rows.map(row => ({ ...row }));
  const squaresMatch = notes.match(
    /\b(\d[\d,]*(?:\.\d+)?)[\s-]*(?:roofing\s+)?squares?\b/i
  );
  const squares = squaresMatch
    ? Number(String(squaresMatch[1]).replace(/,/g, ''))
    : 0;
  const hasRow = (id: string, nameRe: RegExp) =>
    next.some(row => row.id === id || nameRe.test(row.name));

  if (infersRoofingUnderlaymentUpgradeFromNotes(notes) && squares > 0) {
    const idx = next.findIndex(
      row => row.id === 'underlayment' || /\bunderlayment\b/i.test(row.name)
    );
    if (idx >= 0 && !next[idx].quantityOverride) {
      next[idx] = {
        ...next[idx],
        quantityOverride: `${Math.round(squares * 100)} sqft`,
      };
    }
  }

  const namesIce =
    /\b(?:ice\s*[&/-]\s*water|ice\s+and\s+water|ice\s*barrier|eaves?\s+protection|ice[\s-]?water\s+shield)\b/i.test(
      notes
    );
  if (namesIce && !hasRow('ice_water_shield', /\bice\b/i)) {
    const iceSqft = squares > 0 ? estimatedIceWaterShieldSqft(squares) : 0;
    next.push({
      id: 'ice_water_shield',
      name: 'Ice & water shield',
      ...(iceSqft > 0 ? { quantityOverride: `${iceSqft} sqft` } : {}),
    });
  } else if (namesIce && squares > 0) {
    const idx = next.findIndex(
      row => row.id === 'ice_water_shield' || /\bice\b/i.test(row.name)
    );
    if (idx >= 0 && !next[idx].quantityOverride) {
      next[idx] = {
        ...next[idx],
        quantityOverride: `${estimatedIceWaterShieldSqft(squares)} sqft`,
      };
    }
  }

  if (
    /\bpipe\s+boots?\b/i.test(notes) &&
    !hasRow('pipe_boots', /\bpipe\s+boots?\b/i)
  ) {
    const countMatch = notes.match(/\b(\d+)\s+pipe\s+boots?\b/i);
    const count = countMatch ? Number(countMatch[1]) : 1;
    next.push({
      id: 'pipe_boots',
      name: 'Pipe boots',
      quantityOverride: `${count} each`,
    });
  }

  const withoutNegatedGutters = noteMentionIsOnlyNegated(notes, /\bgutters?\b/i)
    ? next.filter(row => row.id !== 'gutters' && !/^gutters$/i.test(row.name))
    : next;
  if (squares > 0) {
    const roofIdx = withoutNegatedGutters.findIndex(
      row =>
        row.id === 'roofing_system' ||
        row.id === 'shingles_roofing' ||
        /roofing system|architectural shingles|shingles/i.test(row.name)
    );
    if (roofIdx >= 0 && !withoutNegatedGutters[roofIdx].quantityOverride) {
      withoutNegatedGutters[roofIdx] = {
        ...withoutNegatedGutters[roofIdx],
        quantityOverride: `${squares.toLocaleString('en-US')} squares`,
      };
    }
  }
  const selected = new Set(inferRoofingTradeScopeSelectionsFromNotes(notes));
  const hasNamedRow = (id: string, nameRe: RegExp) =>
    withoutNegatedGutters.some(row => row.id === id || nameRe.test(row.name));
  if (selected.has('tear_off') && !hasNamedRow('tear_off', /tear-?off/i)) {
    const tearOff = inferRoofingTearOffFromNotes(notes);
    const quantity =
      tearOff === 'one_layer'
        ? '1 layer'
        : tearOff === 'two_layers'
          ? '2 layers'
          : tearOff === 'three_plus_custom'
            ? '3+ layers'
            : null;
    withoutNegatedGutters.push({
      id: 'tear_off',
      name: 'Existing roof / tear-off',
      ...(quantity ? { quantityOverride: quantity } : {}),
    });
  }
  if (selected.has('drip_edge') && !hasNamedRow('drip_edge', /drip edge/i)) {
    withoutNegatedGutters.push({ id: 'drip_edge', name: 'Drip edge' });
  }
  if (
    selected.has('decking_repair') &&
    !hasNamedRow('decking_repair', /deck repair|decking/i)
  ) {
    const allowance = parseRoofingDeckingAllowanceFromNotes(notes);
    withoutNegatedGutters.push({
      id: 'decking_repair',
      name: 'Deck repair allowance',
      ...(allowance
        ? { quantityOverride: `$${allowance.toLocaleString('en-US')}` }
        : {}),
    });
  }

  return withoutNegatedGutters;
}

function dropUnstatedDoorAndTrimPaint<T extends { id: string; name: string }>(
  rows: T[],
  notes: string
): T[] {
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
  return rows.filter(row => {
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

function notesDescribeMeasuredKitchenAndBathInterior(
  notes?: string | null
): boolean {
  return measuredKitchenBathInteriorLines(notes) != null;
}

/** Named kitchen and hall-bath takeoff. Not a bathroom-only checklist. */
function measuredKitchenBathInteriorRevealRows(
  notes?: string | null
): InitialRevealScopeRow[] | null {
  const lines = measuredKitchenBathInteriorLines(notes);
  if (!lines) return null;
  return lines.map(line => ({
    id: line.id,
    name: line.name,
    ...(line.quantity ? { quantityOverride: line.quantity } : {}),
  }));
}

function getInitialRevealScopeRows(
  draft: EstimateAiDraft
): InitialRevealScopeRow[] {
  const notes = String(draft.originalNotes || '');
  const kitchenBathRows = measuredKitchenBathInteriorRevealRows(notes);
  if (kitchenBathRows) return kitchenBathRows;
  const stuccoWindowsRows = stuccoWithWindowsRevealRows(notes);
  if (stuccoWindowsRows.length > 0) {
    return stuccoWindowsRows.map(row => ({
      id: row.id,
      name: row.name,
      ...(row.quantity ? { quantityOverride: row.quantity } : {}),
    }));
  }
  const receptacleToiletRows = receptaclesWithToiletRevealRows(notes);
  if (receptacleToiletRows.length > 0) {
    return receptacleToiletRows.map(row => ({
      id: row.id,
      name: row.name,
      ...(row.quantity ? { quantityOverride: row.quantity } : {}),
    }));
  }
  const drywallFloorRows = drywallBesideFlooringRevealRows(notes);
  if (drywallFloorRows.length > 0) {
    return drywallFloorRows.map(row => ({
      id: row.id,
      name: row.name,
      ...(row.quantity ? { quantityOverride: row.quantity } : {}),
    }));
  }
  const separateJobRows = separateJobRevealRows(notes);
  if (separateJobRows.length > 0) {
    return separateJobRows.map(row => ({
      id: row.id,
      name: row.name,
      ...(row.quantity ? { quantityOverride: row.quantity } : {}),
    }));
  }
  const wholeHomeMixedRemodelNote = notesDescribeMeasuredWholeHomeRemodel(notes);
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
  const dedicatedDrywallNote =
    notesUseDedicatedDrywallScope(notes) ||
    notesDescribeSheetrockFinishJob(notes);
  const noteRatedDrywallNote = notesDescribeNoteRatedDrywallJob(notes);
  const dedicatedFlooringNote = notesDescribeDedicatedFlooringJob(notes);
  const dedicatedPaintingNote = notesDescribeDedicatedPaintingJob(notes);
  const dedicatedDeckNote = notesDescribeDedicatedDeckJob(notes);
  const parsedDedicatedDrywallMeasurements = dedicatedDrywallNote
    ? initialScopeMeasurementInputExtended(draft, notes)
    : null;
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
    /\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?))\b|\b(?:shower(?:\s+(?:wall|floor))?\s+tile|tile\s+shower|shower\s+(?:pan|base|liner|surround|walls?))\b[^.;\n]{0,80}\b(?:remove|removal|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i.test(
      notes
    );
  const explicitCountertop =
    /\b(?:countertops?|counters?|quartz|granite|tops)\b/i.test(notes);
  const cabinetInstallLf = statedCabinetInstallLf(notes);
  const explicitCabinetLfMatch = cabinetInstallLf
    ? [null, String(cabinetInstallLf)]
    : null;
  const plumbingRerouteMatch =
    /\b(?:reroute|re-route|relocat(?:e|ed|ing|ion))\b[^.;\n]{0,30}\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b[^.;\n]{0,35}\bplumb(?:ing)?\b|\bplumb(?:ing)?\b[^.;\n]{0,35}\b(?:reroute|re-route|relocat(?:e|ed|ing|ion))\b[^.;\n]{0,30}\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b/i.exec(
      notes
    );
  const plumbingRerouteLf =
    plumbingRerouteMatch?.[1] || plumbingRerouteMatch?.[2];
  const explicitFlooringDemo = notesNameRemovalOf(
    notes,
    'floor(?:ing)?|lvp|laminate|vinyl|carpet|tile'
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
  const namedEquipmentLabel = dedicatedHvacEquipmentScopeLabel(notes);
  const displayNameForScopeRow = (id: string, name: string) =>
    id === 'service_call' && notesNameDedicatedHvacServiceVisit(notes)
      ? 'HVAC service call'
      : (id === 'equipment_replace' || id === 'furnace') && namedEquipmentLabel
        ? namedEquipmentLabel
      : (id === 'returns' || id === 'return_grilles') &&
          hvacReturnGrilleLabel(notes)
        ? hvacReturnGrilleLabel(notes)
      : (id === 'registers' || id === 'supply_registers') &&
          hvacSupplyRegisterLabel(notes)
        ? hvacSupplyRegisterLabel(notes)
      : id === 'ductwork' && hvacDuctworkFeet(notes) != null
        ? `${hvacDuctworkFeet(notes)} LF ductwork`
      : id === 'thermostat' &&
          hvacNamedCount(notes, 'thermostats?') != null &&
          !hvacNotesLeaveOptionAlone(notes, 'thermostat')
        ? `${hvacNamedCount(notes, 'thermostats?')} thermostat${
            hvacNamedCount(notes, 'thermostats?') === 1 ? '' : 's'
          }`
      : additionReveal && id === 'windows_doors'
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
    const framedFromNotes = parseFramingMeasurementsFromNotes(notes);
    const stated = (value: unknown, fallback?: unknown) =>
      positiveRevealNumber(value) ?? positiveRevealNumber(fallback);
    const sqft = (value: unknown) => {
      const quantity = positiveRevealNumber(value);
      return quantity ? `${quantity} sqft` : null;
    };
    const each = (value: unknown) => {
      const quantity = positiveRevealNumber(value);
      return quantity ? `${quantity} each` : null;
    };
    if (id === 'flooring') return sqft(measurements.flooringSqft);
    if (id === 'framing' || id === 'wall_framing') {
      return (
        sqft(stated(measurements.wallFramingSqft, framedFromNotes.wallFramingSqft)) ??
        undefined
      );
    }
    if (id === 'shear_sheathing') {
      return (
        sqft(stated(measurements.sheathingSqft, framedFromNotes.sheathingSqft)) ??
        undefined
      );
    }
    if (id === 'openings') {
      return (
        each(
          stated(
            measurements.framingOpeningCount,
            framedFromNotes.framingOpeningCount
          )
        ) ?? undefined
      );
    }
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
      return sqft(measurements.drywallSqft ?? measurements.patchRepairSqft);
    }
    if (id === 'patch_repair') {
      return sqft(measurements.patchRepairSqft);
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
        /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;,\n]{0,40}\b(?:wall|walls|attic|ceiling|floor)\b[^.;,\n]{0,20}\binsulat(?:e|ion|ed)\b|\binsulat(?:e|ion|ed)\b[^.;,\n]{0,80}\b(?:wall|walls|attic|ceiling|floor)\b|\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+of\s+(?:the\s+)?(?:attic|ceiling|wall|walls|floor)\b/i.test(
          notes
        );
      if (!hasLocationSpecificInsulationArea) {
        if (
          notesFrameExplicitWallArea(notes) &&
          /\b(?:insulat(?:e|ed|ion)|R[-\s]?\d{2,3})\b/i.test(notes)
        ) {
          return sqft(measurements.exteriorWallInsulationSqft);
        }
        return null;
      }
      const quantity =
        positiveRevealNumber(measurements.exteriorWallInsulationSqft) ||
        positiveRevealNumber(measurements.atticInsulationSqft) ||
        positiveRevealNumber(measurements.floorInsulationSqft);
      return quantity ? `${quantity} sqft` : null;
    }
    if (id === 'air_sealing' && /\bair[\s-]+sealing\b/i.test(notes)) {
      return null;
    }
    if (id === 'cabinet_demo') {
      const demo = positiveRevealNumber(
        (measurements as { cabinetDemoLf?: unknown }).cabinetDemoLf
      );
      return demo ? `${demo} LF` : null;
    }
    if (
      ['floor_demo', 'fixture_demo', 'baseboard_install', 'trim'].includes(
        id
      )
    ) {
      return null;
    }
    return undefined;
  };
  const checklistItems =
    (roomRemodelReveal || mixedScopeReveal) &&
    draft.scopeChecklist?.items &&
    !notesDescribeGroundUpHome(notes)
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
        if (
          String(item.id || '').trim() === 'air_sealing' &&
          notesDescribeMeasuredWholeHomeRemodel(notes)
        ) {
          return false;
        }
        return true;
      })
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
          confirmedWholeHousePlan(draft) ||
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
        ...(dedicatedDrywallNote
          ? {
              quantityOverride: dedicatedDrywallRevealQuantity(
                String(item.id || '').trim(),
                parsedDedicatedDrywallMeasurements
              ),
            }
          : noteRatedDrywallNote &&
              ['hang', 'finish_tape'].includes(String(item.id || '').trim())
            ? {
                quantityOverride: positiveRevealNumber(
                  initialScopeMeasurementInputExtended(draft, notes).drywallSqft
                )
                  ? `${positiveRevealNumber(
                      initialScopeMeasurementInputExtended(draft, notes).drywallSqft
                    )} sqft`
                  : null,
              }
            : {}),
        ...(dedicatedFlooringNote
          ? {
              quantityOverride: dedicatedFlooringRevealQuantity(
                String(item.id || '').trim(),
                draft.scopeMeasurements
              ),
            }
          : dedicatedPaintingNote
            ? {
                quantityOverride: dedicatedPaintingRevealQuantity(
                  String(item.id || '').trim(),
                  draft.scopeMeasurements
                ),
              }
            : {}),
        ...(dedicatedDeckNote
          ? {
              quantityOverride: dedicatedDeckRevealQuantity(
                String(item.id || '').trim(),
                (draft.scopeMeasurements || {}) as Record<string, unknown>
              ),
            }
          : {}),
      }))
      .filter(row => row.id && row.name) || [];
  rows = appendNamedRoofingRevealRows(draft, rows);
  const prefabEnclosureNamed =
    /\bprefab(?:\s+shower)?\s+(?:enclosure|surround)\b|\b(?:one[\s-]?piece)\s+(?:shower\s+)?enclosure\b/i.test(
      notes
    );
  const prefabPanNamed = /\bprefab\s+(?:shower\s+)?pan\b|\bpan\s+insert\b/i.test(
    notes
  );
  const removesPrefabPan =
    /\b(?:remove|demo|demolition|tear[\s-]?out)\b[^.]{0,50}\bprefab\s+(?:shower\s+)?pan\b/i.test(
      notes
    );
  const removesPrefabEnclosure =
    /\b(?:remove|demo|demolition|tear[\s-]?out)\b[^.]{0,60}\b(?:existing\s+)?prefab\s+(?:shower(?:\s+enclosure)?|enclosure)\b/i.test(
      notes
    );
  const tubInstallNamed =
    /\b(?:install|new)\b[^.]{0,40}\b(?:a\s+)?(?:new\s+)?tub\b|\bnew\s+tub\b/i.test(
      notes
    ) &&
    !prefabEnclosureNamed &&
    !prefabPanNamed &&
    !/\b(?:tile\s+shower|mud\s+pan|shower\s+pan)\b/i.test(notes);
  const bathroomWallPaintNamed =
    /\bpaint(?:ing)?\b[^.;\n]{0,50}\b(?:the\s+)?(?:bathroom\s+)?walls?\b|\b(?:bathroom\s+)?walls?\b[^.;\n]{0,50}\bpaint(?:ing)?\b/i.test(
      notes
    ) &&
    !/\b(?:drywall|sheetrock)\s+(?:patch|repair)\b|\b(?:patch|repair)\b[^.;\n]{0,30}\b(?:drywall|sheetrock)\b/i.test(
      notes
    );
  if (tubInstallNamed) {
    rows = rows.map(row =>
      row.id === 'wet_area_install' ? { ...row, name: 'Tub install' } : row
    );
  }
  if (bathroomWallPaintNamed) {
    rows = rows.map(row =>
      row.id === 'paint_repair' ||
      /interior\s+painting\/patch\s+and\s+repair/i.test(row.name)
        ? { ...row, name: 'Bathroom wall paint' }
        : row
    );
  }
  if (prefabEnclosureNamed && !prefabPanNamed) {
    rows = rows.map(row =>
      row.id === 'wet_area_install'
        ? { ...row, name: 'Prefab shower enclosure' }
        : row
    );
  } else if (prefabPanNamed && !prefabEnclosureNamed) {
    rows = rows.map(row =>
      row.id === 'wet_area_install'
        ? { ...row, name: 'Prefab shower pan' }
        : row
    );
  }
  if (
    (removesPrefabEnclosure || removesPrefabPan) &&
    !rows.some(row => /remove|demo/i.test(row.name) && /prefab/i.test(row.name))
  ) {
    rows = [
      {
        id: removesPrefabPan ? 'shower_floor_demo' : 'shower_enclosure_demo',
        name: removesPrefabPan
          ? 'Remove existing prefab shower pan'
          : 'Remove existing prefab shower enclosure',
      },
      ...rows,
    ];
  }
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
      const additionPackageNote = notesDescribeAreaOnlyAddition(notes);
      if (
        row.id === 'interior_trim' &&
        !explicitInteriorTrim &&
        !additionPackageNote
      ) {
        return false;
      }
      if (
        row.id === 'exterior_finishes' &&
        !explicitExteriorFinish &&
        !additionPackageNote
      ) {
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
    const cabinetInstall = statedCabinetInstallLf(notes);
    if (cabinetInstall) {
      addMixedRow('cabinets', `${cabinetInstall} LF cabinets`);
    } else if (/\b(?:install|new|replace)\b[^.;\n]{0,40}\bcabinets?\b/i.test(notes)) {
      addMixedRow('cabinets', 'Cabinet installation');
    }
    if (
      (/\b(?:two|2)\s+windows?\b|\bwindows?\b/i.test(notes)) &&
      !notesOpeningMentionIsKeepOnly(notes, 'windows')
    ) {
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
  const deniesInteriorDoors =
    /\b(?:no|not|without|don'?t|do not)\s+(?:the\s+)?(?:interior\s+)?doors?\b/i.test(
      notes
    );
  const hasGenericDoorMention =
    /\bdoors?\b/i.test(notes) &&
    !deniesInteriorDoors &&
    !notesDoorMentionIsPaintOrKeepOnly(notes) &&
    !notesOpeningMentionIsKeepOnly(notes, 'doors') &&
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
    !notesDoorMentionIsPaintOrKeepOnly(notes) &&
    !notesOpeningMentionIsKeepOnly(notes, 'doors') &&
    !rows.some(row => row.id === 'interior_door_install')
  ) {
    rows.push({ id: 'interior_door_install', name: 'Interior door installation' });
  }
  if (notesOpeningMentionIsKeepOnly(notes, 'windows')) {
    rows = rows.filter(
      row => row.id !== 'windows' && row.id !== 'window_install'
    );
  }
  if (
    notesDoorMentionIsPaintOrKeepOnly(notes) ||
    notesOpeningMentionIsKeepOnly(notes, 'doors')
  ) {
    rows = rows.filter(
      row =>
        row.id !== 'interior_door_install' &&
        row.id !== 'doors' &&
        row.id !== 'interior_doors'
    );
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
      !notesDescribeMeasuredWholeHomeRemodel(notes) &&
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
      !noteMentionIsOnlyNegated(notes, /\bplumb(?:ing)?\b/i) &&
      !rows.some(row => row.id === 'plumbing' || /plumbing/i.test(row.name))
    ) {
      addRoomRemodelRow('plumbing', 'Plumbing');
    }
    if (
      /\belectrical\b/i.test(notes) &&
      !noteMentionIsOnlyNegated(notes, /\belectrical\b/i) &&
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
    rows = dropUnstatedDoorAndTrimPaint(rows, notes);
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
      ) &&
      !noteMentionIsOnlyNegated(notes, /\broof(?:ing)?\b/i)
    ) {
      addCrossTradeRow(
        'roofing',
        'Roofing replacement',
        roomRemodelQuantityOverride('roofing')
      );
    }
    if (
      /\bgutters?\b/i.test(notes) &&
      !noteMentionIsOnlyNegated(notes, /\bgutters?\b/i)
    ) {
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
    if (
      id === 'grading' &&
      inferItemStateFromNotes('grading', notes) !== 'included'
    ) {
      continue;
    }
    if (
      (notesNameDedicatedHvacServiceVisit(notes) &&
        (id === 'equipment_replace' ||
          id === 'hvac' ||
          id === 'heat_pump' ||
          id === 'furnace')) ||
      (id === 'ductwork' && hvacNotesLeaveOptionAlone(notes, 'ductwork')) ||
      (id === 'hvac' && hvacNotesDropSystemPackage(notes))
    ) {
      continue;
    }
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
    const namedWholeHomeFinish = (id: string) => {
      if (!wholeHomeMixedRemodelNote) return false;
      if (id === 'interior_door_install' || id === 'interior_doors') {
        return /\binterior\s+doors?\b/i.test(notes);
      }
      if (id === 'trim' || id === 'interior_trim') {
        return /\btrim\b|\bbaseboards?\b/i.test(notes);
      }
      if (id === 'interior_paint' || id === 'paint') {
        return /\binterior\s+paint\b|\bpaint(?:ing)?\b/i.test(notes);
      }
      return false;
    };
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
        ].includes(row.id) || namedWholeHomeFinish(row.id)
    );
  }
  if (wholeHomeMixedRemodelNote) {
    rows = dropUnstatedDoorAndTrimPaint(rows, notes);
    const wallAtticLabel = wholeHomeWallAndAtticInsulationLabel(notes);
    if (wallAtticLabel) {
      rows = rows.map(row => {
        const insulationRow =
          row.id === 'insulation' ||
          row.id === 'attic_insulation' ||
          row.id === 'wall_insulation' ||
          /^attic insulation$/i.test(row.name.trim());
        if (!insulationRow || /\bR-\d{2,3}\b/i.test(row.name)) return row;
        return { ...row, name: wallAtticLabel };
      });
    }
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
  if (dedicatedDrywallNote) {
    const keep = new Set(['demo', 'demo_removal', 'drywall', 'patch_repair']);
    rows = rows.filter(row => keep.has(row.id));
  }
  if (noteRatedDrywallNote) {
    const keep = new Set(['hang', 'finish_tape']);
    rows = rows.filter(row => keep.has(row.id));
  }
  if (notesDescribeDrywallAndFlooringJob(notes)) {
    const keep = new Set([
      'demo',
      'demo_removal',
      'drywall',
      'patch_repair',
      'flooring',
    ]);
    rows = rows.filter(row => keep.has(row.id));
  }
  if (drywallRepairSqft && !dedicatedDrywallNote) {
    const hangAndRepair =
      /\bhang\b/i.test(notes) &&
      /\b(?:patch(?:ing)?|repair)\b/i.test(notes);
    const isDrywallRepairRow = (row: { id: string; name: string }) =>
      row.id === 'drywall' ||
      row.id === 'patch_repair' ||
      row.id === 'note:drywall_repair' ||
      /\bdrywall\s*\/\s*patch/i.test(row.name) ||
      /\bdrywall\s+(?:patch|repair)\b/i.test(row.name);
    if (!hangAndRepair) {
      let kept = false;
      rows = rows.flatMap(row => {
        if (!isDrywallRepairRow(row)) return [row];
        if (kept) return [];
        kept = true;
        return [
          {
            ...row,
            name: `Drywall repair · ${drywallRepairSqft} sqft`,
            quantityOverride: null,
          },
        ];
      });
      if (!kept) {
        rows.push({
          id: 'note:drywall_repair',
          name: `Drywall repair · ${drywallRepairSqft} sqft`,
        });
      }
    } else {
      const drywallRowIndex = rows.findIndex(isDrywallRepairRow);
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
        ownerHandledRevealItem(notes, plain) ||
        (/^grading$/i.test(plain) &&
          inferItemStateFromNotes('grading', notes) !== 'included') ||
        fallbackNames.has(plain.toLowerCase())
      ) {
        continue;
      }
      fallbackNames.add(plain.toLowerCase());
      rows.push({ id: `note:${plain.toLowerCase()}`, name: plain });
    }
  }
  const bathroomScopeParams = {
    notes,
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    scopeMode:
      draft.scopeMode || draft.classification?.scopeMode || null,
    planBacked: Boolean(
      draft.scopeMeasurements?.planImportMode ||
        draft.scopeMeasurements?.planImportFingerprint
    ),
    wholeHome: wholeHomeRemodelContext,
  };
  const bathroomAlignedRows = alignDedicatedBathroomScopeRows(
    filterDedicatedBathroomConfirmItems(rows, bathroomScopeParams),
    bathroomScopeParams
  );
  const bathroomRevealRows = shouldLimitBathroomChecklistToNotes(bathroomScopeParams)
    ? bathroomAlignedRows.filter(row => row.id !== 'wet_area_install')
    : bathroomAlignedRows;
  const revealRows = filterDedicatedDeckConfirmItems(
    filterDedicatedFlooringConfirmItems(
    filterDedicatedKitchenConfirmItems(
      bathroomRevealRows,
      {
        notes,
        templateKey: draft.scopeChecklist?.templateKey,
        projectType: draft.projectType,
        planBacked: bathroomScopeParams.planBacked,
        wholeHome: wholeHomeRemodelContext,
      }
    ),
    notes
    ),
    notes
  );
  const framingOnlyAdditionRows = notesNameFramingOnlyAddition(notes)
    ? revealRows.filter(
        row => row.id === 'framing' || /framing\s*\/\s*shell/i.test(row.name)
      )
    : revealRows;
  const framingRevealRows = framingOnlyAdditionRows.length
    ? framingOnlyAdditionRows
    : notesNameFramingOnlyAddition(notes)
      ? [{ id: 'framing', name: 'Framing / shell' }]
      : framingOnlyAdditionRows;
  const scopedRevealRows = notesNameRoughOpeningsOnly(notes)
    ? framingRevealRows.filter(
        row =>
          row.id === 'openings' ||
          /door\s*\/\s*window openings|rough openings/i.test(row.name)
      )
    : framingRevealRows;
  const namedWholeHomeIds = wholeHomeRemodelNamedItemIds(notes);
  const withRoomUpdates = (() => {
    const base = scopedRevealRows.length
      ? scopedRevealRows
      : notesNameRoughOpeningsOnly(notes)
        ? [{ id: 'openings', name: 'Door / window openings' }]
        : scopedRevealRows;
    if (!namedWholeHomeIds) return base;
    const next = [...base];
    if (
      namedWholeHomeIds.has('kitchen_updates') &&
      !next.some(row => row.id === 'kitchen_updates' || row.id === 'cabinets')
    ) {
      next.push({ id: 'kitchen_updates', name: 'Kitchen updates' });
    }
    if (
      namedWholeHomeIds.has('bathroom_updates') &&
      !next.some(
        row =>
          row.id === 'bathroom_updates' ||
          row.id === 'vanity' ||
          row.id === 'shower_tile'
      )
    ) {
      next.push({ id: 'bathroom_updates', name: 'Bathroom updates' });
    }
    return next;
  })();
  const visibleRevealRows = withRoomUpdates.filter(row => {
    if (notesOpeningMentionIsKeepOnly(notes, 'windows')) {
      if (row.id === 'windows' || row.id === 'window_install') return false;
      if (/^window install\b/i.test(row.name)) return false;
    }
    if (noteMentionIsOnlyNegated(notes, /\broof(?:ing)?\b/i)) {
      if (
        row.id === 'roofing' ||
        row.id === 'roofing_system' ||
        row.id === 'shingles_roofing' ||
        row.id === 'tear_off'
      ) {
        return false;
      }
      if (/^roofing\b/i.test(row.name)) return false;
    }
    if (
      notesDoorMentionIsPaintOrKeepOnly(notes) ||
      notesOpeningMentionIsKeepOnly(notes, 'doors')
    ) {
      if (
        row.id === 'interior_door_install' ||
        row.id === 'doors' ||
        row.id === 'interior_doors'
      ) {
        return false;
      }
      if (/^interior door installation\b/i.test(row.name)) return false;
    }
    return true;
  });
  const wallFloorRevealRows = notesNameWallAreaFramingWithFlooring(notes)
    ? (() => {
        const framingQty =
          parseFramingMeasurementsFromNotes(notes).wallFramingSqft;
        const flooringMatch =
          /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))\s*(?:of\s+)?(?:lvp|luxury\s+vinyl|laminate|vinyl|carpet|hardwood|flooring)\b/i.exec(
            notes
          );
        const flooringQty = flooringMatch
          ? Number(String(flooringMatch[1]).replace(/,/g, ''))
          : null;
        const lvp = /\b(?:lvp|luxury\s+vinyl)\b/i.test(notes);
        return [
          {
            id: 'wall_framing',
            name: 'Wall framing',
            ...(framingQty ? { quantityOverride: `${framingQty} sqft` } : {}),
          },
          {
            id: 'flooring',
            name: lvp ? 'LVP flooring' : 'Flooring',
            ...(flooringQty && flooringQty > 0
              ? { quantityOverride: `${flooringQty} sqft` }
              : {}),
          },
        ];
      })()
    : visibleRevealRows;
  const dedicatedWallAreaRows = notesNameDedicatedWallAreaFraming(notes)
    ? (() => {
        const parsed = parseFramingMeasurementsFromNotes(notes);
        const rows: InitialRevealScopeRow[] = [];
        if (noteMentionsGeneralWallDemolition(notes)) {
          const demoMatch =
            /\b(?:demolish|demolition|demo|remove|removal|tear[\s-]?out)\b[^.;\n]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))\s*(?:of\s+)?(?:nonstructural\s+)?walls?\b/i.exec(
              notes
            );
          const demoQty = demoMatch
            ? Number(String(demoMatch[1]).replace(/,/g, ''))
            : null;
          rows.push({
            id: 'demo',
            name: 'Wall demolition',
            ...(demoQty && demoQty > 0
              ? { quantityOverride: `${demoQty} sqft` }
              : {}),
          });
        }
        rows.push({
          id: 'wall_framing',
          name: 'Wall framing',
          ...(parsed.wallFramingSqft
            ? { quantityOverride: `${parsed.wallFramingSqft} sqft` }
            : {}),
        });
        if (/\b(?:structural\s+)?sheathing\b/i.test(notes)) {
          rows.push({
            id: 'shear_sheathing',
            name: 'Structural sheathing',
            ...(parsed.sheathingSqft
              ? { quantityOverride: `${parsed.sheathingSqft} sqft` }
              : {}),
          });
        }
        if (
          /\brough\s+openings?\b|\b(?:door|window)\s+openings?\b|\bheaders?\b/i.test(
            notes
          )
        ) {
          rows.push({
            id: 'openings',
            name: 'Door / window openings',
            ...(parsed.framingOpeningCount
              ? { quantityOverride: `${parsed.framingOpeningCount} each` }
              : {}),
          });
        }
        return rows;
      })()
    : wallFloorRevealRows;
  if (notesNameConcretePatioWithSod(notes)) {
    const areas = concretePatioWithSodAreas(notes);
    return [
      {
        id: 'pour_flatwork',
        name: 'Concrete patio',
        ...(areas.patioSqft
          ? { quantityOverride: `${areas.patioSqft} sqft` }
          : { quantityOverride: null }),
      },
      {
        id: 'sod_turf',
        name: 'Sod',
        ...(areas.sodSqft
          ? { quantityOverride: `${areas.sodSqft} sqft` }
          : { quantityOverride: null }),
      },
    ];
  }
  if (notesNameAtticInsulationWithDrywallHang(notes)) {
    const areas = atticInsulationWithDrywallAreas(notes);
    return [
      {
        id: 'insulation',
        name: 'Attic insulation',
        ...(areas.atticSqft
          ? { quantityOverride: `${areas.atticSqft} sqft` }
          : { quantityOverride: null }),
      },
      {
        id: 'drywall',
        name: 'Drywall hang / finish',
        ...(areas.drywallSqft
          ? { quantityOverride: `${areas.drywallSqft} sqft` }
          : { quantityOverride: null }),
      },
    ];
  }
  if (notesNameShowerTileWithFlooring(notes)) {
    const areas = showerTileWithFlooringAreas(notes);
    const showerQty = areas.showerWallTileSqft
      ? { quantityOverride: `${areas.showerWallTileSqft} sqft` }
      : { quantityOverride: null };
    return [
      ...(notesReplaceShowerTile(notes)
        ? [
            {
              id: 'demo',
              name: 'Shower tile demo',
              ...showerQty,
            },
          ]
        : []),
      {
        id: 'shower_tile',
        name: 'Shower wall tile',
        ...showerQty,
      },
      {
        id: 'waterproofing',
        name: 'Shower waterproofing',
        ...showerQty,
      },
      ...(notesNameBathroomFloorRemoval(notes)
        ? [
            {
              id: 'floor_demo',
              name: 'Bathroom floor demo',
              ...(areas.flooringSqft
                ? { quantityOverride: `${areas.flooringSqft} sqft` }
                : { quantityOverride: null }),
            },
          ]
        : []),
      {
        id: 'flooring_lvp',
        name: 'LVP flooring',
        ...(areas.flooringSqft
          ? { quantityOverride: `${areas.flooringSqft} sqft` }
          : { quantityOverride: null }),
      },
    ];
  }
  const linearFootRows = notesNameLinearFootStudWall(notes)
    ? (() => {
        const parsed = parseFramingMeasurementsFromNotes(notes);
        const rows: InitialRevealScopeRow[] = [
          {
            id: 'wall_framing',
            name: 'Wall framing',
            ...(parsed.wallFramingLf
              ? { quantityOverride: `${parsed.wallFramingLf} LF` }
              : {}),
          },
        ];
        if (/\b(?:structural\s+)?sheathing\b/i.test(notes)) {
          rows.push({
            id: 'shear_sheathing',
            name: 'Structural sheathing',
            ...(parsed.sheathingSqft
              ? { quantityOverride: `${parsed.sheathingSqft} sqft` }
              : {}),
          });
        }
        if (
          /\brough\s+openings?\b|\b(?:door|window)\s+openings?\b|\bheaders?\b/i.test(
            notes
          )
        ) {
          rows.push({
            id: 'openings',
            name: 'Door / window openings',
            ...(parsed.framingOpeningCount
              ? { quantityOverride: `${parsed.framingOpeningCount} each` }
              : {}),
          });
        }
        return rows;
      })()
    : dedicatedWallAreaRows;
  if (/\btile\b/i.test(notes)) return linearFootRows;
  return linearFootRows.filter(row => !/\btile\s*demo\b/i.test(row.name));
}

/** Checklist rows for Scope found when priced packages are not built yet. */
function dedicatedBathroomRemodelNote(notes?: string | null): boolean {
  const text = String(notes || '');
  return (
    /\b(?:bathroom|bath)\s+(?:remodel|renovation)\b/i.test(text) ||
    /\bremodel(?:\s+\w+){0,4}\s+bathroom\b/i.test(text)
  );
}

/** National-average dollars Confirm Scope will show for a bathroom line. */
function bathroomSuggestedRevealAmount(
  draft: EstimateAiDraft,
  rowId: string
): number {
  if (!rowId) return 0;
  const notes = String(draft.originalNotes || '');
  const templateKey = draft.scopeChecklist?.templateKey ?? null;
  const measurements = initialScopeMeasurementInputExtended(draft, notes);
  const resolved = resolveChecklistItemQuantity(rowId, measurements, {
    templateKey,
    notes,
  });
  const suggested = resolveScopeItemSuggestedPricing(
    rowId,
    measurements,
    templateKey,
    resolved,
    null,
    null,
    notes
  );
  const total = Number(suggested.fill?.total);
  return total > 0 ? Math.round(total * 100) / 100 : 0;
}

/** Scope found shows a bathroom line's known price. Unmeasured lines stay blank. */
function withBathroomSuggestedAmount(
  draft: EstimateAiDraft,
  rowId: string,
  amount: number
): number {
  if (amount > 0 || !rowId) return amount;
  if (
    !shouldLimitBathroomChecklistToNotes({
      notes: draft.originalNotes,
      templateKey: draft.scopeChecklist?.templateKey,
      projectType: draft.projectType,
      scopeMode: draft.scopeMode || draft.classification?.scopeMode || null,
      planBacked: Boolean(
        draft.scopeMeasurements?.planImportMode ||
          draft.scopeMeasurements?.planImportFingerprint
      ),
      wholeHome: notesDescribeMeasuredWholeHomeRemodel(draft.originalNotes),
    })
  ) {
    return amount;
  }
  return bathroomSuggestedRevealAmount(draft, rowId);
}

function hideUnnamedBathroomPaintScopeRow(
  draft: EstimateAiDraft,
  row: { id?: string; name?: string | null }
): boolean {
  const notes = String(draft.originalNotes || '');
  const bathroom =
    String(draft.scopeChecklist?.templateKey || '').toLowerCase() ===
      'bathroom' || dedicatedBathroomRemodelNote(notes);
  if (!bathroom || /\bpaint(?:ing)?\b/i.test(bathroomAffirmativeNotes(notes)))
    return false;
  const id = String(row.id || '');
  if (
    id === 'interior_paint' ||
    id === 'paint' ||
    id === 'paint_repair' ||
    id === 'ceiling_paint'
  ) {
    return true;
  }
  return /\binterior\s+paint\b/i.test(String(row.name || ''));
}

function areaOnlyAdditionRevealRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (!notesDescribeAreaOnlyAddition(draft.originalNotes)) return null;
  const measurements = initialScopeMeasurementInputExtended(draft);
  const packageIds = new Set(areaOnlyAdditionScopeIds());
  const rows = getInitialRevealScopeRows(draft)
    .filter(row => packageIds.has(row.id))
    .map(row => {
    const resolved = areaOnlyAdditionResolvedQuantity(
      row.id,
      measurements as Parameters<typeof areaOnlyAdditionResolvedQuantity>[1],
      draft.originalNotes
    );
    if (row.id === 'cleanup') {
      const cleanup = getNationalAverageBudgetSplit('cleanup');
      const material = Number(cleanup?.material || 0);
      const labor = Number(cleanup?.labor || 0);
      return {
        name: row.name,
        amount: roundedMoney(material + labor),
        ...(material + labor > 0
          ? {
              quantity: `Material $${material.toLocaleString('en-US')} · Labor $${labor.toLocaleString('en-US')}`,
            }
          : {}),
      };
    }
    const finishItem = draft.scopeChecklist?.items?.find(
      item => item.id === 'exterior_finishes'
    );
    const exteriorFinishes =
      row.id === 'exterior_finishes'
        ? resolveAreaOnlyExteriorFinishes({
            stored: measurements.exteriorFinish,
            storedMany: Array.isArray(measurements.exteriorFinishes)
              ? measurements.exteriorFinishes
              : null,
            choiceId: finishItem?.choiceId,
            choiceIds: finishItem?.choiceIds,
            notes: draft.originalNotes,
          })
        : [];
    const exteriorFinish = areaOnlyExteriorCladding(exteriorFinishes);
    const exteriorSystem = resolveAreaOnlyStuccoSystem({
      finish: exteriorFinish,
      stored: measurements.exteriorStuccoSystem,
      notes: draft.originalNotes,
    });
    const stuccoRate = areaOnlyStuccoSystemRate(exteriorSystem);
    const brickRate =
      row.id === 'exterior_finishes' && exteriorFinish === 'brick'
        ? AREA_ONLY_BRICK_RATE
        : null;
    const rateId = row.id === 'exterior_finishes' ? null : row.id;
    const split =
      brickRate && resolved?.pricingReady
        ? brickRate
        : stuccoRate && resolved?.pricingReady
        ? stuccoRate
        : resolved?.pricingReady && resolved.quantity && rateId
          ? getNationalAverageBudgetSplit(rateId, resolved.unit)
          : null;
    const rowName =
      row.id === 'exterior_finishes'
        ? areaOnlyExteriorFinishLabel(exteriorFinish)
        : row.name;
    const rate = Number(split?.material || 0) + Number(split?.labor || 0);
    const amount =
      resolved?.unit === 'allowance'
        ? Number(resolved.quantity || 0)
        : resolved?.pricingReady && rate > 0
          ? roundedMoney(rate * Number(resolved.quantity))
          : 0;
    const quantity =
      resolved?.pricingReady && resolved.quantity
        ? resolved.unit === 'allowance'
          ? 'Allowance'
          : `${Number(resolved.quantity).toLocaleString('en-US')} ${resolved.unit}`
        : null;
    return {
      name: rowName,
      amount,
      ...(quantity ? { quantity } : {}),
    };
  });
  return rows;
}

function groundUpExteriorFinishRevealQuantity(
  draft: Parameters<typeof getInitialRevealChecklistScopePreview>[0],
  rowName: string,
  quantity: string | null | undefined
): string | null | undefined {
  if (!notesDescribeGroundUpHome(draft.originalNotes)) return quantity;
  if (!/\bstucco\b|exterior wall finish/i.test(rowName)) return quantity;
  const measurements = (draft.scopeMeasurements || {}) as {
    floorAreaSqft?: unknown;
    garageSqft?: unknown;
  };
  const livingFromNotes = String(draft.originalNotes || '').match(
    /\b(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft)\b/i
  );
  const living =
    Number(String(measurements.floorAreaSqft ?? '').replace(/,/g, '')) ||
    Number(String(livingFromNotes?.[1] || '').replace(/,/g, ''));
  const shown = Number(String(quantity ?? '').replace(/[^\d.]/g, ''));
  const livingMatches =
    !quantity ||
    !Number.isFinite(shown) ||
    shown <= 0 ||
    (Number.isFinite(living) && living > 0 && Math.abs(shown - living) < 1);
  if (!livingMatches) return quantity;
  const estimate = getQuickMeasurementEstimate(
    'exteriorPaintSqft',
    {
      floorAreaSqft: (measurements.floorAreaSqft as string | number | null) || living,
      garageSqft: measurements.garageSqft as string | number | null,
    },
    undefined,
    'ground_up',
    { notes: draft.originalNotes, projectType: 'new_build' }
  );
  if (!estimate || !(estimate.value > 0)) return quantity;
  return `${Math.round(estimate.value).toLocaleString()} sqft`;
}

const REVEAL_ROW_ITEM_IDS: Record<string, string> = {
  'remove tub': 'tub_demo',
  'remove prefab pan': 'shower_floor_demo',
  'remove tile pan': 'shower_floor_demo',
  'remove tile shower pan': 'shower_floor_demo',
  'demo shower walls': 'wall_demo',
  'remove prefab enclosure': 'shower_enclosure_demo',
  'remove shower door': 'glass_door_demo',
  'remove toilet': 'toilet_demo',
  'remove vanity': 'vanity_demo',
  'remove carpet': 'floor_demo',
  'remove tile': 'floor_demo',
  'remove hardwood': 'floor_demo',
  'remove vinyl': 'floor_demo',
  'remove laminate': 'floor_demo',
  'flooring demo / removal': 'floor_demo',
  'cabinet demo': 'cabinet_demo',
  'countertop demo': 'countertop_demo',
  'backsplash demo': 'backsplash_demo',
  'existing roof / tear-off': 'tear_off',
  'tear off shingles': 'tear_off_shingles',
  'tear off roof tile': 'tear_off_tile',
  'tear off metal roof': 'tear_off_metal',
  'tear off flat roof': 'tear_off_flat',
  'remove panel': 'electrical_panel_removal',
  'remove fixtures': 'electrical_fixture_removal',
  'remove wiring': 'electrical_abandoned_circuit',
};

/**
 * After Confirm Scope, the initial estimate lists the same lines as Selected
 * pricing. Scope found placeholders stay off that list.
 */
export function confirmedAppliedRevealLines(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> | null {
  if (!initialRevealPricingVisible(draft)) return null;
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  const templateKey = draft.scopeChecklist?.templateKey;
  const measurements = clearSupersededStageHostPricing(
    mergeConfirmScopeSavedMeasurements(
      initialScopeMeasurementInputExtended(draft, draft.originalNotes),
      draft.scopeMeasurements,
      draft.originalNotes
    ),
    templateKey
  );
  const lines = listConfirmScopeAppliedPricingLines({
    items,
    measurements,
    templateKey,
    notes: draft.originalNotes,
    pricingContext: { checklistItems: items },
  });
  if (!lines.length) return null;
  const packages = getScopePackagesForReview(draft);
  return lines.map(line => {
    const pkg = packages.find(
      row =>
        String(row.checklistItemId || row.costCode || '') === line.itemId ||
        String(row.name || '')
          .trim()
          .toLowerCase() === line.label.trim().toLowerCase()
    );
    const quantity = pkg ? formatScopeQuantity(pkg, draft) : null;
    const name =
      line.itemId === 'decking' && notesDescribeDedicatedDeckJob(draft.originalNotes)
        ? deckInstallMaterialCopy(
            selectedDeckInstallMaterial(draft.originalNotes, measurements)
          ).label
        : line.label;
    return {
      name,
      amount: line.total,
      ...(quantity ? { quantity } : {}),
    };
  });
}

/**
 * Dollars already on the bid for a Scope found row. The same amount the
 * initial estimate and Review total, so a listed line is not $0 beside a
 * priced total.
 */
export function initialRevealAmountsByName(
  draft: EstimateAiDraft
): Map<string, { id: string; amount: number }> {
  const amounts = new Map<string, { id: string; amount: number }>();
  const put = (name: string, id: string, amount: number) => {
    const key = name.trim().toLowerCase();
    if (!key || !(amount > 0) || amounts.has(key)) return;
    amounts.set(key, { id, amount });
  };
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (items.length) {
    for (const line of listConfirmScopeAppliedPricingLines({
      items,
      measurements: initialScopeMeasurementInputExtended(draft, draft.originalNotes),
      templateKey: draft.scopeChecklist?.templateKey,
      notes: draft.originalNotes,
    })) {
      put(line.label, line.itemId, line.total);
      for (const [name, rowId] of Object.entries(REVEAL_ROW_ITEM_IDS)) {
        if (rowId === line.itemId) put(name, line.itemId, line.total);
      }
    }
  }
  for (const pkg of getScopePackagesForReview(draft)) {
    const id = String(pkg.checklistItemId || pkg.costCode || '').trim();
    const amount = scopePackagePricedAmount(pkg, draft);
    if (!id || !(amount > 0)) continue;
    put(String(pkg.name || pkg.scope || ''), id, amount);
    for (const [name, rowId] of Object.entries(REVEAL_ROW_ITEM_IDS)) {
      if (rowId === id) put(name, id, amount);
    }
  }
  return amounts;
}

function revealRowAmount(
  draft: EstimateAiDraft,
  pkg: EstimateDraftScopePackage | undefined
): number {
  if (!showRevealAmounts(draft)) return 0;
  if (pkg) {
    const priced =
      draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
        ? scopePackagePricedAmount(pkg, draft)
        : scopePackageIndicativePricedAmount(pkg, draft);
    if (priced > 0) return priced;
  }
  return 0;
}

function statedWholeHomeRevealAmount(
  draft: EstimateAiDraft,
  rowId: string
): { total: number; quantity: string | null } | null {
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return null;
  }
  const priced = measuredWholeHomeStatedScopeFill(
    rowId,
    initialScopeMeasurementInputExtended(draft, draft.originalNotes),
    draft.scopeChecklist?.templateKey,
    draft.originalNotes
  );
  if (!priced) return null;
  const quantity = priced.basis?.quantity;
  return {
    total: Math.round(priced.total * 100) / 100,
    quantity: quantity ? `${quantity} sqft` : null,
  };
}

function statedTrimRevealAmount(
  draft: EstimateAiDraft,
  rowId: string
): { total: number; quantity: string | null } | null {
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return null;
  }
  const priced = measuredWholeHomeTrimSuggestedFill(
    rowId,
    initialScopeMeasurementInputExtended(draft, draft.originalNotes),
    draft.scopeChecklist?.templateKey,
    draft.originalNotes
  );
  if (!priced) return null;
  return {
    total: Math.round(priced.total * 100) / 100,
    quantity: priced.quantity ? `${priced.quantity} LF` : null,
  };
}

function showRevealAmounts(draft: EstimateAiDraft): boolean {
  return initialRevealPricingVisible(draft);
}

/**
 * Removal rows are prepended to the Initial estimate list before the priced
 * checklist preview. Fill them from the same applied dollars Review shows.
 */
export function priceShowerRemovalRevealRows<
  T extends { name: string; amount: number },
>(draft: EstimateAiDraft | null | undefined, rows: T[]): T[] {
  if (!draft?.scopeAssumptionsConfirmed && !draft?.confirmedAssumptions?.length) {
    return rows;
  }
  return rows.map(row => {
    if (row.amount > 0) return row;
    const itemId = showerRemovalItemIdForRevealName(row.name);
    if (!itemId) return row;
    const amount = appliedAliasRevealAmount(draft, itemId);
    if (!(amount > 0)) return row;
    return { ...row, amount: Math.round(amount * 100) / 100 };
  });
}

function appliedAliasRevealAmount(
  draft: EstimateAiDraft,
  rowId: string
): number {
  if (!rowId) return 0;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return 0;
  }
  return resolveAppliedConfirmScopePackageAmount(
    { name: rowId, checklistItemId: rowId, costCode: rowId },
    draft
  );
}

const ROOFING_APPLIED_REVEAL_LINES: Array<{
  id: string;
  key: string;
  unit: string;
  label: string;
}> = [
  { id: 'shingles_roofing', key: 'roofSquares', unit: 'squares', label: 'Shingles' },
  { id: 'ridge_vent', key: 'roofRidgeVentLf', unit: 'each', label: 'Ridge vent' },
  { id: 'pipe_boots', key: 'roofPipeBootCount', unit: 'each', label: 'Pipe boots' },
  { id: 'gutters', key: 'roofGutterLf', unit: 'LF', label: 'Gutters' },
  { id: 'downspouts', key: 'roofDownspoutCount', unit: 'each', label: 'Downspouts' },
];

/** Priced Confirm Scope lines for a roofing bid. Leaves out unpriced plan text. */
function appliedRoofingConfirmScopePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> {
  if (!isRoofingRevealDraft(draft) && !roofingPlanOnlyExport(draft)) {
    const trade = String(
      (draft.scopeMeasurements as { planImportTradeKey?: string } | null)
        ?.planImportTradeKey || ''
    );
    if (trade !== 'roofing' && !isRoofingRevealDraft(draft)) return [];
  }
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return [];
  }
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const acceptance = measurements.pricingAcceptance as
    | Record<string, { totalAmount?: number }>
    | undefined;
  if (!acceptance) return [];
  const items = draft.scopeChecklist?.items || [];
    const coveringName = roofCoveringName(draft);
  const orderedIds = [
    ...ROOFING_APPLIED_REVEAL_LINES.map(line => line.id),
    ...Object.keys(acceptance).filter(
      id => !ROOFING_APPLIED_REVEAL_LINES.some(line => line.id === id)
    ),
  ];
  const itemQuantities =
    measurements.itemQuantities &&
    typeof measurements.itemQuantities === 'object'
      ? (measurements.itemQuantities as Record<string, { quantity?: unknown }>)
      : {};
  return orderedIds.flatMap(id => {
    const amount = Number(acceptance[id]?.totalAmount || 0);
    if (!(amount > 0)) return [];
    const line = ROOFING_APPLIED_REVEAL_LINES.find(entry => entry.id === id);
    const tearOff = ROOF_TEAR_OFF_CARDS.find(entry => entry.id === id);
    const qty = tearOff
      ? Number(String(itemQuantities[tearOff.id]?.quantity ?? '').replace(/,/g, ''))
      : line
        ? Number(String(measurements[line.key] ?? '').replace(/,/g, ''))
        : 0;
    const name =
      id === 'shingles_roofing'
        ? coveringName
        : tearOff?.label ||
          line?.label ||
          items.find(item => item.id === id)?.label ||
          id;
    const unit = tearOff ? 'squares' : line?.unit || 'each';
    return [
      {
        name: String(name).trim(),
        amount: Math.round(amount * 100) / 100,
        quantity:
          qty > 0 ? `${qty.toLocaleString('en-US')} ${unit}` : null,
      },
    ];
  });
}

function appliedPlumbingPriceRows(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> {
  if (!isPlumbingRevealDraft(draft) && !plumbingPlanImportReveal(draft)) return [];
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return [];
  }
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const acceptance = measurements.pricingAcceptance as
    | Record<string, { totalAmount?: number; selectionStatus?: string }>
    | undefined;
  const items = draft.scopeChecklist?.items || [];
  if (acceptance && Object.keys(acceptance).length) {
    const orderedIds = [
      ...PLUMBING_CARDS.map(card => card.itemId),
      ...Object.keys(acceptance).filter(
        id => !PLUMBING_CARDS.some(card => card.itemId === id)
      ),
    ];
    const rows = orderedIds.flatMap(id => {
      const saved = acceptance[id];
      const amount = Number(saved?.totalAmount || 0);
      if (!(amount > 0)) return [];
      const card = PLUMBING_CARDS.find(entry => entry.itemId === id);
      const key = card?.measurementKey || plumbingMeasurementKeyForItemId(id);
      const qty = key
        ? Number(String(measurements[key] ?? '').replace(/,/g, ''))
        : 0;
      const unit = card?.unit === 'lf' ? 'LF' : 'EA';
      const label =
        items.find(item => item.id === id)?.label || card?.label || id;
      return [
        {
          name: String(label).trim(),
          amount: Math.round(amount * 100) / 100,
          quantity:
            qty > 0 ? `${qty.toLocaleString('en-US')} ${unit}` : null,
        },
      ];
    });
    if (rows.length) return rows;
  }
  return getScopePackagesForReview(draft).flatMap(pkg => {
    const amount = scopePackagePricedAmount(pkg, draft);
    if (!(amount > 0)) return [];
    const quantity = pkg.scopeQuantities?.[0];
    return [
      {
        name: pkg.name,
        amount,
        quantity: quantity
          ? `${quantity.quantity.toLocaleString('en-US')} ${quantity.unit}`
          : null,
      },
    ];
  });
}

export function getInitialRevealChecklistScopePreview(
  draft: EstimateAiDraft
): Array<{ name: string; amount: number; quantity?: string | null }> {
  if (vagueScopeQuestion(draft.originalNotes)) return [];
  const paintingScopeFound = dedicatedPaintingScopeFoundRows(draft);
  if (paintingScopeFound) return paintingScopeFound;
  const pricedPlumbing = appliedPlumbingPriceRows(draft);
  if (pricedPlumbing.length) return pricedPlumbing;
  const pricedRoofing = appliedRoofingConfirmScopePreview(draft);
  if (pricedRoofing.length) return pricedRoofing;
  if (plumbingPlanAwaitsContractorCounts(draft)) {
    return plumbingPlanLabeledBathNames(plumbingPlanRooms(draft)).map(name => ({
      name,
      amount: 0,
    }));
  }
  if (
    plumbingPlanImportReveal(draft) &&
    plumbingPlanHasPrintedQuantity(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    const measurements = draft.scopeMeasurements as Record<string, unknown>;
    return (draft.scopeChecklist?.items || [])
      .flatMap(item => {
        const key = plumbingMeasurementKeyForItemId(item.id);
        const qty = key ? Number(measurements[key] || 0) : 0;
        if (!key || !(qty > 0)) return [];
        const quantity = /Lf$/.test(key)
          ? `${qty.toLocaleString('en-US')} LF`
          : `${qty.toLocaleString('en-US')} EA`;
        return [
          {
            name: String(item.label || item.id).trim(),
            amount: 0,
            quantity,
          },
        ];
      })
      .slice(0, 50);
  }
  const paintingApplied = appliedPaintingConfirmScopePreview(draft);
  if (paintingApplied) return paintingApplied;
  const confirmedPaintingNotes = confirmedPaintingNotePreview(draft);
  if (confirmedPaintingNotes) return confirmedPaintingNotes;
  const windowsDoorsPlan = windowsDoorsPlanRevealRows(draft);
  if (windowsDoorsPlan) return windowsDoorsPlan;
  if (electricalDeviceNoteOwnsReveal(draft)) {
    return dedicatedElectricalRevealRows(draft.originalNotes);
  }
  if (windowsDoorsNoteOwnsReveal(draft)) {
    return dedicatedWindowsDoorsRevealRows(draft.originalNotes);
  }
  if (insulationNoteOwnsReveal(draft)) {
    return dedicatedInsulationRevealRows(draft.originalNotes);
  }
  if (stuccoNoteOwnsReveal(draft)) {
    return dedicatedStuccoRevealRows(draft.originalNotes);
  }
  const stuccoWindowsPreview = stuccoWithWindowsRevealRows(draft.originalNotes);
  if (stuccoWindowsPreview.length > 0) {
    return stuccoWindowsPreview.map(row => ({
      name: row.name,
      amount: 0,
      ...(row.quantity ? { quantity: row.quantity } : {}),
    }));
  }
  const receptacleToiletPreview = receptaclesWithToiletRevealRows(
    draft.originalNotes
  );
  if (receptacleToiletPreview.length > 0) {
    return receptacleToiletPreview.map(row => ({
      name: row.name,
      amount: 0,
      ...(row.quantity ? { quantity: row.quantity } : {}),
    }));
  }
  const drywallFloorPreview = drywallBesideFlooringRevealRows(
    draft.originalNotes
  );
  if (drywallFloorPreview.length > 0) {
    return drywallFloorPreview.map(row => ({
      name: row.name,
      amount: 0,
      ...(row.quantity ? { quantity: row.quantity } : {}),
    }));
  }
  const kitchenBathPreview = measuredKitchenBathInteriorRevealRows(
    draft.originalNotes
  );
  if (kitchenBathPreview) {
    return kitchenBathPreview.map(row => ({
      name: row.name,
      amount: 0,
      ...(row.quantityOverride ? { quantity: row.quantityOverride } : {}),
    }));
  }
  const separateJobPreview = separateJobRevealRows(draft.originalNotes);
  if (separateJobPreview.length > 0) {
    return separateJobPreview.map(row => ({
      name: row.name,
      amount: 0,
      ...(row.quantity ? { quantity: row.quantity } : {}),
    }));
  }
  const areaOnlyPreview = areaOnlyAdditionRevealRows(draft);
  if (areaOnlyPreview) return areaOnlyPreview;
  if (roofingPlanScopeOwnsReveal(draft)) {
    return roofingPlanOnlyScopeRows(draft);
  }
  if (stuccoPlanExport(draft)) {
    return stuccoPlanScopeRows(draft);
  }
  if (flooringPlanExport(draft)) {
    return flooringPlanScopeRows(draft);
  }
  const appliedElectrical = appliedElectricalConfirmScopePreview(draft);
  if (appliedElectrical) return appliedElectrical;
  const framingPackage = framingCoverSheetPackage(
    draft.scopeMeasurements as Record<string, unknown> | null
  );
  if (framingPackage) {
    return [
      {
        name: 'Framing package',
        amount: 0,
        quantity: `${framingPackage.packageSqft.toLocaleString('en-US')} SF`,
      },
    ];
  }
  const planLines = confirmedPlanLinesForDraft(draft);
  if (planTakeoffLinesOwnRevealScope(draft) && planLines.length > 0) {
    return planLines.map(name => ({
      name,
      amount: appliedElectricalPlanLineAmount(draft, name) ?? 0,
    }));
  }
  const scopeRows = getInitialRevealScopeRows(draft).filter(row => {
    if (hideUnnamedBathroomPaintScopeRow(draft, row)) return false;
    if (notesOpeningMentionIsKeepOnly(draft.originalNotes, 'windows')) {
      if (row.id === 'windows' || row.id === 'window_install') return false;
      if (/^window install\b/i.test(row.name)) return false;
    }
    if (
      notesDoorMentionIsPaintOrKeepOnly(draft.originalNotes) ||
      notesOpeningMentionIsKeepOnly(draft.originalNotes, 'doors')
    ) {
      if (
        row.id === 'interior_door_install' ||
        row.id === 'doors' ||
        row.id === 'interior_doors'
      ) {
        return false;
      }
      if (/^interior door installation\b/i.test(row.name)) return false;
    }
    if (!notesDescribeMeasuredWholeHomeRemodel(draft.originalNotes)) return true;
    if (row.id === 'air_sealing') return false;
    if (/\bair\s*sealing\b/i.test(row.name)) return false;
    return true;
  });
  const groundUpLine = groundUpLivingRevealLine(draft.originalNotes);
  if (groundUpLine) {
    const kept = scopeRows.filter(
      row => !ownerHandledRevealItem(draft.originalNotes, `${row.id} ${row.name}`)
    );
    const houseNames = new Set(
      [groundUpLine, ...groundUpNamedRevealLines(draft.originalNotes)].map(name =>
        name.trim().toLowerCase()
      )
    );
    // Grading is not a scope line unless the note asks for it. A named
    // driveway stays on the list with the rest of the house.
    const windowRowPresent = kept.some(
      row => row.id === 'windows' || /^windows$/i.test(row.name.trim())
    );
    const extra = kept.filter(row => {
      if (houseNames.has(row.name.trim().toLowerCase())) return false;
      if (/\b(?:plans?|permits?)\b/i.test(row.name)) return false;
      if (row.id === 'concrete' || row.id === 'grading') {
        return false;
      }
      if (
        kept.some(
          candidate =>
            candidate.id === 'tile_flooring' ||
            /tile\s*&\s*flooring/i.test(candidate.name)
        ) &&
        (row.id === 'flooring' || /^flooring installation$/i.test(row.name.trim()))
      ) {
        return false;
      }
      // Kitchen hookups are not a third plumbing card on a new house.
      if (
        !notesAskForPlumbingConnections(draft.originalNotes) &&
        (row.id === 'plumbing' ||
          /^plumbing connections$/i.test(row.name.trim()))
      ) {
        return false;
      }
      if (
        row.id === 'electrical' ||
        /\belectrical outlets\b/i.test(row.name)
      ) {
        return false;
      }
      if (
        windowRowPresent &&
        (row.id === 'window_install' ||
          /^window install$/i.test(row.name.trim()))
      ) {
        return false;
      }
      if (
        (row.id === 'decking' ||
          /^deck(?:\s*\/\s*patio)?$/i.test(row.name.trim())) &&
        !notesNameAffirmativeDeckOrPatio(draft.originalNotes)
      ) {
        return false;
      }
      return true;
    });
    const shellListed = kept.some(row =>
      [
        'foundation',
        'framing',
        'drywall',
        'roofing',
        'insulation',
        'windows',
        'hvac',
      ].includes(row.id)
    );
    if (shellListed && notesDescribeGroundUpHome(draft.originalNotes)) {
      const ids = new Set(extra.map(row => row.id));
      const names = new Set(extra.map(row => row.name.trim().toLowerCase()));
      const pushMissing = (id: string, name: string) => {
        if (ids.has(id) || names.has(name.toLowerCase())) return;
        extra.push({ id, name });
        ids.add(id);
        names.add(name.toLowerCase());
      };
      pushMissing('cabinets', 'Cabinets / vanity');
      pushMissing('countertops', 'Counters');
      pushMissing('interior_trim', 'Finish carpentry');
      if (/\bgarages?\b/i.test(draft.originalNotes || '')) {
        pushMissing('garage_doors', 'Garage doors');
      }
      if (
        /\b(?:driveway|front\s+walks?|walkways?|flatwork|sidewalks?)\b/i.test(
          draft.originalNotes || ''
        )
      ) {
        pushMissing('pour_flatwork', 'Exterior concrete flatwork');
      }
    }
    return [
      { name: groundUpLine, amount: 0 },
      ...groundUpNamedRevealLines(draft.originalNotes).map(name => ({
        name,
        amount: 0,
      })),
      ...extra.map(row => ({ name: row.name, amount: 0 })),
    ];
  }
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
    const name = String(pkg.name || pkg.scope || '');
    if (
      notesOpeningMentionIsKeepOnly(draft.originalNotes, 'windows') &&
      (id === 'windows' ||
        id === 'window_install' ||
        /^window install\b/i.test(name))
    ) {
      return false;
    }
    if (
      (notesDoorMentionIsPaintOrKeepOnly(draft.originalNotes) ||
        notesOpeningMentionIsKeepOnly(draft.originalNotes, 'doors')) &&
      (id === 'interior_door_install' ||
        id === 'doors' ||
        id === 'interior_doors' ||
        /^interior door installation\b/i.test(name))
    ) {
      return false;
    }
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
        const quantity = groundUpExteriorFinishRevealQuantity(
          draft,
          row.name,
          row.quantityOverride !== undefined
            ? row.quantityOverride
            : formatScopeQuantity(
                {
                  ...(pkg || {}),
                  checklistItemId: row.id,
                } as EstimateDraftScopePackage,
                draft
              )
        );
        const priced = revealRowAmount(draft, pkg);
        const applied =
          priced > 0 ? priced : appliedAliasRevealAmount(draft, id);
        const statedScope = statedWholeHomeRevealAmount(draft, id);
        const statedTrim =
          statedScope || applied > 0 ? null : statedTrimRevealAmount(draft, id);
        const amount = withBathroomSuggestedAmount(
          draft,
          id,
          statedScope?.total || (applied > 0 ? applied : statedTrim?.total || 0)
        );
        const trimQuantity = !quantity ? statedTrim?.quantity : null;
        return {
          name: row.name,
          amount,
          ...(quantity || trimQuantity
            ? { quantity: quantity || trimQuantity }
            : {}),
        };
      })
      .filter(row => row.name);
    const representedIds = new Set(scopeRows.map(row => row.id));
    const packageOnlyRows = packages
      .filter(pkg => {
        const id = String(pkg.checklistItemId || pkg.costCode || '').trim();
        if (representedIds.has(id)) return false;
        if (
          plumbingPlanImportReveal(draft) &&
          (id === 'plumbing' ||
            /^plumbing work$/i.test(String(pkg.name || pkg.scope || '')))
        ) {
          return false;
        }
        return true;
      })
      .map(pkg => {
        const quantity = formatScopeQuantity(pkg, draft);
        const packageId = String(pkg.checklistItemId || pkg.costCode || '').trim();
        return {
          name: String(pkg.name || pkg.scope || 'Scope item').trim(),
          amount: withBathroomSuggestedAmount(
            draft,
            packageId,
            revealRowAmount(draft, pkg)
          ),
          ...(quantity ? { quantity } : {}),
        };
      })
      .filter(
        row => row.name && !hideUnnamedBathroomPaintScopeRow(draft, row)
      );
    return normalizeAdditionRevealPreviewRows(draft, [
      ...checklistRows,
      ...packageOnlyRows,
    ]).slice(0, 50);
  }
  if (!scopeRows.length) return [];
  return scopeRows.slice(0, 50).map(row => {
    const quantity = groundUpExteriorFinishRevealQuantity(
      draft,
      row.name,
      row.quantityOverride
    );
    const applied =
      revealRowAmount(draft, undefined) ||
      appliedAliasRevealAmount(draft, row.id);
    const statedScope = statedWholeHomeRevealAmount(draft, row.id);
    const statedTrim =
      statedScope || applied > 0 ? null : statedTrimRevealAmount(draft, row.id);
    const amount = withBathroomSuggestedAmount(
      draft,
      row.id,
      statedScope?.total || (applied > 0 ? applied : statedTrim?.total || 0)
    );
    const trimQuantity = !quantity ? statedTrim?.quantity : null;
    return {
      name: row.name,
      amount,
      ...(quantity || trimQuantity
        ? { quantity: quantity || trimQuantity }
        : {}),
    };
  });
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
  if (
    initialRevealPricingVisible(draft) &&
    draftHasSelectedScopePrices(draft)
  ) {
    return null;
  }
  const electricalRows = appliedElectricalConfirmScopePreview(draft);
  if (
    electricalRows &&
    electricalRows.length > 0 &&
    electricalRows.every(row => row.amount > 0)
  ) {
    return null;
  }
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

/** What we found is the same list as Scope, so the screen should say it once. */
export function understoodRepeatsScopePreview(
  understood: string[],
  preview: Array<{ name: string }>
): boolean {
  if (!understood.length || !preview.length) return false;
  const names = new Set(
    preview.map(row => row.name.trim().toLowerCase()).filter(Boolean)
  );
  return understood.every(line => names.has(line.trim().toLowerCase()));
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
  if (
    hvacPlanImportStatesNewBuildSystem(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return { label: 'Tonnage needed', tone: 'review' };
  }
  if (vagueScopeQuestion(draft.originalNotes)) {
    return { label: 'Needs scope', tone: 'review' };
  }
  if (attentionCount === 0 && level === 'high') {
    return { label: 'Ready to send', tone: 'ready' };
  }
  if (attentionCount === 0) {
    return { label: 'Mostly ready', tone: 'mostly' };
  }
  if (wholeHousePlanExport(draft)) {
    return {
      label:
        attentionCount === 1
          ? 'Mostly ready · 1 plan count'
          : `Mostly ready · ${attentionCount} plan counts`,
      tone: 'review',
    };
  }
  if (attentionCount === 1) {
    return { label: 'Mostly ready · 1 to check', tone: 'review' };
  }
  return { label: `Mostly ready · ${attentionCount} to check`, tone: 'review' };
}

export function getInitialRevealAttentionTitle(
  draft: EstimateAiDraft,
  needsScopeConfirmation: boolean
): string {
  if (!needsScopeConfirmation) return 'Needs your attention';
  if (vagueScopeQuestion(draft.originalNotes)) {
    return 'Needs your attention';
  }
  if (noteExclusionNotices(draft.originalNotes).length > 0) {
    return 'Needs your attention';
  }
  return wholeHousePlanExport(draft) ? 'Counts to confirm' : 'Pricing needed';
}

export function getInitialRevealDisplayTitle(draft: EstimateAiDraft): string {
  const vagueTitle = vagueScopeTitle(draft.originalNotes);
  if (vagueTitle) return vagueTitle;
  if (notesNameDedicatedHvacServiceVisit(draft.originalNotes)) {
    return 'HVAC service call';
  }
  const classification = getRevealClassification(draft);
  if (classification.scopeTradeLabels.join(' · ') === 'Painting') {
    return 'Painting';
  }
  if (stuccoPlanExport(draft)) {
    return 'Stucco';
  }
  const planHouseTitle = wholeHousePlanTitle(draft);
  if (planHouseTitle) return planHouseTitle;
  if (notesDescribeGroundUpHome(draft.originalNotes)) {
    const groundUpTitle = groundUpHomeRevealTitle(draft);
    if (groundUpTitle) return groundUpTitle;
  }
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
  const groundUpTitle = groundUpHomeRevealTitle(draft);
  if (groundUpTitle) return groundUpTitle;
  const titled = draft.projectTitle?.trim();
  if (titled && !/^your project$/i.test(titled)) {
    return titled;
  }
  const dedicatedHvacTitle = dedicatedHvacRevealTitle(draft.originalNotes);
  if (dedicatedHvacTitle) return dedicatedHvacTitle;
  if (draft.projectType && draft.projectType !== 'other') {
    const label = draft.projectType.replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (draft.customerName?.trim()) {
    return draft.customerName.trim();
  }
  return dedicatedHvacRevealTitle(draft.originalNotes) || 'Your project';
}

function dedicatedHvacRevealTitle(
  notes: string | null | undefined
): string | null {
  const equipment = dedicatedHvacEquipmentScopeLabel(notes);
  if (equipment) return equipment;
  if (!notesNameDedicatedHvacEquipmentJob(notes)) return null;
  const ductFeet = hvacDuctworkFeet(notes);
  if (ductFeet != null) return `${ductFeet} LF ductwork`;
  const thermostatCount = hvacNamedCount(notes, 'thermostats?');
  if (
    thermostatCount != null &&
    !hvacNotesLeaveOptionAlone(notes, 'thermostat')
  ) {
    return `${thermostatCount} thermostat${thermostatCount === 1 ? '' : 's'}`;
  }
  return hvacSupplyRegisterLabel(notes) || hvacReturnGrilleLabel(notes);
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
    bathroom: 'Bathroom',
    bath: 'Bathroom',
    drywall: 'Drywall',
    concrete: 'Concrete',
    painting: 'Painting',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    hvac: 'HVAC',
    roofing: 'Roofing',
    windows_doors: 'Windows & doors',
    windows: 'Windows',
    stucco: 'Stucco',
    insulation: 'Insulation',
    trim: 'Trim',
  };
  const notes = String(draft.originalNotes || '');
  if (notesNameAtticInsulationWithDrywallHang(notes)) {
    return {
      scopeMode: 'mixed',
      scopeSummary: 'Attic insulation and drywall',
      scopeTradeLabels: ['Drywall', 'Insulation'],
    };
  }
  if (notesNameConcretePatioWithSod(notes)) {
    return {
      scopeMode: 'mixed',
      scopeSummary: 'Concrete patio and sod',
      scopeTradeLabels: ['Concrete', 'Landscaping'],
    };
  }
  if (notesNameWallAreaFramingWithFlooring(notes)) {
    const lvp = /\b(?:lvp|luxury\s+vinyl)\b/i.test(notes);
    return {
      scopeMode: 'mixed',
      scopeSummary: lvp ? 'Wall framing and LVP' : 'Wall framing and flooring',
      scopeTradeLabels: ['Framing', 'Flooring'],
    };
  }
  if (notesNameStuccoWithWindows(notes)) {
    return {
      scopeMode: 'mixed',
      scopeSummary: 'Stucco and windows',
      scopeTradeLabels: ['Stucco', 'Windows'],
    };
  }
  const planRecord = draft.scopeMeasurements as
    | { planImportMode?: string | null; planImportTradeKey?: string | null }
    | null
    | undefined;
  const checklistKey = String(draft.scopeChecklist?.templateKey || '').toLowerCase();
  const planTradeKey = String(planRecord?.planImportTradeKey || '').toLowerCase();
  const paintingExport =
    planTradeKey === 'painting' || checklistKey === 'painting';
  if (paintingExport) {
    return {
      scopeMode: 'dedicated',
      scopeSummary: null,
      scopeTradeLabels: ['Painting'],
    };
  }
  const importedPlanSummary = notesAreImportedPlanSummary(notes);
  const selectedTradePlan = planRecord?.planImportMode === 'selected_trade';
  const hardscapeNotes = notesIgnoringPaverSurfaces(notes);
  const hasMixedExteriorHardscape =
    !importedPlanSummary &&
    !selectedTradePlan &&
    !notesDescribeGroundUpHome(notes) &&
    /\b(?:concrete|flatwork|patio|retaining\s+walls?)\b/i.test(hardscapeNotes) &&
    /\b(?:landscap(?:e|ing)|sod|turf|rock|mulch|shrubs?|plants?|irrigation|edging|pavers?|exterior\s+doors?)\b/i.test(
      notes
    );
  const mixedSignalText = notes
    .replace(/\bno\s+(?:new\s+)?paint(?:ing)?\b/gi, ' ')
    .replace(/\bshower\s+doors?\b/gi, ' ')
    .replace(/\bat\s+the\s+floor\b/gi, ' ')
    .replace(
      /[^.]*\bleave\b[^.]{0,80}\b(?:bath(?:room)?\s+floor|vanity|toilet)\b[^.]*/gi,
      ' '
    );
  const mixedNoteSignals = [
    /\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet)\b/i,
    /\b(?:drywall|sheetrock|gypsum|patch|repair)\b/i,
    /\b(?:paint(?:ing)?|repaint)\b/i,
    /\b(?:insulat(?:e|ion|ed)|R[-\s]?\d{2,3})\b/i,
    /\bwindows?\b|\b(?:interior\s+)?doors?\b/i,
  ].filter(pattern => pattern.test(mixedSignalText)).length;
  const bathroomNoteKeepsDedicated =
    /\b(?:bath(?:room)?|wet\s+area|shower)\b/i.test(notes) &&
    !/\b(?:framing|wall\s+framing|frame\s+(?:out|up|the\s+walls?|the\s+house|the\s+addition))\b/i.test(
      notes
    );
  const notesImplyMixedScope =
    !importedPlanSummary &&
    !selectedTradePlan &&
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
        /windows?\s*&\s*doors?|windows?\s+and\s+doors?|^windows?$/.test(
          normalized
        ) &&
        notesOpeningMentionIsKeepOnly(notes, 'windows') &&
        (notesDoorMentionIsPaintOrKeepOnly(notes) ||
          notesOpeningMentionIsKeepOnly(notes, 'doors'))
      ) {
        return null;
      }
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
      !bathroomNoteKeepsDedicated &&
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
  const visible = prioritized
    .filter(item => {
      if (
        notesOpeningMentionIsKeepOnly(draft.originalNotes, 'windows') &&
        /window install/i.test(item)
      ) {
        return false;
      }
      if (
        (notesDoorMentionIsPaintOrKeepOnly(draft.originalNotes) ||
          notesOpeningMentionIsKeepOnly(draft.originalNotes, 'doors')) &&
        /interior door/i.test(item)
      ) {
        return false;
      }
      return true;
    })
    .slice(0, max)
    .map(plainLanguageReviewItem);
  const hidden = Math.max(0, prioritized.length - max) + overflow;
  return { items: visible, overflow: hidden };
}

/** One-line positive summary for the hero area. */
export function getInitialRevealTagline(draft: EstimateAiDraft): string | null {
  if (vagueScopeQuestion(draft.originalNotes)) return null;
  if (
    notesUseDedicatedDrywallScope(draft.originalNotes) ||
    notesDescribeSheetrockFinishJob(draft.originalNotes) ||
    notesDescribeNoteRatedDrywallJob(draft.originalNotes)
  ) {
    return 'Detected drywall job.';
  }
  const electricalNotes = String(draft.originalNotes || '');
  if (
    notesDescribeDedicatedElectricalDeviceJob(electricalNotes) &&
    !notesDescribeDedicatedKitchenRemodel(electricalNotes) &&
    !notesNameKitchenSurfaceInstall(electricalNotes) &&
    !draft.scopeMeasurements?.planImportMode &&
    !draft.scopeMeasurements?.planImportFingerprint
  ) {
    return 'Detected electrical.';
  }
  const revealProjectType = String(draft.projectType || '').toLowerCase();
  const revealTemplateKey = String(
    draft.scopeChecklist?.templateKey || ''
  ).toLowerCase();
  if (wholeHousePlanExport(draft)) {
    return 'Read from the plan. Unprinted trades are planning allowances.';
  }
  const windowsTagline = windowsDoorsPlanTagline(
    draft.scopeMeasurements as Record<string, unknown> | null | undefined
  );
  if (windowsTagline) return windowsTagline;
  const concreteMeasurements = draft.scopeMeasurements as
    | {
        planImportTradeKey?: string | null;
        concretePatioSqft?: number | string | null;
        measurementProvenance?: Record<string, unknown> | null;
      }
    | null
    | undefined;
  if (
    String(concreteMeasurements?.planImportTradeKey || '') === 'concrete' &&
    Number(concreteMeasurements?.concretePatioSqft) > 0 &&
    concreteCoverPatioProvenance(
      concreteMeasurements?.measurementProvenance?.concretePatioSqft
    )
  ) {
    return 'Covered patio from the cover sheet.';
  }
  if (
    drywallCoverSheetPackage(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return 'Living and garage areas from the cover sheet.';
  }
  if (
    framingCoverSheetPackage(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return FRAMING_COVER_SHEET_TAGLINE;
  }
  if (
    flooringPlanExport(draft) &&
    positiveRevealNumber(
      (draft.scopeMeasurements as { floorAreaSqft?: unknown } | null)
        ?.floorAreaSqft
    )
  ) {
    return 'Living area from the cover sheet.';
  }
  if (
    insulationPlanFootprintPackage(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return INSULATION_PLAN_FOOTPRINT_TAGLINE;
  }
  if (
    notesDescribeGroundUpHome(draft.originalNotes) &&
    (revealProjectType === 'new_build' ||
      revealProjectType === 'stucco' ||
      revealTemplateKey === 'ground_up' ||
      revealTemplateKey === 'stucco')
  ) {
    return 'Detected new build.';
  }
  if (
    hvacPlanImportStatesNewBuildSystem(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return NEW_BUILD_HVAC_SYSTEM_ASSUMPTION_COPY;
  }
  if (roofingPlanScopeOwnsReveal(draft)) {
    const squares = positiveRevealNumber(
      (draft.scopeMeasurements as { roofSquares?: unknown } | null)?.roofSquares
    );
    if (squares) {
      return `${roofCoveringName(draft)} · ${squares.toLocaleString('en-US')} squares.`;
    }
  }
  const noteRoofingRows = dedicatedRoofingNoteRevealRows(draft);
  const noteRoofingSquares = noteRoofingRows?.find(row =>
    /squares/i.test(String(row.quantity || ''))
  );
  if (noteRoofingSquares?.quantity) {
    return `${noteRoofingSquares.name} · ${noteRoofingSquares.quantity}.`;
  }
  const roofingPriced = appliedRoofingConfirmScopePreview(draft);
  if (roofingPriced.length) {
    const covering = roofCoveringName(draft);
    const squares = roofingPriced.find(row =>
      /squares/i.test(String(row.quantity || ''))
    );
    return squares?.quantity
      ? `${covering} · ${squares.quantity}.`
      : `${covering}.`;
  }
  if (
    notesNameDedicatedHvacServiceVisit(draft.originalNotes) ||
    notesNameDedicatedHvacEquipmentJob(draft.originalNotes)
  ) {
    return 'Detected HVAC.';
  }
  if (
    notesUseDedicatedDrywallScope(draft.originalNotes) ||
    notesDescribeSheetrockFinishJob(draft.originalNotes) ||
    notesDescribeNoteRatedDrywallJob(draft.originalNotes)
  ) {
    return 'Detected drywall job.';
  }
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
  if (notesDescribeDedicatedPaintingJob(draft.originalNotes)) {
    const paintLine = (draft.whatAiDid || []).find(line =>
      /walls and ceilings|interior painting/i.test(String(line))
    );
    if (paintLine) return String(paintLine).trim();
  }
  const classification = getRevealClassification(draft);
  if (
    classification.scopeTradeLabels.join(' · ') === 'Painting' ||
    stuccoPlanExport(draft)
  ) {
    return null;
  }
  if (notesDescribeMeasuredKitchenAndBathInterior(draft.originalNotes)) {
    return /\bhall\s+bath\b/i.test(String(draft.originalNotes || ''))
      ? 'Kitchen and hall bath.'
      : 'Kitchen and bathroom.';
  }
  if (classification.scopeMode === 'mixed') {
    // The scope list already names each job. A long tagline only repeats it.
    if (separateJobRevealRows(draft.originalNotes).length > 2) return null;
    const summary =
      classification.scopeSummary?.trim() || 'Mixed-scope remodel';
    const trades = classification.scopeTradeLabels
      .map(label => String(label).trim())
      .filter(Boolean);
    // The hero title is already the scope summary. Repeat the trades only.
    if (trades.length === 0) return summary;
    const title = getInitialRevealDisplayTitle(draft).trim().toLowerCase();
    if (summary.toLowerCase() === title) return trades.join(' · ');
    return `${summary} · ${trades.join(' · ')}`;
  }
  if (plumbingPlanAwaitsContractorCounts(draft)) {
    return plumbingUnprintedPlanTagline(
      plumbingPlanLabeledBathNames(plumbingPlanRooms(draft))
    );
  }
  if (isPlumbingRevealDraft(draft)) {
    if (appliedPlumbingPriceRows(draft).length > 0) return null;
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
  const bullets = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 6)
    .filter(
      line =>
        !whatAiDidNamesUnstatedPaint(line, draft.originalNotes) &&
        !whatAiDidClaimsUnstatedTotals(line, draft.originalNotes) &&
        !whatAiDidNamesUnlistedScope(line, draft)
    )
    .map(line =>
      /detected flooring job/i.test(line) &&
      dedicatedBathroomRemodelNote(draft.originalNotes)
        ? 'Detected bathroom remodel.'
        : line
    );
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
  if (vagueScopeQuestion(draft.originalNotes)) return [];
  if (
    framingCoverSheetPackage(
      draft.scopeMeasurements as Record<string, unknown> | null
    )
  ) {
    return [];
  }
  if (electricalDeviceNoteOwnsReveal(draft)) {
    return dedicatedElectricalRevealLines(draft.originalNotes);
  }
  if (windowsDoorsNoteOwnsReveal(draft)) {
    return dedicatedWindowsDoorsRevealLines(draft.originalNotes);
  }
  if (insulationNoteOwnsReveal(draft)) {
    return dedicatedInsulationRevealLines(draft.originalNotes);
  }
  if (stuccoNoteOwnsReveal(draft)) {
    return dedicatedStuccoRevealLines(draft.originalNotes);
  }
  if (notesDescribeAreaOnlyAddition(draft.originalNotes)) {
    const sqft = areaOnlyAdditionSqft(draft.originalNotes);
    if (sqft) {
      return [`Room addition · ${sqft.toLocaleString('en-US')} sqft`].slice(0, max);
    }
  }
  const groundUpLine = groundUpLivingRevealLine(draft.originalNotes);
  if (groundUpLine) {
    const lines = [
      groundUpLine,
      ...groundUpNamedRevealLines(draft.originalNotes),
    ];
    return lines.slice(0, Math.min(6, Math.max(max, lines.length)));
  }
  if (notesNameDedicatedHvacServiceVisit(draft.originalNotes)) {
    return ['1 HVAC service call'];
  }
  if (
    /\bmini[\s-]?splits?\b/i.test(String(draft.originalNotes || '')) &&
    hvacNotesDropSystemPackage(draft.originalNotes)
  ) {
    return ['1 mini-split'];
  }
  if (
    notesNameDedicatedHvacEquipmentJob(draft.originalNotes) &&
    /\bair\s*handlers?\b/i.test(String(draft.originalNotes || '')) &&
    !hvacNotesLeaveOptionAlone(draft.originalNotes, 'air_handler')
  ) {
    return ['1 air handler'];
  }
  const ductFeet = hvacDuctworkFeet(draft.originalNotes);
  if (
    ductFeet != null &&
    notesNameDedicatedHvacEquipmentJob(draft.originalNotes)
  ) {
    return [`${ductFeet} LF ductwork`];
  }
  const furnaceCount = hvacNamedCount(draft.originalNotes, 'furnaces?');
  if (
    furnaceCount != null &&
    furnaceCount > 1 &&
    notesNameDedicatedHvacEquipmentJob(draft.originalNotes) &&
    !hvacNotesLeaveOptionAlone(draft.originalNotes, 'furnace')
  ) {
    return [`${furnaceCount} furnaces`];
  }
  const supplyRegisterLabel = hvacSupplyRegisterLabel(draft.originalNotes);
  if (supplyRegisterLabel) return [supplyRegisterLabel];
  const returnGrilleLabel = hvacReturnGrilleLabel(draft.originalNotes);
  if (returnGrilleLabel) return [returnGrilleLabel];
  const thermostatCount = hvacNamedCount(draft.originalNotes, 'thermostats?');
  if (
    thermostatCount != null &&
    notesNameDedicatedHvacEquipmentJob(draft.originalNotes) &&
    !hvacNotesLeaveOptionAlone(draft.originalNotes, 'thermostat')
  ) {
    return [
      `${thermostatCount} thermostat${thermostatCount === 1 ? '' : 's'}`,
    ];
  }
  if (roofingPlanScopeOwnsReveal(draft)) {
    return roofingPlanOnlyScopeRows(draft)
      .map(row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`)
      .slice(0, Math.max(max, 3));
  }
  if (stuccoPlanExport(draft)) {
    return stuccoPlanScopeRows(draft)
      .map(row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`)
      .slice(0, Math.max(max, 4));
  }
  if (flooringPlanExport(draft)) {
    return flooringPlanScopeRows(draft)
      .map(row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`)
      .slice(0, Math.max(max, 2));
  }
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
    if (plumbingPlanAwaitsContractorCounts(draft)) {
      const baths = plumbingPlanLabeledBathNames(plumbingPlanRooms(draft));
      if (baths.length > 0) return baths.slice(0, max);
      return ['Fixture counts and pipe lengths are not printed.'].slice(0, max);
    }
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
    if (fromPackages.length > 0) return fromPackages;
  }

  if (isRoofingRevealDraft(draft) && roofingRevealHasPlanningInputs(draft)) {
    const fromPackages = getScopePackagesForReview(draft)
      .map(pkg => String(pkg.name || pkg.scope || 'Scope item').trim())
      .filter(Boolean);
    if (fromPackages.length > 0) return fromPackages;
  }

  const fromAi = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], max + 2)
    .map(plainLanguageReviewItem)
    .filter(line => {
      if (
        /no material or labor|rates were provided|no pricing was calculated/i.test(
          line
        )
      ) {
        return false;
      }
      // After Confirm Scope, the selected prices are the bid. A draft line
      // that still says pricing is needed is stale.
      if (initialRevealPricingVisible(draft) && /pricing needed/i.test(line)) {
        return false;
      }
      if (whatAiDidNamesUnstatedPaint(line, draft.originalNotes)) return false;
      if (whatAiDidClaimsUnstatedTotals(line, draft.originalNotes)) return false;
      if (whatAiDidNamesUnlistedScope(line, draft)) return false;
      return true;
    });
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
  if (vagueScopeQuestion(draft.originalNotes)) {
    return {
      heroTotal: null,
      heroTotalLabel: 'Initial estimate',
      markupPct: null,
      material: null,
      labor: null,
      allowance: null,
      estimatedWithMarkup: null,
      scopeItemCount: 0,
    };
  }
  const scopePackages = getScopePackagesForReview(draft);
  const appliedScopeBreakdown = sumStep3ReviewBudgetTotals(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const liveScopeTotal = sumLiveScopePackageTotals(draft);
  const indicativeScopeTotal =
    initialRevealPricingVisible(draft) && roofingRevealHasPlanningInputs(draft)
      ? sumIndicativeScopePackageTotals(draft)
      : 0;
  const electricalCardRows = appliedElectricalConfirmScopePreview(draft);
  const electricalCardTotal = electricalCardRows
    ? Math.round(
        electricalCardRows.reduce((sum, row) => sum + row.amount, 0) * 100
      ) / 100
    : 0;
  const calculatedTotal =
    appliedScopeBreakdown && appliedScopeBreakdown.total > 0
      ? appliedScopeBreakdown.total
      : liveScopeTotal > 0
        ? liveScopeTotal
        : electricalCardTotal > 0
          ? electricalCardTotal
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

/** Confirm scope already has selected card prices, so the summary is not still waiting on a price. */
export function draftHasSelectedScopePrices(
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft) return false;
  const acceptance = (
    draft.scopeMeasurements as {
      pricingAcceptance?: Record<
        string,
        { selectionStatus?: string; totalAmount?: number }
      >;
    } | null
  )?.pricingAcceptance;
  if (acceptance) {
    for (const row of Object.values(acceptance)) {
      if (!row) continue;
      const status = String(row.selectionStatus || '');
      if (
        (status === 'accepted' ||
          status === 'manual_adjusted' ||
          status === 'user_entered') &&
        Number(row.totalAmount) > 0
      ) {
        return true;
      }
    }
  }
  return (draft.scopePackages || []).some(pkg => {
    const price = Number(pkg.price);
    return (
      price > 0 &&
      (pkg.status === 'confirmed' ||
        pkg.status === 'user_provided' ||
        pkg.priceProvidedByUser === true)
    );
  });
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
  if (!draft) return false;
  if (vagueScopeQuestion(draft.originalNotes)) return true;
  if (!isComplexEstimateTier(draft)) return false;
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
