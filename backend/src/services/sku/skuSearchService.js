const axios = require('axios');

/** Cache live SKU searches for 48h to protect API quota. */
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const searchCache = new Map();

function normalizeCacheKey(store, zip, q) {
  return `${store}|${String(zip).trim()}|${String(q).trim().toLowerCase()}`;
}

function getCached(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function clearSkuSearchCache() {
  searchCache.clear();
}

async function searchDirectStoreAPI(query, store, zip) {
  const results = [];
  
  if (store === 'hd') {
    // Home Depot's internal product search API
    const storeId = '121'; // Default store, ideally would lookup by ZIP
    const searchUrl = 'https://www.homedepot.com/federation-gateway/graphql';
    
    const graphqlQuery = {
      operationName: 'searchModel',
      variables: {
        skipInstallServices: false,
        skipKPF: false,
        skipSpecificationGroup: false,
        skipSubscribeAndSave: false,
        storefilter: 'ALL',
        channel: 'DESKTOP',
        additionalSearchParams: {
          sponsored: true,
          mcvisId: '0'
        },
        filter: {},
        keyword: query,
        navParam: query,
        orderBy: { field: 'TOP_SELLERS', order: 'ASC' },
        pageSize: 24,
        startIndex: 0,
        storeId: storeId
      },
      query: `query searchModel($storeId: String, $zipCode: String, $skipInstallServices: Boolean = true, $startIndex: Int, $pageSize: Int, $orderBy: ProductSort, $filter: ProductFilter, $skipKPF: Boolean = false, $skipSpecificationGroup: Boolean = false, $skipSubscribeAndSave: Boolean = false, $keyword: String, $navParam: String, $storefilter: StoreFilter = ALL, $itemIds: [String], $channel: Channel = DESKTOP, $additionalSearchParams: AdditionalParams, $loyaltyMembershipInput: LoyaltyMembershipInput) {
        searchModel(keyword: $keyword, navParam: $navParam, storefilter: $storefilter, storeId: $storeId, itemIds: $itemIds, channel: $channel, additionalSearchParams: $additionalSearchParams, loyaltyMembershipInput: $loyaltyMembershipInput) {
          products(startIndex: $startIndex, pageSize: $pageSize, orderBy: $orderBy, filter: $filter) {
            identifiers { storeSkuNumber itemId productLabel }
            availabilityType { type }
            pricing(storeId: $storeId) { value }
            info { name }
            media { images { url } }
          }
        }
      }`
    };
    
    try {
      const response = await axios.post(searchUrl, graphqlQuery, {
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
      
      if (response.data?.data?.searchModel?.products) {
        response.data.data.searchModel.products.forEach(product => {
          if (product.pricing?.value && product.info?.name) {
            results.push({
              sku: product.identifiers?.storeSkuNumber || product.identifiers?.itemId || `HD-${Date.now()}`,
              title: product.info.name,
              price: parseFloat(product.pricing.value),
              unit: 'each',
              url: `https://www.homedepot.com/p/${product.identifiers?.productLabel || product.identifiers?.itemId}`,
              store,
              zip,
              image: product.media?.images?.[0]?.url || null
            });
          }
        });
      }
    } catch (error) {
      throw new Error(`Home Depot API failed: ${error.message}`);
    }
  } else if (store === 'lowes') {
    // Lowes product search API
    const searchUrl = `https://www.lowes.com/pl/${encodeURIComponent(query)}/4294644003`;
    
    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        timeout: 5000 // Reduced to 5 seconds for faster failure
      });
      
      // Extract JSON data from HTML (Lowes embeds it in script tags)
      const html = response.data;
      const jsonMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        const products = data?.search?.products?.productList || [];
        
        products.slice(0, 24).forEach(product => {
          if (product.pricing?.sellingPrice && product.name) {
            results.push({
              sku: product.productId || product.omniItemId || `LW-${Date.now()}`,
              title: product.name,
              price: parseFloat(product.pricing.sellingPrice),
              unit: 'each',
              url: `https://www.lowes.com${product.productUrl || ''}`,
              store,
              zip,
              image: product.imageUrl || null
            });
          }
        });
      }
    } catch (error) {
      throw new Error(`Lowes API failed: ${error.message}`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('No products found from direct API');
  }
  
  return results;
}
function scoreAndSortResults(results, query) {
  const queryLower = query.toLowerCase();
  
  // Common item patterns for different categories
  const commonPatterns = {
    lumber: [
      { pattern: /2\s*x\s*4\s*x\s*8/i, score: 100 }, // Most common: 2x4x8
      { pattern: /2\s*x\s*4\s*x\s*10/i, score: 90 },
      { pattern: /2\s*x\s*4\s*x\s*12/i, score: 85 },
      { pattern: /2\s*x\s*6\s*x\s*8/i, score: 80 },
      { pattern: /2\s*x\s*6\s*x\s*10/i, score: 75 },
      { pattern: /4\s*x\s*4\s*x\s*8/i, score: 70 },
      { pattern: /2\s*x\s*4/i, score: 60 }, // Generic 2x4
      { pattern: /stud/i, score: 50 },
      { pattern: /premium|grade|#2/i, score: 30 }, // Quality indicators
    ],
    concrete: [
      { pattern: /80\s*lb|80\s*pound/i, score: 100 }, // Most common: 80lb bag
      { pattern: /60\s*lb|60\s*pound/i, score: 90 },
      { pattern: /quikrete/i, score: 85 }, // Popular brand
      { pattern: /sakrete/i, score: 80 },
      { pattern: /ready\s*mix|ready-mix/i, score: 70 },
      { pattern: /fast\s*setting/i, score: 60 },
      { pattern: /concrete\s*mix/i, score: 50 },
    ],
    plywood: [
      { pattern: /4\s*x\s*8/i, score: 100 }, // Standard sheet size
      { pattern: /1\/2|half|0\.5/i, score: 90 }, // Common thickness
      { pattern: /3\/4|three quarter|0\.75/i, score: 85 },
      { pattern: /1\/4|quarter|0\.25/i, score: 80 },
      { pattern: /cdx/i, score: 70 }, // Common grade
      { pattern: /osb/i, score: 65 },
    ],
    drywall: [
      { pattern: /4\s*x\s*8/i, score: 100 }, // Standard sheet
      { pattern: /1\/2|half|0\.5/i, score: 90 },
      { pattern: /5\/8|five eight|0\.625/i, score: 85 },
      { pattern: /sheetrock/i, score: 80 }, // Popular brand
      { pattern: /gypsum/i, score: 70 },
    ],
    rebar: [
      { pattern: /#4|4\s*rebar/i, score: 100 }, // Most common
      { pattern: /#3|3\s*rebar/i, score: 90 },
      { pattern: /#5|5\s*rebar/i, score: 85 },
      { pattern: /1\/2|half/i, score: 80 },
      { pattern: /20\s*ft|20\s*foot/i, score: 70 }, // Common length
    ],
    insulation: [
      { pattern: /r-?13/i, score: 100 }, // Common R-value
      { pattern: /r-?19/i, score: 90 },
      { pattern: /r-?30/i, score: 85 },
      { pattern: /fiberglass/i, score: 70 },
      { pattern: /batts|batt/i, score: 60 },
    ],
  };
  
  // Determine category from query
  let category = null;
  if (queryLower.includes('lumber') || queryLower.includes('wood') || queryLower.includes('board')) {
    category = 'lumber';
  } else if (queryLower.includes('concrete') || queryLower.includes('cement')) {
    category = 'concrete';
  } else if (queryLower.includes('plywood') || queryLower.includes('sheet')) {
    category = 'plywood';
  } else if (queryLower.includes('drywall') || queryLower.includes('sheetrock')) {
    category = 'drywall';
  } else if (queryLower.includes('rebar') || queryLower.includes('reinforcement')) {
    category = 'rebar';
  } else if (queryLower.includes('insulation') || queryLower.includes('insulate')) {
    category = 'insulation';
  }
  
  // Score each result
  const scoredResults = results.map((item, idx) => {
    let relevanceScore = 0;
    const title = (item.title || '').toLowerCase();
    
    // Score based on common patterns
    if (category && commonPatterns[category]) {
      for (const { pattern, score } of commonPatterns[category]) {
        if (pattern.test(title)) {
          relevanceScore += score;
          break; // Only count highest matching pattern
        }
      }
    }
    
    // Boost score for exact query matches in title
    if (title.includes(queryLower)) {
      relevanceScore += 20;
    }
    
    // Boost for common size patterns (e.g., "2x4x8", "4x8")
    if (/\d+\s*x\s*\d+(\s*x\s*\d+)?/.test(title)) {
      relevanceScore += 10;
    }
    
    // Boost for price availability (items with prices are more relevant)
    if (item.price) {
      relevanceScore += 5;
    }
    
    return { item, relevanceScore, originalIndex: idx };
  });
  
  // Sort by relevance score (highest first), then by original order
  scoredResults.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.originalIndex - b.originalIndex;
  });
  
  if (scoredResults.length > 0) {
    console.log(`📊 Relevance scores (top 5): ${scoredResults.slice(0, 5).map(r => `${r.relevanceScore}`).join(', ')}`);
  }
  
  return scoredResults.map(({ item }) => item);
}
async function searchWithSerpAPI(query, store, zip) {
  const storeName = store === 'hd' ? 'Home Depot' : 'Lowes';
  const storeDomain = store === 'hd' ? 'homedepot.com' : 'lowes.com';
  
  // Search for products at the specific store
  const searchQuery = `${query} ${storeName}`;
  
  const params = {
    q: searchQuery,
    engine: 'google_shopping',
    api_key: process.env.SERPAPI_KEY,
    location: `${zip}, United States`,
    num: 40  // Request more results to ensure comprehensive product list
  };
  
  console.log(`📡 SerpAPI Query: "${searchQuery}" in ${zip}`);
  
  let response;
  try {
    response = await axios.get('https://serpapi.com/search', { 
      params,
      timeout: 5000 // 5 second timeout for SerpAPI (fail fast)
    });
  } catch (error) {
    // Check for rate limiting errors
    if (error.response?.status === 429 || 
        error.response?.data?.error?.toLowerCase().includes('too many requests') ||
        error.message?.toLowerCase().includes('too many requests')) {
      throw new Error('RATE_LIMIT_EXCEEDED: SerpAPI rate limit reached. Please try again later or upgrade your plan.');
    }
    // Re-throw other errors
    throw error;
  }
  
  console.log(`📊 SerpAPI raw results: ${response.data.shopping_results?.length || 0} items`);
  
  // Filter results to only include items from the correct store
  const allResults = response.data.shopping_results || [];
  
  // More flexible filtering - prioritize store results but don't filter too aggressively
  const filteredResults = allResults.filter(item => {
    const hasStoreLink = item.link?.includes(storeDomain);
    const hasStoreSource = item.source?.toLowerCase().includes(storeName.toLowerCase());
    const hasStoreInTitle = item.title?.toLowerCase().includes(storeName.toLowerCase());
    
    // Check if item is from a competing store (we want to exclude those)
    const competingStores = store === 'hd' 
      ? ['lowes.com', 'lowe\'s'] 
      : ['homedepot.com', 'home depot'];
    
    const isFromCompetitor = competingStores.some(competitor => 
      item.link?.toLowerCase().includes(competitor) || 
      item.source?.toLowerCase().includes(competitor)
    );
    
    // If it's definitely from a competitor, exclude it
    if (isFromCompetitor) {
      return false;
    }
    
    // If it has store-specific markers, definitely include it
    if (hasStoreLink || hasStoreSource) {
      return true;
    }
    
    // For items without clear store markers, include them if they're relevant
    // (this catches products that Google Shopping lists without specific store attribution)
    return true;
  });
  
  console.log(`🎯 Filtered to ${filteredResults.length} items from ${storeName}`);
  
  // Map to result format first
  const mappedResults = filteredResults.map((item, idx) => {
    // Try to extract direct merchant link from various fields
    let productUrl = null;
    
    // Check if there's a direct link in the extensions or other fields
    if (item.link && item.link.includes(storeDomain)) {
      productUrl = item.link;
    } else if (item.extensions) {
      // Sometimes the direct link is in extensions
      const linkInExtensions = item.extensions.find(ext => ext?.includes && ext.includes(storeDomain));
      if (linkInExtensions) {
        productUrl = linkInExtensions;
      }
    }
    
    // If no direct link found, construct one from the product title
    // This creates a targeted search that should show the product first
    if (!productUrl) {
      const cleanTitle = (item.title || query)
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (store === 'hd') {
        // Home Depot: Use very specific search with model info
        productUrl = `https://www.homedepot.com/s/${encodeURIComponent(cleanTitle).replace(/%20/g, '+')}`;
      } else {
        // Lowes: Use product search with simpler format
        const simpleTitle = cleanTitle.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        productUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(simpleTitle).replace(/%20/g, '+')}`;
      }
    }
    
    if (idx === 0) {
      console.log('🔗 Direct merchant link found:', productUrl.includes(storeDomain) && !productUrl.includes('/s/'));
      console.log('🔗 Final URL:', productUrl);
    }
    
    return {
      sku: item.product_id || `SERP-${Date.now()}-${idx}`,
      title: item.title,
      price: parseFloat(item.price?.replace(/[^0-9.]/g, '')) || null,
      unit: 'each',
      url: productUrl,
      store,
      zip,
      image: item.thumbnail
    };
  });
  
  // Apply smart sorting to prioritize common items
  return scoreAndSortResults(mappedResults, query);
}

/**
 * Search using WebScrapingAPI (direct website scraping)
 */
async function searchWithWebScrapingAPI(query, store, zip) {
  const storeUrl = store === 'hd' ? 'https://www.homedepot.com' : 'https://www.lowes.com';
  let searchUrl;
  if (store === 'hd') {
    searchUrl = `${storeUrl}/s/${encodeURIComponent(query)}`;
  } else {
    // Lowe's uses search?searchTerm= format
    searchUrl = `${storeUrl}/search?searchTerm=${encodeURIComponent(query)}`;
  }
  
  const params = {
    api_key: process.env.WEBSCRAPINGAPI_KEY,
    url: searchUrl
  };
  
  const response = await axios.get('https://api.webscrapingapi.com/v1', { 
    params,
      timeout: 5000 // 5 second timeout for WebScrapingAPI (fail fast)
  });
  
  const html = response.data;
  const results = [];
  
  console.log(`📄 Received HTML response, length: ${html.length} characters`);
  
  // Try to parse Home Depot or Lowes HTML
  if (store === 'hd') {
    // Home Depot parsing - look for common patterns
    // Pattern 1: JSON-LD structured data (most reliable)
    const jsonLdPattern = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch;
    
    while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData['@type'] === 'Product' || jsonData.itemListElement) {
          const products = Array.isArray(jsonData.itemListElement) ? jsonData.itemListElement : [jsonData];
          products.forEach((item, idx) => {
            if (results.length < 10 && item.name && item.offers?.price) {
              results.push({
                sku: item.sku || `HD-${Date.now()}-${idx}`,
                title: item.name,
                price: parseFloat(item.offers.price),
                unit: 'each',
                url: item.url || searchUrl,
                store,
                zip,
                image: item.image || null
              });
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    // Pattern 2: Price span/div patterns
    if (results.length === 0) {
      const pricePattern = /<div[^>]*data-price="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let priceMatch;
      
      while ((priceMatch = pricePattern.exec(html)) !== null && results.length < 10) {
        results.push({
          sku: `HD-${Date.now()}-${results.length}`,
          title: priceMatch[4].trim(),
          price: parseFloat(priceMatch[1]),
          unit: 'each',
          url: `${storeUrl}${priceMatch[3]}`,
          store,
          zip,
          image: null
        });
      }
    }
    
    // Pattern 3: Generic price extraction
    if (results.length === 0) {
      const genericPattern = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)[^<]*<[^>]*>([^<]+)/g;
      let genericMatch;
      const seen = new Set();
      
      while ((genericMatch = genericPattern.exec(html)) !== null && results.length < 10) {
        const price = parseFloat(genericMatch[1].replace(/,/g, ''));
        const text = genericMatch[2].trim();
        
        if (price > 0 && price < 10000 && text.length > 5 && !seen.has(text)) {
          seen.add(text);
          results.push({
            sku: `HD-${Date.now()}-${results.length}`,
            title: text.substring(0, 100),
            price,
            unit: 'each',
            url: searchUrl,
            store,
            zip,
            image: null
          });
        }
      }
    }
  } else {
    // Lowes parsing - similar approach
    const jsonLdPattern = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch;
    
    while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData['@type'] === 'Product' || jsonData.itemListElement) {
          const products = Array.isArray(jsonData.itemListElement) ? jsonData.itemListElement : [jsonData];
          products.forEach((item, idx) => {
            if (results.length < 10 && item.name && item.offers?.price) {
              results.push({
                sku: item.sku || `LW-${Date.now()}-${idx}`,
                title: item.name,
                price: parseFloat(item.offers.price),
                unit: 'each',
                url: item.url || searchUrl,
                store,
                zip,
                image: item.image || null
              });
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  console.log(`✅ Extracted ${results.length} products from HTML`);
  
  // If no results found, throw error to trigger fallback
  if (results.length === 0) {
    throw new Error('Could not parse any products from HTML response');
  }

  // Apply smart sorting to prioritize common items
  return scoreAndSortResults(results, query);
}

async function runLiveSearch(q, store, zip) {
  let results = [];
  let resultsOrigin = 'mock';

  if (process.env.SERPAPI_KEY && process.env.SERPAPI_KEY !== 'YOUR_SERPAPI_KEY_HERE') {
    try {
      console.log('🔑 Trying SerpAPI (Google Shopping) for real product data and images...');
      const serpApiPromise = searchWithSerpAPI(q, store, zip);
      const serpApiTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SerpAPI timeout')), 8000)
      );
      results = await Promise.race([serpApiPromise, serpApiTimeout]);
      if (results.length > 0) {
        console.log(`✅ SerpAPI returned ${results.length} results with REAL product images!`);
        return { results, resultsOrigin: 'serpapi' };
      }
    } catch (serpError) {
      const isRateLimit =
        serpError.message?.includes('RATE_LIMIT_EXCEEDED') ||
        serpError.message?.toLowerCase().includes('too many requests');
      if (isRateLimit) {
        console.warn('⚠️ SerpAPI rate limit reached, trying next API...');
      } else {
        console.warn('⚠️ SerpAPI failed:', serpError.message, '- trying next API...');
      }
    }
  }

  if (process.env.WEBSCRAPINGAPI_KEY && process.env.WEBSCRAPINGAPI_KEY !== 'YOUR_WEBSCRAPINGAPI_KEY_HERE') {
    try {
      console.log('🔑 Trying WebScrapingAPI for real product data and images...');
      const webApiPromise = searchWithWebScrapingAPI(q, store, zip);
      const webApiTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WebScrapingAPI timeout')), 8000)
      );
      results = await Promise.race([webApiPromise, webApiTimeout]);
      if (results.length > 0) {
        console.log(`✅ WebScrapingAPI returned ${results.length} results with REAL product images!`);
        return { results, resultsOrigin: 'webscraping' };
      }
    } catch (webError) {
      console.warn('⚠️ WebScrapingAPI failed:', webError.message, '- trying next API...');
    }
  }

  try {
    console.log("🔑 Trying Home Depot/Lowe's direct API...");
    const directApiPromise = searchDirectStoreAPI(q, store, zip);
    const directApiTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Direct API timeout')), 5000)
    );
    results = await Promise.race([directApiPromise, directApiTimeout]);
    if (results.length > 0) {
      console.log(`✅ Direct API returned ${results.length} results with REAL product images!`);
      return { results, resultsOrigin: 'direct' };
    }
  } catch (directError) {
    console.warn('⚠️ Direct API failed:', directError.message);
  }

  return { results: [], resultsOrigin: 'mock' };
}

function buildMetadata(resultsOrigin, isMockData) {
  return {
    isMockData,
    message: isMockData
      ? 'Using estimated prices (mock catalog). Configure SerpAPI on the server for live shopping results.'
      : '✅ Real pricing data',
    dataSource: resultsOrigin,
    rateLimited: false,
  };
}

/**
 * @param {object} options
 * @param {'hd'|'lowes'} [options.store]
 * @param {string} options.zip
 * @param {string} options.q
 * @param {boolean|string} [options.useMock]
 * @param {boolean} [options.allowMock] - when false, never fall back to mock (pricing engine)
 * @param {(q: string, store: string, zip: string) => Promise<Array>} [options.mockGenerator]
 * @param {number} [options.timeoutMs]
 */
async function searchSku(options = {}) {
  const {
    store = 'hd',
    zip = '',
    q = '',
    useMock = false,
    allowMock = true,
    mockGenerator = null,
    timeoutMs = 15000,
  } = options;

  if (!q || !zip) {
    throw new Error('q and zip are required');
  }

  const cacheKey = normalizeCacheKey(store, zip, q);
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  if (useMock === true || useMock === 'true') {
    if (!mockGenerator) {
      throw new Error('mockGenerator is required when useMock=true');
    }
    const results = await mockGenerator(q, store, zip);
    return {
      results,
      metadata: {
        isMockData: true,
        message: 'Using estimated prices (mock data mode)',
        dataSource: 'mock',
      },
    };
  }

  console.log(`🔍 SKU Search: ${q} at ${store} in ${zip}`);

  const globalTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout: Search took too long')), timeoutMs)
  );

  try {
    const { results, resultsOrigin } = await Promise.race([runLiveSearch(q, store, zip), globalTimeout]);

    let finalResults = results;
    let origin = resultsOrigin;

    if ((!finalResults.length || origin === 'mock') && allowMock && mockGenerator) {
      console.log('⚡ All APIs failed, using mock data (estimated prices, placeholder images)');
      finalResults = await mockGenerator(q, store, zip);
      origin = 'mock';
    }

    const isMockData = origin === 'mock';
    const payload = {
      results: finalResults,
      metadata: buildMetadata(origin, isMockData),
    };

    if (!isMockData && finalResults.length > 0) {
      setCached(cacheKey, payload);
    }

    return payload;
  } catch (error) {
    if (allowMock && mockGenerator && error.message.includes('timeout')) {
      console.warn('⏱️ Request timed out, returning mock data');
      const results = await mockGenerator(q, store, zip);
      return {
        results,
        metadata: {
          isMockData: true,
          message: '⚠️ Request timed out. Using estimated prices.',
          dataSource: 'mock',
        },
      };
    }
    throw error;
  }
}

/** Live supplier search only — no mock fallback (for pricing engine). */
async function searchSkuLive(options = {}) {
  return searchSku({ ...options, allowMock: false, useMock: false });
}

module.exports = {
  searchSku,
  searchSkuLive,
  clearSkuSearchCache,
  scoreAndSortResults,
};
