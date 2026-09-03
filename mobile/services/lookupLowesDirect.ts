import type { ScannedProduct } from '../lib/products/productScannerTypes';
import {
  isBarcodePlaceholderTitle,
  isDirectProductPageUrl,
  normalizeScannedBarcode,
  upcDigitsMatch,
} from '../lib/products/productScannerTypes';
import { postProductsLookup } from '../utils/productLookupApi';

const parseMoney = (value: unknown): number | null => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const MOBILE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
};

const parseProductFromLdJson = (html: string): { title?: string; unitPrice?: number | null; imageUrl?: string | null } | null => {
  const scripts = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const type = String(node?.['@type'] || '').toLowerCase();
        if (!type.includes('product') && !node?.name) continue;
        const offers = node?.offers;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const price = parseMoney(offer?.price ?? offer?.lowPrice ?? node?.price);
        const image = node?.image;
        const imageUrl = Array.isArray(image)
          ? typeof image[0] === 'string'
            ? image[0]
            : image[0]?.url
          : typeof image === 'string'
            ? image
            : image?.url;
        return {
          title: String(node?.name || '').trim() || undefined,
          unitPrice: price,
          imageUrl: imageUrl || null,
        };
      }
    } catch {
      // try next script tag
    }
  }
  return null;
};

const extractFirstLowesProductUrl = (html: string): string | null => {
  const pdMatch = html.match(/https:\/\/www\.lowes\.com\/pd\/[^"'\\s<>]+/i);
  if (pdMatch?.[0]) return pdMatch[0].replace(/&amp;/g, '&');
  const pMatch = html.match(/https:\/\/www\.lowes\.com\/p\/[^"'\\s<>]+/i);
  if (pMatch?.[0]) return pMatch[0].replace(/&amp;/g, '&');
  return null;
};

const fetchLowesHtml = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { headers: MOBILE_HEADERS });
    if (!response.ok) return null;
    const html = await response.text();
    return html && html.length > 500 ? html : null;
  } catch {
    return null;
  }
};

const lookupLowesFromBackend = async (
  query: string,
  zip = '',
): Promise<ScannedProduct | null> => {
  const keyword = normalizeScannedBarcode(String(query || '').trim());
  if (!keyword) return null;

  const data = await postProductsLookup(
    {
      code: keyword,
      codeType: 'barcode',
      sourceHint: 'lowes',
      zip,
    },
    45000,
  );
  const product = data?.product as ScannedProduct | undefined;
  if (!product) return null;
  if (isBarcodePlaceholderTitle(product.title, keyword) && !product.unitPrice) {
    return null;
  }
  return product;
};

/**
 * Lowe's catalog lookup via backend SerpAPI discovery, with on-device HTML fallback.
 */
export async function lookupLowesDirect(
  query: string,
  zip = '',
): Promise<ScannedProduct | null> {
  const keyword = normalizeScannedBarcode(String(query || '').trim());
  if (!keyword) return null;

  const backendProduct = await lookupLowesFromBackend(keyword, zip);
  if (backendProduct) return backendProduct;

  const searchUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(keyword)}`;
  const searchHtml = await fetchLowesHtml(searchUrl);
  if (!searchHtml) return null;

  let parsed = parseProductFromLdJson(searchHtml);
  let sourceUrl = extractFirstLowesProductUrl(searchHtml);

  if ((!parsed?.title || !parsed?.unitPrice) && sourceUrl) {
    const productHtml = await fetchLowesHtml(sourceUrl);
    if (productHtml) {
      const pdp = parseProductFromLdJson(productHtml);
      if (pdp) {
        parsed = { ...parsed, ...pdp };
      }
      if (isDirectProductPageUrl(sourceUrl)) {
        // keep PDP url
      } else {
        const pdpUrl = extractFirstLowesProductUrl(productHtml);
        if (pdpUrl) sourceUrl = pdpUrl;
      }
    }
  }

  if (!parsed?.title && !parsed?.unitPrice) {
    const titleMatch = searchHtml.match(/"description"\s*:\s*"([^"]{8,160})"/i);
    const priceMatch = searchHtml.match(/"sellingPrice"\s*:\s*([0-9.]+)/i);
    if (titleMatch?.[1] || priceMatch?.[1]) {
      parsed = {
        title: titleMatch?.[1]?.replace(/\\u0026/g, '&'),
        unitPrice: parseMoney(priceMatch?.[1]),
      };
    }
  }

  if (!parsed?.title && !parsed?.unitPrice) return null;

  const isBarcode = /^\d{8,14}$/.test(keyword);
  const title = parsed.title || keyword;

  return {
    title,
    imageUrl: parsed.imageUrl || null,
    supplier: "Lowe's",
    supplierId: 'lowes',
    unitPrice: parsed.unitPrice ?? null,
    sku: null,
    model: null,
    upc: isBarcode ? keyword : null,
    sourceUrl: sourceUrl && isDirectProductPageUrl(sourceUrl) ? sourceUrl : sourceUrl,
    rawCode: keyword,
    lookupStatus: parsed.unitPrice ? 'found' : 'manual_required',
    dataSource: 'lowes_direct',
  };
};

export const lowesProductMatchesUpc = (product: ScannedProduct | null, keyword: string): boolean => {
  if (!product?.upc) return false;
  return upcDigitsMatch(keyword, product.upc);
};
