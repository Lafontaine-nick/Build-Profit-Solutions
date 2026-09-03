export type ProductSupplierId = 'hd' | 'lowes' | 'generic' | 'unknown';

export type ProductScannerDestination =
  | 'estimate'
  | 'project_budget'
  | 'change_order'
  | 'purchase_order';

export type ScannedProduct = {
  title: string;
  imageUrl?: string | null;
  supplier: string;
  supplierId: ProductSupplierId;
  unitPrice?: number | null;
  sku?: string | null;
  model?: string | null;
  upc?: string | null;
  sourceUrl?: string | null;
  rawCode: string;
  codeType?: string;
  lookupStatus?: 'found' | 'manual_required';
  dataSource?: string;
  /** Set only when a retailer result was explicitly tied to the scanned barcode. */
  barcodeVerified?: boolean;
};

export type ProductLookupResult = {
  product: ScannedProduct;
  metadata?: {
    dataSource?: string;
    requiresManualConfirmation?: boolean;
    message?: string;
  };
};

export type ProductScannerSavePayload = {
  product: ScannedProduct;
  destination: ProductScannerDestination;
  quantity: number;
  unitCost: number;
  markupPct?: number;
  description?: string;
  notes?: string;
  customerNotes?: string;
  changeOrderId?: string;
  /** Store/vendor name for generic (any-store) scans — e.g. Floor & Decor, Ferguson. */
  vendor?: string;
};

export const supplierNameFromId = (supplierId?: ProductSupplierId | string | null): string => {
  if (supplierId === 'hd') return 'Home Depot';
  if (supplierId === 'lowes') return "Lowe's";
  if (supplierId === 'generic') return 'Any store';
  return 'Unknown supplier';
};

export const isGenericSupplier = (supplierId?: ProductSupplierId | string | null): boolean =>
  supplierId === 'generic' || supplierId === 'unknown';

export const isUniversalLookupMode = (sourceHint?: ProductSupplierId | string | null): boolean =>
  !sourceHint || sourceHint === 'auto' || sourceHint === 'generic';

export const getProductPageLabel = (product: ScannedProduct): string => {
  if (product.supplierId === 'lowes') return "View on Lowe's";
  if (product.supplierId === 'hd') return 'View on Home Depot';
  const supplier = String(product.supplier || '').trim();
  if (supplier && supplier !== 'Any store' && supplier !== 'Unknown supplier') {
    return `View on ${supplier}`;
  }
  return 'View product page';
};

export const supplierStoreFromProduct = (product: ScannedProduct): 'hd' | 'lowes' => {
  return product.supplierId === 'lowes' ? 'lowes' : 'hd';
};

export const getProductUnitPrice = (product: ScannedProduct): number => {
  const price = Number(product.unitPrice || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
};

export const getStoreSearchUrl = (supplierId: ProductSupplierId | string | null | undefined, query: string): string | null => {
  if (supplierId === 'generic' || supplierId === 'unknown') return null;
  const q = encodeURIComponent(String(query || '').trim());
  if (supplierId === 'lowes') {
    return `https://www.lowes.com/search?searchTerm=${q}`;
  }
  return `https://www.homedepot.com/s/${q.replace(/%20/g, '+')}`;
};

export const getProductPageUrl = (product: ScannedProduct): string | null => {
  const url = String(product.sourceUrl || '').trim();
  if (url) return url;
  const code = product.upc || product.sku || product.rawCode;
  if (!code) return null;
  return getStoreSearchUrl(product.supplierId, code);
};

export const isDirectProductPageUrl = (url: string): boolean =>
  /homedepot\.com\/p\//i.test(url) ||
  /lowes\.com\/pd\//i.test(url) ||
  /lowes\.com\/p\//i.test(url);

/** Strip to comparable UPC/GTIN digits (handles EAN-13 leading zero). */
export const normalizeUpcDigits = (value: string): string => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
};

export const upcDigitsMatch = (a: string, b: string): boolean => {
  const left = normalizeUpcDigits(a);
  const right = normalizeUpcDigits(b);
  return Boolean(left && right && left === right);
};

export const buildHomeDepotProductUrl = (
  productLabel?: string | null,
  itemId?: string | null,
): string | null => {
  const slug = String(productLabel || '').trim();
  const id = String(itemId || '').trim();
  if (slug && id) return `https://www.homedepot.com/p/${slug}/${id}`;
  if (id) return `https://www.homedepot.com/p/${id}`;
  if (slug) return `https://www.homedepot.com/p/${slug}`;
  return null;
};

/** Normalize raw scanner output (spaces, EAN-13 leading zero, etc.) for lookup. */
export const normalizeScannedBarcode = (raw: string): string => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    // iOS often reports UPC-A as EAN-13 with a leading 0.
    if (digits.length === 13 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits;
  }

  return trimmed;
};

export const isBarcodePlaceholderTitle = (title?: string | null, rawCode?: string | null): boolean => {
  const value = String(title || '').trim();
  if (!value) return true;
  if (/^\d{8,14}$/.test(value)) return true;
  if (rawCode && value === String(rawCode).trim()) return true;
  return false;
};

export const hasResolvedProductDetails = (product?: ScannedProduct | null): boolean => {
  if (!product) return false;
  const price = getProductUnitPrice(product);
  const realTitle = !isBarcodePlaceholderTitle(product.title, product.rawCode);
  return price > 0 && realTitle;
};

export const isBarcodeScanCode = (code?: string | null): boolean =>
  /^\d{8,14}$/.test(String(code || '').trim());

/** True when a retailer catalog hit is tied to the scanned barcode. */
export const catalogProductMatchesBarcode = (
  product: ScannedProduct | null | undefined,
  rawCode: string,
): boolean => {
  if (!product) return false;
  if (!isBarcodeScanCode(rawCode)) return true;

  if (product.supplierId === 'lowes') {
    if (product.dataSource === 'serpapi_lowes' || product.dataSource === 'webscraping') {
      return Boolean(product.barcodeVerified);
    }
    if (
      product.sourceUrl &&
      isDirectProductPageUrl(product.sourceUrl) &&
      !isBarcodePlaceholderTitle(product.title, rawCode)
    ) {
      return Boolean(product.upc && upcDigitsMatch(rawCode, product.upc));
    }
    return false;
  }

  if (product.supplierId === 'hd') {
    if (
      product.dataSource === 'homedepot_direct' ||
      product.dataSource === 'homedepot_api' ||
      product.dataSource === 'serpapi_hd_barcode'
    ) {
      return Boolean(product.upc && upcDigitsMatch(rawCode, product.upc));
    }
    if (
      product.sourceUrl &&
      isDirectProductPageUrl(product.sourceUrl) &&
      product.upc &&
      upcDigitsMatch(rawCode, product.upc)
    ) {
      return true;
    }
    return false;
  }

  return true;
};

export const needsProductDetailRefresh = (product?: ScannedProduct | null): boolean => {
  if (!product) return false;
  if (hasResolvedProductDetails(product)) return false;

  const hasTitle = !isBarcodePlaceholderTitle(product.title, product.rawCode);
  const hasPrice = getProductUnitPrice(product) > 0;
  const hasRetailerPage =
    Boolean(product.sourceUrl) &&
    (product.supplierId === 'hd' || product.supplierId === 'lowes') &&
    isDirectProductPageUrl(product.sourceUrl || '');

  if (hasTitle && hasPrice) return false;
  if (hasTitle && hasRetailerPage) return false;
  return true;
};

export const buildProductNotes = (product: ScannedProduct, extraNotes = ''): string => {
  const details = [
    product.sku ? `SKU: ${product.sku}` : '',
    product.model ? `Model: ${product.model}` : '',
    product.upc ? `UPC: ${product.upc}` : '',
    product.sourceUrl ? `Source: ${product.sourceUrl}` : '',
    extraNotes,
  ].filter(Boolean);
  return details.join('\n');
};
