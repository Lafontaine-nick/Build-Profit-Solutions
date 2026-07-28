import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import { resolveAppliedConfirmScopePackagePricing, resolveNationalAverageScopePackagePricing } from '@/utils/appliedScopePackagePricing';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
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

function packageSplitSource(pkg: EstimateDraftScopePackage): BudgetSplitSource {
  if (
    pkg.priceSource === 'manual' ||
    pkg.priceSource === 'user' ||
    pkg.priceSource === 'user_provided'
  ) {
    return 'manual';
  }
  if (
    pkg.splitIsSuggested ||
    pkg.priceSource === 'ai_rough_estimate' ||
    pkg.priceSource === 'national_trade_average' ||
    pkg.priceSource === 'national_high_side_planning'
  ) {
    return 'suggested';
  }
  return 'notes';
}

/** Sum material/labor from package pricingItems (rough proposal, notes lines, etc.). */
function splitFromPricingItems(
  pkg: EstimateDraftScopePackage
): { material: number; labor: number } | null {
  const items = pkg.pricingItems || [];
  if (!items.length) return null;
  let material = 0;
  let labor = 0;
  for (const item of items) {
    const amount = Number(item.amount || 0);
    if (amount <= 0) continue;
    const type = String(item.pricingType || '').toLowerCase();
    if (type === 'material') material += amount;
    else if (type === 'labor') labor += amount;
  }
  if (material <= 0 && labor <= 0) return null;
  return { material, labor };
}

/** Sum material/labor from a pending pricing proposal for this package name. */
function splitFromPendingProposal(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): { material: number; labor: number; total: number } | null {
  const lines = draft.pendingPricingProposal?.lines || [];
  if (!lines.length) return null;
  const pkgKey = String(pkg.name || '')
    .trim()
    .toLowerCase();
  if (!pkgKey) return null;
  let material = 0;
  let labor = 0;
  let lump = 0;
  for (const line of lines) {
    const name = String(line.packageName || '')
      .trim()
      .toLowerCase();
    if (!name || (name !== pkgKey && !name.includes(pkgKey) && !pkgKey.includes(name))) continue;
    const amount = Number(line.total || 0);
    if (amount <= 0) continue;
    if (line.lineType === 'material') material += amount;
    else if (line.lineType === 'labor') labor += amount;
    else if (line.lineType === 'lump_sum') lump += amount;
  }
  if (material <= 0 && labor <= 0 && lump <= 0) return null;
  if (lump > 0 && material <= 0 && labor <= 0) return null;
  return {
    material,
    labor,
    total: material + labor + lump,
  };
}

/**
 * Build a displayable material/labor split from any available package source.
 * Prefer exact mat+lab; otherwise infer the missing leg from package total.
 */
function breakdownFromKnownLegs(params: {
  total: number;
  material: number;
  labor: number;
  source: BudgetSplitSource;
  basis?: { quantity: number; unit: string } | null;
}): ItemBudgetBreakdown | null {
  const { total, material, labor, source, basis } = params;
  if (total <= 0) return null;

  if (material > 0 && labor > 0) {
    // Exact match, or partial confirmed split (remainder stays on labor for display).
    if (Math.abs(material + labor - total) <= 1) {
      return {
        total,
        material,
        labor,
        materialSource: source,
        laborSource: source,
        basis: basis ?? null,
      };
    }
    if (material + labor < total - 1) {
      return {
        total,
        material,
        labor: Math.max(0, total - material),
        materialSource: source,
        laborSource: source,
        basis: basis ?? null,
      };
    }
    // Over-split: scale legs to the package total so Step 3 Materials + Labor
    // never exceeds the row / Calculated total.
    const scale = total / (material + labor);
    const scaledMaterial = Math.round(material * scale * 100) / 100;
    return {
      total,
      material: scaledMaterial,
      labor: Math.max(0, Math.round((total - scaledMaterial) * 100) / 100),
      materialSource: source,
      laborSource: source,
      basis: basis ?? null,
    };
  }

  if (material > 0 && material <= total) {
    return {
      total,
      material,
      labor: Math.max(0, total - material),
      materialSource: source,
      laborSource: source,
      basis: basis ?? null,
    };
  }
  if (labor > 0 && labor <= total) {
    return {
      total,
      material: Math.max(0, total - labor),
      labor,
      materialSource: source,
      laborSource: source,
      basis: basis ?? null,
    };
  }
  return null;
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
  if (/\bexterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*exterior\b/.test(blob)) {
    return 'exterior_paint';
  }
  if (/\binterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*interior\b/.test(blob)) {
    return 'interior_paint';
  }
  if (/\bshower\s+tile\s+install|\bshower\s+tile\b(?!\s*(?:demo|removal|tear))/i.test(blob)) return 'shower_tile';
  if (/\btile\s+removal\b|\bremove\s+existing\s+tile\b/i.test(blob)) return 'floor_demo';
  if (/\btile\s+install(?:ation)?\b/i.test(blob) && !/\bshower\b/i.test(blob)) return 'floor_tile';
  if (/\bdrywall\b[^.]{0,40}\b(repair|patch)/i.test(blob)) return 'patch_repair';
  if (/\bremove\s+existing\s+vanity\b/i.test(blob)) return 'vanity_demo';
  if (/\bpaint\b/.test(blob) && !/\bfloor|tile|exterior\b/.test(blob)) return 'paint';
  if (/\brail(?:ing)?\b/.test(blob)) return 'railing';
  if (/\bdeck(?:ing)?\b/.test(blob) && !/\bdemo|removal\b/.test(blob)) return 'decking';
  if (/\broof(?:ing)?\b|\bshingle|\btie[\s-]?in\b/.test(blob)) return 'shingles_roofing';
  if (/\bfoundation\b/.test(blob)) return 'pour_foundation';
  if (/\bwindow|\bdoor\b/.test(blob)) return 'windows_doors';
  if (/\bplant|\btree\b|\bshrub/.test(blob)) return 'plants_trees';
  if (/\bsite\s*work|\bgrading\b|\bexcavat/.test(blob)) return 'excavation';
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
    const source: BudgetSplitSource = pkgSplitIsSuggested ? 'suggested' : 'notes';
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

  // Prefer the full package total so partial Confirm Scope splits don't shrink the Step 3 row.
  const total =
    packageTotal > 0
      ? packageTotal
      : hasUserSelectedItemSplit && itemSplitTotal > 0
        ? itemSplitTotal
        : canUseSplitTotal
          ? Math.max(itemSplitTotal, packageSplitTotal)
          : packageTotal;
  if (total <= 0) {
    const applied = resolveAppliedConfirmScopePackagePricing(pkg, draft);
    if (applied && applied.total > 0) {
      return breakdownFromKnownLegs({
        total: applied.total,
        material: applied.material,
        labor: applied.labor,
        source: 'manual',
        basis: pkg.scopeQuantities?.[0] ?? null,
      });
    }
    const nationalAverage = resolveNationalAverageScopePackagePricing(pkg, draft);
    if (nationalAverage && nationalAverage.total > 0) {
      return breakdownFromKnownLegs({
        total: nationalAverage.total,
        material: nationalAverage.material,
        labor: nationalAverage.labor,
        source: 'suggested',
        basis: pkg.scopeQuantities?.[0] ?? null,
      });
    }
    const pending = splitFromPendingProposal(pkg, draft);
    if (pending && (pending.material > 0 || pending.labor > 0)) {
      return breakdownFromKnownLegs({
        total: pending.total > 0 ? pending.total : pending.material + pending.labor,
        material: pending.material,
        labor: pending.labor,
        source: 'suggested',
        basis: pkg.scopeQuantities?.[0] ?? null,
      });
    }
    return null;
  }

  const basis = pkg.budgetSplitBasis ?? pkg.scopeQuantities?.[0] ?? null;

  // laborPrice sometimes stores the combined package total — derive labor from the remainder.
  if (
    packageTotal > 0 &&
    pkgMat > 0 &&
    pkgLab > 0 &&
    Math.abs(pkgLab - packageTotal) <= 1 &&
    pkgMat < packageTotal
  ) {
    const fromCombinedLabor = breakdownFromKnownLegs({
      total: packageTotal,
      material: pkgMat,
      labor: Math.max(0, packageTotal - pkgMat),
      source: packageSplitSource(pkg),
      basis,
    });
    if (fromCombinedLabor) return fromCombinedLabor;
  }

  if (packageWasEditedManually) {
    const manual = breakdownFromKnownLegs({
      total,
      material: pkgMat,
      labor: pkgLab,
      source: 'manual',
      basis,
    });
    if (manual) return manual;
  }

  // Confirmed / rough package fields (Framing, HVAC, etc.) — works without a checklist rule key.
  const fromPackage = breakdownFromKnownLegs({
    total,
    material: pkgMat,
    labor: pkgLab,
    source: packageSplitSource(pkg),
    basis,
  });
  if (fromPackage && (pkgMat > 0 || pkgLab > 0)) return fromPackage;

  // User-entered Confirm Scope itemQuantities (may be partial vs package total).
  if (hasUserSelectedItemSplit && (itemMaterial > 0 || itemLabor > 0)) {
    const fromItems = breakdownFromKnownLegs({
      total,
      material: itemMaterial,
      labor: itemLabor,
      source: 'manual',
      basis,
    });
    if (fromItems) return fromItems;
  }

  // pricingItems from approved rough / notes lines.
  const fromPricingItems = splitFromPricingItems(pkg);
  if (fromPricingItems) {
    const fromItems = breakdownFromKnownLegs({
      total,
      material: fromPricingItems.material,
      labor: fromPricingItems.labor,
      source: packageSplitSource(pkg),
      basis,
    });
    if (fromItems) return fromItems;
  }

  // Pending suggested pricing proposal (before Apply prices into packages).
  const pending = splitFromPendingProposal(pkg, draft);
  if (pending && (pending.material > 0 || pending.labor > 0)) {
    const fromPending = breakdownFromKnownLegs({
      total: Math.max(total, pending.total),
      material: pending.material,
      labor: pending.labor,
      source: 'suggested',
      basis,
    });
    if (fromPending) return fromPending;
  }

  if (!ruleKey) {
    // Soft costs stay in Step 3 Allowances; trade packages without a rule key → labor.
    if (isSoftCostScopePackage(pkg, draft)) return null;
    return {
      total,
      material: 0,
      labor: total,
      materialSource: packageSplitSource(pkg),
      laborSource: packageSplitSource(pkg),
      basis,
    };
  }

  const fromRule = resolveItemBudgetBreakdown({
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
  if (fromRule) return fromRule;

  // No inventable mat/lab split. Soft costs → Allowances; trades → Labor (matches apply-to-bid).
  if (isSoftCostScopePackage(pkg, draft)) return null;
  return {
    total,
    material: 0,
    labor: total,
    materialSource: packageSplitSource(pkg),
    laborSource: packageSplitSource(pkg),
    basis,
  };
}

export function packageNeedsSuggestedBudgetSplit(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): boolean {
  if (!isNoteBackedLumpSumPackage(pkg)) return false;
  const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
  return breakdown?.materialSource === 'suggested' && breakdown?.laborSource === 'suggested';
}
