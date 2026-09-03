import { postProductsLookup } from '../utils/productLookupApi';
import type { ProductLookupResult, ProductSupplierId, ScannedProduct } from '../lib/products/productScannerTypes';
import {
  catalogProductMatchesBarcode,
  getProductUnitPrice,
  getStoreSearchUrl,
  hasResolvedProductDetails,
  isBarcodePlaceholderTitle,
  isBarcodeScanCode,
  isDirectProductPageUrl,
  isUniversalLookupMode,
  normalizeScannedBarcode,
  supplierNameFromId,
  upcDigitsMatch,
} from '../lib/products/productScannerTypes';
import { lookupHomeDepotDirect } from './homeDepotDirectLookup';
import { lookupLowesDirect } from './lookupLowesDirect';
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

const resolveLookupWithin = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return (await Promise.race([promise, timeout])) as T | null;
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const resolveSupplierId = (
  code: string,
  sourceHint?: ProductSupplierId | string,
): ProductSupplierId => {
  if (sourceHint === 'hd' || sourceHint === 'lowes' || sourceHint === 'generic') {
    return sourceHint;
  }
  if (!sourceHint || sourceHint === 'auto') {
    const inferred = inferSupplierFromCode(code);
    if (inferred === 'hd' || inferred === 'lowes') return inferred;
    return 'generic';
  }
  const inferred = inferSupplierFromCode(code);
  return inferred === 'unknown' ? 'hd' : inferred;
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
    title: pickBetterTitle(base.title, resolved.title, base.rawCode),
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
  try {
    const data = await postProductsLookup(
      { code, codeType, sourceHint, zip },
      sourceHint === 'lowes' ? 45000 : 12000,
    );
    const product = data?.product as ScannedProduct | undefined;
    if (isUsefulCatalogProduct(product, code)) {
      return product!;
    }
    return null;
  } catch {
    return null;
  }
};

const pickBetterTitle = (
  primary?: string | null,
  secondary?: string | null,
  rawCode?: string | null,
): string => {
  if (secondary && !isBarcodePlaceholderTitle(secondary, rawCode)) return secondary;
  if (primary && !isBarcodePlaceholderTitle(primary, rawCode)) return primary;
  return secondary || primary || '';
};

const isUsefulCatalogProduct = (
  product?: ScannedProduct | null,
  rawCode?: string | null,
): boolean => {
  if (!product) return false;
  const code = rawCode || product.rawCode;
  const isBarcode = isBarcodeScanCode(code);

  if (isBarcode && product.supplierId === 'hd') {
    if (!catalogProductMatchesBarcode(product, String(code))) {
      return false;
    }
  }

  if (product.supplierId === 'generic' && product.dataSource === 'upcitemdb') {
    return !isBarcodePlaceholderTitle(product.title, code) || getProductUnitPrice(product) > 0;
  }

  if (isBarcode && product.supplierId === 'lowes') {
    if (product.dataSource === 'serpapi_lowes' || product.dataSource === 'webscraping') {
      return Boolean(
        product.sourceUrl &&
        /lowes\.com/i.test(product.sourceUrl) &&
        !isBarcodePlaceholderTitle(product.title, code),
      );
    }
    if (product.upc && upcDigitsMatch(String(code), product.upc)) {
      return true;
    }
    if (
      product.sourceUrl &&
      isDirectProductPageUrl(product.sourceUrl) &&
      !isBarcodePlaceholderTitle(product.title, code)
    ) {
      return true;
    }
    return false;
  }

  if (hasResolvedProductDetails(product)) return true;
  if (product.sourceUrl && isDirectProductPageUrl(product.sourceUrl)) return true;
  if (!isBarcodePlaceholderTitle(product.title, code)) return true;
  return getProductUnitPrice(product) > 0;
};

const pickBestCatalogProduct = (
  ...candidates: Array<ScannedProduct | null | undefined>
): ScannedProduct | null => {
  const ranked = candidates.filter(Boolean) as ScannedProduct[];
  if (!ranked.length) return null;

  const score = (product: ScannedProduct): number => {
    let value = 0;
    if (hasResolvedProductDetails(product)) value += 100;
    if (!isBarcodePlaceholderTitle(product.title, product.rawCode)) value += 40;
    if (getProductUnitPrice(product) > 0) value += 30;
    if (product.sourceUrl && isDirectProductPageUrl(product.sourceUrl)) value += 20;
    if (product.imageUrl) value += 5;
    return value;
  };

  return ranked.sort((a, b) => score(b) - score(a))[0] || null;
};

/** Merge retailer catalog hits into an any-store product without assigning a retailer. */
const mergeIntoGenericProduct = (
  base: ScannedProduct,
  candidate: ScannedProduct | null | undefined,
): ScannedProduct => {
  if (!candidate) return base;

  const title =
    !isBarcodePlaceholderTitle(candidate.title, base.rawCode) && candidate.title
      ? candidate.title
      : base.title;
  const unitPrice = getProductUnitPrice(candidate) || getProductUnitPrice(base) || null;
  const merged: ScannedProduct = {
    ...base,
    title,
    unitPrice,
    imageUrl: candidate.imageUrl ?? base.imageUrl,
    sku: candidate.sku ?? base.sku,
    model: candidate.model ?? base.model,
    upc: candidate.upc ?? base.upc,
    supplierId: 'generic',
    supplier: supplierNameFromId('generic'),
    sourceUrl: null,
    dataSource: candidate.dataSource || base.dataSource,
    lookupStatus:
      unitPrice && !isBarcodePlaceholderTitle(title, base.rawCode) ? 'found' : 'manual_required',
  };
  return merged;
};

const scoreUniversalCandidate = (product: ScannedProduct, rawCode: string): number => {
  let value = 0;
  const isRetailer = product.supplierId === 'hd' || product.supplierId === 'lowes';
  if (hasResolvedProductDetails(product)) value += 100;
  if (!isBarcodePlaceholderTitle(product.title, rawCode)) value += 40;
  if (getProductUnitPrice(product) > 0) value += 30;
  if (product.sourceUrl) {
    value += isDirectProductPageUrl(product.sourceUrl) ? 25 : 15;
  }
  if (isRetailer) value += 20;
  if (product.imageUrl) value += 5;
  if (product.supplierId === 'generic' && product.dataSource === 'upcitemdb') value += 25;
  if (product.supplierId === 'generic' && product.dataSource === 'serpapi_generic') {
    // This result is based on multiple exact-UPC web results, so it outranks
    // a single stale UPCItemDB record when their product identities disagree.
    value += 50;
  }
  if (product.supplierId === 'lowes' && product.barcodeVerified === false) {
    // Keep a valid Lowe's PDP as a fallback when the UPC is not printed on
    // the page, but let verified retailer/catalog evidence win.
    value += 40;
  }
  if (product.supplierId === 'hd' && product.dataSource === 'serpapi_hd_barcode') {
    // When the same UPC is sold by multiple retailers, prefer a verified HD result
    // over a Lowe's title discovered from a broad search.
    value += 80;
  }

  if (isBarcodeScanCode(rawCode)) {
    if (catalogProductMatchesBarcode(product, rawCode)) {
      value += 150;
      if (product.upc && upcDigitsMatch(rawCode, product.upc)) value += 40;
    } else if (isRetailer) {
      value -= 500;
    }
  }

  return value;
};

const pickBestUniversalProduct = (
  rawCode: string,
  candidates: Array<ScannedProduct | null | undefined>,
): ScannedProduct | null => {
  const ranked = candidates.filter(
    (candidate): candidate is ScannedProduct =>
      Boolean(candidate && isUsefulCatalogProduct(candidate, rawCode)),
  );
  if (!ranked.length) return null;
  return ranked.sort((a, b) => scoreUniversalCandidate(b, rawCode) - scoreUniversalCandidate(a, rawCode))[0];
};

const resolveUniversalProductLookup = async ({
  trimmed,
  codeType,
  zip,
}: {
  trimmed: string;
  codeType?: string;
  zip?: string;
}): Promise<ScannedProduct> => {
  const base = makeManualFallback(trimmed, codeType, 'generic').product;
  const isBarcode = isBarcodeScanCode(trimmed);

  if (!isBarcode) {
    return base;
  }

  const [hdDirect, lowesDirect, upcProduct, genericBackend] = await Promise.all([
    resolveLookupWithin(lookupHomeDepotDirect(trimmed, zip), 5000),
    resolveLookupWithin(lookupLowesDirect(trimmed, zip), 8000),
    resolveLookupWithin(lookupUpcItemDbProduct(trimmed, 'generic'), 4000),
    resolveLookupWithin(
      lookupDirectProductFromBackend({ code: trimmed, codeType, sourceHint: 'generic', zip }),
      8000,
    ),
  ]);

  const initialCandidates = [hdDirect, lowesDirect, upcProduct, genericBackend];
  const genericCandidateNeedingPrice = initialCandidates.find(
    (candidate) =>
      candidate?.supplierId === 'generic' &&
      getProductUnitPrice(candidate) <= 0 &&
      !isBarcodePlaceholderTitle(candidate.title, trimmed),
  );
  const genericPriceProduct = genericCandidateNeedingPrice
    ? await resolveLookupWithin(
        lookupDirectProductFromBackend({
          code: genericCandidateNeedingPrice.title,
          codeType: 'keyword',
          sourceHint: 'generic',
          zip,
        }),
        8000,
      )
    : null;
  const candidates = [...initialCandidates, genericPriceProduct];
  let best = pickBestUniversalProduct(trimmed, candidates);

  const verifiedHomeDepot = candidates.find(
    (candidate) =>
      candidate?.supplierId === 'hd' && catalogProductMatchesBarcode(candidate, trimmed),
  );
  const lowesProductPage = candidates.find(
    (candidate) =>
      candidate?.supplierId === 'lowes' &&
      candidate?.sourceUrl &&
      isDirectProductPageUrl(candidate.sourceUrl) &&
      !isBarcodePlaceholderTitle(candidate.title, trimmed),
  );
  const pricedGeneric = candidates.find(
    (candidate) =>
      candidate?.supplierId === 'generic' &&
      getProductUnitPrice(candidate) > 0 &&
      candidate?.sourceUrl,
  );

  // A valid Lowe's PDP remains primary when no verified HD result exists.
  if (verifiedHomeDepot) {
    best = verifiedHomeDepot;
  } else if (pricedGeneric) {
    best = pricedGeneric;
  } else if (lowesProductPage) {
    best = lowesProductPage;
  }

  if (!hasResolvedProductDetails(best)) {
    const modelQuery = best?.model || hdDirect?.model || lowesDirect?.model;
    if (modelQuery) {
      const byModel = await resolveLookupWithin(lookupHomeDepotDirect(modelQuery, zip), 5000);
      if (byModel && isUsefulCatalogProduct(byModel, trimmed)) {
        const modelBest = pickBestUniversalProduct(trimmed, [best, byModel]);
        if (modelBest) best = modelBest;
      }
    }
  }

  if (!best) return base;

  return {
    ...base,
    ...best,
    rawCode: trimmed,
    codeType: codeType || best.codeType,
    title: pickBetterTitle(base.title, best.title, trimmed),
  };
};

const enrichGenericProductLookup = async ({
  trimmed,
  codeType,
  zip,
  base,
}: {
  trimmed: string;
  codeType?: string;
  zip?: string;
  base: ScannedProduct;
}): Promise<ScannedProduct> => {
  const isBarcode = /^\d{8,14}$/.test(trimmed);
  let product = { ...base, supplierId: 'generic' as const, supplier: supplierNameFromId('generic'), sourceUrl: null };

  if (isBarcode) {
    const upcProduct = await lookupUpcItemDbProduct(trimmed, 'generic');
    product = mergeIntoGenericProduct(product, upcProduct);
  }

  const needsTitle = isBarcodePlaceholderTitle(product.title, product.rawCode);
  const needsPrice = getProductUnitPrice(product) <= 0;

  if (isBarcode && (needsTitle || needsPrice)) {
    const [hdDirect, hdBackend, lowesBackend, lowesDirect] = await Promise.all([
      lookupHomeDepotDirect(trimmed, zip),
      lookupDirectProductFromBackend({ code: trimmed, codeType, sourceHint: 'hd', zip }),
      lookupDirectProductFromBackend({ code: trimmed, codeType, sourceHint: 'lowes', zip }),
      lookupLowesDirect(trimmed, zip),
    ]);

    for (const candidate of [hdDirect, hdBackend, lowesDirect, lowesBackend]) {
      product = mergeIntoGenericProduct(product, candidate);
      if (
        !isBarcodePlaceholderTitle(product.title, product.rawCode) &&
        getProductUnitPrice(product) > 0
      ) {
        break;
      }
    }

    if (needsTitle || getProductUnitPrice(product) <= 0) {
      const modelQuery = product.model || hdBackend?.model || lowesBackend?.model;
      if (modelQuery) {
        const byModel = await lookupHomeDepotDirect(modelQuery, zip);
        product = mergeIntoGenericProduct(product, byModel);
      }
    }
  }

  return product;
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

  const isBarcode = /^\d{8,14}$/.test(trimmed);
  const store = resolveSupplierId(trimmed, sourceHint);

  if (store === 'generic') {
    const enriched = await enrichGenericProductLookup({
      trimmed,
      codeType,
      zip,
      base,
    });
    return enriched;
  }

  const [direct, upcProduct, backendProduct] = await Promise.all([
    store === 'hd'
      ? lookupHomeDepotDirect(trimmed, zip)
      : store === 'lowes'
        ? lookupLowesDirect(trimmed, zip)
        : Promise.resolve(null),
    isBarcode ? lookupUpcItemDbProduct(trimmed, store) : Promise.resolve(null),
    lookupDirectProductFromBackend({
      code: trimmed,
      codeType,
      sourceHint: store,
      zip,
    }),
  ]);

  let best = pickBestCatalogProduct(direct, upcProduct, backendProduct);

  if (store === 'hd' && (!best?.sourceUrl || !isDirectProductPageUrl(best.sourceUrl))) {
    const modelQuery = upcProduct?.model || backendProduct?.model;
    if (modelQuery) {
      const byModel = await lookupHomeDepotDirect(modelQuery, zip);
      best = pickBestCatalogProduct(byModel, best, upcProduct, direct, backendProduct);
    }
  }

  if (store === 'lowes' && !hasResolvedProductDetails(best)) {
    const modelQuery = upcProduct?.model || backendProduct?.model;
    if (modelQuery) {
      const byModel = await lookupLowesDirect(modelQuery, zip);
      best = pickBestCatalogProduct(byModel, best, upcProduct, direct, backendProduct);
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
  if (
    hasResolvedProductDetails(primary.product) &&
    !hasResolvedProductDetails(secondary) &&
    isBarcodePlaceholderTitle(secondary.title, rawCode)
  ) {
    return primary;
  }
  if (hasResolvedProductDetails(primary.product) && hasResolvedProductDetails(secondary)) {
    return primary;
  }

  const merged: ScannedProduct = {
    ...primary.product,
    ...secondary,
    rawCode,
    codeType: codeType || primary.product.codeType,
    title: pickBetterTitle(primary.product.title, secondary.title, rawCode),
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
  const resolvedSupplierId = resolveSupplierId(code, sourceHint);
  const searchUrl = getStoreSearchUrl(resolvedSupplierId, code);
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
      : searchUrl,
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

  if (isUniversalLookupMode(sourceHint)) {
    const inferred = inferSupplierFromCode(trimmed);
    if (inferred === 'hd' || inferred === 'lowes') {
      return lookupScannedProduct({ code: trimmed, codeType, sourceHint: inferred, zip });
    }

    const enriched = await resolveUniversalProductLookup({ trimmed, codeType, zip });
    const requiresManual = !hasResolvedProductDetails(enriched);
    let message: string | undefined;
    if (enriched.supplierId === 'lowes' && requiresManual) {
      message = "Product found on Lowe's. Confirm the current unit cost before adding.";
    } else if (enriched.supplierId === 'generic') {
      message = 'Confirm the store, price, and product details before adding.';
    }

    return {
      product: enriched,
      metadata: {
        dataSource: enriched.dataSource,
        requiresManualConfirmation: requiresManual,
        message,
      },
    };
  }

  const resolvedSourceHint = resolveSupplierId(trimmed, sourceHint);
  let result = makeManualFallback(trimmed, codeType, resolvedSourceHint);

  if (resolvedSourceHint === 'lowes') {
    try {
      const data = await postProductsLookup(
        {
          code: trimmed,
          codeType,
          sourceHint: resolvedSourceHint,
          zip,
        },
        45000,
      );
      if (data?.product && isUsefulCatalogProduct(data.product as ScannedProduct, trimmed)) {
        result = data as ProductLookupResult;
      }
    } catch (error) {
      console.warn('Lowe’s product lookup fell back:', error);
    }
  } else if (resolvedSourceHint !== 'generic') {
    try {
      const data = await postProductsLookup({
        code: trimmed,
        codeType,
        sourceHint: resolvedSourceHint,
        zip,
      });
      if (data?.product && isUsefulCatalogProduct(data.product as ScannedProduct, trimmed)) {
        result = data as ProductLookupResult;
      }
    } catch (error) {
      console.warn('Product lookup fell back to manual confirmation:', error);
    }
  }

  if (resolvedSourceHint === 'generic') {
    const enriched = await enrichGenericProductLookup({
      trimmed,
      codeType,
      zip,
      base: result.product,
    });
    return {
      product: enriched,
      metadata: {
        dataSource: enriched.dataSource,
        requiresManualConfirmation: true,
        message: 'Confirm the store, price, and product details before adding.',
      },
    };
  }

  if (!hasResolvedProductDetails(result.product)) {
    const isBarcode = /^\d{8,14}$/.test(trimmed);
    if (isBarcode) {
      const upcProduct = await lookupUpcItemDbProduct(trimmed, resolvedSourceHint);
      result = mergeLookupResults(result, upcProduct, trimmed, codeType);
    }
  }

  if (!hasResolvedProductDetails(result.product) && resolvedSourceHint === 'hd') {
    const direct = await lookupHomeDepotDirect(trimmed, zip);
    result = mergeLookupResults(result, direct, trimmed, codeType);
  }

  if (!hasResolvedProductDetails(result.product) && resolvedSourceHint === 'lowes') {
    const direct = await lookupLowesDirect(trimmed, zip);
    result = mergeLookupResults(result, direct, trimmed, codeType);
  }

  if (
    resolvedSourceHint === 'lowes' &&
    result.product &&
    !isBarcodePlaceholderTitle(result.product.title, trimmed) &&
    !hasResolvedProductDetails(result.product)
  ) {
    result = {
      ...result,
      metadata: {
        ...result.metadata,
        requiresManualConfirmation: true,
        message:
          result.metadata?.message ||
          'Product found on Lowe’s. Confirm the current unit cost before adding.',
      },
    };
  }

  return result;
}
