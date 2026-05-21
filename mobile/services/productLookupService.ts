import { getApiBaseUrlWithDebug } from '../utils/apiConfig';
import type { ProductLookupResult, ProductSupplierId, ScannedProduct } from '../lib/products/productScannerTypes';
import { getStoreSearchUrl, supplierNameFromId } from '../lib/products/productScannerTypes';

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
  const trimmed = String(code || '').trim();
  if (!trimmed) {
    throw new Error('No barcode or QR value was detected.');
  }

  const rawApiBase = getApiBaseUrlWithDebug().replace(/\/+$/, '');
  const apiBase = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`;
  try {
    const response = await fetch(`${apiBase}/products/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: trimmed,
        codeType,
        sourceHint: sourceHint || inferSupplierFromCode(trimmed),
        zip,
      }),
    });
    if (!response.ok) {
      throw new Error(`Lookup failed (${response.status})`);
    }
    const data = await response.json();
    if (data?.product?.title) {
      return data as ProductLookupResult;
    }
  } catch (error) {
    console.warn('Product lookup fell back to manual confirmation:', error);
  }

  return makeManualFallback(trimmed, codeType, sourceHint);
}
