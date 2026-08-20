import {
  calculateProjectComplexityMultiplier,
  complexityAppliesLaborOnly,
  inferProjectComplexitySettings,
  isProjectComplexityEligibleItem,
} from '@/utils/projectComplexityAdjustments';
import {
  buildAcceptanceFromSuggestedBlock,
  hasAcceptedScopePricing,
  liveScopeMoneyFromQuantities,
  type ScopePricingAcceptanceMetadata,
} from '@/utils/acceptedPricingSummaryUi';
import { ELECTRICAL_CARDS } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { FRAMING_CARDS } from '@/utils/subcontractorTrade/framingPlanConvergence';
import { reconcilePlumbingLineScopeMeasurements } from '@/utils/planTakeoffReviewUi';
import { PLUMBING_CARDS } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  allowanceSplitSubKey,
  buildNormalizedScopeMeasurementsFromInput,
  getChecklistItemQuantityRuleOrDefault,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  roughAllowanceSubKey,
  type ScopeItemQuantityValue,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';

const TAKEOFF_SUBKEY = /__(material|labor|allowance|sqft_basis)$/;

function parseTakeoffQuantity(
  entry?: { quantity?: string | number | null; unit?: string | null } | null
): number | null {
  const unit = String(entry?.unit || '').toLowerCase();
  if (['allowance', 'lump_sum'].includes(unit)) return null;
  const parsed = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMeasurementFieldQuantity(
  measurements: ScopeMeasurementsInputExtended,
  key: string
): number | null {
  const parsed = Number(
    String((measurements as Record<string, unknown>)[key] ?? '').replace(
      /,/g,
      ''
    )
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveItemTakeoffQuantity(
  measurements: ScopeMeasurementsInputExtended,
  itemId: string
): number | null {
  const card =
    PLUMBING_CARDS.find(entry => entry.itemId === itemId) ??
    ELECTRICAL_CARDS.find(entry => entry.itemId === itemId) ??
    FRAMING_CARDS.find(entry => entry.itemId === itemId);
  const fromItem = parseTakeoffQuantity(measurements.itemQuantities?.[itemId]);
  const fromField = card
    ? parseMeasurementFieldQuantity(measurements, card.measurementKey)
    : null;
  // LF line cards keep Quick Measurements and scope-card takeoff aligned.
  if (card?.unit === 'lf') {
    return fromField ?? fromItem;
  }
  return fromItem ?? fromField;
}

function shouldAutoResyncAppliedPricing(
  acceptance?: ScopePricingAcceptanceMetadata | null
): boolean {
  const status = String(acceptance?.selectionStatus || '');
  return status === 'accepted' || status === '';
}

function complexityContextChanged(
  previous: ScopeMeasurementsInputExtended,
  next: ScopeMeasurementsInputExtended
): boolean {
  const norm = (value: unknown) => String(value ?? '').replace(/,/g, '').trim();
  return (
    norm(previous.storyCount) !== norm(next.storyCount) ||
    norm(previous.floorAreaSqft) !== norm(next.floorAreaSqft) ||
    JSON.stringify(previous.projectComplexity ?? null) !==
      JSON.stringify(next.projectComplexity ?? null)
  );
}

function insulationAssemblyChanged(
  previous: ScopeMeasurementsInputExtended,
  next: ScopeMeasurementsInputExtended
): boolean {
  return (
    String(previous.insulationMaterialType || '') !==
      String(next.insulationMaterialType || '') ||
    String(previous.insulationRValue || '') !==
      String(next.insulationRValue || '') ||
    String(previous.garageInsulationIncluded || '') !==
      String(next.garageInsulationIncluded || '')
  );
}

function appliedComplexityEligibleItemIds(
  measurements: ScopeMeasurementsInputExtended,
  templateKey?: string | null
): string[] {
  const cards = [...PLUMBING_CARDS, ...ELECTRICAL_CARDS];
  return cards
    .map(card => card.itemId)
    .filter(itemId => isProjectComplexityEligibleItem(itemId, templateKey))
    .filter(itemId =>
      hasAcceptedScopePricing(
        itemId,
        measurements.itemQuantities,
        measurements.pricingAcceptance
      )
    );
}

function collectTakeoffQuantityChanges(
  previous: ScopeMeasurementsInputExtended,
  next: ScopeMeasurementsInputExtended
): string[] {
  const changed = new Set<string>();
  const prevQuantities = previous.itemQuantities || {};
  const nextQuantities = next.itemQuantities || {};

  for (const itemId of new Set([
    ...Object.keys(prevQuantities),
    ...Object.keys(nextQuantities),
  ])) {
    if (TAKEOFF_SUBKEY.test(itemId)) continue;
    const baseItemId = itemId.replace(/__(allowance|sqft_basis)$/, '');
    const prevQty = parseTakeoffQuantity(prevQuantities[itemId]);
    const nextQty = parseTakeoffQuantity(nextQuantities[itemId]);
    if (prevQty !== nextQty && (prevQty != null || nextQty != null)) {
      changed.add(baseItemId);
    }
  }

  for (const card of [...PLUMBING_CARDS, ...ELECTRICAL_CARDS, ...FRAMING_CARDS]) {
    const prevQty = parseMeasurementFieldQuantity(previous, card.measurementKey);
    const nextQty = parseMeasurementFieldQuantity(next, card.measurementKey);
    if (prevQty !== nextQty) changed.add(card.itemId);
  }

  return [...changed];
}

function scaleMoneyAmount(value: number | undefined, ratio: number): number | undefined {
  if (value == null || !(value > 0) || !(ratio > 0)) return value;
  return Math.round(value * ratio);
}

/** Reprice an Apply block onto the current Quick Measurements takeoff. */
export function scaleSuggestedBlockToTakeoffQuantity(
  block: SuggestedPricingBlock,
  takeoffQuantity: number | null | undefined
): SuggestedPricingBlock {
  const basisQty = Number(block.basis?.quantity);
  if (
    !(takeoffQuantity != null && takeoffQuantity > 0) ||
    !(basisQty > 0) ||
    Math.abs(takeoffQuantity - basisQty) < 0.01
  ) {
    return block;
  }
  const ratio = takeoffQuantity / basisQty;
  return {
    ...block,
    material: Math.round(block.material * ratio),
    labor: Math.round(block.labor * ratio),
    total: Math.round(block.total * ratio),
    basis: block.basis
      ? { ...block.basis, quantity: takeoffQuantity }
      : { quantity: takeoffQuantity, unit: 'lf' },
  };
}

function applySuggestedBlockToQuantities(
  itemId: string,
  block: SuggestedPricingBlock,
  itemQuantities: Record<string, ScopeItemQuantityValue>,
  templateKey?: string | null
): Record<string, ScopeItemQuantityValue> {
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  const allowanceKey = rule.dualAllowanceField
    ? roughAllowanceSubKey(itemId)
    : allowanceSplitSubKey(itemId, 'allowance');
  const materialKey = allowanceSplitSubKey(itemId, 'material');
  const laborKey = allowanceSplitSubKey(itemId, 'labor');
  const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
  const next = { ...itemQuantities };

  next[allowanceKey] = {
    quantity: String(block.total),
    unit: 'allowance',
    quantitySource: 'user_entered',
  };
  if (block.basis?.quantity && block.basis.unit) {
    next[basisKey] = {
      quantity: String(block.basis.quantity),
      unit: block.basis.unit,
      quantitySource: 'user_entered',
    };
  }
  if (!block.lumpSumOnly) {
    next[materialKey] = {
      quantity: String(block.material),
      unit: 'allowance',
      quantitySource: 'user_entered',
    };
    next[laborKey] = {
      quantity: String(block.labor),
      unit: 'allowance',
      quantitySource: 'user_entered',
    };
  } else if (block.labor > 0) {
    next[laborKey] = {
      quantity: String(block.labor),
      unit: 'allowance',
      quantitySource: 'user_entered',
    };
  }

  return next;
}

function scaleAppliedPricingByTakeoffRatio(params: {
  itemId: string;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
  ratio: number;
  nextQuantity?: number | null;
  unit?: string | null;
}): {
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
} | null {
  const { itemId, ratio } = params;
  const materialKey = allowanceSplitSubKey(itemId, 'material');
  const laborKey = allowanceSplitSubKey(itemId, 'labor');
  const allowanceKey = allowanceSplitSubKey(itemId, 'allowance');
  const roughAllowanceKey = roughAllowanceSubKey(itemId);
  const itemQuantities = { ...params.itemQuantities };
  const acceptance = params.pricingAcceptance[itemId];
  let changed = false;

  if (params.nextQuantity != null && params.nextQuantity > 0) {
    const existing = itemQuantities[itemId];
    itemQuantities[itemId] = {
      ...(existing || {}),
      quantity: String(params.nextQuantity),
      unit: params.unit || existing?.unit || 'lf',
      quantitySource: existing?.quantitySource || 'user_entered',
    };
    itemQuantities[allowanceSplitSubKey(itemId, 'sqft_basis')] = {
      quantity: String(params.nextQuantity),
      unit: params.unit || existing?.unit || 'lf',
      quantitySource: 'user_entered',
    };
    changed = true;
  }

  if (!(ratio > 0) || !Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.0001) {
    return changed
      ? { itemQuantities, pricingAcceptance: params.pricingAcceptance }
      : null;
  }

  for (const key of [
    ...new Set([materialKey, laborKey, allowanceKey, roughAllowanceKey]),
  ]) {
    const entry = itemQuantities[key];
    const amount = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
    if (!(amount > 0)) continue;
    itemQuantities[key] = {
      ...entry,
      quantity: String(Math.round(amount * ratio)),
      quantitySource: entry?.quantitySource || 'user_entered',
    };
    changed = true;
  }

  if (!acceptance) return changed ? { itemQuantities, pricingAcceptance: params.pricingAcceptance } : null;

  const materialAmount = scaleMoneyAmount(acceptance.materialAmount, ratio);
  const laborAmount = scaleMoneyAmount(acceptance.laborAmount, ratio);
  const totalAmount =
    materialAmount != null && laborAmount != null
      ? materialAmount + laborAmount
      : scaleMoneyAmount(acceptance.totalAmount, ratio);

  return {
    itemQuantities,
    pricingAcceptance: {
      ...params.pricingAcceptance,
      [itemId]: {
        ...acceptance,
        materialAmount,
        laborAmount,
        totalAmount,
      },
    },
  };
}

function rescaleAppliedPricingForComplexityChange(params: {
  itemId: string;
  previousMeasurements: ScopeMeasurementsInputExtended;
  measurements: ScopeMeasurementsInputExtended;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
  templateKey?: string | null;
}): {
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
} | null {
  const { itemId, previousMeasurements, measurements, templateKey } = params;
  if (!complexityAppliesLaborOnly(itemId)) return null;

  const previousSettings = inferProjectComplexitySettings(previousMeasurements);
  const nextSettings = inferProjectComplexitySettings(measurements);
  const previousMultiplier =
    calculateProjectComplexityMultiplier(previousSettings).totalMultiplier;
  const nextMultiplier =
    calculateProjectComplexityMultiplier(nextSettings).totalMultiplier;
  if (
    !(previousMultiplier > 0) ||
    !(nextMultiplier > 0) ||
    Math.abs(previousMultiplier - nextMultiplier) < 0.0001
  ) {
    return {
      itemQuantities: params.itemQuantities,
      pricingAcceptance: params.pricingAcceptance,
    };
  }

  const ratio = nextMultiplier / previousMultiplier;
  const acceptance = params.pricingAcceptance[itemId];
  const materialKey = allowanceSplitSubKey(itemId, 'material');
  const laborKey = allowanceSplitSubKey(itemId, 'labor');
  const allowanceKey = getChecklistItemQuantityRuleOrDefault(
    itemId,
    templateKey
  ).dualAllowanceField
    ? roughAllowanceSubKey(itemId)
    : allowanceSplitSubKey(itemId, 'allowance');
  const itemQuantities = { ...params.itemQuantities };
  const materialAmount =
    acceptance?.materialAmount ??
    Number(String(itemQuantities[materialKey]?.quantity ?? '').replace(/,/g, ''));
  const laborAmount =
    acceptance?.laborAmount ??
    Number(String(itemQuantities[laborKey]?.quantity ?? '').replace(/,/g, ''));
  if (!(laborAmount > 0)) return null;

  const nextLabor = Math.round(laborAmount * ratio);
  const nextMaterial = materialAmount > 0 ? Math.round(materialAmount) : 0;
  const nextTotal = nextMaterial + nextLabor;
  itemQuantities[laborKey] = {
    ...(itemQuantities[laborKey] || {}),
    quantity: String(nextLabor),
    unit: 'allowance',
    quantitySource:
      itemQuantities[laborKey]?.quantitySource || 'user_entered',
  };
  if (nextMaterial > 0) {
    itemQuantities[materialKey] = {
      ...(itemQuantities[materialKey] || {}),
      quantity: String(nextMaterial),
      unit: 'allowance',
      quantitySource:
        itemQuantities[materialKey]?.quantitySource || 'user_entered',
    };
  }
  itemQuantities[allowanceKey] = {
    ...(itemQuantities[allowanceKey] || {}),
    quantity: String(nextTotal),
    unit: 'allowance',
    quantitySource:
      itemQuantities[allowanceKey]?.quantitySource || 'user_entered',
  };

  return {
    itemQuantities,
    pricingAcceptance: acceptance
      ? {
          ...params.pricingAcceptance,
          [itemId]: {
            ...acceptance,
            materialAmount: nextMaterial || acceptance.materialAmount,
            laborAmount: nextLabor,
            totalAmount: nextTotal,
          },
        }
      : params.pricingAcceptance,
  };
}

function resyncAppliedScopePricingForItem(params: {
  itemId: string;
  measurements: ScopeMeasurementsInputExtended;
  previousMeasurements: ScopeMeasurementsInputExtended;
  templateKey?: string | null;
  notes?: string | null;
  pricingContext?: ScopePricingContext | null;
  forceRecompute?: boolean;
}): {
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
} | null {
  const { itemId, measurements, previousMeasurements, templateKey, notes, pricingContext, forceRecompute } =
    params;

  if (
    !hasAcceptedScopePricing(
      itemId,
      previousMeasurements.itemQuantities,
      previousMeasurements.pricingAcceptance
    )
  ) {
    return null;
  }

  const previousAcceptance = previousMeasurements.pricingAcceptance?.[itemId];
  if (!shouldAutoResyncAppliedPricing(previousAcceptance)) return null;

  const reconciledMeasurements = reconcilePlumbingLineScopeMeasurements(
    measurements as Record<string, unknown>
  ) as ScopeMeasurementsInputExtended;

  let itemQuantities = { ...(reconciledMeasurements.itemQuantities || {}) };
  let pricingAcceptance = { ...(reconciledMeasurements.pricingAcceptance || {}) };

  const previousQty = resolveItemTakeoffQuantity(previousMeasurements, itemId);
  const nextQty = resolveItemTakeoffQuantity(reconciledMeasurements, itemId);
  const takeoffChanged =
    previousQty != null && nextQty != null && previousQty !== nextQty;

  if (!forceRecompute && !takeoffChanged) return null;
  if (!forceRecompute && (previousQty == null || nextQty == null)) return null;

  // LF/count takeoff is linear: scale applied dollars from the committed total.
  // Suggested fill often stays on the old applied $ after Apply, which would
  // write the same price back and ignore the Quick Measurements edit.
  if (takeoffChanged) {
    const currentMoney = liveScopeMoneyFromQuantities(itemId, itemQuantities);
    const previousTotal =
      previousAcceptance?.totalAmount ??
      liveScopeMoneyFromQuantities(
        itemId,
        previousMeasurements.itemQuantities || {}
      );
    const storedBasis = parseTakeoffQuantity(
      previousMeasurements.itemQuantities?.[
        allowanceSplitSubKey(itemId, 'sqft_basis')
      ]
    );
    const pricingBasis = storedBasis ?? previousQty;
    const ratio = nextQty / pricingBasis;
    const expectedTotal =
      previousTotal != null ? Math.round(previousTotal * ratio) : null;
    if (
      currentMoney != null &&
      expectedTotal != null &&
      Math.abs(currentMoney - expectedTotal) < 1
    ) {
      const card = PLUMBING_CARDS.find(entry => entry.itemId === itemId);
      const existing = itemQuantities[itemId];
      itemQuantities[allowanceSplitSubKey(itemId, 'sqft_basis')] = {
        quantity: String(nextQty),
        unit: card?.unit || existing?.unit || 'lf',
        quantitySource: 'user_entered',
      };
      return { itemQuantities, pricingAcceptance };
    }
    const card = PLUMBING_CARDS.find(entry => entry.itemId === itemId);
    const scaled = scaleAppliedPricingByTakeoffRatio({
      itemId,
      itemQuantities,
      pricingAcceptance,
      ratio,
      nextQuantity: nextQty,
      unit: card?.unit || itemQuantities[itemId]?.unit,
    });
    return scaled ?? { itemQuantities, pricingAcceptance };
  }

  if (forceRecompute) {
    const complexityResync = rescaleAppliedPricingForComplexityChange({
      itemId,
      previousMeasurements,
      measurements: reconciledMeasurements,
      itemQuantities,
      pricingAcceptance,
      templateKey,
    });
    if (complexityResync) return complexityResync;
  }

  const normalized = buildNormalizedScopeMeasurementsFromInput(
    { ...reconciledMeasurements, itemQuantities, pricingAcceptance },
    {
      notes: notes || undefined,
      templateKey,
    }
  );
  const resolved = resolveChecklistItemQuantity(itemId, normalized, {
    templateKey,
    notes: notes || undefined,
  });
  const pricing = resolveScopeItemSuggestedPricing(
    itemId,
    { ...reconciledMeasurements, itemQuantities, pricingAcceptance },
    templateKey,
    resolved,
    pricingContext,
    undefined,
    notes || undefined,
    { bypassAppliedSuppress: true }
  );
  const suggested =
    pricing.fill || (forceRecompute ? pricing.comparison : null);

  const previousTotal =
    previousAcceptance?.totalAmount ??
    liveScopeMoneyFromQuantities(
      itemId,
      previousMeasurements.itemQuantities || {}
    );
  if (
    suggested &&
    previousTotal != null &&
    Math.abs(suggested.total - previousTotal) < 1 &&
    takeoffChanged
  ) {
    return null;
  }

  if (suggested) {
    itemQuantities = applySuggestedBlockToQuantities(
      itemId,
      suggested,
      itemQuantities,
      templateKey
    );
    const materialKey = allowanceSplitSubKey(itemId, 'material');
    const laborKey = allowanceSplitSubKey(itemId, 'labor');
    const materialAmount =
      Number(String(itemQuantities[materialKey]?.quantity ?? '').replace(/,/g, '')) ||
      undefined;
    const laborAmount =
      Number(String(itemQuantities[laborKey]?.quantity ?? '').replace(/,/g, '')) ||
      undefined;
    const totalAmount =
      materialAmount && laborAmount
        ? materialAmount + laborAmount
        : suggested.storedTotalExact ?? suggested.total;
    pricingAcceptance[itemId] = {
      ...buildAcceptanceFromSuggestedBlock(suggested),
      materialAmount,
      laborAmount,
      totalAmount,
    };
    return { itemQuantities, pricingAcceptance };
  }

  if (liveScopeMoneyFromQuantities(itemId, itemQuantities) != null) {
    return { itemQuantities, pricingAcceptance };
  }

  return null;
}

/** Keep applied scope dollars aligned when takeoff quantities change after Apply. */
export function resyncAppliedScopePricingAfterMeasurementChanges(params: {
  previous: ScopeMeasurementsInputExtended;
  next: ScopeMeasurementsInputExtended;
  templateKey?: string | null;
  notes?: string | null;
  pricingContext?: ScopePricingContext | null;
}): ScopeMeasurementsInputExtended {
  const complexityChanged = complexityContextChanged(params.previous, params.next);
  const assemblyChanged = insulationAssemblyChanged(
    params.previous,
    params.next
  );
  let changedItemIds = collectTakeoffQuantityChanges(params.previous, params.next);
  if (complexityChanged) {
    changedItemIds = [
      ...new Set([
        ...changedItemIds,
        ...appliedComplexityEligibleItemIds(params.next, params.templateKey),
      ]),
    ];
  }
  if (assemblyChanged) {
    changedItemIds = [...new Set([...changedItemIds, 'insulation'])];
  }
  changedItemIds = [...new Set(changedItemIds)];
  if (!changedItemIds.length) return params.next;

  let itemQuantities = { ...(params.next.itemQuantities || {}) };
  let pricingAcceptance = { ...(params.next.pricingAcceptance || {}) };
  let measurements = params.next;
  let changed = false;
  const seenItemIds = new Set<string>();

  for (const itemId of changedItemIds) {
    if (seenItemIds.has(itemId)) continue;
    seenItemIds.add(itemId);
    const patch = resyncAppliedScopePricingForItem({
      itemId,
      measurements: { ...measurements, itemQuantities, pricingAcceptance },
      previousMeasurements: params.previous,
      templateKey: params.templateKey,
      notes: params.notes,
      pricingContext: params.pricingContext,
      forceRecompute:
        complexityChanged || (assemblyChanged && itemId === 'insulation'),
    });
    if (!patch) continue;
    itemQuantities = patch.itemQuantities;
    pricingAcceptance = patch.pricingAcceptance;
    measurements = { ...measurements, itemQuantities, pricingAcceptance };
    changed = true;
  }

  return changed
    ? { ...params.next, itemQuantities, pricingAcceptance }
    : params.next;
}
