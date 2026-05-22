import type { ScannedProduct } from '../lib/products/productScannerTypes';
import {
  isDirectProductPageUrl,
  normalizeScannedBarcode,
} from '../lib/products/productScannerTypes';

const parseMoney = (value: unknown): number | null => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const pickHomeDepotOffer = (offers: any[] = []) =>
  offers.find((offer) => {
    const merchant = String(offer?.merchant || '').toLowerCase();
    const domain = String(offer?.domain || '').toLowerCase();
    return merchant.includes('home depot') || domain.includes('homedepot.com');
  });

export async function lookupUpcItemDbProduct(upc: string): Promise<ScannedProduct | null> {
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

    const homeDepotOffer = pickHomeDepotOffer(item.offers);
    const unitPrice = parseMoney(homeDepotOffer?.price);
    const rawOfferUrl = String(homeDepotOffer?.link || homeDepotOffer?.url || '').trim();
    const sourceUrl =
      rawOfferUrl && /homedepot\.com/i.test(rawOfferUrl) && isDirectProductPageUrl(rawOfferUrl)
        ? rawOfferUrl
        : null;

    return {
      title: String(homeDepotOffer?.title || item.title).trim(),
      imageUrl: Array.isArray(item.images) ? item.images.find(Boolean) || null : null,
      supplier: 'Home Depot',
      supplierId: 'hd',
      unitPrice,
      sku: null,
      model: item.model || null,
      upc: item.upc || normalized,
      sourceUrl,
      rawCode: normalized,
      lookupStatus: unitPrice ? 'found' : 'manual_required',
      dataSource: 'upcitemdb',
    };
  } catch (error) {
    console.warn('UPCItemDB lookup failed:', error);
    return null;
  }
}
