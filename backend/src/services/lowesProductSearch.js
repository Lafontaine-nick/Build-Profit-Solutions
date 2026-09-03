const axios = require('axios');

const parseMoney = (value) => {
  if (value == null) return null;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const normalizeBarcode = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 14) {
    if (digits.length === 13 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  }
  return trimmed;
};

const extractLowesProductId = (url) => {
  const match = String(url || '').match(/\/(\d{6,})(?:[/?#]|$)/);
  return match?.[1] || null;
};

const cleanLowesTitle = (title) =>
  String(title || '')
    .replace(/\s*\.\.\.\s*$/g, '')
    .replace(/\s+with\s*$/i, '')
    .replace(/\s+-\s*Lowe'?s.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildLowesSiteSearchQuery = (title) => {
  const cleaned = cleanLowesTitle(title)
    .replace(/hollow wall.*/i, '')
    .replace(/\s+at\s+Lowe'?s.*$/i, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return `${words.slice(0, 8).join(' ')} site:lowes.com/pd`;
};

const serpGoogleSearch = async (params) => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_SERPAPI_KEY_HERE') return null;

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: { ...params, api_key: apiKey },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn('Lowe’s SerpAPI lookup failed:', error.message);
    return null;
  }
};

const scrapeLowesDetailsFromHtml = (html, productId) => {
  if (!html) return { unitPrice: null, imageUrl: null };

  let unitPrice = null;
  let imageUrl = null;

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage?.[1]) {
    imageUrl = ogImage[1].replace(/&amp;/g, '&');
  }

  const stateMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      const details = state?.productDetails?.[productId];
      const price =
        details?.price?.itemPrice ??
        details?.pricing?.sellingPrice ??
        details?.product?.pricing?.sellingPrice;
      unitPrice = parseMoney(price) ?? unitPrice;

      const imageCandidates = [
        details?.product?.imageUrls?.[0],
        details?.product?.images?.[0],
        details?.imageUrl,
        details?.product?.imageUrl,
      ].filter(Boolean);
      if (imageCandidates[0]) {
        imageUrl = String(imageCandidates[0]);
      }
    } catch {
      // fall through
    }
  }

  if (!unitPrice) {
    const sellingPrice = html.match(/"sellingPrice"\s*:\s*([0-9.]+)/i);
    unitPrice = parseMoney(sellingPrice?.[1]);
  }

  if (!imageUrl) {
    const imageMatch = html.match(/https:\/\/mobileimages\.lowes\.com\/[^"'\\s<>]+/i);
    if (imageMatch?.[0]) {
      imageUrl = imageMatch[0].replace(/&amp;/g, '&');
    }
  }

  return { unitPrice, imageUrl };
};

const fetchLowesDetailsViaWebScraping = async (sourceUrl, productId) => {
  const apiKey = process.env.WEBSCRAPINGAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_WEBSCRAPINGAPI_KEY_HERE') return null;

  try {
    const response = await axios.get('https://api.webscrapingapi.com/v1', {
      params: {
        api_key: apiKey,
        url: sourceUrl,
        render_js: '1',
      },
      timeout: 15000,
    });
    return scrapeLowesDetailsFromHtml(response.data, productId);
  } catch (error) {
    console.warn('Lowe’s WebScrapingAPI detail lookup failed:', error.message);
    return null;
  }
};

const fetchLowesImageViaSerp = async (productId, sourceUrl) => {
  const slug = String(sourceUrl || '')
    .split('/pd/')[1]
    ?.split('/')[0];
  const queries = [
    `${productId} site:lowes.com`,
    slug ? `${slug.replace(/-/g, ' ')} site:lowes.com` : '',
  ].filter(Boolean);

  for (const q of queries) {
    const payload = await serpGoogleSearch({
      engine: 'google_images',
      q,
      num: 8,
    });
    const images = payload?.images_results || [];
    const match =
      images.find((img) => img.link?.includes(String(productId))) ||
      images.find((img) => /lowes\.com/i.test(img.link || '')) ||
      images[0];
    const imageUrl = match?.original || match?.thumbnail;
    if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }
  }

  return null;
};

const extractTitleFromSnippet = (snippet, fallbackTitle) => {
  const part = String(snippet || '')
    .split(';')[0]
    .replace(/\s+16\.0\s*-\s*Pack/i, ' 16-Pack')
    .replace(/\s+/g, ' ')
    .trim();
  if (part.length > 20) return part;
  return cleanLowesTitle(fallbackTitle);
};

const buildProductFromGoogleOrganic = (item, upc, fallbackTitle, barcodeVerified = false) => {
  const link = String(item?.link || '').trim();
  if (!/lowes\.com\/pd\//i.test(link)) return null;

  const productId = extractLowesProductId(link);
  const title =
    cleanLowesTitle(item?.title) ||
    extractTitleFromSnippet(item?.snippet, fallbackTitle) ||
    cleanLowesTitle(fallbackTitle);

  if (!title) return null;

  const unitPrice =
    parseMoney(item?.rich_snippet?.top?.detected_extensions?.price) ||
    parseMoney(item?.rich_snippet?.bottom?.detected_extensions?.price);

  return {
    title,
    imageUrl: null,
    supplier: "Lowe's",
    supplierId: 'lowes',
    unitPrice,
    sku: productId,
    model: null,
    upc,
    sourceUrl: link,
    lookupStatus: unitPrice ? 'found' : 'manual_required',
    dataSource: 'serpapi_lowes',
    barcodeVerified,
  };
};

const searchLowesByBarcode = async (upc) => {
  const normalized = normalizeBarcode(upc);
  if (!/^\d{8,14}$/.test(normalized)) return null;

  const identity = await serpGoogleSearch({
    engine: 'google',
    q: `"${normalized}"`,
    num: 10,
  });
  const organic = identity?.organic_results || [];

  const lowesDirect = organic.find((item) => /lowes\.com\/pd\//i.test(item?.link || ''));
  if (lowesDirect) {
    return buildProductFromGoogleOrganic(lowesDirect, normalized, undefined, true);
  }

  const titleCandidate = organic.find((item) => {
    const title = String(item?.title || '').trim();
    const link = String(item?.link || '');
    return title.length > 12 && !/^undefined/i.test(title) && !/\/404/i.test(link);
  });
  if (!titleCandidate) return null;

  const lowesSearch = await serpGoogleSearch({
    engine: 'google',
    q: buildLowesSiteSearchQuery(titleCandidate.title),
    num: 8,
  });
  const lowesPd = (lowesSearch?.organic_results || []).find((item) =>
    /lowes\.com\/pd\//i.test(item?.link || ''),
  );
  if (!lowesPd) return null;

  return buildProductFromGoogleOrganic(lowesPd, normalized, titleCandidate.title, false);
};

const searchLowesByKeyword = async (query) => {
  const keyword = String(query || '').trim();
  if (!keyword) return null;

  const lowesSearch = await serpGoogleSearch({
    engine: 'google',
    q: `${keyword} site:lowes.com/pd`,
    num: 8,
  });
  const lowesPd = (lowesSearch?.organic_results || []).find((item) =>
    /lowes\.com\/pd\//i.test(item?.link || ''),
  );
  if (!lowesPd) return null;

  const upc = /^\d{8,14}$/.test(normalizeBarcode(keyword)) ? normalizeBarcode(keyword) : null;
  return buildProductFromGoogleOrganic(lowesPd, upc);
};

/**
 * Resolve a Lowe's catalog product from a UPC, SKU, model, or keyword.
 * Uses SerpAPI discovery (Lowe's blocks direct scraping) and optional WebScrapingAPI for live price.
 */
async function searchLowesProduct(query, zip = '') {
  void zip;
  const keyword = String(query || '').trim();
  if (!keyword) return null;

  const normalized = normalizeBarcode(keyword);
  const isBarcode = /^\d{8,14}$/.test(normalized);

  let product = isBarcode
    ? await searchLowesByBarcode(normalized)
    : await searchLowesByKeyword(keyword);

  if (!product) return null;

  if (!product.imageUrl && product.sku) {
    const imageUrl = await fetchLowesImageViaSerp(product.sku, product.sourceUrl);
    if (imageUrl) {
      product = { ...product, imageUrl };
    }
  }

  if (product.sourceUrl && product.sku) {
    const scraped = await fetchLowesDetailsViaWebScraping(product.sourceUrl, product.sku);
    if (scraped?.unitPrice || scraped?.imageUrl) {
      product = {
        ...product,
        unitPrice: scraped.unitPrice ?? product.unitPrice,
        imageUrl: product.imageUrl || scraped.imageUrl || null,
        lookupStatus: scraped.unitPrice || product.unitPrice ? 'found' : product.lookupStatus,
        dataSource: scraped.unitPrice ? 'webscraping' : product.dataSource,
      };
    }
  }

  return product;
}

module.exports = { searchLowesProduct };
