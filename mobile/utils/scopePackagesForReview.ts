import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackagesRaw } from '@/utils/estimateAiDraft';
import {
  ensureBathroomChecklistItems,
  ensureGroundUpFlatworkScopeCard,
  ensureGroundUpOpeningScopeCards,
  expandWetAreaDerivedScopeItems,
  dedupeScopeChecklistItems,
  groupScopeChecklistItems,
  normalizeScopeChecklistItems,
  filterRoomRemodelNoteScopeItems,
  syncInteriorPaintScopeItems,
  syncWindowInstallScopeFromNotes,
  WET_AREA_DERIVED_ITEM_IDS,
  type ScopeChecklistGroupingContext,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import { benchmarkEngineV1Enabled } from '@/utils/benchmarkEngine';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics/flags';
import type { NormalizedScopeMeasurements } from '@/utils/scopeItemQuantities';
import {
  syncBathroomFixtureQmScopeItems,
  expandBathroomFixtureScopeDisplayItems,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  bathroomFixtureScopeCardVisible,
  BATHROOM_FIXTURES_QM_EMBEDDED_IDS,
} from '@/utils/qmScopePanels/bathroomFixtures';
import {
  expandHvacEquipmentScopeDisplayItems,
  getQmEmbeddedScopeIds,
  isPhotoNotesScopeJob,
  KITCHEN_QM_EMBEDDED_IDS,
  shouldHideKitchenScopeCardInQmEmbed,
  syncQmPanelScopeItems,
} from '@/utils/qmScopePanels';
import type { QmPhotoNotesContext } from '@/utils/qmScopePanels/types';
import {
  isWholeHomeQuickMeasurementTemplate,
  resolveEffectiveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';
import { checklistItemInScope, lookupRuleKeyForPackage, ruleKeysToTryForPackage } from '@/utils/scopeItemQuantities';
import {
  expandBathroomWetAreaDemoScopeDisplayItems,
  finalizeWetAreaDemoScopeFromMeasurements,
} from '@/utils/wetAreaDemoScopeGate';
import {
  finalizeWetAreaInstallScopeFromMeasurements,
} from '@/utils/wetAreaInstallScopeGate';

export type ConfirmScopeVisibleRowsContext = {
  templateKey?: string | null;
  projectType?: string | null;
  measurements: Record<string, unknown>;
  /** Step 3 hides the wet-area picker row and shows derived install lines instead. */
  forStep3Review?: boolean;
};

const INTERIOR_FINISH_CHILD_IDS = new Set([
  'insulation',
  'drywall',
  'paint_trim',
  'cabinets_counters',
  'cabinets',
  'countertops',
  'tile_flooring',
  'floor_tile',
  'shower_tile',
  'shower_floor_tile',
  'appliances',
]);
const HVAC_PACKAGE_COMPONENT_IDS = new Set([
  'ductwork',
  'supply_registers',
  'return_grilles',
  'thermostat',
]);

/**
 * Expand checklist rows for Confirm Scope UI and Applied-pricing totals.
 * Step 2 and Step 3 must share this list so footer totals match review rows.
 */
export function buildConfirmScopeDisplayItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  templateKey?: string | null,
  notes?: string | null
): ScopeChecklistItem[] {
  let expanded = dedupeScopeChecklistItems(expandWetAreaDerivedScopeItems(items)).map((row) =>
    row.id === 'exterior' && row.label === 'Exterior finishes'
      ? { ...row, label: 'Exterior Envelope' }
      : row
  );
  const noteText = String(notes || '');
  const explicitFlooringProduct =
    /\b(?:lvp|luxury\s+vinyl|laminate|engineered\s+hardwood|solid\s+hardwood|carpet|floor\s+tile|tile\s+floor|vinyl\s+plank)\b/i.test(
      noteText
    );
  const explicitDrywallRepair =
    /\b(?:patch(?:ing)?|repair(?:ed)?)\b[^.;,\n]{0,45}\bdrywall\b|\bdrywall\b[^.;,\n]{0,45}\b(?:patch(?:ing)?|repair(?:ed)?)\b/i.test(
      noteText
    );
  const explicitDrywallArea =
    /\b(?:drywall|sheetrock|gypsum)\b[^.,;\n]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b|\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.,;\n]{0,35}\b(?:drywall|sheetrock|gypsum)\b/i.test(
      noteText
    );
  const genericExistingDrywall =
    /\bdrywall\b/i.test(noteText) &&
    (explicitDrywallRepair ||
      (/\b(?:demolition|demo|existing|removal|remove)\b/i.test(noteText) &&
        !explicitDrywallArea)) &&
    !/\b(?:hang|install|replace|finish)\b[^.;,\n]{0,45}\bdrywall\b|\bdrywall\b[^.;,\n]{0,45}\b(?:hang|install|replace|finish)\b/i.test(
      noteText
    );
  expanded = expanded.map(row => {
    if (row.id === 'flooring' && !explicitFlooringProduct) {
      return {
        ...row,
        label: 'Flooring installation',
        helperText:
          'Install the note-specified flooring area; confirm the flooring product.',
      };
    }
    if (row.id === 'drywall' && genericExistingDrywall) {
      return {
        ...row,
        label: 'Drywall patch / repair',
        helperText:
          'Localized drywall patching, texture match, and spot repair only. Confirm the affected repair area.',
      };
    }
    return row;
  });
  const noteBackedStructuralCards: Array<ScopeChecklistItem> = [];
  const noteMentionsWallDemolition =
    /\b(?:demolish|demolition|demo|remove|removal|tear[\s-]?out)\b[^.;,\n]{0,70}\b(?:nonstructural\s+)?walls?\b|\b(?:nonstructural\s+)?walls?\b[^.;,\n]{0,70}\b(?:demolish|demolition|demo|remove|removal|tear[\s-]?out)\b/i.test(
      noteText
    );
  const noteMentionsWallFraming =
    /\b(?:frame|framing|framed)\b[^.;\n]{0,70}\bwalls?\b|\bwalls?\b[^.;\n]{0,70}\b(?:frame|framing|framed)\b/i.test(
      noteText
    );
  const noteMentionsSheathing =
    /\b(?:structural\s+)?sheathing\b/i.test(noteText);
  const noteMentionsOpenings =
    /\b(?:\w+\s+)?(?:door|window)\s+openings?\b|\bheaders?\b/i.test(
      noteText
    );
  const noteMentionsExteriorTrimPaint =
    /\b(?:exterior|outside)\s+trim\b[^.;\n]{0,35}\b(?:paint|painting|finish)\b|\b(?:paint|painting|finish)\b[^.;\n]{0,35}\b(?:exterior|outside)\s+trim\b/i.test(
      noteText
    );
  const noteMentionsGenericPaint =
    /\b(?:paint(?:ing)?|repaint(?:ing)?)\b/i.test(noteText) &&
    !noteMentionsExteriorTrimPaint;
  if (noteMentionsWallDemolition) {
    noteBackedStructuralCards.push({
      id: 'demo',
      inputType: 'yes_no',
      label: 'Wall demolition / removal',
      helperText:
        'Demolish and remove the existing walls identified in the job notes.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (noteMentionsWallFraming) {
    noteBackedStructuralCards.push({
      id: 'framing',
      inputType: 'yes_no',
      label: 'Wall framing',
      helperText:
        'Frame the walls identified in the job notes; confirm the framing area or pricing.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (noteMentionsSheathing) {
    noteBackedStructuralCards.push({
      id: 'shear_sheathing',
      inputType: 'yes_no',
      label: 'Structural sheathing',
      helperText:
        'Install the structural wall sheathing identified in the job notes.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (noteMentionsOpenings) {
    noteBackedStructuralCards.push({
      id: 'openings',
      inputType: 'yes_no',
      label: 'Door / window openings',
      helperText:
        'Frame the rough openings identified in the job notes; confirm the opening count.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (
    noteMentionsGenericPaint &&
    !expanded.some(item =>
      ['paint', 'interior_paint', 'paint_repair', 'ceiling_paint'].includes(
        item.id
      )
    )
  ) {
    noteBackedStructuralCards.push({
      id: 'paint',
      inputType: 'yes_no',
      label: 'Interior paint',
      helperText:
        'Paint work is mentioned in the notes; confirm the wall/ceiling paint area.',
      category: 'finishes',
      state: 'included',
      noteBacked: true,
    });
  }
  if (noteMentionsExteriorTrimPaint) {
    const exteriorTrimCard: ScopeChecklistItem = {
      id: 'exterior_trim_paint',
      inputType: 'yes_no',
      label: 'Exterior trim paint',
      helperText:
        'Prep and paint the explicitly identified exterior trim. Surface area is separate from siding repairs.',
      category: 'finishes',
      state: 'included',
      noteBacked: true,
    };
    const exteriorTrimIndex = expanded.findIndex(
      item => item.id === 'exterior_trim_paint'
    );
    if (exteriorTrimIndex >= 0) {
      expanded[exteriorTrimIndex] = {
        ...expanded[exteriorTrimIndex],
        ...exteriorTrimCard,
      };
    } else {
      expanded.push(exteriorTrimCard);
    }
  }
  if (noteBackedStructuralCards.length) {
    for (const card of noteBackedStructuralCards) {
      const existingIndex = expanded.findIndex(item => item.id === card.id);
      if (existingIndex >= 0) {
        expanded[existingIndex] = {
          ...expanded[existingIndex],
          ...card,
        };
      } else {
        expanded.push(card);
      }
    }
  }
  if (
    ['flooring', 'room_remodel'].includes(
      String(templateKey || '').toLowerCase()
    ) &&
    !noteMentionsExteriorTrimPaint
  ) {
    // Window replacement justifies exterior prep/masking; it does not imply
    // painting the exterior trim around those openings.
    expanded = expanded.filter(row => row.id !== 'exterior_trim_paint');
  }
  const noteMentionsFlooringRemoval =
    /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.;\n]{0,60}\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b|\b(?:floor(?:ing)?|lvp|laminate|vinyl|carpet|tile)\b[^.;\n]{0,60}\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b/i.test(
      noteText
    );
  const noteMentionsDrywallDemolition =
    /\b(?:drywall|sheetrock|gypsum)\b[^.;\n]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b|\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;\n]{0,60}\b(?:drywall|sheetrock|gypsum)\b/i.test(
      noteText
    );
  if (
    noteMentionsFlooringRemoval &&
    !noteMentionsWallDemolition &&
    !noteMentionsDrywallDemolition
  ) {
    const hasFloorDemo = expanded.some(row => row.id === 'floor_demo');
    expanded = expanded
      .filter(row => !(hasFloorDemo && row.id === 'demo'))
      .map(row =>
        row.id === 'demo' || row.id === 'floor_demo'
          ? {
              ...row,
              id: 'floor_demo',
              label: 'Flooring removal / demolition',
              helperText:
                'Remove and dispose of the existing flooring in the measured area.',
            }
          : row
      );
    if (!expanded.some(row => row.id === 'floor_demo')) {
      expanded.push({
        id: 'floor_demo',
        inputType: 'yes_no',
        label: 'Flooring removal / demolition',
        helperText:
          'Remove and dispose of the existing flooring in the measured area.',
        category: 'demolition',
        state: 'included',
        noteBacked: true,
      });
    }
  }
  if (
    templateKey &&
    String(templateKey).toLowerCase() !== 'painting'
  ) {
    expanded = expanded.filter(row => row.id !== 'window_install');
  }
  if (String(templateKey || '').toLowerCase() === 'bathroom') {
    expanded = syncInteriorPaintScopeItems(expanded, {
      wallPaintSqft: measurements.wallPaintSqft as string | number | null,
      ceilingPaintSqft: measurements.ceilingPaintSqft as string | number | null,
      paintAreaSqft: measurements.paintAreaSqft as string | number | null,
      patchRepairSqft: (
        measurements.itemQuantities as
          | Record<string, { quantity?: string | number | null }>
          | undefined
      )?.patch_repair?.quantity ??
        (measurements.patchRepairSqft as string | number | null),
      paintAreaBasis: measurements.paintAreaBasis as
        | 'walls'
        | 'ceilings'
        | 'combined'
        | 'floor_area'
        | 'unknown'
        | null,
      paintPricingMethod: measurements.paintPricingMethod as
        | 'combined'
        | 'separate'
        | null,
      combinedPaintableAreaSqft: measurements.combinedPaintableAreaSqft as
        | string
        | number
        | null,
      paintScope: Array.isArray(measurements.paintScope)
        ? (measurements.paintScope as Array<
            'walls' | 'ceilings' | 'trim' | 'doors' | 'cabinets' | 'exterior'
          >)
        : null,
      notes: null,
    });
    expanded = expandBathroomFixtureScopeDisplayItems(expanded, measurements, templateKey);
    expanded = expandBathroomWetAreaDemoScopeDisplayItems(
      expanded,
      measurements,
      templateKey
    );
    expanded = finalizeWetAreaInstallScopeFromMeasurements(expanded, measurements);
    expanded = finalizeWetAreaDemoScopeFromMeasurements(expanded, measurements);
  }
  if (String(templateKey || '').toLowerCase() === 'ground_up') {
    expanded = ensureGroundUpFlatworkScopeCard(expanded);
    expanded = ensureGroundUpOpeningScopeCards(expanded);
  }
  expanded = filterRoomRemodelNoteScopeItems(expanded, notes);
  const ceilingOnlyPaintNote =
    /\b(?:paint|painting|repaint)\b[^.;,\n]{0,45}\bceilings?\b|\bceilings?\b[^.;,\n]{0,45}\b(?:paint|painting|repaint)\b/i.test(
      noteText
    ) &&
    !/\b(?:paint|painting|repaint)\b[^.;,\n]{0,45}\bwalls?\b|\bwalls?\b[^.;,\n]{0,45}\b(?:paint|painting|repaint)\b/i.test(
      noteText
    );
  if (ceilingOnlyPaintNote) {
    expanded = expanded.map(row =>
      ['paint', 'interior_paint', 'ceiling_paint'].includes(row.id)
        ? { ...row, label: 'Ceiling painting' }
        : row
    );
  }
  expanded = expandHvacEquipmentScopeDisplayItems(expanded, measurements);
  if (String(templateKey || '').toLowerCase() === 'flooring') {
    const existingTypes = Array.isArray(measurements.flooringExistingTypes)
      ? measurements.flooringExistingTypes
          .filter((type): type is string => typeof type === 'string' && type !== 'unknown')
          .map((type) => type.replace(/_/g, ' '))
      : [];
    const floorDemoSqft = Number(
      String(measurements.floorDemoSqft ?? '').replace(/,/g, '')
    );
    const measuredAreaDescription =
      Number.isFinite(floorDemoSqft) && floorDemoSqft > 0
        ? `Remove and dispose of ${floorDemoSqft.toLocaleString()} sqft of existing flooring before installation.`
        : 'Remove and dispose of the existing flooring before installation.';
    const existingDescription = existingTypes.length
      ? `Remove and dispose of the existing ${existingTypes.join(', ')} flooring before installing the selected new flooring.`
      : measuredAreaDescription;
    expanded = expanded.map((row) =>
      row.id === 'floor_demo'
        ? {
            ...row,
            label: 'Flooring removal / demolition',
            helperText: existingDescription,
          }
        : row
    );
  }
  if (!measurementSemanticsV1Enabled() || !benchmarkEngineV1Enabled()) {
    return dedupeScopeChecklistItems(expanded);
  }
  if (String(templateKey || '').toLowerCase() === 'room_remodel') {
    return dedupeScopeChecklistItems(expanded);
  }
  if (expanded.some((row) => row.id === 'interior_finishes')) {
    return dedupeScopeChecklistItems(expanded);
  }
  const hasFinishChild = expanded.some(
    (row) => INTERIOR_FINISH_CHILD_IDS.has(row.id) && checklistItemInScope(row)
  );
  if (!hasFinishChild) return dedupeScopeChecklistItems(expanded);
  const stageCard: ScopeChecklistItem = {
    id: 'interior_finishes',
    label: 'Interior Finishes',
    helperText:
      'Planning comparison only — price drywall, paint, cabinets, counters, and tile separately.',
    state: 'excluded',
    category: 'Finishes',
  };
  const drywallIdx = expanded.findIndex((row) => row.id === 'drywall');
  if (drywallIdx >= 0) {
    return dedupeScopeChecklistItems([
      ...expanded.slice(0, drywallIdx),
      stageCard,
      ...expanded.slice(drywallIdx),
    ]);
  }
  return dedupeScopeChecklistItems([...expanded, stageCard]);
}

/** Checklist rows for Applied-pricing math after Continue — mirrors Step 2 displayItems. */
export function confirmScopeDisplayItemsFromDraft(draft: EstimateAiDraft): ScopeChecklistItem[] {
  const base = draft.confirmedAssumptions?.length
    ? draft.confirmedAssumptions
    : draft.scopeChecklist?.items;
  if (!base?.length) return [];
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const templateKey = resolveEffectiveQuickMeasurementTemplateKey({
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    notes: draft.originalNotes,
  });
  return buildConfirmScopeDisplayItems(
    base,
    measurements,
    templateKey,
    draft.originalNotes
  );
}

/** QM embed context — same template resolution as Confirm Scope Step 2. */
export function resolveConfirmScopeQmContext(
  measurements: Record<string, unknown>,
  templateKey?: string | null,
  projectType?: string | null
): QmPhotoNotesContext {
  const living =
    Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
    Number(
      (measurements.planFacts as { buildingAreas?: { mainFloorLivingSqft?: number } } | undefined)
        ?.buildingAreas?.mainFloorLivingSqft
    ) ||
    null;
  const garage =
    Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
    Number(
      (measurements.planFacts as { buildingAreas?: { garageSqft?: number } } | undefined)?.buildingAreas
        ?.garageSqft
    ) ||
    null;
  const effectiveKey = resolveEffectiveQuickMeasurementTemplateKey({
    templateKey,
    projectType,
    planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
    livingSf: living,
    garageSf: garage,
  });
  return {
    templateKey: effectiveKey,
    wholeHomeLayout: isWholeHomeQuickMeasurementTemplate(effectiveKey),
  };
}

/** Match Step 2 `renderItem` — hide scope cards absorbed into Quick measurements. */
export function isScopeCardHiddenInQmEmbed(
  itemId: string,
  displayItems: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  qmCtx: QmPhotoNotesContext
): boolean {
  if (!isPhotoNotesScopeJob(qmCtx)) return false;
  // The roofing quick-measurement panel owns install/tear-off selection and
  // quantities. Do not also render the legacy zero-area Roofing replacement
  // card beside it.
  if (
    String(qmCtx.templateKey || '').toLowerCase() === 'roofing' &&
    (itemId === 'roofing' || itemId === 'roofing_system')
  ) {
    return true;
  }
  // Roofing QM owns selection and takeoff, but the selected components still
  // have independent pricing cards (tear-off, decking, drainage, etc.).
  if (String(qmCtx.templateKey || '').toLowerCase() === 'roofing') {
    return false;
  }
  const qmEmbeddedScopeIds = getQmEmbeddedScopeIds(qmCtx);
  if (!qmEmbeddedScopeIds.has(itemId)) return false;
  if (shouldHideBathroomFixtureScopeCardInQmEmbed(itemId, measurements, displayItems)) return true;
  if (BATHROOM_FIXTURES_QM_EMBEDDED_IDS.has(itemId)) return false;
  if (shouldHideKitchenScopeCardInQmEmbed(itemId, measurements, displayItems)) return true;
  if (KITCHEN_QM_EMBEDDED_IDS.has(itemId)) return false;
  return true;
}

/** Step 3 review — selected scope only (Yes / chosen options), same rules as Applied pricing. */
function isConfirmScopeReviewRowSelected(
  item: ScopeChecklistItem,
  displayItems: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): boolean {
  if (item.id === 'interior_finishes') return false;
  if (checklistItemInScope(item)) return true;
  return bathroomFixtureScopeCardVisible(item.id, measurements, displayItems);
}

/** The complete HVAC package owns standard distribution and controls in Step 3. */
function isHvacComponentAbsorbedByAppliedPackage(
  item: ScopeChecklistItem,
  displayItems: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  templateKey?: string | null
): boolean {
  if (String(templateKey || '').toLowerCase() !== 'hvac') return false;
  if (!HVAC_PACKAGE_COMPONENT_IDS.has(item.id)) return false;
  const packageItem = displayItems.find((candidate) => candidate.id === 'hvac');
  if (!packageItem || !checklistItemInScope(packageItem)) return false;
  const itemQuantities =
    measurements.itemQuantities &&
    typeof measurements.itemQuantities === 'object' &&
    !Array.isArray(measurements.itemQuantities)
      ? (measurements.itemQuantities as Record<
          string,
          { quantity?: unknown; unit?: unknown; quantitySource?: unknown }
        >)
      : {};
  const numberValue = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const hasAppliedMoney = ['material', 'labor', 'allowance'].some((part) => {
    const entry = itemQuantities[`hvac__${part}`];
    return (
      numberValue(entry?.quantity) > 0 &&
      (entry?.quantitySource === 'user_entered' ||
        entry?.quantitySource === 'manual_override')
    );
  });
  const acceptance =
    measurements.pricingAcceptance &&
    typeof measurements.pricingAcceptance === 'object'
      ? (measurements.pricingAcceptance as Record<string, unknown>).hvac
      : null;
  const direct = itemQuantities.hvac;
  const hasDirectAllowance =
    numberValue(direct?.quantity) > 0 &&
    ['allowance', 'lump_sum'].includes(String(direct?.unit || '').toLowerCase());
  return Boolean(hasAppliedMoney || hasDirectAllowance || acceptance);
}

/** Roofing system choice card owns install pricing — hide legacy shingles row. */
function shouldHideDuplicateRoofingShinglesRow(
  itemId: string,
  templateKey: string | null | undefined,
  displayItems: ScopeChecklistItem[]
): boolean {
  if (String(templateKey || '').toLowerCase() !== 'roofing' || itemId !== 'shingles_roofing') {
    return false;
  }
  return displayItems.some(
    item =>
      item.id === 'roofing_system' &&
      checklistItemInScope(item) &&
      Boolean(item.choiceId) &&
      !['not_in_scope', 'unsure'].includes(String(item.choiceId))
  );
}

/**
 * Flat scope row order shared by Step 2 cards and Step 3 review lines.
 * Step 3 uses the same top-to-bottom order but only rows selected on Confirm Scope.
 */
export function flattenConfirmScopeVisibleRows(
  displayItems: ScopeChecklistItem[],
  ctx: ConfirmScopeVisibleRowsContext
): ScopeChecklistItem[] {
  const qmCtx = resolveConfirmScopeQmContext(ctx.measurements, ctx.templateKey, ctx.projectType);
  const ordered = flattenChecklistDisplayOrder(displayItems, ctx.templateKey);

  return ordered.filter((item) => {
    // Step 2 hides QM-embedded cards in the scroll list; Step 3 must still list
    // every selected/applied scope line so review matches Applied pricing.
    if (
      !ctx.forStep3Review &&
      isScopeCardHiddenInQmEmbed(item.id, displayItems, ctx.measurements, qmCtx)
    ) {
      return false;
    }

    if (ctx.forStep3Review) {
      if (item.id === 'wet_area_install') return false;
      if (!isConfirmScopeReviewRowSelected(item, displayItems, ctx.measurements)) return false;
      if (
        isHvacComponentAbsorbedByAppliedPackage(
          item,
          displayItems,
          ctx.measurements,
          ctx.templateKey
        )
      ) {
        return false;
      }
      if (item.derivedFrom === 'wet_area_install') {
        const parent = displayItems.find((row) => row.id === 'wet_area_install');
        if (!parent || !checklistItemInScope(parent)) return false;
      }
    }

    if (shouldHideDuplicateRoofingShinglesRow(item.id, ctx.templateKey, displayItems)) {
      return false;
    }

    return true;
  });
}

export function confirmScopeReviewRowsFromDraft(draft: EstimateAiDraft): ScopeChecklistItem[] {
  const displayItems = confirmScopeDisplayItemsFromDraft(draft);
  if (!displayItems.length) return [];
  return flattenConfirmScopeVisibleRows(displayItems, {
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    measurements: (draft.scopeMeasurements || {}) as Record<string, unknown>,
    forStep3Review: true,
  });
}

/** Step 3 row title — same cleanup as Confirm Scope yes/no cards. */
export function scopeReviewDisplayLabel(item: ScopeChecklistItem): string {
  return String(item.label || 'Scope item')
    .replace(/\s*—\s*.*$/u, '')
    .replace(/\s*included\?\s*$/i, '')
    .trim();
}

/** Merge QM stepper counts into checklist rows before Step 3 / apply reconciliation. */
export function hydrateChecklistItemsForScopeReview(
  draft: EstimateAiDraft,
  overrideItems?: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const base = overrideItems?.length
    ? overrideItems
    : draft.confirmedAssumptions?.length
      ? draft.confirmedAssumptions
      : draft.scopeChecklist?.items;
  if (!base?.length) return [];

  const notes = draft.originalNotes || null;
  const templateKey = resolveEffectiveQuickMeasurementTemplateKey({
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    notes,
  });
  let items = base.map((item) => ({ ...item }));
  if (String(templateKey || '').toLowerCase() === 'painting') {
    const paintingItemIds = new Set([
      'prep',
      'interior_paint',
      'ceiling_paint',
      'trim_paint',
      'door_paint',
      'door_casing_paint',
      'cabinet_paint',
      'exterior_prep',
      'exterior_paint',
      'exterior_trim_paint',
      'baseboard_install',
      'interior_door_install',
      'door_casing_install',
      'window_install',
      'cleanup',
    ]);
    items = items.filter((item) => paintingItemIds.has(item.id));
  }
  items = ensureBathroomChecklistItems(items, templateKey);

  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  items = syncBathroomFixtureQmScopeItems(items, measurements);
  items = syncQmPanelScopeItems(
    items,
    { templateKey, wholeHomeLayout: false },
    measurements
  );
  items = normalizeScopeChecklistItems(items, templateKey, {
    notes,
    measurements: measurements as NormalizedScopeMeasurements,
  });
  items = syncWindowInstallScopeFromNotes(items, {
    notes,
    windowCount: measurements.windowCount as string | number | null,
    templateKey,
  });
  items = expandBathroomFixtureScopeDisplayItems(items, measurements, templateKey);

  items = finalizeWetAreaInstallScopeFromMeasurements(items, measurements);
  if (String(templateKey || '').toLowerCase() === 'painting') {
    const paintingItemIds = new Set([
      'prep',
      'interior_paint',
      'ceiling_paint',
      'trim_paint',
      'door_paint',
      'door_casing_paint',
      'cabinet_paint',
      'exterior_prep',
      'exterior_paint',
      'exterior_trim_paint',
      'baseboard_install',
      'interior_door_install',
      'door_casing_install',
      'window_install',
      'cleanup',
    ]);
    items = items.filter((item) => paintingItemIds.has(item.id));
  }
  items = filterRoomRemodelNoteScopeItems(items, notes);
  return items;
}

/** Same top-to-bottom order as Step 2 Confirm Scope (groups + wet-area derived rows). */
export function flattenChecklistDisplayOrder(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  context: ScopeChecklistGroupingContext = {}
): ScopeChecklistItem[] {
  const expanded = expandWetAreaDerivedScopeItems(items);
  const groups = groupScopeChecklistItems(
    expanded,
    templateKey || undefined,
    context
  );
  return groups.flatMap(group => group.items);
}

function packageMatchesChecklistItem(
  pkg: EstimateDraftScopePackage,
  itemId: string
): boolean {
  if (pkg.checklistItemId === itemId || pkg.costCode === itemId) return true;
  const primary = lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '');
  if (primary === itemId) return true;
  if (
    (primary === 'patch_repair' && itemId === 'drywall') ||
    (primary === 'drywall' && itemId === 'patch_repair')
  ) {
    return true;
  }
  if (itemId === 'wet_area_install' && /\bwet\s+area\s+install\b/i.test(`${pkg.name || ''} ${pkg.scope || ''}`)) {
    return true;
  }
  // Fallback: only when the package has no resolvable primary key.
  if (!primary) {
    return ruleKeysToTryForPackage(pkg.name || '', pkg.scope || '').includes(itemId);
  }
  return false;
}

function packageFromChecklistItem(
  item: ScopeChecklistItem,
  matched?: EstimateDraftScopePackage
): EstimateDraftScopePackage {
  const name = scopeReviewDisplayLabel(item);
  const scope = item.helperText || matched?.scope || name;
  if (matched) {
    return {
      ...matched,
      name,
      scope,
      checklistItemId: item.id,
      costCode: item.id,
    };
  }
  return {
    name,
    scope,
    checklistItemId: item.id,
    costCode: item.id,
    status: 'missing_price',
    priceSource: 'missing',
    price: null,
    knownSubtotal: null,
    applyEligible: false,
    missingPriceItems: ['Materials / supplies', 'Install labor'],
    pricingItems: [],
  };
}

function stubPackageFromChecklistItem(item: ScopeChecklistItem): EstimateDraftScopePackage {
  return packageFromChecklistItem(item);
}

/** Closeout cleanup is always the last Confirm Scope card — keep Step 3 aligned. */
function pinCleanupLast(packages: EstimateDraftScopePackage[]): EstimateDraftScopePackage[] {
  const cleanupIdx = packages.findIndex(
    (pkg) => pkg.checklistItemId === 'cleanup' || pkg.costCode === 'cleanup'
  );
  if (cleanupIdx < 0 || cleanupIdx === packages.length - 1) return packages;
  const cleanup = packages[cleanupIdx];
  return [...packages.slice(0, cleanupIdx), ...packages.slice(cleanupIdx + 1), cleanup];
}

/**
 * Step 3 scope list — one row per Confirm Scope checklist item (Step 2 order),
 * reusing AI packages where they exist and adding stubs for missing rows.
 */
export function reconcileScopePackagesForReview(
  draft: EstimateAiDraft,
  checklistItems?: ScopeChecklistItem[]
): EstimateDraftScopePackage[] {
  const base = getScopePackagesRaw(draft);
  const items = checklistItems?.length
    ? checklistItems
    : draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
      ? confirmScopeDisplayItemsFromDraft(draft)
      : hydrateChecklistItemsForScopeReview(draft);
  if (!items.length) return base;

  const templateKey = draft.scopeChecklist?.templateKey;
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const orderedItems = flattenConfirmScopeVisibleRows(items, {
    templateKey,
    projectType: draft.projectType,
    measurements,
    forStep3Review: true,
  });
  if (!orderedItems.length) return base;

  const usedPackageIndices = new Set<number>();
  const result: EstimateDraftScopePackage[] = [];

  for (const item of orderedItems) {
    if (item.derivedFrom === 'wet_area_install') {
      const parent = items.find((row) => row.id === 'wet_area_install');
      if (!parent || !checklistItemInScope(parent)) continue;
    }
    const matchIdx = base.findIndex(
      (pkg, idx) => !usedPackageIndices.has(idx) && packageMatchesChecklistItem(pkg, item.id)
    );
    if (matchIdx >= 0) {
      usedPackageIndices.add(matchIdx);
      result.push(packageFromChecklistItem(item, base[matchIdx]));
      continue;
    }
    result.push(stubPackageFromChecklistItem(item));
  }

  return pinCleanupLast(result);
}

export function getScopePackagesForReview(draft: EstimateAiDraft): EstimateDraftScopePackage[] {
  return reconcileScopePackagesForReview(draft);
}

/** Persist checklist-ordered scopePackages after Confirm Scope. */
export function withReconciledScopePackages(
  draft: EstimateAiDraft,
  confirmedItemsOverride?: ScopeChecklistItem[]
): EstimateAiDraft {
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const checklistItems = confirmedItemsOverride?.length
    ? buildConfirmScopeDisplayItems(
        confirmedItemsOverride,
        measurements,
        draft.scopeChecklist?.templateKey,
        draft.originalNotes
      )
    : confirmScopeDisplayItemsFromDraft(draft);
  if (!checklistItems.length) return draft;
  return {
    ...draft,
    scopePackages: reconcileScopePackagesForReview(draft, checklistItems),
  };
}
