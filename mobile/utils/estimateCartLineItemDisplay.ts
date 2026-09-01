import {
  resolveLaborContractLineItem,
  resolveMaterialCartUnitPrice,
} from './estimateLineItemHydration';

const IMPORT_AUDIT_SUFFIXES = [
  /\(Material\/labor split from notes — review on Labor step\.\)/gi,
  /\(National Average budget split applied — review on Labor step\.\)/gi,
  /\(AI-suggested labor split — review on Labor step\.\)/gi,
  /\(Price from notes includes labor and materials — split on steps if needed\.\)/gi,
  /\(Partial package — add remaining scope on Labor\/Materials steps\.\)/gi,
];

const LABOR_SUFFIX_RE = /\s—\s*labor\s*$/i;

/** Strip AI-import audit parentheticals for cart display only; stored data is unchanged. */
export function stripEstimateImportAuditSuffix(text: string): string {
  let result = String(text || '').trim();
  for (const pattern of IMPORT_AUDIT_SUFFIXES) {
    result = result.replace(pattern, '').trim();
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function estimateCartLaborTitle(item: {
  name?: string;
  description?: string;
}): string {
  const name = String(item?.name || '').trim();
  if (name) {
    return LABOR_SUFFIX_RE.test(name) ? name : `${name} — labor`;
  }
  const stripped = stripEstimateImportAuditSuffix(item?.description || '');
  const firstLine =
    stripped
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean) || '';
  if (!firstLine) return 'Labor';
  const short = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
  return LABOR_SUFFIX_RE.test(short) ? short : `${short} — labor`;
}

export function estimateCartMaterialTitle(item: {
  name?: string;
  description?: string;
}): string {
  const name = String(item?.name || '').trim();
  if (name) return name;
  const stripped = stripEstimateImportAuditSuffix(item?.description || '');
  const firstLine =
    stripped
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean) || '';
  return firstLine || 'Material';
}

export type MoneyFormatter = (amount: number) => string;

export function estimateCartMaterialQuantityLine(
  item: Parameters<typeof resolveMaterialCartUnitPrice>[0],
  formatMoney: MoneyFormatter
): string | null {
  const qty = Number(item?.quantity || item?.qty || 0);
  const unitPrice = resolveMaterialCartUnitPrice(item);
  if (!(qty > 0) || !(unitPrice > 0)) return null;

  const unit = String(item?.unit || '').trim().toLowerCase();
  const isSqft = item?.mode === 'sqft' || unit === 'sq ft' || unit === 'sqft';
  if (isSqft) {
    return `${qty} sq ft × ${formatMoney(unitPrice)}/sq ft`;
  }
  return `${qty} ${item?.unit || 'ea'} × ${formatMoney(unitPrice)}`;
}

export function estimateCartLaborQuantityLine(
  item: Parameters<typeof resolveLaborContractLineItem>[0],
  projectSqft: number,
  formatMoney: MoneyFormatter
): string | null {
  const resolved = resolveLaborContractLineItem(item, projectSqft);
  const qty = resolved.quantity;
  const rate = resolved.unitPrice;
  if (!(qty > 0) || !(rate > 0)) return null;

  if (resolved.mode === 'sqft') {
    return `${qty} sq ft × ${formatMoney(rate)}/sq ft`;
  }
  if (resolved.mode === 'hourly') {
    return `${qty} hrs × ${formatMoney(rate)}/hr`;
  }
  const unitLabel = String(resolved.unit || 'ea');
  return `${qty} ${unitLabel} × ${formatMoney(rate)}`;
}

export function estimateCartSourceLabel(
  displaySubtitle?: string | null
): string | null {
  const label = String(displaySubtitle || '').trim();
  return label || null;
}
