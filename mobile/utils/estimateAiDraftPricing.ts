import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackages } from '@/utils/estimateAiDraft';
import {
  fetchPricingLibrary,
  fetchSuggestMissingPrices,
  pricingMemoryFetch,
} from '@/utils/contractorPricingMemory';

const REGIONAL_ROUGH = {
  demoLabor: 5,
  laminateMaterial: 4,
  laminateLabor: 5,
  baseboardMaterial: 0.85,
  baseboardLabor: 2.5,
};

export function isPricingRouteMissingError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('route_not_found') ||
    msg.includes('http 404') ||
    msg.includes('cannot post') ||
    msg.includes('cannot get')
  );
}

export type PricingProposalLine = {
  packageName: string;
  lineType: 'material' | 'labor' | 'lump_sum';
  label: string;
  unitType: string;
  quantity: number | null;
  unitRate: number | null;
  total: number;
  formula: string;
  priceSource: string;
  sourceLabel: string;
  confidence: string;
  status: string;
  requiresApproval?: boolean;
};

export type PricingSourceComparison = {
  available: boolean;
  label: string;
  summary: string;
  rate?: number | null;
  unit?: string | null;
};

export type PricingScopeItemProposal = {
  scopeItemId: string;
  scopeName: string;
  quantity: number | null;
  unit: string;
  proposedRates: Array<{
    label: string;
    pricingType: string;
    rate: number | null;
    unit: string | null;
    quantity: number | null;
    total: number | null;
    formula: string | null;
    source: string;
    confidence: string;
    assumptions: string[];
    requiresApproval: boolean;
  }>;
  comparison: Record<string, PricingSourceComparison>;
  recommended: {
    source: string;
    sourceLabel: string;
    reason: string;
    confidence: string;
  } | null;
  warnings: string[];
};

export type PricingProposal = {
  empty: boolean;
  source: 'saved_pricing' | 'ai_rough_estimate' | 'manual';
  sourceLabel: string;
  lines: PricingProposalLine[];
  totalSuggested: number;
  message?: string | null;
  assumptions?: string[];
  disclaimer?: string;
  scopeItems?: PricingScopeItemProposal[];
  warnings?: string[];
  anyRealSource?: boolean;
  anyFallbackOnly?: boolean;
  engine?: boolean;
  primarySource?: string;
  templateCount?: number;
};

export const PRICING_SOURCE_LABELS: Record<string, string> = {
  user_provided: 'User Provided',
  saved_pricing: 'Saved Pricing',
  saved_template: 'Saved Bid Template',
  company_default: 'Company Default',
  supplier_pricing: 'Supplier Pricing',
  regional_labor_benchmark: 'Regional Labor Benchmark',
  construction_cost_database: 'Construction Cost Database',
  ai_rough_estimate_fallback: 'AI Rough Estimate Fallback',
  manually_entered: 'Manually Entered',
  pricing_history: 'Saved Pricing',
  ai_rough_estimate: 'AI Rough Estimate Fallback',
};

export function sourceDisplayLabel(source: string): string {
  return PRICING_SOURCE_LABELS[source] || source.replace(/_/g, ' ');
}

export function sourceBadgeColor(source: string): string {
  if (source === 'saved_pricing' || source === 'pricing_history') return '#60a5fa';
  if (source === 'regional_labor_benchmark') return '#a78bfa';
  if (source === 'supplier_pricing' || source === 'company_default') return '#34d399';
  if (source === 'ai_rough_estimate_fallback' || source === 'ai_rough_estimate') return '#fbbf24';
  return '#94a3b8';
}

async function fetchEngineProposal(
  draft: EstimateAiDraft,
  options: {
    mode: 'suggest' | 'saved_only';
    savedTemplates?: unknown[];
    projectLocation?: string;
    zipCode?: string;
  }
): Promise<PricingProposal> {
  const body = {
    draft,
    mode: options.mode,
    savedTemplates: options.savedTemplates || [],
    projectLocation: options.projectLocation || draft.projectAddress || '',
    zipCode: options.zipCode || '',
  };
  try {
    const res = await pricingMemoryFetch<{
      proposal: PricingProposal;
      engine?: { scopeItems: PricingScopeItemProposal[] };
    }>('/proposal', { method: 'POST', body: JSON.stringify(body) }, { apiPath: '/api/pricing-engine' });
    const proposal = res.proposal;
    if (!proposal.scopeItems?.length && res.engine?.scopeItems) {
      proposal.scopeItems = res.engine.scopeItems;
    }
    return proposal;
  } catch (err) {
    if (!isPricingRouteMissingError(err)) throw err;
  }
  const legacyPath =
    options.mode === 'saved_only' ? '/saved-pricing-proposal' : '/rough-pricing-proposal';
  try {
    const res = await pricingMemoryFetch<{ proposal: PricingProposal }>(legacyPath, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.proposal;
  } catch (err) {
    if (!isPricingRouteMissingError(err)) throw err;
    return options.mode === 'saved_only'
      ? buildSavedPricingProposalLocal(draft)
      : buildRoughPricingProposalLocal(draft);
  }
}

export async function fetchSavedPricingProposal(
  draft: EstimateAiDraft,
  savedTemplates: unknown[] = [],
  location?: { projectLocation?: string; zipCode?: string }
): Promise<PricingProposal> {
  try {
    return await fetchEngineProposal(draft, {
      mode: 'saved_only',
      savedTemplates,
      projectLocation: location?.projectLocation,
      zipCode: location?.zipCode,
    });
  } catch {
    return buildSavedPricingProposalLocal(draft);
  }
}

export async function fetchRoughPricingProposal(
  draft: EstimateAiDraft,
  savedTemplates: unknown[] = [],
  location?: { projectLocation?: string; zipCode?: string }
): Promise<PricingProposal> {
  try {
    return await fetchEngineProposal(draft, {
      mode: 'suggest',
      savedTemplates,
      projectLocation: location?.projectLocation,
      zipCode: location?.zipCode,
    });
  } catch {
    return buildRoughPricingProposalLocal(draft);
  }
}

function buildRoughPricingProposalLocal(draft: EstimateAiDraft): PricingProposal {
  const lines: PricingProposalLine[] = [];
  for (const pkg of getScopePackages(draft)) {
    const qty = pkg.scopeQuantities?.[0];
    const name = pkg.name.toLowerCase();
    const push = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      quantity: number,
      unitRate: number
    ) => {
      const total = roundMoney(unitRate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate,
        total,
        formula: `${quantity.toLocaleString()} ${unitType} × $${unitRate}/${unitType} = $${formatMoney(total)}`,
        priceSource: 'ai_rough_estimate',
        sourceLabel: 'AI Rough Estimate',
        confidence: 'low',
        status: 'rough_price',
        requiresApproval: true,
      });
    };

    if (/tile|demo/.test(name) && qty?.unit === 'sqft') {
      push('labor', 'Tile demo', 'sqft', qty.quantity, REGIONAL_ROUGH.demoLabor);
    } else if ((/laminate|flooring/.test(name) || /install/.test(name)) && !/baseboard/.test(name) && qty?.unit === 'sqft') {
      push('material', 'Laminate material allowance', 'sqft', qty.quantity, REGIONAL_ROUGH.laminateMaterial);
      push('labor', 'Laminate install labor', 'sqft', qty.quantity, REGIONAL_ROUGH.laminateLabor);
    } else if (/baseboard|trim/.test(name) && qty?.unit === 'lf') {
      push('material', 'Baseboard material', 'lf', qty.quantity, REGIONAL_ROUGH.baseboardMaterial);
      push('labor', 'Baseboard install labor', 'lf', qty.quantity, REGIONAL_ROUGH.baseboardLabor);
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'ai_rough_estimate',
    sourceLabel: 'AI Rough Estimate',
    lines,
    totalSuggested,
    message: lines.length === 0 ? 'Could not build per-item rough pricing from scope quantities.' : null,
    assumptions: [
      'Suggested prices use general trade assumptions — not from your notes or saved bids',
      'Review each rate before applying',
    ],
    disclaimer:
      'Indicative only. Approve before applying; line items will be labeled AI Rough Estimate.',
  };
}

async function buildSavedPricingProposalLocal(draft: EstimateAiDraft): Promise<PricingProposal> {
  let rates: Array<{ scopeItemName: string; unitType: string; unitRate: number; category?: string }> = [];
  try {
    const lib = await fetchPricingLibrary();
    for (const section of lib.sections || []) {
      for (const rate of section.items || []) {
        const ut = String(rate.unitType || '').toLowerCase();
        if (
          (rate.unitRate ?? 0) > 0 &&
          ut !== 'lump_sum' &&
          ut !== 'lot' &&
          ut !== 'flat' &&
          ['sqft', 'lf', 'hr', 'each'].includes(ut)
        ) {
          rates.push({
            scopeItemName: rate.scopeItemName,
            unitType: rate.unitType,
            unitRate: rate.unitRate as number,
            category: rate.category,
          });
        }
      }
    }
  } catch {
    rates = [];
  }

  const findRate = (matchers: RegExp[], unitType: string) => {
    const matched = rates.filter(
      (r) =>
        r.unitRate > 0 &&
        r.unitType === unitType &&
        matchers.some((re) => re.test(`${r.scopeItemName} ${r.category || ''}`))
    );
    if (!matched.length) return null;
    const sorted = [...matched].map((m) => m.unitRate).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const lines: PricingProposalLine[] = [];
  for (const pkg of getScopePackages(draft)) {
    const qty = pkg.scopeQuantities?.[0];
    const name = pkg.name.toLowerCase();
    const add = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      quantity: number,
      unitRate: number
    ) => {
      const total = roundMoney(unitRate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate,
        total,
        formula: `${quantity.toLocaleString()} ${unitType} × $${unitRate}/${unitType} = $${formatMoney(total)}`,
        priceSource: 'pricing_history',
        sourceLabel: 'Based on your past approved bids',
        confidence: 'medium',
        status: 'pricing_memory_suggested',
        requiresApproval: true,
      });
    };

    if (/tile|demo/.test(name) && qty?.unit === 'sqft') {
      const rate = findRate([/demo/, /removal/, /tile/], 'sqft');
      if (rate) add('labor', 'Tile demo', 'sqft', qty.quantity, rate);
    } else if ((/laminate|flooring/.test(name) || /install/.test(name)) && !/baseboard/.test(name) && qty?.unit === 'sqft') {
      const mat = findRate([/material/, /allowance/, /laminate/, /lvp/], 'sqft');
      const lab = findRate([/labor/, /install/], 'sqft');
      if (mat) add('material', 'Laminate material allowance', 'sqft', qty.quantity, mat);
      if (lab) add('labor', 'Laminate install labor', 'sqft', qty.quantity, lab);
    } else if (/baseboard|trim/.test(name) && qty?.unit === 'lf') {
      const mat = findRate([/material/, /baseboard/], 'lf');
      const lab = findRate([/labor/, /install/], 'lf');
      if (mat) add('material', 'Baseboard material', 'lf', qty.quantity, mat);
      if (lab) add('labor', 'Baseboard install labor', 'lf', qty.quantity, lab);
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'saved_pricing',
    sourceLabel: rates.length > 0 ? 'Based on your past approved bids' : 'Based on your saved pricing',
    lines,
    totalSuggested,
    message:
      lines.length === 0
        ? 'You have not saved pricing for this scope yet. Add prices manually or request a rough AI estimate.'
        : null,
  };
}

function formatMoney(amount: number) {
  return roundMoney(amount).toLocaleString();
}

export function draftHasApplyablePricing(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  if ((draft.calculatedLineItemTotal || 0) > 0) return true;
  if ((draft.knownSubtotal || 0) > 0) return true;
  const rooms = draft.rooms || [];
  if (rooms.some((r) => r.price != null && r.price > 0)) return true;
  if ((draft.pendingPricingProposal?.lines?.length ?? 0) > 0) return true;
  return getScopePackages(draft).some((p) => (p.price ?? 0) > 0 || (p.knownSubtotal ?? 0) > 0);
}

export function applyPricingProposalToDraft(
  draft: EstimateAiDraft,
  proposal: PricingProposal,
  options: { approved?: boolean } = {}
): EstimateAiDraft {
  const approved = options.approved !== false;
  const byPackage = new Map<string, PricingProposalLine[]>();
  for (const line of proposal.lines) {
    const list = byPackage.get(line.packageName) || [];
    list.push(line);
    byPackage.set(line.packageName, list);
  }

  const isRough = proposal.source === 'ai_rough_estimate';
  const rooms = (draft.rooms || []).map((room) => {
    const pkgLines = byPackage.get(room.name);
    if (!pkgLines?.length) return room;

    const lump = pkgLines.find((l) => l.lineType === 'lump_sum');
    const labor = pkgLines
      .filter((l) => l.lineType === 'labor')
      .reduce((sum, l) => sum + l.total, 0);
    const material = pkgLines
      .filter((l) => l.lineType === 'material')
      .reduce((sum, l) => sum + l.total, 0);
    const price = lump ? lump.total : roundMoney(labor + material);

    const pricingItems = pkgLines.map((l) => ({
      name: l.label,
      amount: l.total,
      unitRate: l.unitRate,
      quantity: l.quantity,
      unit: l.unitType,
      pricingType: l.lineType,
      priceSource: l.priceSource,
      status: isRough ? 'rough_price' : 'confirmed',
      formula: l.formula,
      includedInSubtotal: true,
      approvedByUser: approved,
    }));

    return {
      ...room,
      price: price > 0 ? price : null,
      laborPrice: labor > 0 ? labor : null,
      materialPrice: material > 0 ? material : null,
      priceIncludesLaborAndMaterials: !lump && labor > 0 && material > 0,
      priceProvidedByUser: !isRough,
      splitIsSuggested: false,
      pricingItems,
      packageStatus: isRough ? 'rough_price' : 'confirmed',
      applyEligible: approved && price > 0,
      roughPricePendingApproval: isRough && !approved,
    };
  });

  const lineTotal = rooms.reduce((sum, r) => sum + (r.price || 0), 0);
  const laborTotal = rooms.reduce((sum, r) => sum + (r.laborPrice || 0), 0);
  const materialTotal = rooms.reduce((sum, r) => sum + (r.materialPrice || 0), 0);
  const pricedRooms = rooms.filter((r) => (r.price || 0) > 0).length;
  const totalRooms = rooms.length;
  const allPriced = totalRooms > 0 && pricedRooms === totalRooms;
  const partial = pricedRooms > 0 && !allPriced;

  return {
    ...draft,
    rooms,
    pendingPricingProposal: proposal,
    pricingProposalApproved: approved,
    noPricingDetected: pricedRooms === 0,
    calculatedLineItemTotal: lineTotal > 0 ? lineTotal : null,
    calculatedLaborTotal: laborTotal > 0 ? laborTotal : null,
    calculatedMaterialTotal: materialTotal > 0 ? materialTotal : null,
    estimateConfidence:
      approved && pricedRooms > 0
        ? {
            level: isRough ? 'medium' : allPriced ? 'high' : 'medium',
            label: isRough ? 'Medium confidence' : allPriced ? 'High confidence' : 'Medium confidence',
            summary: isRough
              ? 'AI rough estimate — review before applying to bid'
              : proposal.source === 'manual'
                ? allPriced
                  ? 'Manually entered pricing — review before applying'
                  : 'Partial manual pricing — some scope items still need prices'
                : 'Pricing from your saved rates — review before applying',
            reasons: partial ? ['Some scope items still missing prices'] : [],
          }
        : draft.estimateConfidence,
  };
}

function roundMoney(n: number) {
  return Math.round(Number(n) || 0);
}

export type ManualPackageMode = 'rate' | 'lump_sum' | 'split';

export type ManualPricingInputs = Record<
  string,
  {
    mode?: ManualPackageMode;
    demoRateSqft?: string;
    materialRateSqft?: string;
    laborRateSqft?: string;
    materialRateLf?: string;
    laborRateLf?: string;
    lumpSum?: string;
    caulkPaintLump?: string;
  }
>;

export type ManualPackagePreview = {
  packageName: string;
  breakdown: string[];
  total: number;
};

export type PackagePricingKind = 'tile_demo' | 'flooring' | 'baseboard' | 'other';

export function classifyPackageKind(name: string): PackagePricingKind {
  const n = name.toLowerCase();
  if (/tile|demo/.test(n)) return 'tile_demo';
  if (/baseboard|trim/.test(n)) return 'baseboard';
  if ((/laminate|flooring/.test(n) || /install/.test(n)) && !/baseboard/.test(n)) return 'flooring';
  return 'other';
}

export function defaultManualMode(kind: PackagePricingKind): ManualPackageMode {
  if (kind === 'tile_demo') return 'rate';
  return 'split';
}

export function computeManualPackagePreview(
  pkg: EstimateDraftScopePackage,
  inp: ManualPricingInputs[string] | undefined
): ManualPackagePreview {
  const kind = classifyPackageKind(pkg.name);
  const mode = inp?.mode ?? defaultManualMode(kind);
  const qty = pkg.scopeQuantities?.[0];
  const breakdown: string[] = [];
  let total = 0;

  const addLine = (text: string, amount: number) => {
    if (amount > 0) {
      breakdown.push(text);
      total += amount;
    }
  };

  if (kind === 'tile_demo') {
    if (mode === 'lump_sum') {
      const lump = parseMoney(inp?.lumpSum);
      if (lump) addLine(`Demo lump sum: $${formatMoney(lump)}`, lump);
    } else {
      const rate = parseMoney(inp?.demoRateSqft);
      if (rate && qty?.unit === 'sqft') {
        const t = roundMoney(rate * qty.quantity);
        addLine(`Demo rate: $${rate}/sqft`, t);
        breakdown[breakdown.length - 1] = `${qty.quantity.toLocaleString()} sqft × $${rate}/sqft = $${formatMoney(t)}`;
      }
    }
  } else if (kind === 'flooring') {
    if (mode === 'lump_sum') {
      const lump = parseMoney(inp?.lumpSum);
      if (lump) addLine(`Lump sum: $${formatMoney(lump)}`, lump);
    } else if (qty?.unit === 'sqft') {
      const mat = parseMoney(inp?.materialRateSqft);
      const lab = parseMoney(inp?.laborRateSqft);
      if (mat) {
        const t = roundMoney(mat * qty.quantity);
        addLine(`Material: ${qty.quantity.toLocaleString()} sqft × $${mat}/sqft = $${formatMoney(t)}`, t);
      }
      if (lab) {
        const t = roundMoney(lab * qty.quantity);
        addLine(`Labor: ${qty.quantity.toLocaleString()} sqft × $${lab}/sqft = $${formatMoney(t)}`, t);
      }
    }
  } else if (kind === 'baseboard') {
    if (mode === 'lump_sum') {
      const lump = parseMoney(inp?.lumpSum);
      if (lump) addLine(`Lump sum: $${formatMoney(lump)}`, lump);
    } else if (qty?.unit === 'lf') {
      const mat = parseMoney(inp?.materialRateLf);
      const lab = parseMoney(inp?.laborRateLf);
      if (mat) {
        const t = roundMoney(mat * qty.quantity);
        addLine(`Material: ${qty.quantity.toLocaleString()} LF × $${mat}/LF = $${formatMoney(t)}`, t);
      }
      if (lab) {
        const t = roundMoney(lab * qty.quantity);
        addLine(`Labor: ${qty.quantity.toLocaleString()} LF × $${lab}/LF = $${formatMoney(t)}`, t);
      }
      const caulk = parseMoney(inp?.caulkPaintLump);
      if (caulk) addLine(`Caulk & paint: $${formatMoney(caulk)}`, caulk);
    }
  }

  return { packageName: pkg.name, breakdown, total: roundMoney(total) };
}

export function computeManualGrandTotal(
  draft: EstimateAiDraft,
  inputs: ManualPricingInputs
): number {
  return getScopePackages(draft).reduce((sum, pkg) => {
    return sum + computeManualPackagePreview(pkg, inputs[pkg.name]).total;
  }, 0);
}

export function buildManualPricingProposal(
  draft: EstimateAiDraft,
  inputs: ManualPricingInputs
): PricingProposal {
  const lines: PricingProposalLine[] = [];
  const packages = getScopePackages(draft);

  for (const pkg of packages) {
    const inp = inputs[pkg.name] || {};
    const qty = pkg.scopeQuantities?.[0];
    const name = pkg.name.toLowerCase();

    const pushRate = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      rateStr: string | undefined,
      quantity: number | null
    ) => {
      const rate = parseMoney(rateStr);
      if (rate == null || rate <= 0 || quantity == null) return;
      const total = roundMoney(rate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate: rate,
        total,
        formula: `${quantity.toLocaleString()} ${unitType} × $${rate}/${unitType} = $${total.toLocaleString()}`,
        priceSource: 'manually_entered',
        sourceLabel: 'Manually entered',
        confidence: 'high',
        status: 'confirmed',
        requiresApproval: false,
      });
    };

    const kind = classifyPackageKind(pkg.name);
    const mode = inp.mode ?? defaultManualMode(kind);

    if (kind === 'tile_demo') {
      const q = qty?.unit === 'sqft' ? qty.quantity : null;
      if (mode === 'lump_sum') {
        const lump = parseMoney(inp.lumpSum);
        if (lump) {
          lines.push({
            packageName: pkg.name,
            lineType: 'lump_sum',
            label: 'Tile demo lump sum',
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: lump,
            formula: `$${formatMoney(lump)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      } else {
        pushRate('labor', 'Tile demo', 'sqft', inp.demoRateSqft, q);
      }
      continue;
    }

    if (kind === 'flooring') {
      const q = qty?.unit === 'sqft' ? qty.quantity : null;
      if (mode === 'lump_sum') {
        const lump = parseMoney(inp.lumpSum);
        if (lump) {
          lines.push({
            packageName: pkg.name,
            lineType: 'lump_sum',
            label: 'Laminate lump sum',
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: lump,
            formula: `$${formatMoney(lump)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      } else {
        pushRate('material', 'Laminate material', 'sqft', inp.materialRateSqft, q);
        pushRate('labor', 'Laminate install labor', 'sqft', inp.laborRateSqft, q);
      }
      continue;
    }

    if (kind === 'baseboard') {
      const q = qty?.unit === 'lf' ? qty.quantity : null;
      if (mode === 'lump_sum') {
        const lump = parseMoney(inp.lumpSum);
        if (lump) {
          lines.push({
            packageName: pkg.name,
            lineType: 'lump_sum',
            label: 'Baseboard lump sum',
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: lump,
            formula: `$${formatMoney(lump)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      } else {
        pushRate('material', 'Baseboard material', 'lf', inp.materialRateLf, q);
        pushRate('labor', 'Baseboard install labor', 'lf', inp.laborRateLf, q);
        const caulk = parseMoney(inp.caulkPaintLump);
        if (caulk) {
          lines.push({
            packageName: pkg.name,
            lineType: 'labor',
            label: 'Caulk & paint',
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: caulk,
            formula: `$${formatMoney(caulk)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      }
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'manual',
    sourceLabel: 'Manually entered',
    lines,
    totalSuggested,
    message: lines.length === 0 ? 'Enter at least one rate or lump sum.' : null,
  };
}

function parseMoney(raw?: string): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export { fetchSuggestMissingPrices };
