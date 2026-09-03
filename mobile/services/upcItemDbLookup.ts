import type { ProductSupplierId, ScannedProduct } from '../lib/products/productScannerTypes';
import {
  isDirectProductPageUrl,
  normalizeScannedBarcode,
  supplierNameFromId,
} from '../lib/products/productScannerTypes';

const parseMoney = (value: unknown): number | null => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const pickStoreOffer = (offers: any[] = [], store: ProductSupplierId = 'hd') =>
  offers.find((offer) => {
    const merchant = String(offer?.merchant || '').toLowerCase();
    const domain = String(offer?.domain || '').toLowerCase();
    if (store === 'lowes') {
      return merchant.includes('lowe') || domain.includes('lowes.com');
    }
    if (store === 'generic') {
      return Boolean(parseMoney(offer?.price));
    }
    return merchant.includes('home depot') || domain.includes('homedepot.com');
  });

export async function lookupUpcItemDbProduct(
  upc: string,
  store: ProductSupplierId = 'hd',
): Promise<ScannedProduct | null> {
  const normalized = normalizeScannedBarcode(upc);
  if (!/^\d{8,14}$/.test(normalized)) return null;

  try {
    const response = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(normalized)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) return null;

    const payload = await response.json();
    const item = payload?.items?.[0];
    if (!item?.title) return null;

    const isGeneric = store === 'generic';
    const storeOffer = pickStoreOffer(item.offers, store);
    const unitPrice = parseMoney(storeOffer?.price);
    const rawOfferUrl = String(storeOffer?.link || storeOffer?.url || '').trim();
    let sourceUrl: string | null = null;
    if (isGeneric && rawOfferUrl) {
      sourceUrl = rawOfferUrl;
    } else if (!isGeneric && rawOfferUrl) {
      const domainPattern = store === 'lowes' ? /lowes\.com/i : /homedepot\.com/i;
      if (domainPattern.test(rawOfferUrl) && isDirectProductPageUrl(rawOfferUrl)) {
        sourceUrl = rawOfferUrl;
      }
    }

    const merchantName = String(storeOffer?.merchant || '').trim();
    const fallbackSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `${item.title} ${normalized}`,
    )}`;

    return {
      title: String(storeOffer?.title || item.title).trim(),
      imageUrl: Array.isArray(item.images) ? item.images.find(Boolean) || null : null,
      supplier: isGeneric && merchantName ? merchantName : supplierNameFromId(store),
      supplierId: store,
      unitPrice,
      sku: null,
      model: item.model || null,
      upc: item.upc || normalized,
      sourceUrl: sourceUrl || (isGeneric ? fallbackSearchUrl : null),
      rawCode: normalized,
      lookupStatus:
        isGeneric
          ? unitPrice
            ? 'found'
            : 'manual_required'
          : unitPrice
            ? 'found'
            : 'manual_required',
      dataSource: 'upcitemdb',
    };
  } catch (error) {
    console.warn('UPCItemDB lookup failed:', error);
    return null;
  }
}
