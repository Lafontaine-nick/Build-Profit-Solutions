import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackages } from '@/utils/estimateAiDraft';

export function isScopeOnlyDraft(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  if (draft.noPricingDetected) return true;
  if (draft.noteProfile?.primary === 'scope_only') return true;
  const pkgs = getScopePackages(draft);
  if (pkgs.length > 0 && pkgs.every((p) => p.status === 'missing_price')) return true;
  return false;
}

export function scopePackagePricingHint(pkg: EstimateDraftScopePackage): string {
  const n = pkg.name.toLowerCase();
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
