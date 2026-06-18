import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  buildNormalizedScopeMeasurementsFromInput,
  computeNationalAverageBudgetSplit,
  getChecklistItemQuantityRule,
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  resolveBudgetSplitQuantity,
  resolveChecklistItemQuantity,
  resolveDualRatePricingDisplayFromNotes,
  resolveSuggestedBudgetSplitDisplay,
  type ScopeItemQuantityValue,
} from '@/utils/scopeItemQuantities';

export type BudgetSplitSource = 'notes' | 'suggested' | 'manual';

export type ItemBudgetBreakdown = {
  total: number;
  material: number;
  labor: number;
  materialSource: BudgetSplitSource;
  laborSource: BudgetSplitSource;
  basis?: { quantity: number; unit: string } | null;
};

const MATERIAL_ONLY_BUDGET_KEYS = new Set(['rock_mulch', 'sod_turf', 'plants_trees']);

function splitMatchesTotal(material: number, labor: number, total: number): boolean {
  if (material <= 0 || labor <= 0 || total <= 0) return false;
  return Math.abs(material + labor - total) <= 1;
}

export function buildDraftBudgetContext(draft: EstimateAiDraft) {
  const templateKey = draft.scopeChecklist?.templateKey;
  const notes = resolveDraftScopeNotes(draft);
  const measurementsInput = initialScopeMeasurementInputExtended(draft);
  const norm = buildNormalizedScopeMeasurementsFromInput(measurementsInput, { notes, templateKey });
  const parsedFromNotes = notes
    ? parseScopeMeasurementsFromNotes(notes, {
        templateKey,
        projectType: draft.projectType ?? undefined,
      }).itemQuantities || {}
    : {};
  const itemQuantities: Record<string, ScopeItemQuantityValue> = { ...parsedFromNotes };
  for (const [id, val] of Object.entries(draft.scopeMeasurements?.itemQuantities || {})) {
    if (!itemQuantities[id] || val.quantitySource === 'user_entered') {
      itemQuantities[id] = val as ScopeItemQuantityValue;
    }
  }
  return { templateKey, notes, measurementsInput, norm, itemQuantities };
}

export function lookupRuleKeyForBudgetPackage(name: string, scope = ''): string | null {
  const fromCatalog = lookupRuleKeyForPackage(name, scope);
  if (fromCatalog) return fromCatalog;
  const blob = `${name} ${scope}`.toLowerCase();
  if (/\b(lvp|laminate|vinyl|carpet)\b/.test(blob) && !/\bdemo|removal\b/.test(blob)) return 'flooring';
  if (/\bflooring\s+install\b/.test(blob)) return 'flooring';
  if (/\bbacksplash\b/.test(blob)) return 'backsplash';
  if (/\bpaint\b/.test(blob) && !/\bfloor|tile\b/.test(blob)) return 'paint';
  if (/\brail(?:ing)?\b/.test(blob)) return 'railing';
  return null;
}

export function isNoteBackedLumpSumPackage(pkg: EstimateDraftScopePackage): boolean {
  const total = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
  if (total <= 0) return false;
  const noteBacked =
    pkg.status === 'calculated' ||
    pkg.priceSource === 'notes' ||
    Boolean((pkg as EstimateDraftScopePackage & { pricedFromSqftAllowances?: boolean }).pricedFromSqftAllowances) ||
    (pkg.pricingItems || []).some((item) => item.priceSource === 'notes');
  if (!noteBacked) return false;
  if ((pkg.materialPrice ?? 0) > 0 || (pkg.laborPrice ?? 0) > 0) return false;
  if (
    (pkg.pricingItems || []).some(
      (item) => item.pricingType === 'material' || item.pricingType === 'labor'
    )
  ) {
    return false;
  }
  return true;
}

export function resolveItemBudgetBreakdown(params: {
  ruleKey: string;
  total: number;
  templateKey?: string | null;
  notes?: string | null;
  measurementsInput: ReturnType<typeof initialScopeMeasurementInputExtended>;
  norm: ReturnType<typeof buildNormalizedScopeMeasurementsFromInput>;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pkgMaterialPrice?: number | null;
  pkgLaborPrice?: number | null;
  pkgSplitIsSuggested?: boolean;
  pkgPriceSource?: string | null;
  pkgBudgetSplitBasis?: { quantity: number; unit: string } | null;
  scopeQuantity?: { quantity: number; unit: string } | null;
}): ItemBudgetBreakdown | null {
  const {
    ruleKey,
    total,
    templateKey,
    notes,
    measurementsInput,
    norm,
    itemQuantities,
    pkgMaterialPrice,
    pkgLaborPrice,
    pkgSplitIsSuggested,
    pkgPriceSource,
    pkgBudgetSplitBasis,
    scopeQuantity,
  } = params;
  if (total <= 0) return null;

  if (MATERIAL_ONLY_BUDGET_KEYS.has(ruleKey)) {
    return {
      total,
      material: total,
      labor: 0,
      materialSource: 'notes',
      laborSource: 'notes',
    };
  }

  const rule = getChecklistItemQuantityRule(ruleKey, templateKey);

  if (rule?.dualAllowanceField) {
    const itemMaterial = Number(itemQuantities[`${ruleKey}__material`]?.quantity || 0);
    const itemLabor = Number(itemQuantities[`${ruleKey}__labor`]?.quantity || 0);
    const itemAllowance = Number(itemQuantities[`${ruleKey}__allowance`]?.quantity || 0);
    const hasUserSelectedSplit =
      itemQuantities[`${ruleKey}__material`]?.quantitySource === 'user_entered' ||
      itemQuantities[`${ruleKey}__labor`]?.quantitySource === 'user_entered' ||
      itemQuantities[`${ruleKey}__allowance`]?.quantitySource === 'user_entered';
    const selectedTotal = itemAllowance > 0 ? itemAllowance : itemMaterial + itemLabor;
    if (
      hasUserSelectedSplit &&
      itemMaterial > 0 &&
      itemLabor > 0 &&
      splitMatchesTotal(itemMaterial, itemLabor, selectedTotal)
    ) {
      return {
        total: selectedTotal,
        material: itemMaterial,
        labor: itemLabor,
        materialSource: 'manual',
        laborSource: 'manual',
        basis: scopeQuantity,
      };
    }

    const dual = resolveDualRatePricingDisplayFromNotes(ruleKey, measurementsInput, notes, templateKey);
    const mat = dual?.dualMaterial?.quantity;
    const lab = dual?.dualLabor?.quantity;
    if (mat && mat > 0 && lab && lab > 0) {
      return {
        total,
        material: mat,
        labor: lab,
        materialSource: 'notes',
        laborSource: 'notes',
      };
    }
  }

  const pkgMat = Number(pkgMaterialPrice ?? 0);
  const pkgLab = Number(pkgLaborPrice ?? 0);
  const packageWasEditedManually =
    pkgPriceSource === 'manual' || pkgPriceSource === 'user' || pkgPriceSource === 'user_provided';
  if (packageWasEditedManually && splitMatchesTotal(pkgMat, pkgLab, total)) {
    return {
      total,
      material: pkgMat,
      labor: pkgLab,
      materialSource: 'manual',
      laborSource: 'manual',
      basis: pkgBudgetSplitBasis ?? scopeQuantity,
    };
  }

  const material = Number(itemQuantities[`${ruleKey}__material`]?.quantity || 0);
  const labor = Number(itemQuantities[`${ruleKey}__labor`]?.quantity || 0);
  if (splitMatchesTotal(material, labor, total)) {
    return {
      total,
      material,
      labor,
      materialSource: 'notes',
      laborSource: 'notes',
      basis: scopeQuantity,
    };
  }

  if (splitMatchesTotal(pkgMat, pkgLab, total)) {
    const source: BudgetSplitSource =
      pkgSplitIsSuggested
          ? 'suggested'
          : 'notes';
    return {
      total,
      material: pkgMat,
      labor: pkgLab,
      materialSource: source,
      laborSource: source,
      basis: pkgBudgetSplitBasis ?? scopeQuantity,
    };
  }

  const resolved = resolveChecklistItemQuantity(ruleKey, norm, { templateKey, notes });
  const step2Suggested = resolveSuggestedBudgetSplitDisplay(
    ruleKey,
    measurementsInput,
    templateKey,
    resolved
  );
  if (step2Suggested) {
    return {
      total,
      material: step2Suggested.material,
      labor: step2Suggested.labor,
      materialSource: 'suggested',
      laborSource: 'suggested',
      basis: step2Suggested.basis ?? scopeQuantity,
    };
  }

  const count = resolveBudgetSplitQuantity(
    ruleKey,
    templateKey,
    measurementsInput,
    resolved,
    scopeQuantity
  );
  const computed = computeNationalAverageBudgetSplit(ruleKey, total, count ?? 0);
  if (!computed || !count) return null;

  return {
    total,
    material: computed.material,
    labor: computed.labor,
    materialSource: 'suggested',
    laborSource: 'suggested',
    basis: scopeQuantity ?? { quantity: count, unit: rule?.defaultUnit || 'unit' },
  };
}

/** Material/labor breakdown for scope rows — shared by Step 3, apply, and budget split approval. */
export function resolveScopePackageBudgetBreakdown(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): ItemBudgetBreakdown | null {
  const pkgMat = Number(pkg.materialPrice ?? 0);
  const pkgLab = Number(pkg.laborPrice ?? 0);
  const packageTotal = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
  const packageWasEditedManually =
    pkg.priceSource === 'manual' || pkg.priceSource === 'user' || pkg.priceSource === 'user_provided';
  const ruleKey = lookupRuleKeyForBudgetPackage(pkg.name, pkg.scope || '');
  const ctx = buildDraftBudgetContext(draft);
  const itemMaterial = ruleKey ? Number(ctx.itemQuantities[`${ruleKey}__material`]?.quantity || 0) : 0;
  const itemLabor = ruleKey ? Number(ctx.itemQuantities[`${ruleKey}__labor`]?.quantity || 0) : 0;
  const itemMaterialSource = ruleKey ? ctx.itemQuantities[`${ruleKey}__material`]?.quantitySource : undefined;
  const itemLaborSource = ruleKey ? ctx.itemQuantities[`${ruleKey}__labor`]?.quantitySource : undefined;
  const hasUserSelectedItemSplit =
    itemMaterialSource === 'user_entered' || itemLaborSource === 'user_entered';
  const itemSplitTotal = itemMaterial > 0 && itemLabor > 0 ? itemMaterial + itemLabor : 0;
  const packageSplitTotal = pkgMat > 0 && pkgLab > 0 ? pkgMat + pkgLab : 0;
  const canUseSplitTotal =
    ruleKey !== 'floor_demo' && (itemSplitTotal > packageTotal || packageSplitTotal > packageTotal);
  const total = hasUserSelectedItemSplit && itemSplitTotal > 0
    ? itemSplitTotal
    : canUseSplitTotal
    ? Math.max(itemSplitTotal, packageSplitTotal)
    : packageTotal;
  if (total <= 0) return null;

  if (packageWasEditedManually && splitMatchesTotal(pkgMat, pkgLab, total)) {
    return {
      total,
      material: pkgMat,
      labor: pkgLab,
      materialSource: 'manual',
      laborSource: 'manual',
      basis: pkg.budgetSplitBasis ?? pkg.scopeQuantities?.[0] ?? null,
    };
  }

  if (!ruleKey) return null;

  return resolveItemBudgetBreakdown({
    ruleKey,
    total,
    ...ctx,
    pkgMaterialPrice: pkg.materialPrice,
    pkgLaborPrice: pkg.laborPrice,
    pkgSplitIsSuggested: pkg.splitIsSuggested,
    pkgPriceSource: pkg.priceSource,
    pkgBudgetSplitBasis: pkg.budgetSplitBasis,
    scopeQuantity: pkg.scopeQuantities?.[0] ?? null,
  });
}

export function packageNeedsSuggestedBudgetSplit(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): boolean {
  if (!isNoteBackedLumpSumPackage(pkg)) return false;
  const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
  return breakdown?.materialSource === 'suggested' && breakdown?.laborSource === 'suggested';
}
