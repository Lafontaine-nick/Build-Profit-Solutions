import type { ScannedProduct } from '../lib/products/productScannerTypes';
import {
  buildHomeDepotProductUrl,
  getStoreSearchUrl,
  normalizeScannedBarcode,
  upcDigitsMatch,
} from '../lib/products/productScannerTypes';

const parseMoney = (value: unknown): number | null => {
  const numeric = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

/**
 * Home Depot product search from the device (same GraphQL gateway as homedepot.com).
 * Server-side lookups are often blocked; on-device requests frequently succeed.
 */
export async function lookupHomeDepotDirect(
  query: string,
  zip = '',
): Promise<ScannedProduct | null> {
  const keyword = normalizeScannedBarcode(String(query || '').trim());
  if (!keyword) return null;

  const graphqlQuery = {
    operationName: 'searchModel',
    variables: {
      skipInstallServices: false,
      skipKPF: false,
      skipSpecificationGroup: false,
      skipSubscribeAndSave: false,
      storefilter: 'ALL',
      channel: 'DESKTOP',
      additionalSearchParams: { sponsored: true, mcvisId: '0' },
      filter: {},
      keyword,
      navParam: keyword,
      orderBy: { field: 'TOP_SELLERS', order: 'ASC' },
      pageSize: 12,
      startIndex: 0,
      storeId: '121',
      zipCode: zip || undefined,
    },
    query: `query searchModel($storeId: String, $zipCode: String, $skipInstallServices: Boolean = true, $startIndex: Int, $pageSize: Int, $orderBy: ProductSort, $filter: ProductFilter, $skipKPF: Boolean = false, $skipSpecificationGroup: Boolean = false, $skipSubscribeAndSave: Boolean = false, $keyword: String, $navParam: String, $storefilter: StoreFilter = ALL, $itemIds: [String], $channel: Channel = DESKTOP, $additionalSearchParams: AdditionalParams, $loyaltyMembershipInput: LoyaltyMembershipInput) {
      searchModel(keyword: $keyword, navParam: $navParam, storefilter: $storefilter, storeId: $storeId, itemIds: $itemIds, channel: $channel, additionalSearchParams: $additionalSearchParams, loyaltyMembershipInput: $loyaltyMembershipInput) {
        products(startIndex: $startIndex, pageSize: $pageSize, orderBy: $orderBy, filter: $filter) {
          identifiers { storeSkuNumber itemId productLabel modelNumber upcGtin13 }
          pricing(storeId: $storeId) { value }
          info { name }
          media { images { url } }
        }
      }
    }`,
  };

  try {
    const response = await fetch('https://www.homedepot.com/federation-gateway/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://www.homedepot.com',
        Referer: 'https://www.homedepot.com/',
      },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const products = payload?.data?.searchModel?.products || [];
    if (!products.length) return null;

    const isBarcodeQuery = /^\d{8,14}$/.test(keyword);
    const exactUpcMatch = isBarcodeQuery
      ? products.find((entry: any) =>
          upcDigitsMatch(keyword, String(entry?.identifiers?.upcGtin13 || '')),
        )
      : null;
    const selected = exactUpcMatch || (!isBarcodeQuery ? products.find((entry: any) => entry?.info?.name) : null);
    if (!selected?.info?.name) return null;

    const itemId = selected.identifiers?.itemId;
    const productLabel = selected.identifiers?.productLabel;
    const sourceUrl =
      buildHomeDepotProductUrl(productLabel, itemId) || getStoreSearchUrl('hd', keyword);

    return {
      title: selected.info.name,
      imageUrl: selected.media?.images?.[0]?.url || null,
      supplier: 'Home Depot',
      supplierId: 'hd',
      unitPrice: parseMoney(selected.pricing?.value),
      sku: selected.identifiers?.storeSkuNumber || itemId || null,
      model: selected.identifiers?.modelNumber || null,
      upc: selected.identifiers?.upcGtin13 || (/^\d{8,14}$/.test(keyword) ? keyword : null),
      sourceUrl,
      rawCode: keyword,
      lookupStatus: 'found',
      dataSource: 'homedepot_direct',
    };
  } catch (error) {
    console.warn('Direct Home Depot lookup failed:', error);
    return null;
  }
}
