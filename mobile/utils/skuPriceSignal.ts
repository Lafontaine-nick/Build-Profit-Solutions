/**
 * Relative price label for a live retailer search.
 * Compares a shelf price only to other results with the same size and unit.
 * Items without enough matching peers get no label.
 */

export type SkuPriceSignal = 'lower' | 'typical' | 'higher';

export type SkuPricedItem = {
  title?: string | null;
  price?: number | null;
  unit?: string | null;
};

const LOWER_RATIO = 0.9;
const HIGHER_RATIO = 1.1;
const MIN_PEERS = 3;

function lengthToInches(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = (unit || '').toLowerCase();
  if (/ft|feet|foot/.test(u)) return value * 12;
  if (/in/.test(u)) return value;
  // Bare lumber lengths: 8, 10, 12, 16 are feet. 92 and 96 are inches.
  if (value <= 20) return value * 12;
  return value;
}

/** Cross-section plus length, so an 8 ft 2x4 is not compared to a 16 ft 2x4. */
export function skuSizeKey(title: string | null | undefined, unit: string | null | undefined): string | null {
  const text = String(title || '')
    .toLowerCase()
    .replace(/[″”"]/g, ' in');
  const labeled = text.match(
    /(\d+(?:\.\d+)?)\s*(?:in\.?)\s*x\s*(\d+(?:\.\d+)?)\s*(?:in\.?)\s*x\s*(\d+(?:\.\d+)?)\s*(in\.?|ft\.?|feet|foot)?/
  );
  const compact = text.match(
    /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(in\.?|ft\.?|feet|foot)?/
  );
  const match = labeled || compact;
  if (!match) return null;
  const lengthIn = lengthToInches(parseFloat(match[3]), match[4]);
  if (lengthIn == null) return null;
  const section = [match[1], match[2]]
    .map((n) => String(parseFloat(n)))
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .join('x');
  const soldAs = String(unit || 'each').trim().toLowerCase() || 'each';
  return `${section}x${Math.round(lengthIn)}|${soldAs}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function skuPriceSignalForRatio(price: number, peerMedian: number): SkuPriceSignal {
  if (!Number.isFinite(price) || !Number.isFinite(peerMedian) || peerMedian <= 0) return 'typical';
  const ratio = price / peerMedian;
  if (ratio < LOWER_RATIO) return 'lower';
  if (ratio > HIGHER_RATIO) return 'higher';
  return 'typical';
}

/** Index → signal. Missing index means there is no honest comparison. */
export function buildSkuPriceSignalMap(items: SkuPricedItem[]): Map<number, SkuPriceSignal> {
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0) return;
    const key = skuSizeKey(item.title, item.unit);
    if (!key) return;
    const bucket = groups.get(key) || [];
    bucket.push(index);
    groups.set(key, bucket);
  });

  const signals = new Map<number, SkuPriceSignal>();
  groups.forEach((indexes) => {
    if (indexes.length < MIN_PEERS) return;
    const peerMedian = median(indexes.map((index) => Number(items[index].price)));
    indexes.forEach((index) => {
      signals.set(index, skuPriceSignalForRatio(Number(items[index].price), peerMedian));
    });
  });
  return signals;
}
