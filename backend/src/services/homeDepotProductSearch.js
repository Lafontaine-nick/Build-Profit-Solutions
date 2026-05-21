const axios = require('axios');

/**
 * Search Home Depot's permitted federation GraphQL API (same source as SKU search).
 * Returns the best matching product or null.
 */
async function searchHomeDepotProduct(query, zip = '') {
  const keyword = String(query || '').trim();
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
    const response = await axios.post('https://www.homedepot.com/federation-gateway/graphql', graphqlQuery, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        Origin: 'https://www.homedepot.com',
        Referer: 'https://www.homedepot.com/',
      },
      timeout: 8000,
    });

    const products = response.data?.data?.searchModel?.products || [];
    if (!products.length) return null;

    const keywordDigits = keyword.replace(/\D/g, '');
    const exactUpcMatch = products.find((p) => {
      const upc = String(p.identifiers?.upcGtin13 || '').replace(/\D/g, '');
      return keywordDigits.length >= 8 && upc && upc.includes(keywordDigits);
    });
    const selected = exactUpcMatch || products.find((p) => p.info?.name) || products[0];
    if (!selected?.info?.name) return null;

    const itemId = selected.identifiers?.itemId;
    const productLabel = selected.identifiers?.productLabel;
    const slug = productLabel || itemId;
    const sourceUrl = slug
      ? `https://www.homedepot.com/p/${slug}`
      : `https://www.homedepot.com/s/${encodeURIComponent(keyword).replace(/%20/g, '+')}`;

    const parseMoney = (value) => {
      const numeric = Number(String(value || '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };

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
      lookupStatus: 'found',
      dataSource: 'homedepot_api',
    };
  } catch (error) {
    console.warn('Home Depot product search failed:', error.message);
    return null;
  }
}

module.exports = { searchHomeDepotProduct };
