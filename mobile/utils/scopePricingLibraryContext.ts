import type { PricingLibrarySection } from '@/utils/contractorPricingMemory';
import { fetchPricingLibrary } from '@/utils/contractorPricingMemory';
import { getRatePricingMatcher } from '@/utils/scopeRatePricingParser';
import type { TemplateRateMatch } from '@/utils/scopeItemQuantities';

export type ScopePricingLibraryRate = {
  scopeItemName: string;
  checklistItemId?: string | null;
  category?: string;
  unitType: string;
  unitRate: number;
  quantity?: number | null;
  totalAmount?: number | null;
};

const LUMP_UNITS = new Set(['lump_sum', 'lot', 'flat', 'allowance']);
const UNIT_RATE_UNITS = new Set(['sqft', 'lf', 'hr', 'each']);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Infer checklist id from legacy library rows captured before checklistItemId was stored. */
function inferChecklistItemIdFromScopeName(scopeItemName: string): string | null {
  const text = String(scopeItemName || '').toLowerCase();
  if (
    (/\bwaterproof|\bbacker\s+board|\bred\s*gard|\bkerdi|\bmembrane\b/.test(text) &&
      /\bshower\b/.test(text)) ||
    /\bwaterproofing\s*&\s*backer/.test(text)
  ) {
    return 'waterproofing';
  }
  if (/\bshower\s+wall\s+tile\b/.test(text) || (/\bshower\b/.test(text) && /\bwall\b/.test(text) && /\btile\b/.test(text))) {
    return 'shower_tile';
  }
  if (/\bshower\s+floor\s+tile\b/.test(text)) return 'shower_floor_tile';
  if (/\bbath(?:room)?\s+floor\s+tile\b/.test(text) || (/\bfloor\s+tile\b/.test(text) && !/\bshower\b/.test(text))) {
    return 'floor_tile';
  }
  if (/\bpermits?\b/.test(text) && !/\bfinal\s+inspection/.test(text)) return 'permits';
  if (/\b(plans?|engineering|architect)\b/.test(text) && !/\bfloor\s+plan/.test(text)) {
    return 'plans_engineering';
  }
  if (/\bcontingency\b/.test(text)) return 'contingency';
  if (/\b(appliance\s+install|hookup)\b/.test(text)) return 'appliances';
  if (/\b(cleanup|haul[\s-]?off|dumpster|disposal)\b/.test(text)) return 'cleanup';
  if (/\bsurvey\b/.test(text)) return 'survey';
  if (/\bmobilization\b/.test(text)) return 'mobilization';
  return null;
}

function entryChecklistItemId(entry: ScopePricingLibraryRate): string | null {
  const explicit = String(entry.checklistItemId || '').trim();
  if (explicit) return explicit;
  return inferChecklistItemIdFromScopeName(entry.scopeItemName);
}

function normalizedScopeNameKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizedNameImpliesItemId(itemId: string, scopeItemName: string): boolean {
  const key = normalizedScopeNameKey(scopeItemName);
  if (!key) return false;
  if (key.includes(itemId)) return true;
  const compact = itemId.replace(/_/g, '');
  return compact.length > 4 && key.includes(compact);
}

/** Derive a per-unit library rate from stored unitRate, or totalAmount ÷ quantity. */
export function deriveLibraryScopeRate(item: {
  unitType?: string | null;
  unitRate?: number | null;
  quantity?: number | null;
  totalAmount?: number | null;
}): { unitType: string; unitRate: number } | null {
  const ut = String(item.unitType || '').toLowerCase();
  const direct = positiveNumber(item.unitRate);
  if (direct != null && (UNIT_RATE_UNITS.has(ut) || LUMP_UNITS.has(ut))) {
    return { unitType: UNIT_RATE_UNITS.has(ut) ? ut : ut, unitRate: direct };
  }

  const total = positiveNumber(item.totalAmount);
  const qty = positiveNumber(item.quantity);
  if (total != null && qty != null) {
    const perUnit = Math.round((total / qty) * 100) / 100;
    const resolvedUnit = UNIT_RATE_UNITS.has(ut) ? ut : 'sqft';
    if (UNIT_RATE_UNITS.has(resolvedUnit)) {
      return { unitType: resolvedUnit, unitRate: perUnit };
    }
  }

  // Lump-sum capture without per-unit rate — keep flat total for scope card matching.
  if (total != null && LUMP_UNITS.has(ut)) {
    return { unitType: 'allowance', unitRate: total };
  }

  return null;
}

/** Flatten backend library sections into scope-context rate rows. */
export function pricingLibrarySectionsToScopeRates(
  sections: PricingLibrarySection[] | null | undefined
): ScopePricingLibraryRate[] {
  const out: ScopePricingLibraryRate[] = [];
  for (const section of sections || []) {
    for (const rate of section.items || []) {
      const derived = deriveLibraryScopeRate(rate);
      if (!derived) continue;
      const ut = derived.unitType;
      if (!LUMP_UNITS.has(ut) && !UNIT_RATE_UNITS.has(ut)) continue;
      out.push({
        scopeItemName: rate.scopeItemName,
        checklistItemId: rate.checklistItemId ?? null,
        category: rate.category,
        unitType: ut,
        unitRate: derived.unitRate,
        quantity: rate.quantity ?? null,
        totalAmount: rate.totalAmount ?? null,
      });
    }
  }
  return out;
}

export async function fetchPricingLibraryRatesForScopeContext(): Promise<ScopePricingLibraryRate[]> {
  try {
    const lib = await fetchPricingLibrary();
    return pricingLibrarySectionsToScopeRates(lib.sections);
  } catch {
    return [];
  }
}

function libraryEntryRoleMatches(
  entry: ScopePricingLibraryRate,
  role: 'material' | 'labor'
): boolean {
  const text = `${entry.scopeItemName} ${entry.category || ''}`.toLowerCase();
  const entryMat =
    entry.category === 'material' ||
    /\bmaterials?\b|\ballowance\b|\bsupply\b/.test(text);
  if (role === 'material') return entryMat;
  return !entryMat;
}

function libraryEntryMatchesScopeItem(
  itemId: string,
  entry: ScopePricingLibraryRate,
  role: 'material' | 'labor',
  matcher: { match: RegExp; exclude?: RegExp }
): boolean {
  if (!libraryEntryRoleMatches(entry, role)) return false;

  if (entryChecklistItemId(entry) === itemId) return true;
  if (normalizedNameImpliesItemId(itemId, entry.scopeItemName)) return true;

  const text = `${entry.scopeItemName} ${entry.category || ''}`.toLowerCase();
  if (!matcher.match.test(text)) return false;
  if (matcher.exclude?.test(text)) return false;

  const itemDemo = itemId.includes('demo') || /\bdemo\b/.test(itemId);
  const entryDemo = /\b(demo|demolition|removal|tear)\b/.test(text);
  if (itemDemo !== entryDemo) {
    if (itemDemo && !entryDemo) return false;
    if (!itemDemo && entryDemo) return false;
  }

  if (/\bshower\b/.test(itemId) && /\bvanity\b/.test(text) && !/\bshower\b/.test(text)) {
    return false;
  }
  if (/\bvanity\b/.test(itemId) && /\bshower\b/.test(text) && !/\bvanity\b/.test(text)) {
    return false;
  }
  if (itemId === 'flooring' && /\btile\b/.test(text) && !/\blaminate|lvp|vinyl|flooring\b/.test(text)) {
    return false;
  }

  return true;
}

function collectLibraryRatesForUnit(
  itemId: string,
  rates: ScopePricingLibraryRate[],
  normalizedUnit: string,
  matcher: { match: RegExp; exclude?: RegExp },
  takeoffQuantity?: number | null
): { materialRates: number[]; laborRates: number[]; combinedFlatPerUnit: number[] } {
  const materialRates: number[] = [];
  const laborRates: number[] = [];
  const combinedFlatPerUnit: number[] = [];
  const qty = Number(takeoffQuantity);
  const hasQty = Number.isFinite(qty) && qty > 0;

  for (const entry of rates) {
    if (entry.unitType === normalizedUnit) {
      if (libraryEntryMatchesScopeItem(itemId, entry, 'material', matcher)) {
        materialRates.push(entry.unitRate);
      }
      if (libraryEntryMatchesScopeItem(itemId, entry, 'labor', matcher)) {
        laborRates.push(entry.unitRate);
      }
      continue;
    }

    // Flat lump-sum library capture — derive $/unit when takeoff qty is known.
    if (
      (entry.unitType === 'allowance' || entry.unitType === 'lump_sum') &&
      hasQty &&
      (normalizedUnit === 'sqft' || normalizedUnit === 'lf')
    ) {
      const flatTotal = positiveNumber(entry.totalAmount) ?? positiveNumber(entry.unitRate);
      if (flatTotal == null) continue;
      const storedQty = positiveNumber(entry.quantity);
      const basisQty = storedQty && storedQty > 0 ? storedQty : qty;
      const perUnit = Math.round((flatTotal / basisQty) * 100) / 100;
      if (!(perUnit > 0)) continue;
      if (libraryEntryMatchesScopeFamily(itemId, entry, matcher)) {
        combinedFlatPerUnit.push(perUnit);
      }
      continue;
    }
  }
  return { materialRates, laborRates, combinedFlatPerUnit };
}

/** Scope-family match without material/labor role — for undivided lump-sum captures. */
function libraryEntryMatchesScopeFamily(
  itemId: string,
  entry: ScopePricingLibraryRate,
  matcher: { match: RegExp; exclude?: RegExp }
): boolean {
  if (entryChecklistItemId(entry) === itemId) return true;
  if (normalizedNameImpliesItemId(itemId, entry.scopeItemName)) return true;

  const text = `${entry.scopeItemName} ${entry.category || ''}`.toLowerCase();
  if (!matcher.match.test(text)) return false;
  if (matcher.exclude?.test(text)) return false;
  const itemDemo = itemId.includes('demo') || /\bdemo\b/.test(itemId);
  const entryDemo = /\b(demo|demolition|removal|tear)\b/.test(text);
  if (itemDemo !== entryDemo) return false;
  if (/\bshower\b/.test(itemId) && /\bvanity\b/.test(text) && !/\bshower\b/.test(text)) return false;
  if (/\bvanity\b/.test(itemId) && /\bshower\b/.test(text) && !/\bvanity\b/.test(text)) return false;
  if (itemId === 'flooring' && /\btile\b/.test(text) && !/\blaminate|lvp|vinyl|flooring\b/.test(text)) {
    return false;
  }
  return true;
}

/** Split a combined $/unit library capture using typical national mat/labor mix. */
function splitCombinedLibraryPerUnit(itemId: string, perUnit: number): { materialRate: number; laborRate: number } {
  const ratioByItem: Record<string, { material: number; labor: number }> = {
    waterproofing: { material: 5, labor: 7 },
    shower_tile: { material: 8, labor: 18 },
    floor_tile: { material: 4, labor: 8 },
    flooring: { material: 3, labor: 5 },
  };
  const ratio = ratioByItem[itemId] || { material: 0.4, labor: 0.6 };
  const denom = ratio.material + ratio.labor;
  if (!(denom > 0)) {
    return { materialRate: perUnit * 0.4, laborRate: perUnit * 0.6 };
  }
  return {
    materialRate: Math.round((perUnit * ratio.material) / denom * 100) / 100,
    laborRate: Math.round((perUnit * ratio.labor) / denom * 100) / 100,
  };
}

/**
 * Median material/labor $/unit from pricing library for a Confirm Scope item.
 * Used in Step 2 after the active bid and before saved bid templates.
 */
export function resolveLibraryRateForItem(
  itemId: string,
  unit: string | null | undefined,
  rates: ScopePricingLibraryRate[] | null | undefined,
  matcher?: { match: RegExp; exclude?: RegExp } | null,
  takeoffQuantity?: number | null
): TemplateRateMatch | null {
  if (!rates?.length) return null;
  const resolvedMatcher = matcher || getRatePricingMatcher(itemId);
  if (!resolvedMatcher) return null;

  const targetUnit = String(unit || '').toLowerCase().trim();
  const normalizedUnit =
    /^(sqft|sf|sq\.?\s*ft)$/.test(targetUnit)
      ? 'sqft'
      : /^(lf|linear\s*ft|ln\.?\s*ft)$/.test(targetUnit)
        ? 'lf'
        : targetUnit;

  let { materialRates, laborRates, combinedFlatPerUnit } = collectLibraryRatesForUnit(
    itemId,
    rates,
    normalizedUnit,
    resolvedMatcher,
    takeoffQuantity
  );

  let materialRate = median(materialRates);
  let laborRate = median(laborRates);
  if (materialRate == null && laborRate == null && combinedFlatPerUnit.length) {
    const combined = median(combinedFlatPerUnit);
    if (combined != null) {
      const split = splitCombinedLibraryPerUnit(itemId, combined);
      materialRate = split.materialRate;
      laborRate = split.laborRate;
    }
  }
  if (materialRate == null && laborRate == null) return null;

  return {
    materialRate: materialRate ?? null,
    laborRate: laborRate ?? null,
    source: 'Pricing library',
  };
}

/**
 * Flat allowance/lump-sum total from pricing library (permits, plans, fees).
 * Matches by checklist item id or scope name — no material/labor split.
 */
export function resolveLibraryLumpSumForItem(
  itemId: string,
  rates: ScopePricingLibraryRate[] | null | undefined
): number | null {
  if (!rates?.length || !itemId) return null;
  const totals: number[] = [];

  for (const entry of rates) {
    const ut = String(entry.unitType || '').toLowerCase();
    const isLump =
      LUMP_UNITS.has(ut) || String(entry.category || '').toLowerCase() === 'lump_sum';
    if (!isLump) continue;

    const idMatch = entryChecklistItemId(entry) === itemId;
    const nameMatch = normalizedNameImpliesItemId(itemId, entry.scopeItemName);
    if (!idMatch && !nameMatch) continue;

    const total =
      positiveNumber(entry.totalAmount) ??
      (LUMP_UNITS.has(ut) ? positiveNumber(entry.unitRate) : null);
    if (total != null) totals.push(total);
  }

  return median(totals);
}
