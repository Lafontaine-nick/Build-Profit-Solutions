import type { PricingLibrarySection } from '@/utils/contractorPricingMemory';
import { fetchPricingLibrary } from '@/utils/contractorPricingMemory';
import { getRatePricingMatcher } from '@/utils/scopeRatePricingParser';
import type { TemplateRateMatch } from '@/utils/scopeItemQuantities';

export type ScopePricingLibraryRate = {
  scopeItemName: string;
  category?: string;
  unitType: string;
  unitRate: number;
};

const LUMP_UNITS = new Set(['lump_sum', 'lot', 'flat', 'allowance']);
const UNIT_RATE_UNITS = new Set(['sqft', 'lf', 'hr', 'each']);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Flatten backend library sections into scope-context rate rows. */
export function pricingLibrarySectionsToScopeRates(
  sections: PricingLibrarySection[] | null | undefined
): ScopePricingLibraryRate[] {
  const out: ScopePricingLibraryRate[] = [];
  for (const section of sections || []) {
    for (const rate of section.items || []) {
      const ut = String(rate.unitType || '').toLowerCase();
      const amount = rate.unitRate ?? 0;
      if (!(amount > 0)) continue;
      if (!LUMP_UNITS.has(ut) && !UNIT_RATE_UNITS.has(ut)) continue;
      out.push({
        scopeItemName: rate.scopeItemName,
        category: rate.category,
        unitType: ut,
        unitRate: amount,
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
    entry.category === 'material' || /\bmaterial|allowance|supply\b/.test(text);
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

/**
 * Median material/labor $/unit from pricing library for a Confirm Scope item.
 * Used in Step 2 after the active bid and before saved bid templates.
 */
export function resolveLibraryRateForItem(
  itemId: string,
  unit: string | null | undefined,
  rates: ScopePricingLibraryRate[] | null | undefined,
  matcher?: { match: RegExp; exclude?: RegExp } | null
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

  const materialRates: number[] = [];
  const laborRates: number[] = [];

  for (const entry of rates) {
    if (entry.unitType !== normalizedUnit) continue;
    if (libraryEntryMatchesScopeItem(itemId, entry, 'material', resolvedMatcher)) {
      materialRates.push(entry.unitRate);
    }
    if (libraryEntryMatchesScopeItem(itemId, entry, 'labor', resolvedMatcher)) {
      laborRates.push(entry.unitRate);
    }
  }

  const materialRate = median(materialRates);
  const laborRate = median(laborRates);
  if (materialRate == null && laborRate == null) return null;

  return {
    materialRate: materialRate ?? null,
    laborRate: laborRate ?? null,
    source: 'Pricing library',
  };
}
