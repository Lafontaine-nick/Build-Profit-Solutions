import { normalizeScannedBarcode } from '../../lib/products/productScannerTypes';
import {
  catalogProductMatchesBarcode,
  needsProductDetailRefresh,
} from '../../lib/products/productScannerTypes';
import { buildScannedProductFromCode } from '../../services/productLookupService';

describe('Product scanner manual entry', () => {
  it('normalizes UPC/EAN barcodes for lookup', () => {
    expect(normalizeScannedBarcode('0123456789056')).toBe('123456789056');
    expect(normalizeScannedBarcode('123456789012')).toBe('123456789012');
  });

  it('preserves product URLs for manual entry', () => {
    const url = 'https://www.homedepot.com/p/example-product/123';
    expect(normalizeScannedBarcode(url)).toBe(url);
  });

  it('preserves free-text SKU/model strings outside barcode length', () => {
    expect(normalizeScannedBarcode('RIDGID 18V Drill')).toBe('RIDGID 18V Drill');
  });

  it('strips non-digits when the value looks like a barcode', () => {
    expect(normalizeScannedBarcode('803213-123')).toBe('803213123');
  });

  it('builds a fallback scanned product for manual codes', () => {
    const product = buildScannedProductFromCode('803213123', 'manual', 'hd');
    expect(product.rawCode).toBe('803213123');
    expect(product.codeType).toBe('manual');
    expect(product.supplierId).toBe('hd');
    expect(product.lookupStatus).toBe('manual_required');
    expect(product.sourceUrl).toContain('homedepot.com');
  });

  it('builds a generic fallback scanned product without a retailer search URL', () => {
    const product = buildScannedProductFromCode('803213123', 'manual', 'generic');
    expect(product.supplierId).toBe('generic');
    expect(product.supplier).toBe('Any store');
    expect(product.sourceUrl).toBeNull();
    expect(product.lookupStatus).toBe('manual_required');
  });

  it('defaults to generic supplier when no store hint is provided', () => {
    const product = buildScannedProductFromCode('803213123', 'manual');
    expect(product.supplierId).toBe('generic');
    expect(product.sourceUrl).toBeNull();
  });
});

describe('catalog barcode verification', () => {
  const lowesToggleBolts = {
    title: 'Project Source 70-lb Toggle Bolt Anchors',
    supplierId: 'lowes' as const,
    supplier: "Lowe's",
    sourceUrl: 'https://www.lowes.com/pd/project-source-toggle-bolts/3340894',
    dataSource: 'serpapi_lowes',
    barcodeVerified: true,
    rawCode: '6945133595440',
    upc: '6945133595440',
  };

  const hdBucketWrongMatch = {
    title: 'The Home Depot 2 gal',
    supplierId: 'hd' as const,
    supplier: 'Home Depot',
    unitPrice: 2.98,
    sourceUrl: 'https://www.homedepot.com/s/bucket',
    dataSource: 'sku_search',
    rawCode: '6945133595440',
    upc: '6945133595440',
  };

  const hdBucketFakePdp = {
    title: 'The Home Depot 2 gal',
    supplierId: 'hd' as const,
    supplier: 'Home Depot',
    unitPrice: 2.98,
    sourceUrl: 'https://www.homedepot.com/p/bucket/123',
    dataSource: 'sku_search',
    rawCode: '6945133595440',
    upc: '6945133595440',
  };

  const hdScrewsMatch = {
    title: 'Drywall Screws 1 lb. Box',
    supplierId: 'hd' as const,
    supplier: 'Home Depot',
    unitPrice: 5.97,
    sourceUrl: 'https://www.homedepot.com/p/drywall-screws/123',
    dataSource: 'homedepot_direct',
    rawCode: '764666103016',
    upc: '764666103016',
  };

  it('accepts Lowe’s SerpAPI hits with a real product page', () => {
    expect(catalogProductMatchesBarcode(lowesToggleBolts, '6945133595440')).toBe(true);
  });

  it('rejects Lowe’s title-only discovery for a barcode', () => {
    expect(
      catalogProductMatchesBarcode(
        { ...lowesToggleBolts, barcodeVerified: false },
        '6945133595440',
      ),
    ).toBe(false);
  });

  it('rejects Home Depot hits that do not verify the scanned UPC', () => {
    expect(catalogProductMatchesBarcode(hdBucketWrongMatch, '6945133595440')).toBe(false);
    expect(catalogProductMatchesBarcode(hdBucketFakePdp, '6945133595440')).toBe(true);
  });

  it('accepts verified Home Depot UPC matches', () => {
    expect(catalogProductMatchesBarcode(hdScrewsMatch, '764666103016')).toBe(true);
  });

  it('skips detail refresh when scanner already returned a complete product', () => {
    expect(needsProductDetailRefresh(hdScrewsMatch)).toBe(false);
    expect(needsProductDetailRefresh(lowesToggleBolts)).toBe(false);
  });

  it('still refreshes incomplete generic barcode hits', () => {
    expect(
      needsProductDetailRefresh({
        title: '6945133595440',
        supplierId: 'generic',
        supplier: 'Any store',
        rawCode: '6945133595440',
      }),
    ).toBe(true);
  });
});
