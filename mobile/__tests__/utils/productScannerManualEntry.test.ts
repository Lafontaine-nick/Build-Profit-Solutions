import { normalizeScannedBarcode } from '../../lib/products/productScannerTypes';
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
});
