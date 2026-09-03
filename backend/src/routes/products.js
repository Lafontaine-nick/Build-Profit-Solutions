const express = require('express');
const axios = require('axios');
const { searchHomeDepotProduct } = require('../services/homeDepotProductSearch');
const { searchLowesProduct } = require('../services/lowesProductSearch');

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
  if (sourceHint === 'generic' || sourceHint === 'auto') return 'generic';
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
  const isRawBarcode = /^\d{8,14}$/.test(String(rawCode || '').trim());
  const blob = JSON.stringify(item || {}).toLowerCase();
  const upcVerified = isRawBarcode && blob.includes(String(rawCode).trim());

  return {
    title: item.title || query || rawCode,
    imageUrl: item.thumbnail || item.image || null,
    supplier: cfg.label,
    supplierId: store,
    unitPrice,
    sku: item.product_id || null,
    model: item.product_id || null,
    upc: upcVerified ? String(rawCode).trim() : null,
    sourceUrl: productPageUrl || directUrl || storeSearchUrl,
    rawCode,
    lookupStatus: unitPrice ? 'found' : 'manual_required',
    dataSource: 'serpapi',
  };
};

const searchExistingSkuEndpoint = async ({ query, store, zip, rawCode }) => {
  if (store !== 'hd' && store !== 'lowes') return null;
  const isBarcode = /^\d{8,14}$/.test(String(rawCode || '').trim());
  // Google Shopping SKU search by raw UPC/SKU is unreliable — skip for barcode scans.
  if (isBarcode) return null;

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
      upc:
        /^\d{8,14}$/.test(String(rawCode || '').trim()) &&
        JSON.stringify(item || {}).toLowerCase().includes(String(rawCode).trim())
          ? String(rawCode).trim()
          : null,
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
          const blob = JSON.stringify(item || {}).toLowerCase();
          const raw = String(rawCode || '').trim();
          if (blob.includes(raw)) return parseMoney(item.price);
          return null;
        }) || null
      : candidates[0];
  return selected ? normalizeSerpResult(selected, store, query, rawCode) : null;
};

const searchHomeDepotBarcode = async (rawCode, zip = '') => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_SERPAPI_KEY_HERE') return null;

  try {
    const identityResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: `${rawCode} site:homedepot.com`,
        location: zip ? `${zip}, United States` : undefined,
        num: 10,
        api_key: apiKey,
      },
      timeout: 10000,
    });
    const identity = (identityResponse.data?.organic_results || []).find((item) =>
      /homedepot\.com\/p\//i.test(String(item?.link || '')),
    );
    if (!identity?.title || !identity?.link) return null;

    const title = String(identity.title).replace(/\s+\|\s+The Home Depot.*$/i, '').trim();
    const shoppingResponse = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_shopping',
        q: `"${title}" Home Depot`,
        location: zip ? `${zip}, United States` : undefined,
        num: 20,
        api_key: apiKey,
      },
      timeout: 10000,
    });
    const selected = (shoppingResponse.data?.shopping_results || []).find((item) => {
      const source = String(item.source || '').toLowerCase();
      return source.includes('home depot') && parseMoney(item.price);
    });
    const product = selected
      ? normalizeSerpResult(selected, 'hd', title, rawCode)
      : {
          title,
          imageUrl: null,
          supplier: 'Home Depot',
          supplierId: 'hd',
          unitPrice: null,
          sku: null,
          model: null,
          upc: rawCode,
          sourceUrl: identity.link,
          rawCode,
          lookupStatus: 'manual_required',
          dataSource: 'serpapi_hd_barcode',
        };
    return {
      ...product,
      title,
      upc: rawCode,
      sourceUrl: identity.link,
      dataSource: 'serpapi_hd_barcode',
    };
  } catch (error) {
    console.warn('Home Depot barcode lookup failed:', error.message);
    return null;
  }
};

const searchGenericBarcode = async (rawCode) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_SERPAPI_KEY_HERE') return null;

  try {
    const [organicResult, imageResult] = await Promise.allSettled([
      axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google',
          q: `"${rawCode}"`,
          num: 10,
          api_key: apiKey,
        },
        timeout: 10000,
      }),
      axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_images',
          q: `"${rawCode}"`,
          num: 8,
          api_key: apiKey,
        },
        timeout: 10000,
      }),
    ]);
    const organicResponse =
      organicResult.status === 'fulfilled' ? organicResult.value : { data: {} };
    const imageResponse =
      imageResult.status === 'fulfilled' ? imageResult.value : { data: {} };
    const organic = organicResponse.data?.organic_results || [];
    const exactOrganicCandidates = organic.filter((item) => {
      const blob = JSON.stringify(item || {}).toLowerCase();
      return blob.includes(String(rawCode).toLowerCase()) && item?.title && item?.link;
    });
    if (!exactOrganicCandidates.length) return null;

    const titleTokens = (value) =>
      new Set(
        String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((token) => token.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(token)),
      );
    const titleOverlap = (left, right) => {
      const a = titleTokens(left);
      const b = titleTokens(right);
      let overlap = 0;
      for (const token of a) {
        if (b.has(token)) overlap += 1;
      }
      return overlap;
    };
    const titleSimilarity = (left, right) => {
      const leftTokens = titleTokens(left);
      const rightTokens = titleTokens(right);
      if (!leftTokens.size || !rightTokens.size) return 0;
      return (
        titleOverlap(left, right) /
        Math.min(leftTokens.size, rightTokens.size)
      );
    };
    const candidateSupport = (candidate) =>
      exactOrganicCandidates.reduce(
        (support, other) =>
          support + (titleOverlap(candidate.title, other.title) >= 2 ? 1 : 0),
        0,
      );
    const rankedOrganicCandidates = [...exactOrganicCandidates].sort(
      (left, right) => candidateSupport(right) - candidateSupport(left),
    );
    const leadingTitle = rankedOrganicCandidates[0]?.title;
    const hasTrustedDivergentIdentity = rankedOrganicCandidates
      .slice(1)
      .some(
        (candidate) =>
          titleSimilarity(leadingTitle, candidate.title) < 0.35 &&
          /(amazon|walmart|target|homedepot|lowes|walgreens|cvs)\./i.test(
            String(candidate.link || ''),
          ),
      );
    // Conflicting exact-UPC identities are not safe to turn into a product.
    if (
      exactOrganicCandidates.length > 1 &&
      hasTrustedDivergentIdentity
    ) {
      return null;
    }
    const organicCandidate =
      rankedOrganicCandidates[0] ||
      organic.find((item) => {
        const blob = JSON.stringify(item || {}).toLowerCase();
        const text = `${item?.title || ''} ${item?.snippet || ''}`;
        return (
          blob.includes(String(rawCode).toLowerCase()) &&
          item?.title &&
          item?.link &&
          /\$\s?\d+(?:\.\d{1,2})?/.test(text)
        );
      }) ||
      null;
    if (!organicCandidate) return null;

    let shoppingResults = [];
    const broadProductTitle = String(organicCandidate.title || '')
      .replace(/\b\d+(?:\.\d+)?\s*(?:o?z|0z|ounce|ounces|lb|lbs|count|ct)\b/gi, '')
      .replace(/[(),/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const compactProductTitle = broadProductTitle
      .replace(/\b(brand|kettle|style|potato)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const shoppingQueries = [
      `${rawCode} ${organicCandidate.title}`,
      `${organicCandidate.title} Walmart`,
      `${broadProductTitle} Walmart`,
      `${compactProductTitle} Walmart`,
    ];
    for (const shoppingQuery of shoppingQueries) {
      try {
        const shoppingResponse = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google_shopping',
            q: shoppingQuery,
            num: 20,
            api_key: apiKey,
          },
          timeout: 8000,
        });
        shoppingResults = [
          ...shoppingResults,
          ...(shoppingResponse.data?.shopping_results || []),
        ];
      } catch (error) {
        console.warn('Generic shopping lookup failed:', error.message);
      }
    }
    const trustedRetailers = [
      { key: 'walmart', label: 'Walmart', domains: ['walmart.com'] },
      { key: 'target', label: 'Target', domains: ['target.com'] },
      { key: 'amazon', label: 'Amazon', domains: ['amazon.com'] },
      { key: 'walgreens', label: 'Walgreens', domains: ['walgreens.com'] },
      { key: 'cvs', label: 'CVS', domains: ['cvs.com'] },
      { key: 'homedepot', label: 'Home Depot', domains: ['homedepot.com'] },
      { key: 'lowes', label: "Lowe's", domains: ['lowes.com'] },
      { key: 'acehardware', label: 'Ace Hardware', domains: ['acehardware.com'] },
      { key: 'truevalue', label: 'True Value', domains: ['truevalue.com'] },
      { key: 'menards', label: 'Menards', domains: ['menards.com'] },
      { key: 'bestbuy', label: 'Best Buy', domains: ['bestbuy.com'] },
      { key: 'costco', label: 'Costco', domains: ['costco.com'] },
      { key: 'samsclub', label: "Sam's Club", domains: ['samsclub.com'] },
      { key: 'grainger', label: 'Grainger', domains: ['grainger.com'] },
      { key: 'zoro', label: 'Zoro', domains: ['zoro.com'] },
    ];
    const trustedRetailerFor = (value) => {
      const text = String(value || '').toLowerCase();
      return trustedRetailers.find((retailer) =>
        retailer.domains.some((domain) => text.includes(domain)) ||
        text.includes(retailer.key),
      );
    };
    const eligibleShopping = shoppingResults.filter(
      (item) => trustedRetailerFor(item.source) && parseMoney(item.price),
    );
    const nonBulkShopping = eligibleShopping.filter(
      (item) => !/\b(case|carton|pack of|50\s*-\s*min|12\s*pack|quantity)\b/i.test(String(item.title || '')),
    );
    let shoppingCandidate = (nonBulkShopping.length ? nonBulkShopping : eligibleShopping).sort(
      (a, b) => {
        const preferred = ['walmart', 'target', 'amazon', 'walgreens', 'cvs'];
        const rank = (item) => {
          const retailer = trustedRetailerFor(item.source);
          const index = retailer ? preferred.indexOf(retailer.key) : -1;
          return index < 0 ? preferred.length : index;
        };
        return rank(a) - rank(b);
      },
    )[0];
    if (!shoppingCandidate && broadProductTitle) {
      try {
        const retailerSearchResponse = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google',
            q: `${compactProductTitle || broadProductTitle} Walmart price`,
            num: 10,
            api_key: apiKey,
          },
          timeout: 8000,
        });
        const retailerResult = (retailerSearchResponse.data?.organic_results || [])
          .map((item) => {
            const text = `${item?.title || ''} ${item?.snippet || ''}`;
            const priceMatch = text.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
            return priceMatch ? { ...item, price: priceMatch[1] } : null;
          })
          .find(
            (item) =>
              item &&
              trustedRetailerFor(item.link) &&
              titleOverlap(organicCandidate.title, `${item.title} ${item.snippet}`) >= 2,
          );
        if (retailerResult) {
          shoppingCandidate = retailerResult;
        }
      } catch (error) {
        console.warn('Generic retailer fallback failed:', error.message);
      }
    }
    const candidate = shoppingCandidate || organicCandidate;
    if (!shoppingCandidate && !trustedRetailerFor(candidate.link)) {
      return null;
    }

    const priceText = `${candidate.title || ''} ${candidate.snippet || ''}`;
    const priceMatch = priceText.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
    const image =
      candidate.thumbnail ||
      candidate.image ||
      (imageResponse.data?.images_results || []).find((item) => item?.original)?.original ||
      null;
    const shoppingRetailer = trustedRetailerFor(candidate.source);
    const link = String(candidate.link || '').trim();
    const host = (() => {
      try {
        return new URL(link).hostname.replace(/^www\./i, '');
      } catch (_) {
        return '';
      }
    })();
    const merchant = shoppingRetailer?.label || trustedRetailerFor(host)?.label || 'Any store';
    const reliableLink =
      link && trustedRetailerFor(host)
        ? link
        : shoppingRetailer
          ? `https://www.${shoppingRetailer.key}.com/search?q=${encodeURIComponent(
              String(candidate.title || rawCode),
            )}`
          : null;

    return {
      title: String(candidate.title).trim(),
      imageUrl: image || null,
      supplier: merchant,
      supplierId: 'generic',
      unitPrice: parseMoney(candidate.price) || (priceMatch ? parseMoney(priceMatch[1]) : null),
      sku: null,
      model: rawCode,
      upc: rawCode,
      sourceUrl: reliableLink,
      rawCode,
      lookupStatus: parseMoney(candidate.price) || priceMatch ? 'found' : 'manual_required',
      dataSource: 'serpapi_generic',
    };
  } catch (error) {
    console.warn('Generic barcode lookup failed:', error.message);
    return null;
  }
};

const searchGenericKeyword = async (query) => {
  const apiKey = process.env.SERPAPI_KEY;
  const keyword = String(query || '').trim();
  if (!apiKey || apiKey === 'YOUR_SERPAPI_KEY_HERE' || !keyword) return null;

  const retailers = [
    { key: 'walmart', label: 'Walmart' },
    { key: 'target', label: 'Target' },
    { key: 'amazon', label: 'Amazon' },
    { key: 'walgreens', label: 'Walgreens' },
    { key: 'cvs', label: 'CVS' },
    { key: 'vitacost', label: 'Vitacost' },
    { key: 'iherb', label: 'iHerb' },
    { key: 'allstarhealth', label: 'AllStarHealth' },
  ];
  const retailerFor = (value) => {
    const text = String(value || '').toLowerCase();
    return retailers.find((retailer) => text.includes(retailer.key));
  };
  const brandToken = keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find(
      (token) =>
        token.length >= 4 &&
        !['with', 'from', 'pack', 'size', 'for', 'the'].includes(token),
    );

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_shopping',
        q: keyword,
        num: 20,
        api_key: apiKey,
      },
      timeout: 8000,
    });
    const candidates = (response.data?.shopping_results || [])
      .filter(
        (item) =>
          retailerFor(item.source) &&
          parseMoney(item.price) &&
          (!brandToken ||
            String(item.title || '')
              .toLowerCase()
              .includes(brandToken)),
      )
      .sort((left, right) => {
        const preferred = [
          'walmart',
          'target',
          'amazon',
          'walgreens',
          'cvs',
          'vitacost',
          'iherb',
          'allstarhealth',
        ];
        return preferred.indexOf(retailerFor(left.source).key) -
          preferred.indexOf(retailerFor(right.source).key);
      });
    const selected = candidates[0];
    if (!selected) return null;

    const retailer = retailerFor(selected.source);
    return {
      title: String(selected.title || keyword).trim(),
      imageUrl: selected.thumbnail || selected.image || null,
      supplier: retailer.label,
      supplierId: 'generic',
      unitPrice: parseMoney(selected.price),
      sku: null,
      model: null,
      upc: null,
      sourceUrl: `https://www.${retailer.key}.com/search?q=${encodeURIComponent(
        String(selected.title || keyword),
      )}`,
      rawCode: keyword,
      lookupStatus: 'found',
      dataSource: 'serpapi_generic_keyword',
    };
  } catch (error) {
    console.warn('Generic keyword lookup failed:', error.message);
    return null;
  }
};

const linkIncludesStore = (item, store) => {
  const link = String(item.link || '').toLowerCase();
  const source = String(item.source || '').toLowerCase();
  if (store === 'lowes') {
    return link.includes('lowes.com') || source.includes('lowe');
  }
  return link.includes('homedepot.com') || source.includes('home depot');
};

const buildManualFallback = ({ query, rawCode, store, codeType }) => {
  const isUpc = /^\d{8,14}$/.test(rawCode);
  if (store === 'generic') {
    return {
      title: query || rawCode,
      imageUrl: null,
      supplier: 'Any store',
      supplierId: 'generic',
      unitPrice: null,
      sku: null,
      model: null,
      upc: isUpc ? rawCode : null,
      sourceUrl: null,
      rawCode,
      codeType,
      lookupStatus: 'manual_required',
      dataSource: 'manual',
    };
  }
  const cfg = STORE_CONFIG[store];
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

const normalizeBarcodeCode = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    if (digits.length === 13 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits;
  }
  return trimmed;
};

const lookupUpcItemDbProduct = async (rawCode) => {
  const normalized = normalizeBarcodeCode(rawCode);
  if (!/^\d{8,14}$/.test(normalized)) return null;

  try {
    const response = await axios.get(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(normalized)}`,
      { timeout: 8000, headers: { Accept: 'application/json' } },
    );
    const item = response.data?.items?.[0];
    if (!item?.title) return null;

    const offers = Array.isArray(item.offers) ? item.offers : [];
    const pricedOffer = offers.find((offer) => parseMoney(offer?.price));
    const merchant = String(pricedOffer?.merchant || '').trim();
    const unitPrice = parseMoney(pricedOffer?.price);
    const offerUrl = String(pricedOffer?.link || pricedOffer?.url || '').trim();

    return {
      title: String(pricedOffer?.title || item.title).trim(),
      imageUrl: Array.isArray(item.images) ? item.images.find(Boolean) || null : null,
      supplier: merchant || 'Any store',
      supplierId: 'generic',
      unitPrice,
      sku: null,
      model: item.model || null,
      upc: item.upc || normalized,
      sourceUrl: offerUrl || null,
      rawCode: normalized,
      lookupStatus: unitPrice ? 'found' : 'manual_required',
      dataSource: 'upcitemdb',
    };
  } catch (error) {
    console.warn('UPCItemDB lookup failed:', error.message);
    return null;
  }
};

router.post('/lookup', async (req, res) => {
  const { code = '', codeType = 'unknown', sourceHint = '', zip = '' } = req.body || {};
  const rawCode = normalizeBarcodeCode(code);
  if (!rawCode) {
    return res.status(400).json({ error: 'code is required' });
  }

  const query = extractQueryFromCode(rawCode);
  const inferredStore = inferStore(rawCode, sourceHint) || 'hd';
  const stores = inferredStore ? [inferredStore] : ['hd', 'lowes'];
  const isBarcode = /^\d{8,14}$/.test(String(rawCode || '').trim());

  try {
    const urlProduct = parseStoreProductUrl(rawCode, inferredStore);
    if (urlProduct) {
      return res.json({
        product: { ...urlProduct, rawCode, codeType },
        metadata: { dataSource: urlProduct.dataSource, requiresManualConfirmation: true },
      });
    }

    if (inferredStore === 'generic') {
      if (isBarcode) {
        const upcProduct = await lookupUpcItemDbProduct(rawCode);
        if (upcProduct) {
          return res.json({
            product: { ...upcProduct, codeType },
            metadata: {
              dataSource: upcProduct.dataSource,
              requiresManualConfirmation: upcProduct.unitPrice == null,
              message: 'Confirm the store, price, and product details before adding.',
            },
          });
        }
        const homeDepotBarcodeProduct = await searchHomeDepotBarcode(rawCode, zip);
        if (homeDepotBarcodeProduct) {
          return res.json({
            product: { ...homeDepotBarcodeProduct, codeType },
            metadata: {
              dataSource: homeDepotBarcodeProduct.dataSource,
              requiresManualConfirmation: homeDepotBarcodeProduct.unitPrice == null,
            },
          });
        }
        const genericBarcodeProduct = await searchGenericBarcode(rawCode);
        if (genericBarcodeProduct) {
          return res.json({
            product: { ...genericBarcodeProduct, codeType },
            metadata: {
              dataSource: genericBarcodeProduct.dataSource,
              requiresManualConfirmation: genericBarcodeProduct.unitPrice == null,
              message: 'Confirm the store, price, and product details before adding.',
            },
          });
        }
      }
      if (!isBarcode) {
        const genericKeywordProduct = await searchGenericKeyword(query);
        if (genericKeywordProduct) {
          return res.json({
            product: { ...genericKeywordProduct, codeType },
            metadata: {
              dataSource: genericKeywordProduct.dataSource,
              requiresManualConfirmation: false,
            },
          });
        }
      }
      const genericFallback = buildManualFallback({
        query,
        rawCode,
        store: 'generic',
        codeType,
      });
      return res.json({
        product: genericFallback,
        metadata: {
          dataSource: 'manual',
          requiresManualConfirmation: true,
          message: 'Confirm the store, price, and product details before adding.',
        },
      });
    }

    if (inferredStore === 'hd' || stores.includes('hd')) {
      const hdProduct =
        (isBarcode ? await searchHomeDepotBarcode(rawCode, zip) : null) ||
        await searchHomeDepotProduct(query, zip);
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

    if (inferredStore === 'lowes' || stores.includes('lowes')) {
      const lowesProduct = await searchLowesProduct(query, zip);
      if (lowesProduct) {
        return res.json({
          product: { ...lowesProduct, rawCode, codeType },
          metadata: {
            dataSource: lowesProduct.dataSource,
            requiresManualConfirmation: lowesProduct.unitPrice == null,
            message: lowesProduct.unitPrice
              ? undefined
              : 'Product found on Lowe’s. Confirm the current unit cost before adding.',
          },
        });
      }
    }

    if (isBarcode) {
      const upcProduct = await lookupUpcItemDbProduct(rawCode);
      if (upcProduct) {
        return res.json({
          product: { ...upcProduct, codeType },
          metadata: {
            dataSource: upcProduct.dataSource,
            requiresManualConfirmation: upcProduct.unitPrice == null,
            message: 'Confirm the store, price, and product details before adding.',
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

    if (!isBarcode) {
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
