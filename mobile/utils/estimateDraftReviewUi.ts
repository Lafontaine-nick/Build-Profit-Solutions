import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import { draftHasApplyablePricing, proposalTotalForScopeName } from '@/utils/estimateAiDraftPricing';

export function isScopeOnlyDraft(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  if (draftHasApplyablePricing(draft)) return false;
  if (draft.noPricingDetected) return true;
  if (draft.noteProfile?.primary === 'scope_only') return true;
  const pkgs = getScopePackages(draft);
  if (pkgs.length > 0 && pkgs.every((p) => p.status === 'missing_price')) return true;
  return false;
}

/** True when one or more scope packages still need pricing (show Add pricing actions). */
export function draftHasUnpricedScope(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  return getScopePackages(draft).some((p) => {
    const amount = p.price ?? p.knownSubtotal ?? p.calculatedSubtotal ?? 0;
    if (amount > 0) return false;
    return p.status === 'missing_price' || p.status === 'partial_pricing' || !p.status;
  });
}

export function scopePackagePricingHint(pkg: EstimateDraftScopePackage): string {
  const n = pkg.name.toLowerCase();
  if (/tile/.test(n) && /install/.test(n) && !/demo/.test(n)) return 'needs material + install price';
  if (/tile|demo/.test(n)) return 'needs demo price';
  if (/laminate|flooring|lvp/.test(n) && !/baseboard/.test(n)) return 'needs material + labor price';
  if (/baseboard|trim/.test(n)) return 'needs material + labor price';
  return 'needs pricing';
}

export function formatScopeQuantity(pkg: EstimateDraftScopePackage): string | null {
  const q = pkg.scopeQuantities?.[0];
  if (!q) return null;
  return `${q.quantity.toLocaleString()} ${q.unit}`;
}

export function getStillNeededList(draft: EstimateAiDraft): string[] {
  if (draft.stillNeededReview?.length) return draft.stillNeededReview;
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      items.push(s);
    }
  };
  for (const pkg of getScopePackages(draft)) {
    if (pkg.status === 'missing_price') {
      const hint = scopePackagePricingHint(pkg);
      if (hint.includes('demo')) add(`Pricing for ${pkg.name} (demo)`);
      else if (hint.includes('material')) add(`Pricing for ${pkg.name} (material + labor)`);
      else add(`Pricing for ${pkg.name}`);
    }
  }
  if (!draft.customerName) add('Customer name');
  if (!draft.projectAddress) add('Project address');
  for (const m of draft.missingInfo || []) {
    if (/payment/i.test(m)) add('Payment terms');
    if (/permit/i.test(m)) add('Permit responsibility');
  }
  return items;
}

export function dedupeDraftWarnings(draft: EstimateAiDraft): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...(draft.pricingWarnings || []), ...(draft.warnings || [])]) {
    const key = String(w).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(w).trim());
  }
  return out;
}

const STATUS_SHORT: Record<string, string> = {
  confirmed: 'Confirmed',
  user_provided: 'From notes',
  rough_price: 'Rough',
  partial_pricing: 'Partial',
  calculated: 'Calculated',
  ai_suggested: 'AI split',
  needs_review: 'Review',
  missing_price: 'Needs price',
};

export function compactPackageStatusLabel(pkg: EstimateDraftScopePackage): string {
  return STATUS_SHORT[pkg.status] || 'Review';
}

export function compactPackageAmount(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string | null {
  const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal;
  if (amount != null && amount > 0) return formatDraftMoney(amount);
  const pending = proposalTotalForScopeName(draft?.pendingPricingProposal, pkg.name);
  if (pending > 0) return formatDraftMoney(pending);
  return null;
}

export function getCompactProjectSummary(draft: EstimateAiDraft): string {
  const parts: string[] = [];
  if (draft.projectTitle?.trim()) parts.push(draft.projectTitle.trim());
  else if (draft.projectType && draft.projectType !== 'other') {
    parts.push(draft.projectType.replace(/_/g, ' '));
  }
  if (draft.customerName?.trim()) parts.push(draft.customerName.trim());
  const pkgs = getScopePackages(draft);
  if (pkgs.length > 0) parts.push(`${pkgs.length} scope item${pkgs.length === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'Draft from your notes';
}

export function getCompactStillNeeded(draft: EstimateAiDraft, max = 5): { items: string[]; overflow: number } {
  const raw =
    draft.stillNeededReview?.length ? draft.stillNeededReview : getStillNeededList(draft);
  const needsReview = draft.needsReviewItems?.length ? draft.needsReviewItems : draft.missingInfo || [];
  const merged: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    merged.push(s.trim());
  };
  for (const s of raw) add(s);
  for (const s of needsReview) {
    if (/partial pricing for/i.test(s)) continue;
    if (/:\s*partial pricing/i.test(s)) continue;
    add(s);
  }
  const items = groupGenericMissingScopeItems(merged).slice(0, max);
  return { items, overflow: Math.max(0, merged.length - max) };
}

export function summarizeWhatAiDidForDisplay(lines: string[], max = 4): string[] {
  if (lines.length <= max) return lines;
  const preserved = lines.filter((l) => /preserved your total/i.test(l));
  const partial = lines.filter((l) => /partial pricing for/i.test(l));
  const rest = lines.filter(
    (l) => !/preserved your total/i.test(l) && !/partial pricing for/i.test(l)
  );
  const out = [...rest];
  if (preserved.length >= 2) {
    out.push(`Preserved ${preserved.length} room totals from your notes (unchanged).`);
  } else {
    out.push(...preserved);
  }
  if (partial.length >= 2) {
    out.push(`${partial.length} areas have partial pricing — finish missing items before bidding.`);
  } else {
    out.push(...partial);
  }
  return out.slice(0, max);
}

export function compactNeedsReviewForDisplay(items: string[], max = 6): { items: string[]; overflow: number } {
  const filtered = items.filter(
    (s) =>
      !/^[^:]+:\s*partial pricing/i.test(s) &&
      !/^[^:]+:\s*user-provided total/i.test(s) &&
      !/package\(s\) have partial pricing/i.test(s)
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of filtered) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(s.trim());
  }
  const grouped = groupGenericMissingScopeItems(unique);
  return { items: grouped.slice(0, max), overflow: Math.max(0, grouped.length - max) };
}

const GENERIC_SCOPE_MISSING = [
  'demo / removal',
  'plumbing reconnect / hookup',
  'glass / shower door',
  'painting labor and materials',
  'flooring labor and materials',
  'sink and faucet (supply + install)',
  'haul-off / disposal',
  'concrete labor / finish / pump',
  'deck / patio labor and materials',
];

export function groupGenericMissingScopeItems(items: string[]): string[] {
  const genericHits: string[] = [];
  const rest: string[] = [];
  for (const item of items) {
    const k = item.trim().toLowerCase();
    if (GENERIC_SCOPE_MISSING.includes(k)) genericHits.push(item);
    else rest.push(item);
  }
  if (genericHits.length >= 3) {
    return [...rest, 'Finish pricing on partial scope (demo, plumbing, paint, flooring, etc.)'];
  }
  return items;
}

const EXCEEDS_KNOWN_RE =
  /^(.+?):\s*user total \$[\d,]+ exceeds itemized known \$[\d,]+(?:\s*—\s*confirm line items)?\.?$/i;

export function summarizePricingWarnings(warnings: string[]): string[] {
  if (warnings.length === 0) return [];
  const exceededRooms: string[] = [];
  const other: string[] = [];
  for (const w of warnings) {
    const text = String(w).trim();
    if (/line items match stated total/i.test(text)) continue;
    const m = text.match(EXCEEDS_KNOWN_RE);
    if (m) exceededRooms.push(m[1].trim());
    else other.push(text);
  }
  const out: string[] = [];
  if (exceededRooms.length >= 2) {
    out.push(
      `${exceededRooms.length} rooms: note total is higher than itemized prices — confirm totals or finish line-item pricing.`
    );
  } else if (exceededRooms.length === 1) {
    out.push(
      warnings.find((w) => EXCEEDS_KNOWN_RE.test(String(w))) ||
        `${exceededRooms[0]}: note total exceeds itemized prices — confirm line items.`
    );
  }
  const partialLine = other.find((w) => /partial pricing|scope package/i.test(w));
  if (partialLine) out.push(partialLine.replace(/\d+ scope package/, (n) => n));
  const lumpLine = other.find((w) => /lump-sum/i.test(w));
  if (lumpLine) out.push(lumpLine);
  for (const w of other) {
    if (w === partialLine || w === lumpLine) continue;
    if (out.length >= 4) break;
    if (!out.some((x) => x.toLowerCase() === w.toLowerCase())) out.push(w);
  }
  return out.slice(0, 4);
}

export function dedupeMissingPriceSuggestions(
  suggestions: Array<{ missingItem?: string; scopeItemName?: string; suggestedUnitRate?: number; unitType?: string }>,
  max = 4
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of suggestions) {
    const label = (s.missingItem || s.scopeItemName || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rate =
      s.suggestedUnitRate != null ? `: $${s.suggestedUnitRate}/${s.unitType || 'unit'}` : '';
    lines.push(`${label}${rate}`);
    if (lines.length >= max) break;
  }
  return lines;
}

export const SCOPE_LIST_DEFAULT_LIMIT = 6;

export function shouldHidePerRowStatus(packages: EstimateDraftScopePackage[]): boolean {
  if (packages.length === 0) return false;
  const statuses = new Set(packages.map((p) => p.status));
  if (statuses.size !== 1) return false;
  const only = packages[0].status;
  return only === 'partial_pricing' || only === 'user_provided' || only === 'confirmed';
}

export function getUniformStatusLabel(packages: EstimateDraftScopePackage[]): string | null {
  if (!shouldHidePerRowStatus(packages)) return null;
  const status = packages[0].status;
  if (status === 'partial_pricing') return 'Partial pricing on all items';
  if (status === 'user_provided' || status === 'confirmed') return 'Totals from your notes';
  return null;
}
