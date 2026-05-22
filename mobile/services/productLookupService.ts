import { getApiBaseUrlWithDebug } from '../utils/apiConfig';
import type { ProductLookupResult, ProductSupplierId, ScannedProduct } from '../lib/products/productScannerTypes';
import {
  getStoreSearchUrl,
  hasResolvedProductDetails,
  isDirectProductPageUrl,
  normalizeScannedBarcode,
  supplierNameFromId,
} from '../lib/products/productScannerTypes';
import { lookupHomeDepotDirect } from './homeDepotDirectLookup';
import { lookupUpcItemDbProduct } from './upcItemDbLookup';

const inferSupplierFromCode = (code: string): ProductSupplierId => {
  const lower = String(code || '').toLowerCase();
  if (lower.includes('homedepot.com') || lower.includes('home depot') || lower.includes('homedepot')) {
    return 'hd';
  }
  if (lower.includes('lowes.com') || lower.includes("lowe's") || lower.includes('lowes')) {
    return 'lowes';
  }
  return 'unknown';
};

const extractFallbackTitle = (code: string): string => {
  const raw = String(code || '').trim();
  if (!raw) return 'Scanned Product';
  try {
    const url = new URL(raw);
    const searchTerm = url.searchParams.get('searchTerm') || url.searchParams.get('q');
    if (searchTerm) return searchTerm;
    const pathPart = url.pathname
      .split('/')
      .filter(Boolean)
      .reverse()
      .find((part) => /[A-Za-z]/.test(part));
    if (pathPart) return decodeURIComponent(pathPart).replace(/[-_]+/g, ' ');
  } catch {
    // Barcode/SKU text, not a URL.
  }
  return raw;
};

export const buildScannedProductFromCode = (
  code: string,
  codeType?: string,
  sourceHint?: ProductSupplierId | string,
): ScannedProduct => {
  const normalized = normalizeScannedBarcode(code);
  return makeManualFallback(normalized, codeType, sourceHint).product;
};

const mergeResolvedProduct = (
  base: ScannedProduct,
  resolved: ScannedProduct | null,
): ScannedProduct => {
  if (!resolved) return base;

  const sourceUrl =
    (resolved.sourceUrl && isDirectProductPageUrl(resolved.sourceUrl) ? resolved.sourceUrl : null) ||
    (base.sourceUrl && isDirectProductPageUrl(base.sourceUrl) ? base.sourceUrl : null) ||
    resolved.sourceUrl ||
    base.sourceUrl;

  return {
    ...base,
    ...resolved,
    rawCode: base.rawCode,
    codeType: base.codeType,
    title: resolved.title || base.title,
    unitPrice: resolved.unitPrice ?? base.unitPrice,
    imageUrl: resolved.imageUrl ?? base.imageUrl,
    sku: resolved.sku ?? base.sku,
    model: resolved.model ?? base.model,
    upc: resolved.upc ?? base.upc,
    sourceUrl,
    lookupStatus: resolved.lookupStatus || base.lookupStatus,
    dataSource: resolved.dataSource || base.dataSource,
  };
};

const lookupDirectProductFromBackend = async ({
  code,
  codeType,
  sourceHint,
  zip,
}: {
  code: string;
  codeType?: string;
  sourceHint?: ProductSupplierId | string;
  zip?: string;
}): Promise<ScannedProduct | null> => {
  const rawApiBase = getApiBaseUrlWithDebug().replace(/\/+$/, '');
  const apiBase = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${apiBase}/products/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeType, sourceHint, zip }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    const product = data?.product as ScannedProduct | undefined;
    if (product?.sourceUrl && isDirectProductPageUrl(product.sourceUrl)) {
      return product;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const pickBestDirectProduct = (...candidates: Array<ScannedProduct | null | undefined>): ScannedProduct | null => {
  for (const candidate of candidates) {
    if (candidate?.sourceUrl && isDirectProductPageUrl(candidate.sourceUrl)) {
      return candidate;
    }
  }
  return candidates.find(Boolean) || null;
};

/** Resolve a direct store product URL before opening Home Depot (avoids wrong search results). */
export async function resolveScannedProductForStoreOpen({
  code,
  codeType,
  sourceHint,
  zip,
}: {
  code: string;
  codeType?: string;
  sourceHint?: ProductSupplierId | string;
  zip?: string;
}): Promise<ScannedProduct> {
  const trimmed = normalizeScannedBarcode(String(code || '').trim());
  const base = buildScannedProductFromCode(trimmed, codeType, sourceHint);

  if (base.sourceUrl && isDirectProductPageUrl(base.sourceUrl)) {
    return base;
  }

  if (base.supplierId === 'lowes') {
    return base;
  }

  const isBarcode = /^\d{8,14}$/.test(trimmed);
  const resolvedSourceHint = sourceHint || inferSupplierFromCode(trimmed);

  const [direct, upcProduct, backendProduct] = await Promise.all([
    lookupHomeDepotDirect(trimmed, zip),
    isBarcode ? lookupUpcItemDbProduct(trimmed) : Promise.resolve(null),
    lookupDirectProductFromBackend({
      code: trimmed,
      codeType,
      sourceHint: resolvedSourceHint,
      zip,
    }),
  ]);

  let best = pickBestDirectProduct(direct, upcProduct, backendProduct);

  if (!best?.sourceUrl || !isDirectProductPageUrl(best.sourceUrl)) {
    const modelQuery = upcProduct?.model || backendProduct?.model;
    if (modelQuery) {
      const byModel = await lookupHomeDepotDirect(modelQuery, zip);
      best = pickBestDirectProduct(byModel, best, upcProduct, direct, backendProduct);
    }
  }

  return mergeResolvedProduct(base, best);
};

const mergeLookupResults = (
  primary: ProductLookupResult,
  secondary: ScannedProduct | null,
  rawCode: string,
  codeType?: string,
): ProductLookupResult => {
  if (!secondary) return primary;
  if (hasResolvedProductDetails(primary.product)) return primary;

  const merged: ScannedProduct = {
    ...primary.product,
    ...secondary,
    rawCode,
    codeType: codeType || primary.product.codeType,
    title: secondary.title || primary.product.title,
    unitPrice: secondary.unitPrice ?? primary.product.unitPrice,
    imageUrl: secondary.imageUrl ?? primary.product.imageUrl,
    sku: secondary.sku ?? primary.product.sku,
    model: secondary.model ?? primary.product.model,
    upc: secondary.upc ?? primary.product.upc,
    sourceUrl: secondary.sourceUrl ?? primary.product.sourceUrl,
    lookupStatus: hasResolvedProductDetails(secondary) ? 'found' : primary.product.lookupStatus,
    dataSource: secondary.dataSource || primary.product.dataSource,
  };

  return {
    product: merged,
    metadata: {
      dataSource: merged.dataSource,
      requiresManualConfirmation: !hasResolvedProductDetails(merged),
      message: hasResolvedProductDetails(merged)
        ? undefined
        : primary.metadata?.message || 'Confirm the product details before adding it.',
    },
  };
};

const makeManualFallback = (code: string, codeType?: string, sourceHint?: ProductSupplierId | string): ProductLookupResult => {
  const supplierId =
    sourceHint === 'hd' || sourceHint === 'lowes' ? sourceHint : inferSupplierFromCode(code);
  const resolvedSupplierId = supplierId === 'unknown' ? 'hd' : supplierId;
  const product: ScannedProduct = {
    title: extractFallbackTitle(code),
    imageUrl: null,
    supplier: supplierNameFromId(resolvedSupplierId),
    supplierId: resolvedSupplierId,
    unitPrice: null,
    sku: null,
    model: null,
    upc: /^\d{8,14}$/.test(String(code || '').trim()) ? String(code).trim() : null,
    sourceUrl: String(code || '').startsWith('http')
      ? String(code).trim()
      : getStoreSearchUrl(resolvedSupplierId, code),
    rawCode: String(code || '').trim(),
    codeType,
    lookupStatus: 'manual_required',
    dataSource: 'manual',
  };
  return {
    product,
    metadata: {
      dataSource: 'manual',
      requiresManualConfirmation: true,
      message: 'Confirm the product details before adding it.',
    },
  };
};

export async function lookupScannedProduct({
  code,
  codeType,
  sourceHint,
  zip,
}: {
  code: string;
  codeType?: string;
  sourceHint?: ProductSupplierId | string;
  zip?: string;
}): Promise<ProductLookupResult> {
  const trimmed = normalizeScannedBarcode(String(code || '').trim());
  if (!trimmed) {
    throw new Error('No barcode or QR value was detected.');
  }

  const rawApiBase = getApiBaseUrlWithDebug().replace(/\/+$/, '');
  const apiBase = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`;
  const resolvedSourceHint = sourceHint || inferSupplierFromCode(trimmed);
  let result = makeManualFallback(trimmed, codeType, resolvedSourceHint);

  try {
    const response = await fetch(`${apiBase}/products/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: trimmed,
        codeType,
        sourceHint: resolvedSourceHint,
        zip,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.product?.title) {
        result = data as ProductLookupResult;
      }
    }
  } catch (error) {
    console.warn('Product lookup fell back to manual confirmation:', error);
  }

  if (!hasResolvedProductDetails(result.product) && resolvedSourceHint !== 'lowes') {
    const direct = await lookupHomeDepotDirect(trimmed, zip);
    result = mergeLookupResults(result, direct, trimmed, codeType);
  }

  if (!hasResolvedProductDetails(result.product) && resolvedSourceHint !== 'lowes') {
    const upcProduct = await lookupUpcItemDbProduct(trimmed);
    result = mergeLookupResults(result, upcProduct, trimmed, codeType);
  }

  return result;
}
