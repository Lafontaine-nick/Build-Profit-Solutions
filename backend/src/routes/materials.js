const express = require('express');
const router = express.Router();

/**
 * GET /api/materials/search?store=hd|lowes&zip=89109&q=pex
 * Returns [{ sku, title, price, unit, url, store, zip }]
 */
router.get('/search', async (req, res) => {
  const { store = 'hd', zip = '', q = '' } = req.query;
  
  if (!q || !zip) {
    return res.status(400).json({ error: 'q and zip are required' });
  }

  try {
    // TODO: Replace with your actual provider (Apify/SerpApi/Unwrangle/etc.)
    // For now, returning mock data based on query
    const mockResults = generateMockResults(q, store, zip);
    
    res.json({ results: mockResults });
  } catch (error) {
    console.error('Materials search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mock data generator (replace with real API call)
 */
function generateMockResults(query, store, zip) {
  const q = query.toLowerCase();
  const results = [];
  
  // Mock database of common materials
  const mockCatalog = [
    { keywords: ['2x4', 'stud'], title: '2x4x8 KD Stud', sku: 'HD-161640', price: 4.15, unit: 'EA' },
    { keywords: ['2x6', 'stud'], title: '2x6x8 KD Stud', sku: 'HD-394658', price: 6.85, unit: 'EA' },
    { keywords: ['osb', 'sheathing'], title: 'OSB 7/16" 4x8', sku: 'HD-320005', price: 14.25, unit: 'Sheet' },
    { keywords: ['plywood', 'ply'], title: 'Plywood 1/2" 4x8', sku: 'HD-123093', price: 23.99, unit: 'Sheet' },
    { keywords: ['drywall', 'gypsum'], title: 'Drywall 1/2" 4x8', sku: 'HD-498845', price: 10.9, unit: 'Sheet' },
    { keywords: ['pex', '1/2'], title: 'PEX 1/2" (100ft)', sku: 'HD-203512', price: 48, unit: 'Coil' },
    { keywords: ['romex', '12-2', 'wire'], title: 'NM-B 12/2 Wire (250ft)', sku: 'HD-138967', price: 125, unit: 'Roll' },
    { keywords: ['paint', 'interior'], title: 'Interior Paint (gal)', sku: 'HD-207018', price: 34, unit: 'Gal' },
    { keywords: ['tile', 'porcelain'], title: 'Porcelain Tile 12x24', sku: 'HD-551288', price: 30.2, unit: 'Box' },
    { keywords: ['thinset', 'mortar'], title: 'Thinset Mortar (50lb)', sku: 'HD-100581', price: 14.5, unit: 'Bag' },
  ];
  
  mockCatalog.forEach(item => {
    if (item.keywords.some(kw => q.includes(kw))) {
      // Adjust price slightly based on store
      let price = item.price;
      if (store === 'lowes') price = price * 0.97; // Lowes 3% cheaper (mock)
      
      results.push({
        sku: item.sku.replace('HD-', store === 'lowes' ? 'LW-' : 'HD-'),
        title: item.title,
        price: Math.round(price * 100) / 100,
        unit: item.unit,
        url: `https://www.${store === 'hd' ? 'homedepot' : 'lowes'}.com/p/${item.sku}`,
        store,
        zip
      });
    }
  });
  
  return results;
}

module.exports = router;

