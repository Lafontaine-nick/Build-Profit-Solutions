export type ProductSupplierId = 'hd' | 'lowes' | 'unknown';

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
};

export const supplierNameFromId = (supplierId?: ProductSupplierId | string | null): string => {
  if (supplierId === 'hd') return 'Home Depot';
  if (supplierId === 'lowes') return "Lowe's";
  return 'Unknown supplier';
};

export const supplierStoreFromProduct = (product: ScannedProduct): 'hd' | 'lowes' => {
  return product.supplierId === 'lowes' ? 'lowes' : 'hd';
};

export const getProductUnitPrice = (product: ScannedProduct): number => {
  const price = Number(product.unitPrice || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
};

export const getStoreSearchUrl = (supplierId: ProductSupplierId | string | null | undefined, query: string): string => {
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
  /homedepot\.com\/p\//i.test(url) || /lowes\.com\/pd\//i.test(url) || /lowes\.com\/p\//i.test(url);

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
