const express = require('express');
const axios = require('axios');
const { searchHomeDepotProduct } = require('../services/homeDepotProductSearch');

const router = express.Router();

const STORE_CONFIG = {
  hd: {
    label: 'Home Depot',
    domain: 'homedepot.com',
    searchUrl: (query) => `https://www.homedepot.com/s/${encodeURIComponent(query).replace(/%20/g, '+')}`,
    productUrl: (slug) => `https://www.homedepot.com/p/${slug}`,
  },
  lowes: {
    label: "Lowe's",
    domain: 'lowes.com',
    searchUrl: (query) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(query)}`,
  },
};

const parseMoney = (value) => {
  if (value == null) return null;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const inferStore = (value, sourceHint) => {
  const text = `${sourceHint || ''} ${value || ''}`.toLowerCase();
  if (text.includes('homedepot.com') || text.includes('home depot') || text.includes('homedepot')) {
    return 'hd';
  }
  if (text.includes('lowes.com') || text.includes("lowe's") || text.includes('lowes')) {
    return 'lowes';
  }
  return sourceHint === 'lowes' || sourceHint === 'hd' ? sourceHint : null;
};

const extractQueryFromCode = (code) => {
  const raw = String(code || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const searchTerm = url.searchParams.get('searchTerm') || url.searchParams.get('q');
    if (searchTerm) return searchTerm;
    const parts = url.pathname.split('/').filter(Boolean);
    const productLike = [...parts].reverse().find((part) => /[A-Za-z]/.test(part) && !/^\d+$/.test(part));
    if (productLike) return decodeURIComponent(productLike).replace(/[-_]+/g, ' ');
    const itemId = parts.find((part) => /^\d{6,}$/.test(part));
    if (itemId) return itemId;
  } catch (_) {
    // Not a URL; use the raw barcode/SKU/model text.
  }
  return raw;
};

const parseStoreProductUrl = (rawCode, store) => {
  try {
    const url = new URL(rawCode);
    const cfg = STORE_CONFIG[store];
    if (!cfg || !url.hostname.includes(cfg.domain)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const pIndex = parts.indexOf('p');
    const slug = pIndex >= 0 ? parts[pIndex + 1] : parts[parts.length - 1];
    if (!slug) return null;
    return {
      title: decodeURIComponent(slug).replace(/[-_]+/g, ' '),
      imageUrl: null,
      supplier: cfg.label,
      supplierId: store,
      unitPrice: null,
      sku: /^\d+$/.test(slug) ? slug : null,
      model: null,
      upc: null,
      sourceUrl: url.href,
      lookupStatus: 'found',
      dataSource: 'product_url',
    };
  } catch (_) {
    return null;
  }
};

const normalizeSerpResult = (item, store, query, rawCode) => {
  const cfg = STORE_CONFIG[store];
  const directUrl = item.link && item.link.includes(cfg.domain) ? item.link : null;
  const productPageUrl =
    directUrl && (directUrl.includes('/p/') || directUrl.includes('/pd/')) ? directUrl : null;
  const cleanTitle = (item.title || query || rawCode)
    .replace(/[^\w\s./#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const storeSearchUrl = cfg.searchUrl(cleanTitle || query || rawCode);
  const unitPrice = parseMoney(item.price);

  return {
    title: item.title || query || rawCode,
    imageUrl: item.thumbnail || item.image || null,
    supplier: cfg.label,
    supplierId: store,
    unitPrice,
    sku: item.product_id || null,
    model: item.product_id || null,
    upc: /^\d{8,14}$/.test(String(rawCode || '').trim()) ? String(rawCode).trim() : null,
    sourceUrl: productPageUrl || directUrl || storeSearchUrl,
    rawCode,
    lookupStatus: unitPrice ? 'found' : 'manual_required',
    dataSource: 'serpapi',
  };
};

const searchExistingSkuEndpoint = async ({ query, store, zip, rawCode }) => {
  if (store !== 'hd' && store !== 'lowes') return null;
  const lookupZip = zip || '89109';
  const port = process.env.PORT || 3001;
  try {
    const response = await axios.get(`http://127.0.0.1:${port}/api/sku/search`, {
      params: {
        store,
        zip: lookupZip,
        q: query || rawCode,
      },
      timeout: 6000,
    });
    if (response.data?.metadata?.isMockData) return null;
    const item = response.data?.results?.[0];
    if (!item?.title || !item?.price) return null;
    const cfg = STORE_CONFIG[store];
    return {
      title: item.title,
      imageUrl: item.image || null,
      supplier: cfg.label,
      supplierId: store,
      unitPrice: parseMoney(item.price),
      sku: item.sku || null,
      model: item.model || item.sku || null,
      upc: /^\d{8,14}$/.test(String(rawCode || '').trim()) ? String(rawCode).trim() : null,
      sourceUrl: item.url || cfg.searchUrl(item.title),
      rawCode,
      lookupStatus: 'found',
      dataSource: 'sku_search',
    };
  } catch (error) {
    console.warn('Ranked SKU lookup failed:', error.message);
    return null;
  }
};

const searchPermittedShoppingSource = async ({ query, store, zip, rawCode }) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_SERPAPI_KEY_HERE') return null;

  const cfg = STORE_CONFIG[store];
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      engine: 'google_shopping',
      q: `${query} ${cfg.label}`,
      location: zip ? `${zip}, United States` : undefined,
      num: 40,
      api_key: apiKey,
    },
    timeout: 7000,
  });

  const results = response.data?.shopping_results || [];
  const filteredResults = results.filter((item) => {
    const link = String(item.link || '').toLowerCase();
    const source = String(item.source || '').toLowerCase();
    const competitor =
      store === 'hd'
        ? link.includes('lowes.com') || source.includes("lowe's") || source.includes('lowes')
        : link.includes('homedepot.com') || source.includes('home depot');
    return !competitor;
  });

  const candidates = filteredResults.length ? filteredResults : results;
  const isRawBarcode = /^\d{8,14}$/.test(String(rawCode || '').trim());
  const selected =
    isRawBarcode
      ? candidates.find((item) => {
          const title = String(item.title || '').toLowerCase();
          return (
            title &&
            !title.startsWith('the home depot ') &&
            !title.includes('home depot gift card') &&
            parseMoney(item.price)
          );
        }) || candidates[0]
      : candidates[0];
  return selected ? normalizeSerpResult(selected, store, query, rawCode) : null;
};

const buildManualFallback = ({ query, rawCode, store, codeType }) => {
  const cfg = STORE_CONFIG[store];
  const isUpc = /^\d{8,14}$/.test(rawCode);
  return {
    title: query || rawCode,
    imageUrl: null,
    supplier: cfg.label,
    supplierId: store,
    unitPrice: null,
    sku: null,
    model: null,
    upc: isUpc ? rawCode : null,
    sourceUrl: rawCode.startsWith('http') ? rawCode : cfg.searchUrl(query || rawCode),
    rawCode,
    codeType,
    lookupStatus: 'manual_required',
    dataSource: 'manual',
  };
};

router.post('/lookup', async (req, res) => {
  const { code = '', codeType = 'unknown', sourceHint = '', zip = '' } = req.body || {};
  const rawCode = String(code || '').trim();
  if (!rawCode) {
    return res.status(400).json({ error: 'code is required' });
  }

  const query = extractQueryFromCode(rawCode);
  const inferredStore = inferStore(rawCode, sourceHint) || 'hd';
  const stores = inferredStore ? [inferredStore] : ['hd', 'lowes'];

  try {
    const urlProduct = parseStoreProductUrl(rawCode, inferredStore);
    if (urlProduct) {
      return res.json({
        product: { ...urlProduct, rawCode, codeType },
        metadata: { dataSource: urlProduct.dataSource, requiresManualConfirmation: true },
      });
    }

    if (inferredStore === 'hd' || stores.includes('hd')) {
      const hdProduct = await searchHomeDepotProduct(query, zip);
      if (hdProduct) {
        return res.json({
          product: { ...hdProduct, rawCode, codeType },
          metadata: {
            dataSource: hdProduct.dataSource,
            requiresManualConfirmation: hdProduct.unitPrice == null,
          },
        });
      }
    }

    for (const store of stores) {
      const rankedProduct = await searchExistingSkuEndpoint({ query, store, zip, rawCode });
      if (rankedProduct) {
        return res.json({
          product: { ...rankedProduct, codeType },
          metadata: {
            dataSource: rankedProduct.dataSource,
            requiresManualConfirmation: rankedProduct.unitPrice == null,
          },
        });
      }
    }

    for (const store of stores) {
      try {
        const product = await searchPermittedShoppingSource({ query, store, zip, rawCode });
        if (product) {
          return res.json({
            product: { ...product, codeType },
            metadata: {
              dataSource: product.dataSource,
              requiresManualConfirmation: product.unitPrice == null,
            },
          });
        }
      } catch (error) {
        console.warn(`Product lookup source failed for ${store}:`, error.message);
      }
    }

    const fallbackStore = stores[0] || 'hd';
    const fallback = buildManualFallback({ query, rawCode, store: fallbackStore, codeType });
    return res.json({
      product: fallback,
      metadata: {
        dataSource: 'manual',
        requiresManualConfirmation: true,
        message: 'Open the store page to confirm product and price.',
      },
    });
  } catch (error) {
    console.error('Product lookup error:', error.message);
    return res.status(502).json({
      error: 'Product lookup failed',
      message: error.message,
    });
  }
});

module.exports = router;
