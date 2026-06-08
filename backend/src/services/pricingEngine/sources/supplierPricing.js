const { searchSkuLive } = require('../../sku/skuSearchService');
const { scopeToSkuQuery, pickBestSkuResult } = require('./skuQueryFromScope');

const LIVE_DATA_SOURCES = new Set(['serpapi', 'webscraping', 'direct', 'homedepot_api']);

/**
 * Supplier / SKU pricing — material only from live catalog APIs.
 * Returns available: false when data is mock or empty.
 */
async function lookupSupplierPricing(scopeItem, context = {}) {
  const zipCode = String(context.zipCode || '').trim();
  const zipIsFallback = context.supplierZipIsFallback === true;
  if (!zipCode || zipCode.length < 5) {
    return {
      available: false,
      rates: [],
      message: 'ZIP code required for supplier pricing lookup',
    };
  }

  const querySpec = scopeToSkuQuery(scopeItem);
  if (!querySpec) {
    return {
      available: false,
      rates: [],
      message: 'No supplier catalog mapping for this scope item',
    };
  }

  const store = context.supplierStore || 'hd';

  try {
    const { results, metadata } = await searchSkuLive({
      store,
      zip: zipCode,
      q: querySpec.query,
      timeoutMs: 12000,
    });

    const dataSource = metadata?.dataSource || 'mock';
    if (!LIVE_DATA_SOURCES.has(dataSource) || metadata?.isMockData) {
      return {
        available: false,
        rates: [],
        dataSource,
        message: 'Supplier pricing skipped — live catalog data unavailable',
      };
    }

    const picked = pickBestSkuResult(results, querySpec);
    if (!picked) {
      return {
        available: false,
        rates: [],
        dataSource,
        message: 'No priced SKU matched this scope item',
      };
    }

    const qty =
      scopeItem.quantity != null && scopeItem.quantity > 0 ? Number(scopeItem.quantity) : null;
    const unit = querySpec.pricingUnit;

    const assumptions = [
      `Live ${store === 'lowes' ? "Lowe's" : 'Home Depot'} material price via ${dataSource}`,
      zipIsFallback
        ? `Store pricing near ZIP ${zipCode} (default — add ZIP to notes for your job site)`
        : `Store pricing for ZIP ${zipCode}`,
      `SKU: ${picked.item.title}${picked.item.sku ? ` (${picked.item.sku})` : ''}`,
      querySpec.highVarianceMaterial
        ? 'Reference only — many product tiers/prices exist; national average or saved pricing used for the bid'
        : 'Pack/box price converted to per-unit material rate — verify quantity and waste factor',
      'Labor is not from supplier — uses saved pricing or national average',
    ];

    return {
      available: true,
      highVarianceMaterial: Boolean(querySpec.highVarianceMaterial),
      rates: [
        {
          pricingType: 'material',
          label: querySpec.highVarianceMaterial
            ? `${querySpec.materialLabel || `${scopeItem.scopeName} material`} (HD reference)`
            : querySpec.materialLabel || `${scopeItem.scopeName} material`,
          rate: Math.round(picked.unitRate * 100) / 100,
          unit,
          quantity: qty,
          confidence: querySpec.highVarianceMaterial ? 'low' : 'medium',
          referenceOnly: Boolean(querySpec.highVarianceMaterial),
          assumptions,
          sku: picked.item.sku,
          productTitle: picked.item.title,
          productUrl: picked.item.url,
          dataSource,
        },
      ],
      dataSource,
      store,
      zipCode,
    };
  } catch (err) {
    console.warn('Supplier pricing lookup failed:', err.message);
    return {
      available: false,
      rates: [],
      message: `Supplier lookup failed: ${err.message}`,
    };
  }
}

module.exports = { lookupSupplierPricing, LIVE_DATA_SOURCES };
