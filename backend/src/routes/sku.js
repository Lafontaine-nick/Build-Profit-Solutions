const express = require('express');
const axios = require('axios');
const { searchSku, scoreAndSortResults } = require('../services/sku/skuSearchService');
const { authenticateToken } = require('../middleware/authenticateToken');
const { requireEntitlement } = require('../middleware/requireEntitlement');
const router = express.Router();

/**
 * GET /api/sku/search?store=hd|lowes&zip=89109&q=pex
 * Returns [{ sku, title, price, unit, url, store, zip }]
 * This endpoint matches what AttachSkuModal expects
 */
router.get('/search', authenticateToken, requireEntitlement(), async (req, res) => {
  const { store = 'hd', zip = '', q = '', useMock = 'false' } = req.query;

  try {
    const payload = await searchSku({
      store,
      zip,
      q,
      useMock,
      allowMock: true,
      mockGenerator: generateEnhancedMockResults,
    });
    return res.json(payload);
  } catch (error) {
    console.error('SKU search error:', error);
    if (error.message.includes('q and zip are required')) {
      return res.status(400).json({ error: 'q and zip are required' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test endpoint to check API key status
 */
router.get('/test-keys', (req, res) => {
  const serpApiKey = process.env.SERPAPI_KEY;
  const webScrapingApiKey = process.env.WEBSCRAPINGAPI_KEY;
  
  res.json({
    serpApiKey: serpApiKey ? `${serpApiKey.substring(0, 8)}...` : 'Not set',
    webScrapingApiKey: webScrapingApiKey ? `${webScrapingApiKey.substring(0, 8)}...` : 'Not set',
    hasSerpApi: !!(serpApiKey && serpApiKey !== 'YOUR_SERPAPI_KEY_HERE'),
    hasWebScrapingApi: !!(webScrapingApiKey && webScrapingApiKey !== 'YOUR_WEBSCRAPINGAPI_KEY_HERE')
  });
});

/**
 * Enhanced mock data generator with more realistic results
 */
async function generateEnhancedMockResults(query, store, zip) {
  const q = query.toLowerCase();
  const results = [];
  
  // Enhanced mock catalog with more materials
  const mockCatalog = [
    // Dimensional Lumber (SPF, Douglas Fir, Pine) - Expanded
    // 1x2 Series
    { keywords: ['1x2', '8', 'lumber', 'framing'], title: '1x2x8 Dimensional Lumber', sku: '161640', price: 2.95, unit: 'each' },
    { keywords: ['1x2', '10', 'lumber', 'framing'], title: '1x2x10 Dimensional Lumber', sku: '161641', price: 3.75, unit: 'each' },
    { keywords: ['1x2', '12', 'lumber', 'framing'], title: '1x2x12 Dimensional Lumber', sku: '161642', price: 4.55, unit: 'each' },
    
    // 1x3 Series
    { keywords: ['1x3', '8', 'lumber', 'framing'], title: '1x3x8 Dimensional Lumber', sku: '161643', price: 3.25, unit: 'each' },
    { keywords: ['1x3', '10', 'lumber', 'framing'], title: '1x3x10 Dimensional Lumber', sku: '161644', price: 4.15, unit: 'each' },
    { keywords: ['1x3', '12', 'lumber', 'framing'], title: '1x3x12 Dimensional Lumber', sku: '161645', price: 5.05, unit: 'each' },
    
    // 1x4 Series
    { keywords: ['1x4', '8', 'lumber', 'framing'], title: '1x4x8 Dimensional Lumber', sku: '161646', price: 4.15, unit: 'each' },
    { keywords: ['1x4', '10', 'lumber', 'framing'], title: '1x4x10 Dimensional Lumber', sku: '161647', price: 5.25, unit: 'each' },
    { keywords: ['1x4', '12', 'lumber', 'framing'], title: '1x4x12 Dimensional Lumber', sku: '161648', price: 6.35, unit: 'each' },
    { keywords: ['1x4', '16', 'lumber', 'framing'], title: '1x4x16 Dimensional Lumber', sku: '161649', price: 8.55, unit: 'each' },
    
    // 1x6 Series
    { keywords: ['1x6', '8', 'lumber', 'framing'], title: '1x6x8 Dimensional Lumber', sku: '161650', price: 5.95, unit: 'each' },
    { keywords: ['1x6', '10', 'lumber', 'framing'], title: '1x6x10 Dimensional Lumber', sku: '161651', price: 7.55, unit: 'each' },
    { keywords: ['1x6', '12', 'lumber', 'framing'], title: '1x6x12 Dimensional Lumber', sku: '161652', price: 9.15, unit: 'each' },
    { keywords: ['1x6', '16', 'lumber', 'framing'], title: '1x6x16 Dimensional Lumber', sku: '161653', price: 12.35, unit: 'each' },
    
    // 1x8 Series
    { keywords: ['1x8', '8', 'lumber', 'framing'], title: '1x8x8 Dimensional Lumber', sku: '161654', price: 7.95, unit: 'each' },
    { keywords: ['1x8', '10', 'lumber', 'framing'], title: '1x8x10 Dimensional Lumber', sku: '161655', price: 10.15, unit: 'each' },
    { keywords: ['1x8', '12', 'lumber', 'framing'], title: '1x8x12 Dimensional Lumber', sku: '161656', price: 12.35, unit: 'each' },
    { keywords: ['1x8', '16', 'lumber', 'framing'], title: '1x8x16 Dimensional Lumber', sku: '161657', price: 16.75, unit: 'each' },
    
    // 1x10 Series
    { keywords: ['1x10', '8', 'lumber', 'framing'], title: '1x10x8 Dimensional Lumber', sku: '161658', price: 9.95, unit: 'each' },
    { keywords: ['1x10', '10', 'lumber', 'framing'], title: '1x10x10 Dimensional Lumber', sku: '161659', price: 12.75, unit: 'each' },
    { keywords: ['1x10', '12', 'lumber', 'framing'], title: '1x10x12 Dimensional Lumber', sku: '161660', price: 15.55, unit: 'each' },
    { keywords: ['1x10', '16', 'lumber', 'framing'], title: '1x10x16 Dimensional Lumber', sku: '161661', price: 21.15, unit: 'each' },
    
    // 1x12 Series
    { keywords: ['1x12', '8', 'lumber', 'framing'], title: '1x12x8 Dimensional Lumber', sku: '161662', price: 11.95, unit: 'each' },
    { keywords: ['1x12', '10', 'lumber', 'framing'], title: '1x12x10 Dimensional Lumber', sku: '161663', price: 15.35, unit: 'each' },
    { keywords: ['1x12', '12', 'lumber', 'framing'], title: '1x12x12 Dimensional Lumber', sku: '161664', price: 18.75, unit: 'each' },
    { keywords: ['1x12', '16', 'lumber', 'framing'], title: '1x12x16 Dimensional Lumber', sku: '161665', price: 25.55, unit: 'each' },
    
    // 2x2 Series
    { keywords: ['2x2', '8', 'lumber', 'framing'], title: '2x2x8 Dimensional Lumber', sku: '161666', price: 3.95, unit: 'each' },
    { keywords: ['2x2', '10', 'lumber', 'framing'], title: '2x2x10 Dimensional Lumber', sku: '161667', price: 5.05, unit: 'each' },
    
    // 2x3 Series
    { keywords: ['2x3', '8', 'lumber', 'framing'], title: '2x3x8 Dimensional Lumber', sku: '161668', price: 4.95, unit: 'each' },
    { keywords: ['2x3', '10', 'lumber', 'framing'], title: '2x3x10 Dimensional Lumber', sku: '161669', price: 6.25, unit: 'each' },
    { keywords: ['2x3', '12', 'lumber', 'framing'], title: '2x3x12 Dimensional Lumber', sku: '161670', price: 7.55, unit: 'each' },
    
    // Framing - 2x4 Series (Enhanced)
    { keywords: ['2x4', '8', 'stud', 'lumber', 'framing'], title: '2x4x8 KD Stud', sku: '161671', price: 4.15, unit: 'each' },
    { keywords: ['2x4', '10', 'stud', 'lumber', 'framing'], title: '2x4x10 KD Stud', sku: '161672', price: 5.25, unit: 'each' },
    { keywords: ['2x4', '12', 'stud', 'lumber', 'framing'], title: '2x4x12 KD Stud', sku: '161673', price: 6.35, unit: 'each' },
    { keywords: ['2x4', '14', 'stud', 'lumber', 'framing'], title: '2x4x14 KD Stud', sku: '161674', price: 7.45, unit: 'each' },
    { keywords: ['2x4', '16', 'stud', 'lumber', 'framing'], title: '2x4x16 KD Stud', sku: '161675', price: 8.55, unit: 'each' },
    { keywords: ['2x4', '20', 'stud', 'lumber', 'framing'], title: '2x4x20 KD Stud', sku: '161676', price: 10.75, unit: 'each' },
    
    // Framing - 2x6 Series (Enhanced)
    { keywords: ['2x6', '8', 'stud', 'lumber', 'framing'], title: '2x6x8 KD Stud', sku: '394658', price: 6.85, unit: 'each' },
    { keywords: ['2x6', '10', 'stud', 'lumber', 'framing'], title: '2x6x10 KD Stud', sku: '394659', price: 8.65, unit: 'each' },
    { keywords: ['2x6', '12', 'stud', 'lumber', 'framing'], title: '2x6x12 KD Stud', sku: '394660', price: 10.45, unit: 'each' },
    { keywords: ['2x6', '14', 'stud', 'lumber', 'framing'], title: '2x6x14 KD Stud', sku: '394661', price: 12.25, unit: 'each' },
    { keywords: ['2x6', '16', 'stud', 'lumber', 'framing'], title: '2x6x16 KD Stud', sku: '394662', price: 14.05, unit: 'each' },
    { keywords: ['2x6', '20', 'stud', 'lumber', 'framing'], title: '2x6x20 KD Stud', sku: '394663', price: 17.65, unit: 'each' },
    
    // Framing - 2x8 Series (Enhanced)
    { keywords: ['2x8', '8', 'joist', 'lumber', 'framing'], title: '2x8x8 Floor Joist', sku: '100123', price: 7.95, unit: 'each' },
    { keywords: ['2x8', '10', 'joist', 'lumber', 'framing'], title: '2x8x10 Floor Joist', sku: '100124', price: 9.95, unit: 'each' },
    { keywords: ['2x8', '12', 'joist', 'lumber', 'framing'], title: '2x8x12 Floor Joist', sku: '100125', price: 11.95, unit: 'each' },
    { keywords: ['2x8', '14', 'joist', 'lumber', 'framing'], title: '2x8x14 Floor Joist', sku: '100126', price: 13.95, unit: 'each' },
    { keywords: ['2x8', '16', 'joist', 'lumber', 'framing'], title: '2x8x16 Floor Joist', sku: '100127', price: 15.95, unit: 'each' },
    { keywords: ['2x8', '20', 'joist', 'lumber', 'framing'], title: '2x8x20 Floor Joist', sku: '100128', price: 19.95, unit: 'each' },
    
    // Framing - 2x10 Series (Enhanced)
    { keywords: ['2x10', '8', 'joist', 'lumber', 'framing'], title: '2x10x8 Floor Joist', sku: '100129', price: 11.95, unit: 'each' },
    { keywords: ['2x10', '10', 'joist', 'lumber', 'framing'], title: '2x10x10 Floor Joist', sku: '100130', price: 14.95, unit: 'each' },
    { keywords: ['2x10', '12', 'joist', 'lumber', 'framing'], title: '2x10x12 Floor Joist', sku: '100131', price: 17.95, unit: 'each' },
    { keywords: ['2x10', '14', 'joist', 'lumber', 'framing'], title: '2x10x14 Floor Joist', sku: '100132', price: 20.95, unit: 'each' },
    { keywords: ['2x10', '16', 'joist', 'lumber', 'framing'], title: '2x10x16 Floor Joist', sku: '100133', price: 23.95, unit: 'each' },
    { keywords: ['2x10', '20', 'joist', 'lumber', 'framing'], title: '2x10x20 Floor Joist', sku: '100134', price: 29.95, unit: 'each' },
    
    // Framing - 2x12 Series (Enhanced)
    { keywords: ['2x12', '8', 'joist', 'lumber', 'framing'], title: '2x12x8 Floor Joist', sku: '100135', price: 18.95, unit: 'each' },
    { keywords: ['2x12', '10', 'joist', 'lumber', 'framing'], title: '2x12x10 Floor Joist', sku: '100136', price: 23.95, unit: 'each' },
    { keywords: ['2x12', '12', 'joist', 'lumber', 'framing'], title: '2x12x12 Floor Joist', sku: '100137', price: 28.95, unit: 'each' },
    { keywords: ['2x12', '14', 'joist', 'lumber', 'framing'], title: '2x12x14 Floor Joist', sku: '100138', price: 33.95, unit: 'each' },
    { keywords: ['2x12', '16', 'joist', 'lumber', 'framing'], title: '2x12x16 Floor Joist', sku: '100139', price: 38.95, unit: 'each' },
    { keywords: ['2x12', '20', 'joist', 'lumber', 'framing'], title: '2x12x20 Floor Joist', sku: '100140', price: 48.95, unit: 'each' },
    
    // Posts & Beams - 4x4 Series (Enhanced)
    { keywords: ['4x4', '8', 'untreated', 'lumber', 'framing'], title: '4x4x8 KD Post', sku: '100141', price: 12.95, unit: 'each' },
    { keywords: ['4x4', '8', 'treated', 'lumber', 'framing'], title: '4x4x8 Pressure Treated Post', sku: '100142', price: 15.95, unit: 'each' },
    { keywords: ['4x4', '10', 'untreated', 'lumber', 'framing'], title: '4x4x10 KD Post', sku: '100143', price: 16.25, unit: 'each' },
    { keywords: ['4x4', '10', 'treated', 'lumber', 'framing'], title: '4x4x10 Pressure Treated Post', sku: '100144', price: 19.95, unit: 'each' },
    { keywords: ['4x4', '12', 'untreated', 'lumber', 'framing'], title: '4x4x12 KD Post', sku: '100145', price: 19.95, unit: 'each' },
    { keywords: ['4x4', '12', 'treated', 'lumber', 'framing'], title: '4x4x12 Pressure Treated Post', sku: '100146', price: 24.95, unit: 'each' },
    { keywords: ['4x4', '16', 'untreated', 'lumber', 'framing'], title: '4x4x16 KD Post', sku: '100147', price: 26.95, unit: 'each' },
    { keywords: ['4x4', '16', 'treated', 'lumber', 'framing'], title: '4x4x16 Pressure Treated Post', sku: '100148', price: 32.95, unit: 'each' },
    
    // Posts & Beams - 4x6 Series (Enhanced)
    { keywords: ['4x6', '8', 'beam', 'lumber', 'framing'], title: '4x6x8 Beam Stock', sku: '100149', price: 25.95, unit: 'each' },
    { keywords: ['4x6', '10', 'beam', 'lumber', 'framing'], title: '4x6x10 Beam Stock', sku: '100150', price: 32.45, unit: 'each' },
    { keywords: ['4x6', '12', 'beam', 'lumber', 'framing'], title: '4x6x12 Beam Stock', sku: '100151', price: 38.95, unit: 'each' },
    { keywords: ['4x6', '16', 'beam', 'lumber', 'framing'], title: '4x6x16 Beam Stock', sku: '100152', price: 52.95, unit: 'each' },
    
    // Posts & Beams - 6x6 Series (Enhanced)
    { keywords: ['6x6', '8', 'post', 'lumber', 'framing'], title: '6x6x8 Post', sku: '100153', price: 45.95, unit: 'each' },
    { keywords: ['6x6', '8', 'treated', 'lumber', 'framing'], title: '6x6x8 Pressure Treated Post', sku: '100154', price: 55.95, unit: 'each' },
    { keywords: ['6x6', '10', 'post', 'lumber', 'framing'], title: '6x6x10 Post', sku: '100155', price: 57.45, unit: 'each' },
    { keywords: ['6x6', '10', 'treated', 'lumber', 'framing'], title: '6x6x10 Pressure Treated Post', sku: '100156', price: 69.95, unit: 'each' },
    { keywords: ['6x6', '12', 'post', 'lumber', 'framing'], title: '6x6x12 Post', sku: '100157', price: 68.95, unit: 'each' },
    { keywords: ['6x6', '12', 'treated', 'lumber', 'framing'], title: '6x6x12 Pressure Treated Post', sku: '100158', price: 83.95, unit: 'each' },
    { keywords: ['6x6', '16', 'post', 'lumber', 'framing'], title: '6x6x16 Post', sku: '100159', price: 91.95, unit: 'each' },
    { keywords: ['6x6', '16', 'treated', 'lumber', 'framing'], title: '6x6x16 Pressure Treated Post', sku: '100160', price: 111.95, unit: 'each' },
    { keywords: ['6x6', '20', 'post', 'lumber', 'framing'], title: '6x6x20 Post', sku: '100161', price: 115.95, unit: 'each' },
    { keywords: ['6x6', '20', 'treated', 'lumber', 'framing'], title: '6x6x20 Pressure Treated Post', sku: '100162', price: 139.95, unit: 'each' },
    
    // Posts & Beams - 6x8 Series (Special Order)
    { keywords: ['6x8', '8', 'beam', 'lumber', 'framing'], title: '6x8x8 Beam Special Order', sku: '100163', price: 85.95, unit: 'each' },
    { keywords: ['6x8', '10', 'beam', 'lumber', 'framing'], title: '6x8x10 Beam Special Order', sku: '100164', price: 107.95, unit: 'each' },
    { keywords: ['6x8', '12', 'beam', 'lumber', 'framing'], title: '6x8x12 Beam Special Order', sku: '100165', price: 129.95, unit: 'each' },
    { keywords: ['6x8', '16', 'beam', 'lumber', 'framing'], title: '6x8x16 Beam Special Order', sku: '100166', price: 173.95, unit: 'each' },
    
    // Posts & Beams - 8x8 Series (Structural/Architectural)
    { keywords: ['8x8', '8', 'beam', 'structural', 'architectural', 'lumber', 'framing'], title: '8x8x8 Structural Beam', sku: '100167', price: 125.95, unit: 'each' },
    { keywords: ['8x8', '10', 'beam', 'structural', 'architectural', 'lumber', 'framing'], title: '8x8x10 Structural Beam', sku: '100168', price: 157.95, unit: 'each' },
    { keywords: ['8x8', '12', 'beam', 'structural', 'architectural', 'lumber', 'framing'], title: '8x8x12 Structural Beam', sku: '100169', price: 189.95, unit: 'each' },
    { keywords: ['8x8', '16', 'beam', 'structural', 'architectural', 'lumber', 'framing'], title: '8x8x16 Structural Beam', sku: '100170', price: 253.95, unit: 'each' },
    
    // Trim & Finish Lumber - Expanded
    // Finger-joint Pine Boards
    { keywords: ['finger', 'joint', 'pine', 'boards', '1x4', 'trim', 'finish', 'lumber'], title: 'Finger-Joint Pine Board 1x4', sku: '100208', price: 12.95, unit: 'each' },
    { keywords: ['finger', 'joint', 'pine', 'boards', '1x6', 'trim', 'finish', 'lumber'], title: 'Finger-Joint Pine Board 1x6', sku: '100209', price: 16.95, unit: 'each' },
    { keywords: ['finger', 'joint', 'pine', 'boards', '1x8', 'trim', 'finish', 'lumber'], title: 'Finger-Joint Pine Board 1x8', sku: '100210', price: 22.95, unit: 'each' },
    { keywords: ['finger', 'joint', 'pine', 'boards', '1x10', 'trim', 'finish', 'lumber'], title: 'Finger-Joint Pine Board 1x10', sku: '100211', price: 28.95, unit: 'each' },
    { keywords: ['finger', 'joint', 'pine', 'boards', '1x12', 'trim', 'finish', 'lumber'], title: 'Finger-Joint Pine Board 1x12', sku: '100212', price: 35.95, unit: 'each' },
    
    // Clear Pine and Poplar Boards
    { keywords: ['clear', 'pine', 'boards', 'trim', 'finish', 'lumber'], title: 'Clear Pine Boards', sku: '100213', price: 18.95, unit: 'each' },
    { keywords: ['clear', 'poplar', 'boards', 'trim', 'finish', 'lumber'], title: 'Clear Poplar Boards', sku: '100214', price: 16.95, unit: 'each' },
    
    // MDF Boards
    { keywords: ['mdf', 'boards', '1x4', 'trim', 'finish', 'lumber'], title: 'MDF Board 1x4', sku: '100215', price: 8.95, unit: 'each' },
    { keywords: ['mdf', 'boards', '1x6', 'trim', 'finish', 'lumber'], title: 'MDF Board 1x6', sku: '100216', price: 12.95, unit: 'each' },
    { keywords: ['mdf', 'boards', '1x8', 'trim', 'finish', 'lumber'], title: 'MDF Board 1x8', sku: '100217', price: 16.95, unit: 'each' },
    { keywords: ['mdf', 'boards', '1x10', 'trim', 'finish', 'lumber'], title: 'MDF Board 1x10', sku: '100218', price: 22.95, unit: 'each' },
    { keywords: ['mdf', 'boards', '1x12', 'trim', 'finish', 'lumber'], title: 'MDF Board 1x12', sku: '100219', price: 28.95, unit: 'each' },
    
    // PVC Trim Boards
    { keywords: ['pvc', 'trim', 'boards', '1x4', 'trim', 'finish', 'lumber'], title: 'PVC Trim Board 1x4', sku: '100220', price: 15.95, unit: 'each' },
    { keywords: ['pvc', 'trim', 'boards', '1x6', 'trim', 'finish', 'lumber'], title: 'PVC Trim Board 1x6', sku: '100221', price: 22.95, unit: 'each' },
    { keywords: ['pvc', 'trim', 'boards', '1x8', 'trim', 'finish', 'lumber'], title: 'PVC Trim Board 1x8', sku: '100222', price: 28.95, unit: 'each' },
    { keywords: ['pvc', 'trim', 'boards', '1x10', 'trim', 'finish', 'lumber'], title: 'PVC Trim Board 1x10', sku: '100223', price: 35.95, unit: 'each' },
    { keywords: ['pvc', 'trim', 'boards', '1x12', 'trim', 'finish', 'lumber'], title: 'PVC Trim Board 1x12', sku: '100224', price: 42.95, unit: 'each' },
    
    // Cedar Boards
    { keywords: ['cedar', 'boards', 'fencing', 'trim', 'finish', 'lumber'], title: 'Cedar Boards Fencing', sku: '100225', price: 12.95, unit: 'each' },
    { keywords: ['cedar', 'boards', 'trim', 'fascia', 'trim', 'finish', 'lumber'], title: 'Cedar Boards Trim/Fascia', sku: '100226', price: 15.95, unit: 'each' },
    
    // Redwood
    { keywords: ['redwood', 'decking', 'fascia', 'trim', 'finish', 'lumber'], title: 'Redwood Decking & Fascia', sku: '100227', price: 18.95, unit: 'each' },
    
    // Shiplap Boards
    { keywords: ['shiplap', 'boards', '1x6', 'trim', 'finish', 'lumber'], title: 'Shiplap Boards 1x6', sku: '100228', price: 16.95, unit: 'each' },
    { keywords: ['shiplap', 'boards', '1x8', 'trim', 'finish', 'lumber'], title: 'Shiplap Boards 1x8', sku: '100229', price: 22.95, unit: 'each' },
    
    // Tongue & Groove Boards
    { keywords: ['tongue', 'groove', 'boards', 'pine', 'trim', 'finish', 'lumber'], title: 'Tongue & Groove Pine Boards', sku: '100230', price: 14.95, unit: 'each' },
    { keywords: ['tongue', 'groove', 'boards', 'cedar', 'trim', 'finish', 'lumber'], title: 'Tongue & Groove Cedar Boards', sku: '100231', price: 18.95, unit: 'each' },
    
    // Finish/Trim Boards - 1x6 Series
    { keywords: ['1x6', '8', 'finish', 'lumber', 'trim', 'lumber'], title: '1x6x8 Finish Board', sku: '100161', price: 12.95, unit: 'each' },
    { keywords: ['1x6', '10', 'finish', 'lumber', 'trim', 'lumber'], title: '1x6x10 Finish Board', sku: '100162', price: 16.25, unit: 'each' },
    { keywords: ['1x6', '12', 'finish', 'lumber', 'trim', 'lumber'], title: '1x6x12 Finish Board', sku: '100163', price: 19.45, unit: 'each' },
    { keywords: ['1x6', '8', 'trim', 'lumber'], title: '1x6x8 Trim Board', sku: '100164', price: 14.45, unit: 'each' },
    { keywords: ['1x6', '10', 'trim', 'lumber'], title: '1x6x10 Trim Board', sku: '100165', price: 18.05, unit: 'each' },
    { keywords: ['1x6', '12', 'trim', 'lumber'], title: '1x6x12 Trim Board', sku: '100166', price: 21.65, unit: 'each' },
    
    // Finish/Trim Boards - 1x8 Series
    { keywords: ['1x8', '8', 'finish', 'lumber', 'trim', 'lumber'], title: '1x8x8 Finish Board', sku: '100167', price: 17.95, unit: 'each' },
    { keywords: ['1x8', '10', 'finish', 'lumber', 'trim', 'lumber'], title: '1x8x10 Finish Board', sku: '100168', price: 22.45, unit: 'each' },
    { keywords: ['1x8', '12', 'finish', 'lumber', 'trim', 'lumber'], title: '1x8x12 Finish Board', sku: '100169', price: 26.95, unit: 'each' },
    { keywords: ['1x8', '8', 'trim', 'lumber'], title: '1x8x8 Trim Board', sku: '100170', price: 19.95, unit: 'each' },
    { keywords: ['1x8', '10', 'trim', 'lumber'], title: '1x8x10 Trim Board', sku: '100171', price: 24.95, unit: 'each' },
    { keywords: ['1x8', '12', 'trim', 'lumber'], title: '1x8x12 Trim Board', sku: '100172', price: 29.95, unit: 'each' },
    
    // Pressure-Treated Lumber
    { keywords: ['2x4', 'pt', 'pressure', 'treated', '8', 'lumber', 'framing'], title: '2x4x8 Pressure Treated', sku: '100171', price: 6.95, unit: 'each' },
    { keywords: ['2x4', 'pt', 'pressure', 'treated', '10', 'lumber', 'framing'], title: '2x4x10 Pressure Treated', sku: '100172', price: 8.75, unit: 'each' },
    { keywords: ['2x4', 'pt', 'pressure', 'treated', '12', 'lumber', 'framing'], title: '2x4x12 Pressure Treated', sku: '100173', price: 10.55, unit: 'each' },
    { keywords: ['2x4', 'pt', 'pressure', 'treated', '16', 'lumber', 'framing'], title: '2x4x16 Pressure Treated', sku: '100174', price: 14.15, unit: 'each' },
    { keywords: ['2x6', 'pt', 'pressure', 'treated', '8', 'lumber', 'framing'], title: '2x6x8 Pressure Treated', sku: '100175', price: 10.95, unit: 'each' },
    { keywords: ['2x6', 'pt', 'pressure', 'treated', '10', 'lumber', 'framing'], title: '2x6x10 Pressure Treated', sku: '100176', price: 13.85, unit: 'each' },
    { keywords: ['2x6', 'pt', 'pressure', 'treated', '12', 'lumber', 'framing'], title: '2x6x12 Pressure Treated', sku: '100177', price: 16.75, unit: 'each' },
    { keywords: ['2x6', 'pt', 'pressure', 'treated', '16', 'lumber', 'framing'], title: '2x6x16 Pressure Treated', sku: '100178', price: 22.55, unit: 'each' },
    { keywords: ['4x4', 'pt', 'pressure', 'treated', '8', 'lumber', 'framing'], title: '4x4x8 Pressure Treated', sku: '100179', price: 15.95, unit: 'each' },
    { keywords: ['4x4', 'pt', 'pressure', 'treated', '10', 'lumber', 'framing'], title: '4x4x10 Pressure Treated', sku: '100180', price: 19.95, unit: 'each' },
    { keywords: ['4x4', 'pt', 'pressure', 'treated', '12', 'lumber', 'framing'], title: '4x4x12 Pressure Treated', sku: '100181', price: 24.95, unit: 'each' },
    { keywords: ['6x6', 'pt', 'pressure', 'treated', '8', 'lumber', 'framing'], title: '6x6x8 Pressure Treated', sku: '100182', price: 55.95, unit: 'each' },
    { keywords: ['6x6', 'pt', 'pressure', 'treated', '10', 'lumber', 'framing'], title: '6x6x10 Pressure Treated', sku: '100183', price: 69.95, unit: 'each' },
    { keywords: ['6x6', 'pt', 'pressure', 'treated', '12', 'lumber', 'framing'], title: '6x6x12 Pressure Treated', sku: '100184', price: 83.95, unit: 'each' },
    { keywords: ['ground', 'contact', 'rated', 'uc4a', 'uc4b', 'lumber', 'framing'], title: 'Ground Contact Rated UC4A/UC4B', sku: '100185', price: 12.95, unit: 'each' },
    { keywords: ['decking', 'lumber', '2x6', 'pt', '5/4x6', 'deck', 'boards', 'lumber', 'framing'], title: 'Decking Lumber 2x6 PT & 5/4x6 Deck Boards', sku: '100186', price: 18.95, unit: 'each' },
    { keywords: ['marine', 'grade', 'treated', 'lumber', 'lumber', 'framing'], title: 'Marine-Grade Treated Lumber', sku: '100187', price: 25.95, unit: 'each' },
    
    // Engineered Lumber - LVL Beams
    { keywords: ['lvl', 'laminated', 'veneer', 'lumber', 'beam', '9.5', 'lumber', 'engineered'], title: 'LVL Beam 9.5" x 1.75"', sku: '100188', price: 4.25, unit: 'foot' },
    { keywords: ['lvl', 'laminated', 'veneer', 'lumber', 'beam', '11.875', 'lumber', 'engineered'], title: 'LVL Beam 11.875" x 1.75"', sku: '100189', price: 5.35, unit: 'foot' },
    { keywords: ['lvl', 'laminated', 'veneer', 'lumber', 'beam', '14', 'lumber', 'engineered'], title: 'LVL Beam 14" x 1.75"', sku: '100190', price: 6.45, unit: 'foot' },
    { keywords: ['lvl', 'laminated', 'veneer', 'lumber', 'beam', '16', 'lumber', 'engineered'], title: 'LVL Beam 16" x 1.75"', sku: '100191', price: 7.55, unit: 'foot' },
    { keywords: ['lvl', 'laminated', 'veneer', 'lumber', 'beam', '18', 'lumber', 'engineered'], title: 'LVL Beam 18" x 1.75"', sku: '100192', price: 8.65, unit: 'foot' },
    
    // Engineered Lumber - Additional Products
    { keywords: ['psl', 'parallel', 'strand', 'lumber', 'beam', 'lumber', 'engineered'], title: 'PSL Parallel Strand Lumber Beam', sku: '100193', price: 15.95, unit: 'foot' },
    { keywords: ['glulam', 'glued', 'laminated', 'beam', '3-1/8', 'lumber', 'engineered'], title: 'Glulam Beam 3-1/8" Width', sku: '100194', price: 18.95, unit: 'foot' },
    { keywords: ['glulam', 'glued', 'laminated', 'beam', '5-1/8', 'lumber', 'engineered'], title: 'Glulam Beam 5-1/8" Width', sku: '100195', price: 22.95, unit: 'foot' },
    { keywords: ['rim', 'board', '1-1/8', 'lumber', 'engineered'], title: 'Rim Board 1-1/8" Thick', sku: '100196', price: 8.95, unit: 'foot' },
    { keywords: ['i-joist', 'engineered', 'floor', 'joist', '9.5', 'lumber', 'engineered'], title: 'I-Joist Engineered Floor Joist 9.5"', sku: '100197', price: 12.50, unit: 'foot' },
    { keywords: ['i-joist', 'engineered', 'floor', 'joist', '11.875', 'lumber', 'engineered'], title: 'I-Joist Engineered Floor Joist 11.875"', sku: '100198', price: 14.95, unit: 'foot' },
    { keywords: ['i-joist', 'engineered', 'floor', 'joist', '14', 'lumber', 'engineered'], title: 'I-Joist Engineered Floor Joist 14"', sku: '100199', price: 17.95, unit: 'foot' },
    { keywords: ['i-joist', 'engineered', 'floor', 'joist', '16', 'lumber', 'engineered'], title: 'I-Joist Engineered Floor Joist 16"', sku: '100200', price: 21.95, unit: 'foot' },
    { keywords: ['i-joist', 'engineered', 'floor', 'joist', '18', 'lumber', 'engineered'], title: 'I-Joist Engineered Floor Joist 18"', sku: '100201', price: 25.95, unit: 'foot' },
    { keywords: ['lsl', 'laminated', 'strand', 'lumber', 'stud', '2x6', 'lumber', 'engineered'], title: 'LSL Laminated Strand Lumber Stud 2x6', sku: '100202', price: 8.95, unit: 'foot' },
    { keywords: ['lsl', 'laminated', 'strand', 'lumber', 'stud', '2x8', 'lumber', 'engineered'], title: 'LSL Laminated Strand Lumber Stud 2x8', sku: '100203', price: 11.95, unit: 'foot' },
    { keywords: ['truss', 'chords', 'webs', 'lumber', 'engineered'], title: 'Truss Chords & Webs', sku: '100204', price: 6.95, unit: 'foot' },
    
    // Engineered Floor Joists (Legacy)
    { keywords: ['tji', 'joist', 'lumber', 'framing', 'engineered'], title: 'TJI Engineered Joist', sku: '100205', price: 12.50, unit: 'foot' },
    { keywords: ['trus', 'joist', 'lumber', 'framing', 'engineered'], title: 'Trus Joist Engineered Joist', sku: '100206', price: 13.25, unit: 'foot' },
    { keywords: ['lp', 'joist', 'i-joist', 'lumber', 'engineered'], title: 'LP I-Joist Engineered Joist', sku: '100207', price: 11.75, unit: 'foot' },
    
    // Rim Board
    { keywords: ['rim', 'board', 'band', 'lumber', 'framing'], title: 'Rim Board 1-1/8"', sku: '100181', price: 3.25, unit: 'foot' },
    
    // Pressure Treated Lumber
    { keywords: ['2x4', 'treated', 'pressure', 'lumber', 'framing'], title: '2x4x8 Pressure Treated', sku: '100182', price: 5.95, unit: 'each' },
    { keywords: ['2x6', 'treated', 'pressure', 'lumber', 'framing'], title: '2x6x8 Pressure Treated', sku: '100183', price: 8.95, unit: 'each' },
    { keywords: ['4x4', 'treated', 'pressure', 'lumber', 'framing'], title: '4x4x8 Pressure Treated', sku: '100184', price: 15.95, unit: 'each' },
    { keywords: ['6x6', 'treated', 'pressure', 'lumber', 'framing'], title: '6x6x8 Pressure Treated', sku: '100185', price: 55.95, unit: 'each' },
    
    // Kiln-Dried SPF
    { keywords: ['spf', 'kiln', 'dried', 'lumber', 'framing'], title: 'Kiln-Dried SPF Framing', sku: '100186', price: 4.95, unit: 'each' },
    
    // Plywood & OSB - OSB Sheathing (Expanded)
    { keywords: ['osb', '7/16', 'sheathing', 'roof', 'wall', 'plywood', 'sheeting'], title: 'OSB 7/16" 4x8 Wall Sheathing', sku: '320005', price: 14.25, unit: 'sheet' },
    { keywords: ['osb', '7/16', 'roof', 'sheathing', 'plywood', 'sheeting'], title: 'OSB 7/16" 4x8 Roof Sheathing', sku: '320006', price: 15.25, unit: 'sheet' },
    { keywords: ['osb', '1/2', 'roof', 'sheathing', 'plywood', 'sheeting'], title: 'OSB 1/2" 4x8 Roof Sheathing', sku: '320007', price: 16.75, unit: 'sheet' },
    { keywords: ['osb', '3/4', 'subfloor', 'tongue', 'groove', 'plywood', 'sheeting'], title: 'OSB 3/4" 4x8 Subfloor T&G', sku: '320008', price: 28.50, unit: 'sheet' },
    { keywords: ['osb', '5/8', 'roof', 'decking', 'fire', 'code', 'plywood', 'sheeting'], title: 'OSB 5/8" 4x8 Roof Decking Fire Code', sku: '320009', price: 19.25, unit: 'sheet' },
    { keywords: ['zip', 'system', 'sheathing', 'wrb', '7/16', 'plywood', 'sheeting'], title: 'Zip System Sheathing 7/16" Integrated WRB', sku: '320010', price: 35.50, unit: 'sheet' },
    { keywords: ['zip', 'system', 'sheathing', 'wrb', '1/2', 'plywood', 'sheeting'], title: 'Zip System Sheathing 1/2" Integrated WRB', sku: '320011', price: 42.00, unit: 'sheet' },
    { keywords: ['advantech', 'subfloor', 'panels', '23/32', 'tg', 'plywood', 'sheeting'], title: 'Advantech Subfloor Panels 23/32" T&G', sku: '320012', price: 48.95, unit: 'sheet' },
    { keywords: ['osb', 'radiant', 'barrier', 'roof', 'sheathing', 'plywood', 'sheeting'], title: 'OSB Radiant Barrier Roof Sheathing', sku: '320013', price: 32.95, unit: 'sheet' },
    
    // Plywood & OSB - Plywood (CDX, ACX, T&G, Marine) - Expanded
    { keywords: ['plywood', '1/4', 'underlayment', 'cabinet', 'backing', 'ply', 'sheeting'], title: 'Plywood 1/4" 4x8 Underlayment/Cabinet Backing', sku: '123093', price: 18.50, unit: 'sheet' },
    { keywords: ['plywood', '3/8', 'walls', 'repairs', 'ply', 'sheeting'], title: 'Plywood 3/8" 4x8 for Walls/Repairs', sku: '123094', price: 22.95, unit: 'sheet' },
    { keywords: ['cdx', 'plywood', '1/2', 'wall', 'roof', 'sheathing', 'ply', 'sheeting'], title: 'CDX Plywood 1/2" 4x8 Wall/Roof Sheathing', sku: '123095', price: 26.25, unit: 'sheet' },
    { keywords: ['cdx', 'plywood', '5/8', 'roof', 'sheathing', 'ply', 'sheeting'], title: 'CDX Plywood 5/8" 4x8 Roof Sheathing', sku: '123096', price: 31.50, unit: 'sheet' },
    { keywords: ['cdx', 'plywood', '3/4', 'subfloor', 'ply', 'sheeting'], title: 'CDX Plywood 3/4" 4x8 Subfloor', sku: '123097', price: 41.75, unit: 'sheet' },
    { keywords: ['acx', 'plywood', '1/2', 'smooth', 'one', 'side', 'ply', 'sheeting'], title: 'ACX Plywood 1/2" 4x8 Smooth One Side', sku: '123098', price: 32.75, unit: 'sheet' },
    { keywords: ['acx', 'plywood', '3/4', 'furniture', 'grade', 'ply', 'sheeting'], title: 'ACX Plywood 3/4" 4x8 Furniture-Grade', sku: '123099', price: 48.95, unit: 'sheet' },
    { keywords: ['plywood', '3/4', 'tongue', 'groove', 'subfloor', 'ply', 'sheeting'], title: 'Plywood 3/4" 4x8 Tongue & Groove Subfloor', sku: '123100', price: 42.75, unit: 'sheet' },
    { keywords: ['marine', 'plywood', '1/2', 'ply', 'sheeting'], title: 'Marine Plywood 1/2" 4x8', sku: '123101', price: 55.75, unit: 'sheet' },
    { keywords: ['marine', 'plywood', '3/4', 'ply', 'sheeting'], title: 'Marine Plywood 3/4" 4x8', sku: '123102', price: 72.50, unit: 'sheet' },
    { keywords: ['fire', 'rated', 'plywood', '1/2', 'ply', 'sheeting'], title: 'Fire-Rated Plywood 1/2" 4x8', sku: '123103', price: 68.95, unit: 'sheet' },
    { keywords: ['fire', 'rated', 'plywood', '3/4', 'ply', 'sheeting'], title: 'Fire-Rated Plywood 3/4" 4x8', sku: '123104', price: 85.95, unit: 'sheet' },
    { keywords: ['pressure', 'treated', 'plywood', '1/2', 'ply', 'sheeting'], title: 'Pressure-Treated Plywood 1/2" 4x8', sku: '123105', price: 45.95, unit: 'sheet' },
    { keywords: ['pressure', 'treated', 'plywood', '3/4', 'ply', 'sheeting'], title: 'Pressure-Treated Plywood 3/4" 4x8', sku: '123106', price: 58.95, unit: 'sheet' },
    { keywords: ['underlayment', 'plywood', '1/4', 'ply', 'sheeting'], title: 'Underlayment Plywood 1/4" 4x8', sku: '123107', price: 15.25, unit: 'sheet' },
    { keywords: ['underlayment', 'plywood', '3/8', 'ply', 'sheeting'], title: 'Underlayment Plywood 3/8" 4x8', sku: '123108', price: 22.50, unit: 'sheet' },
    { keywords: ['radiant', 'barrier', 'plywood', 'roof', 'deck', 'ply', 'sheeting'], title: 'Radiant Barrier Plywood Roof Deck', sku: '123109', price: 65.95, unit: 'sheet' },
    { keywords: ['shear', 'wall', 'plywood', '5-ply', 'structural', 'ply', 'sheeting'], title: 'Shear Wall Plywood 5-Ply Structural', sku: '123110', price: 85.95, unit: 'sheet' },
    
    // Plywood & OSB - Specialty Panels
    { keywords: ['mdf', 'board', '1/2', 'plywood', 'sheeting'], title: 'MDF Board 1/2" 4x8', sku: '123111', price: 28.95, unit: 'sheet' },
    { keywords: ['mdf', 'board', '3/4', 'plywood', 'sheeting'], title: 'MDF Board 3/4" 4x8', sku: '123112', price: 35.75, unit: 'sheet' },
    { keywords: ['mdf', 'board', '1', 'plywood', 'sheeting'], title: 'MDF Board 1" 4x8', sku: '123113', price: 48.50, unit: 'sheet' },
    { keywords: ['particle', 'board', '5/8', 'plywood', 'sheeting'], title: 'Particle Board 5/8" 4x8', sku: '123114', price: 19.75, unit: 'sheet' },
    { keywords: ['particle', 'board', '3/4', 'plywood', 'sheeting'], title: 'Particle Board 3/4" 4x8', sku: '123115', price: 24.50, unit: 'sheet' },
    { keywords: ['melamine', 'panels', '5/8', 'plywood', 'sheeting'], title: 'Melamine Panels 5/8" 4x8', sku: '123116', price: 35.95, unit: 'sheet' },
    { keywords: ['melamine', 'panels', '3/4', 'plywood', 'sheeting'], title: 'Melamine Panels 3/4" 4x8', sku: '123117', price: 42.95, unit: 'sheet' },
    { keywords: ['birch', 'plywood', '1/4', 'cabinet', 'grade', 'ply', 'sheeting'], title: 'Birch Plywood 1/4" 4x8 Cabinet-Grade', sku: '123118', price: 32.95, unit: 'sheet' },
    { keywords: ['birch', 'plywood', '1/2', 'cabinet', 'grade', 'ply', 'sheeting'], title: 'Birch Plywood 1/2" 4x8 Cabinet-Grade', sku: '123119', price: 45.75, unit: 'sheet' },
    { keywords: ['birch', 'plywood', '3/4', 'cabinet', 'grade', 'ply', 'sheeting'], title: 'Birch Plywood 3/4" 4x8 Cabinet-Grade', sku: '123120', price: 62.50, unit: 'sheet' },
    { keywords: ['maple', 'plywood', '1/2', 'ply', 'sheeting'], title: 'Maple Plywood 1/2" 4x8', sku: '123121', price: 55.95, unit: 'sheet' },
    { keywords: ['maple', 'plywood', '3/4', 'ply', 'sheeting'], title: 'Maple Plywood 3/4" 4x8', sku: '123122', price: 75.95, unit: 'sheet' },
    { keywords: ['oak', 'plywood', '1/2', 'ply', 'sheeting'], title: 'Oak Plywood 1/2" 4x8', sku: '123123', price: 65.95, unit: 'sheet' },
    { keywords: ['oak', 'plywood', '3/4', 'ply', 'sheeting'], title: 'Oak Plywood 3/4" 4x8', sku: '123124', price: 85.95, unit: 'sheet' },
    { keywords: ['lauan', 'plywood', '1/4', 'ply', 'sheeting'], title: 'Lauan Plywood 1/4" 4x8', sku: '123125', price: 22.95, unit: 'sheet' },
    { keywords: ['beadboard', 'panels', '3/8', 'plywood', 'sheeting'], title: 'Beadboard Panels 3/8" 4x8', sku: '123126', price: 35.95, unit: 'sheet' },
    { keywords: ['beadboard', 'panels', '1/2', 'plywood', 'sheeting'], title: 'Beadboard Panels 1/2" 4x8', sku: '123127', price: 42.95, unit: 'sheet' },
    { keywords: ['pegboard', 'sheets', '1/4', 'plywood', 'sheeting'], title: 'Pegboard Sheets 1/4" 4x8', sku: '123128', price: 25.95, unit: 'sheet' },
    { keywords: ['osb', 'structural', 'insulated', 'panels', 'sips', 'plywood', 'sheeting'], title: 'OSB Structural Insulated Panels (SIPs)', sku: '123129', price: 125.95, unit: 'sheet' },
    
    // Plywood & OSB - Accessories & Fasteners
    { keywords: ['h-clips', 'roof', 'sheathing', 'clips', 'plywood', 'sheeting'], title: 'H-Clips for Roof Sheathing', sku: '123130', price: 0.85, unit: 'each' },
    { keywords: ['construction', 'adhesive', 'subfloor', 'sheathing', 'ply', 'sheeting'], title: 'Construction Adhesive for Subfloor & Sheathing', sku: '123131', price: 8.95, unit: 'tube' },
    { keywords: ['plywood', 'clips', 'spacers', 'ply', 'sheeting'], title: 'Plywood Clips & Spacers', sku: '123132', price: 12.95, unit: 'pack' },
    { keywords: ['deck', 'screws', 'sheathing', 'nails', 'ply', 'sheeting'], title: 'Deck Screws & Sheathing Nails', sku: '123133', price: 15.95, unit: 'box' },
    { keywords: ['wood', 'glue', 'laminating', 'adhesive', 'ply', 'sheeting'], title: 'Wood Glue & Laminating Adhesive', sku: '123134', price: 6.95, unit: 'bottle' },
    
    // Drywall
    { keywords: ['drywall', 'gypsum', '1/2'], title: 'Drywall 1/2" 4x8', sku: '498845', price: 10.90, unit: 'sheet' },
    { keywords: ['drywall', 'gypsum', '5/8'], title: 'Drywall 5/8" 4x8', sku: '498846', price: 12.50, unit: 'sheet' },
    { keywords: ['mud', 'compound'], title: 'Joint Compound', sku: '100581', price: 15.50, unit: 'bucket' },
    { keywords: ['tape', 'drywall'], title: 'Drywall Tape', sku: '100582', price: 8.50, unit: 'roll' },
    
    // Electrical
    { keywords: ['romex', '12-2', 'wire'], title: 'NM-B 12/2 Wire (250ft)', sku: '138967', price: 125.00, unit: 'roll' },
    { keywords: ['romex', '14-2', 'wire'], title: 'NM-B 14/2 Wire (250ft)', sku: '138968', price: 95.00, unit: 'roll' },
    { keywords: ['gfci', 'outlet'], title: 'GFCI Outlet', sku: '100583', price: 18.00, unit: 'each' },
    { keywords: ['switch', 'light'], title: 'Light Switch', sku: '100584', price: 1.50, unit: 'each' },
    { keywords: ['outlet', 'standard'], title: 'Standard Outlet', sku: '100585', price: 0.95, unit: 'each' },
    { keywords: ['can', 'light', 'recessed'], title: 'LED Can Light', sku: '100586', price: 42.00, unit: 'each' },
    
    // Plumbing
    { keywords: ['pex', '1/2'], title: 'PEX 1/2" (100ft)', sku: '203512', price: 48.00, unit: 'coil' },
    { keywords: ['pex', '3/4'], title: 'PEX 3/4" (100ft)', sku: '203513', price: 68.00, unit: 'coil' },
    { keywords: ['pvc', '3'], title: 'PVC 3" (10ft)', sku: '100587', price: 12.00, unit: 'length' },
    { keywords: ['valve', 'shutoff'], title: 'Shutoff Valve', sku: '100588', price: 8.50, unit: 'each' },
    
    // Paint
    { keywords: ['paint', 'interior'], title: 'Interior Paint (gal)', sku: '207018', price: 34.00, unit: 'gallon' },
    { keywords: ['paint', 'exterior'], title: 'Exterior Paint (gal)', sku: '207019', price: 38.00, unit: 'gallon' },
    { keywords: ['primer'], title: 'Primer (gal)', sku: '207020', price: 22.00, unit: 'gallon' },
    { keywords: ['caulk'], title: 'Paintable Caulk', sku: '100589', price: 5.50, unit: 'tube' },
    
    // Tile & Waterproofing
    { keywords: ['tile', 'porcelain', '12x24'], title: 'Porcelain Tile 12x24', sku: '551288', price: 30.20, unit: 'box' },
    { keywords: ['thinset', 'mortar'], title: 'Thinset Mortar (50lb)', sku: '100590', price: 14.50, unit: 'bag' },
    { keywords: ['grout'], title: 'Grout', sku: '100591', price: 22.00, unit: 'bag' },
    { keywords: ['cement', 'board'], title: 'Cement Board 1/2"', sku: '100592', price: 12.50, unit: 'sheet' },
    
    // Concrete & Masonry - Concrete Mix
    { keywords: ['concrete', 'mix', '80lb', 'structural', 'bag'], title: 'Concrete Mix 80lb', sku: '100700', price: 4.98, unit: 'bag' },
    { keywords: ['concrete', 'mix', '60lb', 'structural', 'bag'], title: 'Concrete Mix 60lb', sku: '100701', price: 3.98, unit: 'bag' },
    { keywords: ['concrete', 'mix', '40lb', 'structural', 'bag'], title: 'Concrete Mix 40lb', sku: '100702', price: 2.98, unit: 'bag' },
    { keywords: ['concrete', 'ready', 'mix', 'structural'], title: 'Ready-Mix Concrete (cy)', sku: '100703', price: 120.00, unit: 'cubic yard' },
    { keywords: ['mortar', 'mix', 'structural'], title: 'Mortar Mix 80lb', sku: '100704', price: 6.25, unit: 'bag' },
    
    // Concrete & Masonry - Rebar
    { keywords: ['rebar', '#3', '10', 'structural', 'concrete'], title: 'Rebar #3 (10ft)', sku: '100706', price: 4.25, unit: 'length' },
    { keywords: ['rebar', '#3', '20', 'structural', 'concrete'], title: 'Rebar #3 (20ft)', sku: '100707', price: 8.50, unit: 'length' },
    { keywords: ['rebar', '#4', '10', 'structural', 'concrete'], title: 'Rebar #4 (10ft)', sku: '100708', price: 6.00, unit: 'length' },
    { keywords: ['rebar', '#4', '20', 'structural', 'concrete'], title: 'Rebar #4 (20ft)', sku: '100709', price: 12.00, unit: 'length' },
    { keywords: ['rebar', '#5', '10', 'structural', 'concrete'], title: 'Rebar #5 (10ft)', sku: '100710', price: 8.75, unit: 'length' },
    { keywords: ['rebar', '#5', '20', 'structural', 'concrete'], title: 'Rebar #5 (20ft)', sku: '100711', price: 17.50, unit: 'length' },
    
    // Concrete & Masonry - Rebar Accessories
    { keywords: ['rebar', 'ties', 'structural', 'concrete'], title: 'Rebar Ties (100ct)', sku: '100712', price: 12.95, unit: 'box' },
    { keywords: ['rebar', 'chairs', 'structural', 'concrete'], title: 'Rebar Chairs', sku: '100713', price: 1.25, unit: 'each' },
    { keywords: ['tie', 'wire', 'structural', 'concrete'], title: 'Tie Wire (4lb)', sku: '100714', price: 18.50, unit: 'roll' },
    
    // Concrete & Masonry - Anchor Bolts
    { keywords: ['anchor', 'bolt', '1/2', '10', 'structural', 'concrete'], title: 'Anchor Bolt 1/2" x 10"', sku: '100715', price: 3.95, unit: 'each' },
    { keywords: ['anchor', 'bolt', '1/2', '12', 'structural', 'concrete'], title: 'Anchor Bolt 1/2" x 12"', sku: '100716', price: 4.75, unit: 'each' },
    
    // Concrete & Masonry - Aggregate Materials
    { keywords: ['sand', 'structural', 'concrete'], title: 'Sand (ton)', sku: '100717', price: 45.00, unit: 'ton' },
    { keywords: ['gravel', 'structural', 'concrete'], title: 'Gravel (ton)', sku: '100718', price: 55.00, unit: 'ton' },
    { keywords: ['crushed', 'rock', 'structural', 'concrete'], title: 'Crushed Rock (ton)', sku: '100719', price: 65.00, unit: 'ton' },
    
    // Concrete & Masonry - Vapor Barrier
    { keywords: ['vapor', 'barrier', '6', 'mil', 'structural', 'concrete'], title: 'Vapor Barrier 6 Mil', sku: '100720', price: 0.15, unit: 'sq ft' },
    { keywords: ['vapor', 'barrier', '10', 'mil', 'structural', 'concrete'], title: 'Vapor Barrier 10 Mil', sku: '100721', price: 0.25, unit: 'sq ft' },
    
    // Concrete & Masonry - Expansion Joints
    { keywords: ['expansion', 'joint', 'structural', 'concrete'], title: 'Expansion Joint Material', sku: '100722', price: 2.85, unit: 'linear foot' },
    
    // Concrete & Masonry - Form Boards
    { keywords: ['form', 'board', '1x4', 'structural', 'concrete'], title: 'Form Board 1x4 (8ft)', sku: '100723', price: 8.95, unit: 'each' },
    { keywords: ['form', 'board', '1x6', 'structural', 'concrete'], title: 'Form Board 1x6 (8ft)', sku: '100724', price: 12.50, unit: 'each' },
    
    // Concrete & Masonry - Form Accessories
    { keywords: ['form', 'oil', 'structural', 'concrete'], title: 'Form Oil (gal)', sku: '100725', price: 15.95, unit: 'gallon' },
    { keywords: ['concrete', 'stakes', 'structural'], title: 'Concrete Stakes (12ct)', sku: '100726', price: 24.95, unit: 'bundle' },
    
    // Concrete & Masonry - Simpson Connectors
    { keywords: ['simpson', 'hanger', 'structural', 'concrete'], title: 'Simpson Hanger', sku: '100727', price: 2.95, unit: 'each' },
    { keywords: ['simpson', 'strap', 'structural', 'concrete'], title: 'Simpson Strap', sku: '100728', price: 4.25, unit: 'each' },
    { keywords: ['simpson', 'clip', 'structural', 'concrete'], title: 'Simpson Clip', sku: '100729', price: 1.85, unit: 'each' },
    
    // Concrete & Masonry - Finishing
    { keywords: ['concrete', 'sealer', 'structural'], title: 'Concrete Sealer', sku: '100730', price: 25.00, unit: 'gallon' },
    { keywords: ['concrete', 'stain', 'structural'], title: 'Concrete Stain', sku: '100731', price: 45.00, unit: 'gallon' },
    
    // Exterior Envelope - House Wrap
    { keywords: ['house', 'wrap', 'tyvek', 'exterior', 'envelope', 'barrier'], title: 'Tyvek House Wrap', sku: '100732', price: 0.85, unit: 'sq ft' },
    { keywords: ['house', 'wrap', 'typar', 'exterior', 'envelope', 'barrier'], title: 'Typar House Wrap', sku: '100733', price: 0.75, unit: 'sq ft' },
    
    // Exterior Envelope - Flashing (Expanded)
    { keywords: ['flashing', 'tape', 'exterior', 'envelope'], title: 'Flashing Tape (6" x 50ft)', sku: '100734', price: 28.95, unit: 'roll' },
    { keywords: ['window', 'flashing', 'corners', 'exterior', 'envelope'], title: 'Window Flashing Corners', sku: '100735', price: 12.50, unit: 'set' },
    { keywords: ['drip', 'edge', 'metal', 'eave', 'exterior', 'envelope', 'roofing'], title: 'Drip Edge Metal Eave (10ft)', sku: '100736', price: 8.95, unit: 'length' },
    { keywords: ['drip', 'edge', 'metal', 'rake', 'exterior', 'envelope', 'roofing'], title: 'Drip Edge Metal Rake (10ft)', sku: '100737', price: 8.95, unit: 'length' },
    { keywords: ['step', 'flashing', 'exterior', 'envelope', 'roofing'], title: 'Step Flashing (10 pieces)', sku: '100738', price: 15.95, unit: 'set' },
    { keywords: ['valley', 'flashing', 'w', 'exterior', 'envelope', 'roofing'], title: 'W Valley Flashing (10ft)', sku: '100739', price: 25.95, unit: 'length' },
    { keywords: ['valley', 'flashing', 'open', 'exterior', 'envelope', 'roofing'], title: 'Open Valley Flashing (10ft)', sku: '100740', price: 22.95, unit: 'length' },
    
    // Exterior Envelope - Roofing Felt & Underlayment (Expanded)
    { keywords: ['roofing', 'felt', '15', 'exterior', 'envelope'], title: 'Roofing Felt 15# (432sq ft)', sku: '100741', price: 45.95, unit: 'roll' },
    { keywords: ['roofing', 'felt', '30', 'exterior', 'envelope'], title: 'Roofing Felt 30# (432sq ft)', sku: '100742', price: 68.95, unit: 'roll' },
    { keywords: ['synthetic', 'roofing', 'underlayment', 'exterior', 'envelope', 'roofing'], title: 'Synthetic Roofing Underlayment (400sq ft)', sku: '100743', price: 95.95, unit: 'roll' },
    { keywords: ['ice', 'water', 'shield', 'membrane', 'exterior', 'envelope', 'roofing'], title: 'Ice & Water Shield Membrane (200sq ft)', sku: '100744', price: 85.95, unit: 'roll' },
    
    // Exterior Envelope - Shingles (Expanded)
    { keywords: ['shingles', '3', 'tab', 'asphalt', 'exterior', 'envelope', 'roofing'], title: '3-Tab Asphalt Shingles (33.3sq ft)', sku: '100745', price: 35.95, unit: 'bundle' },
    { keywords: ['shingles', 'architectural', 'laminated', 'composition', 'exterior', 'envelope', 'roofing'], title: 'Architectural Laminated Shingles (33.3sq ft)', sku: '100746', price: 45.95, unit: 'bundle' },
    { keywords: ['shingles', 'impact', 'resistant', 'class', '4', 'exterior', 'envelope', 'roofing'], title: 'Impact-Resistant Shingles Class 4 (33.3sq ft)', sku: '100747', price: 55.95, unit: 'bundle' },
    { keywords: ['starter', 'strip', 'shingles', 'exterior', 'envelope', 'roofing'], title: 'Starter Strip Shingles (33.3sq ft)', sku: '100748', price: 28.95, unit: 'bundle' },
    { keywords: ['ridge', 'cap', 'shingles', 'exterior', 'envelope', 'roofing'], title: 'Ridge Cap Shingles (20sq ft)', sku: '100749', price: 28.95, unit: 'bundle' },
    
    // Exterior Envelope - Roof Vents (Expanded)
    { keywords: ['roof', 'vents', 'static', 'exterior', 'envelope'], title: 'Static Roof Vent', sku: '100750', price: 15.95, unit: 'each' },
    { keywords: ['ridge', 'vent', 'roll', 'exterior', 'envelope', 'roofing'], title: 'Ridge Vent Roll (20ft)', sku: '100751', price: 45.95, unit: 'length' },
    { keywords: ['turtle', 'vent', 'exterior', 'envelope', 'roofing'], title: 'Turtle Roof Vent', sku: '100752', price: 12.95, unit: 'each' },
    { keywords: ['turbine', 'vent', 'exterior', 'envelope', 'roofing'], title: 'Turbine Roof Vent', sku: '100753', price: 25.95, unit: 'each' },
    { keywords: ['soffit', 'vent', 'continuous', 'exterior', 'envelope'], title: 'Continuous Soffit Vent (16ft)', sku: '100754', price: 18.95, unit: 'length' },
    { keywords: ['soffit', 'vent', 'individual', 'exterior', 'envelope'], title: 'Individual Soffit Vent', sku: '100755', price: 4.95, unit: 'each' },
    
    // Roofing Accessories & Materials (Expanded)
    { keywords: ['roof', 'decking', 'osb', 'sheathing', 'roofing'], title: 'OSB Roof Decking (4x8)', sku: '100764', price: 16.95, unit: 'sheet' },
    { keywords: ['roof', 'decking', 'plywood', 'sheathing', 'roofing'], title: 'Plywood Roof Decking (4x8)', sku: '100765', price: 18.95, unit: 'sheet' },
    { keywords: ['roof', 'sheathing', 'clips', 'h-clips', 'roofing'], title: 'H-Clips Roof Sheathing Clips', sku: '100766', price: 0.85, unit: 'each' },
    { keywords: ['roof', 'cement', 'mastic', 'roofing'], title: 'Roof Cement Mastic (1gal)', sku: '100767', price: 18.95, unit: 'gallon' },
    { keywords: ['roofing', 'nails', 'coil', 'nails', 'roofing'], title: 'Roofing Nails Coil (1lb)', sku: '100768', price: 8.95, unit: 'lb' },
    { keywords: ['roof', 'flashing', 'sealant', 'repair', 'roofing'], title: 'Roof Flashing & Repair Sealant (10.1oz)', sku: '100769', price: 12.95, unit: 'tube' },
    { keywords: ['roof', 'insulation', 'board', 'roofing'], title: 'Roof Insulation Board (4x8)', sku: '100770', price: 45.95, unit: 'sheet' },
    { keywords: ['tpo', 'membrane', 'flat', 'roof', 'roofing'], title: 'TPO Membrane Flat Roof (100sq ft)', sku: '100771', price: 125.95, unit: 'roll' },
    { keywords: ['epdm', 'rubber', 'membrane', 'roofing'], title: 'EPDM Rubber Membrane (100sq ft)', sku: '100772', price: 95.95, unit: 'roll' },
    { keywords: ['torch', 'down', 'roll', 'roofing', 'roofing'], title: 'Torch-Down Roll Roofing (100sq ft)', sku: '100773', price: 75.95, unit: 'roll' },
    { keywords: ['peel', 'stick', 'underlayment', 'roofing'], title: 'Peel-and-Stick Underlayment (100sq ft)', sku: '100774', price: 85.95, unit: 'roll' },
    { keywords: ['roof', 'jacks', 'pipe', 'boots', 'roofing'], title: 'Roof Jacks & Pipe Boots', sku: '100775', price: 25.95, unit: 'each' },
    { keywords: ['skylight', 'flashing', 'kits', 'roofing'], title: 'Skylight Flashing Kits', sku: '100776', price: 35.95, unit: 'kit' },
    
    // Exterior Envelope - Soffit & Fascia
    { keywords: ['soffit', 'panels', 'exterior', 'envelope'], title: 'Soffit Panel (12" x 16ft)', sku: '100756', price: 18.95, unit: 'panel' },
    { keywords: ['fascia', 'board', '1x6', 'exterior', 'envelope'], title: 'Fascia Board 1x6 (16ft)', sku: '100757', price: 22.95, unit: 'length' },
    { keywords: ['fascia', 'board', '1x8', 'exterior', 'envelope'], title: 'Fascia Board 1x8 (16ft)', sku: '100758', price: 28.95, unit: 'length' },
    { keywords: ['fascia', 'board', '2x6', 'exterior', 'envelope'], title: 'Fascia Board 2x6 (16ft)', sku: '100759', price: 35.95, unit: 'length' },
    
    // Exterior Envelope - Siding
    { keywords: ['siding', 'fiber', 'cement', 'exterior', 'envelope'], title: 'Fiber Cement Siding (8.25" x 12ft)', sku: '100760', price: 15.95, unit: 'panel' },
    { keywords: ['siding', 'vinyl', 'exterior', 'envelope'], title: 'Vinyl Siding (8" x 12ft)', sku: '100761', price: 8.95, unit: 'panel' },
    { keywords: ['siding', 'wood', 'exterior', 'envelope'], title: 'Wood Siding (8" x 12ft)', sku: '100762', price: 12.95, unit: 'panel' },
    { keywords: ['siding', 'stucco', 'base', 'exterior', 'envelope'], title: 'Stucco Base Siding', sku: '100763', price: 25.95, unit: 'panel' },
    
    // Exterior Envelope - Trim & Caulking
    { keywords: ['corner', 'trim', 'exterior', 'envelope'], title: 'Corner Trim (8ft)', sku: '100754', price: 12.95, unit: 'length' },
    { keywords: ['exterior', 'caulking', 'envelope'], title: 'Exterior Caulking (10.1oz)', sku: '100755', price: 8.95, unit: 'tube' },
    
    // Exterior Envelope - Gutters & Downspouts (Expanded)
    { keywords: ['gutters', 'aluminum', 'exterior', 'envelope'], title: 'Aluminum Gutters (10ft)', sku: '100777', price: 18.95, unit: 'length' },
    { keywords: ['gutters', 'steel', 'exterior', 'envelope'], title: 'Steel Gutters (10ft)', sku: '100778', price: 22.95, unit: 'length' },
    { keywords: ['gutters', 'vinyl', 'exterior', 'envelope'], title: 'Vinyl Gutters (10ft)', sku: '100779', price: 15.95, unit: 'length' },
    { keywords: ['downspout', '2x3', 'exterior', 'envelope'], title: 'Downspout 2x3 (10ft)', sku: '100780', price: 12.95, unit: 'length' },
    { keywords: ['downspout', '3x4', 'exterior', 'envelope'], title: 'Downspout 3x4 (10ft)', sku: '100781', price: 15.95, unit: 'length' },
    { keywords: ['gutter', 'elbows', 'exterior', 'envelope'], title: 'Gutter Elbows (90°)', sku: '100782', price: 8.95, unit: 'each' },
    { keywords: ['gutter', 'hangers', 'exterior', 'envelope'], title: 'Gutter Hangers', sku: '100783', price: 2.95, unit: 'each' },
    { keywords: ['gutter', 'end', 'caps', 'exterior', 'envelope'], title: 'Gutter End Caps', sku: '100784', price: 4.95, unit: 'each' },
    { keywords: ['splash', 'blocks', 'exterior', 'envelope'], title: 'Splash Blocks', sku: '100785', price: 12.95, unit: 'each' },
    { keywords: ['drain', 'extensions', 'exterior', 'envelope'], title: 'Drain Extensions (4ft)', sku: '100786', price: 8.95, unit: 'length' },
    
    // Exterior Envelope - Decking
    { keywords: ['decking', 'boards', 'composite', 'exterior', 'envelope'], title: 'Composite Decking (12ft)', sku: '100758', price: 35.95, unit: 'board' },
    { keywords: ['decking', 'boards', 'redwood', 'exterior', 'envelope'], title: 'Redwood Decking (12ft)', sku: '100759', price: 28.95, unit: 'board' },
    { keywords: ['decking', 'boards', 'pressure', 'treated', 'exterior', 'envelope'], title: 'Pressure Treated Decking (12ft)', sku: '100787', price: 22.95, unit: 'board' },
    
    // Stucco System - Lath & Moisture Barrier
    { keywords: ['grade', 'd', 'paper', 'building', 'paper', 'stucco'], title: '2-Ply Grade D Paper 60-Min Building Paper (432sq ft)', sku: '100788', price: 45.95, unit: 'roll' },
    { keywords: ['tyvek', 'stuccowrap', 'wrb', 'stucco'], title: 'Tyvek StuccoWrap WRB (432sq ft)', sku: '100789', price: 85.95, unit: 'roll' },
    { keywords: ['weep', 'screed', 'foundation', 'base', 'stucco'], title: 'Weep Screed Foundation Base (10ft)', sku: '100790', price: 18.95, unit: 'length' },
    { keywords: ['casing', 'bead', 'windows', 'doors', 'stucco'], title: 'Casing Bead Windows/Doors (10ft)', sku: '100791', price: 12.95, unit: 'length' },
    { keywords: ['corner', 'aid', 'bead', 'wire', 'stucco'], title: 'Corner Aid Wire Corner Bead (10ft)', sku: '100792', price: 15.95, unit: 'length' },
    { keywords: ['corner', 'aid', 'bead', 'vinyl', 'stucco'], title: 'Corner Aid Vinyl Corner Bead (10ft)', sku: '100793', price: 12.95, unit: 'length' },
    { keywords: ['expanded', 'metal', 'lath', '3.4', 'lb', 'stucco'], title: 'Expanded Metal Lath 3.4 lb (27" x 96")', sku: '100794', price: 18.95, unit: 'sheet' },
    { keywords: ['expanded', 'metal', 'lath', '2.5', 'lb', 'stucco'], title: 'Expanded Metal Lath 2.5 lb (27" x 96")', sku: '100795', price: 15.95, unit: 'sheet' },
    { keywords: ['self', 'furring', 'lath', 'sheets', 'stucco'], title: 'Self-Furring Lath Sheets (27" x 96")', sku: '100796', price: 16.95, unit: 'sheet' },
    { keywords: ['self', 'furring', 'lath', 'rolls', 'stucco'], title: 'Self-Furring Lath Rolls (27" x 150ft)', sku: '100797', price: 125.95, unit: 'roll' },
    { keywords: ['plastic', 'lath', 'stucco'], title: 'Plastic Lath Alternative (27" x 96")', sku: '100798', price: 14.95, unit: 'sheet' },
    { keywords: ['galvanized', 'staples', 'lath', 'attachment', 'stucco'], title: 'Galvanized Staples for Lath (1lb)', sku: '100799', price: 8.95, unit: 'lb' },
    { keywords: ['galvanized', 'nails', 'lath', 'attachment', 'stucco'], title: 'Galvanized Nails for Lath (1lb)', sku: '100800', price: 6.95, unit: 'lb' },
    { keywords: ['control', 'joints', 'expansion', 'm', 'type', 'stucco'], title: 'Control Joints Expansion M-Type (10ft)', sku: '100801', price: 22.95, unit: 'length' },
    { keywords: ['control', 'joints', 'expansion', 'v', 'type', 'stucco'], title: 'Control Joints Expansion V-Type (10ft)', sku: '100802', price: 25.95, unit: 'length' },
    { keywords: ['trim', 'accessories', 'drip', 'edge', 'stucco'], title: 'Stucco Trim Drip Edge (10ft)', sku: '100803', price: 15.95, unit: 'length' },
    { keywords: ['reveal', 'trim', 'stucco'], title: 'Reveal Trim (10ft)', sku: '100804', price: 12.95, unit: 'length' },
    { keywords: ['j', 'trim', 'stucco'], title: 'J-Trim (10ft)', sku: '100805', price: 8.95, unit: 'length' },
    { keywords: ['lath', 'overlap', 'wire', 'ties', 'stucco'], title: 'Lath Overlap Wire Ties (100ct)', sku: '100806', price: 12.95, unit: 'pack' },
    { keywords: ['lath', 'overlap', 'washers', 'stucco'], title: 'Lath Overlap Washers (100ct)', sku: '100807', price: 8.95, unit: 'pack' },
    
    // Stucco System - Base Coats
    { keywords: ['scratch', 'coat', 'mix', 'pre', 'blended', 'stucco'], title: 'Scratch Coat Mix Pre-Blended (80lb)', sku: '100808', price: 18.95, unit: 'bag' },
    { keywords: ['scratch', 'coat', 'mix', 'site', '1:3', 'stucco'], title: 'Scratch Coat Mix Site Mix 1:3 (80lb)', sku: '100809', price: 15.95, unit: 'bag' },
    { keywords: ['brown', 'coat', 'mix', 'stucco'], title: 'Brown Coat Mix (80lb)', sku: '100810', price: 16.95, unit: 'bag' },
    { keywords: ['stucco', 'cement', 'astm', 'c1328', 'stucco'], title: 'Stucco Cement ASTM C1328 (94lb)', sku: '100811', price: 12.95, unit: 'bag' },
    { keywords: ['masonry', 'sand', 'stucco'], title: 'Masonry Sand (50lb)', sku: '100812', price: 6.95, unit: 'bag' },
    { keywords: ['acrylic', 'modified', 'base', 'coat', 'stucco'], title: 'Acrylic-Modified Base Coat (5gal)', sku: '100813', price: 85.95, unit: 'bucket' },
    { keywords: ['fiber', 'reinforced', 'base', 'coat', 'stucco'], title: 'Fiber-Reinforced Base Coat (5gal)', sku: '100814', price: 95.95, unit: 'bucket' },
    { keywords: ['bonding', 'agent', 'stucco', 'weld', 'stucco'], title: 'Bonding Agent Stucco Weld (5gal)', sku: '100815', price: 75.95, unit: 'bucket' },
    { keywords: ['stucco', 'netting', 'reinforcement', 'mesh', 'stucco'], title: 'Stucco Netting Reinforcement Mesh (3ft x 150ft)', sku: '100816', price: 45.95, unit: 'roll' },
    { keywords: ['water', 'curing', 'sprayer', 'stucco'], title: 'Water Curing Sprayer (2gal)', sku: '100817', price: 25.95, unit: 'each' },
    { keywords: ['water', 'curing', 'hoses', 'stucco'], title: 'Water Curing Hoses (50ft)', sku: '100818', price: 35.95, unit: 'length' },
    
    // Stucco System - Finish Coats
    { keywords: ['color', 'coat', 'stucco', 'integral', 'color', 'stucco'], title: 'Color Coat Stucco Integral Color (5gal)', sku: '100819', price: 125.95, unit: 'bucket' },
    { keywords: ['acrylic', 'finish', 'elastomeric', 'stucco'], title: 'Acrylic Finish Elastomeric (5gal)', sku: '100820', price: 145.95, unit: 'bucket' },
    { keywords: ['acrylic', 'finish', 'synthetic', 'stucco'], title: 'Acrylic Finish Synthetic (5gal)', sku: '100821', price: 135.95, unit: 'bucket' },
    { keywords: ['traditional', 'stucco', 'finish', 'sand', 'float', 'stucco'], title: 'Traditional Stucco Sand Float Finish (5gal)', sku: '100822', price: 85.95, unit: 'bucket' },
    { keywords: ['traditional', 'stucco', 'finish', 'dash', 'stucco'], title: 'Traditional Stucco Dash Finish (5gal)', sku: '100823', price: 95.95, unit: 'bucket' },
    { keywords: ['traditional', 'stucco', 'finish', 'lace', 'stucco'], title: 'Traditional Stucco Lace Finish (5gal)', sku: '100824', price: 105.95, unit: 'bucket' },
    { keywords: ['traditional', 'stucco', 'finish', 'smooth', 'stucco'], title: 'Traditional Stucco Smooth Finish (5gal)', sku: '100825', price: 75.95, unit: 'bucket' },
    { keywords: ['fine', 'texture', 'finish', 'stucco'], title: 'Fine Texture Finish (5gal)', sku: '100826', price: 95.95, unit: 'bucket' },
    { keywords: ['medium', 'texture', 'finish', 'stucco'], title: 'Medium Texture Finish (5gal)', sku: '100827', price: 85.95, unit: 'bucket' },
    { keywords: ['coarse', 'texture', 'finish', 'stucco'], title: 'Coarse Texture Finish (5gal)', sku: '100828', price: 75.95, unit: 'bucket' },
    { keywords: ['fog', 'coat', 'materials', 'stucco'], title: 'Fog Coat Materials (5gal)', sku: '100829', price: 65.95, unit: 'bucket' },
    { keywords: ['stucco', 'patch', 'mix', 'stucco'], title: 'Stucco Patch Mix (25lb)', sku: '100830', price: 18.95, unit: 'bag' },
    { keywords: ['stucco', 'sealer', 'waterproof', 'coating', 'stucco'], title: 'Stucco Sealer Waterproof Coating (5gal)', sku: '100831', price: 125.95, unit: 'bucket' },
    { keywords: ['elastomeric', 'paint', 'stucco', 'stucco'], title: 'Elastomeric Paint for Stucco (5gal)', sku: '100832', price: 145.95, unit: 'bucket' },
    
    // Stucco System - Accessories & Tools
    { keywords: ['texture', 'trowels', 'stucco'], title: 'Texture Trowels Set', sku: '100833', price: 45.95, unit: 'set' },
    { keywords: ['texture', 'floats', 'stucco'], title: 'Texture Floats Set', sku: '100834', price: 35.95, unit: 'set' },
    { keywords: ['hawk', 'trowel', 'stucco'], title: 'Hawk and Trowel Set', sku: '100835', price: 25.95, unit: 'set' },
    { keywords: ['plastering', 'darby', 'rod', 'stucco'], title: 'Plastering Darby and Rod', sku: '100836', price: 35.95, unit: 'each' },
    { keywords: ['plaster', 'mixer', 'paddle', 'stucco'], title: 'Plaster Mixer Paddle', sku: '100837', price: 15.95, unit: 'each' },
    { keywords: ['plaster', 'stop', 'bead', 'stucco'], title: 'Plaster Stop Bead (10ft)', sku: '100838', price: 12.95, unit: 'length' },
    { keywords: ['scaffolding', 'planks', 'stucco'], title: 'Scaffolding Planks (8ft)', sku: '100839', price: 45.95, unit: 'each' },
    { keywords: ['scaffolding', 'braces', 'stucco'], title: 'Scaffolding Braces', sku: '100840', price: 25.95, unit: 'each' },
    { keywords: ['corner', 'mesh', 'stucco'], title: 'Corner Mesh (50ft)', sku: '100841', price: 18.95, unit: 'roll' },
    { keywords: ['fiber', 'tape', 'stucco'], title: 'Fiber Tape (150ft)', sku: '100842', price: 12.95, unit: 'roll' },
    { keywords: ['expansion', 'joint', 'sealant', 'stucco'], title: 'Expansion Joint Sealant (10.1oz)', sku: '100843', price: 15.95, unit: 'tube' },
    { keywords: ['cleaners', 'acid', 'wash', 'stucco'], title: 'Stucco Cleaners & Acid Wash (1gal)', sku: '100844', price: 35.95, unit: 'gallon' },
    
    // Expanded Siding Systems
    { keywords: ['fiber', 'cement', 'siding', 'hardie', 'lap', 'siding'], title: 'Hardie Fiber Cement Lap Siding (12ft)', sku: '100845', price: 18.95, unit: 'board' },
    { keywords: ['fiber', 'cement', 'siding', 'hardie', 'panel', 'siding'], title: 'Hardie Fiber Cement Panel Siding (4x8)', sku: '100846', price: 35.95, unit: 'panel' },
    { keywords: ['fiber', 'cement', 'siding', 'hardie', 'shingle', 'siding'], title: 'Hardie Fiber Cement Shingle Siding (12ft)', sku: '100847', price: 25.95, unit: 'board' },
    { keywords: ['fiber', 'cement', 'siding', 'allura', 'lap', 'siding'], title: 'Allura Fiber Cement Lap Siding (12ft)', sku: '100848', price: 16.95, unit: 'board' },
    { keywords: ['vinyl', 'siding', 'lap', 'siding'], title: 'Vinyl Lap Siding (12ft)', sku: '100849', price: 8.95, unit: 'board' },
    { keywords: ['vinyl', 'siding', 'dutch', 'lap', 'siding'], title: 'Vinyl Dutch Lap Siding (12ft)', sku: '100850', price: 12.95, unit: 'board' },
    { keywords: ['vinyl', 'siding', 'vertical', 'siding'], title: 'Vinyl Vertical Siding (12ft)', sku: '100851', price: 10.95, unit: 'board' },
    { keywords: ['wood', 'siding', 'cedar', 'siding'], title: 'Cedar Wood Siding (12ft)', sku: '100852', price: 22.95, unit: 'board' },
    { keywords: ['wood', 'siding', 'redwood', 'siding'], title: 'Redwood Wood Siding (12ft)', sku: '100853', price: 25.95, unit: 'board' },
    { keywords: ['wood', 'siding', 'tongue', 'groove', 'siding'], title: 'Wood Tongue & Groove Siding (12ft)', sku: '100854', price: 18.95, unit: 'board' },
    { keywords: ['engineered', 'wood', 'siding', 'lp', 'smartside', 'siding'], title: 'LP SmartSide Engineered Wood Siding (12ft)', sku: '100855', price: 15.95, unit: 'board' },
    { keywords: ['composite', 'cladding', 'panels', 'siding'], title: 'Composite Cladding Panels (4x8)', sku: '100856', price: 45.95, unit: 'panel' },
    { keywords: ['metal', 'siding', 'panels', 'siding'], title: 'Metal Siding Panels (12ft)', sku: '100857', price: 35.95, unit: 'panel' },
    { keywords: ['siding', 'starter', 'strip', 'siding'], title: 'Siding Starter Strip (12ft)', sku: '100858', price: 8.95, unit: 'length' },
    { keywords: ['j', 'channel', 'trim', 'siding'], title: 'J-Channel Trim (12ft)', sku: '100859', price: 6.95, unit: 'length' },
    { keywords: ['corner', 'posts', 'siding'], title: 'Corner Posts (8ft)', sku: '100860', price: 18.95, unit: 'length' },
    { keywords: ['soffit', 'panels', 'vented', 'siding'], title: 'Vented Soffit Panels (12" x 16ft)', sku: '100861', price: 22.95, unit: 'panel' },
    { keywords: ['soffit', 'panels', 'solid', 'siding'], title: 'Solid Soffit Panels (12" x 16ft)', sku: '100862', price: 18.95, unit: 'panel' },
    { keywords: ['fascia', 'boards', 'aluminum', 'wrapped', 'siding'], title: 'Aluminum-Wrapped Fascia Boards (16ft)', sku: '100863', price: 35.95, unit: 'length' },
    { keywords: ['house', 'wrap', 'tyvek', 'siding'], title: 'Tyvek House Wrap (432sq ft)', sku: '100864', price: 85.95, unit: 'roll' },
    { keywords: ['house', 'wrap', 'typar', 'siding'], title: 'Typar House Wrap (432sq ft)', sku: '100865', price: 75.95, unit: 'roll' },
    { keywords: ['house', 'wrap', 'zip', 'siding'], title: 'Zip House Wrap (432sq ft)', sku: '100866', price: 95.95, unit: 'roll' },
    { keywords: ['flashing', 'tape', 'butyl', 'siding'], title: 'Butyl Flashing Tape (50ft)', sku: '100867', price: 25.95, unit: 'roll' },
    { keywords: ['flashing', 'tape', 'asphaltic', 'siding'], title: 'Asphaltic Flashing Tape (50ft)', sku: '100868', price: 18.95, unit: 'roll' },
    { keywords: ['flashing', 'tape', 'stretch', 'siding'], title: 'Stretch Flashing Tape (50ft)', sku: '100869', price: 22.95, unit: 'roll' },
    { keywords: ['window', 'flashing', 'corners', 'siding'], title: 'Window Flashing Corners', sku: '100870', price: 12.95, unit: 'set' },
    { keywords: ['drip', 'cap', 'flashing', 'siding'], title: 'Drip Cap Flashing (10ft)', sku: '100871', price: 8.95, unit: 'length' },
    { keywords: ['exterior', 'caulking', 'polyurethane', 'siding'], title: 'Exterior Polyurethane Caulking (10.1oz)', sku: '100872', price: 12.95, unit: 'tube' },
    { keywords: ['exterior', 'caulking', 'silicone', 'siding'], title: 'Exterior Silicone Caulking (10.1oz)', sku: '100873', price: 8.95, unit: 'tube' },
    { keywords: ['sheathing', 'under', 'siding', 'osb', 'siding'], title: 'OSB Sheathing Under Siding (4x8)', sku: '100874', price: 16.95, unit: 'sheet' },
    { keywords: ['sheathing', 'under', 'siding', 'zip', 'siding'], title: 'Zip Sheathing Under Siding (4x8)', sku: '100875', price: 35.95, unit: 'sheet' },
    { keywords: ['insulated', 'foam', 'sheathing', '1', 'siding'], title: 'Insulated Foam Sheathing 1" (4x8)', sku: '100876', price: 25.95, unit: 'sheet' },
    { keywords: ['insulated', 'foam', 'sheathing', '1.5', 'siding'], title: 'Insulated Foam Sheathing 1.5" (4x8)', sku: '100877', price: 35.95, unit: 'sheet' },
    { keywords: ['insulated', 'foam', 'sheathing', '2', 'siding'], title: 'Insulated Foam Sheathing 2" (4x8)', sku: '100878', price: 45.95, unit: 'sheet' },
    
    // Electrical Materials - Wiring & Cable
    { keywords: ['nm-b', 'romex', 'cable', '14/2', 'electrical'], title: 'NM-B Romex Cable 14/2 (250ft)', sku: '100879', price: 85.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '14/3', 'electrical'], title: 'NM-B Romex Cable 14/3 (250ft)', sku: '100880', price: 125.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '12/2', 'electrical'], title: 'NM-B Romex Cable 12/2 (250ft)', sku: '100881', price: 95.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '12/3', 'electrical'], title: 'NM-B Romex Cable 12/3 (250ft)', sku: '100882', price: 145.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '10/2', 'electrical'], title: 'NM-B Romex Cable 10/2 (250ft)', sku: '100883', price: 165.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '10/3', 'electrical'], title: 'NM-B Romex Cable 10/3 (250ft)', sku: '100884', price: 225.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '8/2', 'electrical'], title: 'NM-B Romex Cable 8/2 (250ft)', sku: '100885', price: 285.95, unit: 'roll' },
    { keywords: ['nm-b', 'romex', 'cable', '8/3', 'electrical'], title: 'NM-B Romex Cable 8/3 (250ft)', sku: '100886', price: 385.95, unit: 'roll' },
    { keywords: ['6/3', 'range', 'cable', 'electrical'], title: '6/3 Range Cable (100ft)', sku: '100887', price: 485.95, unit: 'roll' },
    { keywords: ['uf-b', 'underground', 'feeder', '12/2', 'electrical'], title: 'UF-B Underground Feeder Cable 12/2 (250ft)', sku: '100888', price: 125.95, unit: 'roll' },
    { keywords: ['uf-b', 'underground', 'feeder', '10/2', 'electrical'], title: 'UF-B Underground Feeder Cable 10/2 (250ft)', sku: '100889', price: 195.95, unit: 'roll' },
    { keywords: ['uf-b', 'underground', 'feeder', '8/3', 'electrical'], title: 'UF-B Underground Feeder Cable 8/3 (250ft)', sku: '100890', price: 425.95, unit: 'roll' },
    { keywords: ['mc', 'cable', 'metal', 'clad', '12/2', 'electrical'], title: 'MC Metal-Clad Cable 12/2 (250ft)', sku: '100891', price: 155.95, unit: 'roll' },
    { keywords: ['mc', 'cable', 'metal', 'clad', '12/3', 'electrical'], title: 'MC Metal-Clad Cable 12/3 (250ft)', sku: '100892', price: 195.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '14', 'awg', 'black', 'electrical'], title: 'THHN Wire 14 AWG Black (500ft)', sku: '100893', price: 45.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '14', 'awg', 'white', 'electrical'], title: 'THHN Wire 14 AWG White (500ft)', sku: '100894', price: 45.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '14', 'awg', 'red', 'electrical'], title: 'THHN Wire 14 AWG Red (500ft)', sku: '100895', price: 45.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '14', 'awg', 'green', 'electrical'], title: 'THHN Wire 14 AWG Green (500ft)', sku: '100896', price: 45.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '12', 'awg', 'black', 'electrical'], title: 'THHN Wire 12 AWG Black (500ft)', sku: '100897', price: 65.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '12', 'awg', 'white', 'electrical'], title: 'THHN Wire 12 AWG White (500ft)', sku: '100898', price: 65.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '10', 'awg', 'black', 'electrical'], title: 'THHN Wire 10 AWG Black (500ft)', sku: '100899', price: 125.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '8', 'awg', 'black', 'electrical'], title: 'THHN Wire 8 AWG Black (500ft)', sku: '100900', price: 195.95, unit: 'roll' },
    { keywords: ['thhn', 'wire', '6', 'awg', 'black', 'electrical'], title: 'THHN Wire 6 AWG Black (500ft)', sku: '100901', price: 285.95, unit: 'roll' },
    { keywords: ['low', 'voltage', 'landscape', 'wire', '12/2', 'electrical'], title: 'Low-Voltage Landscape Wire 12/2 (500ft)', sku: '100902', price: 85.95, unit: 'roll' },
    { keywords: ['low', 'voltage', 'landscape', 'wire', '14/2', 'electrical'], title: 'Low-Voltage Landscape Wire 14/2 (500ft)', sku: '100903', price: 65.95, unit: 'roll' },
    { keywords: ['low', 'voltage', 'landscape', 'wire', '16/2', 'electrical'], title: 'Low-Voltage Landscape Wire 16/2 (500ft)', sku: '100904', price: 45.95, unit: 'roll' },
    { keywords: ['speaker', 'wire', '16', 'awg', 'electrical'], title: 'Speaker Wire 16 AWG (500ft)', sku: '100905', price: 35.95, unit: 'roll' },
    { keywords: ['speaker', 'wire', '14', 'awg', 'electrical'], title: 'Speaker Wire 14 AWG (500ft)', sku: '100906', price: 55.95, unit: 'roll' },
    { keywords: ['thermostat', 'wire', '18/5', 'electrical'], title: 'Thermostat Wire 18/5 (250ft)', sku: '100907', price: 45.95, unit: 'roll' },
    { keywords: ['data', 'cable', 'cat5e', 'electrical'], title: 'Cat5e Data Cable (1000ft)', sku: '100908', price: 125.95, unit: 'box' },
    { keywords: ['data', 'cable', 'cat6', 'electrical'], title: 'Cat6 Data Cable (1000ft)', sku: '100909', price: 155.95, unit: 'box' },
    { keywords: ['data', 'cable', 'cat6a', 'electrical'], title: 'Cat6a Data Cable (1000ft)', sku: '100910', price: 195.95, unit: 'box' },
    { keywords: ['coaxial', 'cable', 'rg6', 'electrical'], title: 'RG6 Coaxial Cable (500ft)', sku: '100911', price: 85.95, unit: 'roll' },
    { keywords: ['coaxial', 'cable', 'rg59', 'electrical'], title: 'RG59 Coaxial Cable (500ft)', sku: '100912', price: 65.95, unit: 'roll' },
    { keywords: ['ground', 'wire', 'bare', 'copper', '6', 'electrical'], title: 'Bare Copper Ground Wire #6 (100ft)', sku: '100913', price: 125.95, unit: 'roll' },
    { keywords: ['ground', 'wire', 'bare', 'copper', '8', 'electrical'], title: 'Bare Copper Ground Wire #8 (100ft)', sku: '100914', price: 85.95, unit: 'roll' },
    { keywords: ['ground', 'wire', 'bare', 'copper', '10', 'electrical'], title: 'Bare Copper Ground Wire #10 (100ft)', sku: '100915', price: 55.95, unit: 'roll' },
    { keywords: ['portable', 'cord', 'sjtw', '14/3', 'electrical'], title: 'Portable Cord SJTW 14/3 (50ft)', sku: '100916', price: 65.95, unit: 'roll' },
    { keywords: ['portable', 'cord', 'soow', '12/3', 'electrical'], title: 'Portable Cord SOOW 12/3 (50ft)', sku: '100917', price: 85.95, unit: 'roll' },
    
    // Electrical Materials - Boxes & Enclosures
    { keywords: ['plastic', 'remodel', 'box', '1', 'gang', 'electrical'], title: 'Plastic Remodel Box 1-Gang', sku: '100918', price: 3.95, unit: 'each' },
    { keywords: ['plastic', 'remodel', 'box', '2', 'gang', 'electrical'], title: 'Plastic Remodel Box 2-Gang', sku: '100919', price: 5.95, unit: 'each' },
    { keywords: ['plastic', 'remodel', 'box', '3', 'gang', 'electrical'], title: 'Plastic Remodel Box 3-Gang', sku: '100920', price: 8.95, unit: 'each' },
    { keywords: ['metal', 'switch', 'box', 'electrical'], title: 'Metal Switch Box', sku: '100921', price: 4.95, unit: 'each' },
    { keywords: ['ceiling', 'fan', 'rated', 'box', 'electrical'], title: 'Ceiling Fan-Rated Box', sku: '100922', price: 12.95, unit: 'each' },
    { keywords: ['weatherproof', 'exterior', 'box', '1', 'gang', 'electrical'], title: 'Weatherproof Exterior Box 1-Gang', sku: '100923', price: 8.95, unit: 'each' },
    { keywords: ['weatherproof', 'exterior', 'box', '2', 'gang', 'electrical'], title: 'Weatherproof Exterior Box 2-Gang', sku: '100924', price: 12.95, unit: 'each' },
    { keywords: ['junction', 'box', '4', 'square', 'electrical'], title: 'Junction Box 4" Square', sku: '100925', price: 6.95, unit: 'each' },
    { keywords: ['junction', 'box', '4-11/16', 'electrical'], title: 'Junction Box 4-11/16"', sku: '100926', price: 8.95, unit: 'each' },
    { keywords: ['octagon', 'box', 'light', 'fixture', 'electrical'], title: 'Octagon Box Light Fixture Mount', sku: '100927', price: 4.95, unit: 'each' },
    { keywords: ['floor', 'box', 'metal', 'electrical'], title: 'Floor Box Metal', sku: '100928', price: 35.95, unit: 'each' },
    { keywords: ['floor', 'box', 'pvc', 'electrical'], title: 'Floor Box PVC', sku: '100929', price: 25.95, unit: 'each' },
    { keywords: ['pvc', 'conduit', 'junction', 'box', 'electrical'], title: 'PVC Conduit Junction Box', sku: '100930', price: 12.95, unit: 'each' },
    { keywords: ['box', 'cover', 'blank', 'electrical'], title: 'Box Cover Blank', sku: '100931', price: 2.95, unit: 'each' },
    { keywords: ['box', 'cover', 'duplex', 'electrical'], title: 'Box Cover Duplex', sku: '100932', price: 3.95, unit: 'each' },
    { keywords: ['box', 'cover', 'switch', 'electrical'], title: 'Box Cover Switch', sku: '100933', price: 3.95, unit: 'each' },
    { keywords: ['extension', 'rings', 'electrical'], title: 'Extension Rings', sku: '100934', price: 4.95, unit: 'each' },
    { keywords: ['fan', 'support', 'braces', 'electrical'], title: 'Fan Support Braces', sku: '100935', price: 15.95, unit: 'each' },
    
    // Electrical Materials - Conduit & Raceway
    { keywords: ['pvc', 'conduit', '1/2', 'electrical'], title: 'PVC Conduit 1/2" (10ft)', sku: '100936', price: 4.95, unit: 'length' },
    { keywords: ['pvc', 'conduit', '3/4', 'electrical'], title: 'PVC Conduit 3/4" (10ft)', sku: '100937', price: 6.95, unit: 'length' },
    { keywords: ['pvc', 'conduit', '1', 'electrical'], title: 'PVC Conduit 1" (10ft)', sku: '100938', price: 8.95, unit: 'length' },
    { keywords: ['pvc', 'conduit', '1-1/4', 'electrical'], title: 'PVC Conduit 1-1/4" (10ft)', sku: '100939', price: 12.95, unit: 'length' },
    { keywords: ['pvc', 'conduit', '2', 'electrical'], title: 'PVC Conduit 2" (10ft)', sku: '100940', price: 18.95, unit: 'length' },
    { keywords: ['emt', 'conduit', '1/2', 'electrical'], title: 'EMT Conduit 1/2" (10ft)', sku: '100941', price: 5.95, unit: 'length' },
    { keywords: ['emt', 'conduit', '3/4', 'electrical'], title: 'EMT Conduit 3/4" (10ft)', sku: '100942', price: 7.95, unit: 'length' },
    { keywords: ['emt', 'conduit', '1', 'electrical'], title: 'EMT Conduit 1" (10ft)', sku: '100943', price: 9.95, unit: 'length' },
    { keywords: ['emt', 'conduit', '1-1/4', 'electrical'], title: 'EMT Conduit 1-1/4" (10ft)', sku: '100944', price: 14.95, unit: 'length' },
    { keywords: ['emt', 'conduit', '2', 'electrical'], title: 'EMT Conduit 2" (10ft)', sku: '100945', price: 22.95, unit: 'length' },
    { keywords: ['rigid', 'metal', 'conduit', 'rmc', 'electrical'], title: 'Rigid Metal Conduit RMC (10ft)', sku: '100946', price: 25.95, unit: 'length' },
    { keywords: ['flexible', 'metal', 'conduit', 'fmc', 'electrical'], title: 'Flexible Metal Conduit FMC (25ft)', sku: '100947', price: 45.95, unit: 'roll' },
    { keywords: ['liquidtight', 'flexible', 'conduit', 'lfmc', 'electrical'], title: 'Liquidtight Flexible Conduit LFMC (25ft)', sku: '100948', price: 65.95, unit: 'roll' },
    { keywords: ['ent', 'conduit', 'smurf', 'tube', 'electrical'], title: 'ENT Conduit Smurf Tube (100ft)', sku: '100949', price: 35.95, unit: 'roll' },
    { keywords: ['conduit', 'fittings', 'couplings', 'electrical'], title: 'Conduit Fittings Couplings', sku: '100950', price: 3.95, unit: 'each' },
    { keywords: ['conduit', 'fittings', 'connectors', 'electrical'], title: 'Conduit Fittings Connectors', sku: '100951', price: 4.95, unit: 'each' },
    { keywords: ['conduit', 'fittings', 'elbows', 'electrical'], title: 'Conduit Fittings Elbows', sku: '100952', price: 6.95, unit: 'each' },
    { keywords: ['pvc', 'boxes', 'fittings', 'electrical'], title: 'PVC Boxes and Fittings', sku: '100953', price: 8.95, unit: 'each' },
    { keywords: ['conduit', 'straps', 'clamps', 'electrical'], title: 'Conduit Straps and Clamps', sku: '100954', price: 2.95, unit: 'each' },
    { keywords: ['offset', 'fittings', 'electrical'], title: 'Offset Fittings', sku: '100955', price: 8.95, unit: 'each' },
    { keywords: ['set', 'screw', 'connectors', 'electrical'], title: 'Set-Screw Connectors', sku: '100956', price: 5.95, unit: 'each' },
    { keywords: ['threaded', 'hubs', 'electrical'], title: 'Threaded Hubs', sku: '100957', price: 12.95, unit: 'each' },
    { keywords: ['locknuts', 'electrical'], title: 'Locknuts', sku: '100958', price: 1.95, unit: 'each' },
    { keywords: ['pull', 'elbows', 'electrical'], title: 'Pull Elbows', sku: '100959', price: 15.95, unit: 'each' },
    { keywords: ['lb', 'fittings', 'electrical'], title: 'LB Fittings', sku: '100960', price: 18.95, unit: 'each' },
    { keywords: ['conduit', 'expansion', 'joints', 'electrical'], title: 'Conduit Expansion Joints', sku: '100961', price: 25.95, unit: 'each' },
    
    // Electrical Materials - Outlets, Switches & Devices
    { keywords: ['standard', 'duplex', 'outlet', '15a', 'electrical'], title: 'Standard Duplex Outlet 15A', sku: '100962', price: 3.95, unit: 'each' },
    { keywords: ['standard', 'duplex', 'outlet', '20a', 'electrical'], title: 'Standard Duplex Outlet 20A', sku: '100963', price: 4.95, unit: 'each' },
    { keywords: ['decorator', 'outlet', 'decora', 'electrical'], title: 'Decorator Outlet Decora Style', sku: '100964', price: 6.95, unit: 'each' },
    { keywords: ['gfci', 'outlet', '15a', 'indoor', 'electrical'], title: 'GFCI Outlet 15A Indoor', sku: '100965', price: 18.95, unit: 'each' },
    { keywords: ['gfci', 'outlet', '20a', 'outdoor', 'electrical'], title: 'GFCI Outlet 20A Outdoor Rated', sku: '100966', price: 22.95, unit: 'each' },
    { keywords: ['afci', 'outlet', 'arc', 'fault', 'electrical'], title: 'AFCI Outlet Arc-Fault', sku: '100967', price: 25.95, unit: 'each' },
    { keywords: ['tamper', 'resistant', 'outlet', 'tr', 'electrical'], title: 'Tamper-Resistant Outlet TR', sku: '100968', price: 8.95, unit: 'each' },
    { keywords: ['usb', 'combination', 'outlet', 'type', 'a', 'electrical'], title: 'USB Combination Outlet Type A', sku: '100969', price: 35.95, unit: 'each' },
    { keywords: ['usb', 'combination', 'outlet', 'type', 'c', 'electrical'], title: 'USB Combination Outlet Type C', sku: '100970', price: 42.95, unit: 'each' },
    { keywords: ['smart', 'outlet', 'wi-fi', 'electrical'], title: 'Smart Outlet Wi-Fi', sku: '100971', price: 55.95, unit: 'each' },
    { keywords: ['smart', 'outlet', 'z-wave', 'electrical'], title: 'Smart Outlet Z-Wave', sku: '100972', price: 65.95, unit: 'each' },
    { keywords: ['light', 'switch', 'single', 'pole', 'electrical'], title: 'Light Switch Single Pole', sku: '100973', price: 4.95, unit: 'each' },
    { keywords: ['light', 'switch', '3-way', 'electrical'], title: 'Light Switch 3-Way', sku: '100974', price: 6.95, unit: 'each' },
    { keywords: ['light', 'switch', '4-way', 'electrical'], title: 'Light Switch 4-Way', sku: '100975', price: 8.95, unit: 'each' },
    { keywords: ['dimmer', 'switch', 'led', 'electrical'], title: 'Dimmer Switch LED', sku: '100976', price: 25.95, unit: 'each' },
    { keywords: ['dimmer', 'switch', 'cfl', 'electrical'], title: 'Dimmer Switch CFL', sku: '100977', price: 18.95, unit: 'each' },
    { keywords: ['dimmer', 'switch', 'incandescent', 'electrical'], title: 'Dimmer Switch Incandescent', sku: '100978', price: 12.95, unit: 'each' },
    { keywords: ['motion', 'sensor', 'switch', 'electrical'], title: 'Motion Sensor Switch', sku: '100979', price: 35.95, unit: 'each' },
    { keywords: ['timer', 'switch', 'mechanical', 'electrical'], title: 'Timer Switch Mechanical', sku: '100980', price: 22.95, unit: 'each' },
    { keywords: ['timer', 'switch', 'digital', 'electrical'], title: 'Timer Switch Digital', sku: '100981', price: 28.95, unit: 'each' },
    { keywords: ['smart', 'switch', 'app', 'controlled', 'electrical'], title: 'Smart Switch App-Controlled', sku: '100982', price: 45.95, unit: 'each' },
    { keywords: ['weather', 'resistant', 'outlet', 'electrical'], title: 'Weather-Resistant Outlet', sku: '100983', price: 18.95, unit: 'each' },
    { keywords: ['weather', 'resistant', 'cover', 'electrical'], title: 'Weather-Resistant Cover', sku: '100984', price: 8.95, unit: 'each' },
    { keywords: ['floor', 'outlet', 'electrical'], title: 'Floor Outlet', sku: '100985', price: 45.95, unit: 'each' },
    { keywords: ['pop', 'up', 'outlet', 'electrical'], title: 'Pop-Up Outlet', sku: '100986', price: 65.95, unit: 'each' },
    { keywords: ['receptacle', 'wall', 'plate', 'nylon', 'electrical'], title: 'Receptacle Wall Plate Nylon', sku: '100987', price: 1.95, unit: 'each' },
    { keywords: ['receptacle', 'wall', 'plate', 'stainless', 'electrical'], title: 'Receptacle Wall Plate Stainless', sku: '100988', price: 4.95, unit: 'each' },
    { keywords: ['receptacle', 'wall', 'plate', 'decorative', 'electrical'], title: 'Receptacle Wall Plate Decorative', sku: '100989', price: 8.95, unit: 'each' },
    
    // Plumbing Materials - PEX Tubing Systems
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '3/8', 'plumbing'], title: 'PEX-A Expansion Tubing 3/8" (100ft)', sku: '100990', price: 45.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '1/2', 'plumbing'], title: 'PEX-A Expansion Tubing 1/2" (100ft)', sku: '100991', price: 65.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '5/8', 'plumbing'], title: 'PEX-A Expansion Tubing 5/8" (100ft)', sku: '100992', price: 85.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '3/4', 'plumbing'], title: 'PEX-A Expansion Tubing 3/4" (100ft)', sku: '100993', price: 95.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '1', 'plumbing'], title: 'PEX-A Expansion Tubing 1" (100ft)', sku: '100994', price: 125.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'uponor', 'wirsbo', '1-1/4', 'plumbing'], title: 'PEX-A Expansion Tubing 1-1/4" (100ft)', sku: '100995', price: 155.95, unit: 'roll' },
    { keywords: ['pex', 'pex-b', 'crimp', 'clamp', '3/8', 'plumbing'], title: 'PEX-B Crimp Tubing 3/8" (100ft)', sku: '100996', price: 35.95, unit: 'roll' },
    { keywords: ['pex', 'pex-b', 'crimp', 'clamp', '1/2', 'plumbing'], title: 'PEX-B Crimp Tubing 1/2" (100ft)', sku: '100997', price: 55.95, unit: 'roll' },
    { keywords: ['pex', 'pex-b', 'crimp', 'clamp', '3/4', 'plumbing'], title: 'PEX-B Crimp Tubing 3/4" (100ft)', sku: '100998', price: 75.95, unit: 'roll' },
    { keywords: ['pex', 'pex-b', 'crimp', 'clamp', '1', 'plumbing'], title: 'PEX-B Crimp Tubing 1" (100ft)', sku: '100999', price: 95.95, unit: 'roll' },
    { keywords: ['pex', 'pex-b', 'crimp', 'clamp', '1-1/4', 'plumbing'], title: 'PEX-B Crimp Tubing 1-1/4" (100ft)', sku: '101000', price: 125.95, unit: 'roll' },
    { keywords: ['pex', 'pex-c', 'cold', 'formed', '3/8', 'plumbing'], title: 'PEX-C Cold-Formed Tubing 3/8" (100ft)', sku: '101001', price: 32.95, unit: 'roll' },
    { keywords: ['pex', 'pex-c', 'cold', 'formed', '1/2', 'plumbing'], title: 'PEX-C Cold-Formed Tubing 1/2" (100ft)', sku: '101002', price: 45.95, unit: 'roll' },
    { keywords: ['pex', 'pex-c', 'cold', 'formed', '3/4', 'plumbing'], title: 'PEX-C Cold-Formed Tubing 3/4" (100ft)', sku: '101003', price: 65.95, unit: 'roll' },
    { keywords: ['pex', 'pex-c', 'cold', 'formed', '1', 'plumbing'], title: 'PEX-C Cold-Formed Tubing 1" (100ft)', sku: '101004', price: 85.95, unit: 'roll' },
    { keywords: ['pex', 'oxygen', 'barrier', 'pex-a', 'radiant', 'heating', 'plumbing'], title: 'Oxygen-Barrier PEX-A for Radiant Heating (100ft)', sku: '101005', price: 95.95, unit: 'roll' },
    { keywords: ['pex', 'pex-a', 'expansion', 'fittings', 'plumbing'], title: 'PEX-A Expansion Fittings', sku: '101006', price: 15.95, unit: 'each' },
    { keywords: ['pex', 'pex-a', 'expansion', 'sleeves', 'plumbing'], title: 'PEX-A Expansion Sleeves', sku: '101007', price: 8.95, unit: 'each' },
    { keywords: ['pex', 'pex-a', 'expansion', 'rings', 'plumbing'], title: 'PEX-A Expansion Rings', sku: '101008', price: 12.95, unit: 'each' },
    { keywords: ['pex', 'pex-b', 'crimp', 'rings', 'copper', 'plumbing'], title: 'PEX-B Crimp Rings Copper (100ct)', sku: '101009', price: 18.95, unit: 'pack' },
    { keywords: ['pex', 'pex-b', 'crimp', 'rings', 'stainless', 'plumbing'], title: 'PEX-B Crimp Rings Stainless (100ct)', sku: '101010', price: 22.95, unit: 'pack' },
    { keywords: ['pex', 'pex-b', 'crimp', 'tools', 'plumbing'], title: 'PEX-B Crimp Tools', sku: '101011', price: 125.95, unit: 'set' },
    { keywords: ['pex', 'pex-a', 'expansion', 'tools', 'manual', 'plumbing'], title: 'PEX-A Expansion Tools Manual', sku: '101012', price: 185.95, unit: 'set' },
    { keywords: ['pex', 'pex-a', 'expansion', 'tools', 'power', 'plumbing'], title: 'PEX-A Expansion Tools Power', sku: '101013', price: 285.95, unit: 'set' },
    { keywords: ['pex', 'manifolds', 'home', 'run', 'plumbing'], title: 'PEX Manifolds Home-Run Systems', sku: '101014', price: 125.95, unit: 'each' },
    { keywords: ['pex', 'stub', 'outs', 'transition', 'fittings', 'plumbing'], title: 'PEX Stub-Outs & Transition Fittings', sku: '101015', price: 8.95, unit: 'each' },
    
    // Plumbing Materials - PVC, CPVC, ABS, Copper, and Other Pipe
    { keywords: ['pvc', 'sch40', 'pipe', '1/2', 'plumbing'], title: 'PVC Sch.40 Pipe 1/2" (10ft)', sku: '101016', price: 8.95, unit: 'length' },
    { keywords: ['pvc', 'sch40', 'pipe', '3/4', 'plumbing'], title: 'PVC Sch.40 Pipe 3/4" (10ft)', sku: '101017', price: 12.95, unit: 'length' },
    { keywords: ['pvc', 'sch40', 'pipe', '1', 'plumbing'], title: 'PVC Sch.40 Pipe 1" (10ft)', sku: '101018', price: 18.95, unit: 'length' },
    { keywords: ['pvc', 'sch40', 'pipe', '1-1/4', 'plumbing'], title: 'PVC Sch.40 Pipe 1-1/4" (10ft)', sku: '101019', price: 22.95, unit: 'length' },
    { keywords: ['pvc', 'sch40', 'pipe', '1-1/2', 'plumbing'], title: 'PVC Sch.40 Pipe 1-1/2" (10ft)', sku: '101020', price: 28.95, unit: 'length' },
    { keywords: ['pvc', 'sch40', 'pipe', '2', 'plumbing'], title: 'PVC Sch.40 Pipe 2" (10ft)', sku: '101021', price: 35.95, unit: 'length' },
    { keywords: ['pvc', 'sch80', 'pipe', '1/2', 'plumbing'], title: 'PVC Sch.80 Pipe 1/2" (10ft)', sku: '101022', price: 12.95, unit: 'length' },
    { keywords: ['pvc', 'sch80', 'pipe', '3/4', 'plumbing'], title: 'PVC Sch.80 Pipe 3/4" (10ft)', sku: '101023', price: 18.95, unit: 'length' },
    { keywords: ['pvc', 'sch80', 'pipe', '1', 'plumbing'], title: 'PVC Sch.80 Pipe 1" (10ft)', sku: '101024', price: 25.95, unit: 'length' },
    { keywords: ['cpvc', 'hot', 'cold', 'pipe', '1/2', 'plumbing'], title: 'CPVC Hot/Cold Pipe 1/2" (10ft)', sku: '101025', price: 15.95, unit: 'length' },
    { keywords: ['cpvc', 'hot', 'cold', 'pipe', '3/4', 'plumbing'], title: 'CPVC Hot/Cold Pipe 3/4" (10ft)', sku: '101026', price: 22.95, unit: 'length' },
    { keywords: ['cpvc', 'hot', 'cold', 'pipe', '1', 'plumbing'], title: 'CPVC Hot/Cold Pipe 1" (10ft)', sku: '101027', price: 32.95, unit: 'length' },
    { keywords: ['abs', 'dwv', 'pipe', '1-1/4', 'plumbing'], title: 'ABS DWV Pipe 1-1/4" (10ft)', sku: '101028', price: 8.95, unit: 'length' },
    { keywords: ['abs', 'dwv', 'pipe', '1-1/2', 'plumbing'], title: 'ABS DWV Pipe 1-1/2" (10ft)', sku: '101029', price: 12.95, unit: 'length' },
    { keywords: ['abs', 'dwv', 'pipe', '2', 'plumbing'], title: 'ABS DWV Pipe 2" (10ft)', sku: '101030', price: 18.95, unit: 'length' },
    { keywords: ['abs', 'dwv', 'pipe', '3', 'plumbing'], title: 'ABS DWV Pipe 3" (10ft)', sku: '101031', price: 28.95, unit: 'length' },
    { keywords: ['abs', 'dwv', 'pipe', '4', 'plumbing'], title: 'ABS DWV Pipe 4" (10ft)', sku: '101032', price: 45.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'm', '1/2', 'plumbing'], title: 'Copper Pipe Type M 1/2" (10ft)', sku: '101033', price: 25.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'm', '3/4', 'plumbing'], title: 'Copper Pipe Type M 3/4" (10ft)', sku: '101034', price: 35.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'l', '1/2', 'plumbing'], title: 'Copper Pipe Type L 1/2" (10ft)', sku: '101035', price: 32.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'l', '3/4', 'plumbing'], title: 'Copper Pipe Type L 3/4" (10ft)', sku: '101036', price: 45.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'k', '1/2', 'plumbing'], title: 'Copper Pipe Type K 1/2" (10ft)', sku: '101037', price: 42.95, unit: 'length' },
    { keywords: ['copper', 'pipe', 'type', 'k', '3/4', 'plumbing'], title: 'Copper Pipe Type K 3/4" (10ft)', sku: '101038', price: 65.95, unit: 'length' },
    { keywords: ['brass', 'pipe', '1/2', 'plumbing'], title: 'Brass Pipe 1/2" (10ft)', sku: '101039', price: 55.95, unit: 'length' },
    { keywords: ['brass', 'pipe', '3/4', 'plumbing'], title: 'Brass Pipe 3/4" (10ft)', sku: '101040', price: 85.95, unit: 'length' },
    { keywords: ['brass', 'pipe', '1', 'plumbing'], title: 'Brass Pipe 1" (10ft)', sku: '101041', price: 125.95, unit: 'length' },
    { keywords: ['black', 'iron', 'pipe', 'gas', '1/2', 'plumbing'], title: 'Black Iron Pipe Gas 1/2" (10ft)', sku: '101042', price: 18.95, unit: 'length' },
    { keywords: ['black', 'iron', 'pipe', 'gas', '3/4', 'plumbing'], title: 'Black Iron Pipe Gas 3/4" (10ft)', sku: '101043', price: 25.95, unit: 'length' },
    { keywords: ['black', 'iron', 'pipe', 'gas', '1', 'plumbing'], title: 'Black Iron Pipe Gas 1" (10ft)', sku: '101044', price: 35.95, unit: 'length' },
    { keywords: ['galvanized', 'steel', 'pipe', '1/2', 'plumbing'], title: 'Galvanized Steel Pipe 1/2" (10ft)', sku: '101045', price: 22.95, unit: 'length' },
    { keywords: ['galvanized', 'steel', 'pipe', '3/4', 'plumbing'], title: 'Galvanized Steel Pipe 3/4" (10ft)', sku: '101046', price: 32.95, unit: 'length' },
    { keywords: ['galvanized', 'steel', 'pipe', '1', 'plumbing'], title: 'Galvanized Steel Pipe 1" (10ft)', sku: '101047', price: 45.95, unit: 'length' },
    { keywords: ['stainless', 'pipe', '304', '1/2', 'plumbing'], title: 'Stainless Pipe 304 1/2" (10ft)', sku: '101048', price: 65.95, unit: 'length' },
    { keywords: ['stainless', 'pipe', '316', '1/2', 'plumbing'], title: 'Stainless Pipe 316 1/2" (10ft)', sku: '101049', price: 85.95, unit: 'length' },
    { keywords: ['cast', 'iron', 'no', 'hub', 'service', 'pipe', '2', 'plumbing'], title: 'Cast-Iron No-Hub Service Pipe 2" (10ft)', sku: '101050', price: 95.95, unit: 'length' },
    { keywords: ['cast', 'iron', 'no', 'hub', 'service', 'pipe', '3', 'plumbing'], title: 'Cast-Iron No-Hub Service Pipe 3" (10ft)', sku: '101051', price: 125.95, unit: 'length' },
    { keywords: ['cast', 'iron', 'no', 'hub', 'service', 'pipe', '4', 'plumbing'], title: 'Cast-Iron No-Hub Service Pipe 4" (10ft)', sku: '101052', price: 185.95, unit: 'length' },
    { keywords: ['flexible', 'pvc', 'spa', 'irrigation', 'pipe', '1/2', 'plumbing'], title: 'Flexible PVC Spa/Irrigation Pipe 1/2" (100ft)', sku: '101053', price: 45.95, unit: 'roll' },
    { keywords: ['flexible', 'pvc', 'spa', 'irrigation', 'pipe', '3/4', 'plumbing'], title: 'Flexible PVC Spa/Irrigation Pipe 3/4" (100ft)', sku: '101054', price: 65.95, unit: 'roll' },
    { keywords: ['flexible', 'pvc', 'spa', 'irrigation', 'pipe', '1', 'plumbing'], title: 'Flexible PVC Spa/Irrigation Pipe 1" (100ft)', sku: '101055', price: 85.95, unit: 'roll' },
    { keywords: ['flexible', 'pvc', 'spa', 'irrigation', 'pipe', '2', 'plumbing'], title: 'Flexible PVC Spa/Irrigation Pipe 2" (100ft)', sku: '101056', price: 125.95, unit: 'roll' },
    
    // Plumbing Materials - Fittings & Couplings
    { keywords: ['pvc', 'couplers', 'plumbing'], title: 'PVC Couplers', sku: '101057', price: 2.95, unit: 'each' },
    { keywords: ['pvc', '45', 'degree', 'elbow', 'plumbing'], title: 'PVC 45° Elbow', sku: '101058', price: 3.95, unit: 'each' },
    { keywords: ['pvc', '90', 'degree', 'elbow', 'plumbing'], title: 'PVC 90° Elbow', sku: '101059', price: 4.95, unit: 'each' },
    { keywords: ['pvc', 'tee', 'plumbing'], title: 'PVC Tee', sku: '101060', price: 5.95, unit: 'each' },
    { keywords: ['pvc', 'wye', 'plumbing'], title: 'PVC Wye', sku: '101061', price: 6.95, unit: 'each' },
    { keywords: ['pvc', 'caps', 'plumbing'], title: 'PVC Caps', sku: '101062', price: 2.95, unit: 'each' },
    { keywords: ['pvc', 'adapters', 'plumbing'], title: 'PVC Adapters', sku: '101063', price: 4.95, unit: 'each' },
    { keywords: ['cpvc', 'couplers', 'plumbing'], title: 'CPVC Couplers', sku: '101064', price: 3.95, unit: 'each' },
    { keywords: ['cpvc', 'elbow', '90', 'plumbing'], title: 'CPVC 90° Elbow', sku: '101065', price: 5.95, unit: 'each' },
    { keywords: ['cpvc', 'tee', 'plumbing'], title: 'CPVC Tee', sku: '101066', price: 6.95, unit: 'each' },
    { keywords: ['abs', 'couplers', 'plumbing'], title: 'ABS Couplers', sku: '101067', price: 3.95, unit: 'each' },
    { keywords: ['abs', 'elbow', '90', 'plumbing'], title: 'ABS 90° Elbow', sku: '101068', price: 4.95, unit: 'each' },
    { keywords: ['abs', 'tee', 'plumbing'], title: 'ABS Tee', sku: '101069', price: 5.95, unit: 'each' },
    { keywords: ['copper', 'sweat', 'fittings', 'plumbing'], title: 'Copper Sweat Fittings', sku: '101070', price: 8.95, unit: 'each' },
    { keywords: ['copper', 'press', 'fittings', 'plumbing'], title: 'Copper Press Fittings', sku: '101071', price: 12.95, unit: 'each' },
    { keywords: ['copper', 'push', 'fit', 'fittings', 'plumbing'], title: 'Copper Push-Fit Fittings', sku: '101072', price: 15.95, unit: 'each' },
    { keywords: ['brass', 'elbow', 'plumbing'], title: 'Brass Elbow', sku: '101073', price: 8.95, unit: 'each' },
    { keywords: ['brass', 'bushing', 'plumbing'], title: 'Brass Bushing', sku: '101074', price: 6.95, unit: 'each' },
    { keywords: ['brass', 'adapter', 'plumbing'], title: 'Brass Adapter', sku: '101075', price: 10.95, unit: 'each' },
    { keywords: ['brass', 'coupling', 'plumbing'], title: 'Brass Coupling', sku: '101076', price: 12.95, unit: 'each' },
    { keywords: ['galvanized', 'elbow', 'plumbing'], title: 'Galvanized Elbow', sku: '101077', price: 6.95, unit: 'each' },
    { keywords: ['galvanized', 'nipple', 'plumbing'], title: 'Galvanized Nipple', sku: '101078', price: 4.95, unit: 'each' },
    { keywords: ['galvanized', 'tee', 'plumbing'], title: 'Galvanized Tee', sku: '101079', price: 8.95, unit: 'each' },
    { keywords: ['galvanized', 'union', 'plumbing'], title: 'Galvanized Union', sku: '101080', price: 12.95, unit: 'each' },
    { keywords: ['black', 'iron', 'elbow', 'plumbing'], title: 'Black Iron Elbow', sku: '101081', price: 5.95, unit: 'each' },
    { keywords: ['black', 'iron', 'tee', 'plumbing'], title: 'Black Iron Tee', sku: '101082', price: 7.95, unit: 'each' },
    { keywords: ['cast', 'iron', 'no', 'hub', 'coupling', 'plumbing'], title: 'Cast-Iron No-Hub Coupling', sku: '101083', price: 25.95, unit: 'each' },
    { keywords: ['fernco', 'rubber', 'coupling', 'plumbing'], title: 'Fernco Rubber Coupling', sku: '101084', price: 8.95, unit: 'each' },
    { keywords: ['fernco', 'rubber', 'transition', 'plumbing'], title: 'Fernco Rubber Transition', sku: '101085', price: 12.95, unit: 'each' },
    { keywords: ['sharkbite', 'push', 'connect', 'straight', 'plumbing'], title: 'SharkBite Push-Connect Straight', sku: '101086', price: 18.95, unit: 'each' },
    { keywords: ['sharkbite', 'push', 'connect', 'tee', 'plumbing'], title: 'SharkBite Push-Connect Tee', sku: '101087', price: 25.95, unit: 'each' },
    { keywords: ['sharkbite', 'push', 'connect', 'elbow', 'plumbing'], title: 'SharkBite Push-Connect Elbow', sku: '101088', price: 22.95, unit: 'each' },
    { keywords: ['sharkbite', 'push', 'connect', 'valve', 'plumbing'], title: 'SharkBite Push-Connect Valve', sku: '101089', price: 35.95, unit: 'each' },
    { keywords: ['compression', 'fittings', 'supply', 'lines', 'plumbing'], title: 'Compression Fittings Supply Lines', sku: '101090', price: 8.95, unit: 'each' },
    { keywords: ['pex', 'expansion', 'fittings', 'pex-a', 'plumbing'], title: 'Expansion Fittings PEX-A', sku: '101091', price: 15.95, unit: 'each' },
    { keywords: ['press', 'fit', 'stainless', 'fittings', 'plumbing'], title: 'Press-Fit Stainless Fittings', sku: '101092', price: 18.95, unit: 'each' },
    { keywords: ['press', 'fit', 'copper', 'fittings', 'plumbing'], title: 'Press-Fit Copper Fittings', sku: '101093', price: 15.95, unit: 'each' },
    { keywords: ['dielectric', 'unions', 'plumbing'], title: 'Dielectric Unions', sku: '101094', price: 22.95, unit: 'each' },
    
    // Plumbing Materials - Valves & Controls
    { keywords: ['ball', 'valve', 'brass', 'plumbing'], title: 'Ball Valve Brass', sku: '101095', price: 25.95, unit: 'each' },
    { keywords: ['ball', 'valve', 'pvc', 'plumbing'], title: 'Ball Valve PVC', sku: '101096', price: 15.95, unit: 'each' },
    { keywords: ['pex', 'ball', 'valve', 'pex', 'plumbing'], title: 'Ball Valve PEX', sku: '101097', price: 18.95, unit: 'each' },
    { keywords: ['ball', 'valve', 'stainless', 'plumbing'], title: 'Ball Valve Stainless', sku: '101098', price: 35.95, unit: 'each' },
    { keywords: ['gate', 'valve', 'plumbing'], title: 'Gate Valve', sku: '101099', price: 28.95, unit: 'each' },
    { keywords: ['globe', 'valve', 'plumbing'], title: 'Globe Valve', sku: '101100', price: 32.95, unit: 'each' },
    { keywords: ['check', 'valve', 'plumbing'], title: 'Check Valve', sku: '101101', price: 22.95, unit: 'each' },
    { keywords: ['stop', 'valve', 'plumbing'], title: 'Stop Valve', sku: '101102', price: 18.95, unit: 'each' },
    { keywords: ['frost', 'proof', 'sillcock', 'hose', 'bibb', 'plumbing'], title: 'Frost-Proof Sillcock Hose Bibb', sku: '101103', price: 45.95, unit: 'each' },
    { keywords: ['boiler', 'drain', 'valve', 'plumbing'], title: 'Boiler Drain Valve', sku: '101104', price: 25.95, unit: 'each' },
    { keywords: ['gas', 'shut', 'off', 'valve', 'plumbing'], title: 'Gas Shut-Off Valve', sku: '101105', price: 35.95, unit: 'each' },
    { keywords: ['pressure', 'reducing', 'valve', 'prv', 'plumbing'], title: 'Pressure-Reducing Valve PRV', sku: '101106', price: 85.95, unit: 'each' },
    { keywords: ['thermostatic', 'mixing', 'valve', 'plumbing'], title: 'Thermostatic Mixing Valve', sku: '101107', price: 125.95, unit: 'each' },
    { keywords: ['anti', 'scald', 'valve', 'plumbing'], title: 'Anti-Scald Valve', sku: '101108', price: 95.95, unit: 'each' },
    { keywords: ['backflow', 'preventer', 'plumbing'], title: 'Backflow Preventer', sku: '101109', price: 155.95, unit: 'each' },
    { keywords: ['stop', 'waste', 'valve', 'irrigation', 'plumbing'], title: 'Stop-and-Waste Valve Irrigation', sku: '101110', price: 35.95, unit: 'each' },
    { keywords: ['zone', 'manifold', 'valve', 'hydronic', 'plumbing'], title: 'Zone & Manifold Valve Hydronic', sku: '101111', price: 125.95, unit: 'each' },
    { keywords: ['pex', 'zone', 'manifold', 'valve', 'pex', 'plumbing'], title: 'Zone & Manifold Valve PEX', sku: '101112', price: 95.95, unit: 'each' },
    
    // Plumbing Materials - Adhesives, Sealants & Tapes
    { keywords: ['pvc', 'primer', 'clear', 'plumbing'], title: 'PVC Primer Clear', sku: '101113', price: 8.95, unit: 'bottle' },
    { keywords: ['pvc', 'primer', 'purple', 'plumbing'], title: 'PVC Primer Purple', sku: '101114', price: 8.95, unit: 'bottle' },
    { keywords: ['pvc', 'solvent', 'cement', 'regular', 'plumbing'], title: 'PVC Solvent Cement Regular', sku: '101115', price: 6.95, unit: 'bottle' },
    { keywords: ['pvc', 'solvent', 'cement', 'heavy', 'duty', 'plumbing'], title: 'PVC Solvent Cement Heavy-Duty', sku: '101116', price: 8.95, unit: 'bottle' },
    { keywords: ['cpvc', 'solvent', 'cement', 'plumbing'], title: 'CPVC Solvent Cement', sku: '101117', price: 7.95, unit: 'bottle' },
    { keywords: ['abs', 'solvent', 'cement', 'plumbing'], title: 'ABS Solvent Cement', sku: '101118', price: 6.95, unit: 'bottle' },
    { keywords: ['multi', 'purpose', 'cement', 'plumbing'], title: 'Multi-Purpose Cement', sku: '101119', price: 8.95, unit: 'bottle' },
    { keywords: ['ptfe', 'tape', 'white', 'water', 'plumbing'], title: 'PTFE Tape White Water', sku: '101120', price: 3.95, unit: 'roll' },
    { keywords: ['ptfe', 'tape', 'yellow', 'gas', 'plumbing'], title: 'PTFE Tape Yellow Gas', sku: '101121', price: 4.95, unit: 'roll' },
    { keywords: ['ptfe', 'tape', 'pink', 'heavy', 'duty', 'plumbing'], title: 'PTFE Tape Pink Heavy-Duty', sku: '101122', price: 5.95, unit: 'roll' },
    { keywords: ['pipe', 'thread', 'sealant', 'teflon', 'paste', 'plumbing'], title: 'Pipe Thread Sealant Teflon Paste', sku: '101123', price: 6.95, unit: 'tube' },
    { keywords: ['pipe', 'dope', 'joint', 'compound', 'plumbing'], title: 'Pipe Dope Joint Compound', sku: '101124', price: 5.95, unit: 'tube' },
    { keywords: ['silicone', 'sealant', 'kitchen', 'bath', 'plumbing'], title: 'Silicone Sealant Kitchen/Bath', sku: '101125', price: 8.95, unit: 'tube' },
    { keywords: ['leak', 'repair', 'epoxy', 'putty', 'plumbing'], title: 'Leak-Repair Epoxy Putty', sku: '101126', price: 12.95, unit: 'tube' },
    { keywords: ['plumber', 'grease', 'plumbing'], title: 'Plumber Grease', sku: '101127', price: 6.95, unit: 'tube' },
    { keywords: ['plumber', 'putty', 'plumbing'], title: 'Plumber Putty', sku: '101128', price: 4.95, unit: 'tube' },
    
    // Plumbing Materials - Drain, Waste & Vent (DWV)
    { keywords: ['p', 'trap', 'pvc', 'drain', 'plumbing'], title: 'P-Trap PVC Drain', sku: '101129', price: 12.95, unit: 'each' },
    { keywords: ['s', 'trap', 'pvc', 'drain', 'plumbing'], title: 'S-Trap PVC Drain', sku: '101130', price: 14.95, unit: 'each' },
    { keywords: ['bottle', 'trap', 'pvc', 'drain', 'plumbing'], title: 'Bottle Trap PVC Drain', sku: '101131', price: 18.95, unit: 'each' },
    { keywords: ['p', 'trap', 'brass', 'drain', 'plumbing'], title: 'P-Trap Brass Drain', sku: '101132', price: 25.95, unit: 'each' },
    { keywords: ['p', 'trap', 'chrome', 'drain', 'plumbing'], title: 'P-Trap Chrome Drain', sku: '101133', price: 35.95, unit: 'each' },
    { keywords: ['drain', 'extension', 'tailpiece', 'plumbing'], title: 'Drain Extension Tailpiece', sku: '101134', price: 8.95, unit: 'each' },
    { keywords: ['cleanout', 'plug', 'pvc', 'plumbing'], title: 'Cleanout Plug PVC', sku: '101135', price: 4.95, unit: 'each' },
    { keywords: ['cleanout', 'plug', 'brass', 'plumbing'], title: 'Cleanout Plug Brass', sku: '101136', price: 6.95, unit: 'each' },
    { keywords: ['sanitary', 'tee', 'pvc', 'plumbing'], title: 'Sanitary Tee PVC', sku: '101137', price: 8.95, unit: 'each' },
    { keywords: ['sanitary', 'wye', 'pvc', 'plumbing'], title: 'Sanitary Wye PVC', sku: '101138', price: 9.95, unit: 'each' },
    { keywords: ['long', 'sweep', 'elbow', 'pvc', 'plumbing'], title: 'Long Sweep Elbow PVC', sku: '101139', price: 12.95, unit: 'each' },
    { keywords: ['air', 'admittance', 'valve', 'aav', 'plumbing'], title: 'Air Admittance Valve AAV', sku: '101140', price: 18.95, unit: 'each' },
    { keywords: ['studor', 'vent', 'plumbing'], title: 'Studor Vent Valve', sku: '101141', price: 22.95, unit: 'each' },
    { keywords: ['floor', 'drain', 'pvc', 'plumbing'], title: 'Floor Drain PVC', sku: '101142', price: 45.95, unit: 'each' },
    { keywords: ['shower', 'drain', 'pvc', 'plumbing'], title: 'Shower Drain PVC', sku: '101143', price: 35.95, unit: 'each' },
    { keywords: ['shower', 'drain', 'stainless', 'plumbing'], title: 'Shower Drain Stainless', sku: '101144', price: 65.95, unit: 'each' },
    { keywords: ['tub', 'drain', 'overflow', 'plumbing'], title: 'Tub Drain & Overflow', sku: '101145', price: 25.95, unit: 'each' },
    { keywords: ['toilet', 'flange', 'pvc', 'plumbing'], title: 'Toilet Flange PVC', sku: '101146', price: 15.95, unit: 'each' },
    { keywords: ['toilet', 'flange', 'cast', 'iron', 'plumbing'], title: 'Toilet Flange Cast Iron', sku: '101147', price: 35.95, unit: 'each' },
    { keywords: ['wax', 'ring', 'toilet', 'plumbing'], title: 'Wax Ring Toilet', sku: '101148', price: 3.95, unit: 'each' },
    { keywords: ['toilet', 'gasket', 'rubber', 'plumbing'], title: 'Toilet Gasket Rubber', sku: '101149', price: 5.95, unit: 'each' },
    { keywords: ['backwater', 'valve', 'plumbing'], title: 'Backwater Valve', sku: '101150', price: 85.95, unit: 'each' },
    { keywords: ['roof', 'vent', 'pipe', 'plumbing'], title: 'Roof Vent Pipe', sku: '101151', price: 25.95, unit: 'each' },
    { keywords: ['vent', 'cap', 'plumbing'], title: 'Vent Cap', sku: '101152', price: 12.95, unit: 'each' },
    { keywords: ['vent', 'flashing', 'plumbing'], title: 'Vent Flashing', sku: '101153', price: 15.95, unit: 'each' },
    
    // Plumbing Materials - Water Supply & Distribution
    { keywords: ['main', 'shut', 'off', 'valve', 'plumbing'], title: 'Main Shut-Off Valve', sku: '101154', price: 125.95, unit: 'each' },
    { keywords: ['curb', 'stop', 'valve', 'plumbing'], title: 'Curb Stop Valve', sku: '101155', price: 85.95, unit: 'each' },
    { keywords: ['water', 'meter', 'box', 'plumbing'], title: 'Water Meter Box', sku: '101156', price: 45.95, unit: 'each' },
    { keywords: ['prv', 'regulator', 'water', 'plumbing'], title: 'PRV Water Regulator', sku: '101157', price: 95.95, unit: 'each' },
    { keywords: ['water', 'hammer', 'arrestor', 'plumbing'], title: 'Water Hammer Arrestor', sku: '101158', price: 35.95, unit: 'each' },
    { keywords: ['expansion', 'tank', 'water', 'plumbing'], title: 'Expansion Tank Water', sku: '101159', price: 65.95, unit: 'each' },
    { keywords: ['pex', 'manifold', 'plumbing'], title: 'PEX Manifold', sku: '101160', price: 125.95, unit: 'each' },
    { keywords: ['copper', 'manifold', 'plumbing'], title: 'Copper Manifold', sku: '101161', price: 145.95, unit: 'each' },
    { keywords: ['flexible', 'supply', 'line', 'stainless', 'plumbing'], title: 'Flexible Supply Line Stainless', sku: '101162', price: 12.95, unit: 'each' },
    { keywords: ['flexible', 'supply', 'line', 'braided', 'plumbing'], title: 'Flexible Supply Line Braided PVC', sku: '101163', price: 8.95, unit: 'each' },
    { keywords: ['ice', 'maker', 'kit', 'plumbing'], title: 'Ice Maker Kit', sku: '101164', price: 25.95, unit: 'kit' },
    { keywords: ['dishwasher', 'kit', 'plumbing'], title: 'Dishwasher Kit', sku: '101165', price: 35.95, unit: 'kit' },
    { keywords: ['washing', 'machine', 'outlet', 'box', 'plumbing'], title: 'Washing Machine Outlet Box', sku: '101166', price: 45.95, unit: 'each' },
    { keywords: ['angle', 'stop', 'valve', 'plumbing'], title: 'Angle Stop Valve', sku: '101167', price: 18.95, unit: 'each' },
    { keywords: ['straight', 'stop', 'valve', 'plumbing'], title: 'Straight Stop Valve', sku: '101168', price: 16.95, unit: 'each' },
    { keywords: ['quarter', 'turn', 'valve', 'plumbing'], title: 'Quarter-Turn Valve', sku: '101169', price: 22.95, unit: 'each' },
    { keywords: ['push', 'connect', 'valve', 'plumbing'], title: 'Push-Connect Valve', sku: '101170', price: 35.95, unit: 'each' },
    { keywords: ['compression', 'valve', 'plumbing'], title: 'Compression Valve', sku: '101171', price: 25.95, unit: 'each' },
    
    // Kitchen Fixtures
    { keywords: ['kitchen', 'sink', 'stainless', 'steel', 'plumbing'], title: 'Kitchen Sink Stainless Steel', sku: '101172', price: 125.95, unit: 'each' },
    { keywords: ['kitchen', 'sink', 'composite', 'plumbing'], title: 'Kitchen Sink Composite', sku: '101173', price: 185.95, unit: 'each' },
    { keywords: ['kitchen', 'sink', 'granite', 'plumbing'], title: 'Kitchen Sink Granite', sku: '101174', price: 245.95, unit: 'each' },
    { keywords: ['farmhouse', 'sink', 'kitchen', 'plumbing'], title: 'Farmhouse Kitchen Sink', sku: '101175', price: 285.95, unit: 'each' },
    { keywords: ['kitchen', 'faucet', 'pull', 'down', 'plumbing'], title: 'Kitchen Faucet Pull-Down', sku: '101176', price: 185.95, unit: 'each' },
    { keywords: ['kitchen', 'faucet', 'touchless', 'plumbing'], title: 'Kitchen Faucet Touchless', sku: '101177', price: 225.95, unit: 'each' },
    { keywords: ['kitchen', 'faucet', 'single', 'handle', 'plumbing'], title: 'Kitchen Faucet Single-Handle', sku: '101178', price: 125.95, unit: 'each' },
    { keywords: ['garbage', 'disposal', '1/2', 'hp', 'plumbing'], title: 'Garbage Disposal 1/2 HP', sku: '101179', price: 125.95, unit: 'each' },
    { keywords: ['garbage', 'disposal', '3/4', 'hp', 'plumbing'], title: 'Garbage Disposal 3/4 HP', sku: '101180', price: 165.95, unit: 'each' },
    { keywords: ['garbage', 'disposal', '1', 'hp', 'plumbing'], title: 'Garbage Disposal 1 HP', sku: '101181', price: 195.95, unit: 'each' },
    { keywords: ['dishwasher', 'air', 'gap', 'plumbing'], title: 'Dishwasher Air Gap', sku: '101182', price: 25.95, unit: 'each' },
    { keywords: ['basket', 'strainer', 'kitchen', 'plumbing'], title: 'Basket Strainer Kitchen', sku: '101183', price: 15.95, unit: 'each' },
    { keywords: ['under', 'sink', 'water', 'filter', 'plumbing'], title: 'Under-Sink Water Filter', sku: '101184', price: 85.95, unit: 'each' },
    { keywords: ['instant', 'hot', 'water', 'dispenser', 'plumbing'], title: 'Instant Hot Water Dispenser', sku: '101185', price: 145.95, unit: 'each' },
    
    // Bathroom Fixtures
    { keywords: ['lavatory', 'sink', 'vanity', 'plumbing'], title: 'Lavatory Sink Vanity', sku: '101186', price: 95.95, unit: 'each' },
    { keywords: ['pedestal', 'sink', 'bathroom', 'plumbing'], title: 'Pedestal Sink Bathroom', sku: '101187', price: 125.95, unit: 'each' },
    { keywords: ['vessel', 'sink', 'bathroom', 'plumbing'], title: 'Vessel Sink Bathroom', sku: '101188', price: 165.95, unit: 'each' },
    { keywords: ['bathroom', 'faucet', 'centerset', 'plumbing'], title: 'Bathroom Faucet Centerset', sku: '101189', price: 85.95, unit: 'each' },
    { keywords: ['bathroom', 'faucet', 'widespread', 'plumbing'], title: 'Bathroom Faucet Widespread', sku: '101190', price: 125.95, unit: 'each' },
    { keywords: ['wall', 'mount', 'faucet', 'bathroom', 'plumbing'], title: 'Wall-Mount Faucet Bathroom', sku: '101191', price: 145.95, unit: 'each' },
    { keywords: ['pop', 'up', 'drain', 'bathroom', 'plumbing'], title: 'Pop-Up Drain Bathroom', sku: '101192', price: 35.95, unit: 'each' },
    { keywords: ['grid', 'drain', 'bathroom', 'plumbing'], title: 'Grid Drain Bathroom', sku: '101193', price: 25.95, unit: 'each' },
    { keywords: ['bathtub', 'alcove', 'plumbing'], title: 'Bathtub Alcove', sku: '101194', price: 285.95, unit: 'each' },
    { keywords: ['freestanding', 'bathtub', 'plumbing'], title: 'Freestanding Bathtub', sku: '101195', price: 485.95, unit: 'each' },
    { keywords: ['drop', 'in', 'bathtub', 'plumbing'], title: 'Drop-In Bathtub', sku: '101196', price: 325.95, unit: 'each' },
    { keywords: ['tub', 'filler', 'plumbing'], title: 'Tub Filler', sku: '101197', price: 185.95, unit: 'each' },
    { keywords: ['tub', 'diverter', 'plumbing'], title: 'Tub Diverter', sku: '101198', price: 45.95, unit: 'each' },
    { keywords: ['shower', 'valve', 'plumbing'], title: 'Shower Valve', sku: '101199', price: 125.95, unit: 'each' },
    { keywords: ['shower', 'trim', 'kit', 'plumbing'], title: 'Shower Trim Kit', sku: '101200', price: 85.95, unit: 'kit' },
    { keywords: ['showerhead', 'fixed', 'plumbing'], title: 'Showerhead Fixed', sku: '101201', price: 65.95, unit: 'each' },
    { keywords: ['handheld', 'showerhead', 'plumbing'], title: 'Handheld Showerhead', sku: '101202', price: 85.95, unit: 'each' },
    { keywords: ['rain', 'showerhead', 'plumbing'], title: 'Rain Showerhead', sku: '101203', price: 125.95, unit: 'each' },
    { keywords: ['shower', 'arm', 'plumbing'], title: 'Shower Arm', sku: '101204', price: 25.95, unit: 'each' },
    { keywords: ['shower', 'flange', 'plumbing'], title: 'Shower Flange', sku: '101205', price: 15.95, unit: 'each' },
    { keywords: ['shower', 'panel', 'plumbing'], title: 'Shower Panel', sku: '101206', price: 185.95, unit: 'each' },
    { keywords: ['toilet', 'elongated', 'plumbing'], title: 'Toilet Elongated', sku: '101207', price: 185.95, unit: 'each' },
    { keywords: ['one', 'piece', 'toilet', 'plumbing'], title: 'One-Piece Toilet', sku: '101208', price: 285.95, unit: 'each' },
    { keywords: ['skirted', 'toilet', 'plumbing'], title: 'Skirted Toilet', sku: '101209', price: 325.95, unit: 'each' },
    { keywords: ['toilet', 'seat', 'soft', 'close', 'plumbing'], title: 'Toilet Seat Soft-Close', sku: '101210', price: 45.95, unit: 'each' },
    { keywords: ['bidet', 'toilet', 'seat', 'plumbing'], title: 'Bidet Toilet Seat', sku: '101211', price: 285.95, unit: 'each' },
    { keywords: ['bidet', 'sprayer', 'plumbing'], title: 'Bidet Sprayer', sku: '101212', price: 65.95, unit: 'each' },
    { keywords: ['tank', 'to', 'bowl', 'kit', 'plumbing'], title: 'Tank-to-Bowl Kit', sku: '101213', price: 25.95, unit: 'kit' },
    { keywords: ['toilet', 'bolts', 'plumbing'], title: 'Toilet Bolts', sku: '101214', price: 8.95, unit: 'kit' },
    { keywords: ['fill', 'valve', 'toilet', 'plumbing'], title: 'Fill Valve Toilet', sku: '101215', price: 15.95, unit: 'each' },
    { keywords: ['flapper', 'toilet', 'plumbing'], title: 'Flapper Toilet', sku: '101216', price: 12.95, unit: 'each' },
    { keywords: ['toilet', 'repair', 'kit', 'plumbing'], title: 'Toilet Repair Kit', sku: '101217', price: 18.95, unit: 'kit' },
    
    // Water Heaters & Hydronic Heating
    { keywords: ['tank', 'water', 'heater', 'gas', 'plumbing'], title: 'Tank Water Heater Gas', sku: '101218', price: 485.95, unit: 'each' },
    { keywords: ['tank', 'water', 'heater', 'electric', 'plumbing'], title: 'Tank Water Heater Electric', sku: '101219', price: 325.95, unit: 'each' },
    { keywords: ['hybrid', 'water', 'heater', 'plumbing'], title: 'Hybrid Water Heater', sku: '101220', price: 685.95, unit: 'each' },
    { keywords: ['lp', 'water', 'heater', 'plumbing'], title: 'LP Water Heater', sku: '101221', price: 425.95, unit: 'each' },
    { keywords: ['tankless', 'heater', 'condensing', 'plumbing'], title: 'Tankless Heater Condensing', sku: '101222', price: 485.95, unit: 'each' },
    { keywords: ['tankless', 'heater', 'non', 'condensing', 'plumbing'], title: 'Tankless Heater Non-Condensing', sku: '101223', price: 385.95, unit: 'each' },
    { keywords: ['expansion', 'tank', 'pan', 'plumbing'], title: 'Expansion Tank Pan', sku: '101224', price: 25.95, unit: 'each' },
    { keywords: ['gas', 'flex', 'connector', 'plumbing'], title: 'Gas Flex Connector', sku: '101225', price: 35.95, unit: 'each' },
    { keywords: ['b', 'vent', 'kit', 'plumbing'], title: 'B-Vent Kit', sku: '101226', price: 85.95, unit: 'kit' },
    { keywords: ['pvc', 'vent', 'kit', 'plumbing'], title: 'PVC Vent Kit', sku: '101227', price: 65.95, unit: 'kit' },
    { keywords: ['t', 'p', 'relief', 'valve', 'plumbing'], title: 'T&P Relief Valve', sku: '101228', price: 25.95, unit: 'each' },
    { keywords: ['circulator', 'pump', 'boiler', 'plumbing'], title: 'Circulator Pump Boiler', sku: '101229', price: 185.95, unit: 'each' },
    { keywords: ['circulator', 'pump', 'radiant', 'plumbing'], title: 'Circulator Pump Radiant', sku: '101230', price: 165.95, unit: 'each' },
    { keywords: ['radiant', 'floor', 'manifold', 'plumbing'], title: 'Radiant Floor Manifold', sku: '101231', price: 125.95, unit: 'each' },
    { keywords: ['radiant', 'valve', 'plumbing'], title: 'Radiant Valve', sku: '101232', price: 45.95, unit: 'each' },
    { keywords: ['pex', 'radiant', 'tubing', 'pex', 'oxygen', 'barrier', 'plumbing'], title: 'Radiant Tubing PEX Oxygen-Barrier', sku: '101233', price: 85.95, unit: 'roll' },
    { keywords: ['heat', 'exchanger', 'plate', 'plumbing'], title: 'Heat Exchanger Plate', sku: '101234', price: 125.95, unit: 'each' },
    { keywords: ['control', 'valve', 'heat', 'exchanger', 'plumbing'], title: 'Control Valve Heat Exchanger', sku: '101235', price: 85.95, unit: 'each' },
    { keywords: ['mixing', 'valve', 'plumbing'], title: 'Mixing Valve', sku: '101236', price: 165.95, unit: 'each' },
    { keywords: ['tempering', 'valve', 'plumbing'], title: 'Tempering Valve', sku: '101237', price: 145.95, unit: 'each' },
    
    // HVAC Materials - Sheet Metal & Ductwork
    { keywords: ['sheet', 'metal', 'duct', 'round', '4', 'hvac'], title: 'Sheet Metal Duct Round 4"', sku: '101238', price: 25.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '6', 'hvac'], title: 'Sheet Metal Duct Round 6"', sku: '101239', price: 35.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '8', 'hvac'], title: 'Sheet Metal Duct Round 8"', sku: '101240', price: 45.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '10', 'hvac'], title: 'Sheet Metal Duct Round 10"', sku: '101241', price: 55.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '12', 'hvac'], title: 'Sheet Metal Duct Round 12"', sku: '101242', price: 65.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '14', 'hvac'], title: 'Sheet Metal Duct Round 14"', sku: '101243', price: 75.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '16', 'hvac'], title: 'Sheet Metal Duct Round 16"', sku: '101244', price: 85.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'round', '18', 'hvac'], title: 'Sheet Metal Duct Round 18"', sku: '101245', price: 95.95, unit: 'length' },
    { keywords: ['sheet', 'metal', 'duct', 'rectangular', 'hvac'], title: 'Sheet Metal Duct Rectangular', sku: '101246', price: 45.95, unit: 'length' },
    { keywords: ['duct', 'elbow', 'adjustable', 'hvac'], title: 'Duct Elbow Adjustable', sku: '101247', price: 15.95, unit: 'each' },
    { keywords: ['duct', 'elbow', '90', 'degree', 'hvac'], title: 'Duct Elbow 90°', sku: '101248', price: 12.95, unit: 'each' },
    { keywords: ['duct', 'elbow', '45', 'degree', 'hvac'], title: 'Duct Elbow 45°', sku: '101249', price: 10.95, unit: 'each' },
    { keywords: ['duct', 'reducer', 'round', 'to', 'round', 'hvac'], title: 'Duct Reducer Round-to-Round', sku: '101250', price: 18.95, unit: 'each' },
    { keywords: ['duct', 'reducer', 'rectangular', 'hvac'], title: 'Duct Reducer Rectangular', sku: '101251', price: 22.95, unit: 'each' },
    { keywords: ['duct', 'transition', 'round', 'to', 'rectangular', 'hvac'], title: 'Duct Transition Round-to-Rectangular', sku: '101252', price: 28.95, unit: 'each' },
    { keywords: ['duct', 'cap', 'round', 'hvac'], title: 'Duct Cap Round', sku: '101253', price: 12.95, unit: 'each' },
    { keywords: ['duct', 'cap', 'rectangular', 'hvac'], title: 'Duct Cap Rectangular', sku: '101254', price: 15.95, unit: 'each' },
    { keywords: ['duct', 'boot', 'round', 'hvac'], title: 'Duct Boot Round', sku: '101255', price: 18.95, unit: 'each' },
    { keywords: ['duct', 'boot', 'rectangular', 'hvac'], title: 'Duct Boot Rectangular', sku: '101256', price: 22.95, unit: 'each' },
    { keywords: ['duct', 'coupling', 'hvac'], title: 'Duct Coupling', sku: '101257', price: 8.95, unit: 'each' },
    { keywords: ['duct', 'hanger', 'straps', 'hvac'], title: 'Duct Hanger Straps', sku: '101258', price: 5.95, unit: 'each' },
    { keywords: ['duct', 'tape', 'aluminum', 'hvac'], title: 'Duct Tape Aluminum', sku: '101259', price: 8.95, unit: 'roll' },
    { keywords: ['duct', 'tape', 'foil', 'hvac'], title: 'Duct Tape Foil', sku: '101260', price: 6.95, unit: 'roll' },
    { keywords: ['duct', 'sealant', 'mastic', 'hvac'], title: 'Duct Sealant Mastic', sku: '101261', price: 12.95, unit: 'tube' },
    { keywords: ['duct', 'insulation', 'hvac'], title: 'Duct Insulation', sku: '101262', price: 15.95, unit: 'roll' },
    { keywords: ['flexible', 'duct', 'hvac'], title: 'Flexible Duct', sku: '101263', price: 25.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'connector', 'hvac'], title: 'Flexible Duct Connector', sku: '101264', price: 12.95, unit: 'each' },
    { keywords: ['flexible', 'duct', 'clamp', 'hvac'], title: 'Flexible Duct Clamp', sku: '101265', price: 3.95, unit: 'each' },
    
    // HVAC Materials - Registers & Diffusers
    { keywords: ['supply', 'register', 'floor', 'hvac'], title: 'Supply Register Floor', sku: '101266', price: 25.95, unit: 'each' },
    { keywords: ['supply', 'register', 'wall', 'hvac'], title: 'Supply Register Wall', sku: '101267', price: 22.95, unit: 'each' },
    { keywords: ['supply', 'register', 'ceiling', 'hvac'], title: 'Supply Register Ceiling', sku: '101268', price: 28.95, unit: 'each' },
    { keywords: ['return', 'grille', 'floor', 'hvac'], title: 'Return Grille Floor', sku: '101269', price: 35.95, unit: 'each' },
    { keywords: ['return', 'grille', 'wall', 'hvac'], title: 'Return Grille Wall', sku: '101270', price: 32.95, unit: 'each' },
    { keywords: ['return', 'grille', 'ceiling', 'hvac'], title: 'Return Grille Ceiling', sku: '101271', price: 38.95, unit: 'each' },
    { keywords: ['diffuser', 'round', 'hvac'], title: 'Diffuser Round', sku: '101272', price: 45.95, unit: 'each' },
    { keywords: ['diffuser', 'square', 'hvac'], title: 'Diffuser Square', sku: '101273', price: 48.95, unit: 'each' },
    { keywords: ['diffuser', 'linear', 'hvac'], title: 'Diffuser Linear', sku: '101274', price: 65.95, unit: 'each' },
    { keywords: ['louver', 'grille', 'hvac'], title: 'Louver Grille', sku: '101275', price: 25.95, unit: 'each' },
    { keywords: ['damper', 'volume', 'control', 'hvac'], title: 'Damper Volume Control', sku: '101276', price: 35.95, unit: 'each' },
    { keywords: ['damper', 'fire', 'hvac'], title: 'Damper Fire', sku: '101277', price: 125.95, unit: 'each' },
    { keywords: ['damper', 'back', 'draft', 'hvac'], title: 'Damper Back-Draft', sku: '101278', price: 45.95, unit: 'each' },
    { keywords: ['register', 'box', 'hvac'], title: 'Register Box', sku: '101279', price: 15.95, unit: 'each' },
    { keywords: ['register', 'boot', 'hvac'], title: 'Register Boot', sku: '101280', price: 18.95, unit: 'each' },
    { keywords: ['register', 'adapter', 'hvac'], title: 'Register Adapter', sku: '101281', price: 12.95, unit: 'each' },
    { keywords: ['register', 'screws', 'hvac'], title: 'Register Screws', sku: '101282', price: 5.95, unit: 'pack' },
    { keywords: ['register', 'magnetic', 'cover', 'hvac'], title: 'Register Magnetic Cover', sku: '101283', price: 8.95, unit: 'each' },
    { keywords: ['register', 'filter', 'hvac'], title: 'Register Filter', sku: '101284', price: 6.95, unit: 'each' },
    
    // HVAC Equipment & Controls
    { keywords: ['thermostat', 'programmable', 'hvac'], title: 'Thermostat Programmable', sku: '101285', price: 85.95, unit: 'each' },
    { keywords: ['thermostat', 'smart', 'hvac'], title: 'Thermostat Smart', sku: '101286', price: 125.95, unit: 'each' },
    { keywords: ['thermostat', 'wifi', 'hvac'], title: 'Thermostat WiFi', sku: '101287', price: 145.95, unit: 'each' },
    { keywords: ['thermostat', 'wire', 'hvac'], title: 'Thermostat Wire', sku: '101288', price: 15.95, unit: 'roll' },
    { keywords: ['thermostat', 'mounting', 'plate', 'hvac'], title: 'Thermostat Mounting Plate', sku: '101289', price: 8.95, unit: 'each' },
    { keywords: ['thermostat', 'subbase', 'hvac'], title: 'Thermostat Subbase', sku: '101290', price: 25.95, unit: 'each' },
    { keywords: ['zone', 'control', 'panel', 'hvac'], title: 'Zone Control Panel', sku: '101291', price: 185.95, unit: 'each' },
    { keywords: ['zone', 'damper', 'motor', 'hvac'], title: 'Zone Damper Motor', sku: '101292', price: 95.95, unit: 'each' },
    { keywords: ['zone', 'sensor', 'hvac'], title: 'Zone Sensor', sku: '101293', price: 65.95, unit: 'each' },
    { keywords: ['air', 'handler', 'hvac'], title: 'Air Handler', sku: '101294', price: 485.95, unit: 'each' },
    { keywords: ['condensing', 'unit', 'hvac'], title: 'Condensing Unit', sku: '101295', price: 685.95, unit: 'each' },
    { keywords: ['heat', 'pump', 'hvac'], title: 'Heat Pump', sku: '101296', price: 785.95, unit: 'each' },
    { keywords: ['furnace', 'gas', 'hvac'], title: 'Furnace Gas', sku: '101297', price: 585.95, unit: 'each' },
    { keywords: ['furnace', 'electric', 'hvac'], title: 'Furnace Electric', sku: '101298', price: 485.95, unit: 'each' },
    { keywords: ['boiler', 'gas', 'hvac'], title: 'Boiler Gas', sku: '101299', price: 685.95, unit: 'each' },
    { keywords: ['boiler', 'electric', 'hvac'], title: 'Boiler Electric', sku: '101300', price: 585.95, unit: 'each' },
    { keywords: ['air', 'conditioner', 'window', 'hvac'], title: 'Air Conditioner Window', sku: '101301', price: 285.95, unit: 'each' },
    { keywords: ['air', 'conditioner', 'portable', 'hvac'], title: 'Air Conditioner Portable', sku: '101302', price: 385.95, unit: 'each' },
    { keywords: ['evaporator', 'coil', 'hvac'], title: 'Evaporator Coil', sku: '101303', price: 285.95, unit: 'each' },
    { keywords: ['condenser', 'coil', 'hvac'], title: 'Condenser Coil', sku: '101304', price: 325.95, unit: 'each' },
    { keywords: ['duct', 'reducer', 'oval', 'to', 'round', 'hvac'], title: 'Duct Reducer Oval-to-Round', sku: '101305', price: 22.95, unit: 'each' },
    { keywords: ['duct', 'tee', 'hvac'], title: 'Duct Tee', sku: '101306', price: 25.95, unit: 'each' },
    { keywords: ['duct', 'wye', 'hvac'], title: 'Duct Wye', sku: '101307', price: 28.95, unit: 'each' },
    { keywords: ['duct', 'boot', 'straight', 'hvac'], title: 'Duct Boot Straight', sku: '101308', price: 15.95, unit: 'each' },
    { keywords: ['duct', 'boot', 'right', 'angle', 'hvac'], title: 'Duct Boot Right-Angle', sku: '101309', price: 18.95, unit: 'each' },
    { keywords: ['duct', 'work', 'tools', 'hvac'], title: 'Ductwork Tools', sku: '101310', price: 45.95, unit: 'set' },
    { keywords: ['sheet', 'metal', 'snips', 'hvac'], title: 'Sheet Metal Snips', sku: '101311', price: 25.95, unit: 'each' },
    { keywords: ['duct', 'seamer', 'hvac'], title: 'Duct Seamer', sku: '101312', price: 35.95, unit: 'each' },
    { keywords: ['duct', 'crimper', 'hvac'], title: 'Duct Crimper', sku: '101313', price: 28.95, unit: 'each' },
    { keywords: ['duct', 'pittsburgh', 'lock', 'hvac'], title: 'Duct Pittsburgh Lock', sku: '101314', price: 18.95, unit: 'each' },
    { keywords: ['duct', 'cleats', 'hvac'], title: 'Duct Cleats', sku: '101315', price: 12.95, unit: 'pack' },
    { keywords: ['duct', 's', 'cleats', 'hvac'], title: 'Duct S-Cleats', sku: '101316', price: 15.95, unit: 'pack' },
    { keywords: ['duct', 'drive', 'cleats', 'hvac'], title: 'Duct Drive Cleats', sku: '101317', price: 8.95, unit: 'pack' },
    { keywords: ['duct', 'angle', 'iron', 'hvac'], title: 'Duct Angle Iron', sku: '101318', price: 22.95, unit: 'length' },
    { keywords: ['duct', 'channel', 'iron', 'hvac'], title: 'Duct Channel Iron', sku: '101319', price: 25.95, unit: 'length' },
    { keywords: ['duct', 'rod', 'hvac'], title: 'Duct Rod', sku: '101320', price: 18.95, unit: 'length' },
    { keywords: ['duct', 'hanger', 'wire', 'hvac'], title: 'Duct Hanger Wire', sku: '101321', price: 12.95, unit: 'roll' },
    { keywords: ['duct', 'hanger', 'brackets', 'hvac'], title: 'Duct Hanger Brackets', sku: '101322', price: 8.95, unit: 'each' },
    { keywords: ['duct', 'hanger', 'clips', 'hvac'], title: 'Duct Hanger Clips', sku: '101323', price: 6.95, unit: 'pack' },
    
    // Remaining Plumbing Categories - Filtration & Water Treatment
    { keywords: ['whole', 'house', 'filter', 'housing', 'plumbing'], title: 'Whole-House Filter Housing', sku: '101324', price: 125.95, unit: 'each' },
    { keywords: ['under', 'sink', 'filter', 'plumbing'], title: 'Under-Sink Filter', sku: '101325', price: 85.95, unit: 'each' },
    { keywords: ['inline', 'filter', 'plumbing'], title: 'Inline Filter', sku: '101326', price: 45.95, unit: 'each' },
    { keywords: ['reverse', 'osmosis', 'system', 'plumbing'], title: 'Reverse Osmosis System', sku: '101327', price: 185.95, unit: 'each' },
    { keywords: ['water', 'softener', 'plumbing'], title: 'Water Softener', sku: '101328', price: 485.95, unit: 'each' },
    { keywords: ['water', 'descaler', 'plumbing'], title: 'Water Descaler', sku: '101329', price: 285.95, unit: 'each' },
    { keywords: ['salt', 'pellets', 'plumbing'], title: 'Salt Pellets', sku: '101330', price: 12.95, unit: 'bag' },
    { keywords: ['filter', 'cartridges', 'plumbing'], title: 'Filter Cartridges', sku: '101331', price: 25.95, unit: 'each' },
    { keywords: ['uv', 'sterilizer', 'plumbing'], title: 'UV Sterilizer', sku: '101332', price: 185.95, unit: 'each' },
    { keywords: ['faucet', 'mount', 'filter', 'plumbing'], title: 'Faucet-Mount Filter', sku: '101333', price: 35.95, unit: 'each' },
    { keywords: ['filter', 'replacements', 'plumbing'], title: 'Filter Replacements', sku: '101334', price: 18.95, unit: 'pack' },
    { keywords: ['o', 'rings', 'filter', 'plumbing'], title: 'O-Rings Filter', sku: '101335', price: 8.95, unit: 'pack' },
    
    // Sump, Sewage & Drainage
    { keywords: ['sump', 'pump', 'primary', 'plumbing'], title: 'Sump Pump Primary', sku: '101336', price: 185.95, unit: 'each' },
    { keywords: ['sump', 'pump', 'backup', 'plumbing'], title: 'Sump Pump Backup', sku: '101337', price: 225.95, unit: 'each' },
    { keywords: ['sewage', 'ejector', 'pump', 'plumbing'], title: 'Sewage Ejector Pump', sku: '101338', price: 285.95, unit: 'each' },
    { keywords: ['grinder', 'pump', 'plumbing'], title: 'Grinder Pump', sku: '101339', price: 385.95, unit: 'each' },
    { keywords: ['utility', 'pump', 'plumbing'], title: 'Utility Pump', sku: '101340', price: 125.95, unit: 'each' },
    { keywords: ['transfer', 'pump', 'plumbing'], title: 'Transfer Pump', sku: '101341', price: 145.95, unit: 'each' },
    { keywords: ['check', 'valve', 'pvc', 'plumbing'], title: 'Check Valve PVC', sku: '101342', price: 18.95, unit: 'each' },
    { keywords: ['check', 'valve', 'brass', 'plumbing'], title: 'Check Valve Brass', sku: '101343', price: 25.95, unit: 'each' },
    { keywords: ['pump', 'basin', 'plumbing'], title: 'Pump Basin', sku: '101344', price: 85.95, unit: 'each' },
    { keywords: ['pump', 'lid', 'plumbing'], title: 'Pump Lid', sku: '101345', price: 35.95, unit: 'each' },
    { keywords: ['backwater', 'valve', 'pvc', 'plumbing'], title: 'Backwater Valve PVC', sku: '101346', price: 95.95, unit: 'each' },
    { keywords: ['french', 'drain', 'pipe', 'plumbing'], title: 'French Drain Pipe', sku: '101347', price: 25.95, unit: 'length' },
    { keywords: ['catch', 'basin', 'plumbing'], title: 'Catch Basin', sku: '101348', price: 45.95, unit: 'each' },
    { keywords: ['trench', 'drain', 'plumbing'], title: 'Trench Drain', sku: '101349', price: 125.95, unit: 'each' },
    { keywords: ['channel', 'drain', 'plumbing'], title: 'Channel Drain', sku: '101350', price: 85.95, unit: 'each' },
    { keywords: ['drain', 'grates', 'plumbing'], title: 'Drain Grates', sku: '101351', price: 35.95, unit: 'each' },
    { keywords: ['drain', 'strainers', 'plumbing'], title: 'Drain Strainers', sku: '101352', price: 25.95, unit: 'each' },
    { keywords: ['pump', 'switches', 'plumbing'], title: 'Pump Switches', sku: '101353', price: 45.95, unit: 'each' },
    { keywords: ['pump', 'alarms', 'plumbing'], title: 'Pump Alarms', sku: '101354', price: 65.95, unit: 'each' },
    { keywords: ['pump', 'sensors', 'plumbing'], title: 'Pump Sensors', sku: '101355', price: 85.95, unit: 'each' },
    
    // Irrigation & Outdoor Plumbing
    { keywords: ['irrigation', 'pvc', 'pipe', 'plumbing'], title: 'Irrigation PVC Pipe', sku: '101356', price: 15.95, unit: 'length' },
    { keywords: ['sprinkler', 'heads', 'plumbing'], title: 'Sprinkler Heads', sku: '101357', price: 8.95, unit: 'each' },
    { keywords: ['rotors', 'sprinkler', 'plumbing'], title: 'Rotors Sprinkler', sku: '101358', price: 25.95, unit: 'each' },
    { keywords: ['nozzles', 'sprinkler', 'plumbing'], title: 'Nozzles Sprinkler', sku: '101359', price: 5.95, unit: 'each' },
    { keywords: ['anti', 'siphon', 'valve', 'plumbing'], title: 'Anti-Siphon Valve', sku: '101360', price: 35.95, unit: 'each' },
    { keywords: ['inline', 'valve', 'irrigation', 'plumbing'], title: 'Inline Valve Irrigation', sku: '101361', price: 25.95, unit: 'each' },
    { keywords: ['yard', 'hydrants', 'plumbing'], title: 'Yard Hydrants', sku: '101362', price: 125.95, unit: 'each' },
    { keywords: ['irrigation', 'controllers', 'plumbing'], title: 'Irrigation Controllers', sku: '101363', price: 85.95, unit: 'each' },
    { keywords: ['irrigation', 'timers', 'plumbing'], title: 'Irrigation Timers', sku: '101364', price: 45.95, unit: 'each' },
    { keywords: ['valve', 'boxes', 'plumbing'], title: 'Valve Boxes', sku: '101365', price: 25.95, unit: 'each' },
    { keywords: ['valve', 'covers', 'plumbing'], title: 'Valve Covers', sku: '101366', price: 15.95, unit: 'each' },
    { keywords: ['drip', 'tubing', 'plumbing'], title: 'Drip Tubing', sku: '101367', price: 18.95, unit: 'roll' },
    { keywords: ['emitters', 'drip', 'plumbing'], title: 'Emitters Drip', sku: '101368', price: 8.95, unit: 'pack' },
    { keywords: ['quick', 'connect', 'hose', 'fittings', 'plumbing'], title: 'Quick-Connect Hose Fittings', sku: '101369', price: 12.95, unit: 'each' },
    
    // Plumbing Tools & Accessories
    { keywords: ['pipe', 'cutters', 'pvc', 'plumbing'], title: 'Pipe Cutters PVC', sku: '101370', price: 35.95, unit: 'each' },
    { keywords: ['pex', 'pipe', 'cutters', 'pex', 'plumbing'], title: 'Pipe Cutters PEX', sku: '101371', price: 45.95, unit: 'each' },
    { keywords: ['pipe', 'cutters', 'copper', 'plumbing'], title: 'Pipe Cutters Copper', sku: '101372', price: 55.95, unit: 'each' },
    { keywords: ['pex', 'crimp', 'tools', 'pex', 'plumbing'], title: 'Crimp Tools PEX', sku: '101373', price: 125.95, unit: 'each' },
    { keywords: ['pex', 'expansion', 'tools', 'pex', 'plumbing'], title: 'Expansion Tools PEX', sku: '101374', price: 185.95, unit: 'each' },
    { keywords: ['pipe', 'wrenches', 'plumbing'], title: 'Pipe Wrenches', sku: '101375', price: 35.95, unit: 'each' },
    { keywords: ['channel', 'lock', 'pliers', 'plumbing'], title: 'Channel-Lock Pliers', sku: '101376', price: 25.95, unit: 'each' },
    { keywords: ['tubing', 'benders', 'plumbing'], title: 'Tubing Benders', sku: '101377', price: 45.95, unit: 'each' },
    { keywords: ['deburring', 'tools', 'plumbing'], title: 'Deburring Tools', sku: '101378', price: 18.95, unit: 'each' },
    { keywords: ['reaming', 'tools', 'plumbing'], title: 'Reaming Tools', sku: '101379', price: 22.95, unit: 'each' },
    { keywords: ['threading', 'dies', 'plumbing'], title: 'Threading Dies', sku: '101380', price: 85.95, unit: 'set' },
    { keywords: ['threading', 'machines', 'plumbing'], title: 'Threading Machines', sku: '101381', price: 485.95, unit: 'each' },
    { keywords: ['propane', 'torch', 'plumbing'], title: 'Propane Torch', sku: '101382', price: 45.95, unit: 'each' },
    { keywords: ['mapp', 'torch', 'plumbing'], title: 'MAPP Torch', sku: '101383', price: 55.95, unit: 'each' },
    { keywords: ['solder', 'plumbing'], title: 'Solder', sku: '101384', price: 15.95, unit: 'roll' },
    { keywords: ['flux', 'soldering', 'plumbing'], title: 'Flux Soldering', sku: '101385', price: 8.95, unit: 'tube' },
    { keywords: ['drain', 'auger', 'plumbing'], title: 'Drain Auger', sku: '101386', price: 35.95, unit: 'each' },
    { keywords: ['closet', 'auger', 'plumbing'], title: 'Closet Auger', sku: '101387', price: 25.95, unit: 'each' },
    { keywords: ['pipe', 'thawing', 'kit', 'plumbing'], title: 'Pipe Thawing Kit', sku: '101388', price: 125.95, unit: 'kit' },
    { keywords: ['pressure', 'test', 'gauge', 'plumbing'], title: 'Pressure Test Gauge', sku: '101389', price: 45.95, unit: 'each' },
    { keywords: ['air', 'test', 'gauge', 'plumbing'], title: 'Air Test Gauge', sku: '101390', price: 35.95, unit: 'each' },
    { keywords: ['basin', 'wrench', 'plumbing'], title: 'Basin Wrench', sku: '101391', price: 25.95, unit: 'each' },
    { keywords: ['faucet', 'wrench', 'plumbing'], title: 'Faucet Wrench', sku: '101392', price: 22.95, unit: 'each' },
    { keywords: ['leak', 'detection', 'kit', 'plumbing'], title: 'Leak Detection Kit', sku: '101393', price: 85.95, unit: 'kit' },
    { keywords: ['pipe', 'freeze', 'cables', 'plumbing'], title: 'Pipe Freeze Cables', sku: '101394', price: 45.95, unit: 'length' },
    { keywords: ['ppe', 'gloves', 'plumbing'], title: 'PPE Gloves', sku: '101395', price: 8.95, unit: 'pair' },
    { keywords: ['ppe', 'goggles', 'plumbing'], title: 'PPE Goggles', sku: '101396', price: 12.95, unit: 'each' },
    { keywords: ['kneepads', 'plumbing'], title: 'Kneepads', sku: '101397', price: 15.95, unit: 'pair' },
    { keywords: ['duct', 'boot', 'end', 'hvac'], title: 'Duct Boot End', sku: '101147', price: 12.95, unit: 'each' },
    { keywords: ['duct', 'boot', 'ceiling', 'hvac'], title: 'Duct Boot Ceiling', sku: '101148', price: 22.95, unit: 'each' },
    { keywords: ['duct', 'takeoff', 'starting', 'collar', 'damper', 'hvac'], title: 'Duct Takeoff Starting Collar with Damper', sku: '101149', price: 35.95, unit: 'each' },
    { keywords: ['duct', 'caps', 'hvac'], title: 'Duct Caps', sku: '101150', price: 8.95, unit: 'each' },
    { keywords: ['duct', 'end', 'plugs', 'hvac'], title: 'Duct End Plugs', sku: '101151', price: 6.95, unit: 'each' },
    { keywords: ['plenum', 'supply', 'hvac'], title: 'Plenum Supply', sku: '101152', price: 125.95, unit: 'each' },
    { keywords: ['plenum', 'return', 'hvac'], title: 'Plenum Return', sku: '101153', price: 125.95, unit: 'each' },
    { keywords: ['duct', 'transition', 'piece', 'hvac'], title: 'Duct Transition Piece', sku: '101154', price: 45.95, unit: 'each' },
    { keywords: ['flexible', 'duct', 'insulated', '4', 'hvac'], title: 'Flexible Duct Insulated 4"', sku: '101155', price: 35.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'insulated', '6', 'hvac'], title: 'Flexible Duct Insulated 6"', sku: '101156', price: 45.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'insulated', '8', 'hvac'], title: 'Flexible Duct Insulated 8"', sku: '101157', price: 55.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'insulated', '10', 'hvac'], title: 'Flexible Duct Insulated 10"', sku: '101158', price: 65.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'insulated', '12', 'hvac'], title: 'Flexible Duct Insulated 12"', sku: '101159', price: 75.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'insulated', '14', 'hvac'], title: 'Flexible Duct Insulated 14"', sku: '101160', price: 85.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'uninsulated', '4', 'hvac'], title: 'Flexible Duct Uninsulated 4"', sku: '101161', price: 25.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'uninsulated', '6', 'hvac'], title: 'Flexible Duct Uninsulated 6"', sku: '101162', price: 35.95, unit: 'length' },
    { keywords: ['flexible', 'duct', 'uninsulated', '8', 'hvac'], title: 'Flexible Duct Uninsulated 8"', sku: '101163', price: 45.95, unit: 'length' },
    { keywords: ['aluminum', 'flex', 'duct', 'dryer', 'hvac'], title: 'Aluminum Flex Duct Dryer', sku: '101164', price: 35.95, unit: 'length' },
    { keywords: ['aluminum', 'flex', 'duct', 'range', 'hood', 'hvac'], title: 'Aluminum Flex Duct Range Hood', sku: '101165', price: 45.95, unit: 'length' },
    { keywords: ['high', 'temp', 'flexible', 'duct', 'hvac'], title: 'High-Temp Flexible Duct', sku: '101166', price: 65.95, unit: 'length' },
    { keywords: ['duct', 'board', 'panel', 'r4', 'hvac'], title: 'Duct Board Panel R4', sku: '101167', price: 35.95, unit: 'sheet' },
    { keywords: ['duct', 'board', 'panel', 'r6', 'hvac'], title: 'Duct Board Panel R6', sku: '101168', price: 45.95, unit: 'sheet' },
    { keywords: ['duct', 'board', 'panel', 'r8', 'hvac'], title: 'Duct Board Panel R8', sku: '101169', price: 55.95, unit: 'sheet' },
    { keywords: ['ductboard', 'collar', 'hvac'], title: 'Ductboard Collar', sku: '101170', price: 15.95, unit: 'each' },
    { keywords: ['ductboard', 'start', 'ring', 'hvac'], title: 'Ductboard Start Ring', sku: '101171', price: 12.95, unit: 'each' },
    { keywords: ['return', 'air', 'grille', 'hvac'], title: 'Return Air Grille', sku: '101172', price: 25.95, unit: 'each' },
    { keywords: ['return', 'air', 'box', 'hvac'], title: 'Return Air Box', sku: '101173', price: 35.95, unit: 'each' },
    { keywords: ['duct', 'insulation', 'wrap', 'foil', 'faced', 'hvac'], title: 'Duct Insulation Wrap Foil-Faced', sku: '101174', price: 45.95, unit: 'roll' },
    { keywords: ['duct', 'liner', 'insulation', 'internal', 'sound', 'hvac'], title: 'Duct Liner Insulation Internal Sound', sku: '101175', price: 55.95, unit: 'roll' },
    { keywords: ['foil', 'tape', 'ul181', 'rated', 'hvac'], title: 'Foil Tape UL-181 Rated', sku: '101176', price: 8.95, unit: 'roll' },
    { keywords: ['duct', 'tape', 'ul181', 'rated', 'hvac'], title: 'Duct Tape UL-181 Rated', sku: '101177', price: 6.95, unit: 'roll' },
    { keywords: ['mastic', 'sealant', 'brush', 'on', 'hvac'], title: 'Mastic Sealant Brush-On', sku: '101178', price: 15.95, unit: 'gallon' },
    { keywords: ['mastic', 'sealant', 'fiber', 'reinforced', 'hvac'], title: 'Mastic Sealant Fiber-Reinforced', sku: '101179', price: 18.95, unit: 'gallon' },
    { keywords: ['duct', 'hangers', 'hvac'], title: 'Duct Hangers', sku: '101180', price: 8.95, unit: 'each' },
    { keywords: ['duct', 'support', 'straps', 'hvac'], title: 'Duct Support Straps', sku: '101181', price: 6.95, unit: 'each' },
    { keywords: ['duct', 'turning', 'vanes', 'hvac'], title: 'Duct Turning Vanes', sku: '101182', price: 25.95, unit: 'each' },
    
    // HVAC Materials - Registers, Grilles, and Diffusers
    { keywords: ['floor', 'register', 'steel', 'hvac'], title: 'Floor Register Steel', sku: '101183', price: 25.95, unit: 'each' },
    { keywords: ['floor', 'register', 'aluminum', 'hvac'], title: 'Floor Register Aluminum', sku: '101184', price: 22.95, unit: 'each' },
    { keywords: ['floor', 'register', 'wood', 'hvac'], title: 'Floor Register Wood', sku: '101185', price: 35.95, unit: 'each' },
    { keywords: ['ceiling', 'diffuser', 'round', 'hvac'], title: 'Ceiling Diffuser Round', sku: '101186', price: 28.95, unit: 'each' },
    { keywords: ['ceiling', 'diffuser', 'square', 'hvac'], title: 'Ceiling Diffuser Square', sku: '101187', price: 32.95, unit: 'each' },
    { keywords: ['ceiling', 'diffuser', '2-way', 'hvac'], title: 'Ceiling Diffuser 2-Way', sku: '101188', price: 35.95, unit: 'each' },
    { keywords: ['ceiling', 'diffuser', '3-way', 'hvac'], title: 'Ceiling Diffuser 3-Way', sku: '101189', price: 38.95, unit: 'each' },
    { keywords: ['ceiling', 'diffuser', '4-way', 'hvac'], title: 'Ceiling Diffuser 4-Way', sku: '101190', price: 42.95, unit: 'each' },
    { keywords: ['wall', 'register', 'hvac'], title: 'Wall Register', sku: '101191', price: 18.95, unit: 'each' },
    { keywords: ['return', 'grille', 'hvac'], title: 'Return Grille', sku: '101192', price: 15.95, unit: 'each' },
    { keywords: ['baseboard', 'diffuser', 'hvac'], title: 'Baseboard Diffuser', sku: '101193', price: 25.95, unit: 'each' },
    { keywords: ['return', 'air', 'filter', 'grille', 'hvac'], title: 'Return Air Filter Grille', sku: '101194', price: 35.95, unit: 'each' },
    { keywords: ['eggcrate', 'return', 'ceiling', 'mount', 'hvac'], title: 'Eggcrate Return Ceiling Mount', sku: '101195', price: 28.95, unit: 'each' },
    { keywords: ['adjustable', 'damper', 'hvac'], title: 'Adjustable Damper', sku: '101196', price: 22.95, unit: 'each' },
    { keywords: ['backdraft', 'damper', 'hvac'], title: 'Backdraft Damper', sku: '101197', price: 35.95, unit: 'each' },
    { keywords: ['bar', 'linear', 'diffuser', 'hvac'], title: 'Bar Linear Diffuser', sku: '101198', price: 45.95, unit: 'each' },
    { keywords: ['filter', 'grille', 'hinges', 'hvac'], title: 'Filter Grille with Hinges', sku: '101199', price: 42.95, unit: 'each' },
    { keywords: ['magnetic', 'vent', 'cover', 'hvac'], title: 'Magnetic Vent Cover', sku: '101200', price: 12.95, unit: 'each' },
    
    // Drywall & Finishes - Drywall Sheets
    { keywords: ['drywall', '1/4', 'flex', 'board', 'curved', 'walls', 'ceilings'], title: 'Drywall 1/4" Flex Board (4x8)', sku: '100761', price: 18.95, unit: 'sheet' },
    { keywords: ['drywall', '3/8', 'repairs', 'overlays'], title: 'Drywall 3/8" (4x8)', sku: '100762', price: 12.95, unit: 'sheet' },
    { keywords: ['drywall', '1/2', 'standard', 'walls'], title: 'Drywall 1/2" Standard (4x8)', sku: '100763', price: 14.95, unit: 'sheet' },
    { keywords: ['drywall', '5/8', 'fire', 'rated', 'ceilings', 'garages'], title: 'Drywall 5/8" Fire-Rated (4x8)', sku: '100764', price: 19.95, unit: 'sheet' },
    { keywords: ['drywall', 'moisture', 'resistant', 'green', 'board'], title: 'Moisture-Resistant Drywall (4x8)', sku: '100765', price: 16.95, unit: 'sheet' },
    { keywords: ['drywall', 'mold', 'resistant', 'purple', 'board'], title: 'Mold-Resistant Drywall (4x8)', sku: '100766', price: 22.95, unit: 'sheet' },
    { keywords: ['drywall', 'soundproof', 'quietrock', 'sound', 'board'], title: 'Soundproof Drywall (4x8)', sku: '100767', price: 35.95, unit: 'sheet' },
    { keywords: ['cement', 'board', '1/2', 'tile', 'backer', 'wet', 'areas'], title: 'Cement Board 1/2" (3x5)', sku: '100768', price: 18.95, unit: 'sheet' },
    { keywords: ['fiber', 'cement', 'backer', 'hardiebacker'], title: 'Fiber Cement Backer Board (3x5)', sku: '100769', price: 15.95, unit: 'sheet' },
    { keywords: ['lightweight', 'drywall', 'ultra', 'light', '1/2'], title: 'Lightweight Drywall 1/2" (4x8)', sku: '100770', price: 16.95, unit: 'sheet' },
    { keywords: ['abuse', 'resistant', 'drywall', 'high', 'impact'], title: 'Abuse-Resistant Drywall (4x8)', sku: '100771', price: 24.95, unit: 'sheet' },
    
    // Drywall & Finishes - Joint Compounds
    { keywords: ['joint', 'compound', 'all', 'purpose', 'premixed', 'mud'], title: 'All-Purpose Joint Compound (3.5gal)', sku: '100772', price: 18.95, unit: 'bucket' },
    { keywords: ['lightweight', 'joint', 'compound', 'all', 'purpose', 'mud'], title: 'Lightweight All-Purpose Joint Compound (3.5gal)', sku: '100773', price: 22.95, unit: 'bucket' },
    { keywords: ['taping', 'mud', 'setting', 'type', 'first', 'coat'], title: 'Taping Mud Setting-Type (25lb)', sku: '100774', price: 15.95, unit: 'bag' },
    { keywords: ['topping', 'mud', 'finishing', 'final', 'coats'], title: 'Topping Mud (25lb)', sku: '100775', price: 12.95, unit: 'bag' },
    { keywords: ['setting', 'joint', 'compound', 'hot', 'mud', '5', 'minute'], title: 'Setting Joint Compound 5-Min (25lb)', sku: '100776', price: 18.95, unit: 'bag' },
    { keywords: ['setting', 'joint', 'compound', 'hot', 'mud', '20', 'minute'], title: 'Setting Joint Compound 20-Min (25lb)', sku: '100777', price: 16.95, unit: 'bag' },
    { keywords: ['setting', 'joint', 'compound', 'hot', 'mud', '45', 'minute'], title: 'Setting Joint Compound 45-Min (25lb)', sku: '100778', price: 15.95, unit: 'bag' },
    { keywords: ['setting', 'joint', 'compound', 'hot', 'mud', '90', 'minute'], title: 'Setting Joint Compound 90-Min (25lb)', sku: '100779', price: 14.95, unit: 'bag' },
    { keywords: ['fast', 'set', 'hot', 'mud', 'durabond', 'easy', 'sand'], title: 'Fast-Set Hot Mud (25lb)', sku: '100780', price: 19.95, unit: 'bag' },
    { keywords: ['dust', 'control', 'joint', 'compound', 'low', 'dust', 'mud'], title: 'Dust Control Joint Compound (3.5gal)', sku: '100781', price: 25.95, unit: 'bucket' },
    { keywords: ['ultra', 'light', 'joint', 'compound', 'mud'], title: 'Ultra-Light Joint Compound (3.5gal)', sku: '100782', price: 28.95, unit: 'bucket' },
    { keywords: ['deep', 'fill', 'joint', 'compound', 'mud'], title: 'Deep Fill Joint Compound (3.5gal)', sku: '100783', price: 24.95, unit: 'bucket' },
    { keywords: ['patch', 'repair', 'compound', 'spackling', 'hole', 'filler', 'mud'], title: 'Patch & Repair Compound (1qt)', sku: '100784', price: 8.95, unit: 'container' },
    { keywords: ['spray', 'texture', 'compound', 'orange', 'peel', 'knockdown', 'mud'], title: 'Spray Texture Compound (1gal)', sku: '100785', price: 22.95, unit: 'gallon' },
    { keywords: ['skim', 'coat', 'compound', 'topping', 'smooth', 'finish', 'mud'], title: 'Skim Coat Compound (3.5gal)', sku: '100786', price: 26.95, unit: 'bucket' },
    { keywords: ['ready', 'mix', 'texture', 'compound', 'pre', 'thinned', 'mud'], title: 'Ready-Mix Texture Compound (1gal)', sku: '100787', price: 18.95, unit: 'gallon' },
    
    // Drywall & Finishes - Tape & Accessories
    { keywords: ['paper', 'drywall', 'tape'], title: 'Paper Drywall Tape (500ft)', sku: '100788', price: 12.95, unit: 'roll' },
    { keywords: ['fiberglass', 'mesh', 'tape', 'self', 'adhesive'], title: 'Fiberglass Mesh Tape (150ft)', sku: '100789', price: 8.95, unit: 'roll' },
    { keywords: ['metal', 'corner', 'bead'], title: 'Metal Corner Bead (8ft)', sku: '100790', price: 3.95, unit: 'length' },
    { keywords: ['vinyl', 'corner', 'bead'], title: 'Vinyl Corner Bead (8ft)', sku: '100791', price: 4.95, unit: 'length' },
    { keywords: ['bullnose', 'corner', 'bead', 'rounded'], title: 'Bullnose Corner Bead (8ft)', sku: '100792', price: 6.95, unit: 'length' },
    { keywords: ['inside', 'outside', 'corner', 'trim'], title: 'Inside/Outside Corner Trim (8ft)', sku: '100793', price: 5.95, unit: 'length' },
    { keywords: ['drywall', 'joint', 'reinforcement', 'patches'], title: 'Drywall Joint Reinforcement Patches (12ct)', sku: '100794', price: 8.95, unit: 'pack' },
    { keywords: ['corner', 'protectors', 'metal', 'vinyl'], title: 'Corner Protectors (8ft)', sku: '100795', price: 7.95, unit: 'length' },
    
    // Drywall & Finishes - Fasteners & Adhesives
    { keywords: ['drywall', 'screws', 'coarse', 'thread', 'wood', 'studs'], title: 'Drywall Screws Coarse Thread (5lb)', sku: '100796', price: 18.95, unit: 'box' },
    { keywords: ['drywall', 'screws', 'fine', 'thread', 'metal', 'studs'], title: 'Drywall Screws Fine Thread (5lb)', sku: '100797', price: 19.95, unit: 'box' },
    { keywords: ['bugle', 'head', 'drywall', 'screws', '1', 'inch'], title: 'Bugle-Head Drywall Screws 1" (5lb)', sku: '100798', price: 16.95, unit: 'box' },
    { keywords: ['bugle', 'head', 'drywall', 'screws', '1-1/4', 'inch'], title: 'Bugle-Head Drywall Screws 1-1/4" (5lb)', sku: '100799', price: 17.95, unit: 'box' },
    { keywords: ['bugle', 'head', 'drywall', 'screws', '1-5/8', 'inch'], title: 'Bugle-Head Drywall Screws 1-5/8" (5lb)', sku: '100800', price: 18.95, unit: 'box' },
    { keywords: ['drywall', 'adhesive', 'panel', 'adhesive'], title: 'Drywall Adhesive (28oz)', sku: '100801', price: 12.95, unit: 'tube' },
    { keywords: ['corner', 'bead', 'nails'], title: 'Corner Bead Nails (1lb)', sku: '100802', price: 8.95, unit: 'box' },
    { keywords: ['corner', 'bead', 'staples'], title: 'Corner Bead Staples (1lb)', sku: '100803', price: 9.95, unit: 'box' },
    
    // Drywall & Finishes - Finishing & Texture
    { keywords: ['texture', 'compound', 'orange', 'peel', 'knockdown', 'popcorn'], title: 'Texture Compound Orange Peel (1gal)', sku: '100804', price: 24.95, unit: 'gallon' },
    { keywords: ['spray', 'texture', 'aerosol', 'cans', 'small', 'repairs'], title: 'Spray Texture Aerosol (12oz)', sku: '100805', price: 6.95, unit: 'can' },
    { keywords: ['hopper', 'gun', 'texture', 'mix', 'large', 'areas'], title: 'Hopper Gun Texture Mix (5gal)', sku: '100806', price: 85.95, unit: 'bucket' },
    { keywords: ['sandpaper', '80', 'grit'], title: 'Sandpaper 80 Grit (50 sheets)', sku: '100807', price: 12.95, unit: 'pack' },
    { keywords: ['sandpaper', '120', 'grit'], title: 'Sandpaper 120 Grit (50 sheets)', sku: '100808', price: 12.95, unit: 'pack' },
    { keywords: ['sandpaper', '150', 'grit'], title: 'Sandpaper 150 Grit (50 sheets)', sku: '100809', price: 12.95, unit: 'pack' },
    { keywords: ['sandpaper', '220', 'grit'], title: 'Sandpaper 220 Grit (50 sheets)', sku: '100810', price: 12.95, unit: 'pack' },
    { keywords: ['sanding', 'sponges', 'fine'], title: 'Sanding Sponges Fine (12ct)', sku: '100811', price: 18.95, unit: 'pack' },
    { keywords: ['sanding', 'sponges', 'medium'], title: 'Sanding Sponges Medium (12ct)', sku: '100812', price: 16.95, unit: 'pack' },
    { keywords: ['pole', 'sander', 'pads'], title: 'Pole Sander Pads (25ct)', sku: '100813', price: 24.95, unit: 'pack' },
    { keywords: ['mixing', 'paddle', 'bucket'], title: 'Mixing Paddle & Bucket Set', sku: '100814', price: 22.95, unit: 'set' },
    { keywords: ['taping', 'knife', '6', 'inch'], title: 'Taping Knife 6"', sku: '100815', price: 8.95, unit: 'each' },
    { keywords: ['taping', 'knife', '8', 'inch'], title: 'Taping Knife 8"', sku: '100816', price: 10.95, unit: 'each' },
    { keywords: ['taping', 'knife', '10', 'inch'], title: 'Taping Knife 10"', sku: '100817', price: 12.95, unit: 'each' },
    { keywords: ['taping', 'knife', '12', 'inch'], title: 'Taping Knife 12"', sku: '100818', price: 14.95, unit: 'each' },
    { keywords: ['hawk', 'trowel', 'set'], title: 'Hawk & Trowel Set', sku: '100819', price: 28.95, unit: 'set' },
    { keywords: ['corner', 'knife'], title: 'Corner Knife', sku: '100820', price: 15.95, unit: 'each' },
    { keywords: ['drywall', 'rasp', 'utility', 'knife'], title: 'Drywall Rasp & Utility Knife', sku: '100821', price: 18.95, unit: 'set' },
    { keywords: ['mud', 'pan', 'putty', 'knives'], title: 'Mud Pan & Putty Knives Set', sku: '100822', price: 24.95, unit: 'set' },
    
    // Drywall & Finishes - Painting & Trim
    { keywords: ['primer', 'pva', 'drywall', 'primer'], title: 'PVA Drywall Primer (1gal)', sku: '100823', price: 18.95, unit: 'gallon' },
    { keywords: ['interior', 'paint', 'flat'], title: 'Interior Paint Flat (1gal)', sku: '100824', price: 35.95, unit: 'gallon' },
    { keywords: ['interior', 'paint', 'eggshell'], title: 'Interior Paint Eggshell (1gal)', sku: '100825', price: 38.95, unit: 'gallon' },
    { keywords: ['interior', 'paint', 'satin'], title: 'Interior Paint Satin (1gal)', sku: '100826', price: 42.95, unit: 'gallon' },
    { keywords: ['interior', 'paint', 'semi', 'gloss'], title: 'Interior Paint Semi-Gloss (1gal)', sku: '100827', price: 45.95, unit: 'gallon' },
    { keywords: ['exterior', 'paint', 'flat'], title: 'Exterior Paint Flat (1gal)', sku: '100828', price: 48.95, unit: 'gallon' },
    { keywords: ['exterior', 'paint', 'satin'], title: 'Exterior Paint Satin (1gal)', sku: '100829', price: 52.95, unit: 'gallon' },
    { keywords: ['exterior', 'paint', 'gloss'], title: 'Exterior Paint Gloss (1gal)', sku: '100830', price: 55.95, unit: 'gallon' },
    { keywords: ['paint', 'trays', 'rollers', 'brushes', 'extension', 'poles'], title: 'Paint Tray & Roller Set', sku: '100831', price: 24.95, unit: 'set' },
    { keywords: ['painters', 'tape'], title: 'Painter\'s Tape (60yd)', sku: '100832', price: 8.95, unit: 'roll' },
    { keywords: ['caulk', 'paintable', 'latex'], title: 'Paintable Latex Caulk (10.1oz)', sku: '100833', price: 6.95, unit: 'tube' },
    { keywords: ['caulk', 'silicone'], title: 'Silicone Caulk (10.1oz)', sku: '100834', price: 8.95, unit: 'tube' },
    { keywords: ['caulk', 'polyurethane'], title: 'Polyurethane Caulk (10.1oz)', sku: '100835', price: 12.95, unit: 'tube' },
    { keywords: ['sealant', 'fire', 'rated'], title: 'Fire-Rated Sealant (10.1oz)', sku: '100836', price: 15.95, unit: 'tube' },
    { keywords: ['sealant', 'acoustic'], title: 'Acoustic Sealant (10.1oz)', sku: '100837', price: 18.95, unit: 'tube' },
    { keywords: ['sealant', 'moisture', 'barrier'], title: 'Moisture Barrier Sealant (10.1oz)', sku: '100838', price: 14.95, unit: 'tube' },
    { keywords: ['baseboard', 'trim', '3-1/4'], title: 'Baseboard Trim 3-1/4" (16ft)', sku: '100839', price: 18.95, unit: 'length' },
    { keywords: ['baseboard', 'trim', '3-1/2'], title: 'Baseboard Trim 3-1/2" (16ft)', sku: '100840', price: 22.95, unit: 'length' },
    { keywords: ['baseboard', 'trim', '5-1/4'], title: 'Baseboard Trim 5-1/4" (16ft)', sku: '100841', price: 28.95, unit: 'length' },
    { keywords: ['casing', 'trim', '2-1/4'], title: 'Casing Trim 2-1/4" (16ft)', sku: '100842', price: 16.95, unit: 'length' },
    { keywords: ['casing', 'trim', '3-1/2'], title: 'Casing Trim 3-1/2" (16ft)', sku: '100843', price: 24.95, unit: 'length' },
    { keywords: ['crown', 'molding', 'mdf'], title: 'Crown Molding MDF (16ft)', sku: '100844', price: 22.95, unit: 'length' },
    { keywords: ['crown', 'molding', 'wood'], title: 'Crown Molding Wood (16ft)', sku: '100845', price: 35.95, unit: 'length' },
    { keywords: ['crown', 'molding', 'pvc'], title: 'Crown Molding PVC (16ft)', sku: '100846', price: 28.95, unit: 'length' },
    { keywords: ['chair', 'rail', 'wainscot', 'corner', 'molding'], title: 'Chair Rail & Wainscot Trim (16ft)', sku: '100847', price: 19.95, unit: 'length' },
    { keywords: ['door', 'window', 'casing', 'sets'], title: 'Door & Window Casing Set', sku: '100848', price: 45.95, unit: 'set' },
    
    // Drywall & Finishes - Optional Advanced Finishes
    { keywords: ['venetian', 'plaster', 'compound', 'mud'], title: 'Venetian Plaster Compound (1gal)', sku: '100849', price: 65.95, unit: 'gallon' },
    { keywords: ['level', '5', 'finish', 'compound', 'mud'], title: 'Level 5 Finish Compound (3.5gal)', sku: '100850', price: 45.95, unit: 'bucket' },
    { keywords: ['acoustic', 'sealant', 'soundproof', 'drywall'], title: 'Acoustic Sealant for Soundproof Drywall (10.1oz)', sku: '100851', price: 22.95, unit: 'tube' },
    { keywords: ['spray', 'texture', 'machine', 'mix', 'mud'], title: 'Spray Texture Machine Mix (5gal)', sku: '100852', price: 95.95, unit: 'bucket' },
    { keywords: ['primer', 'sealer', 'new', 'drywall'], title: 'Primer Sealer for New Drywall (1gal)', sku: '100853', price: 28.95, unit: 'gallon' },
    { keywords: ['joint', 'compound', 'hardener', 'additive', 'mud'], title: 'Joint Compound Hardener Additive (1qt)', sku: '100854', price: 15.95, unit: 'bottle' },
    { keywords: ['paint', 'sprayer', 'ready', 'primer'], title: 'Paint Sprayer-Ready Primer (1gal)', sku: '100855', price: 32.95, unit: 'gallon' },
    
    // Caulking & Sealants - General Purpose Caulk
    { keywords: ['acrylic', 'latex', 'caulk', 'paintable', 'caulking'], title: 'Acrylic Latex Caulk Paintable (10.1oz)', sku: '100856', price: 4.95, unit: 'tube' },
    { keywords: ['siliconized', 'acrylic', 'latex', 'caulk', 'caulking'], title: 'Siliconized Acrylic Latex Caulk (10.1oz)', sku: '100857', price: 6.95, unit: 'tube' },
    { keywords: ['latex', 'painters', 'caulk', 'caulking'], title: 'Latex Painter\'s Caulk (10.1oz)', sku: '100858', price: 3.95, unit: 'tube' },
    { keywords: ['water', 'based', 'caulk', 'interior', 'trim', 'caulking'], title: 'Water-Based Interior Caulk (10.1oz)', sku: '100859', price: 4.95, unit: 'tube' },
    { keywords: ['interior', 'wall', 'ceiling', 'crack', 'repair', 'caulk', 'caulking'], title: 'Interior Wall/Ceiling Crack Repair Caulk (10.1oz)', sku: '100860', price: 5.95, unit: 'tube' },
    { keywords: ['quick', 'dry', 'paintable', 'caulk', 'caulking'], title: 'Quick-Dry Paintable Caulk (10.1oz)', sku: '100861', price: 5.95, unit: 'tube' },
    
    // Caulking & Sealants - Exterior & Construction Sealants
    { keywords: ['polyurethane', 'sealant', 'concrete', 'masonry', 'expansion', 'caulking'], title: 'Polyurethane Sealant for Concrete/Masonry (10.1oz)', sku: '100862', price: 8.95, unit: 'tube' },
    { keywords: ['elastomeric', 'sealant', 'stucco', 'siding', 'windows', 'caulking'], title: 'Elastomeric Sealant for Stucco/Siding (10.1oz)', sku: '100863', price: 9.95, unit: 'tube' },
    { keywords: ['silicone', 'sealant', 'window', 'door', 'weatherproof', 'caulking'], title: '100% Silicone Sealant Weatherproof (10.1oz)', sku: '100864', price: 7.95, unit: 'tube' },
    { keywords: ['hybrid', 'polymer', 'sealant', 'multi', 'surface', 'caulking'], title: 'Hybrid Polymer Multi-Surface Sealant (10.1oz)', sku: '100865', price: 10.95, unit: 'tube' },
    { keywords: ['butyl', 'rubber', 'sealant', 'roofing', 'gutters', 'caulking'], title: 'Butyl Rubber Roofing/Gutter Sealant (10.1oz)', sku: '100866', price: 8.95, unit: 'tube' },
    { keywords: ['tripolymer', 'sealant', 'high', 'movement', 'exterior', 'caulking'], title: 'Tripolymer High-Movement Exterior Sealant (10.1oz)', sku: '100867', price: 11.95, unit: 'tube' },
    { keywords: ['asphalt', 'roof', 'sealant', 'flashing', 'caulking'], title: 'Asphalt Roof Sealant for Flashing (10.1oz)', sku: '100868', price: 7.95, unit: 'tube' },
    { keywords: ['gutter', 'sealant', 'aluminum', 'vinyl', 'caulking'], title: 'Gutter Sealant Aluminum/Vinyl (10.1oz)', sku: '100869', price: 6.95, unit: 'tube' },
    { keywords: ['concrete', 'crack', 'sealant', 'flexible', 'caulking'], title: 'Flexible Concrete Crack Sealant (10.1oz)', sku: '100870', price: 8.95, unit: 'tube' },
    { keywords: ['driveway', 'asphalt', 'crack', 'filler', 'caulking'], title: 'Driveway/Asphalt Crack Filler (10.1oz)', sku: '100871', price: 7.95, unit: 'tube' },
    { keywords: ['exterior', 'paintable', 'caulk', 'uv', 'moisture', 'caulking'], title: 'Exterior Paintable UV-Resistant Caulk (10.1oz)', sku: '100872', price: 6.95, unit: 'tube' },
    
    // Caulking & Sealants - Specialty Sealants
    { keywords: ['fire', 'rated', 'caulk', 'firestop', 'caulking'], title: 'Fire-Rated Caulk Firestop (10.1oz)', sku: '100873', price: 15.95, unit: 'tube' },
    { keywords: ['acoustic', 'sealant', 'soundproof', 'joints', 'caulking'], title: 'Acoustic Sealant for Soundproof Joints (10.1oz)', sku: '100874', price: 12.95, unit: 'tube' },
    { keywords: ['kitchen', 'bath', 'caulk', 'mildew', 'resistant', 'caulking'], title: 'Kitchen/Bath Mildew-Resistant Caulk (10.1oz)', sku: '100875', price: 8.95, unit: 'tube' },
    { keywords: ['tub', 'tile', 'caulk', 'white', 'caulking'], title: 'Tub & Tile Caulk White (10.1oz)', sku: '100876', price: 7.95, unit: 'tube' },
    { keywords: ['mold', 'mildew', 'resistant', 'caulk', 'caulking'], title: 'Mold & Mildew Resistant Caulk (10.1oz)', sku: '100877', price: 8.95, unit: 'tube' },
    { keywords: ['plumbing', 'grade', 'silicone', 'sealant', 'caulking'], title: 'Plumbing-Grade Silicone Sealant (10.1oz)', sku: '100878', price: 9.95, unit: 'tube' },
    { keywords: ['aquarium', 'grade', 'silicone', 'caulking'], title: 'Aquarium-Grade Silicone (10.1oz)', sku: '100879', price: 11.95, unit: 'tube' },
    { keywords: ['high', 'temperature', 'silicone', 'chimney', 'caulking'], title: 'High-Temperature Silicone for Chimneys (10.1oz)', sku: '100880', price: 12.95, unit: 'tube' },
    { keywords: ['roof', 'leak', 'repair', 'sealant', 'caulking'], title: 'Roof Leak Repair Sealant (10.1oz)', sku: '100881', price: 9.95, unit: 'tube' },
    { keywords: ['flashing', 'roof', 'joint', 'mastic', 'caulking'], title: 'Flashing & Roof Joint Mastic (10.1oz)', sku: '100882', price: 8.95, unit: 'tube' },
    { keywords: ['expansion', 'joint', 'backer', 'rod', 'foam', 'caulking'], title: 'Expansion Joint Backer Rod Foam (20ft)', sku: '100883', price: 4.95, unit: 'length' },
    { keywords: ['joint', 'filler', 'pre', 'compressed', 'foam', 'caulking'], title: 'Joint Filler Pre-Compressed Foam Strip (20ft)', sku: '100884', price: 5.95, unit: 'length' },
    { keywords: ['window', 'door', 'foam', 'sealant', 'low', 'expansion', 'caulking'], title: 'Window/Door Low-Expansion Foam Sealant (12oz)', sku: '100885', price: 6.95, unit: 'can' },
    { keywords: ['gap', 'crack', 'spray', 'foam', 'sealant', 'caulking'], title: 'Gap & Crack Spray Foam Sealant (12oz)', sku: '100886', price: 7.95, unit: 'can' },
    { keywords: ['subfloor', 'construction', 'adhesive', 'sealant', 'caulking'], title: 'Subfloor Construction Adhesive/Sealant (28oz)', sku: '100887', price: 12.95, unit: 'tube' },
    { keywords: ['air', 'sealing', 'foam', 'penetrations', 'hvac', 'caulking'], title: 'Air-Sealing Foam for Penetrations (12oz)', sku: '100888', price: 8.95, unit: 'can' },
    
    // Caulking & Sealants - Popular Brands
    { keywords: ['dap', 'alex', 'plus', 'caulk', 'caulking'], title: 'DAP Alex Plus Paintable Caulk (10.1oz)', sku: '100889', price: 4.95, unit: 'tube' },
    { keywords: ['dap', 'dynaflex', '230', 'caulk', 'caulking'], title: 'DAP Dynaflex 230 Sealant (10.1oz)', sku: '100890', price: 6.95, unit: 'tube' },
    { keywords: ['ge', 'silicone', 'advanced', 'caulk', 'caulking'], title: 'GE Advanced Silicone Sealant (10.1oz)', sku: '100891', price: 7.95, unit: 'tube' },
    { keywords: ['ge', 'kitchen', 'bath', 'caulk', 'caulking'], title: 'GE Kitchen & Bath Silicone (10.1oz)', sku: '100892', price: 8.95, unit: 'tube' },
    { keywords: ['sashco', 'big', 'stretch', 'caulk', 'caulking'], title: 'Sashco Big Stretch Sealant (10.1oz)', sku: '100893', price: 9.95, unit: 'tube' },
    { keywords: ['loctite', 'pl', 's10', 'sealant', 'caulking'], title: 'Loctite PL S10 Construction Sealant (10.1oz)', sku: '100894', price: 8.95, unit: 'tube' },
    { keywords: ['3m', 'fire', 'barrier', 'sealant', 'caulking'], title: '3M Fire Barrier Sealant (10.1oz)', sku: '100895', price: 15.95, unit: 'tube' },
    { keywords: ['sika', 'sikaflex', 'construction', 'sealant', 'caulking'], title: 'Sika Sikaflex Construction Sealant (10.1oz)', sku: '100896', price: 11.95, unit: 'tube' },
    
    // Caulking & Sealants - Application Tools
    { keywords: ['manual', 'caulk', 'gun', 'standard', 'caulking'], title: 'Manual Caulk Gun Standard (1)', sku: '100897', price: 8.95, unit: 'each' },
    { keywords: ['dripless', 'caulk', 'gun', 'caulking'], title: 'Dripless Caulk Gun (1)', sku: '100898', price: 12.95, unit: 'each' },
    { keywords: ['battery', 'powered', 'caulk', 'gun', 'caulking'], title: 'Battery-Powered Caulk Gun (1)', sku: '100899', price: 45.95, unit: 'each' },
    { keywords: ['caulk', 'nozzle', 'tips', 'standard', 'caulking'], title: 'Caulk Nozzle Tips Standard (10)', sku: '100900', price: 3.95, unit: 'pack' },
    { keywords: ['caulk', 'finishing', 'tool', 'smoothing', 'caulking'], title: 'Caulk Finishing Tool/Smoothing Spatula (1)', sku: '100901', price: 4.95, unit: 'each' },
    { keywords: ['caulk', 'tube', 'caps', 'plugs', 'caulking'], title: 'Caulk Tube Caps & Plugs (25)', sku: '100902', price: 2.95, unit: 'pack' },
    { keywords: ['caulk', 'removal', 'tool', 'caulking'], title: 'Caulk Removal Tool (1)', sku: '100903', price: 6.95, unit: 'each' },
    { keywords: ['caulk', 'softener', 'remover', 'gel', 'caulking'], title: 'Caulk Softener/Remover Gel (8oz)', sku: '100904', price: 8.95, unit: 'bottle' },
    
    // Caulking & Sealants - Colors & Finishes
    { keywords: ['white', 'caulk', 'paintable', 'caulking'], title: 'White Paintable Caulk (10.1oz)', sku: '100905', price: 4.95, unit: 'tube' },
    { keywords: ['clear', 'silicone', 'caulk', 'caulking'], title: 'Clear Silicone Caulk (10.1oz)', sku: '100906', price: 6.95, unit: 'tube' },
    { keywords: ['almond', 'caulk', 'beige', 'caulking'], title: 'Almond/Beige Caulk (10.1oz)', sku: '100907', price: 4.95, unit: 'tube' },
    { keywords: ['gray', 'caulk', 'paintable', 'caulking'], title: 'Gray Paintable Caulk (10.1oz)', sku: '100908', price: 4.95, unit: 'tube' },
    { keywords: ['brown', 'bronze', 'caulk', 'caulking'], title: 'Brown/Bronze Caulk (10.1oz)', sku: '100909', price: 4.95, unit: 'tube' },
    { keywords: ['black', 'caulk', 'sealant', 'caulking'], title: 'Black Caulk/Sealant (10.1oz)', sku: '100910', price: 5.95, unit: 'tube' },
    { keywords: ['sandstone', 'tan', 'caulk', 'caulking'], title: 'Sandstone/Tan Caulk (10.1oz)', sku: '100911', price: 4.95, unit: 'tube' },
    { keywords: ['wire', 'mesh'], title: 'Wire Mesh 6x6', sku: '100708', price: 15.00, unit: 'sheet' },
    { keywords: ['concrete', 'form', 'board'], title: 'Concrete Form Board', sku: '100709', price: 18.00, unit: 'sheet' },
    { keywords: ['concrete', 'anchor'], title: 'Concrete Anchors', sku: '100710', price: 12.00, unit: 'box' },
    { keywords: ['mortar', 'mix'], title: 'Mortar Mix (80lb)', sku: '100711', price: 6.50, unit: 'bag' },
    { keywords: ['type', 's', 'mortar'], title: 'Type S Mortar (80lb)', sku: '100712', price: 7.50, unit: 'bag' },
    { keywords: ['grout', 'concrete'], title: 'Concrete Grout', sku: '100713', price: 8.50, unit: 'bag' },
    
    // Flooring
    { keywords: ['lvp', 'vinyl'], title: 'LVP Flooring (SF)', sku: '100593', price: 2.80, unit: 'sq ft' },
    { keywords: ['hardwood', 'wood'], title: 'Hardwood Flooring (SF)', sku: '100594', price: 5.50, unit: 'sq ft' },
    { keywords: ['underlayment'], title: 'Floor Underlayment', sku: '100595', price: 38.00, unit: 'roll' },
    
    // Fixtures
    { keywords: ['sink', 'undermount'], title: 'Undermount Sink', sku: '100596', price: 220.00, unit: 'each' },
    { keywords: ['faucet'], title: 'Kitchen Faucet', sku: '100597', price: 135.00, unit: 'each' },
    { keywords: ['toilet'], title: 'Toilet', sku: '100598', price: 225.00, unit: 'each' },
    
    // Insulation & HVAC
    { keywords: ['insulation', 'fiberglass', 'batts'], title: 'Fiberglass Insulation Batts', sku: '100800', price: 45.00, unit: 'bundle' },
    { keywords: ['insulation', 'spray', 'foam'], title: 'Spray Foam Insulation', sku: '100801', price: 125.00, unit: 'kit' },
    { keywords: ['ductwork', 'flex'], title: 'Flexible Ductwork', sku: '100802', price: 2.50, unit: 'foot' },
    { keywords: ['register', 'vent'], title: 'Air Register', sku: '100803', price: 15.00, unit: 'each' },
    { keywords: ['filter', 'air'], title: 'Air Filter 20x25', sku: '100804', price: 12.00, unit: 'each' },
    
    // Roofing
    { keywords: ['shingle', 'asphalt'], title: 'Asphalt Shingles (sq)', sku: '100805', price: 85.00, unit: 'square' },
    { keywords: ['roofing', 'felt', 'paper'], title: 'Roofing Felt', sku: '100806', price: 35.00, unit: 'roll' },
    { keywords: ['flashing', 'roof'], title: 'Roof Flashing', sku: '100807', price: 18.00, unit: 'piece' },
    { keywords: ['gutter', 'aluminum'], title: 'Aluminum Gutter', sku: '100808', price: 8.50, unit: 'foot' },
    { keywords: ['downspout'], title: 'Downspout', sku: '100809', price: 6.50, unit: 'foot' },
    
    // Hardware & Fasteners
    { keywords: ['screw', 'deck'], title: 'Deck Screws (5lb)', sku: '100810', price: 28.00, unit: 'box' },
    { keywords: ['nail', 'framing'], title: 'Framing Nails (50lb)', sku: '100811', price: 45.00, unit: 'box' },
    { keywords: ['bolt', 'lag'], title: 'Lag Bolts', sku: '100812', price: 0.85, unit: 'each' },
    { keywords: ['washer', 'flat'], title: 'Flat Washers', sku: '100813', price: 0.15, unit: 'each' },
    { keywords: ['hinge', 'door'], title: 'Door Hinges', sku: '100814', price: 8.50, unit: 'pair' },
    
    // Appliances
    { keywords: ['range', 'stove'], title: 'Range/Stove', sku: '100599', price: 850.00, unit: 'each' },
    { keywords: ['refrigerator', 'fridge'], title: 'Refrigerator', sku: '100600', price: 1200.00, unit: 'each' },
    { keywords: ['dishwasher'], title: 'Dishwasher', sku: '100601', price: 650.00, unit: 'each' },
    { keywords: ['microwave'], title: 'Microwave', sku: '100602', price: 250.00, unit: 'each' },
    
    // Paint & Coating Materials - Primers & Sealers
    { keywords: ['pva', 'drywall', 'primer', 'sealer', 'paint'], title: 'PVA Drywall Primer/Sealer', sku: '102001', price: 28.95, unit: 'gallon' },
    { keywords: ['bonding', 'primer', 'glossy', 'slick', 'surfaces', 'paint'], title: 'Bonding Primer Glossy Surfaces', sku: '102002', price: 35.95, unit: 'gallon' },
    { keywords: ['stain', 'blocking', 'primer', 'kilz', 'paint'], title: 'Stain-Blocking Primer Kilz', sku: '102003', price: 32.95, unit: 'gallon' },
    { keywords: ['zinsser', 'bin', 'shellac', 'primer', 'paint'], title: 'Zinsser BIN Shellac Primer', sku: '102004', price: 42.95, unit: 'gallon' },
    { keywords: ['masonry', 'primer', 'block', 'fill', 'paint'], title: 'Masonry Primer Block Fill', sku: '102005', price: 38.95, unit: 'gallon' },
    { keywords: ['alkali', 'resistant', 'primer', 'masonry', 'paint'], title: 'Alkali-Resistant Masonry Primer', sku: '102006', price: 45.95, unit: 'gallon' },
    { keywords: ['metal', 'primer', 'rust', 'inhibiting', 'paint'], title: 'Metal Primer Rust-Inhibiting', sku: '102007', price: 48.95, unit: 'gallon' },
    { keywords: ['wood', 'primer', 'interior', 'exterior', 'paint'], title: 'Wood Primer Interior/Exterior', sku: '102008', price: 35.95, unit: 'gallon' },
    { keywords: ['tannin', 'blocking', 'primer', 'wood', 'paint'], title: 'Tannin-Blocking Wood Primer', sku: '102009', price: 42.95, unit: 'gallon' },
    { keywords: ['multi', 'surface', 'primer', 'latex', 'paint'], title: 'Multi-Surface Primer Latex', sku: '102010', price: 32.95, unit: 'gallon' },
    { keywords: ['odor', 'sealing', 'primer', 'shellac', 'paint'], title: 'Odor-Sealing Primer Shellac', sku: '102011', price: 52.95, unit: 'gallon' },
    { keywords: ['adhesion', 'promoter', 'vinyl', 'tile', 'paint'], title: 'Adhesion Promoter Vinyl/Tile', sku: '102012', price: 38.95, unit: 'gallon' },
    
    // Interior Paints
    { keywords: ['flat', 'matte', 'paint', 'ceiling', 'interior'], title: 'Flat/Matte Interior Paint', sku: '102013', price: 32.95, unit: 'gallon' },
    { keywords: ['eggshell', 'paint', 'interior', 'living', 'bedroom'], title: 'Eggshell Interior Paint', sku: '102014', price: 35.95, unit: 'gallon' },
    { keywords: ['satin', 'paint', 'interior', 'kitchen', 'bath'], title: 'Satin Interior Paint', sku: '102015', price: 38.95, unit: 'gallon' },
    { keywords: ['semi', 'gloss', 'paint', 'trim', 'doors'], title: 'Semi-Gloss Interior Paint', sku: '102016', price: 42.95, unit: 'gallon' },
    { keywords: ['high', 'gloss', 'paint', 'accent', 'furniture'], title: 'High-Gloss Interior Paint', sku: '102017', price: 48.95, unit: 'gallon' },
    { keywords: ['ceiling', 'paint', 'spatter', 'resistant', 'white'], title: 'Ceiling Paint Spatter-Resistant', sku: '102018', price: 28.95, unit: 'gallon' },
    { keywords: ['kitchen', 'bath', 'mildew', 'resistant', 'paint'], title: 'Kitchen & Bath Mildew-Resistant Paint', sku: '102019', price: 45.95, unit: 'gallon' },
    { keywords: ['zero', 'voc', 'low', 'odor', 'paint'], title: 'Zero-VOC Low-Odor Paint', sku: '102020', price: 52.95, unit: 'gallon' },
    { keywords: ['eco', 'friendly', 'paint', 'green'], title: 'Eco-Friendly Green Paint', sku: '102021', price: 48.95, unit: 'gallon' },
    { keywords: ['color', 'matching', 'base', 'tinted', 'paint'], title: 'Color-Matching Tinted Base A', sku: '102022', price: 32.95, unit: 'gallon' },
    { keywords: ['deep', 'base', 'color', 'matching', 'paint'], title: 'Deep Base Color-Matching Paint', sku: '102023', price: 38.95, unit: 'gallon' },
    
    // Exterior Paints
    { keywords: ['exterior', 'flat', 'satin', 'siding', 'paint'], title: 'Exterior Flat/Satin Paint', sku: '102024', price: 42.95, unit: 'gallon' },
    { keywords: ['exterior', 'semi', 'gloss', 'trim', 'doors'], title: 'Exterior Semi-Gloss Paint', sku: '102025', price: 45.95, unit: 'gallon' },
    { keywords: ['high', 'durability', 'enamel', 'metal', 'wood'], title: 'High-Durability Enamel Paint', sku: '102026', price: 52.95, unit: 'gallon' },
    { keywords: ['elastomeric', 'wall', 'coating', 'stucco', 'paint'], title: 'Elastomeric Wall Coating', sku: '102027', price: 85.95, unit: 'gallon' },
    { keywords: ['masonry', 'concrete', 'paint', 'porch', 'patio'], title: 'Masonry & Concrete Paint', sku: '102028', price: 48.95, unit: 'gallon' },
    { keywords: ['metal', 'roof', 'siding', 'paint', 'exterior'], title: 'Metal Roof & Siding Paint', sku: '102029', price: 55.95, unit: 'gallon' },
    { keywords: ['urethane', 'fortified', 'exterior', 'paint'], title: 'Urethane-Fortified Exterior Paint', sku: '102030', price: 65.95, unit: 'gallon' },
    
    // Stains, Sealers & Clear Finishes
    { keywords: ['interior', 'wood', 'stain', 'oil', 'based'], title: 'Interior Wood Stain Oil-Based', sku: '102031', price: 35.95, unit: 'quart' },
    { keywords: ['gel', 'stain', 'wood', 'interior'], title: 'Gel Wood Stain Interior', sku: '102032', price: 38.95, unit: 'quart' },
    { keywords: ['water', 'based', 'stain', 'wood'], title: 'Water-Based Wood Stain', sku: '102033', price: 32.95, unit: 'quart' },
    { keywords: ['exterior', 'deck', 'stain', 'semi', 'transparent'], title: 'Exterior Deck Stain Semi-Transparent', sku: '102034', price: 42.95, unit: 'gallon' },
    { keywords: ['solid', 'stain', 'deck', 'fence', 'exterior'], title: 'Solid Deck & Fence Stain', sku: '102035', price: 38.95, unit: 'gallon' },
    { keywords: ['polyurethane', 'clear', 'coat', 'oil', 'based'], title: 'Polyurethane Clear Coat Oil-Based', sku: '102036', price: 28.95, unit: 'quart' },
    { keywords: ['water', 'based', 'polyurethane', 'clear'], title: 'Water-Based Polyurethane Clear', sku: '102037', price: 32.95, unit: 'quart' },
    { keywords: ['lacquer', 'nitrocellulose', 'clear', 'finish'], title: 'Lacquer Nitrocellulose Clear', sku: '102038', price: 35.95, unit: 'quart' },
    { keywords: ['acrylic', 'lacquer', 'clear', 'finish'], title: 'Acrylic Lacquer Clear Finish', sku: '102039', price: 38.95, unit: 'quart' },
    { keywords: ['shellac', 'amber', 'clear', 'finish'], title: 'Shellac Amber/Clear Finish', sku: '102040', price: 25.95, unit: 'quart' },
    { keywords: ['concrete', 'sealer', 'acrylic', 'penetrating'], title: 'Concrete Sealer Acrylic', sku: '102041', price: 45.95, unit: 'gallon' },
    { keywords: ['silane', 'siloxane', 'concrete', 'sealer'], title: 'Silane-Siloxane Concrete Sealer', sku: '102042', price: 52.95, unit: 'gallon' },
    { keywords: ['epoxy', 'concrete', 'sealer'], title: 'Epoxy Concrete Sealer', sku: '102043', price: 65.95, unit: 'gallon' },
    { keywords: ['driveway', 'garage', 'sealer', 'latex'], title: 'Driveway & Garage Sealer Latex', sku: '102044', price: 38.95, unit: 'gallon' },
    { keywords: ['epoxy', 'garage', 'floor', 'sealer'], title: 'Epoxy Garage Floor Sealer', sku: '102045', price: 75.95, unit: 'gallon' },
    { keywords: ['brick', 'stucco', 'masonry', 'sealer'], title: 'Brick, Stucco & Masonry Sealer', sku: '102046', price: 48.95, unit: 'gallon' },
    { keywords: ['stone', 'enhancer', 'sealer', 'natural'], title: 'Stone Enhancer & Sealer', sku: '102047', price: 55.95, unit: 'gallon' },
    
    // Specialty Coatings
    { keywords: ['chalkboard', 'paint', 'dry', 'erase'], title: 'Chalkboard & Dry-Erase Paint', sku: '102048', price: 42.95, unit: 'quart' },
    { keywords: ['cabinet', 'furniture', 'refinishing', 'enamel'], title: 'Cabinet & Furniture Refinishing Enamel', sku: '102049', price: 45.95, unit: 'quart' },
    { keywords: ['appliance', 'epoxy', 'paint'], title: 'Appliance Epoxy Paint', sku: '102050', price: 35.95, unit: 'spray' },
    { keywords: ['tub', 'tile', 'epoxy', 'refinishing', 'kit'], title: 'Tub & Tile Epoxy Refinishing Kit', sku: '102051', price: 85.95, unit: 'kit' },
    { keywords: ['high', 'heat', 'paint', 'grill', 'fireplace'], title: 'High-Heat Paint Grill/Fireplace', sku: '102052', price: 38.95, unit: 'spray' },
    { keywords: ['rust', 'converter', 'metal', 'enamel'], title: 'Rust Converter & Metal Enamel', sku: '102053', price: 32.95, unit: 'spray' },
    { keywords: ['roof', 'coating', 'elastomeric', 'aluminum'], title: 'Roof Coating Elastomeric', sku: '102054', price: 125.95, unit: 'gallon' },
    { keywords: ['aluminum', 'fibered', 'roof', 'coating'], title: 'Aluminum Fibered Roof Coating', sku: '102055', price: 95.95, unit: 'gallon' },
    { keywords: ['waterproofing', 'coating', 'basement', 'walls'], title: 'Waterproofing Coating Basement', sku: '102056', price: 85.95, unit: 'gallon' },
    { keywords: ['garage', 'floor', 'epoxy', 'kit'], title: 'Garage Floor Epoxy Kit', sku: '102057', price: 145.95, unit: 'kit' },
    { keywords: ['anti', 'slip', 'traction', 'additive'], title: 'Anti-Slip Traction Additive', sku: '102058', price: 18.95, unit: 'quart' },
    { keywords: ['general', 'purpose', 'spray', 'paint'], title: 'General Purpose Spray Paint', sku: '102059', price: 8.95, unit: 'spray' },
    { keywords: ['metallic', 'spray', 'paint'], title: 'Metallic Spray Paint', sku: '102060', price: 12.95, unit: 'spray' },
    
    // Paint Tools & Supplies
    { keywords: ['angled', 'sash', 'brush', 'paint', 'tools'], title: 'Angled Sash Brush', sku: '102061', price: 15.95, unit: 'each' },
    { keywords: ['flat', 'brush', 'paint', 'tools'], title: 'Flat Paint Brush', sku: '102062', price: 12.95, unit: 'each' },
    { keywords: ['trim', 'brush', 'paint', 'tools'], title: 'Trim Paint Brush', sku: '102063', price: 18.95, unit: 'each' },
    { keywords: ['roller', 'cover', 'quarter', 'inch', 'nap'], title: 'Roller Cover 1/4" Nap', sku: '102064', price: 8.95, unit: 'each' },
    { keywords: ['roller', 'cover', 'three', 'eighth', 'nap'], title: 'Roller Cover 3/8" Nap', sku: '102065', price: 9.95, unit: 'each' },
    { keywords: ['roller', 'cover', 'half', 'inch', 'nap'], title: 'Roller Cover 1/2" Nap', sku: '102066', price: 10.95, unit: 'each' },
    { keywords: ['roller', 'cover', 'three', 'quarter', 'nap'], title: 'Roller Cover 3/4" Nap', sku: '102067', price: 12.95, unit: 'each' },
    { keywords: ['roller', 'frame', 'paint', 'tools'], title: 'Roller Frame', sku: '102068', price: 15.95, unit: 'each' },
    { keywords: ['extension', 'pole', 'roller', 'paint'], title: 'Extension Pole Roller', sku: '102069', price: 25.95, unit: 'each' },
    { keywords: ['paint', 'tray', 'liners'], title: 'Paint Tray & Liners', sku: '102070', price: 8.95, unit: 'set' },
    { keywords: ['paint', 'grid', 'five', 'gallon', 'bucket'], title: 'Paint Grid 5-Gal Bucket', sku: '102071', price: 12.95, unit: 'each' },
    { keywords: ['airless', 'paint', 'sprayer'], title: 'Airless Paint Sprayer', sku: '102072', price: 185.95, unit: 'each' },
    { keywords: ['hvlp', 'paint', 'sprayer'], title: 'HVLP Paint Sprayer', sku: '102073', price: 125.95, unit: 'each' },
    { keywords: ['spray', 'gun', 'tips', 'filters'], title: 'Spray-Gun Tips & Filters', sku: '102074', price: 15.95, unit: 'pack' },
    { keywords: ['paint', 'mixer', 'paddle'], title: 'Paint Mixer & Paddle', sku: '102075', price: 25.95, unit: 'each' },
    { keywords: ['paint', 'strainer', 'funnel'], title: 'Paint Strainers & Funnels', sku: '102076', price: 8.95, unit: 'pack' },
    { keywords: ['painters', 'tape', 'delicate'], title: 'Painter\'s Tape Delicate', sku: '102077', price: 6.95, unit: 'roll' },
    { keywords: ['multi', 'surface', 'painters', 'tape'], title: 'Multi-Surface Painter\'s Tape', sku: '102078', price: 8.95, unit: 'roll' },
    { keywords: ['exterior', 'painters', 'tape'], title: 'Exterior Painter\'s Tape', sku: '102079', price: 12.95, unit: 'roll' },
    { keywords: ['canvas', 'drop', 'cloth'], title: 'Canvas Drop Cloth', sku: '102080', price: 18.95, unit: 'each' },
    { keywords: ['plastic', 'drop', 'cloth'], title: 'Plastic Drop Cloth', sku: '102081', price: 8.95, unit: 'each' },
    { keywords: ['paper', 'drop', 'cloth'], title: 'Paper Drop Cloth', sku: '102082', price: 5.95, unit: 'each' },
    { keywords: ['masking', 'film', 'dispenser'], title: 'Masking Film & Dispenser', sku: '102083', price: 15.95, unit: 'each' },
    { keywords: ['sandpaper', 'sanding', 'sponge', 'grit'], title: 'Sandpaper & Sanding Sponge', sku: '102084', price: 8.95, unit: 'pack' },
    { keywords: ['tack', 'cloth', 'dust', 'wipes'], title: 'Tack Cloths & Dust Wipes', sku: '102085', price: 6.95, unit: 'pack' },
    { keywords: ['caulking', 'gun', 'finishing', 'tools'], title: 'Caulking Gun & Finishing Tools', sku: '102086', price: 12.95, unit: 'each' },
    { keywords: ['spackling', 'compound', 'wall', 'patch'], title: 'Spackling Compound Wall Patch', sku: '102087', price: 8.95, unit: 'tube' },
    { keywords: ['putty', 'knife', 'flex', 'stiff'], title: 'Putty Knife Flex/Stiff', sku: '102088', price: 6.95, unit: 'each' },
    { keywords: ['paint', 'edger', 'corner', 'pad'], title: 'Paint Edger & Corner Pad', sku: '102089', price: 15.95, unit: 'each' },
    { keywords: ['ladder', 'hooks', 'paint', 'bucket'], title: 'Ladder Hooks & Paint Bucket', sku: '102090', price: 22.95, unit: 'each' },
    { keywords: ['paint', 'can', 'opener', 'pour', 'spout'], title: 'Paint Can Opener & Pour Spout', sku: '102091', price: 8.95, unit: 'each' },
    { keywords: ['paint', 'storage', 'lids'], title: 'Paint Storage Lids', sku: '102092', price: 4.95, unit: 'each' },
    
    // Cleaning & Surface Prep
    { keywords: ['degreaser', 'tsp', 'substitute', 'paint'], title: 'Degreaser & TSP Substitute', sku: '102093', price: 12.95, unit: 'bottle' },
    { keywords: ['de', 'glosser', 'liquid', 'sandpaper'], title: 'De-Glosser Liquid Sandpaper', sku: '102094', price: 15.95, unit: 'bottle' },
    { keywords: ['paint', 'remover', 'stripper', 'gel'], title: 'Paint Remover/Stripper Gel', sku: '102095', price: 18.95, unit: 'bottle' },
    { keywords: ['citrus', 'paint', 'stripper'], title: 'Citrus Paint Stripper', sku: '102096', price: 22.95, unit: 'bottle' },
    { keywords: ['mineral', 'spirits', 'paint', 'thinner'], title: 'Mineral Spirits Paint Thinner', sku: '102097', price: 12.95, unit: 'gallon' },
    { keywords: ['denatured', 'alcohol', 'cleaner'], title: 'Denatured Alcohol Cleaner', sku: '102098', price: 15.95, unit: 'gallon' },
    { keywords: ['rags', 'microfiber', 'cloths'], title: 'Rags & Microfiber Cloths', sku: '102099', price: 8.95, unit: 'pack' },
    { keywords: ['plastic', 'scrapers'], title: 'Plastic Scrapers', sku: '102100', price: 6.95, unit: 'pack' },
    { keywords: ['steel', 'wool', 'wire', 'brushes'], title: 'Steel Wool & Wire Brushes', sku: '102101', price: 8.95, unit: 'pack' },
    
    // Tile, Thinset, Grout & Surface Prep Materials - Tile Types
    { keywords: ['ceramic', 'wall', 'tile', 'glazed', 'unglazed'], title: 'Ceramic Wall Tile Glazed/Unglazed', sku: '103001', price: 2.95, unit: 'sqft' },
    { keywords: ['ceramic', 'floor', 'tile', 'matte', 'polished'], title: 'Ceramic Floor Tile Matte/Polished', sku: '103002', price: 3.95, unit: 'sqft' },
    { keywords: ['porcelain', 'tile', 'rectified', 'polished'], title: 'Porcelain Tile Rectified Polished', sku: '103003', price: 4.95, unit: 'sqft' },
    { keywords: ['porcelain', 'tile', 'matte', 'textured'], title: 'Porcelain Tile Matte Textured', sku: '103004', price: 4.45, unit: 'sqft' },
    { keywords: ['mosaic', 'tile', 'glass', 'ceramic', 'marble'], title: 'Mosaic Tile Glass/Ceramic/Marble', sku: '103005', price: 8.95, unit: 'sqft' },
    { keywords: ['subway', 'tile', '3x6', '4x12', 'beveled'], title: 'Subway Tile 3x6 Beveled Edge', sku: '103006', price: 2.45, unit: 'sqft' },
    { keywords: ['subway', 'tile', '4x12', 'beveled'], title: 'Subway Tile 4x12 Beveled Edge', sku: '103007', price: 2.75, unit: 'sqft' },
    { keywords: ['natural', 'stone', 'tile', 'marble'], title: 'Natural Stone Tile Marble', sku: '103008', price: 12.95, unit: 'sqft' },
    { keywords: ['travertine', 'tile', 'natural', 'stone'], title: 'Travertine Natural Stone Tile', sku: '103009', price: 8.95, unit: 'sqft' },
    { keywords: ['slate', 'tile', 'natural', 'stone'], title: 'Slate Natural Stone Tile', sku: '103010', price: 6.95, unit: 'sqft' },
    { keywords: ['limestone', 'tile', 'natural', 'stone'], title: 'Limestone Natural Stone Tile', sku: '103011', price: 7.95, unit: 'sqft' },
    { keywords: ['granite', 'tile', 'natural', 'stone'], title: 'Granite Natural Stone Tile', sku: '103012', price: 15.95, unit: 'sqft' },
    { keywords: ['quarry', 'tile', 'commercial', 'kitchen'], title: 'Quarry Tile Commercial Kitchen', sku: '103013', price: 2.95, unit: 'sqft' },
    { keywords: ['large', 'format', 'tile', '12x24'], title: 'Large Format Tile 12x24', sku: '103014', price: 5.95, unit: 'sqft' },
    { keywords: ['large', 'format', 'tile', '24x24'], title: 'Large Format Tile 24x24', sku: '103015', price: 6.95, unit: 'sqft' },
    { keywords: ['large', 'format', 'tile', '24x48'], title: 'Large Format Tile 24x48', sku: '103016', price: 8.95, unit: 'sqft' },
    { keywords: ['hexagon', 'tile', 'ceramic', 'porcelain'], title: 'Hexagon Tile Ceramic/Porcelain', sku: '103017', price: 4.95, unit: 'sqft' },
    { keywords: ['hexagon', 'tile', 'marble'], title: 'Hexagon Tile Marble', sku: '103018', price: 12.95, unit: 'sqft' },
    { keywords: ['penny', 'round', 'mosaic', 'tile'], title: 'Penny Round Mosaic Tile', sku: '103019', price: 6.95, unit: 'sqft' },
    { keywords: ['glass', 'tile', 'backsplash', 'accent'], title: 'Glass Tile Backsplash Accent', sku: '103020', price: 15.95, unit: 'sqft' },
    { keywords: ['metal', 'mixed', 'media', 'accent', 'tile'], title: 'Metal & Mixed-Media Accent Tile', sku: '103021', price: 18.95, unit: 'sqft' },
    { keywords: ['outdoor', 'porcelain', 'pavers', '20mm'], title: 'Outdoor Porcelain Pavers 20mm', sku: '103022', price: 8.95, unit: 'sqft' },
    { keywords: ['wood', 'look', 'porcelain', 'planks'], title: 'Wood-Look Porcelain Planks', sku: '103023', price: 6.95, unit: 'sqft' },
    { keywords: ['cement', 'encaustic', 'decorative', 'tile'], title: 'Cement/Encaustic Decorative Tile', sku: '103024', price: 12.95, unit: 'sqft' },
    { keywords: ['peel', 'stick', 'backsplash', 'tile'], title: 'Peel-and-Stick Backsplash Tile', sku: '103025', price: 3.95, unit: 'sqft' },
    
    // Backer Boards & Underlayments
    { keywords: ['tile', 'hardiebacker', 'cement', 'board', 'quarter'], title: 'HardieBacker Cement Board 1/4"', sku: '103026', price: 18.95, unit: 'sheet' },
    { keywords: ['tile', 'hardiebacker', 'cement', 'board', 'half'], title: 'HardieBacker Cement Board 1/2"', sku: '103027', price: 22.95, unit: 'sheet' },
    { keywords: ['tile', 'durock', 'cement', 'board', 'quarter'], title: 'Durock Cement Board 1/4"', sku: '103028', price: 16.95, unit: 'sheet' },
    { keywords: ['tile', 'durock', 'cement', 'board', 'half'], title: 'Durock Cement Board 1/2"', sku: '103029', price: 20.95, unit: 'sheet' },
    { keywords: ['tile', 'wonderboard', 'cement', 'board'], title: 'WonderBoard Cement Board', sku: '103030', price: 15.95, unit: 'sheet' },
    { keywords: ['tile', 'fiber', 'cement', 'underlayment', 'board'], title: 'Fiber Cement Underlayment Board', sku: '103031', price: 17.95, unit: 'sheet' },
    { keywords: ['tile', 'kerdi', 'board', 'foam', 'backer'], title: 'Schluter Kerdi-Board Foam Backer', sku: '103032', price: 45.95, unit: 'sheet' },
    { keywords: ['tile', 'wedi', 'foam', 'backer', 'board'], title: 'Wedi Foam Backer Board', sku: '103033', price: 42.95, unit: 'sheet' },
    { keywords: ['tile', 'ditra', 'uncoupling', 'membrane'], title: 'Schluter-DITRA Uncoupling Membrane', sku: '103034', price: 2.95, unit: 'sqft' },
    { keywords: ['tile', 'provaflex', 'uncoupling', 'membrane'], title: 'ProvaFlex Uncoupling Membrane', sku: '103035', price: 2.45, unit: 'sqft' },
    { keywords: ['tile', 'redgard', 'waterproof', 'membrane'], title: 'RedGard Waterproof Membrane', sku: '103036', price: 65.95, unit: 'gallon' },
    { keywords: ['tile', 'aquadefense', 'waterproof', 'membrane'], title: 'Mapei AquaDefense Waterproof', sku: '103037', price: 55.95, unit: 'gallon' },
    { keywords: ['tile', 'hydroban', 'waterproof', 'membrane'], title: 'Laticrete HydroBan Waterproof', sku: '103038', price: 75.95, unit: 'gallon' },
    { keywords: ['tile', 'crack', 'isolation', 'membrane'], title: 'Crack Isolation Membrane', sku: '103039', price: 1.95, unit: 'sqft' },
    { keywords: ['tile', 'quietwalk', 'sound', 'reduction', 'underlayment'], title: 'QuietWalk Sound Reduction Underlayment', sku: '103040', price: 1.25, unit: 'sqft' },
    { keywords: ['tile', 'cork', 'underlayment', 'sound'], title: 'Cork Sound Underlayment', sku: '103041', price: 2.95, unit: 'sqft' },
    { keywords: ['tile', 'backer', 'screws', 'washers'], title: 'Tile Backer Screws & Washers', sku: '103042', price: 12.95, unit: 'box' },
    { keywords: ['tile', 'alkali', 'resistant', 'mesh', 'tape'], title: 'Alkali-Resistant Mesh Tape', sku: '103043', price: 8.95, unit: 'roll' },
    { keywords: ['tile', 'densshield', 'backer'], title: 'DensShield Tile Backer', sku: '103044', price: 19.95, unit: 'sheet' },
    { keywords: ['tile', 'goboard', 'waterproof', 'panel'], title: 'GoBoard Waterproof Panel', sku: '103045', price: 38.95, unit: 'sheet' },
    
    // Mortars, Thinsets & Adhesives
    { keywords: ['tile', 'thinset', 'mortar', 'standard', 'polymer'], title: 'Standard Polymer-Modified Thinset', sku: '103046', price: 18.95, unit: 'bag' },
    { keywords: ['tile', 'unmodified', 'thinset', 'ansi', 'a118'], title: 'Unmodified Thinset ANSI A118.1', sku: '103047', price: 15.95, unit: 'bag' },
    { keywords: ['tile', 'modified', 'thinset', 'ansi', 'a118'], title: 'Modified Thinset ANSI A118.4', sku: '103048', price: 22.95, unit: 'bag' },
    { keywords: ['tile', 'premium', 'latex', 'fortified', 'thinset'], title: 'Premium Latex-Fortified Thinset', sku: '103049', price: 28.95, unit: 'bag' },
    { keywords: ['tile', 'large', 'format', 'mortar', 'lht'], title: 'Large Format Tile Mortar LHT', sku: '103050', price: 32.95, unit: 'bag' },
    { keywords: ['tile', 'non', 'sag', 'wall', 'mortar'], title: 'Non-Sag Wall Tile Mortar', sku: '103051', price: 26.95, unit: 'bag' },
    { keywords: ['tile', 'lightweight', 'mortar', 'ease', 'spreading'], title: 'Lightweight Mortar Ease Spreading', sku: '103052', price: 24.95, unit: 'bag' },
    { keywords: ['tile', 'fast', 'set', 'rapid', 'cure', 'thinset'], title: 'Fast-Set Rapid-Cure Thinset', sku: '103053', price: 35.95, unit: 'bag' },
    { keywords: ['tile', 'white', 'thinset', 'marble', 'glass'], title: 'White Thinset Marble & Glass', sku: '103054', price: 20.95, unit: 'bag' },
    { keywords: ['tile', 'gray', 'thinset', 'standard', 'flooring'], title: 'Gray Thinset Standard Flooring', sku: '103055', price: 18.95, unit: 'bag' },
    { keywords: ['tile', 'mastic', 'pre', 'mixed', 'adhesive'], title: 'Tile Mastic Pre-Mixed Adhesive', sku: '103056', price: 25.95, unit: 'gallon' },
    { keywords: ['tile', 'epoxy', 'mortar', 'chemical', 'resistant'], title: 'Epoxy Mortar Chemical-Resistant', sku: '103057', price: 85.95, unit: 'kit' },
    { keywords: ['tile', 'outdoor', 'freeze', 'thaw', 'resistant', 'mortar'], title: 'Outdoor Freeze-Thaw Resistant Mortar', sku: '103058', price: 32.95, unit: 'bag' },
    { keywords: ['tile', 'thinset', 'additive', 'liquid', 'latex'], title: 'Thinset Additive Liquid Latex', sku: '103059', price: 15.95, unit: 'quart' },
    { keywords: ['tile', 'adhesive', 'spreader', 'mixing', 'paddle'], title: 'Tile Adhesive Spreader & Mixing Paddle', sku: '103060', price: 12.95, unit: 'each' },
    
    // Grouts
    { keywords: ['tile', 'sanded', 'grout', 'eighth', 'half', 'joints'], title: 'Sanded Grout 1/8"-1/2" Joints', sku: '103061', price: 8.95, unit: 'bag' },
    { keywords: ['tile', 'unsanded', 'grout', 'sixteenth', 'eighth', 'joints'], title: 'Unsanded Grout 1/16"-1/8" Joints', sku: '103062', price: 9.95, unit: 'bag' },
    { keywords: ['tile', 'pre', 'mixed', 'grout', 'ready', 'use'], title: 'Pre-Mixed Grout Ready-to-Use', sku: '103063', price: 18.95, unit: 'quart' },
    { keywords: ['tile', 'epoxy', 'grout', 'chemical', 'stain', 'resistant'], title: 'Epoxy Grout Chemical & Stain-Resistant', sku: '103064', price: 45.95, unit: 'kit' },
    { keywords: ['tile', 'urethane', 'grout', 'flexible', 'waterproof'], title: 'Urethane Grout Flexible & Waterproof', sku: '103065', price: 38.95, unit: 'kit' },
    { keywords: ['tile', 'rapid', 'set', 'grout', 'fast', 'curing'], title: 'Rapid-Set Grout Fast Curing', sku: '103066', price: 15.95, unit: 'bag' },
    { keywords: ['tile', 'ultracolor', 'plus', 'high', 'performance', 'grout'], title: 'Ultracolor Plus High-Performance Grout', sku: '103067', price: 12.95, unit: 'bag' },
    { keywords: ['tile', 'permacolor', 'high', 'performance', 'grout'], title: 'Permacolor High-Performance Grout', sku: '103068', price: 14.95, unit: 'bag' },
    { keywords: ['tile', 'fusion', 'pro', 'stain', 'proof', 'grout'], title: 'Fusion Pro Stain-Proof Grout', sku: '103069', price: 42.95, unit: 'kit' },
    { keywords: ['tile', 'colored', 'grout', 'standard', 'color'], title: 'Colored Grout Standard Colors', sku: '103070', price: 9.95, unit: 'bag' },
    { keywords: ['tile', 'grout', 'coloring', 'sealing', 'pen'], title: 'Grout Coloring/Sealing Pen', sku: '103071', price: 6.95, unit: 'each' },
    { keywords: ['tile', 'grout', 'additive', 'liquid', 'fortifier'], title: 'Grout Additive Liquid Fortifier', sku: '103072', price: 8.95, unit: 'quart' },
    { keywords: ['tile', 'grout', 'haze', 'remover'], title: 'Grout Haze Remover', sku: '103073', price: 12.95, unit: 'bottle' },
    { keywords: ['tile', 'grout', 'sealer', 'penetrating'], title: 'Grout Sealer Penetrating', sku: '103074', price: 18.95, unit: 'quart' },
    
    // Waterproofing & Crack Isolation
    { keywords: ['tile', 'redgard', 'liquid', 'waterproofing', 'membrane'], title: 'RedGard Liquid Waterproofing Membrane', sku: '103075', price: 65.95, unit: 'gallon' },
    { keywords: ['tile', 'hydroban', 'liquid', 'waterproofing'], title: 'HydroBan Liquid Waterproofing', sku: '103076', price: 75.95, unit: 'gallon' },
    { keywords: ['tile', 'aquadefense', 'liquid', 'waterproofing'], title: 'AquaDefense Liquid Waterproofing', sku: '103077', price: 55.95, unit: 'gallon' },
    { keywords: ['tile', 'kerdi', 'sheet', 'waterproofing', 'membrane'], title: 'Kerdi Sheet Waterproofing Membrane', sku: '103078', price: 4.95, unit: 'sqft' },
    { keywords: ['tile', 'provamat', 'waterproofing', 'sheet'], title: 'ProvaMat Waterproofing Sheet', sku: '103079', price: 3.95, unit: 'sqft' },
    { keywords: ['tile', 'waterproofing', 'seam', 'tape'], title: 'Waterproofing Seam Tape', sku: '103080', price: 12.95, unit: 'roll' },
    { keywords: ['tile', 'preformed', 'niches', 'benches', 'curbs'], title: 'Pre-Formed Niches, Benches & Curbs', sku: '103081', price: 85.95, unit: 'each' },
    { keywords: ['tile', 'vapor', 'barrier', 'sheets'], title: 'Vapor Barrier Sheets', sku: '103082', price: 0.15, unit: 'sqft' },
    { keywords: ['tile', 'crack', 'isolation', 'membrane', 'rolls'], title: 'Crack Isolation Membrane Rolls', sku: '103083', price: 1.95, unit: 'sqft' },
    { keywords: ['tile', 'elastomeric', 'sealants', 'ansi', 'a118'], title: 'Elastomeric Sealants ANSI A118.12', sku: '103084', price: 8.95, unit: 'tube' },
    { keywords: ['tile', 'drain', 'assemblies', 'waterproof', 'systems'], title: 'Drain Assemblies Waterproof Systems', sku: '103085', price: 125.95, unit: 'each' },
    { keywords: ['tile', 'shower', 'pan', 'liner', 'pvc'], title: 'Shower Pan Liner PVC', sku: '103086', price: 2.95, unit: 'sqft' },
    { keywords: ['tile', 'cpe', 'shower', 'pan', 'liner'], title: 'CPE Shower Pan Liner', sku: '103087', price: 3.25, unit: 'sqft' },
    { keywords: ['tile', 'pre', 'sloped', 'shower', 'pans'], title: 'Pre-Sloped Shower Pans', sku: '103088', price: 185.95, unit: 'each' },
    
    // Tile Installation Tools
    { keywords: ['tile', 'notched', 'trowel', 'quarter', 'quarter', 'inch'], title: 'Notched Trowel 1/4" x 1/4"', sku: '103089', price: 15.95, unit: 'each' },
    { keywords: ['tile', 'notched', 'trowel', 'quarter', 'three', 'eighth'], title: 'Notched Trowel 1/4" x 3/8"', sku: '103090', price: 16.95, unit: 'each' },
    { keywords: ['tile', 'notched', 'trowel', 'half', 'half', 'inch'], title: 'Notched Trowel 1/2" x 1/2"', sku: '103091', price: 18.95, unit: 'each' },
    { keywords: ['tile', 'u', 'notch', 'trowel'], title: 'U-Notch Trowel', sku: '103092', price: 17.95, unit: 'each' },
    { keywords: ['tile', 'square', 'notch', 'trowel'], title: 'Square-Notch Trowel', sku: '103093', price: 16.95, unit: 'each' },
    { keywords: ['tile', 'margin', 'trowel'], title: 'Margin Trowel', sku: '103094', price: 8.95, unit: 'each' },
    { keywords: ['tile', 'grout', 'float', 'rubber'], title: 'Grout Float Rubber', sku: '103095', price: 12.95, unit: 'each' },
    { keywords: ['tile', 'grout', 'float', 'epoxy'], title: 'Grout Float Epoxy', sku: '103096', price: 15.95, unit: 'each' },
    { keywords: ['tile', 'spacers', 'cross'], title: 'Tile Spacers Cross', sku: '103097', price: 8.95, unit: 'bag' },
    { keywords: ['tile', 'spacers', 'wedge'], title: 'Tile Spacers Wedge', sku: '103098', price: 9.95, unit: 'bag' },
    { keywords: ['tile', 'spacers', 'horseshoe'], title: 'Tile Spacers Horseshoe', sku: '103099', price: 7.95, unit: 'bag' },
    { keywords: ['tile', 'leveling', 'system', 'clips'], title: 'Tile Leveling System Clips', sku: '103100', price: 12.95, unit: 'pack' },
    { keywords: ['tile', 'leveling', 'wedges', 'caps'], title: 'Tile Leveling Wedges & Caps', sku: '103101', price: 15.95, unit: 'pack' },
    { keywords: ['tile', 'leveling', 'pliers'], title: 'Tile Leveling Pliers', sku: '103102', price: 25.95, unit: 'each' },
    { keywords: ['tile', 'mixing', 'paddle', 'thinset', 'grout'], title: 'Mixing Paddle Thinset/Grout', sku: '103103', price: 18.95, unit: 'each' },
    { keywords: ['tile', 'cutter', 'snap', 'cutter'], title: 'Tile Cutter Snap Cutter', sku: '103104', price: 35.95, unit: 'each' },
    { keywords: ['tile', 'wet', 'saw'], title: 'Wet Saw Tile', sku: '103105', price: 185.95, unit: 'each' },
    { keywords: ['tile', 'saw', 'blades', 'diamond'], title: 'Tile Saw Blades Diamond', sku: '103106', price: 25.95, unit: 'each' },
    { keywords: ['tile', 'nippers', 'hole', 'saws'], title: 'Tile Nippers & Hole Saws', sku: '103107', price: 15.95, unit: 'each' },
    { keywords: ['tile', 'rubber', 'mallet'], title: 'Rubber Mallet', sku: '103108', price: 12.95, unit: 'each' },
    { keywords: ['tile', 'suction', 'cups', 'large'], title: 'Suction Cups Large Tiles', sku: '103109', price: 8.95, unit: 'pack' },
    { keywords: ['tile', 'grout', 'buckets', 'sponges'], title: 'Grout Buckets & Sponges', sku: '103110', price: 12.95, unit: 'set' },
    { keywords: ['tile', 'knee', 'pads', 'kneeling', 'boards'], title: 'Knee Pads & Kneeling Boards', sku: '103111', price: 18.95, unit: 'each' },
    { keywords: ['tile', 'laser', 'level', 'chalk', 'line'], title: 'Laser Level & Chalk Line', sku: '103112', price: 85.95, unit: 'each' },
    { keywords: ['tile', 'bucket', 'trowel', 'mixing', 'bucket'], title: 'Bucket Trowel & Mixing Bucket', sku: '103113', price: 15.95, unit: 'set' },
    { keywords: ['tile', 'back', 'buttering', 'tools'], title: 'Back Buttering Tools', sku: '103114', price: 8.95, unit: 'each' },
    { keywords: ['tile', 'dust', 'shrouds', 'vacuums'], title: 'Dust Shrouds & Vacuums', sku: '103115', price: 45.95, unit: 'each' },
    
    // Finishing & Maintenance
    { keywords: ['tile', 'grout', 'sealer', 'penetrating'], title: 'Tile & Grout Sealer Penetrating', sku: '103116', price: 22.95, unit: 'quart' },
    { keywords: ['tile', 'grout', 'sealer', 'surface'], title: 'Tile & Grout Sealer Surface', sku: '103117', price: 18.95, unit: 'quart' },
    { keywords: ['tile', 'natural', 'stone', 'sealer', 'enhancing'], title: 'Natural Stone Sealer Enhancing', sku: '103118', price: 28.95, unit: 'quart' },
    { keywords: ['tile', 'natural', 'stone', 'sealer', 'non', 'enhancing'], title: 'Natural Stone Sealer Non-Enhancing', sku: '103119', price: 25.95, unit: 'quart' },
    { keywords: ['tile', 'cleaner', 'neutral', 'ph'], title: 'Tile Cleaner Neutral pH', sku: '103120', price: 12.95, unit: 'bottle' },
    { keywords: ['tile', 'grout', 'haze', 'remover', 'acidic'], title: 'Grout Haze Remover Acidic', sku: '103121', price: 15.95, unit: 'bottle' },
    { keywords: ['tile', 'grout', 'haze', 'remover', 'non', 'acidic'], title: 'Grout Haze Remover Non-Acidic', sku: '103122', price: 18.95, unit: 'bottle' },
    { keywords: ['tile', 'efflorescence', 'remover'], title: 'Efflorescence Remover', sku: '103123', price: 22.95, unit: 'bottle' },
    { keywords: ['tile', 'polishing', 'pads', 'marble', 'granite'], title: 'Polishing Pads Marble/Granite', sku: '103124', price: 25.95, unit: 'pack' },
    { keywords: ['tile', 'anti', 'slip', 'coating', 'floors'], title: 'Anti-Slip Coating Tile Floors', sku: '103125', price: 45.95, unit: 'gallon' },
    { keywords: ['tile', 'caulk', 'color', 'matched', 'grout'], title: 'Caulk Color-Matched Tile & Grout', sku: '103126', price: 8.95, unit: 'tube' },
    { keywords: ['tile', 'silicone', 'sealant', 'wet', 'areas'], title: 'Silicone Sealant Wet Areas', sku: '103127', price: 6.95, unit: 'tube' },
    
    // Tile Accessories
    { keywords: ['tile', 'bullnose', 'trim'], title: 'Bullnose Trim Tile', sku: '103128', price: 4.95, unit: 'linearft' },
    { keywords: ['tile', 'schluter', 'jolly', 'edge', 'profiles'], title: 'Schluter Jolly Edge Profiles', sku: '103129', price: 8.95, unit: 'linearft' },
    { keywords: ['tile', 'schluter', 'rondec', 'edge', 'profiles'], title: 'Schluter Rondec Edge Profiles', sku: '103130', price: 7.95, unit: 'linearft' },
    { keywords: ['tile', 'schluter', 'quadec', 'edge', 'profiles'], title: 'Schluter Quadec Edge Profiles', sku: '103131', price: 9.95, unit: 'linearft' },
    { keywords: ['tile', 'cove', 'base'], title: 'Cove Base Tile', sku: '103132', price: 3.95, unit: 'linearft' },
    { keywords: ['tile', 'thresholds', 'transition', 'strips', 'metal'], title: 'Thresholds & Transition Strips Metal', sku: '103133', price: 15.95, unit: 'linearft' },
    { keywords: ['tile', 'thresholds', 'transition', 'strips', 'marble'], title: 'Thresholds & Transition Strips Marble', sku: '103134', price: 18.95, unit: 'linearft' },
    { keywords: ['tile', 'thresholds', 'transition', 'strips', 'pvc'], title: 'Thresholds & Transition Strips PVC', sku: '103135', price: 8.95, unit: 'linearft' },
    { keywords: ['tile', 'shower', 'curb', 'kits'], title: 'Shower Curb Kits', sku: '103136', price: 125.95, unit: 'kit' },
    { keywords: ['tile', 'floor', 'transitions', 't', 'molding'], title: 'Floor Transitions T-Molding', sku: '103137', price: 12.95, unit: 'linearft' },
    { keywords: ['tile', 'floor', 'transitions', 'reducers'], title: 'Floor Transitions Reducers', sku: '103138', price: 10.95, unit: 'linearft' },
    { keywords: ['tile', 'expansion', 'joint', 'profiles'], title: 'Expansion Joint Profiles', sku: '103139', price: 6.95, unit: 'linearft' },
    { keywords: ['tile', 'decorative', 'inserts', 'listellos'], title: 'Decorative Inserts & Listellos', sku: '103140', price: 8.95, unit: 'linearft' },
    { keywords: ['tile', 'niche', 'kits', 'corner', 'shelves'], title: 'Niche Kits & Corner Shelves', sku: '103141', price: 45.95, unit: 'each' },
    
    // Flooring Systems - Luxury Vinyl Plank (LVP) & Luxury Vinyl Tile (LVT)
    { keywords: ['luxury', 'vinyl', 'plank', 'lvp', 'waterproof', 'spc'], title: 'Luxury Vinyl Plank LVP Waterproof SPC', sku: '104001', price: 3.95, unit: 'sqft' },
    { keywords: ['luxury', 'vinyl', 'plank', 'lvp', 'waterproof', 'wpc'], title: 'Luxury Vinyl Plank LVP Waterproof WPC', sku: '104002', price: 4.25, unit: 'sqft' },
    { keywords: ['click', 'lock', 'floating', 'lvp', 'flooring'], title: 'Click-Lock Floating LVP Flooring', sku: '104003', price: 3.75, unit: 'sqft' },
    { keywords: ['luxury', 'vinyl', 'tile', 'lvt', 'glue', 'down'], title: 'Glue-Down LVT Flooring', sku: '104004', price: 3.45, unit: 'sqft' },
    { keywords: ['loose', 'lay', 'lvt', 'flooring'], title: 'Loose-Lay LVT Flooring', sku: '104005', price: 3.85, unit: 'sqft' },
    { keywords: ['rigid', 'core', 'vinyl', 'spc', 'stone', 'polymer'], title: 'Rigid Core Vinyl SPC Flooring', sku: '104006', price: 4.45, unit: 'sqft' },
    { keywords: ['peel', 'stick', 'vinyl', 'plank', 'flooring'], title: 'Peel-and-Stick Vinyl Plank Flooring', sku: '104007', price: 2.95, unit: 'sqft' },
    { keywords: ['waterproof', 'vinyl', 'tile', 'bath', 'kitchen'], title: 'Waterproof Vinyl Tile Bath/Kitchen', sku: '104008', price: 3.25, unit: 'sqft' },
    { keywords: ['high', 'traffic', 'commercial', 'lvp'], title: 'High-Traffic Commercial LVP', sku: '104009', price: 5.95, unit: 'sqft' },
    { keywords: ['lvp', 'stair', 'treads', 'nosings'], title: 'LVP Stair Treads & Nosings', sku: '104010', price: 18.95, unit: 'linearft' },
    { keywords: ['lvp', 'matching', 'transitions', 'reducers'], title: 'LVP Matching Transitions Reducers', sku: '104011', price: 12.95, unit: 'linearft' },
    { keywords: ['lvp', 'matching', 'end', 'caps', 't', 'molding'], title: 'LVP Matching End Caps & T-Molding', sku: '104012', price: 14.95, unit: 'linearft' },
    { keywords: ['lvp', 'underlayment', 'vapor', 'barrier', 'foam'], title: 'LVP Underlayment Vapor Barrier Foam', sku: '104013', price: 0.65, unit: 'sqft' },
    { keywords: ['lvp', 'underlayment', 'cork'], title: 'LVP Underlayment Cork', sku: '104014', price: 1.25, unit: 'sqft' },
    { keywords: ['sound', 'reduction', 'underlayment', 'iic', 'stc'], title: 'Sound Reduction Underlayment IIC/STC', sku: '104015', price: 1.95, unit: 'sqft' },
    
    // Laminate Flooring
    { keywords: ['laminate', 'flooring', 'standard', '7mm', '12mm'], title: 'Standard Laminate Flooring 7mm-12mm', sku: '104016', price: 2.95, unit: 'sqft' },
    { keywords: ['water', 'resistant', 'laminate', 'aquaguard'], title: 'Water-Resistant Laminate AquaGuard', sku: '104017', price: 3.95, unit: 'sqft' },
    { keywords: ['water', 'resistant', 'laminate', 'pergo', 'wetprotect'], title: 'Water-Resistant Laminate Pergo WetProtect', sku: '104018', price: 4.25, unit: 'sqft' },
    { keywords: ['scratch', 'resistant', 'laminate', 'ac3', 'ac5'], title: 'Scratch-Resistant Laminate AC3-AC5', sku: '104019', price: 3.45, unit: 'sqft' },
    { keywords: ['click', 'lock', 'laminate', 'flooring'], title: 'Click-Lock Laminate Flooring', sku: '104020', price: 3.25, unit: 'sqft' },
    { keywords: ['attached', 'pad', 'laminate', 'flooring'], title: 'Attached Pad Laminate Flooring', sku: '104021', price: 3.75, unit: 'sqft' },
    { keywords: ['laminate', 'underlayment', 'foam'], title: 'Laminate Underlayment Foam', sku: '104022', price: 0.45, unit: 'sqft' },
    { keywords: ['laminate', 'underlayment', 'cork'], title: 'Laminate Underlayment Cork', sku: '104023', price: 0.85, unit: 'sqft' },
    { keywords: ['laminate', 'underlayment', 'vapor', 'barrier'], title: 'Laminate Underlayment Vapor Barrier', sku: '104024', price: 0.35, unit: 'sqft' },
    { keywords: ['floor', 'leveling', 'compound', 'laminate'], title: 'Floor Leveling Compound Laminate', sku: '104025', price: 18.95, unit: 'bag' },
    { keywords: ['laminate', 'transition', 'strips', 'reducers'], title: 'Laminate Transition Strips & Reducers', sku: '104026', price: 8.95, unit: 'linearft' },
    { keywords: ['laminate', 'stair', 'treads', 'nosings'], title: 'Laminate Stair Treads & Nosings', sku: '104027', price: 15.95, unit: 'linearft' },
    { keywords: ['laminate', 'repair', 'touch', 'up', 'kits'], title: 'Laminate Repair & Touch-Up Kits', sku: '104028', price: 12.95, unit: 'kit' },
    
    // Hardwood Flooring
    { keywords: ['solid', 'hardwood', 'flooring', 'oak'], title: 'Solid Hardwood Flooring Oak', sku: '104029', price: 6.95, unit: 'sqft' },
    { keywords: ['solid', 'hardwood', 'flooring', 'maple'], title: 'Solid Hardwood Flooring Maple', sku: '104030', price: 7.95, unit: 'sqft' },
    { keywords: ['solid', 'hardwood', 'flooring', 'hickory'], title: 'Solid Hardwood Flooring Hickory', sku: '104031', price: 8.95, unit: 'sqft' },
    { keywords: ['solid', 'hardwood', 'flooring', 'walnut'], title: 'Solid Hardwood Flooring Walnut', sku: '104032', price: 9.95, unit: 'sqft' },
    { keywords: ['solid', 'hardwood', 'flooring', 'cherry'], title: 'Solid Hardwood Flooring Cherry', sku: '104033', price: 8.45, unit: 'sqft' },
    { keywords: ['engineered', 'hardwood', 'flooring', 'multi', 'ply'], title: 'Engineered Hardwood Flooring Multi-Ply', sku: '104034', price: 5.95, unit: 'sqft' },
    { keywords: ['engineered', 'hardwood', 'click', 'lock'], title: 'Engineered Hardwood Click-Lock', sku: '104035', price: 6.25, unit: 'sqft' },
    { keywords: ['prefinished', 'hardwood', 'uv', 'coating'], title: 'Prefinished Hardwood UV Coating', sku: '104036', price: 7.95, unit: 'sqft' },
    { keywords: ['unfinished', 'hardwood', 'site', 'finish'], title: 'Unfinished Hardwood Site-Finish', sku: '104037', price: 4.95, unit: 'sqft' },
    { keywords: ['parquet', 'flooring'], title: 'Parquet Flooring', sku: '104038', price: 8.95, unit: 'sqft' },
    { keywords: ['bamboo', 'flooring', 'solid'], title: 'Bamboo Flooring Solid', sku: '104039', price: 5.45, unit: 'sqft' },
    { keywords: ['bamboo', 'flooring', 'engineered'], title: 'Bamboo Flooring Engineered', sku: '104040', price: 4.95, unit: 'sqft' },
    { keywords: ['cork', 'flooring', 'floating'], title: 'Cork Flooring Floating', sku: '104041', price: 4.25, unit: 'sqft' },
    { keywords: ['cork', 'flooring', 'glue', 'down'], title: 'Cork Flooring Glue-Down', sku: '104042', price: 3.95, unit: 'sqft' },
    { keywords: ['hardwood', 'thresholds', 'reducers'], title: 'Hardwood Thresholds & Reducers', sku: '104043', price: 12.95, unit: 'linearft' },
    { keywords: ['flush', 'mount', 'stair', 'nosing', 'vents'], title: 'Flush-Mount Stair Nosing & Vents', sku: '104044', price: 18.95, unit: 'linearft' },
    { keywords: ['hardwood', 'adhesives', 'urethane'], title: 'Hardwood Adhesives Urethane', sku: '104045', price: 25.95, unit: 'gallon' },
    { keywords: ['hardwood', 'adhesives', 'ms', 'polymer'], title: 'Hardwood Adhesives MS Polymer', sku: '104046', price: 22.95, unit: 'gallon' },
    { keywords: ['wood', 'floor', 'fasteners', 'cleats'], title: 'Wood Floor Fasteners Cleats', sku: '104047', price: 15.95, unit: 'box' },
    { keywords: ['wood', 'floor', 'fasteners', 'staples'], title: 'Wood Floor Fasteners Staples', sku: '104048', price: 12.95, unit: 'box' },
    { keywords: ['rosin', 'paper', 'vapor', 'retarder'], title: 'Rosin Paper & Vapor Retarder', sku: '104049', price: 0.15, unit: 'sqft' },
    { keywords: ['hardwood', 'floor', 'stain', 'sealers'], title: 'Hardwood Floor Stain & Sealers', sku: '104050', price: 35.95, unit: 'gallon' },
    { keywords: ['hardwood', 'floor', 'polyurethane', 'finishes'], title: 'Hardwood Floor Polyurethane Finishes', sku: '104051', price: 42.95, unit: 'gallon' },
    
    // Tile & Stone Flooring (Interior/Exterior)
    { keywords: ['porcelain', 'floor', 'tile', 'matte'], title: 'Porcelain Floor Tile Matte', sku: '104052', price: 4.95, unit: 'sqft' },
    { keywords: ['porcelain', 'floor', 'tile', 'polished'], title: 'Porcelain Floor Tile Polished', sku: '104053', price: 5.95, unit: 'sqft' },
    { keywords: ['porcelain', 'floor', 'tile', 'textured'], title: 'Porcelain Floor Tile Textured', sku: '104054', price: 5.45, unit: 'sqft' },
    { keywords: ['ceramic', 'floor', 'tile', 'glazed'], title: 'Ceramic Floor Tile Glazed', sku: '104055', price: 3.95, unit: 'sqft' },
    { keywords: ['ceramic', 'floor', 'tile', 'unglazed'], title: 'Ceramic Floor Tile Unglazed', sku: '104056', price: 3.45, unit: 'sqft' },
    { keywords: ['natural', 'stone', 'travertine'], title: 'Natural Stone Floor Tile Travertine', sku: '104057', price: 8.95, unit: 'sqft' },
    { keywords: ['natural', 'stone', 'marble'], title: 'Natural Stone Floor Tile Marble', sku: '104058', price: 12.95, unit: 'sqft' },
    { keywords: ['natural', 'stone', 'slate'], title: 'Natural Stone Floor Tile Slate', sku: '104059', price: 6.95, unit: 'sqft' },
    { keywords: ['natural', 'stone', 'granite'], title: 'Natural Stone Floor Tile Granite', sku: '104060', price: 15.95, unit: 'sqft' },
    { keywords: ['outdoor', 'porcelain', 'pavers', '2cm'], title: 'Outdoor Porcelain Pavers 2cm', sku: '104061', price: 8.95, unit: 'sqft' },
    { keywords: ['quarry', 'tile', 'commercial', 'kitchen'], title: 'Quarry Tile Commercial Kitchen', sku: '104062', price: 2.95, unit: 'sqft' },
    { keywords: ['large', 'format', 'tiles', '24x24', '24x48'], title: 'Large Format Tiles 24x24 & 24x48', sku: '104063', price: 6.95, unit: 'sqft' },
    { keywords: ['tile', 'edge', 'trim', 'schluter'], title: 'Tile Edge Trim Schluter', sku: '104064', price: 8.95, unit: 'linearft' },
    { keywords: ['tile', 'edge', 'trim', 'metal'], title: 'Tile Edge Trim Metal', sku: '104065', price: 6.95, unit: 'linearft' },
    { keywords: ['tile', 'edge', 'trim', 'pvc'], title: 'Tile Edge Trim PVC', sku: '104066', price: 4.95, unit: 'linearft' },
    { keywords: ['floor', 'leveling', 'spacers', 'clips'], title: 'Floor Leveling Spacers & Clips', sku: '104067', price: 12.95, unit: 'pack' },
    { keywords: ['floor', 'tile', 'thinset', 'mortar', 'lht'], title: 'Floor Tile Thinset Mortar LHT', sku: '104068', price: 32.95, unit: 'bag' },
    { keywords: ['self', 'leveling', 'underlayment', 'cement'], title: 'Self-Leveling Underlayment Cement', sku: '104069', price: 28.95, unit: 'bag' },
    { keywords: ['crack', 'isolation', 'waterproof', 'membranes'], title: 'Crack Isolation Waterproof Membranes', sku: '104070', price: 2.95, unit: 'sqft' },
    { keywords: ['cement', 'backer', 'boards', 'hardiebacker'], title: 'Cement Backer Boards HardieBacker', sku: '104071', price: 18.95, unit: 'sheet' },
    { keywords: ['cement', 'backer', 'boards', 'durock'], title: 'Cement Backer Boards Durock', sku: '104072', price: 16.95, unit: 'sheet' },
    { keywords: ['cement', 'backer', 'boards', 'goboard'], title: 'Cement Backer Boards GoBoard', sku: '104073', price: 38.95, unit: 'sheet' },
    { keywords: ['cement', 'backer', 'boards', 'densshield'], title: 'Cement Backer Boards DensShield', sku: '104074', price: 19.95, unit: 'sheet' },
    { keywords: ['tile', 'grout', 'sanded', 'unsanded'], title: 'Tile Grout Sanded/Unsanded', sku: '104075', price: 8.95, unit: 'bag' },
    { keywords: ['tile', 'grout', 'epoxy', 'pre', 'mixed'], title: 'Tile Grout Epoxy/Pre-Mixed', sku: '104076', price: 18.95, unit: 'kit' },
    { keywords: ['grout', 'sealer', 'penetrating', 'surface'], title: 'Grout Sealer Penetrating/Surface', sku: '104077', price: 22.95, unit: 'quart' },
    
    // Carpet & Carpet Tile
    { keywords: ['broadloom', 'carpet', 'residential'], title: 'Broadloom Carpet Residential', sku: '104078', price: 3.95, unit: 'sqft' },
    { keywords: ['broadloom', 'carpet', 'commercial'], title: 'Broadloom Carpet Commercial', sku: '104079', price: 4.95, unit: 'sqft' },
    { keywords: ['carpet', 'tiles', 'modular', 'squares'], title: 'Carpet Tiles Modular Squares', sku: '104080', price: 2.95, unit: 'sqft' },
    { keywords: ['carpet', 'tiles', 'peel', 'stick'], title: 'Carpet Tiles Peel-and-Stick', sku: '104081', price: 3.25, unit: 'sqft' },
    { keywords: ['indoor', 'outdoor', 'carpet', 'uv', 'resistant'], title: 'Indoor/Outdoor Carpet UV-Resistant', sku: '104082', price: 2.45, unit: 'sqft' },
    { keywords: ['berber', 'carpet'], title: 'Berber Carpet', sku: '104083', price: 3.75, unit: 'sqft' },
    { keywords: ['plush', 'carpet'], title: 'Plush Carpet', sku: '104084', price: 4.25, unit: 'sqft' },
    { keywords: ['frieze', 'carpet'], title: 'Frieze Carpet', sku: '104085', price: 3.95, unit: 'sqft' },
    { keywords: ['pattern', 'carpet'], title: 'Pattern Carpet', sku: '104086', price: 4.95, unit: 'sqft' },
    { keywords: ['carpet', 'padding', 'rebond'], title: 'Carpet Padding Rebond', sku: '104087', price: 0.85, unit: 'sqft' },
    { keywords: ['carpet', 'padding', 'memory', 'foam'], title: 'Carpet Padding Memory Foam', sku: '104088', price: 1.25, unit: 'sqft' },
    { keywords: ['carpet', 'padding', 'moisture', 'barrier'], title: 'Carpet Padding Moisture Barrier', sku: '104089', price: 1.15, unit: 'sqft' },
    { keywords: ['tack', 'strips', 'carpet', 'grippers'], title: 'Tack Strips & Carpet Grippers', sku: '104090', price: 2.95, unit: 'linearft' },
    { keywords: ['carpet', 'seam', 'tape', 'heat', 'bond'], title: 'Carpet Seam Tape Heat Bond', sku: '104091', price: 8.95, unit: 'roll' },
    { keywords: ['carpet', 'seam', 'tape', 'pressure', 'sensitive'], title: 'Carpet Seam Tape Pressure-Sensitive', sku: '104092', price: 6.95, unit: 'roll' },
    { keywords: ['carpet', 'adhesive', 'multi', 'purpose'], title: 'Carpet Adhesive Multi-Purpose', sku: '104093', price: 22.95, unit: 'gallon' },
    { keywords: ['carpet', 'adhesive', 'high', 'tack'], title: 'Carpet Adhesive High-Tack', sku: '104094', price: 25.95, unit: 'gallon' },
    { keywords: ['carpet', 'transition', 'trims', 'z', 'bar'], title: 'Carpet Transition Trims Z-Bar', sku: '104095', price: 8.95, unit: 'linearft' },
    { keywords: ['stair', 'nose', 'stair', 'rods'], title: 'Stair Nose & Stair Rods', sku: '104096', price: 12.95, unit: 'linearft' },
    { keywords: ['carpet', 'rollers', 'knee', 'kickers'], title: 'Carpet Rollers & Knee Kickers', sku: '104097', price: 45.95, unit: 'each' },
    { keywords: ['carpet', 'installation', 'knives', 'blades'], title: 'Carpet Installation Knives & Blades', sku: '104098', price: 15.95, unit: 'set' },
    
    // Underlayments, Leveling & Prep Materials
    { keywords: ['floor', 'patch', 'repair', 'compound'], title: 'Floor Patch & Repair Compound', sku: '104099', price: 18.95, unit: 'bag' },
    { keywords: ['self', 'leveling', 'underlayment', 'cementitious'], title: 'Self-Leveling Underlayment Cementitious', sku: '104100', price: 28.95, unit: 'bag' },
    { keywords: ['self', 'leveling', 'underlayment', 'gypsum'], title: 'Self-Leveling Underlayment Gypsum', sku: '104101', price: 24.95, unit: 'bag' },
    { keywords: ['primer', 'self', 'leveling', 'acrylic', 'bonding'], title: 'Primer Self-Leveling Acrylic Bonding', sku: '104102', price: 32.95, unit: 'gallon' },
    { keywords: ['moisture', 'barrier', 'underlayment', 'film'], title: 'Moisture Barrier Underlayment Film', sku: '104103', price: 0.15, unit: 'sqft' },
    { keywords: ['sound', 'thermal', 'underlayment', 'cork'], title: 'Sound & Thermal Underlayment Cork', sku: '104104', price: 1.95, unit: 'sqft' },
    { keywords: ['sound', 'thermal', 'underlayment', 'foam'], title: 'Sound & Thermal Underlayment Foam', sku: '104105', price: 0.85, unit: 'sqft' },
    { keywords: ['sound', 'thermal', 'underlayment', 'rubber'], title: 'Sound & Thermal Underlayment Rubber', sku: '104106', price: 2.25, unit: 'sqft' },
    { keywords: ['floor', 'vapor', 'barrier', 'concrete', 'subfloors'], title: 'Floor Vapor Barrier Concrete Subfloors', sku: '104107', price: 0.25, unit: 'sqft' },
    { keywords: ['subfloor', 'screws', 'adhesive'], title: 'Subfloor Screws & Adhesive', sku: '104108', price: 18.95, unit: 'box' },
    { keywords: ['concrete', 'moisture', 'test', 'kits', 'rh'], title: 'Concrete Moisture Test Kits RH', sku: '104109', price: 125.95, unit: 'kit' },
    { keywords: ['concrete', 'moisture', 'test', 'calcium', 'chloride'], title: 'Concrete Moisture Test Calcium Chloride', sku: '104110', price: 45.95, unit: 'kit' },
    { keywords: ['crack', 'filler', 'concrete', 'resurfacer'], title: 'Crack Filler & Concrete Resurfacer', sku: '104111', price: 22.95, unit: 'gallon' },
    { keywords: ['felt', 'paper', '15lb', 'wood', 'subfloors'], title: 'Felt Paper 15# Wood Subfloors', sku: '104112', price: 0.08, unit: 'sqft' },
    { keywords: ['flooring', 'transitions', 'trim', 'kits'], title: 'Flooring Transitions & Trim Kits', sku: '104113', price: 15.95, unit: 'kit' },
    
    // Flooring Adhesives & Sealants
    { keywords: ['pressure', 'sensitive', 'adhesive', 'lvt', 'lvp'], title: 'Pressure-Sensitive Adhesive LVT/LVP', sku: '104114', price: 28.95, unit: 'gallon' },
    { keywords: ['pressure', 'sensitive', 'adhesive', 'carpet', 'tiles'], title: 'Pressure-Sensitive Adhesive Carpet Tiles', sku: '104115', price: 25.95, unit: 'gallon' },
    { keywords: ['urethane', 'wood', 'flooring', 'adhesive'], title: 'Urethane Wood Flooring Adhesive', sku: '104116', price: 35.95, unit: 'gallon' },
    { keywords: ['multi', 'purpose', 'flooring', 'adhesive'], title: 'Multi-Purpose Flooring Adhesive', sku: '104117', price: 22.95, unit: 'gallon' },
    { keywords: ['rubber', 'tile', 'adhesive', 'commercial'], title: 'Rubber Tile Adhesive Commercial', sku: '104118', price: 32.95, unit: 'gallon' },
    { keywords: ['moisture', 'cured', 'adhesive', 'high', 'humidity'], title: 'Moisture-Cured Adhesive High-Humidity', sku: '104119', price: 42.95, unit: 'gallon' },
    { keywords: ['spray', 'adhesives', 'temporary', 'permanent'], title: 'Spray Adhesives Temporary/Permanent', sku: '104120', price: 12.95, unit: 'can' },
    { keywords: ['flooring', 'seam', 'sealer', 'vinyl'], title: 'Flooring Seam Sealer Vinyl', sku: '104121', price: 18.95, unit: 'tube' },
    { keywords: ['flooring', 'seam', 'sealer', 'rubber'], title: 'Flooring Seam Sealer Rubber', sku: '104122', price: 22.95, unit: 'tube' },
    { keywords: ['flooring', 'caulk', 'color', 'matched'], title: 'Flooring Caulk Color-Matched', sku: '104123', price: 8.95, unit: 'tube' },
    { keywords: ['trowels', 'adhesive', 'application', '16th'], title: 'Trowels Adhesive Application 1/16"', sku: '104124', price: 15.95, unit: 'each' },
    { keywords: ['trowels', 'adhesive', 'application', 'eighth'], title: 'Trowels Adhesive Application 1/8"', sku: '104125', price: 16.95, unit: 'each' },
    { keywords: ['trowels', 'adhesive', 'application', '316th'], title: 'Trowels Adhesive Application 3/16"', sku: '104126', price: 17.95, unit: 'each' },
    
    // Floor Finishes, Care & Maintenance
    { keywords: ['hardwood', 'floor', 'cleaner', 'neutral', 'ph'], title: 'Hardwood Floor Cleaner Neutral pH', sku: '104127', price: 15.95, unit: 'bottle' },
    { keywords: ['vinyl', 'tile', 'floor', 'cleaner'], title: 'Vinyl & Tile Floor Cleaner', sku: '104128', price: 12.95, unit: 'bottle' },
    { keywords: ['grout', 'cleaner', 'restorer'], title: 'Grout Cleaner & Restorer', sku: '104129', price: 18.95, unit: 'bottle' },
    { keywords: ['laminate', 'floor', 'cleaner'], title: 'Laminate Floor Cleaner', sku: '104130', price: 14.95, unit: 'bottle' },
    { keywords: ['floor', 'polish', 'acrylic'], title: 'Floor Polish Acrylic', sku: '104131', price: 22.95, unit: 'gallon' },
    { keywords: ['floor', 'polish', 'polymer'], title: 'Floor Polish Polymer', sku: '104132', price: 25.95, unit: 'gallon' },
    { keywords: ['floor', 'wax', 'acrylic'], title: 'Floor Wax Acrylic', sku: '104133', price: 18.95, unit: 'gallon' },
    { keywords: ['floor', 'wax', 'polymer'], title: 'Floor Wax Polymer', sku: '104134', price: 20.95, unit: 'gallon' },
    { keywords: ['stone', 'enhancer', 'sealer'], title: 'Stone Enhancer & Sealer', sku: '104135', price: 32.95, unit: 'quart' },
    { keywords: ['anti', 'slip', 'coating', 'additive'], title: 'Anti-Slip Coating & Additive', sku: '104136', price: 28.95, unit: 'quart' },
    { keywords: ['microfiber', 'mop', 'heads', 'pads'], title: 'Microfiber Mop Heads & Pads', sku: '104137', price: 12.95, unit: 'pack' },
    { keywords: ['buffing', 'pads', 'floor', 'polishers'], title: 'Buffing Pads & Floor Polishers', sku: '104138', price: 25.95, unit: 'pack' },
    { keywords: ['felt', 'pads', 'floor', 'protection', 'glides'], title: 'Felt Pads & Floor Protection Glides', sku: '104139', price: 8.95, unit: 'pack' },
    
    // Floor Installation Tools
    { keywords: ['flooring', 'cutters', 'lvp', 'lvt'], title: 'Flooring Cutters LVP/LVT', sku: '104140', price: 35.95, unit: 'each' },
    { keywords: ['flooring', 'cutters', 'laminate'], title: 'Flooring Cutters Laminate', sku: '104141', price: 32.95, unit: 'each' },
    { keywords: ['flooring', 'cutters', 'wood'], title: 'Flooring Cutters Wood', sku: '104142', price: 38.95, unit: 'each' },
    { keywords: ['table', 'saw', 'hardwood', 'trim'], title: 'Table Saw Hardwood & Trim', sku: '104143', price: 185.95, unit: 'each' },
    { keywords: ['miter', 'saw', 'hardwood', 'trim'], title: 'Miter Saw Hardwood & Trim', sku: '104144', price: 125.95, unit: 'each' },
    { keywords: ['jigsaw', 'oscillating', 'tools'], title: 'Jigsaw & Oscillating Tools', sku: '104145', price: 85.95, unit: 'each' },
    { keywords: ['pry', 'bars', 'floor', 'scrapers'], title: 'Pry Bars & Floor Scrapers', sku: '104146', price: 25.95, unit: 'each' },
    { keywords: ['knee', 'pads', 'flooring', 'kneelers'], title: 'Knee Pads & Flooring Kneelers', sku: '104147', price: 18.95, unit: 'each' },
    { keywords: ['rubber', 'mallet', 'tapping', 'blocks'], title: 'Rubber Mallet & Tapping Blocks', sku: '104148', price: 15.95, unit: 'each' },
    { keywords: ['pull', 'bars', 'spacers'], title: 'Pull Bars & Spacers', sku: '104149', price: 12.95, unit: 'each' },
    { keywords: ['laser', 'level', 'chalk', 'line'], title: 'Laser Level & Chalk Line', sku: '104150', price: 85.95, unit: 'each' },
    { keywords: ['trowels', 'mixers', 'mortar', 'adhesive'], title: 'Trowels & Mixers Mortar/Adhesive', sku: '104151', price: 22.95, unit: 'each' },
    { keywords: ['moisture', 'meter', 'hardwood', 'installs'], title: 'Moisture Meter Hardwood Installs', sku: '104152', price: 95.95, unit: 'each' },
    { keywords: ['heat', 'gun', 'vinyl', 'repair', 'stretching'], title: 'Heat Gun Vinyl Repair & Stretching', sku: '104153', price: 45.95, unit: 'each' },
    
    // Interior Finishes & Millwork - Interior Doors & Frames
    { keywords: ['hollow', 'core', 'molded', 'panel', 'doors'], title: 'Hollow-Core Molded Panel Doors', sku: '105001', price: 125.95, unit: 'each' },
    { keywords: ['solid', 'core', 'interior', 'doors', 'mdf'], title: 'Solid-Core Interior Doors MDF', sku: '105002', price: 185.95, unit: 'each' },
    { keywords: ['solid', 'core', 'interior', 'doors', 'composite'], title: 'Solid-Core Interior Doors Composite', sku: '105003', price: 195.95, unit: 'each' },
    { keywords: ['solid', 'wood', 'doors', 'pine'], title: 'Solid Wood Doors Pine', sku: '105004', price: 225.95, unit: 'each' },
    { keywords: ['solid', 'wood', 'doors', 'oak'], title: 'Solid Wood Doors Oak', sku: '105005', price: 285.95, unit: 'each' },
    { keywords: ['solid', 'wood', 'doors', 'maple'], title: 'Solid Wood Doors Maple', sku: '105006', price: 295.95, unit: 'each' },
    { keywords: ['solid', 'wood', 'doors', 'alder'], title: 'Solid Wood Doors Alder', sku: '105007', price: 275.95, unit: 'each' },
    { keywords: ['solid', 'wood', 'doors', 'mahogany'], title: 'Solid Wood Doors Mahogany', sku: '105008', price: 385.95, unit: 'each' },
    { keywords: ['prehung', 'interior', 'door', 'units'], title: 'Prehung Interior Door Units', sku: '105009', price: 185.95, unit: 'each' },
    { keywords: ['slab', 'doors', 'unmounted'], title: 'Slab Doors Unmounted', sku: '105010', price: 95.95, unit: 'each' },
    { keywords: ['french', 'doors', 'clear', 'glass'], title: 'French Doors Clear Glass', sku: '105011', price: 295.95, unit: 'each' },
    { keywords: ['french', 'doors', 'frosted', 'glass'], title: 'French Doors Frosted Glass', sku: '105012', price: 315.95, unit: 'each' },
    { keywords: ['pocket', 'doors', 'hardware', 'kits'], title: 'Pocket Doors & Hardware Kits', sku: '105013', price: 185.95, unit: 'kit' },
    { keywords: ['barn', 'doors', 'wood'], title: 'Barn Doors Wood', sku: '105014', price: 245.95, unit: 'each' },
    { keywords: ['barn', 'doors', 'glass', 'metal'], title: 'Barn Doors Glass Metal Frame', sku: '105015', price: 325.95, unit: 'each' },
    { keywords: ['bypass', 'bifold', 'closet', 'doors'], title: 'Bypass & Bifold Closet Doors', sku: '105016', price: 165.95, unit: 'each' },
    { keywords: ['fire', 'rated', 'interior', 'doors', '20', 'minute'], title: 'Fire-Rated Interior Doors 20-Minute', sku: '105017', price: 285.95, unit: 'each' },
    { keywords: ['fire', 'rated', 'interior', 'doors', '45', 'minute'], title: 'Fire-Rated Interior Doors 45-Minute', sku: '105018', price: 325.95, unit: 'each' },
    { keywords: ['fire', 'rated', 'interior', 'doors', '60', 'minute'], title: 'Fire-Rated Interior Doors 60-Minute', sku: '105019', price: 385.95, unit: 'each' },
    { keywords: ['sound', 'rated', 'acoustic', 'interior', 'doors'], title: 'Sound-Rated Acoustic Interior Doors', sku: '105020', price: 295.95, unit: 'each' },
    { keywords: ['pre', 'finished', 'primed', 'doors'], title: 'Pre-Finished & Primed Doors', sku: '105021', price: 165.95, unit: 'each' },
    { keywords: ['louvered', 'utility', 'doors', 'hvac'], title: 'Louvered Utility Doors HVAC', sku: '105022', price: 125.95, unit: 'each' },
    { keywords: ['door', 'jamb', 'kits', 'pine'], title: 'Door Jamb Kits Pine', sku: '105023', price: 45.95, unit: 'kit' },
    { keywords: ['door', 'jamb', 'kits', 'poplar'], title: 'Door Jamb Kits Poplar', sku: '105024', price: 55.95, unit: 'kit' },
    { keywords: ['door', 'jamb', 'kits', 'mdf'], title: 'Door Jamb Kits MDF', sku: '105025', price: 48.95, unit: 'kit' },
    { keywords: ['door', 'jamb', 'kits', 'pvc'], title: 'Door Jamb Kits PVC', sku: '105026', price: 65.95, unit: 'kit' },
    { keywords: ['door', 'casing', 'sets', 'header', 'trim'], title: 'Door Casing Sets & Header Trim Kits', sku: '105027', price: 35.95, unit: 'kit' },
    { keywords: ['door', 'sweeps', 'weatherstripping', 'kits'], title: 'Door Sweeps & Weatherstripping Kits', sku: '105028', price: 15.95, unit: 'kit' },
    
    // Trim, Moulding & Millwork
    { keywords: ['baseboard', 'moulding', '325', 'inch'], title: 'Baseboard Moulding 3¼"', sku: '105029', price: 2.95, unit: 'linearft' },
    { keywords: ['baseboard', 'moulding', '35', 'inch'], title: 'Baseboard Moulding 3½"', sku: '105030', price: 3.25, unit: 'linearft' },
    { keywords: ['baseboard', 'moulding', '425', 'inch'], title: 'Baseboard Moulding 4¼"', sku: '105031', price: 3.95, unit: 'linearft' },
    { keywords: ['baseboard', 'moulding', '525', 'inch'], title: 'Baseboard Moulding 5¼"', sku: '105032', price: 4.95, unit: 'linearft' },
    { keywords: ['baseboard', 'moulding', '725', 'inch'], title: 'Baseboard Moulding 7¼"', sku: '105033', price: 6.95, unit: 'linearft' },
    { keywords: ['casing', 'moulding', '225', 'inch'], title: 'Casing Moulding 2¼"', sku: '105034', price: 2.45, unit: 'linearft' },
    { keywords: ['casing', 'moulding', '25', 'inch'], title: 'Casing Moulding 2½"', sku: '105035', price: 2.65, unit: 'linearft' },
    { keywords: ['casing', 'moulding', '35', 'inch'], title: 'Casing Moulding 3½"', sku: '105036', price: 3.45, unit: 'linearft' },
    { keywords: ['crown', 'moulding', 'mdf'], title: 'Crown Moulding MDF', sku: '105037', price: 2.95, unit: 'linearft' },
    { keywords: ['crown', 'moulding', 'pine'], title: 'Crown Moulding Pine', sku: '105038', price: 3.95, unit: 'linearft' },
    { keywords: ['crown', 'moulding', 'poplar'], title: 'Crown Moulding Poplar', sku: '105039', price: 4.25, unit: 'linearft' },
    { keywords: ['crown', 'moulding', 'pvc'], title: 'Crown Moulding PVC', sku: '105040', price: 4.95, unit: 'linearft' },
    { keywords: ['crown', 'moulding', 'polyurethane'], title: 'Crown Moulding Polyurethane', sku: '105041', price: 5.95, unit: 'linearft' },
    { keywords: ['chair', 'rail', 'moulding'], title: 'Chair Rail Moulding', sku: '105042', price: 2.95, unit: 'linearft' },
    { keywords: ['wainscoting', 'panels', 'beadboard'], title: 'Wainscoting Panels Beadboard', sku: '105043', price: 18.95, unit: 'panel' },
    { keywords: ['wainscoting', 'panels', 'shiplap'], title: 'Wainscoting Panels Shiplap', sku: '105044', price: 15.95, unit: 'panel' },
    { keywords: ['shoe', 'moulding', 'quarter', 'round'], title: 'Shoe Moulding Quarter Round', sku: '105045', price: 1.95, unit: 'linearft' },
    { keywords: ['picture', 'rail', 'moulding'], title: 'Picture Rail Moulding', sku: '105046', price: 3.95, unit: 'linearft' },
    { keywords: ['door', 'window', 'stop', 'moulding'], title: 'Door & Window Stop Moulding', sku: '105047', price: 1.95, unit: 'linearft' },
    { keywords: ['backband', 'moulding'], title: 'Backband Moulding', sku: '105048', price: 2.95, unit: 'linearft' },
    { keywords: ['cap', 'panel', 'moulding', 'decorative'], title: 'Cap & Panel Moulding Decorative', sku: '105049', price: 4.95, unit: 'linearft' },
    { keywords: ['corner', 'moulding', 'inside', 'outside'], title: 'Corner Moulding Inside/Outside', sku: '105050', price: 3.95, unit: 'linearft' },
    { keywords: ['stair', 'nosing', 'tread', 'return', 'moulding'], title: 'Stair Nosing & Tread Return Moulding', sku: '105051', price: 8.95, unit: 'linearft' },
    { keywords: ['mdf', 'moulding', 'primed', 'paint'], title: 'MDF Moulding Primed Paint-Grade', sku: '105052', price: 2.25, unit: 'linearft' },
    { keywords: ['wood', 'moulding', 'clear', 'pine'], title: 'Wood Moulding Clear Pine', sku: '105053', price: 3.25, unit: 'linearft' },
    { keywords: ['wood', 'moulding', 'oak'], title: 'Wood Moulding Oak', sku: '105054', price: 4.95, unit: 'linearft' },
    { keywords: ['wood', 'moulding', 'poplar'], title: 'Wood Moulding Poplar', sku: '105055', price: 4.25, unit: 'linearft' },
    { keywords: ['wood', 'moulding', 'maple'], title: 'Wood Moulding Maple', sku: '105056', price: 5.25, unit: 'linearft' },
    { keywords: ['pvc', 'polyurethane', 'moulding', 'moisture'], title: 'PVC/Polyurethane Moulding Moisture-Resistant', sku: '105057', price: 3.95, unit: 'linearft' },
    { keywords: ['flexible', 'moulding', 'arches', 'curved'], title: 'Flexible Moulding Arches Curved', sku: '105058', price: 6.95, unit: 'linearft' },
    { keywords: ['moulding', 'blocks', 'corner', 'plinth'], title: 'Moulding Blocks Corner & Plinth', sku: '105059', price: 8.95, unit: 'each' },
    { keywords: ['crown', 'moulding', 'corners', 'pre', 'mitered'], title: 'Crown Moulding Corners Pre-Mitered', sku: '105060', price: 12.95, unit: 'each' },
    
    // Stair Parts & Rail Systems
    { keywords: ['stair', 'treads', 'oak'], title: 'Stair Treads Oak', sku: '105061', price: 45.95, unit: 'each' },
    { keywords: ['stair', 'treads', 'pine'], title: 'Stair Treads Pine', sku: '105062', price: 35.95, unit: 'each' },
    { keywords: ['stair', 'treads', 'maple'], title: 'Stair Treads Maple', sku: '105063', price: 48.95, unit: 'each' },
    { keywords: ['stair', 'treads', 'birch'], title: 'Stair Treads Birch', sku: '105064', price: 42.95, unit: 'each' },
    { keywords: ['stair', 'treads', 'laminated'], title: 'Stair Treads Laminated', sku: '105065', price: 38.95, unit: 'each' },
    { keywords: ['stair', 'risers', 'mdf', 'paint'], title: 'Stair Risers MDF Paint-Grade', sku: '105066', price: 15.95, unit: 'each' },
    { keywords: ['stair', 'risers', 'poplar'], title: 'Stair Risers Poplar', sku: '105067', price: 22.95, unit: 'each' },
    { keywords: ['stair', 'risers', 'oak', 'veneer'], title: 'Stair Risers Oak Veneer', sku: '105068', price: 28.95, unit: 'each' },
    { keywords: ['stair', 'stringers', 'precut', '3', 'step'], title: 'Stair Stringers Precut 3-Step', sku: '105069', price: 65.95, unit: 'each' },
    { keywords: ['stair', 'stringers', 'precut', '4', 'step'], title: 'Stair Stringers Precut 4-Step', sku: '105070', price: 75.95, unit: 'each' },
    { keywords: ['stair', 'stringers', 'precut', '5', 'step'], title: 'Stair Stringers Precut 5-Step', sku: '105071', price: 85.95, unit: 'each' },
    { keywords: ['handrails', 'round'], title: 'Handrails Round', sku: '105072', price: 12.95, unit: 'linearft' },
    { keywords: ['handrails', 'colonial'], title: 'Handrails Colonial', sku: '105073', price: 15.95, unit: 'linearft' },
    { keywords: ['handrails', 'modern'], title: 'Handrails Modern', sku: '105074', price: 18.95, unit: 'linearft' },
    { keywords: ['handrails', 'square'], title: 'Handrails Square', sku: '105075', price: 14.95, unit: 'linearft' },
    { keywords: ['baserails', 'shoe', 'rails', 'baluster'], title: 'Baserails & Shoe Rails Baluster', sku: '105076', price: 8.95, unit: 'linearft' },
    { keywords: ['balusters', 'spindles', 'wood'], title: 'Balusters/Spindles Wood', sku: '105077', price: 6.95, unit: 'each' },
    { keywords: ['balusters', 'spindles', 'iron'], title: 'Balusters/Spindles Iron', sku: '105078', price: 12.95, unit: 'each' },
    { keywords: ['balusters', 'spindles', 'metal'], title: 'Balusters/Spindles Metal', sku: '105079', price: 10.95, unit: 'each' },
    { keywords: ['balusters', 'spindles', 'glass'], title: 'Balusters/Spindles Glass', sku: '105080', price: 18.95, unit: 'each' },
    { keywords: ['newel', 'posts', 'turned'], title: 'Newel Posts Turned', sku: '105081', price: 85.95, unit: 'each' },
    { keywords: ['newel', 'posts', 'box'], title: 'Newel Posts Box', sku: '105082', price: 65.95, unit: 'each' },
    { keywords: ['newel', 'posts', 'modern', 'square'], title: 'Newel Posts Modern Square', sku: '105083', price: 75.95, unit: 'each' },
    { keywords: ['newel', 'caps', 'finials'], title: 'Newel Caps & Finials', sku: '105084', price: 25.95, unit: 'each' },
    { keywords: ['rail', 'brackets', 'fittings', 'connectors'], title: 'Rail Brackets Fittings & Connectors', sku: '105085', price: 15.95, unit: 'each' },
    { keywords: ['stair', 'nosing', 'hardwood'], title: 'Stair Nosing Hardwood', sku: '105086', price: 18.95, unit: 'linearft' },
    { keywords: ['stair', 'nosing', 'laminate'], title: 'Stair Nosing Laminate', sku: '105087', price: 12.95, unit: 'linearft' },
    { keywords: ['stair', 'nosing', 'metal'], title: 'Stair Nosing Metal', sku: '105088', price: 22.95, unit: 'linearft' },
    { keywords: ['stair', 'landing', 'treads', 'bullnose'], title: 'Stair Landing Treads & Bullnose', sku: '105089', price: 55.95, unit: 'each' },
    { keywords: ['stair', 'hardware', 'kits', 'brackets'], title: 'Stair Hardware Kits Brackets', sku: '105090', price: 45.95, unit: 'kit' },
    { keywords: ['anti', 'slip', 'tread', 'tape', 'grippers'], title: 'Anti-Slip Tread Tape & Grippers', sku: '105091', price: 8.95, unit: 'roll' },
    { keywords: ['stair', 'stain', 'finish', 'touch', 'up'], title: 'Stair Stain Finish & Touch-Up Pens', sku: '105092', price: 12.95, unit: 'kit' },
    
    // Wall Paneling & Decorative Surfaces
    { keywords: ['beadboard', 'panels', 'mdf'], title: 'Beadboard Panels MDF', sku: '105093', price: 18.95, unit: 'panel' },
    { keywords: ['beadboard', 'panels', 'pvc'], title: 'Beadboard Panels PVC', sku: '105094', price: 22.95, unit: 'panel' },
    { keywords: ['beadboard', 'panels', 'wood', 'veneer'], title: 'Beadboard Panels Wood Veneer', sku: '105095', price: 25.95, unit: 'panel' },
    { keywords: ['shiplap', 'wall', 'boards', 'mdf'], title: 'Shiplap Wall Boards MDF', sku: '105096', price: 15.95, unit: 'panel' },
    { keywords: ['shiplap', 'wall', 'boards', 'wood'], title: 'Shiplap Wall Boards Wood', sku: '105097', price: 18.95, unit: 'panel' },
    { keywords: ['shiplap', 'wall', 'boards', 'composite'], title: 'Shiplap Wall Boards Composite', sku: '105098', price: 16.95, unit: 'panel' },
    { keywords: ['tongue', 'groove', 'wall', 'planks', 'pine'], title: 'Tongue & Groove Wall Planks Pine', sku: '105099', price: 3.95, unit: 'linearft' },
    { keywords: ['tongue', 'groove', 'wall', 'planks', 'cedar'], title: 'Tongue & Groove Wall Planks Cedar', sku: '105100', price: 4.95, unit: 'linearft' },
    { keywords: ['tongue', 'groove', 'wall', 'planks', 'reclaimed'], title: 'Tongue & Groove Wall Planks Reclaimed', sku: '105101', price: 5.95, unit: 'linearft' },
    { keywords: ['3d', 'decorative', 'wall', 'panels', 'pvc'], title: '3D Decorative Wall Panels PVC', sku: '105102', price: 28.95, unit: 'panel' },
    { keywords: ['3d', 'decorative', 'wall', 'panels', 'mdf'], title: '3D Decorative Wall Panels MDF', sku: '105103', price: 22.95, unit: 'panel' },
    { keywords: ['3d', 'decorative', 'wall', 'panels', 'acoustic'], title: '3D Decorative Wall Panels Acoustic', sku: '105104', price: 35.95, unit: 'panel' },
    { keywords: ['wainscot', 'panels', 'kits', 'individual'], title: 'Wainscot Panels Kits & Individual', sku: '105105', price: 25.95, unit: 'kit' },
    { keywords: ['wall', 'panel', 'adhesives', 'loctite'], title: 'Wall Panel Adhesives Loctite', sku: '105106', price: 8.95, unit: 'tube' },
    { keywords: ['wall', 'panel', 'adhesives', 'liquid', 'nails'], title: 'Wall Panel Adhesives Liquid Nails', sku: '105107', price: 7.95, unit: 'tube' },
    { keywords: ['panel', 'moulding', 'kits', 'frames'], title: 'Panel Moulding Kits Frames', sku: '105108', price: 18.95, unit: 'kit' },
    
    // Closet Systems & Shelving
    { keywords: ['wire', 'shelving', '12', 'inch', 'depths'], title: 'Wire Shelving 12" Depths', sku: '105109', price: 25.95, unit: 'linearft' },
    { keywords: ['wire', 'shelving', '16', 'inch', 'depths'], title: 'Wire Shelving 16" Depths', sku: '105110', price: 28.95, unit: 'linearft' },
    { keywords: ['wire', 'shelving', '20', 'inch', 'depths'], title: 'Wire Shelving 20" Depths', sku: '105111', price: 32.95, unit: 'linearft' },
    { keywords: ['melamine', 'closet', 'systems', 'modular'], title: 'Melamine Closet Systems Modular', sku: '105112', price: 45.95, unit: 'linearft' },
    { keywords: ['wood', 'closet', 'organizer', 'systems'], title: 'Wood Closet Organizer Systems', sku: '105113', price: 65.95, unit: 'kit' },
    { keywords: ['rods', 'pole', 'sockets', 'steel'], title: 'Rods & Pole Sockets Steel', sku: '105114', price: 12.95, unit: 'each' },
    { keywords: ['rods', 'pole', 'sockets', 'aluminum'], title: 'Rods & Pole Sockets Aluminum', sku: '105115', price: 15.95, unit: 'each' },
    { keywords: ['adjustable', 'shelf', 'standards', 'brackets'], title: 'Adjustable Shelf Standards & Brackets', sku: '105116', price: 8.95, unit: 'each' },
    { keywords: ['floating', 'shelves', 'wood'], title: 'Floating Shelves Wood', sku: '105117', price: 25.95, unit: 'each' },
    { keywords: ['floating', 'shelves', 'mdf'], title: 'Floating Shelves MDF', sku: '105118', price: 18.95, unit: 'each' },
    { keywords: ['floating', 'shelves', 'metal'], title: 'Floating Shelves Metal', sku: '105119', price: 22.95, unit: 'each' },
    { keywords: ['closet', 'drawer', 'towers', 'bins'], title: 'Closet Drawer Towers & Bins', sku: '105120', price: 85.95, unit: 'each' },
    { keywords: ['shoe', 'racks', 'cubby', 'organizers'], title: 'Shoe Racks & Cubby Organizers', sku: '105121', price: 45.95, unit: 'each' },
    { keywords: ['wardrobe', 'rods', 'hangers'], title: 'Wardrobe Rods & Hangers', sku: '105122', price: 15.95, unit: 'each' },
    { keywords: ['slatwall', 'panels', 'hooks', 'garage'], title: 'Slatwall Panels & Hooks Garage', sku: '105123', price: 35.95, unit: 'panel' },
    { keywords: ['pantry', 'shelving', 'kits'], title: 'Pantry Shelving Kits', sku: '105124', price: 55.95, unit: 'kit' },
    { keywords: ['closet', 'mounting', 'hardware', 'anchors'], title: 'Closet Mounting Hardware & Anchors', sku: '105125', price: 12.95, unit: 'pack' },
    { keywords: ['sliding', 'shelf', 'tracks', 'drawer', 'slides'], title: 'Sliding Shelf Tracks & Drawer Slides', sku: '105126', price: 18.95, unit: 'pair' },
    
    // Adhesives, Fasteners & Accessories
    { keywords: ['construction', 'adhesive', 'loctite', 'pl', 'premium'], title: 'Construction Adhesive Loctite PL Premium', sku: '105127', price: 8.95, unit: 'tube' },
    { keywords: ['construction', 'adhesive', 'liquid', 'nails'], title: 'Construction Adhesive Liquid Nails', sku: '105128', price: 7.95, unit: 'tube' },
    { keywords: ['panel', 'adhesive', 'wainscot', 'shiplap'], title: 'Panel Adhesive Wainscot Shiplap', sku: '105129', price: 6.95, unit: 'tube' },
    { keywords: ['moulding', 'adhesive', 'instant', 'grab'], title: 'Moulding Adhesive Instant Grab', sku: '105130', price: 5.95, unit: 'tube' },
    { keywords: ['finish', 'nails', '15', 'gauge'], title: 'Finish Nails 15 Gauge', sku: '105131', price: 8.95, unit: 'box' },
    { keywords: ['finish', 'nails', '16', 'gauge'], title: 'Finish Nails 16 Gauge', sku: '105132', price: 7.95, unit: 'box' },
    { keywords: ['brad', 'nails', '18', 'gauge'], title: 'Brad Nails 18 Gauge', sku: '105133', price: 6.95, unit: 'box' },
    { keywords: ['pin', 'nails', '23', 'gauge'], title: 'Pin Nails 23 Gauge', sku: '105134', price: 5.95, unit: 'box' },
    { keywords: ['wood', 'screws', 'trim', 'head'], title: 'Wood Screws Trim Head', sku: '105135', price: 12.95, unit: 'box' },
    { keywords: ['wood', 'screws', 'finish'], title: 'Wood Screws Finish', sku: '105136', price: 10.95, unit: 'box' },
    { keywords: ['wood', 'screws', 'cabinet'], title: 'Wood Screws Cabinet', sku: '105137', price: 14.95, unit: 'box' },
    { keywords: ['wood', 'glue', 'carpenters'], title: 'Wood Glue Carpenters', sku: '105138', price: 6.95, unit: 'bottle' },
    { keywords: ['wood', 'glue', 'polyurethane'], title: 'Wood Glue Polyurethane', sku: '105139', price: 8.95, unit: 'bottle' },
    { keywords: ['wood', 'glue', 'pva'], title: 'Wood Glue PVA', sku: '105140', price: 5.95, unit: 'bottle' },
    { keywords: ['nail', 'hole', 'filler', 'putty'], title: 'Nail Hole Filler & Putty', sku: '105141', price: 4.95, unit: 'tube' },
    { keywords: ['sandpaper', 'sanding', 'sponges', '120', '220'], title: 'Sandpaper & Sanding Sponges 120-220', sku: '105142', price: 8.95, unit: 'pack' },
    { keywords: ['touch', 'up', 'markers', 'wax', 'fill'], title: 'Touch-Up Markers & Wax Fill Sticks', sku: '105143', price: 6.95, unit: 'pack' },
    { keywords: ['corner', 'protectors', 'clear'], title: 'Corner Protectors Clear', sku: '105144', price: 3.95, unit: 'pack' },
    { keywords: ['corner', 'protectors', 'metal'], title: 'Corner Protectors Metal', sku: '105145', price: 5.95, unit: 'pack' },
    { keywords: ['trim', 'caulk', 'paintable', 'latex'], title: 'Trim Caulk Paintable Latex', sku: '105146', price: 4.95, unit: 'tube' },
    { keywords: ['trim', 'caulk', 'acrylic'], title: 'Trim Caulk Acrylic', sku: '105147', price: 5.95, unit: 'tube' },
    { keywords: ['trim', 'caulk', 'siliconized'], title: 'Trim Caulk Siliconized', sku: '105148', price: 6.95, unit: 'tube' },
    
    // Trim & Finish Tools
    { keywords: ['miter', 'saw', 'sliding', 'compound'], title: 'Miter Saw Sliding Compound', sku: '105149', price: 285.95, unit: 'each' },
    { keywords: ['coping', 'saw', 'fine', 'tooth'], title: 'Coping Saw & Fine-Tooth Handsaw', sku: '105150', price: 25.95, unit: 'each' },
    { keywords: ['finish', 'nailer', '15', '16', 'gauge'], title: 'Finish Nailer 15-16 Gauge', sku: '105151', price: 185.95, unit: 'each' },
    { keywords: ['brad', 'nailer', '18', 'gauge'], title: 'Brad Nailer 18 Gauge', sku: '105152', price: 165.95, unit: 'each' },
    { keywords: ['pin', 'nailer', '23', 'gauge'], title: 'Pin Nailer 23 Gauge', sku: '105153', price: 145.95, unit: 'each' },
    { keywords: ['air', 'compressor', 'hoses'], title: 'Air Compressor & Hoses', sku: '105154', price: 225.95, unit: 'each' },
    { keywords: ['caulk', 'gun', 'manual'], title: 'Caulk Gun Manual', sku: '105155', price: 12.95, unit: 'each' },
    { keywords: ['caulk', 'gun', 'dripless'], title: 'Caulk Gun Dripless', sku: '105156', price: 18.95, unit: 'each' },
    { keywords: ['pry', 'bar', 'trim', 'puller'], title: 'Pry Bar & Trim Puller', sku: '105157', price: 22.95, unit: 'each' },
    { keywords: ['trim', 'clamps', 'corner', 'jigs'], title: 'Trim Clamps & Corner Jigs', sku: '105158', price: 35.95, unit: 'set' },
    { keywords: ['wood', 'filler', 'spreaders', 'putty', 'knives'], title: 'Wood Filler Spreaders & Putty Knives', sku: '105159', price: 15.95, unit: 'set' },
    { keywords: ['level', 'tape', 'measure', 'chalk', 'line'], title: 'Level Tape Measure & Chalk Line', sku: '105160', price: 25.95, unit: 'set' },
    { keywords: ['laser', 'measure', 'casing', 'trim', 'layout'], title: 'Laser Measure Casing/Trim Layout', sku: '105161', price: 85.95, unit: 'each' },
    
    // Finishing Products
    { keywords: ['wood', 'stain', 'oil', 'based'], title: 'Wood Stain Oil-Based', sku: '105162', price: 18.95, unit: 'quart' },
    { keywords: ['wood', 'stain', 'water', 'based'], title: 'Wood Stain Water-Based', sku: '105163', price: 16.95, unit: 'quart' },
    { keywords: ['wood', 'stain', 'gel'], title: 'Wood Stain Gel', sku: '105164', price: 22.95, unit: 'quart' },
    { keywords: ['polyurethane', 'gloss'], title: 'Polyurethane Gloss', sku: '105165', price: 25.95, unit: 'quart' },
    { keywords: ['polyurethane', 'semi', 'gloss'], title: 'Polyurethane Semi-Gloss', sku: '105166', price: 25.95, unit: 'quart' },
    { keywords: ['polyurethane', 'satin'], title: 'Polyurethane Satin', sku: '105167', price: 25.95, unit: 'quart' },
    { keywords: ['polyurethane', 'matte'], title: 'Polyurethane Matte', sku: '105168', price: 25.95, unit: 'quart' },
    { keywords: ['varnish', 'lacquer', 'spray'], title: 'Varnish & Lacquer Spray', sku: '105169', price: 18.95, unit: 'can' },
    { keywords: ['varnish', 'lacquer', 'brush', 'on'], title: 'Varnish & Lacquer Brush-On', sku: '105170', price: 22.95, unit: 'quart' },
    { keywords: ['sanding', 'sealer'], title: 'Sanding Sealer', sku: '105171', price: 15.95, unit: 'quart' },
    { keywords: ['paint', 'primer', 'trim'], title: 'Paint & Primer for Trim', sku: '105172', price: 28.95, unit: 'quart' },
    { keywords: ['wood', 'conditioner', 'touch', 'up'], title: 'Wood Conditioner & Touch-Up Pens', sku: '105173', price: 12.95, unit: 'bottle' },
    { keywords: ['wipe', 'on', 'finishes', 'poly'], title: 'Wipe-On Finishes Poly', sku: '105174', price: 18.95, unit: 'quart' },
    { keywords: ['wipe', 'on', 'finishes', 'wax'], title: 'Wipe-On Finishes Wax', sku: '105175', price: 14.95, unit: 'jar' },
    { keywords: ['wipe', 'on', 'finishes', 'oil'], title: 'Wipe-On Finishes Oil', sku: '105176', price: 16.95, unit: 'quart' },
    { keywords: ['brush', 'sets', 'finish', 'work'], title: 'Brush Sets for Finish Work', sku: '105177', price: 25.95, unit: 'set' },
    { keywords: ['cleaning', 'wipes', 'mineral', 'spirits'], title: 'Cleaning Wipes & Mineral Spirits', sku: '105178', price: 8.95, unit: 'bottle' },
    
    // Door & Interior Hardware - Door Hinges
    { keywords: ['standard', 'butt', 'hinges', '35', 'inch'], title: 'Standard Butt Hinges 3.5"', sku: '106001', price: 8.95, unit: 'pair' },
    { keywords: ['standard', 'butt', 'hinges', '4', 'inch'], title: 'Standard Butt Hinges 4"', sku: '106002', price: 9.95, unit: 'pair' },
    { keywords: ['standard', 'butt', 'hinges', '45', 'inch'], title: 'Standard Butt Hinges 4.5"', sku: '106003', price: 10.95, unit: 'pair' },
    { keywords: ['square', 'corner', 'hinges', 'standard'], title: 'Square Corner Hinges Standard', sku: '106004', price: 8.95, unit: 'pair' },
    { keywords: ['radius', 'corner', 'hinges', 'quarter', 'inch'], title: 'Radius Corner Hinges ¼"', sku: '106005', price: 9.95, unit: 'pair' },
    { keywords: ['radius', 'corner', 'hinges', '58', 'inch'], title: 'Radius Corner Hinges 5/8"', sku: '106006', price: 10.95, unit: 'pair' },
    { keywords: ['ball', 'bearing', 'hinges', 'heavy', 'duty'], title: 'Ball Bearing Hinges Heavy-Duty', sku: '106007', price: 12.95, unit: 'pair' },
    { keywords: ['spring', 'hinges', 'self', 'closing'], title: 'Spring Hinges Self-Closing', sku: '106008', price: 18.95, unit: 'each' },
    { keywords: ['piano', 'hinges', 'continuous'], title: 'Piano Hinges Continuous', sku: '106009', price: 15.95, unit: 'linearft' },
    { keywords: ['decorative', 'hinges', 'black'], title: 'Decorative Hinges Black', sku: '106010', price: 12.95, unit: 'pair' },
    { keywords: ['decorative', 'hinges', 'antique', 'brass'], title: 'Decorative Hinges Antique Brass', sku: '106011', price: 14.95, unit: 'pair' },
    { keywords: ['decorative', 'hinges', 'nickel'], title: 'Decorative Hinges Nickel', sku: '106012', price: 13.95, unit: 'pair' },
    { keywords: ['decorative', 'hinges', 'chrome'], title: 'Decorative Hinges Chrome', sku: '106013', price: 12.95, unit: 'pair' },
    { keywords: ['concealed', 'hinges', 'hidden', 'cabinet'], title: 'Concealed Hinges Hidden Cabinet', sku: '106014', price: 8.95, unit: 'pair' },
    { keywords: ['hinge', 'pins', 'hinge', 'pin', 'door', 'stops'], title: 'Hinge Pins & Hinge Pin Door Stops', sku: '106015', price: 4.95, unit: 'pack' },
    { keywords: ['exterior', 'rated', 'hinges', 'stainless'], title: 'Exterior-Rated Hinges Stainless', sku: '106016', price: 15.95, unit: 'pair' },
    { keywords: ['exterior', 'rated', 'hinges', 'oil', 'rubbed', 'bronze'], title: 'Exterior-Rated Hinges Oil-Rubbed Bronze', sku: '106017', price: 16.95, unit: 'pair' },
    
    // Door Knobs, Levers & Handlesets
    { keywords: ['passage', 'door', 'knobs', 'non', 'locking'], title: 'Passage Door Knobs Non-Locking', sku: '106018', price: 15.95, unit: 'set' },
    { keywords: ['privacy', 'door', 'knobs', 'bed', 'bath'], title: 'Privacy Door Knobs Bed/Bath', sku: '106019', price: 18.95, unit: 'set' },
    { keywords: ['keyed', 'entry', 'knobs', 'bedroom', 'garage'], title: 'Keyed Entry Knobs Bedroom/Garage', sku: '106020', price: 22.95, unit: 'set' },
    { keywords: ['dummy', 'door', 'knobs', 'inactive'], title: 'Dummy Door Knobs Inactive', sku: '106021', price: 12.95, unit: 'each' },
    { keywords: ['passage', 'lever', 'handles', 'non', 'locking'], title: 'Passage Lever Handles Non-Locking', sku: '106022', price: 18.95, unit: 'set' },
    { keywords: ['privacy', 'lever', 'handles', 'locking'], title: 'Privacy Lever Handles Locking', sku: '106023', price: 22.95, unit: 'set' },
    { keywords: ['keyed', 'lever', 'handles', 'entry'], title: 'Keyed Lever Handles Entry', sku: '106024', price: 28.95, unit: 'set' },
    { keywords: ['dummy', 'lever', 'handles', 'inactive'], title: 'Dummy Lever Handles Inactive', sku: '106025', price: 15.95, unit: 'each' },
    { keywords: ['handlesets', 'deadbolts', 'front', 'door'], title: 'Handlesets with Deadbolts Front Door', sku: '106026', price: 85.95, unit: 'set' },
    { keywords: ['ada', 'compliant', 'lever', 'handles', 'return'], title: 'ADA-Compliant Lever Handles Return', sku: '106027', price: 25.95, unit: 'set' },
    { keywords: ['contemporary', 'square', 'round', 'rosette', 'levers'], title: 'Contemporary Square/Round Rosette Levers', sku: '106028', price: 22.95, unit: 'set' },
    { keywords: ['electronic', 'keypads', 'smart', 'locks'], title: 'Electronic Keypads & Smart Locks', sku: '106029', price: 125.95, unit: 'each' },
    { keywords: ['keypad', 'lever', 'handles', 'numeric'], title: 'Keypad Lever Handles Numeric', sku: '106030', price: 95.95, unit: 'each' },
    { keywords: ['keypad', 'lever', 'handles', 'touchscreen'], title: 'Keypad Lever Handles Touchscreen', sku: '106031', price: 115.95, unit: 'each' },
    { keywords: ['smart', 'deadbolts', 'wifi', 'bluetooth'], title: 'Smart Deadbolts Wi-Fi/Bluetooth', sku: '106032', price: 145.95, unit: 'each' },
    { keywords: ['keyless', 'passage', 'handles', 'thumb', 'turn'], title: 'Keyless Passage Handles Thumb-Turn', sku: '106033', price: 18.95, unit: 'set' },
    
    // Locks, Latches & Deadbolts
    { keywords: ['single', 'cylinder', 'deadbolts', 'key', 'outside'], title: 'Single-Cylinder Deadbolts Key Outside', sku: '106034', price: 25.95, unit: 'each' },
    { keywords: ['double', 'cylinder', 'deadbolts', 'key', 'both'], title: 'Double-Cylinder Deadbolts Key Both', sku: '106035', price: 28.95, unit: 'each' },
    { keywords: ['deadlatch', 'sets'], title: 'Deadlatch Sets', sku: '106036', price: 22.95, unit: 'set' },
    { keywords: ['drive', 'in', 'latches'], title: 'Drive-In Latches', sku: '106037', price: 8.95, unit: 'each' },
    { keywords: ['mortise', 'locks', 'commercial'], title: 'Mortise Locks Commercial', sku: '106038', price: 85.95, unit: 'each' },
    { keywords: ['mortise', 'locks', 'high', 'end', 'residential'], title: 'Mortise Locks High-End Residential', sku: '106039', price: 65.95, unit: 'each' },
    { keywords: ['surface', 'mount', 'bolts', 'barrel'], title: 'Surface-Mount Bolts Barrel', sku: '106040', price: 15.95, unit: 'each' },
    { keywords: ['surface', 'mount', 'bolts', 'slide'], title: 'Surface-Mount Bolts Slide', sku: '106041', price: 18.95, unit: 'each' },
    { keywords: ['surface', 'mount', 'bolts', 'flush'], title: 'Surface-Mount Bolts Flush', sku: '106042', price: 16.95, unit: 'each' },
    { keywords: ['chain', 'door', 'guards', 'swing', 'bar'], title: 'Chain Door Guards & Swing Bar', sku: '106043', price: 12.95, unit: 'each' },
    { keywords: ['security', 'door', 'bolts', 'strike', 'plates'], title: 'Security Door Bolts & Strike Plates', sku: '106044', price: 8.95, unit: 'each' },
    { keywords: ['keyed', 'alike', 'keyed', 'different', 'locksets'], title: 'Keyed Alike/Different Locksets', sku: '106045', price: 35.95, unit: 'set' },
    { keywords: ['door', 'lock', 'rekeying', 'kits'], title: 'Door Lock Rekeying Kits', sku: '106046', price: 25.95, unit: 'kit' },
    { keywords: ['privacy', 'latch', 'replacements'], title: 'Privacy Latch Replacements', sku: '106047', price: 12.95, unit: 'each' },
    { keywords: ['smart', 'locks', 'app', 'controlled'], title: 'Smart Locks App-Controlled', sku: '106048', price: 95.95, unit: 'each' },
    { keywords: ['electronic', 'door', 'strikes', 'access', 'control'], title: 'Electronic Door Strikes Access Control', sku: '106049', price: 45.95, unit: 'each' },
    
    // Door Stops, Bumpers & Accessories
    { keywords: ['floor', 'mounted', 'door', 'stops', 'rubber'], title: 'Floor-Mounted Door Stops Rubber', sku: '106050', price: 4.95, unit: 'each' },
    { keywords: ['floor', 'mounted', 'door', 'stops', 'metal'], title: 'Floor-Mounted Door Stops Metal', sku: '106051', price: 6.95, unit: 'each' },
    { keywords: ['wall', 'mounted', 'door', 'stops'], title: 'Wall-Mounted Door Stops', sku: '106052', price: 3.95, unit: 'each' },
    { keywords: ['hinge', 'pin', 'door', 'stops'], title: 'Hinge-Pin Door Stops', sku: '106053', price: 2.95, unit: 'each' },
    { keywords: ['kick', 'down', 'door', 'holders', 'commercial'], title: 'Kick-Down Door Holders Commercial', sku: '106054', price: 8.95, unit: 'each' },
    { keywords: ['magnetic', 'door', 'stops', 'catches'], title: 'Magnetic Door Stops & Catches', sku: '106055', price: 5.95, unit: 'each' },
    { keywords: ['door', 'silencers', 'rubber', 'bumpers'], title: 'Door Silencers & Rubber Bumpers', sku: '106056', price: 3.95, unit: 'pack' },
    { keywords: ['door', 'closers', 'residential', 'hydraulic'], title: 'Door Closers Residential Hydraulic', sku: '106057', price: 45.95, unit: 'each' },
    { keywords: ['door', 'closers', 'commercial', 'overhead'], title: 'Door Closers Commercial Overhead', sku: '106058', price: 65.95, unit: 'each' },
    { keywords: ['pneumatic', 'screen', 'door', 'closers'], title: 'Pneumatic Screen Door Closers', sku: '106059', price: 22.95, unit: 'each' },
    { keywords: ['door', 'chains', 'guards'], title: 'Door Chains & Guards', sku: '106060', price: 8.95, unit: 'each' },
    { keywords: ['door', 'kick', 'plates', 'brass'], title: 'Door Kick Plates Brass', sku: '106061', price: 18.95, unit: 'each' },
    { keywords: ['door', 'kick', 'plates', 'aluminum'], title: 'Door Kick Plates Aluminum', sku: '106062', price: 12.95, unit: 'each' },
    { keywords: ['door', 'kick', 'plates', 'stainless'], title: 'Door Kick Plates Stainless', sku: '106063', price: 15.95, unit: 'each' },
    { keywords: ['door', 'kick', 'plates', 'bronze'], title: 'Door Kick Plates Bronze', sku: '106064', price: 16.95, unit: 'each' },
    { keywords: ['door', 'kick', 'plates', 'black'], title: 'Door Kick Plates Black', sku: '106065', price: 14.95, unit: 'each' },
    { keywords: ['push', 'plates', 'commercial'], title: 'Push Plates Commercial', sku: '106066', price: 22.95, unit: 'each' },
    { keywords: ['door', 'edge', 'guards', 'plastic'], title: 'Door Edge Guards Plastic', sku: '106067', price: 3.95, unit: 'linearft' },
    { keywords: ['door', 'edge', 'guards', 'rubber'], title: 'Door Edge Guards Rubber', sku: '106068', price: 4.95, unit: 'linearft' },
    { keywords: ['door', 'edge', 'guards', 'metal'], title: 'Door Edge Guards Metal', sku: '106069', price: 6.95, unit: 'linearft' },
    
    // Thresholds, Weatherstripping & Seals
    { keywords: ['door', 'thresholds', 'aluminum'], title: 'Door Thresholds Aluminum', sku: '106070', price: 25.95, unit: 'each' },
    { keywords: ['door', 'thresholds', 'oak'], title: 'Door Thresholds Oak', sku: '106071', price: 35.95, unit: 'each' },
    { keywords: ['door', 'thresholds', 'composite'], title: 'Door Thresholds Composite', sku: '106072', price: 28.95, unit: 'each' },
    { keywords: ['saddle', 'thresholds', 'interior', 'transitions'], title: 'Saddle Thresholds Interior Transitions', sku: '106073', price: 22.95, unit: 'each' },
    { keywords: ['thermal', 'break', 'thresholds', 'energy', 'efficient'], title: 'Thermal Break Thresholds Energy-Efficient', sku: '106074', price: 45.95, unit: 'each' },
    { keywords: ['door', 'sweeps', 'rubber'], title: 'Door Sweeps Rubber', sku: '106075', price: 8.95, unit: 'each' },
    { keywords: ['door', 'sweeps', 'brush'], title: 'Door Sweeps Brush', sku: '106076', price: 12.95, unit: 'each' },
    { keywords: ['door', 'sweeps', 'vinyl'], title: 'Door Sweeps Vinyl', sku: '106077', price: 6.95, unit: 'each' },
    { keywords: ['door', 'bottom', 'seals', 'u', 'shaped'], title: 'Door Bottom Seals U-Shaped', sku: '106078', price: 15.95, unit: 'each' },
    { keywords: ['door', 'bottom', 'seals', 'adhesive'], title: 'Door Bottom Seals Adhesive', sku: '106079', price: 12.95, unit: 'each' },
    { keywords: ['door', 'bottom', 'seals', 'screw', 'on'], title: 'Door Bottom Seals Screw-On', sku: '106080', price: 18.95, unit: 'each' },
    { keywords: ['weatherstripping', 'kits', 'foam'], title: 'Weatherstripping Kits Foam', sku: '106081', price: 8.95, unit: 'kit' },
    { keywords: ['weatherstripping', 'kits', 'silicone'], title: 'Weatherstripping Kits Silicone', sku: '106082', price: 12.95, unit: 'kit' },
    { keywords: ['weatherstripping', 'kits', 'magnetic'], title: 'Weatherstripping Kits Magnetic', sku: '106083', price: 15.95, unit: 'kit' },
    { keywords: ['soundproof', 'door', 'seals', 'neoprene'], title: 'Soundproof Door Seals Neoprene', sku: '106084', price: 22.95, unit: 'linearft' },
    { keywords: ['astragal', 'seals', 'double', 'door'], title: 'Astragal Seals Double Door', sku: '106085', price: 18.95, unit: 'linearft' },
    { keywords: ['drip', 'caps', 'exterior', 'utility'], title: 'Drip Caps Exterior/Utility', sku: '106086', price: 12.95, unit: 'each' },
    
    // Closet & Bifold Door Hardware
    { keywords: ['bifold', 'door', 'track', 'roller', 'kits'], title: 'Bifold Door Track & Roller Kits', sku: '106087', price: 25.95, unit: 'kit' },
    { keywords: ['bypass', 'sliding', 'door', 'tracks', 'closet'], title: 'Bypass Sliding Door Tracks Closet', sku: '106088', price: 35.95, unit: 'kit' },
    { keywords: ['top', 'bottom', 'guide', 'rollers'], title: 'Top & Bottom Guide Rollers', sku: '106089', price: 8.95, unit: 'each' },
    { keywords: ['mirror', 'door', 'roller', 'assemblies'], title: 'Mirror Door Roller Assemblies', sku: '106090', price: 15.95, unit: 'each' },
    { keywords: ['pivot', 'brackets', 'guide', 'pins'], title: 'Pivot Brackets & Guide Pins', sku: '106091', price: 12.95, unit: 'each' },
    { keywords: ['door', 'pulls', 'recessed', 'handles', 'sliding'], title: 'Door Pulls & Recessed Handles Sliding', sku: '106092', price: 8.95, unit: 'each' },
    { keywords: ['barn', 'door', 'track', 'systems', 'steel'], title: 'Barn Door Track Systems Steel', sku: '106093', price: 45.95, unit: 'kit' },
    { keywords: ['barn', 'door', 'track', 'systems', 'matte', 'black'], title: 'Barn Door Track Systems Matte Black', sku: '106094', price: 55.95, unit: 'kit' },
    { keywords: ['barn', 'door', 'track', 'systems', 'brushed', 'nickel'], title: 'Barn Door Track Systems Brushed Nickel', sku: '106095', price: 65.95, unit: 'kit' },
    { keywords: ['barn', 'door', 'rollers', 'hangers'], title: 'Barn Door Rollers & Hangers', sku: '106096', price: 25.95, unit: 'each' },
    { keywords: ['barn', 'door', 'soft', 'close', 'kits'], title: 'Barn Door Soft-Close Kits', sku: '106097', price: 35.95, unit: 'kit' },
    { keywords: ['bypass', 'barn', 'door', 'hardware', 'kits'], title: 'Bypass Barn Door Hardware Kits', sku: '106098', price: 75.95, unit: 'kit' },
    { keywords: ['decorative', 'barn', 'door', 'pulls', 'handles'], title: 'Decorative Barn Door Pulls & Handles', sku: '106099', price: 18.95, unit: 'each' },
    
    // Cabinet & Drawer Hardware (Basic Overlap)
    { keywords: ['cabinet', 'knobs', 'round'], title: 'Cabinet Knobs Round', sku: '106100', price: 3.95, unit: 'each' },
    { keywords: ['cabinet', 'knobs', 'square'], title: 'Cabinet Knobs Square', sku: '106101', price: 4.95, unit: 'each' },
    { keywords: ['cabinet', 'knobs', 'contemporary'], title: 'Cabinet Knobs Contemporary', sku: '106102', price: 5.95, unit: 'each' },
    { keywords: ['cabinet', 'knobs', 'antique'], title: 'Cabinet Knobs Antique', sku: '106103', price: 6.95, unit: 'each' },
    { keywords: ['cabinet', 'pulls', 'handles', 'bar'], title: 'Cabinet Pulls/Handles Bar', sku: '106104', price: 8.95, unit: 'each' },
    { keywords: ['cabinet', 'pulls', 'handles', 'arch'], title: 'Cabinet Pulls/Handles Arch', sku: '106105', price: 9.95, unit: 'each' },
    { keywords: ['cabinet', 'pulls', 'handles', 'finger'], title: 'Cabinet Pulls/Handles Finger', sku: '106106', price: 7.95, unit: 'each' },
    { keywords: ['cup', 'pulls', 'bin', 'pulls'], title: 'Cup Pulls & Bin Pulls', sku: '106107', price: 6.95, unit: 'each' },
    { keywords: ['cabinet', 'hinges', 'concealed'], title: 'Cabinet Hinges Concealed', sku: '106108', price: 5.95, unit: 'pair' },
    { keywords: ['cabinet', 'hinges', 'overlay'], title: 'Cabinet Hinges Overlay', sku: '106109', price: 4.95, unit: 'pair' },
    { keywords: ['cabinet', 'hinges', 'inset'], title: 'Cabinet Hinges Inset', sku: '106110', price: 6.95, unit: 'pair' },
    { keywords: ['drawer', 'slides', 'side', 'mount'], title: 'Drawer Slides Side-Mount', sku: '106111', price: 12.95, unit: 'pair' },
    { keywords: ['drawer', 'slides', 'under', 'mount'], title: 'Drawer Slides Under-Mount', sku: '106112', price: 18.95, unit: 'pair' },
    { keywords: ['drawer', 'slides', 'soft', 'close'], title: 'Drawer Slides Soft-Close', sku: '106113', price: 22.95, unit: 'pair' },
    { keywords: ['cabinet', 'latches', 'catches', 'magnets'], title: 'Cabinet Latches, Catches & Magnets', sku: '106114', price: 8.95, unit: 'each' },
    { keywords: ['furniture', 'leg', 'glides', 'levelers'], title: 'Furniture Leg Glides & Levelers', sku: '106115', price: 4.95, unit: 'pack' },
    
    // Hardware Finishes
    { keywords: ['satin', 'nickel', 'hardware'], title: 'Satin Nickel Hardware', sku: '106116', price: 0.00, unit: 'finish' },
    { keywords: ['polished', 'chrome', 'hardware'], title: 'Polished Chrome Hardware', sku: '106117', price: 0.00, unit: 'finish' },
    { keywords: ['oil', 'rubbed', 'bronze', 'hardware'], title: 'Oil-Rubbed Bronze Hardware', sku: '106118', price: 0.00, unit: 'finish' },
    { keywords: ['matte', 'black', 'hardware'], title: 'Matte Black Hardware', sku: '106119', price: 0.00, unit: 'finish' },
    { keywords: ['brushed', 'brass', 'gold', 'hardware'], title: 'Brushed Brass/Gold Hardware', sku: '106120', price: 0.00, unit: 'finish' },
    { keywords: ['antique', 'brass', 'hardware'], title: 'Antique Brass Hardware', sku: '106121', price: 0.00, unit: 'finish' },
    { keywords: ['stainless', 'steel', 'hardware'], title: 'Stainless Steel Hardware', sku: '106122', price: 0.00, unit: 'finish' },
    { keywords: ['pewter', 'gunmetal', 'gray', 'hardware'], title: 'Pewter/Gunmetal Gray Hardware', sku: '106123', price: 0.00, unit: 'finish' },
    { keywords: ['polished', 'brass', 'hardware'], title: 'Polished Brass Hardware', sku: '106124', price: 0.00, unit: 'finish' },
    
    // Windows - Residential Window Types
    { keywords: ['single', 'hung', 'windows', 'bottom', 'sash'], title: 'Single-Hung Windows Bottom Sash', sku: '107001', price: 185.95, unit: 'each' },
    { keywords: ['double', 'hung', 'windows', 'both', 'sashes'], title: 'Double-Hung Windows Both Sashes', sku: '107002', price: 225.95, unit: 'each' },
    { keywords: ['horizontal', 'sliding', 'windows', 'single', 'slider'], title: 'Horizontal Sliding Windows Single-Slider', sku: '107003', price: 195.95, unit: 'each' },
    { keywords: ['horizontal', 'sliding', 'windows', 'double', 'slider'], title: 'Horizontal Sliding Windows Double-Slider', sku: '107004', price: 235.95, unit: 'each' },
    { keywords: ['casement', 'windows', 'side', 'hinged', 'crank'], title: 'Casement Windows Side-Hinged Crank-Out', sku: '107005', price: 245.95, unit: 'each' },
    { keywords: ['awning', 'windows', 'top', 'hinged', 'crank'], title: 'Awning Windows Top-Hinged Crank-Out', sku: '107006', price: 215.95, unit: 'each' },
    { keywords: ['hopper', 'windows', 'bottom', 'hinged', 'basement'], title: 'Hopper Windows Bottom-Hinged Basement', sku: '107007', price: 175.95, unit: 'each' },
    { keywords: ['picture', 'windows', 'fixed', 'non', 'operable'], title: 'Picture Windows Fixed Non-Operable', sku: '107008', price: 155.95, unit: 'each' },
    { keywords: ['bay', 'windows', '3', 'panel', 'projection'], title: 'Bay Windows 3-Panel Projection', sku: '107009', price: 895.95, unit: 'each' },
    { keywords: ['bow', 'windows', '4', '5', 'panel', 'curved'], title: 'Bow Windows 4-5 Panel Curved', sku: '107010', price: 1250.95, unit: 'each' },
    { keywords: ['garden', 'windows', 'box', 'out', 'glass'], title: 'Garden Windows Box-Out Glass', sku: '107011', price: 485.95, unit: 'each' },
    { keywords: ['egress', 'windows', 'basement', 'bedroom', 'escape'], title: 'Egress Windows Basement/Bedroom Escape', sku: '107012', price: 325.95, unit: 'each' },
    { keywords: ['skylights', 'roof', 'windows', 'fixed'], title: 'Skylights & Roof Windows Fixed', sku: '107013', price: 295.95, unit: 'each' },
    { keywords: ['skylights', 'roof', 'windows', 'manual', 'venting'], title: 'Skylights & Roof Windows Manual Venting', sku: '107014', price: 425.95, unit: 'each' },
    { keywords: ['skylights', 'roof', 'windows', 'solar', 'venting'], title: 'Skylights & Roof Windows Solar Venting', sku: '107015', price: 695.95, unit: 'each' },
    { keywords: ['tubular', 'skylights', 'solar', 'tunnels'], title: 'Tubular Skylights Solar Tunnels', sku: '107016', price: 185.95, unit: 'each' },
    { keywords: ['storm', 'windows', 'exterior', 'retrofit'], title: 'Storm Windows Exterior Retrofit', sku: '107017', price: 125.95, unit: 'each' },
    { keywords: ['transom', 'sidelite', 'windows', 'doors'], title: 'Transom & Sidelite Windows Doors', sku: '107018', price: 185.95, unit: 'each' },
    { keywords: ['arched', 'specialty', 'shape', 'windows'], title: 'Arched & Specialty Shape Windows', sku: '107019', price: 385.95, unit: 'each' },
    
    // Frame Material Types
    { keywords: ['vinyl', 'pvc', 'upvc', 'windows', 'multi', 'chambered'], title: 'Vinyl (PVC/uPVC) Multi-Chambered Windows', sku: '107020', price: 195.95, unit: 'each' },
    { keywords: ['aluminum', 'windows', 'thermally', 'broken'], title: 'Aluminum Thermally Broken Windows', sku: '107021', price: 245.95, unit: 'each' },
    { keywords: ['fiberglass', 'windows', 'composite', 'pultruded'], title: 'Fiberglass Composite Pultruded Windows', sku: '107022', price: 285.95, unit: 'each' },
    { keywords: ['wood', 'windows', 'pine', 'fir', 'oak'], title: 'Wood Windows Pine/Fir/Oak', sku: '107023', price: 325.95, unit: 'each' },
    { keywords: ['clad', 'wood', 'windows', 'aluminum', 'vinyl'], title: 'Clad-Wood Windows Aluminum/Vinyl', sku: '107024', price: 385.95, unit: 'each' },
    { keywords: ['composite', 'fibrex', 'windows', 'engineered'], title: 'Composite/Fibrex Engineered Windows', sku: '107025', price: 295.95, unit: 'each' },
    { keywords: ['pvc', 'brickmould', 'j', 'channel', 'frames'], title: 'PVC Brickmould/J-Channel Frames', sku: '107026', price: 22.95, unit: 'linearft' },
    { keywords: ['black', 'exterior', 'aluminum', 'windows'], title: 'Black Exterior Aluminum Windows', sku: '107027', price: 295.95, unit: 'each' },
    
    // Glass & Energy-Efficiency Options
    { keywords: ['dual', 'pane', 'insulated', 'glass', 'igu'], title: 'Dual-Pane Insulated Glass (IGU)', sku: '107028', price: 45.95, unit: 'sqft' },
    { keywords: ['triple', 'pane', 'insulated', 'glass', 'argon'], title: 'Triple-Pane Insulated Glass Argon', sku: '107029', price: 75.95, unit: 'sqft' },
    { keywords: ['low', 'e', 'glass', 'low-e2', 'low-e3'], title: 'Low-E Glass Low-E2/Low-E3', sku: '107030', price: 25.95, unit: 'sqft' },
    { keywords: ['tempered', 'safety', 'glass', 'code'], title: 'Tempered Safety Glass Code', sku: '107031', price: 35.95, unit: 'sqft' },
    { keywords: ['laminated', 'impact', 'resistant', 'glass'], title: 'Laminated Impact-Resistant Glass', sku: '107032', price: 55.95, unit: 'sqft' },
    { keywords: ['obscure', 'frosted', 'glass', 'bathroom'], title: 'Obscure/Frosted Glass Bathroom', sku: '107033', price: 28.95, unit: 'sqft' },
    { keywords: ['tinted', 'glass', 'gray', 'bronze', 'blue'], title: 'Tinted Glass Gray/Bronze/Blue', sku: '107034', price: 32.95, unit: 'sqft' },
    { keywords: ['sound', 'control', 'acoustic', 'glass'], title: 'Sound-Control/Acoustic Glass', sku: '107035', price: 65.95, unit: 'sqft' },
    { keywords: ['uv', 'blocking', 'solar', 'control', 'glass'], title: 'UV-Blocking/Solar Control Glass', sku: '107036', price: 42.95, unit: 'sqft' },
    { keywords: ['decorative', 'grille', 'styles', 'colonial'], title: 'Decorative Grille Styles Colonial', sku: '107037', price: 15.95, unit: 'sqft' },
    { keywords: ['decorative', 'grille', 'styles', 'prairie'], title: 'Decorative Grille Styles Prairie', sku: '107038', price: 18.95, unit: 'sqft' },
    { keywords: ['decorative', 'grille', 'styles', 'diamond'], title: 'Decorative Grille Styles Diamond', sku: '107039', price: 22.95, unit: 'sqft' },
    
    // Mounting & Installation Styles
    { keywords: ['new', 'construction', 'windows', 'nail', 'fin'], title: 'New-Construction Windows Nail-Fin', sku: '107040', price: 195.95, unit: 'each' },
    { keywords: ['replacement', 'retrofit', 'windows', 'block', 'frame'], title: 'Replacement/Retrofit Windows Block Frame', sku: '107041', price: 185.95, unit: 'each' },
    { keywords: ['j', 'channel', 'mount', 'windows', 'vinyl'], title: 'J-Channel Mount Windows Vinyl', sku: '107042', price: 195.95, unit: 'each' },
    { keywords: ['nail', 'fin', 'mount', 'windows', 'sheathing'], title: 'Nail-Fin Mount Windows Sheathing', sku: '107043', price: 195.95, unit: 'each' },
    { keywords: ['pocket', 'replacement', 'windows', 'remodel'], title: 'Pocket Replacement Windows Remodel', sku: '107044', price: 175.95, unit: 'each' },
    { keywords: ['mulled', 'window', 'combinations', 'factory'], title: 'Mulled Window Combinations Factory', sku: '107045', price: 425.95, unit: 'each' },
    { keywords: ['integral', 'blind', 'windows', 'built', 'in'], title: 'Integral Blind Windows Built-In', sku: '107046', price: 325.95, unit: 'each' },
    { keywords: ['tilt', 'turn', 'hopper', 'combo', 'units'], title: 'Tilt-Turn & Hopper Combo Units', sku: '107047', price: 285.95, unit: 'each' },
    
    // Installation Components & Accessories
    { keywords: ['nailing', 'fins', 'corner', 'keys'], title: 'Nailing Fins & Corner Keys', sku: '107048', price: 8.95, unit: 'pack' },
    { keywords: ['vinyl', 'pvc', 'shims', 'setting', 'blocks'], title: 'Vinyl/PVC Shims & Setting Blocks', sku: '107049', price: 12.95, unit: 'pack' },
    { keywords: ['foam', 'backer', 'rod', 'sealant', 'joints'], title: 'Foam Backer Rod Sealant Joints', sku: '107050', price: 6.95, unit: 'linearft' },
    { keywords: ['self', 'adhesive', 'flashing', 'tape', 'butyl'], title: 'Self-Adhesive Flashing Tape Butyl', sku: '107051', price: 18.95, unit: 'roll' },
    { keywords: ['liquid', 'flashing', 'membrane', 'elastomeric'], title: 'Liquid Flashing Membrane Elastomeric', sku: '107052', price: 25.95, unit: 'tube' },
    { keywords: ['sill', 'pans', 'pvc', 'aluminum', 'composite'], title: 'Sill Pans PVC/Aluminum/Composite', sku: '107053', price: 15.95, unit: 'each' },
    { keywords: ['drip', 'cap', 'flashing'], title: 'Drip Cap Flashing', sku: '107054', price: 8.95, unit: 'linearft' },
    { keywords: ['window', 'bucks', 'wood', 'pvc'], title: 'Window Bucks Wood/PVC', sku: '107055', price: 22.95, unit: 'linearft' },
    { keywords: ['spray', 'foam', 'low', 'expansion', 'window'], title: 'Spray Foam Low-Expansion Window-Safe', sku: '107056', price: 8.95, unit: 'can' },
    { keywords: ['exterior', 'caulking', 'paintable', 'silicone'], title: 'Exterior Caulking Paintable Silicone', sku: '107057', price: 6.95, unit: 'tube' },
    { keywords: ['trim', 'coil', 'aluminum', 'brake', 'metal'], title: 'Trim Coil & Aluminum Brake Metal', sku: '107058', price: 25.95, unit: 'linearft' },
    { keywords: ['mounting', 'screws', 'self', 'tapping', 'stainless'], title: 'Mounting Screws Self-Tapping Stainless', sku: '107059', price: 4.95, unit: 'pack' },
    { keywords: ['interior', 'stop', 'moulding', 'casing', 'kits'], title: 'Interior Stop Moulding & Casing Kits', sku: '107060', price: 35.95, unit: 'kit' },
    { keywords: ['replacement', 'balance', 'springs', 'tilt', 'latches'], title: 'Replacement Balance Springs & Tilt Latches', sku: '107061', price: 12.95, unit: 'each' },
    { keywords: ['crank', 'handles', 'operators', 'casement'], title: 'Crank Handles & Operators Casement', sku: '107062', price: 18.95, unit: 'each' },
    
    // Exterior & Interior Trim Systems
    { keywords: ['brickmould', 'kits', 'pvc', 'composite', 'primed'], title: 'Brickmould Kits PVC/Composite/Primed', sku: '107063', price: 28.95, unit: 'linearft' },
    { keywords: ['interior', 'extension', 'jamb', 'kits'], title: 'Interior Extension Jamb Kits', sku: '107064', price: 22.95, unit: 'linearft' },
    { keywords: ['window', 'stool', 'apron', 'trim', 'sets'], title: 'Window Stool & Apron Trim Sets', sku: '107065', price: 35.95, unit: 'set' },
    { keywords: ['pvc', 'composite', 'exterior', 'casing', 'boards'], title: 'PVC & Composite Exterior Casing Boards', sku: '107066', price: 18.95, unit: 'linearft' },
    { keywords: ['aluminum', 'cladding', 'trim', 'kits'], title: 'Aluminum Cladding Trim Kits', sku: '107067', price: 32.95, unit: 'linearft' },
    { keywords: ['flexible', 'moulding', 'radius', 'windows'], title: 'Flexible Moulding for Radius Windows', sku: '107068', price: 25.95, unit: 'linearft' },
    { keywords: ['foam', 'seal', 'gaskets', 'weatherstripping'], title: 'Foam Seal Gaskets & Weatherstripping', sku: '107069', price: 8.95, unit: 'linearft' },
    
    // Screens & Security Options
    { keywords: ['fiberglass', 'insect', 'screens'], title: 'Fiberglass Insect Screens', sku: '107070', price: 25.95, unit: 'each' },
    { keywords: ['aluminum', 'insect', 'screens'], title: 'Aluminum Insect Screens', sku: '107071', price: 28.95, unit: 'each' },
    { keywords: ['pet', 'resistant', 'screen', 'mesh'], title: 'Pet-Resistant Screen Mesh', sku: '107072', price: 35.95, unit: 'each' },
    { keywords: ['solar', 'shade', 'screens', 'uv', 'blocking'], title: 'Solar Shade Screens UV Blocking', sku: '107073', price: 42.95, unit: 'each' },
    { keywords: ['retractable', 'roll', 'up', 'screen', 'kits'], title: 'Retractable Roll-Up Screen Kits', sku: '107074', price: 125.95, unit: 'kit' },
    { keywords: ['security', 'window', 'bars', 'guards'], title: 'Security Window Bars & Guards', sku: '107075', price: 65.95, unit: 'each' },
    { keywords: ['window', 'limit', 'stops', 'vent', 'locks'], title: 'Window Limit Stops & Vent Locks', sku: '107076', price: 8.95, unit: 'each' },
    
    // Skylights & Sun Tunnels
    { keywords: ['fixed', 'skylights', 'velux', 'fs'], title: 'Fixed Skylights Velux FS Series', sku: '107077', price: 285.95, unit: 'each' },
    { keywords: ['manual', 'venting', 'skylights'], title: 'Manual Venting Skylights', sku: '107078', price: 425.95, unit: 'each' },
    { keywords: ['electric', 'solar', 'powered', 'skylights'], title: 'Electric/Solar-Powered Skylights', sku: '107079', price: 695.95, unit: 'each' },
    { keywords: ['deck', 'mount', 'curb', 'mount', 'skylights'], title: 'Deck-Mount & Curb-Mount Skylights', sku: '107080', price: 325.95, unit: 'each' },
    { keywords: ['tubular', 'skylights', '10', 'inch', '14'], title: 'Tubular Skylights 10" & 14"', sku: '107081', price: 185.95, unit: 'each' },
    { keywords: ['flashing', 'kits', 'asphalt', 'metal', 'tile'], title: 'Flashing Kits Asphalt/Metal/Tile', sku: '107082', price: 45.95, unit: 'kit' },
    { keywords: ['skylight', 'blinds', 'light', 'diffusers'], title: 'Skylight Blinds & Light Diffusers', sku: '107083', price: 85.95, unit: 'each' },
    
    // Commercial / Specialty Windows
    { keywords: ['storefront', 'aluminum', 'windows'], title: 'Storefront Aluminum Windows', sku: '107084', price: 485.95, unit: 'each' },
    { keywords: ['curtain', 'wall', 'systems'], title: 'Curtain Wall Systems', sku: '107085', price: 125.95, unit: 'sqft' },
    { keywords: ['fire', 'rated', 'wired', 'glass', 'windows'], title: 'Fire-Rated Wired-Glass Windows', sku: '107086', price: 285.95, unit: 'each' },
    { keywords: ['impact', 'rated', 'hurricane', 'windows'], title: 'Impact-Rated Hurricane Windows', sku: '107087', price: 425.95, unit: 'each' },
    { keywords: ['blast', 'resistant', 'ballistic', 'glazing'], title: 'Blast-Resistant & Ballistic Glazing', sku: '107088', price: 695.95, unit: 'each' },
    { keywords: ['acoustic', 'soundproof', 'commercial', 'windows'], title: 'Acoustic & Soundproof Commercial Windows', sku: '107089', price: 325.95, unit: 'each' },
    { keywords: ['louver', 'windows', 'mechanical', 'ventilation'], title: 'Louver Windows Mechanical Ventilation', sku: '107090', price: 185.95, unit: 'each' },
    
    // Window Brands
    { keywords: ['andersen', 'windows'], title: 'Andersen Windows', sku: '107091', price: 325.95, unit: 'each' },
    { keywords: ['jeld', 'wen', 'windows'], title: 'JELD-WEN Windows', sku: '107092', price: 285.95, unit: 'each' },
    { keywords: ['milgard', 'windows'], title: 'Milgard Windows', sku: '107093', price: 295.95, unit: 'each' },
    { keywords: ['american', 'craftsman', 'windows'], title: 'American Craftsman Windows', sku: '107094', price: 225.95, unit: 'each' },
    { keywords: ['ply', 'gem', 'windows'], title: 'Ply Gem Windows', sku: '107095', price: 245.95, unit: 'each' },
    { keywords: ['pella', 'windows'], title: 'Pella Windows', sku: '107096', price: 385.95, unit: 'each' },
    { keywords: ['velux', 'skylights'], title: 'Velux Skylights', sku: '107097', price: 425.95, unit: 'each' },
    { keywords: ['simonton', 'windows'], title: 'Simonton Windows', sku: '107098', price: 265.95, unit: 'each' },
    { keywords: ['relia', 'bilt', 'windows'], title: 'ReliaBilt Windows', sku: '107099', price: 195.95, unit: 'each' },
    { keywords: ['project', 'source', 'windows'], title: 'Project Source Windows', sku: '107100', price: 175.95, unit: 'each' },
    { keywords: ['masonite', 'windows'], title: 'Masonite Windows', sku: '107101', price: 255.95, unit: 'each' },
    { keywords: ['tafco', 'windows'], title: 'TAFCO Windows', sku: '107102', price: 225.95, unit: 'each' },
    { keywords: ['crystal', 'windows'], title: 'Crystal Windows', sku: '107103', price: 235.95, unit: 'each' },
    { keywords: ['mi', 'windows'], title: 'MI Windows', sku: '107104', price: 275.95, unit: 'each' },
    
    // Exterior Doors - Entry Door Types
    { keywords: ['prehung', 'entry', 'doors', 'jamb', 'sill'], title: 'Prehung Entry Doors with Jamb & Sill', sku: '108001', price: 485.95, unit: 'each' },
    { keywords: ['single', 'entry', 'doors', 'standard', '3x6'], title: 'Single Entry Doors Standard 3x6', sku: '108002', price: 385.95, unit: 'each' },
    { keywords: ['double', 'entry', 'doors', 'french', '5x6'], title: 'Double Entry Doors French 5x6', sku: '108003', price: 695.95, unit: 'each' },
    { keywords: ['front', 'doors', 'sidelites', 'left', 'right'], title: 'Front Doors with Sidelites Left/Right', sku: '108004', price: 595.95, unit: 'each' },
    { keywords: ['front', 'doors', 'transom', 'windows', 'rectangular'], title: 'Front Doors with Transom Windows Rectangular', sku: '108005', price: 525.95, unit: 'each' },
    { keywords: ['solid', 'panel', 'doors', 'flush', 'raised'], title: 'Solid Panel Doors Flush/Raised Panel', sku: '108006', price: 445.95, unit: 'each' },
    { keywords: ['half', 'lite', 'glass', 'doors', 'clear'], title: 'Half-Lite Glass Doors Clear', sku: '108007', price: 395.95, unit: 'each' },
    { keywords: ['three', 'quarter', 'lite', 'glass', 'doors'], title: 'Three-Quarter Lite Glass Doors', sku: '108008', price: 425.95, unit: 'each' },
    { keywords: ['full', 'lite', 'glass', 'doors', 'decorative'], title: 'Full-Lite Glass Doors Decorative', sku: '108009', price: 455.95, unit: 'each' },
    { keywords: ['craftsman', 'style', 'entry', 'doors', 'square'], title: 'Craftsman Style Entry Doors Square Lite', sku: '108010', price: 485.95, unit: 'each' },
    { keywords: ['modern', 'contemporary', 'entry', 'doors', 'flush'], title: 'Modern Contemporary Entry Doors Flush', sku: '108011', price: 525.95, unit: 'each' },
    { keywords: ['cottage', 'farmhouse', 'entry', 'doors', 'arched'], title: 'Cottage Farmhouse Entry Doors Arched', sku: '108012', price: 465.95, unit: 'each' },
    { keywords: ['dutch', 'doors', 'split', 'top', 'bottom'], title: 'Dutch Doors Split Top/Bottom', sku: '108013', price: 595.95, unit: 'each' },
    { keywords: ['pivot', 'entry', 'doors', 'luxury', 'modern'], title: 'Pivot Entry Doors Luxury Modern', sku: '108014', price: 795.95, unit: 'each' },
    { keywords: ['ada', 'compliant', 'entry', 'doors', 'threshold'], title: 'ADA-Compliant Entry Doors Low-Threshold', sku: '108015', price: 525.95, unit: 'each' },
    
    // Patio & Exterior Glass Doors
    { keywords: ['sliding', 'patio', 'doors', '2', 'panel'], title: 'Sliding Patio Doors 2-Panel', sku: '108016', price: 595.95, unit: 'each' },
    { keywords: ['sliding', 'patio', 'doors', '3', 'panel'], title: 'Sliding Patio Doors 3-Panel', sku: '108017', price: 695.95, unit: 'each' },
    { keywords: ['sliding', 'patio', 'doors', '4', 'panel'], title: 'Sliding Patio Doors 4-Panel', sku: '108018', price: 795.95, unit: 'each' },
    { keywords: ['french', 'patio', 'doors', 'inswing', 'outswing'], title: 'French Patio Doors Inswing/Outswing', sku: '108019', price: 625.95, unit: 'each' },
    { keywords: ['multi', 'slide', 'doors', 'large', 'openings'], title: 'Multi-Slide Doors Large Openings', sku: '108020', price: 895.95, unit: 'each' },
    { keywords: ['bi', 'fold', 'glass', 'doors', 'accordion'], title: 'Bi-Fold Glass Doors Accordion Style', sku: '108021', price: 725.95, unit: 'each' },
    { keywords: ['telescoping', 'pocket', 'patio', 'door', 'systems'], title: 'Telescoping & Pocket Patio Door Systems', sku: '108022', price: 995.95, unit: 'each' },
    { keywords: ['center', 'hinged', 'patio', 'doors', 'swing'], title: 'Center-Hinged Patio Doors Single Swing', sku: '108023', price: 555.95, unit: 'each' },
    { keywords: ['glass', 'wall', 'systems', 'aluminum', 'wood'], title: 'Glass Wall Systems Aluminum/Clad Wood', sku: '108024', price: 125.95, unit: 'sqft' },
    { keywords: ['impact', 'rated', 'patio', 'doors', 'hurricane'], title: 'Impact-Rated Patio Doors Hurricane', sku: '108025', price: 795.95, unit: 'each' },
    { keywords: ['patio', 'door', 'screens', 'sliding', 'retractable'], title: 'Patio Door Screens Sliding/Retractable', sku: '108026', price: 195.95, unit: 'each' },
    
    // Storm & Screen Doors
    { keywords: ['full', 'view', 'storm', 'doors', 'interchangeable'], title: 'Full-View Storm Doors Interchangeable', sku: '108027', price: 285.95, unit: 'each' },
    { keywords: ['mid', 'view', 'storm', 'doors', 'partial'], title: 'Mid-View Storm Doors Partial Glass', sku: '108028', price: 255.95, unit: 'each' },
    { keywords: ['high', 'view', 'storm', 'doors', 'solid'], title: 'High-View Storm Doors Solid Bottom', sku: '108029', price: 225.95, unit: 'each' },
    { keywords: ['retractable', 'screen', 'storm', 'doors'], title: 'Retractable Screen Storm Doors', sku: '108030', price: 325.95, unit: 'each' },
    { keywords: ['heavy', 'duty', 'aluminum', 'storm', 'doors'], title: 'Heavy-Duty Aluminum Storm Doors', sku: '108031', price: 295.95, unit: 'each' },
    { keywords: ['vinyl', 'clad', 'storm', 'doors'], title: 'Vinyl-Clad Storm Doors', sku: '108032', price: 265.95, unit: 'each' },
    { keywords: ['steel', 'security', 'storm', 'doors', 'bars'], title: 'Steel Security Storm Doors with Bars', sku: '108033', price: 385.95, unit: 'each' },
    { keywords: ['screen', 'doors', 'wood', 'vinyl', 'aluminum'], title: 'Screen Doors Wood/Vinyl/Aluminum', sku: '108034', price: 185.95, unit: 'each' },
    { keywords: ['pet', 'friendly', 'screen', 'doors', 'reinforced'], title: 'Pet-Friendly Screen Doors Reinforced', sku: '108035', price: 225.95, unit: 'each' },
    
    // Door Materials & Construction
    { keywords: ['fiberglass', 'doors', 'smooth', 'wood', 'grain'], title: 'Fiberglass Doors Smooth/Wood-Grain', sku: '108036', price: 425.95, unit: 'each' },
    { keywords: ['fiberglass', 'doors', 'paintable', 'stainable'], title: 'Fiberglass Doors Paintable/Stainable', sku: '108037', price: 445.95, unit: 'each' },
    { keywords: ['insulated', 'fiberglass', 'doors', 'foam', 'core'], title: 'Insulated Fiberglass Doors Foam Core', sku: '108038', price: 485.95, unit: 'each' },
    { keywords: ['impact', 'rated', 'fiberglass', 'doors', 'coastal'], title: 'Impact-Rated Fiberglass Doors Coastal', sku: '108039', price: 595.95, unit: 'each' },
    { keywords: ['steel', 'doors', 'galvanized', 'insulated'], title: 'Steel Doors Galvanized Insulated', sku: '108040', price: 395.95, unit: 'each' },
    { keywords: ['fire', 'rated', 'steel', 'doors', '20', '90'], title: 'Fire-Rated Steel Doors 20-90 Minute', sku: '108041', price: 695.95, unit: 'each' },
    { keywords: ['security', 'steel', 'doors', 'reinforced', 'multi'], title: 'Security Steel Doors Reinforced Multi-Point', sku: '108042', price: 525.95, unit: 'each' },
    { keywords: ['wood', 'doors', 'solid', 'mahogany', 'oak'], title: 'Wood Doors Solid Mahogany/Oak', sku: '108043', price: 695.95, unit: 'each' },
    { keywords: ['engineered', 'wood', 'doors', 'stiles', 'rails'], title: 'Engineered Wood Doors Stiles/Rails', sku: '108044', price: 525.95, unit: 'each' },
    { keywords: ['aluminum', 'clad', 'wood', 'doors', 'maintenance'], title: 'Aluminum-Clad Wood Doors Low-Maintenance', sku: '108045', price: 795.95, unit: 'each' },
    { keywords: ['vinyl', 'patio', 'doors', 'multi', 'chamber'], title: 'Vinyl Patio Doors Multi-Chamber', sku: '108046', price: 425.95, unit: 'each' },
    { keywords: ['aluminum', 'sliding', 'patio', 'doors', 'commercial'], title: 'Aluminum Sliding Patio Doors Commercial', sku: '108047', price: 695.95, unit: 'each' },
    { keywords: ['composite', 'doors', 'rot', 'resistant', 'pvc'], title: 'Composite Doors Rot-Resistant PVC Frame', sku: '108048', price: 485.95, unit: 'each' },
    
    // Exterior Door Hardware
    { keywords: ['entry', 'knobs', 'keyed', 'levers'], title: 'Entry Knobs & Keyed Levers', sku: '108049', price: 45.95, unit: 'each' },
    { keywords: ['deadbolts', 'single', 'cylinder', 'double'], title: 'Deadbolts Single/Double Cylinder', sku: '108050', price: 35.95, unit: 'each' },
    { keywords: ['handlesets', 'thumb', 'latch', 'deadbolt'], title: 'Handlesets Thumb-Latch & Deadbolt', sku: '108051', price: 85.95, unit: 'set' },
    { keywords: ['electronic', 'keypad', 'locks', 'kwikset', 'halo'], title: 'Electronic Keypad Locks Kwikset Halo', sku: '108052', price: 195.95, unit: 'each' },
    { keywords: ['smart', 'locks', 'bluetooth', 'wifi', 'zwave'], title: 'Smart Locks Bluetooth/WiFi/Z-Wave', sku: '108053', price: 225.95, unit: 'each' },
    { keywords: ['multi', 'point', 'locking', 'systems', 'steel'], title: 'Multi-Point Locking Systems Steel', sku: '108054', price: 125.95, unit: 'each' },
    { keywords: ['keyless', 'push', 'button', 'levers'], title: 'Keyless Push-Button Levers', sku: '108055', price: 95.95, unit: 'each' },
    { keywords: ['peepholes', 'door', 'viewers'], title: 'Peepholes & Door Viewers', sku: '108056', price: 15.95, unit: 'each' },
    { keywords: ['surface', 'bolts', 'flush', 'bolts', 'french'], title: 'Surface Bolts & Flush Bolts French Doors', sku: '108057', price: 25.95, unit: 'each' },
    { keywords: ['door', 'closers', 'hydraulic', 'pneumatic'], title: 'Door Closers Hydraulic/Pneumatic', sku: '108058', price: 85.95, unit: 'each' },
    { keywords: ['kick', 'plates', 'push', 'plates', 'guards'], title: 'Kick Plates, Push Plates & Guards', sku: '108059', price: 35.95, unit: 'each' },
    { keywords: ['weatherproof', 'thresholds', 'sweeps'], title: 'Weatherproof Thresholds & Sweeps', sku: '108060', price: 45.95, unit: 'each' },
    { keywords: ['door', 'gaskets', 'seals', 'foam', 'silicone'], title: 'Door Gaskets & Seals Foam/Silicone', sku: '108061', price: 18.95, unit: 'linearft' },
    { keywords: ['security', 'chains', 'latch', 'guards'], title: 'Security Chains & Latch Guards', sku: '108062', price: 25.95, unit: 'each' },
    { keywords: ['storm', 'door', 'handle', 'sets', 'closers'], title: 'Storm Door Handle Sets & Closers', sku: '108063', price: 35.95, unit: 'each' },
    
    // Door Frames, Thresholds & Weatherproofing
    { keywords: ['prehung', 'jamb', 'assemblies', 'wood', 'composite'], title: 'Prehung Jamb Assemblies Wood/Composite', sku: '108064', price: 85.95, unit: 'each' },
    { keywords: ['adjustable', 'thresholds', 'aluminum', 'composite', 'oak'], title: 'Adjustable Thresholds Aluminum/Composite/Oak', sku: '108065', price: 65.95, unit: 'each' },
    { keywords: ['brickmould', 'pvc', 'wood', 'composite'], title: 'Brickmould PVC/Wood/Composite', sku: '108066', price: 25.95, unit: 'linearft' },
    { keywords: ['sill', 'pans', 'pvc', 'metal', 'water'], title: 'Sill Pans PVC/Metal Water Management', sku: '108067', price: 35.95, unit: 'each' },
    { keywords: ['weatherstripping', 'kits', 'foam', 'magnetic', 'brush'], title: 'Weatherstripping Kits Foam/Magnetic/Brush', sku: '108068', price: 18.95, unit: 'kit' },
    { keywords: ['door', 'bottom', 'sweeps', 'u', 'shaped', 'adhesive'], title: 'Door Bottom Sweeps U-Shaped/Adhesive', sku: '108069', price: 12.95, unit: 'each' },
    { keywords: ['drip', 'caps', 'aluminum', 'flashing'], title: 'Drip Caps Aluminum Flashing', sku: '108070', price: 15.95, unit: 'linearft' },
    { keywords: ['foam', 'seal', 'tape', 'insulation', 'strips'], title: 'Foam Seal Tape & Insulation Strips', sku: '108071', price: 8.95, unit: 'roll' },
    { keywords: ['shims', 'screws', 'door', 'installation'], title: 'Shims & Screws for Door Installation', sku: '108072', price: 12.95, unit: 'pack' },
    { keywords: ['expanding', 'low', 'pressure', 'foam', 'door'], title: 'Expanding Low-Pressure Foam Door-Safe', sku: '108073', price: 8.95, unit: 'can' },
    { keywords: ['liquid', 'flashing', 'sill', 'tape', 'zip'], title: 'Liquid Flashing & Sill Tape Zip/Tyvek', sku: '108074', price: 22.95, unit: 'tube' },
    
    // Installation Accessories & Kits
    { keywords: ['door', 'installation', 'kits', 'hinges', 'screws'], title: 'Door Installation Kits Hinges/Screws', sku: '108075', price: 45.95, unit: 'kit' },
    { keywords: ['composite', 'door', 'frame', 'kits', 'rot'], title: 'Composite Door Frame Kits Rot-Proof', sku: '108076', price: 125.95, unit: 'kit' },
    { keywords: ['door', 'jamb', 'reinforcement', 'kits', 'security'], title: 'Door Jamb Reinforcement Kits Security', sku: '108077', price: 35.95, unit: 'kit' },
    { keywords: ['threshold', 'extensions', 'transition', 'plates'], title: 'Threshold Extensions & Transition Plates', sku: '108078', price: 25.95, unit: 'each' },
    { keywords: ['foam', 'insulation', 'sealant', 'window', 'door'], title: 'Foam Insulation Sealant Window/Door', sku: '108079', price: 8.95, unit: 'can' },
    { keywords: ['door', 'alignment', 'tools', 'jigs'], title: 'Door Alignment Tools & Jigs', sku: '108080', price: 35.95, unit: 'each' },
    { keywords: ['anchor', 'screws', 'lag', 'bolts'], title: 'Anchor Screws & Lag Bolts', sku: '108081', price: 15.95, unit: 'pack' },
    { keywords: ['mounting', 'clips', 'patio', 'doors'], title: 'Mounting Clips for Patio Doors', sku: '108082', price: 8.95, unit: 'pack' },
    
    // Finishes & Design Options
    { keywords: ['primed', 'white', 'ready', 'paint', 'finish'], title: 'Primed White Ready-to-Paint Finish', sku: '108083', price: 0.00, unit: 'finish' },
    { keywords: ['pre', 'finished', 'stained', 'wood', 'tone'], title: 'Pre-Finished Stained Wood Tone', sku: '108084', price: 0.00, unit: 'finish' },
    { keywords: ['textured', 'fiberglass', 'oak', 'grain', 'fir'], title: 'Textured Fiberglass Oak/Fir Grain', sku: '108085', price: 0.00, unit: 'finish' },
    { keywords: ['contemporary', 'flush', 'designs', 'black', 'white'], title: 'Contemporary Flush Designs Black/White', sku: '108086', price: 0.00, unit: 'finish' },
    { keywords: ['decorative', 'glass', 'inserts', 'beveled', 'frosted'], title: 'Decorative Glass Inserts Beveled/Frosted', sku: '108087', price: 45.95, unit: 'each' },
    { keywords: ['clear', 'low', 'e', 'privacy', 'glass'], title: 'Clear/Low-E/Privacy Glass Options', sku: '108088', price: 25.95, unit: 'sqft' },
    { keywords: ['integral', 'blinds', 'between', 'glass', 'panes'], title: 'Integral Blinds Between Glass Panes', sku: '108089', price: 85.95, unit: 'each' },
    { keywords: ['stained', 'etched', 'glass', 'options'], title: 'Stained or Etched Glass Options', sku: '108090', price: 65.95, unit: 'sqft' },
    
    // Exterior Door Brands
    { keywords: ['jeld', 'wen', 'doors'], title: 'JELD-WEN Doors', sku: '108091', price: 485.95, unit: 'each' },
    { keywords: ['masonite', 'doors'], title: 'Masonite Doors', sku: '108092', price: 425.95, unit: 'each' },
    { keywords: ['therma', 'tru', 'doors'], title: 'Therma-Tru Doors', sku: '108093', price: 525.95, unit: 'each' },
    { keywords: ['steves', 'sons', 'doors'], title: 'Steves & Sons Doors', sku: '108094', price: 495.95, unit: 'each' },
    { keywords: ['feather', 'river', 'doors'], title: 'Feather River Doors', sku: '108095', price: 445.95, unit: 'each' },
    { keywords: ['pella', 'doors'], title: 'Pella Doors', sku: '108096', price: 695.95, unit: 'each' },
    { keywords: ['andersen', 'doors'], title: 'Andersen Doors', sku: '108097', price: 625.95, unit: 'each' },
    { keywords: ['stanley', 'doors'], title: 'Stanley Doors', sku: '108098', price: 385.95, unit: 'each' },
    { keywords: ['emco', 'storm', 'doors'], title: 'EMCO Storm Doors', sku: '108099', price: 285.95, unit: 'each' },
    { keywords: ['relia', 'bilt', 'doors'], title: 'ReliaBilt Doors', sku: '108100', price: 395.95, unit: 'each' },
    { keywords: ['larson', 'doors'], title: 'LARSON Doors', sku: '108101', price: 325.95, unit: 'each' },
    { keywords: ['lif', 'industries', 'commercial', 'steel'], title: 'L.I.F Industries Commercial Steel', sku: '108102', price: 795.95, unit: 'each' },
    
    // Jobsite Essentials & Safety - Hand Tools
    { keywords: ['tape', 'measures', '16', '25', '30', '35'], title: 'Tape Measures 16/25/30/35 Foot', sku: '109001', price: 25.95, unit: 'each' },
    { keywords: ['chalk', 'lines', 'chalk', 'refills'], title: 'Chalk Lines & Chalk Refills', sku: '109002', price: 15.95, unit: 'each' },
    { keywords: ['levels', 'torpedo', '24', '48', 'digital', 'laser'], title: 'Levels Torpedo/24/48/Digital/Laser', sku: '109003', price: 45.95, unit: 'each' },
    { keywords: ['squares', 'speed', 'framing', 'combination', 'try'], title: 'Squares Speed/Framing/Combination/Try', sku: '109004', price: 35.95, unit: 'each' },
    { keywords: ['utility', 'knives', 'blades'], title: 'Utility Knives & Blades', sku: '109005', price: 12.95, unit: 'each' },
    { keywords: ['hammers', 'claw', 'framing', 'sledge', 'rubber'], title: 'Hammers Claw/Framing/Sledge/Rubber', sku: '109006', price: 28.95, unit: 'each' },
    { keywords: ['pry', 'bars', 'nail', 'pullers'], title: 'Pry Bars & Nail Pullers', sku: '109007', price: 22.95, unit: 'each' },
    { keywords: ['screwdrivers', 'flat', 'phillips', 'multi', 'bit'], title: 'Screwdrivers Flat/Phillips/Multi-Bit', sku: '109008', price: 18.95, unit: 'set' },
    { keywords: ['pliers', 'slip', 'joint', 'tongue', 'groove', 'needle'], title: 'Pliers Slip-Joint/Tongue-Groove/Needle', sku: '109009', price: 25.95, unit: 'each' },
    { keywords: ['wrenches', 'adjustable', 'box', 'ratcheting'], title: 'Wrenches Adjustable/Box/Ratcheting', sku: '109010', price: 35.95, unit: 'set' },
    { keywords: ['socket', 'ratchet', 'sets', 'sae', 'metric'], title: 'Socket & Ratchet Sets SAE/Metric', sku: '109011', price: 65.95, unit: 'set' },
    { keywords: ['hex', 'key', 'allen', 'key', 'sets'], title: 'Hex Key / Allen Key Sets', sku: '109012', price: 15.95, unit: 'set' },
    { keywords: ['handsaws', 'crosscut', 'backsaw', 'keyhole', 'coping'], title: 'Handsaws Crosscut/Backsaw/Keyhole/Coping', sku: '109013', price: 28.95, unit: 'each' },
    { keywords: ['snips', 'shears', 'tin', 'aviation', 'pvc'], title: 'Snips & Shears Tin/Aviation/PVC', sku: '109014', price: 22.95, unit: 'each' },
    { keywords: ['files', 'rasps'], title: 'Files & Rasps', sku: '109015', price: 18.95, unit: 'each' },
    { keywords: ['clamps', 'c', 'clamps', 'bar', 'clamps', 'spring'], title: 'Clamps C-Clamps/Bar Clamps/Spring', sku: '109016', price: 25.95, unit: 'each' },
    { keywords: ['tool', 'belts', 'pouches', 'nail', 'bags'], title: 'Tool Belts, Pouches & Nail Bags', sku: '109017', price: 35.95, unit: 'each' },
    
    // Power Tools
    { keywords: ['cordless', 'drills', 'impact', 'drivers'], title: 'Cordless Drills & Impact Drivers', sku: '109018', price: 125.95, unit: 'each' },
    { keywords: ['circular', 'saws', '6.5', '7.25'], title: 'Circular Saws 6.5/7.25 Inch', sku: '109019', price: 85.95, unit: 'each' },
    { keywords: ['miter', 'saws', 'sliding', 'compound'], title: 'Miter Saws & Sliding Compound', sku: '109020', price: 195.95, unit: 'each' },
    { keywords: ['reciprocating', 'saws', 'sawzall'], title: 'Reciprocating Saws (Sawzall)', sku: '109021', price: 95.95, unit: 'each' },
    { keywords: ['table', 'saws', 'portable', 'jobsite'], title: 'Table Saws & Portable Jobsite', sku: '109022', price: 295.95, unit: 'each' },
    { keywords: ['jig', 'saws', 'oscillating', 'multi', 'tools'], title: 'Jig Saws & Oscillating Multi-Tools', sku: '109023', price: 75.95, unit: 'each' },
    { keywords: ['angle', 'grinders', 'cut', 'off', 'tools'], title: 'Angle Grinders & Cut-Off Tools', sku: '109024', price: 65.95, unit: 'each' },
    { keywords: ['rotary', 'hammers', 'demolition', 'hammers'], title: 'Rotary Hammers & Demolition', sku: '109025', price: 185.95, unit: 'each' },
    { keywords: ['nail', 'guns', 'framing', 'finish', 'brad'], title: 'Nail Guns Framing/Finish/Brad', sku: '109026', price: 155.95, unit: 'each' },
    { keywords: ['staplers', 'crown', 'staplers'], title: 'Staplers & Crown Staplers', sku: '109027', price: 85.95, unit: 'each' },
    { keywords: ['sanders', 'orbital', 'belt', 'detail'], title: 'Sanders Orbital/Belt/Detail', sku: '109028', price: 95.95, unit: 'each' },
    { keywords: ['heat', 'guns'], title: 'Heat Guns', sku: '109029', price: 45.95, unit: 'each' },
    { keywords: ['planers', 'routers'], title: 'Planers & Routers', sku: '109030', price: 125.95, unit: 'each' },
    { keywords: ['cordless', 'lighting', 'tower', 'area', 'headlamps'], title: 'Cordless Lighting Tower/Area/Headlamps', sku: '109031', price: 65.95, unit: 'each' },
    { keywords: ['jobsite', 'radios', 'chargers'], title: 'Jobsite Radios & Chargers', sku: '109032', price: 85.95, unit: 'each' },
    { keywords: ['extension', 'cords', 'power', 'strips'], title: 'Extension Cords & Power Strips', sku: '109033', price: 35.95, unit: 'each' },
    { keywords: ['tool', 'batteries', 'chargers', '12v', '18v', '20v'], title: 'Tool Batteries & Chargers 12V/18V/20V MAX', sku: '109034', price: 95.95, unit: 'each' },
    
    // Fasteners
    { keywords: ['nails', 'common', 'framing', 'finish', 'roofing'], title: 'Nails Common/Framing/Finish/Roofing', sku: '109035', price: 8.95, unit: 'lb' },
    { keywords: ['screws', 'wood', 'drywall', 'sheet', 'metal'], title: 'Screws Wood/Drywall/Sheet Metal', sku: '109036', price: 12.95, unit: 'lb' },
    { keywords: ['lag', 'bolts', 'carriage', 'bolts'], title: 'Lag Bolts & Carriage Bolts', sku: '109037', price: 15.95, unit: 'lb' },
    { keywords: ['washers', 'nuts', 'sae', 'metric'], title: 'Washers & Nuts SAE/Metric', sku: '109038', price: 8.95, unit: 'pack' },
    { keywords: ['tapcon', 'concrete', 'anchors'], title: 'Tapcon Concrete Anchors', sku: '109039', price: 18.95, unit: 'pack' },
    { keywords: ['expansion', 'anchors', 'sleeve', 'anchors'], title: 'Expansion Anchors & Sleeve Anchors', sku: '109040', price: 12.95, unit: 'pack' },
    { keywords: ['toggle', 'bolts', 'molly', 'bolts'], title: 'Toggle Bolts & Molly Bolts', sku: '109041', price: 10.95, unit: 'pack' },
    { keywords: ['self', 'tapping', 'screws'], title: 'Self-Tapping Screws', sku: '109042', price: 14.95, unit: 'pack' },
    { keywords: ['collated', 'nails', 'screws', 'nailers'], title: 'Collated Nails & Screws for Nailers', sku: '109043', price: 25.95, unit: 'pack' },
    { keywords: ['joist', 'hanger', 'nails', 'structural', 'screws'], title: 'Joist Hanger Nails & Structural Screws', sku: '109044', price: 22.95, unit: 'pack' },
    { keywords: ['rebar', 'tie', 'wire', 'clips'], title: 'Rebar Tie Wire & Clips', sku: '109045', price: 15.95, unit: 'roll' },
    { keywords: ['rivets', 'riveters'], title: 'Rivets & Riveters', sku: '109046', price: 18.95, unit: 'each' },
    { keywords: ['wire', 'staples', 'fence', 'staples'], title: 'Wire Staples & Fence Staples', sku: '109047', price: 12.95, unit: 'lb' },
    
    // Adhesives, Caulks & Sealants
    { keywords: ['construction', 'adhesive', 'loctite', 'liquid', 'nails'], title: 'Construction Adhesive Loctite PL/Liquid Nails', sku: '109048', price: 8.95, unit: 'tube' },
    { keywords: ['wood', 'glue', 'polyurethane', 'glue'], title: 'Wood Glue & Polyurethane Glue', sku: '109049', price: 12.95, unit: 'bottle' },
    { keywords: ['epoxy', 'kits', '2', 'part', 'structural'], title: 'Epoxy Kits 2-Part Structural', sku: '109050', price: 18.95, unit: 'kit' },
    { keywords: ['silicone', 'sealants', 'interior', 'exterior'], title: 'Silicone Sealants Interior/Exterior', sku: '109051', price: 6.95, unit: 'tube' },
    { keywords: ['polyurethane', 'sealants', 'concrete', 'roof'], title: 'Polyurethane Sealants Concrete & Roof', sku: '109052', price: 12.95, unit: 'tube' },
    { keywords: ['fire', 'rated', 'sealants', 'caulks'], title: 'Fire-Rated Sealants & Caulks', sku: '109053', price: 15.95, unit: 'tube' },
    { keywords: ['spray', 'foam', 'insulation', 'expanding'], title: 'Spray Foam Insulation Expanding', sku: '109054', price: 22.95, unit: 'can' },
    { keywords: ['contact', 'cement', 'aerosol', 'brush'], title: 'Contact Cement Aerosol & Brush-On', sku: '109055', price: 14.95, unit: 'can' },
    { keywords: ['specialty', 'adhesives', 'vct', 'floor', 'panel'], title: 'Specialty Adhesives VCT Floor/Panel', sku: '109056', price: 18.95, unit: 'gallon' },
    
    // Personal Protective Equipment (PPE)
    { keywords: ['hard', 'hats', 'class', 'e', 'c', 'g'], title: 'Hard Hats Class E/C/G', sku: '109057', price: 15.95, unit: 'each' },
    { keywords: ['safety', 'glasses', 'clear', 'tinted', 'anti', 'fog'], title: 'Safety Glasses Clear/Tinted/Anti-Fog', sku: '109058', price: 8.95, unit: 'each' },
    { keywords: ['face', 'shields', 'goggles'], title: 'Face Shields & Goggles', sku: '109059', price: 12.95, unit: 'each' },
    { keywords: ['ear', 'protection', 'earplugs', 'earmuffs'], title: 'Ear Protection Earplugs/Earmuffs', sku: '109060', price: 18.95, unit: 'each' },
    { keywords: ['respirators', 'n95', 'half', 'mask', 'full', 'face'], title: 'Respirators N95/Half-Mask/Full-Face', sku: '109061', price: 35.95, unit: 'each' },
    { keywords: ['dust', 'masks', 'disposable', 'masks'], title: 'Dust Masks & Disposable Masks', sku: '109062', price: 8.95, unit: 'pack' },
    { keywords: ['high', 'visibility', 'vests', 'class', '2', '3'], title: 'High-Visibility Vests Class 2/3', sku: '109063', price: 12.95, unit: 'each' },
    { keywords: ['gloves', 'work', 'cut', 'resistant', 'chemical'], title: 'Gloves Work/Cut-Resistant/Chemical', sku: '109064', price: 8.95, unit: 'pair' },
    { keywords: ['steel', 'toe', 'boots', 'toe', 'caps'], title: 'Steel-Toe Boots & Toe Caps', sku: '109065', price: 85.95, unit: 'pair' },
    { keywords: ['knee', 'pads', 'support', 'braces'], title: 'Knee Pads & Support Braces', sku: '109066', price: 25.95, unit: 'each' },
    { keywords: ['fall', 'protection', 'harnesses', 'lanyards'], title: 'Fall-Protection Harnesses & Lanyards', sku: '109067', price: 125.95, unit: 'each' },
    { keywords: ['first', 'aid', 'kits', 'osha', 'compliant'], title: 'First-Aid Kits OSHA Compliant', sku: '109068', price: 45.95, unit: 'kit' },
    { keywords: ['fire', 'extinguishers', 'a', 'b', 'c', 'rated'], title: 'Fire Extinguishers A B C Rated', sku: '109069', price: 35.95, unit: 'each' },
    
    // Ladders & Scaffolding
    { keywords: ['step', 'ladders', '4', '6', '8', '10', '12'], title: 'Step Ladders 4/6/8/10/12 Foot', sku: '109070', price: 45.95, unit: 'each' },
    { keywords: ['extension', 'ladders', '16', '40'], title: 'Extension Ladders 16-40 Foot', sku: '109071', price: 125.95, unit: 'each' },
    { keywords: ['multi', 'position', 'articulating', 'ladders'], title: 'Multi-Position Articulating Ladders', sku: '109072', price: 195.95, unit: 'each' },
    { keywords: ['telescoping', 'ladders'], title: 'Telescoping Ladders', sku: '109073', price: 165.95, unit: 'each' },
    { keywords: ['platform', 'ladders', 'work', 'platforms'], title: 'Platform Ladders & Work Platforms', sku: '109074', price: 85.95, unit: 'each' },
    { keywords: ['attic', 'ladders', 'wood', 'aluminum'], title: 'Attic Ladders Wood/Aluminum', sku: '109075', price: 125.95, unit: 'each' },
    { keywords: ['scaffold', 'frames', 'planks', 'casters'], title: 'Scaffold Frames, Planks & Casters', sku: '109076', price: 185.95, unit: 'each' },
    { keywords: ['baker', 'scaffolds', 'rolling', 'platforms'], title: 'Baker Scaffolds & Rolling Platforms', sku: '109077', price: 225.95, unit: 'each' },
    { keywords: ['ladder', 'levelers', 'stabilizers'], title: 'Ladder Levelers & Stabilizers', sku: '109078', price: 35.95, unit: 'each' },
    { keywords: ['ladder', 'jacks', 'planks'], title: 'Ladder Jacks & Planks', sku: '109079', price: 45.95, unit: 'each' },
    
    // Jobsite Lighting & Power
    { keywords: ['led', 'work', 'lights', 'plug', 'rechargeable'], title: 'LED Work Lights Plug-In/Rechargeable', sku: '109080', price: 35.95, unit: 'each' },
    { keywords: ['floodlights', 'tripod', 'lighting'], title: 'Floodlights & Tripod Lighting', sku: '109081', price: 55.95, unit: 'each' },
    { keywords: ['string', 'lights', 'temporary', 'jobsite'], title: 'String Lights Temporary Jobsite', sku: '109082', price: 25.95, unit: 'each' },
    { keywords: ['extension', 'cords', '12', '3', 'awg', 'outdoor'], title: 'Extension Cords 12/3 AWG Outdoor Rated', sku: '109083', price: 45.95, unit: 'each' },
    { keywords: ['surge', 'protectors', 'power', 'strips'], title: 'Surge Protectors & Power Strips', sku: '109084', price: 25.95, unit: 'each' },
    { keywords: ['portable', 'generators', '2000', '9000', 'w'], title: 'Portable Generators 2000-9000W', sku: '109085', price: 695.95, unit: 'each' },
    { keywords: ['inverter', 'generators', 'quiet', 'operation'], title: 'Inverter Generators Quiet Operation', sku: '109086', price: 825.95, unit: 'each' },
    { keywords: ['jobsite', 'battery', 'packs', 'power', 'banks'], title: 'Jobsite Battery Packs & Power Banks', sku: '109087', price: 95.95, unit: 'each' },
    
    // Cleanup & Protection
    { keywords: ['heavy', 'duty', 'contractor', 'trash', 'bags'], title: 'Heavy-Duty Contractor Trash Bags', sku: '109088', price: 18.95, unit: 'roll' },
    { keywords: ['shop', 'vacuums', 'wet', 'dry'], title: 'Shop Vacuums Wet/Dry', sku: '109089', price: 125.95, unit: 'each' },
    { keywords: ['push', 'brooms', 'dust', 'pans', 'mops'], title: 'Push Brooms, Dust Pans & Mops', sku: '109090', price: 25.95, unit: 'each' },
    { keywords: ['drop', 'cloths', 'canvas', 'plastic', 'paper'], title: 'Drop Cloths Canvas/Plastic/Paper', sku: '109091', price: 15.95, unit: 'each' },
    { keywords: ['ram', 'board', 'floor', 'protection', 'rolls'], title: 'Ram Board & Floor Protection Rolls', sku: '109092', price: 45.95, unit: 'roll' },
    { keywords: ['plastic', 'sheeting', '3', 'mil', '10', 'mil'], title: 'Plastic Sheeting 3 Mil-10 Mil', sku: '109093', price: 25.95, unit: 'roll' },
    { keywords: ['painters', 'tape', 'masking', 'film'], title: 'Painter\'s Tape & Masking Film', sku: '109094', price: 8.95, unit: 'roll' },
    { keywords: ['hand', 'cleaners', 'wipes'], title: 'Hand Cleaners & Wipes', sku: '109095', price: 12.95, unit: 'pack' },
    { keywords: ['degreasers', 'solvents'], title: 'Degreasers & Solvents', sku: '109096', price: 15.95, unit: 'gallon' },
    
    // Temporary Protection & Site Setup
    { keywords: ['caution', 'tape', 'safety', 'barriers'], title: 'Caution Tape & Safety Barriers', sku: '109097', price: 8.95, unit: 'roll' },
    { keywords: ['temporary', 'fencing', 'panels', 'posts'], title: 'Temporary Fencing Panels & Posts', sku: '109098', price: 35.95, unit: 'each' },
    { keywords: ['reusable', 'barrier', 'netting', 'orange', 'mesh'], title: 'Reusable Barrier Netting & Orange Mesh', sku: '109099', price: 25.95, unit: 'roll' },
    { keywords: ['traffic', 'cones', 'safety', 'barrels'], title: 'Traffic Cones & Safety Barrels', sku: '109100', price: 15.95, unit: 'each' },
    { keywords: ['jobsite', 'signs', 'no', 'trespassing', 'hard', 'hat'], title: 'Jobsite Signs No Trespassing/Hard Hat Area', sku: '109101', price: 12.95, unit: 'each' },
    { keywords: ['construction', 'site', 'lighting', 'battery', 'beacons'], title: 'Construction Site Lighting & Battery Beacons', sku: '109102', price: 45.95, unit: 'each' },
    { keywords: ['storage', 'containers', 'tool', 'lock', 'boxes'], title: 'Storage Containers & Tool Lock Boxes', sku: '109103', price: 125.95, unit: 'each' },
    { keywords: ['tarps', 'tie', 'downs', 'ratchet', 'straps'], title: 'Tarps & Tie-Downs Ratchet Straps', sku: '109104', price: 18.95, unit: 'each' },
    { keywords: ['fire', 'resistant', 'blankets', 'welding', 'zones'], title: 'Fire-Resistant Blankets Welding Zones', sku: '109105', price: 35.95, unit: 'each' },
    
    // Tool Storage & Organization
    { keywords: ['tool', 'boxes', 'plastic', 'metal', 'rolling'], title: 'Tool Boxes Plastic/Metal/Rolling', sku: '109106', price: 65.95, unit: 'each' },
    { keywords: ['tool', 'bags', 'backpacks'], title: 'Tool Bags & Backpacks', sku: '109107', price: 45.95, unit: 'each' },
    { keywords: ['modular', 'tool', 'storage', 'packout', 'tstak'], title: 'Modular Tool Storage PACKOUT/TSTAK', sku: '109108', price: 95.95, unit: 'each' },
    { keywords: ['jobsite', 'chests', 'gang', 'boxes'], title: 'Jobsite Chests & Gang Boxes', sku: '109109', price: 295.95, unit: 'each' },
    { keywords: ['small', 'parts', 'organizers', 'bins'], title: 'Small Parts Organizers & Bins', sku: '109110', price: 25.95, unit: 'each' },
    { keywords: ['pegboards', 'hook', 'systems'], title: 'Pegboards & Hook Systems', sku: '109111', price: 35.95, unit: 'each' },
    { keywords: ['truck', 'bed', 'toolboxes', 'crossover', 'side'], title: 'Truck Bed Toolboxes Crossover/Side Mount', sku: '109112', price: 195.95, unit: 'each' },
    { keywords: ['shelving', 'racks', 'work', 'benches'], title: 'Shelving Racks & Work Benches', sku: '109113', price: 125.95, unit: 'each' },
    
    // Consumables & Miscellaneous
    { keywords: ['saw', 'blades', 'wood', 'metal', 'masonry'], title: 'Saw Blades Wood/Metal/Masonry', sku: '109114', price: 25.95, unit: 'each' },
    { keywords: ['drill', 'bits', 'twist', 'spade', 'masonry'], title: 'Drill Bits Twist/Spade/Masonry', sku: '109115', price: 15.95, unit: 'set' },
    { keywords: ['grinding', 'cutting', 'discs'], title: 'Grinding & Cutting Discs', sku: '109116', price: 8.95, unit: 'pack' },
    { keywords: ['sandpaper', 'sanding', 'belts'], title: 'Sandpaper & Sanding Belts', sku: '109117', price: 12.95, unit: 'pack' },
    { keywords: ['wire', 'wheels', 'brushes'], title: 'Wire Wheels & Brushes', sku: '109118', price: 8.95, unit: 'each' },
    { keywords: ['spray', 'lubricants', 'wd', '40', 'silicone'], title: 'Spray Lubricants WD-40/Silicone', sku: '109119', price: 8.95, unit: 'can' },
    { keywords: ['marking', 'paint', 'survey', 'flags'], title: 'Marking Paint & Survey Flags', sku: '109120', price: 12.95, unit: 'each' },
    { keywords: ['measuring', 'wheels', 'laser', 'distance'], title: 'Measuring Wheels & Laser Distance', sku: '109121', price: 45.95, unit: 'each' },
    { keywords: ['batteries', 'chargers', 'aa', 'd', '9v'], title: 'Batteries & Chargers AA-D/9V', sku: '109122', price: 18.95, unit: 'pack' },
    { keywords: ['extension', 'poles', 'handles'], title: 'Extension Poles & Handles', sku: '109123', price: 25.95, unit: 'each' },
    { keywords: ['hand', 'cleaner', 'soap', 'dispensers', 'paper'], title: 'Hand Cleaner, Soap Dispensers & Paper', sku: '109124', price: 15.95, unit: 'each' },
    
    // Jobsite Essentials & Safety Brands
    { keywords: ['dewalt', 'tools'], title: 'DeWalt Tools', sku: '109125', price: 125.95, unit: 'each' },
    { keywords: ['milwaukee', 'tools'], title: 'Milwaukee Tools', sku: '109126', price: 135.95, unit: 'each' },
    { keywords: ['makita', 'tools'], title: 'Makita Tools', sku: '109127', price: 115.95, unit: 'each' },
    { keywords: ['ridgid', 'tools'], title: 'RIDGID Tools', sku: '109128', price: 105.95, unit: 'each' },
    { keywords: ['bosch', 'tools'], title: 'Bosch Tools', sku: '109129', price: 125.95, unit: 'each' },
    { keywords: ['hilti', 'tools'], title: 'Hilti Tools', sku: '109130', price: 195.95, unit: 'each' },
    { keywords: ['husky', 'tools'], title: 'Husky Tools', sku: '109131', price: 75.95, unit: 'each' },
    { keywords: ['crescent', 'tools'], title: 'Crescent Tools', sku: '109132', price: 35.95, unit: 'each' },
    { keywords: ['klein', 'tools'], title: 'Klein Tools', sku: '109133', price: 45.95, unit: 'each' },
    { keywords: ['irwin', 'tools'], title: 'Irwin Tools', sku: '109134', price: 25.95, unit: 'each' },
    { keywords: ['stanley', 'tools'], title: 'Stanley Tools', sku: '109135', price: 35.95, unit: 'each' },
    { keywords: ['diablo', 'blades'], title: 'Diablo Blades', sku: '109136', price: 25.95, unit: 'each' },
    { keywords: ['3m', 'products'], title: '3M Products', sku: '109137', price: 15.95, unit: 'each' },
    { keywords: ['loctite', 'adhesives'], title: 'Loctite Adhesives', sku: '109138', price: 12.95, unit: 'each' },
    { keywords: ['liquid', 'nails', 'adhesive'], title: 'Liquid Nails Adhesive', sku: '109139', price: 8.95, unit: 'tube' },
    { keywords: ['ram', 'board', 'protection'], title: 'Ram Board Protection', sku: '109140', price: 45.95, unit: 'roll' },
    { keywords: ['werner', 'ladders'], title: 'Werner Ladders', sku: '109141', price: 125.95, unit: 'each' },
    { keywords: ['gorilla', 'products'], title: 'Gorilla Products', sku: '109142', price: 18.95, unit: 'each' },
    { keywords: ['oatey', 'plumbing'], title: 'Oatey Plumbing', sku: '109143', price: 12.95, unit: 'each' },
    { keywords: ['honeywell', 'safety'], title: 'Honeywell Safety', sku: '109144', price: 25.95, unit: 'each' },
    { keywords: ['carhartt', 'workwear'], title: 'Carhartt Workwear', sku: '109145', price: 65.95, unit: 'each' },
    { keywords: ['toughbuilt', 'tools'], title: 'ToughBuilt Tools', sku: '109146', price: 35.95, unit: 'each' },
    
    // Nails & Anchors - Framing & Construction Nails
    { keywords: ['common', 'nails', 'smooth', 'shank', 'full', 'head'], title: 'Common Nails Smooth Shank Full Head', sku: '110001', price: 8.95, unit: 'lb' },
    { keywords: ['framing', 'nails', 'ring', 'shank', 'spiral', 'shank'], title: 'Framing Nails Ring Shank/Spiral Shank', sku: '110002', price: 12.95, unit: 'lb' },
    { keywords: ['sinkers', 'cement', 'coated', 'smaller', 'head'], title: 'Sinkers Cement-Coated Smaller Head', sku: '110003', price: 10.95, unit: 'lb' },
    { keywords: ['duplex', 'nails', 'double', 'head', 'temporary'], title: 'Duplex Nails Double Head Temporary', sku: '110004', price: 15.95, unit: 'lb' },
    { keywords: ['ardox', 'spiral', 'nails', 'twisted', 'shank'], title: 'Ardox/Spiral Nails Twisted Shank', sku: '110005', price: 14.95, unit: 'lb' },
    { keywords: ['hot', 'dipped', 'galvanized', 'framing', 'nails'], title: 'Hot-Dipped Galvanized Framing Nails', sku: '110006', price: 16.95, unit: 'lb' },
    { keywords: ['stainless', 'steel', 'framing', 'nails', 'coastal'], title: 'Stainless Steel Framing Nails Coastal', sku: '110007', price: 28.95, unit: 'lb' },
    { keywords: ['collated', 'framing', 'nails', 'plastic', 'strip'], title: 'Collated Framing Nails Plastic Strip', sku: '110008', price: 18.95, unit: 'box' },
    { keywords: ['wire', 'coil', 'framing', 'nails'], title: 'Wire Coil Framing Nails', sku: '110009', price: 19.95, unit: 'box' },
    { keywords: ['paper', 'tape', 'framing', 'nails'], title: 'Paper Tape Framing Nails', sku: '110010', price: 17.95, unit: 'box' },
    
    // Finish, Brad & Trim Nails
    { keywords: ['finish', 'nails', '15', 'gauge', '16', 'gauge'], title: 'Finish Nails 15-Gauge/16-Gauge', sku: '110011', price: 12.95, unit: 'lb' },
    { keywords: ['brad', 'nails', '18', 'gauge'], title: 'Brad Nails 18-Gauge', sku: '110012', price: 10.95, unit: 'lb' },
    { keywords: ['pin', 'nails', '23', 'gauge', 'headless'], title: 'Pin Nails 23-Gauge Headless', sku: '110013', price: 8.95, unit: 'lb' },
    { keywords: ['casing', 'nails', 'small', 'head', 'smooth'], title: 'Casing Nails Small Head Smooth', sku: '110014', price: 11.95, unit: 'lb' },
    { keywords: ['decorative', 'finish', 'nails', 'brass', 'bronze'], title: 'Decorative Finish Nails Brass/Bronze', sku: '110015', price: 18.95, unit: 'lb' },
    { keywords: ['collated', 'angled', 'finish', 'nails', '15', 'gauge'], title: 'Collated Angled Finish Nails 15-Gauge', sku: '110016', price: 22.95, unit: 'box' },
    { keywords: ['straight', 'finish', 'nails', '16', 'gauge'], title: 'Straight Finish Nails 16-Gauge', sku: '110017', price: 20.95, unit: 'box' },
    { keywords: ['micro', 'pins', 'delicate', 'trim'], title: 'Micro Pins for Delicate Trim', sku: '110018', price: 6.95, unit: 'box' },
    { keywords: ['upholstery', 'nails', 'tacks'], title: 'Upholstery Nails & Tacks', sku: '110019', price: 8.95, unit: 'box' },
    
    // Roofing & Siding Nails
    { keywords: ['roofing', 'nails', 'smooth', 'ring', 'shank', 'large'], title: 'Roofing Nails Smooth/Ring Shank Large Head', sku: '110020', price: 14.95, unit: 'lb' },
    { keywords: ['coil', 'roofing', 'nails', 'pneumatic', 'guns'], title: 'Coil Roofing Nails Pneumatic Guns', sku: '110021', price: 16.95, unit: 'coil' },
    { keywords: ['siding', 'nails', 'stainless', 'ring', 'shank'], title: 'Siding Nails Stainless Ring Shank', sku: '110022', price: 18.95, unit: 'lb' },
    { keywords: ['fiber', 'cement', 'siding', 'nails', 'polymer'], title: 'Fiber Cement Siding Nails Polymer-Coated', sku: '110023', price: 20.95, unit: 'lb' },
    { keywords: ['vinyl', 'siding', 'nails', 'washer', 'head'], title: 'Vinyl Siding Nails Washer-Head', sku: '110024', price: 15.95, unit: 'lb' },
    { keywords: ['cedar', 'siding', 'nails', 'stainless', 'steel'], title: 'Cedar Siding Nails Stainless Steel', sku: '110025', price: 22.95, unit: 'lb' },
    
    // Decking & Outdoor Nails
    { keywords: ['ring', 'shank', 'deck', 'nails', 'galvanized'], title: 'Ring-Shank Deck Nails Galvanized', sku: '110026', price: 16.95, unit: 'lb' },
    { keywords: ['ceramic', 'coated', 'deck', 'nails'], title: 'Ceramic-Coated Deck Nails', sku: '110027', price: 18.95, unit: 'lb' },
    { keywords: ['stainless', 'steel', 'deck', 'nails'], title: 'Stainless Steel Deck Nails', sku: '110028', price: 25.95, unit: 'lb' },
    { keywords: ['collated', 'coil', 'siding', 'nails'], title: 'Collated Coil Siding Nails', sku: '110029', price: 22.95, unit: 'coil' },
    { keywords: ['fence', 'nails', 'galvanized', 'ring', 'shank'], title: 'Fence Nails Galvanized Ring Shank', sku: '110030', price: 14.95, unit: 'lb' },
    { keywords: ['acq', 'rated', 'nails', 'pressure', 'treated'], title: 'ACQ-Rated Nails Pressure-Treated', sku: '110031', price: 17.95, unit: 'lb' },
    { keywords: ['hidden', 'fastener', 'system', 'nails', 'clips'], title: 'Hidden Fastener System Nails Clips', sku: '110032', price: 28.95, unit: 'box' },
    
    // Masonry & Concrete Nails
    { keywords: ['hardened', 'masonry', 'nails', 'square', 'shank'], title: 'Hardened Masonry Nails Square Shank', sku: '110033', price: 12.95, unit: 'lb' },
    { keywords: ['drive', 'nails', 'zinc', 'plated', 'light'], title: 'Drive Nails Zinc-Plated Light-Duty', sku: '110034', price: 10.95, unit: 'lb' },
    { keywords: ['cut', 'masonry', 'nails', 'flat', 'chisel'], title: 'Cut Masonry Nails Flat Chisel Point', sku: '110035', price: 11.95, unit: 'lb' },
    { keywords: ['fluted', 'concrete', 'nails', 'spiral', 'grooves'], title: 'Fluted Concrete Nails Spiral Grooves', sku: '110036', price: 13.95, unit: 'lb' },
    { keywords: ['steel', 'drive', 'pins', 'powder', 'actuated'], title: 'Steel Drive Pins Powder-Actuated', sku: '110037', price: 15.95, unit: 'box' },
    
    // Powder-Actuated & Pin Fasteners
    { keywords: ['powder', 'actuated', 'drive', 'pins', '1', '3'], title: 'Powder-Actuated Drive Pins 1-3 Inch', sku: '110038', price: 18.95, unit: 'box' },
    { keywords: ['washered', 'pins', 'light', 'medium', 'duty'], title: 'Washered Pins Light to Medium-Duty', sku: '110039', price: 20.95, unit: 'box' },
    { keywords: ['threaded', 'studs', 'pipe', 'hangers', 'brackets'], title: 'Threaded Studs Pipe Hangers/Brackets', sku: '110040', price: 22.95, unit: 'each' },
    { keywords: ['ceiling', 'clips', 'conduit', 'hanger', 'supports'], title: 'Ceiling Clips Conduit/Hanger Supports', sku: '110041', price: 8.95, unit: 'each' },
    { keywords: ['powder', 'loads', 'yellow', 'green', 'red'], title: 'Powder Loads Yellow/Green/Red Levels', sku: '110042', price: 12.95, unit: 'box' },
    { keywords: ['gas', 'actuated', 'pins', 'cordless', 'gas'], title: 'Gas-Actuated Pins Cordless Gas', sku: '110043', price: 25.95, unit: 'box' },
    
    // Drywall & Hollow Wall Anchors
    { keywords: ['plastic', 'expansion', 'anchors', 'ribbed', 'conical'], title: 'Plastic Expansion Anchors Ribbed/Conical', sku: '110044', price: 6.95, unit: 'pack' },
    { keywords: ['winged', 'plastic', 'anchors'], title: 'Winged Plastic Anchors', sku: '110045', price: 8.95, unit: 'pack' },
    { keywords: ['self', 'drilling', 'drywall', 'anchors', 'plastic'], title: 'Self-Drilling Drywall Anchors Plastic', sku: '110046', price: 7.95, unit: 'pack' },
    { keywords: ['toggle', 'bolts', 'spring', 'wing', 'strap'], title: 'Toggle Bolts Spring Wing/Strap Type', sku: '110047', price: 10.95, unit: 'pack' },
    { keywords: ['molly', 'bolts', 'hollow', 'wall', 'anchors'], title: 'Molly Bolts Hollow Wall Anchors', sku: '110048', price: 12.95, unit: 'pack' },
    { keywords: ['snap', 'toggle', 'bolts', 'heavy', 'duty'], title: 'Snap Toggle Bolts Heavy-Duty', sku: '110049', price: 14.95, unit: 'pack' },
    { keywords: ['hollow', 'drive', 'anchors', 'hammer', 'set'], title: 'Hollow Drive Anchors Hammer Set', sku: '110050', price: 9.95, unit: 'pack' },
    { keywords: ['nail', 'in', 'anchors', 'push', 'mount'], title: 'Nail-In Anchors Push-Mount Plastic', sku: '110051', price: 8.95, unit: 'pack' },
    
    // Concrete, Brick & Block Anchors
    { keywords: ['wedge', 'anchors', 'mechanical', 'expansion'], title: 'Wedge Anchors Mechanical Expansion', sku: '110052', price: 15.95, unit: 'each' },
    { keywords: ['sleeve', 'anchors', 'universal', 'expansion'], title: 'Sleeve Anchors Universal Expansion', sku: '110053', price: 12.95, unit: 'each' },
    { keywords: ['drop', 'in', 'anchors', 'flush', 'mount'], title: 'Drop-In Anchors Flush Mount', sku: '110054', price: 14.95, unit: 'each' },
    { keywords: ['lag', 'shield', 'anchors', 'lag', 'screws'], title: 'Lag Shield Anchors Lag Screws', sku: '110055', price: 18.95, unit: 'each' },
    { keywords: ['strike', 'anchors', 'hammer', 'driven', 'set'], title: 'Strike Anchors Hammer-Driven Set', sku: '110056', price: 13.95, unit: 'each' },
    { keywords: ['concrete', 'screws', 'tapcon', 'blue', 'self'], title: 'Concrete Screws Tapcon Blue Self-Tapping', sku: '110057', price: 16.95, unit: 'pack' },
    { keywords: ['epoxy', 'anchor', 'systems', 'simpson', 'set'], title: 'Epoxy Anchor Systems Simpson SET', sku: '110058', price: 45.95, unit: 'kit' },
    { keywords: ['hilti', 'hit', 'epoxy', 'anchors'], title: 'Hilti HIT Epoxy Anchors', sku: '110059', price: 55.95, unit: 'kit' },
    { keywords: ['threaded', 'rod', 'anchoring', 'kits'], title: 'Threaded Rod Anchoring Kits', sku: '110060', price: 35.95, unit: 'kit' },
    { keywords: ['adhesive', 'capsules', 'chemical', 'anchor'], title: 'Adhesive Capsules Chemical Anchor', sku: '110061', price: 25.95, unit: 'pack' },
    { keywords: ['expansion', 'bolts', 'mechanical', 'heavy', 'duty'], title: 'Expansion Bolts Mechanical Heavy-Duty', sku: '110062', price: 22.95, unit: 'each' },
    { keywords: ['nail', 'drive', 'anchors', 'light', 'duty'], title: 'Nail Drive Anchors Light-Duty Quick-Set', sku: '110063', price: 10.95, unit: 'pack' },
    
    // Specialty Anchors
    { keywords: ['insulation', 'anchors', 'plastic', 'metal', 'washers'], title: 'Insulation Anchors Plastic/Metal Washers', sku: '110064', price: 8.95, unit: 'pack' },
    { keywords: ['ceiling', 'wire', 'hangers', 'grid', 'anchors'], title: 'Ceiling Wire Hangers & Grid Anchors', sku: '110065', price: 12.95, unit: 'pack' },
    { keywords: ['eye', 'bolt', 'anchors', 'lifting', 'hanging'], title: 'Eye-Bolt Anchors Lifting/Hanging', sku: '110066', price: 15.95, unit: 'each' },
    { keywords: ['sleeve', 'type', 'toggle', 'anchors', 'thin'], title: 'Sleeve-Type Toggle Anchors Thin Material', sku: '110067', price: 11.95, unit: 'pack' },
    { keywords: ['hammer', 'set', 'nail', 'anchors', 'concrete'], title: 'Hammer-Set Nail Anchors Concrete/Block', sku: '110068', price: 9.95, unit: 'pack' },
    { keywords: ['drive', 'anchor', 'mushroom', 'head'], title: 'Drive Anchor with Mushroom Head', sku: '110069', price: 13.95, unit: 'each' },
    { keywords: ['removable', 'screw', 'anchors', 'tapcon', 'style'], title: 'Removable Screw Anchors Tapcon Style', sku: '110070', price: 14.95, unit: 'pack' },
    { keywords: ['nylon', 'nail', 'in', 'anchors', 'medium', 'duty'], title: 'Nylon Nail-In Anchors Medium-Duty', sku: '110071', price: 7.95, unit: 'pack' },
    { keywords: ['expansion', 'sleeves', 'pipe', 'supports'], title: 'Expansion Sleeves Pipe Supports', sku: '110072', price: 16.95, unit: 'pack' },
    
    // Nail & Anchor Accessories
    { keywords: ['nail', 'sets', 'small', 'medium', 'large'], title: 'Nail Sets Small/Medium/Large', sku: '110073', price: 8.95, unit: 'set' },
    { keywords: ['magnetic', 'nail', 'starters'], title: 'Magnetic Nail Starters', sku: '110074', price: 12.95, unit: 'each' },
    { keywords: ['anchor', 'bolts', 'j', 'bolt', 'l', 'bolt'], title: 'Anchor Bolts J-Bolt/L-Bolt/U-Bolt', sku: '110075', price: 15.95, unit: 'each' },
    { keywords: ['anchor', 'setting', 'tools'], title: 'Anchor Setting Tools', sku: '110076', price: 25.95, unit: 'each' },
    { keywords: ['rebar', 'dowel', 'anchors'], title: 'Rebar Dowel Anchors', sku: '110077', price: 18.95, unit: 'each' },
    { keywords: ['anchor', 'epoxy', 'dispensers'], title: 'Anchor Epoxy Dispensers', sku: '110078', price: 35.95, unit: 'each' },
    { keywords: ['powder', 'actuated', 'tool', 'charges', 'color'], title: 'Powder-Actuated Tool Charges Color-Coded', sku: '110079', price: 22.95, unit: 'box' },
    { keywords: ['plastic', 'anchor', 'kits', 'assorted', 'sizes'], title: 'Plastic Anchor Kits Assorted Sizes', sku: '110080', price: 18.95, unit: 'kit' },
    { keywords: ['anchor', 'washers', 'spacers'], title: 'Anchor Washers & Spacers', sku: '110081', price: 8.95, unit: 'pack' },
    { keywords: ['metal', 'strapping', 'brackets', 'tie', 'down'], title: 'Metal Strapping & Brackets Tie-Down', sku: '110082', price: 15.95, unit: 'each' },
    
    // Nail & Anchor Brands
    { keywords: ['grip', 'rite', 'nails'], title: 'Grip-Rite Nails', sku: '110083', price: 12.95, unit: 'lb' },
    { keywords: ['simpson', 'strong', 'tie', 'anchors'], title: 'Simpson Strong-Tie Anchors', sku: '110084', price: 18.95, unit: 'each' },
    { keywords: ['ramset', 'powder', 'actuated'], title: 'Ramset Powder-Actuated', sku: '110085', price: 25.95, unit: 'box' },
    { keywords: ['hilti', 'anchors'], title: 'Hilti Anchors', sku: '110086', price: 28.95, unit: 'each' },
    { keywords: ['tapcon', 'concrete', 'screws'], title: 'Tapcon Concrete Screws', sku: '110087', price: 16.95, unit: 'pack' },
    { keywords: ['red', 'head', 'anchors'], title: 'Red Head Anchors', sku: '110088', price: 20.95, unit: 'each' },
    { keywords: ['itw', 'buildex', 'fasteners'], title: 'ITW Buildex Fasteners', sku: '110089', price: 15.95, unit: 'pack' },
    { keywords: ['powers', 'fasteners'], title: 'Powers Fasteners', sku: '110090', price: 22.95, unit: 'each' },
    { keywords: ['dewalt', 'anchors'], title: 'DEWALT Anchors', sku: '110091', price: 18.95, unit: 'each' },
    { keywords: ['hillman', 'fasteners'], title: 'Hillman Fasteners', sku: '110092', price: 14.95, unit: 'pack' },
    { keywords: ['cobra', 'anchors'], title: 'Cobra Anchors', sku: '110093', price: 16.95, unit: 'each' },
    { keywords: ['paslode', 'nails'], title: 'Paslode Nails', sku: '110094', price: 24.95, unit: 'box' },
    { keywords: ['bostitch', 'nails'], title: 'Bostitch Nails', sku: '110095', price: 20.95, unit: 'box' },
    { keywords: ['senco', 'nails'], title: 'SENCO Nails', sku: '110096', price: 22.95, unit: 'box' },
    
    // ========================================
    // TOOL & EQUIPMENT RENTAL SECTION
    // ========================================
    
    // 🚜 HEAVY EQUIPMENT RENTAL
    // Earthmoving & Excavation Equipment
    { keywords: ['rental', 'mini', 'excavators', '1.7', '6', 'ton', 'heavy', 'equipment'], title: 'Mini Excavators 1.7-6 Ton Rental', sku: '111001', price: 285.95, unit: 'day' },
    { keywords: ['rental', 'compact', 'track', 'loaders', 'bobcat', 'skid', 'steer', 'heavy', 'equipment'], title: 'Compact Track Loaders Bobcat/Skid Steer Rental', sku: '111002', price: 245.95, unit: 'day' },
    { keywords: ['rental', 'skid', 'steers', 'wheeled', 'tracked', 'heavy', 'equipment'], title: 'Skid Steers Wheeled and Tracked Rental', sku: '111003', price: 225.95, unit: 'day' },
    { keywords: ['rental', 'backhoe', 'loaders', 'john', 'deere', 'cat', 'heavy', 'equipment'], title: 'Backhoe Loaders John Deere/CAT Rental', sku: '111004', price: 325.95, unit: 'day' },
    { keywords: ['rental', 'trenchers', 'walk', 'behind', 'ride', 'on', 'heavy', 'equipment'], title: 'Trenchers Walk-Behind & Ride-On Rental', sku: '111005', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'walk', 'behind', 'trenchers', '18', '48', 'inch', 'heavy', 'equipment'], title: 'Walk-Behind Trenchers 18-48 Inch Depth Rental', sku: '111006', price: 165.95, unit: 'day' },
    { keywords: ['rental', 'tracked', 'trenchers', 'utility', 'irrigation', 'heavy', 'equipment'], title: 'Tracked Trenchers Utility/Irrigation Rental', sku: '111007', price: 195.95, unit: 'day' },
    { keywords: ['rental', 'vibratory', 'plows', 'cable', 'conduit', 'heavy', 'equipment'], title: 'Vibratory Plows Cable/Conduit Burying Rental', sku: '111008', price: 175.95, unit: 'day' },
    { keywords: ['rental', 'ride', 'on', 'trenchers', '60', 'depth', 'heavy', 'equipment'], title: 'Ride-On Trenchers 60+ Inch Depth Rental', sku: '111009', price: 225.95, unit: 'day' },
    { keywords: ['rental', 'mini', 'loaders', 'toro', 'dingo', 'vermeer', 'heavy', 'equipment'], title: 'Mini Loaders Toro Dingo/Vermeer Rental', sku: '111010', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'dozers', 'small', 'medium', 'crawler', 'heavy', 'equipment'], title: 'Dozers Small/Medium Crawler Models Rental', sku: '111011', price: 385.95, unit: 'day' },
    { keywords: ['rental', 'excavator', 'attachments', 'buckets', 'breakers', 'heavy', 'equipment'], title: 'Excavator Attachments Buckets/Breakers Rental', sku: '111012', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'post', 'hole', 'augers', 'handheld', 'skid', 'heavy', 'equipment'], title: 'Post-Hole Augers Handheld/Skid/Towable Rental', sku: '111013', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'hydraulic', 'hammer', 'breakers', 'skid', 'heavy', 'equipment'], title: 'Hydraulic Hammer Breakers Skid/Mini-Ex Rental', sku: '111014', price: 125.95, unit: 'day' },
    
    // Material Handling & Lifting Equipment
    { keywords: ['rental', 'forklifts', 'warehouse', 'rough', 'terrain', 'heavy', 'equipment'], title: 'Forklifts Warehouse/Rough Terrain Rental', sku: '111015', price: 285.95, unit: 'day' },
    { keywords: ['rental', 'telescopic', 'reach', 'forklifts', 'telehandlers', 'heavy', 'equipment'], title: 'Telescopic Reach Forklifts Telehandlers Rental', sku: '111016', price: 325.95, unit: 'day' },
    { keywords: ['rental', 'scissor', 'lifts', 'electric', '19', '32', 'ft', 'heavy', 'equipment'], title: 'Scissor Lifts Electric 19-32 Ft Rental', sku: '111017', price: 195.95, unit: 'day' },
    { keywords: ['rental', 'boom', 'lifts', 'articulating', 'telescopic', 'heavy', 'equipment'], title: 'Boom Lifts Articulating/Telescopic Rental', sku: '111018', price: 285.95, unit: 'day' },
    { keywords: ['rental', 'aerial', 'work', 'platforms', 'one', 'man', 'lift', 'heavy', 'equipment'], title: 'Aerial Work Platforms One-Man Lift Rental', sku: '111019', price: 165.95, unit: 'day' },
    { keywords: ['rental', 'pallet', 'jacks', 'manual', 'electric', 'heavy', 'equipment'], title: 'Pallet Jacks Manual/Electric Rental', sku: '111020', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'material', 'lifts', 'drywall', 'duct', 'heavy', 'equipment'], title: 'Material Lifts Drywall/Duct Lifts Rental', sku: '111021', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'chain', 'hoists', 'lever', 'hoists', 'heavy', 'equipment'], title: 'Chain Hoists & Lever Hoists Rental', sku: '111022', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'engine', 'hoists', 'shop', 'cranes', 'heavy', 'equipment'], title: 'Engine Hoists/Shop Cranes Rental', sku: '111023', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'gantry', 'cranes', 'portable', 'frame', 'heavy', 'equipment'], title: 'Gantry Cranes Portable A-Frame Rental', sku: '111024', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'lift', 'jacks', 'bottle', 'hydraulic', 'farm', 'heavy', 'equipment'], title: 'Lift Jacks Bottle/Hydraulic/Farm Rental', sku: '111025', price: 55.95, unit: 'day' },
    
    // Concrete & Masonry Equipment
    { keywords: ['rental', 'concrete', 'mixers', 'electric', '3.5', 'cu', 'ft', 'equipment'], title: 'Concrete Mixers Electric 3.5 Cu Ft Rental', sku: '111026', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'towable', 'cement', 'mixers', 'gas', 'powered', 'equipment'], title: 'Towable Cement Mixers Gas-Powered Rental', sku: '111027', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'mortar', 'mixers', '6', '9', 'cu', 'ft', 'equipment'], title: 'Mortar Mixers 6-9 Cu Ft Rental', sku: '111028', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'saws', 'walk', 'behind', 'cutoff', 'equipment'], title: 'Concrete Saws Walk-Behind/Cutoff Rental', sku: '111029', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'cut', 'off', 'saws', 'stihl', 'husqvarna', 'makita', 'equipment'], title: 'Cut-Off Saws Stihl/Husqvarna/Makita Rental', sku: '111030', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'grinders', 'polishers', 'floor', 'prep', 'equipment'], title: 'Concrete Grinders & Polishers Floor Prep Rental', sku: '111031', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'vibrators', 'electric', 'gas', 'equipment'], title: 'Concrete Vibrators Electric/Gas Rental', sku: '111032', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'power', 'trowels', '24', '48', 'inch', 'equipment'], title: 'Power Trowels 24-48 Inch Rental', sku: '111033', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'buggy', 'georgia', 'buggy', 'track', 'wheel', 'equipment'], title: 'Concrete Buggy/Georgia Buggy Track/Wheel Rental', sku: '111034', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'screeds', 'manual', 'vibrating', 'equipment'], title: 'Concrete Screeds Manual/Vibrating Rental', sku: '111035', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'core', 'drills', 'handheld', 'rig', 'mounted', 'equipment'], title: 'Core Drills Handheld/Rig-Mounted Rental', sku: '111036', price: 145.95, unit: 'day' },
    { keywords: ['rental', 'walk', 'behind', 'scarifiers', 'surface', 'planers', 'equipment'], title: 'Walk-Behind Scarifiers & Surface Planers Rental', sku: '111037', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'masonry', 'saws', 'wet', 'cut', 'tile', 'block', 'equipment'], title: 'Masonry Saws Wet Cut Tile/Block Rental', sku: '111038', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'rebar', 'cutters', 'benders', 'equipment'], title: 'Rebar Cutters & Benders Rental', sku: '111039', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'forms', 'stakes', 'equipment'], title: 'Concrete Forms & Stakes Rental', sku: '111040', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'portable', 'rebar', 'tying', 'tools', 'equipment'], title: 'Portable Rebar Tying Tools Rental', sku: '111041', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'wheelbarrows', 'single', 'dual', 'wheel', 'equipment'], title: 'Wheelbarrows Single/Dual-Wheel Rental', sku: '111042', price: 25.95, unit: 'day' },
    
    // Compaction Equipment
    { keywords: ['rental', 'plate', 'compactors', 'small', 'reversible', 'large', 'equipment'], title: 'Plate Compactors Small/Reversible/Large Rental', sku: '111043', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'vibratory', 'rammers', 'jumping', 'jacks', 'equipment'], title: 'Vibratory Rammers/Jumping Jacks Rental', sku: '111044', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'trench', 'rollers', 'remote', 'control', 'compactor', 'equipment'], title: 'Trench Rollers Remote Control Compactor Rental', sku: '111045', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'ride', 'on', 'rollers', 'smooth', 'drum', 'padfoot', 'equipment'], title: 'Ride-On Rollers Smooth Drum/Padfoot Rental', sku: '111046', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'walk', 'behind', 'rollers', 'drum', 'plate', 'equipment'], title: 'Walk-Behind Rollers Drum/Plate Rental', sku: '111047', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'soil', 'compaction', 'meters', 'test', 'kits', 'equipment'], title: 'Soil Compaction Meters/Test Kits Rental', sku: '111048', price: 45.95, unit: 'day' },
    
    // 🔧 POWER TOOLS RENTAL
    // Demolition & Breaking Tools
    { keywords: ['rental', 'jackhammers', 'electric', 'pneumatic', 'hydraulic', 'tools'], title: 'Jackhammers Electric/Pneumatic/Hydraulic Rental', sku: '111049', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'rotary', 'hammers', 'sds', 'plus', 'max', 'tools'], title: 'Rotary Hammers SDS Plus/SDS Max Rental', sku: '111050', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'demolition', 'hammers', 'corded', 'cordless', 'tools'], title: 'Demolition Hammers Corded/Cordless Rental', sku: '111051', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'concrete', 'breaker', 'attachments', 'skid', 'tools'], title: 'Concrete Breaker Attachments Skid/Excavator Rental', sku: '111052', price: 145.95, unit: 'day' },
    { keywords: ['rental', 'floor', 'scrapers', 'chisel', 'tools'], title: 'Floor Scrapers & Chisel Tools Rental', sku: '111053', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'chipping', 'hammers', 'light', 'demolition', 'tools'], title: 'Chipping Hammers Light Demolition Rental', sku: '111054', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'sawzalls', 'demolition', 'saws', 'metal', 'masonry', 'tools'], title: 'Sawzalls & Demolition Saws Metal/Masonry Rental', sku: '111055', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'wrecking', 'bars', 'pry', 'bars', 'sledgehammers', 'tools'], title: 'Wrecking Bars/Pry Bars/Sledgehammers Rental', sku: '111056', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'demolition', 'robots', 'remote', 'controlled', 'tools'], title: 'Demolition Robots Remote-Controlled Rental', sku: '111057', price: 385.95, unit: 'day' },
    
    // Cutting & Finishing Tools
    { keywords: ['rental', 'angle', 'grinders', 'concrete', 'grinders', 'tools'], title: 'Angle Grinders & Concrete Grinders Rental', sku: '111058', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'cut', 'off', 'wheels', 'diamond', 'blades', 'tools'], title: 'Cut-Off Wheels & Diamond Blades Rental', sku: '111059', price: 25.95, unit: 'day' },
    { keywords: ['rental', 'surface', 'grinders', 'flooring', 'tools'], title: 'Surface Grinders for Flooring Rental', sku: '111060', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'walk', 'behind', 'floor', 'grinders', 'concrete', 'tools'], title: 'Walk-Behind Floor Grinders Concrete Prep Rental', sku: '111061', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'power', 'planers', 'jointers', 'tools'], title: 'Power Planers & Jointers Rental', sku: '111062', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'table', 'saws', 'tile', 'saws', 'miter', 'tools'], title: 'Table Saws/Tile Saws/Miter Saws Rental', sku: '111063', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'handheld', 'circular', 'saws', 'worm', 'drive', 'tools'], title: 'Handheld Circular Saws & Worm Drive Rental', sku: '111064', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'drywall', 'sanders', 'dust', 'extractors', 'tools'], title: 'Drywall Sanders & Dust Extractors Rental', sku: '111065', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'power', 'shears', 'nibblers', 'tools'], title: 'Power Shears and Nibblers Rental', sku: '111066', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'sanders', 'belt', 'orbital', 'drywall', 'pole', 'tools'], title: 'Sanders Belt/Orbital/Drywall Pole Rental', sku: '111067', price: 45.95, unit: 'day' },
    
    // Core Jobsite Power Tools
    { keywords: ['rental', 'cordless', 'drills', 'impacts', 'hammer', 'drills', 'tools'], title: 'Cordless Drills/Impacts/Hammer Drills Rental', sku: '111078', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'circular', 'miter', 'table', 'reciprocating', 'saws', 'tools'], title: 'Circular/Miter/Table/Reciprocating Saws Rental', sku: '111079', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'rotary', 'hammers', 'sds', 'drills', 'tools'], title: 'Rotary Hammers & SDS Drills Rental', sku: '111080', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'grinders', '4.5', '5', '7', '9', 'inch', 'tools'], title: 'Grinders 4.5/5/7/9 Inch Rental', sku: '111081', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'impact', 'wrenches', '0.5', '0.75', '1', 'inch', 'tools'], title: 'Impact Wrenches 0.5/0.75/1 Inch Rental', sku: '111082', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'oscillating', 'multi', 'tools'], title: 'Oscillating Multi-Tools Rental', sku: '111083', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'routers', 'laminate', 'trimmers', 'tools'], title: 'Routers & Laminate Trimmers Rental', sku: '111084', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'planers', 'jointers', 'tools'], title: 'Planers & Jointers Rental', sku: '111085', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'nail', 'guns', 'finish', 'framing', 'brad', 'roofing', 'flooring', 'tools'], title: 'Nail Guns Finish/Framing/Brad/Roofing/Flooring Rental', sku: '111086', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'heat', 'guns', 'soldering', 'torch', 'tools'], title: 'Heat Guns/Soldering/Torch Tools Rental', sku: '111087', price: 25.95, unit: 'day' },
    
    // 💨 AIR TOOLS & COMPRESSORS RENTAL
    { keywords: ['rental', 'portable', 'air', 'compressors', '2', '8', 'gallon', 'tools'], title: 'Portable Air Compressors 2-8 Gallon Rental', sku: '111068', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'wheelbarrow', 'compressors', 'gas', 'electric', 'twin', 'tank', 'tools'], title: 'Wheelbarrow Compressors Gas/Electric Twin Tank Rental', sku: '111069', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'towable', 'air', 'compressors', '185', '400', 'cfm', 'tools'], title: 'Towable Air Compressors 185-400 CFM Rental', sku: '111070', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'pneumatic', 'nailers', 'framing', 'roofing', 'flooring', 'tools'], title: 'Pneumatic Nailers Framing/Roofing/Flooring Rental', sku: '111071', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'air', 'hammers', 'chisels', 'tools'], title: 'Air Hammers & Chisels Rental', sku: '111072', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'air', 'hoses', 'reels', 'fittings', 'tools'], title: 'Air Hoses/Reels/Fittings Rental', sku: '111073', price: 25.95, unit: 'day' },
    { keywords: ['rental', 'paint', 'sprayers', 'hvlp', 'airless', 'texture', 'tools'], title: 'Paint Sprayers HVLP/Airless/Texture Rental', sku: '111074', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'blowers', 'inflators', 'tools'], title: 'Blowers & Inflators Rental', sku: '111075', price: 25.95, unit: 'day' },
    { keywords: ['rental', 'pneumatic', 'staplers', 'finish', 'nailers', 'tools'], title: 'Pneumatic Staplers & Finish Nailers Rental', sku: '111076', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'pneumatic', 'grinders', 'impact', 'wrenches', 'tools'], title: 'Pneumatic Grinders & Impact Wrenches Rental', sku: '111077', price: 45.95, unit: 'day' },
    
    // ⚡ GENERATORS & POWER RENTAL
    { keywords: ['rental', 'portable', 'generators', '2000', '9000', 'w', 'power'], title: 'Portable Generators 2000-9000W Rental', sku: '111088', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'inverter', 'generators', 'quiet', 'jobsite', 'power'], title: 'Inverter Generators Quiet Jobsite Type Rental', sku: '111089', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'towable', 'diesel', 'generators', '20', '50', 'kw', 'power'], title: 'Towable Diesel Generators 20-50 kW Rental', sku: '111090', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'temporary', 'power', 'distribution', 'boxes', 'power'], title: 'Temporary Power Distribution Boxes Rental', sku: '111091', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'extension', 'cords', '12', '3', '10', '3', 'awg', 'power'], title: 'Extension Cords 12/3/10/3 AWG Outdoor-Rated Rental', sku: '111092', price: 25.95, unit: 'day' },
    { keywords: ['rental', 'led', 'tower', 'lights', 'tripod', 'floodlights', 'power'], title: 'LED Tower Lights & Tripod Floodlights Rental', sku: '111093', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'balloon', 'lights', 'site', 'illumination', 'power'], title: 'Balloon Lights Site Illumination Rental', sku: '111094', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'string', 'lights', '50', '100', 'ft', 'jobsite', 'power'], title: 'String Lights 50-100 Ft Jobsite Runs Rental', sku: '111095', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'rechargeable', 'led', 'work', 'lights', 'power'], title: 'Rechargeable LED Work Lights Rental', sku: '111096', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'battery', 'packs', 'inverters', 'power'], title: 'Battery Packs & Inverters Rental', sku: '111097', price: 55.95, unit: 'day' },
    
    // 🪜 LADDERS & SCAFFOLDING RENTAL
    { keywords: ['rental', 'step', 'ladders', '4', '12', 'ft', 'scaffolding'], title: 'Step Ladders 4-12 Ft Rental', sku: '111098', price: 25.95, unit: 'day' },
    { keywords: ['rental', 'extension', 'ladders', '16', '40', 'ft', 'scaffolding'], title: 'Extension Ladders 16-40 Ft Rental', sku: '111099', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'multi', 'position', 'ladders', 'folding', 'scaffolding'], title: 'Multi-Position Ladders Folding Articulating Rental', sku: '111100', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'scaffolding', 'towers', 'baker', 'system', 'scaffolding'], title: 'Scaffolding Towers Baker/System Scaffolds Rental', sku: '111101', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'rolling', 'scaffold', 'platforms', 'scaffolding'], title: 'Rolling Scaffold Platforms Rental', sku: '111102', price: 95.95, unit: 'day' },
    { keywords: ['rental', 'mobile', 'work', 'platforms', 'folding', 'scaffolding'], title: 'Mobile Work Platforms Folding Rental', sku: '111103', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'ladder', 'jacks', 'planks', 'guardrails', 'scaffolding'], title: 'Ladder Jacks/Planks/Guardrails Rental', sku: '111104', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'stair', 'scaffolds', 'planks', 'scaffolding'], title: 'Stair Scaffolds & Planks Rental', sku: '111105', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'outrigger', 'kits', 'safety', 'tie', 'offs', 'scaffolding'], title: 'Outrigger Kits & Safety Tie-Offs Rental', sku: '111106', price: 45.95, unit: 'day' },
    
    // 🌿 LANDSCAPING & GROUNDS RENTAL
    { keywords: ['rental', 'sod', 'cutters', 'gas', 'powered', 'landscaping'], title: 'Sod Cutters Gas-Powered Rental', sku: '111122', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'lawn', 'rollers', 'aerators', 'landscaping'], title: 'Lawn Rollers & Aerators Rental', sku: '111123', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'overseeders', 'dethatchers', 'landscaping'], title: 'Overseeders & Dethatchers Rental', sku: '111124', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'stump', 'grinders', 'landscaping'], title: 'Stump Grinders Rental', sku: '111125', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'log', 'splitters', 'landscaping'], title: 'Log Splitters Rental', sku: '111126', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'brush', 'cutters', 'clearing', 'saws', 'landscaping'], title: 'Brush Cutters & Clearing Saws Rental', sku: '111127', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'string', 'trimmers', 'edgers', 'landscaping'], title: 'String Trimmers & Edgers Rental', sku: '111128', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'lawn', 'mowers', 'walk', 'behind', 'zero', 'turn', 'landscaping'], title: 'Lawn Mowers Walk-Behind/Zero-Turn Rental', sku: '111129', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'tillers', 'cultivators', 'landscaping'], title: 'Tillers & Cultivators Rental', sku: '111130', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'wood', 'chippers', '6', '12', 'inch', 'capacity', 'landscaping'], title: 'Wood Chippers 6-12 Inch Capacity Rental', sku: '111131', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'pressure', 'washers', 'electric', 'gas', 'cold', 'hot', 'water', 'landscaping'], title: 'Pressure Washers Electric/Gas Cold/Hot Water Rental', sku: '111132', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'water', 'pumps', 'trash', 'utility', 'dewatering', 'landscaping'], title: 'Water Pumps Trash/Utility/Dewatering Rental', sku: '111133', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'compact', 'trenchers', 'ditchers', 'landscaping'], title: 'Compact Trenchers & Ditchers Rental', sku: '111134', price: 125.95, unit: 'day' },
    { keywords: ['rental', 'leaf', 'blowers', 'vacuums', 'landscaping'], title: 'Leaf Blowers & Vacuums Rental', sku: '111135', price: 35.95, unit: 'day' },
    
    // 🏷️ RENTAL EQUIPMENT BRANDS
    { keywords: ['rental', 'cat', 'caterpillar', 'equipment', 'brands'], title: 'CAT/Caterpillar Equipment Rental', sku: '111160', price: 385.95, unit: 'day' },
    { keywords: ['rental', 'john', 'deere', 'equipment', 'brands'], title: 'John Deere Equipment Rental', sku: '111161', price: 325.95, unit: 'day' },
    { keywords: ['rental', 'bobcat', 'equipment', 'brands'], title: 'Bobcat Equipment Rental', sku: '111162', price: 285.95, unit: 'day' },
    { keywords: ['rental', 'kubota', 'equipment', 'brands'], title: 'Kubota Equipment Rental', sku: '111163', price: 295.95, unit: 'day' },
    { keywords: ['rental', 'toro', 'equipment', 'brands'], title: 'Toro Equipment Rental', sku: '111164', price: 185.95, unit: 'day' },
    { keywords: ['rental', 'wacker', 'neuson', 'equipment', 'brands'], title: 'Wacker Neuson Equipment Rental', sku: '111165', price: 245.95, unit: 'day' },
    { keywords: ['rental', 'husqvarna', 'equipment', 'brands'], title: 'Husqvarna Equipment Rental', sku: '111166', price: 165.95, unit: 'day' },
    { keywords: ['rental', 'makita', 'tools', 'brands'], title: 'Makita Tools Rental', sku: '111167', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'dewalt', 'tools', 'brands'], title: 'DeWalt Tools Rental', sku: '111168', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'milwaukee', 'tools', 'brands'], title: 'Milwaukee Tools Rental', sku: '111169', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'bosch', 'tools', 'brands'], title: 'Bosch Tools Rental', sku: '111170', price: 65.95, unit: 'day' },
    { keywords: ['rental', 'hilti', 'tools', 'brands'], title: 'Hilti Tools Rental', sku: '111171', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'multiquip', 'equipment', 'brands'], title: 'Multiquip Equipment Rental', sku: '111172', price: 195.95, unit: 'day' },
    { keywords: ['rental', 'genie', 'lifts', 'brands'], title: 'Genie Lifts Rental', sku: '111173', price: 225.95, unit: 'day' },
    { keywords: ['rental', 'skyjack', 'lifts', 'brands'], title: 'Skyjack Lifts Rental', sku: '111174', price: 215.95, unit: 'day' },
    { keywords: ['rental', 'jlg', 'lifts', 'brands'], title: 'JLG Lifts Rental', sku: '111175', price: 235.95, unit: 'day' },
    { keywords: ['rental', 'bil', 'jax', 'scaffolding', 'brands'], title: 'Bil-Jax Scaffolding Rental', sku: '111176', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'husky', 'tools', 'brands'], title: 'Husky Tools Rental', sku: '111177', price: 45.95, unit: 'day' },
    { keywords: ['rental', 'ridgid', 'tools', 'brands'], title: 'RIDGID Tools Rental', sku: '111178', price: 55.95, unit: 'day' },
    { keywords: ['rental', 'simpson', 'equipment', 'brands'], title: 'Simpson Equipment Rental', sku: '111179', price: 85.95, unit: 'day' },
    { keywords: ['rental', 'mi', 't', 'm', 'equipment', 'brands'], title: 'Mi-T-M Equipment Rental', sku: '111180', price: 165.95, unit: 'day' },
    { keywords: ['rental', 'ramset', 'tools', 'brands'], title: 'Ramset Tools Rental', sku: '111181', price: 75.95, unit: 'day' },
    { keywords: ['rental', 'werner', 'ladders', 'brands'], title: 'Werner Ladders Rental', sku: '111182', price: 35.95, unit: 'day' },
    { keywords: ['rental', 'honda', 'power', 'equipment', 'brands'], title: 'Honda Power Equipment Rental', sku: '111183', price: 125.95, unit: 'day' },
    { keywords: ['surface', 'grinders', 'flooring'], title: 'Surface Grinders for Flooring', sku: '111060', price: 85.95, unit: 'day' },
    { keywords: ['walk', 'behind', 'floor', 'grinders', 'concrete'], title: 'Walk-Behind Floor Grinders Concrete Prep', sku: '111061', price: 125.95, unit: 'day' },
    { keywords: ['power', 'planers', 'jointers'], title: 'Power Planers & Jointers', sku: '111062', price: 65.95, unit: 'day' },
    { keywords: ['table', 'saws', 'tile', 'saws', 'miter'], title: 'Table Saws/Tile Saws/Miter Saws', sku: '111063', price: 75.95, unit: 'day' },
    { keywords: ['handheld', 'circular', 'saws', 'worm', 'drive'], title: 'Handheld Circular Saws & Worm Drive', sku: '111064', price: 45.95, unit: 'day' },
    { keywords: ['drywall', 'sanders', 'dust', 'extractors'], title: 'Drywall Sanders & Dust Extractors', sku: '111065', price: 65.95, unit: 'day' },
    { keywords: ['power', 'shears', 'nibblers'], title: 'Power Shears and Nibblers', sku: '111066', price: 55.95, unit: 'day' },
    { keywords: ['sanders', 'belt', 'orbital', 'drywall'], title: 'Sanders Belt/Orbital/Drywall Pole', sku: '111067', price: 45.95, unit: 'day' },
    
    // Air Tools & Compressors
    { keywords: ['portable', 'air', 'compressors', '2', '8'], title: 'Portable Air Compressors 2-8 Gallon', sku: '111068', price: 45.95, unit: 'day' },
    { keywords: ['wheelbarrow', 'compressors', 'gas', 'electric'], title: 'Wheelbarrow Compressors Gas/Electric Twin Tank', sku: '111069', price: 75.95, unit: 'day' },
    { keywords: ['towable', 'air', 'compressors', '185', '400'], title: 'Towable Air Compressors 185-400 CFM', sku: '111070', price: 125.95, unit: 'day' },
    { keywords: ['pneumatic', 'nailers', 'framing', 'roofing'], title: 'Pneumatic Nailers Framing/Roofing/Flooring', sku: '111071', price: 35.95, unit: 'day' },
    { keywords: ['air', 'hammers', 'chisels'], title: 'Air Hammers & Chisels', sku: '111072', price: 35.95, unit: 'day' },
    { keywords: ['air', 'hoses', 'reels', 'fittings'], title: 'Air Hoses/Reels/Fittings', sku: '111073', price: 25.95, unit: 'day' },
    { keywords: ['paint', 'sprayers', 'hvlp', 'airless'], title: 'Paint Sprayers HVLP/Airless/Texture', sku: '111074', price: 65.95, unit: 'day' },
    { keywords: ['blowers', 'inflators'], title: 'Blowers & Inflators', sku: '111075', price: 25.95, unit: 'day' },
    { keywords: ['pneumatic', 'staplers', 'finish', 'nailers'], title: 'Pneumatic Staplers & Finish Nailers', sku: '111076', price: 35.95, unit: 'day' },
    { keywords: ['pneumatic', 'grinders', 'impact', 'wrenches'], title: 'Pneumatic Grinders & Impact Wrenches', sku: '111077', price: 45.95, unit: 'day' },
    
    // Power Tools (Core Jobsite)
    { keywords: ['cordless', 'drills', 'impacts', 'hammer', 'drills'], title: 'Cordless Drills/Impacts/Hammer Drills', sku: '111078', price: 45.95, unit: 'day' },
    { keywords: ['circular', 'miter', 'table', 'reciprocating', 'saws'], title: 'Circular/Miter/Table/Reciprocating Saws', sku: '111079', price: 55.95, unit: 'day' },
    { keywords: ['rotary', 'hammers', 'sds', 'drills'], title: 'Rotary Hammers & SDS Drills', sku: '111080', price: 65.95, unit: 'day' },
    { keywords: ['grinders', '4.5', '5', '7', '9'], title: 'Grinders 4.5/5/7/9 Inch', sku: '111081', price: 45.95, unit: 'day' },
    { keywords: ['impact', 'wrenches', '0.5', '0.75', '1'], title: 'Impact Wrenches 0.5/0.75/1 Inch', sku: '111082', price: 55.95, unit: 'day' },
    { keywords: ['oscillating', 'multi', 'tools'], title: 'Oscillating Multi-Tools', sku: '111083', price: 35.95, unit: 'day' },
    { keywords: ['routers', 'laminate', 'trimmers'], title: 'Routers & Laminate Trimmers', sku: '111084', price: 45.95, unit: 'day' },
    { keywords: ['planers', 'jointers'], title: 'Planers & Jointers', sku: '111085', price: 65.95, unit: 'day' },
    { keywords: ['nail', 'guns', 'finish', 'framing', 'brad'], title: 'Nail Guns Finish/Framing/Brad/Roofing/Flooring', sku: '111086', price: 35.95, unit: 'day' },
    { keywords: ['heat', 'guns', 'soldering', 'torch', 'tools'], title: 'Heat Guns/Soldering/Torch Tools', sku: '111087', price: 25.95, unit: 'day' },
    
    // Generators, Lighting & Power Distribution
    { keywords: ['portable', 'generators', '2000', '9000'], title: 'Portable Generators 2000-9000W', sku: '111088', price: 85.95, unit: 'day' },
    { keywords: ['inverter', 'generators', 'quiet', 'jobsite'], title: 'Inverter Generators Quiet Jobsite Type', sku: '111089', price: 95.95, unit: 'day' },
    { keywords: ['towable', 'diesel', 'generators', '20', '50'], title: 'Towable Diesel Generators 20-50 kW', sku: '111090', price: 185.95, unit: 'day' },
    { keywords: ['temporary', 'power', 'distribution', 'boxes'], title: 'Temporary Power Distribution Boxes', sku: '111091', price: 65.95, unit: 'day' },
    { keywords: ['extension', 'cords', '12', '3', '10', '3'], title: 'Extension Cords 12/3/10/3 AWG Outdoor-Rated', sku: '111092', price: 25.95, unit: 'day' },
    { keywords: ['led', 'tower', 'lights', 'tripod', 'floodlights'], title: 'LED Tower Lights & Tripod Floodlights', sku: '111093', price: 85.95, unit: 'day' },
    { keywords: ['balloon', 'lights', 'site', 'illumination'], title: 'Balloon Lights Site Illumination', sku: '111094', price: 125.95, unit: 'day' },
    { keywords: ['string', 'lights', '50', '100', 'jobsite'], title: 'String Lights 50-100 Ft Jobsite Runs', sku: '111095', price: 35.95, unit: 'day' },
    { keywords: ['rechargeable', 'led', 'work', 'lights'], title: 'Rechargeable LED Work Lights', sku: '111096', price: 45.95, unit: 'day' },
    { keywords: ['battery', 'packs', 'inverters'], title: 'Battery Packs & Inverters', sku: '111097', price: 55.95, unit: 'day' },
    
    // Ladders, Scaffolding & Platforms
    { keywords: ['step', 'ladders', '4', '12'], title: 'Step Ladders 4-12 Ft', sku: '111098', price: 25.95, unit: 'day' },
    { keywords: ['extension', 'ladders', '16', '40'], title: 'Extension Ladders 16-40 Ft', sku: '111099', price: 45.95, unit: 'day' },
    { keywords: ['multi', 'position', 'ladders', 'folding'], title: 'Multi-Position Ladders Folding Articulating', sku: '111100', price: 55.95, unit: 'day' },
    { keywords: ['scaffolding', 'towers', 'baker', 'system'], title: 'Scaffolding Towers Baker/System Scaffolds', sku: '111101', price: 85.95, unit: 'day' },
    { keywords: ['rolling', 'scaffold', 'platforms'], title: 'Rolling Scaffold Platforms', sku: '111102', price: 95.95, unit: 'day' },
    { keywords: ['mobile', 'work', 'platforms', 'folding'], title: 'Mobile Work Platforms Folding', sku: '111103', price: 65.95, unit: 'day' },
    { keywords: ['ladder', 'jacks', 'planks', 'guardrails'], title: 'Ladder Jacks/Planks/Guardrails', sku: '111104', price: 35.95, unit: 'day' },
    { keywords: ['stair', 'scaffolds', 'planks'], title: 'Stair Scaffolds & Planks', sku: '111105', price: 55.95, unit: 'day' },
    { keywords: ['outrigger', 'kits', 'safety', 'tie', 'offs'], title: 'Outrigger Kits & Safety Tie-Offs', sku: '111106', price: 45.95, unit: 'day' },
    
    // Material Transport & Site Support
    { keywords: ['dump', 'trailers', '5x8', '7x14'], title: 'Dump Trailers 5x8-7x14', sku: '111107', price: 125.95, unit: 'day' },
    { keywords: ['utility', 'trailers', 'single', 'tandem'], title: 'Utility Trailers Single/Tandem Axle', sku: '111108', price: 85.95, unit: 'day' },
    { keywords: ['equipment', 'trailers', 'tilt', 'deck'], title: 'Equipment Trailers Tilt Deck/Flatbed', sku: '111109', price: 105.95, unit: 'day' },
    { keywords: ['tow', 'dollies', 'front', 'wheel', 'car'], title: 'Tow Dollies Front Wheel/Full Car', sku: '111110', price: 75.95, unit: 'day' },
    { keywords: ['skid', 'steer', 'trailers'], title: 'Skid Steer Trailers', sku: '111111', price: 95.95, unit: 'day' },
    { keywords: ['portable', 'conveyors', 'dirt', 'gravel'], title: 'Portable Conveyors Dirt/Gravel/Concrete', sku: '111112', price: 125.95, unit: 'day' },
    { keywords: ['jobsite', 'carts', 'dollies'], title: 'Jobsite Carts & Dollies', sku: '111113', price: 35.95, unit: 'day' },
    { keywords: ['storage', 'containers', 'job', 'boxes'], title: 'Storage Containers & Job Boxes', sku: '111114', price: 55.95, unit: 'day' },
    { keywords: ['temporary', 'fencing', 'panels', 'bases'], title: 'Temporary Fencing Panels/Bases/Mesh', sku: '111115', price: 45.95, unit: 'day' },
    { keywords: ['barricades', 'safety', 'signage'], title: 'Barricades & Safety Signage', sku: '111116', price: 25.95, unit: 'day' },
    
    // Flooring & Surface Equipment
    { keywords: ['carpet', 'cleaners', 'extractors'], title: 'Carpet Cleaners & Extractors', sku: '111117', price: 65.95, unit: 'day' },
    { keywords: ['floor', 'strippers', 'scrapers', 'manual'], title: 'Floor Strippers & Scrapers Manual/Powered', sku: '111118', price: 55.95, unit: 'day' },
    { keywords: ['hardwood', 'floor', 'sanders', 'edgers'], title: 'Hardwood Floor Sanders & Edgers', sku: '111119', price: 85.95, unit: 'day' },
    { keywords: ['surface', 'scarifiers', 'shot', 'blasters'], title: 'Surface Scarifiers & Shot Blasters', sku: '111120', price: 145.95, unit: 'day' },
    { keywords: ['epoxy', 'floor', 'coating', 'systems'], title: 'Epoxy Floor Coating Systems Sprayers/Rollers', sku: '111121', price: 125.95, unit: 'day' },
    
    // Landscaping & Grounds Equipment
    { keywords: ['sod', 'cutters', 'gas', 'powered'], title: 'Sod Cutters Gas-Powered', sku: '111122', price: 65.95, unit: 'day' },
    { keywords: ['lawn', 'rollers', 'aerators'], title: 'Lawn Rollers & Aerators', sku: '111123', price: 45.95, unit: 'day' },
    { keywords: ['overseeders', 'dethatchers'], title: 'Overseeders & Dethatchers', sku: '111124', price: 55.95, unit: 'day' },
    { keywords: ['stump', 'grinders'], title: 'Stump Grinders', sku: '111125', price: 185.95, unit: 'day' },
    { keywords: ['log', 'splitters'], title: 'Log Splitters', sku: '111126', price: 85.95, unit: 'day' },
    { keywords: ['brush', 'cutters', 'clearing', 'saws'], title: 'Brush Cutters & Clearing Saws', sku: '111127', price: 75.95, unit: 'day' },
    { keywords: ['string', 'trimmers', 'edgers'], title: 'String Trimmers & Edgers', sku: '111128', price: 35.95, unit: 'day' },
    { keywords: ['lawn', 'mowers', 'walk', 'behind', 'zero'], title: 'Lawn Mowers Walk-Behind/Zero-Turn', sku: '111129', price: 65.95, unit: 'day' },
    { keywords: ['tillers', 'cultivators'], title: 'Tillers & Cultivators', sku: '111130', price: 55.95, unit: 'day' },
    { keywords: ['wood', 'chippers', '6', '12', 'capacity'], title: 'Wood Chippers 6-12 Inch Capacity', sku: '111131', price: 125.95, unit: 'day' },
    { keywords: ['pressure', 'washers', 'electric', 'gas'], title: 'Pressure Washers Electric/Gas Cold/Hot Water', sku: '111132', price: 55.95, unit: 'day' },
    { keywords: ['water', 'pumps', 'trash', 'utility'], title: 'Water Pumps Trash/Utility/Dewatering', sku: '111133', price: 65.95, unit: 'day' },
    { keywords: ['compact', 'trenchers', 'ditchers'], title: 'Compact Trenchers & Ditchers', sku: '111134', price: 125.95, unit: 'day' },
    { keywords: ['leaf', 'blowers', 'vacuums'], title: 'Leaf Blowers & Vacuums', sku: '111135', price: 35.95, unit: 'day' },
    
    // Climate Control & Environmental Equipment
    { keywords: ['heaters', 'propane', 'kerosene', 'diesel'], title: 'Heaters Propane/Kerosene/Diesel/Electric', sku: '111136', price: 55.95, unit: 'day' },
    { keywords: ['fans', 'box', 'high', 'velocity', 'drum'], title: 'Fans Box/High-Velocity/Drum', sku: '111137', price: 35.95, unit: 'day' },
    { keywords: ['dehumidifiers', 'industrial', 'compact'], title: 'Dehumidifiers Industrial/Compact', sku: '111138', price: 65.95, unit: 'day' },
    { keywords: ['air', 'scrubbers', 'dust', 'control'], title: 'Air Scrubbers Dust Control/HEPA Filtration', sku: '111139', price: 125.95, unit: 'day' },
    { keywords: ['portable', 'ac', 'units', 'spot', 'coolers'], title: 'Portable AC Units Spot Coolers', sku: '111140', price: 85.95, unit: 'day' },
    { keywords: ['evaporative', 'coolers', 'swamp', 'coolers'], title: 'Evaporative Coolers Swamp Coolers', sku: '111141', price: 65.95, unit: 'day' },
    { keywords: ['dust', 'collection', 'systems', 'vacuum'], title: 'Dust Collection Systems Vacuum-Based', sku: '111142', price: 95.95, unit: 'day' },
    { keywords: ['ventilation', 'ducts', 'fans'], title: 'Ventilation Ducts & Fans', sku: '111143', price: 45.95, unit: 'day' },
    
    // Safety & Site Infrastructure
    { keywords: ['traffic', 'cones', 'barriers', 'barricades'], title: 'Traffic Cones/Barriers/Barricades', sku: '111144', price: 25.95, unit: 'day' },
    { keywords: ['safety', 'lighting', 'warning', 'beacons'], title: 'Safety Lighting & Warning Beacons', sku: '111145', price: 35.95, unit: 'day' },
    { keywords: ['temporary', 'guardrails', 'fall', 'protection'], title: 'Temporary Guardrails & Fall-Protection', sku: '111146', price: 65.95, unit: 'day' },
    { keywords: ['jobsite', 'first', 'aid', 'stations'], title: 'Jobsite First-Aid Stations', sku: '111147', price: 45.95, unit: 'day' },
    { keywords: ['fire', 'extinguishers', 'a', 'b', 'c'], title: 'Fire Extinguishers A/B/C Rated', sku: '111148', price: 35.95, unit: 'day' },
    { keywords: ['spill', 'containment', 'kits'], title: 'Spill Containment Kits', sku: '111149', price: 55.95, unit: 'day' },
    { keywords: ['noise', 'dust', 'control', 'fencing'], title: 'Noise & Dust Control Fencing', sku: '111150', price: 75.95, unit: 'day' },
    { keywords: ['ppe', 'vending', 'stations', 'gloves'], title: 'PPE Vending Stations Gloves/Masks/Eyewear', sku: '111151', price: 85.95, unit: 'day' },
    
    // Heavy Equipment Attachments
    { keywords: ['buckets', 'tooth', 'smooth', 'grading'], title: 'Buckets Tooth/Smooth/Grading', sku: '111152', price: 95.95, unit: 'day' },
    { keywords: ['hydraulic', 'breakers', 'hammers'], title: 'Hydraulic Breakers & Hammers', sku: '111153', price: 145.95, unit: 'day' },
    { keywords: ['auger', 'drives', 'bits'], title: 'Auger Drives & Bits', sku: '111154', price: 85.95, unit: 'day' },
    { keywords: ['grapples', 'pallet', 'forks', 'bale'], title: 'Grapples/Pallet Forks/Bale Spears', sku: '111155', price: 125.95, unit: 'day' },
    { keywords: ['landscape', 'rakes', 'harley', 'rakes'], title: 'Landscape Rakes & Harley Rakes', sku: '111156', price: 105.95, unit: 'day' },
    { keywords: ['brush', 'cutters', 'mower', 'attachments'], title: 'Brush Cutters/Mower Attachments', sku: '111157', price: 95.95, unit: 'day' },
    { keywords: ['concrete', 'mixers', 'trenching', 'buckets'], title: 'Concrete Mixers & Trenching Buckets', sku: '111158', price: 115.95, unit: 'day' },
    { keywords: ['hydraulic', 'thumbs', 'excavators'], title: 'Hydraulic Thumbs for Excavators', sku: '111159', price: 125.95, unit: 'day' },
    
    // Heavy Equipment Brands
    { keywords: ['cat', 'caterpillar', 'equipment'], title: 'CAT/Caterpillar Equipment', sku: '111160', price: 385.95, unit: 'day' },
    { keywords: ['john', 'deere', 'equipment'], title: 'John Deere Equipment', sku: '111161', price: 325.95, unit: 'day' },
    { keywords: ['bobcat', 'equipment'], title: 'Bobcat Equipment', sku: '111162', price: 285.95, unit: 'day' },
    { keywords: ['kubota', 'equipment'], title: 'Kubota Equipment', sku: '111163', price: 295.95, unit: 'day' },
    { keywords: ['toro', 'equipment'], title: 'Toro Equipment', sku: '111164', price: 185.95, unit: 'day' },
    { keywords: ['wacker', 'neuson', 'equipment'], title: 'Wacker Neuson Equipment', sku: '111165', price: 245.95, unit: 'day' },
    { keywords: ['husqvarna', 'equipment'], title: 'Husqvarna Equipment', sku: '111166', price: 165.95, unit: 'day' },
    { keywords: ['makita', 'tools'], title: 'Makita Tools', sku: '111167', price: 65.95, unit: 'day' },
    { keywords: ['dewalt', 'tools'], title: 'DeWalt Tools', sku: '111168', price: 65.95, unit: 'day' },
    { keywords: ['milwaukee', 'tools'], title: 'Milwaukee Tools', sku: '111169', price: 75.95, unit: 'day' },
    { keywords: ['bosch', 'tools'], title: 'Bosch Tools', sku: '111170', price: 65.95, unit: 'day' },
    { keywords: ['hilti', 'tools'], title: 'Hilti Tools', sku: '111171', price: 85.95, unit: 'day' },
    { keywords: ['multiquip', 'equipment'], title: 'Multiquip Equipment', sku: '111172', price: 195.95, unit: 'day' },
    { keywords: ['genie', 'lifts'], title: 'Genie Lifts', sku: '111173', price: 225.95, unit: 'day' },
    { keywords: ['skyjack', 'lifts'], title: 'Skyjack Lifts', sku: '111174', price: 215.95, unit: 'day' },
    { keywords: ['jlg', 'lifts'], title: 'JLG Lifts', sku: '111175', price: 235.95, unit: 'day' },
    { keywords: ['bil', 'jax', 'scaffolding'], title: 'Bil-Jax Scaffolding', sku: '111176', price: 85.95, unit: 'day' },
    { keywords: ['husky', 'tools'], title: 'Husky Tools', sku: '111177', price: 45.95, unit: 'day' },
    { keywords: ['ridgid', 'tools'], title: 'RIDGID Tools', sku: '111178', price: 55.95, unit: 'day' },
    { keywords: ['simpson', 'equipment'], title: 'Simpson Equipment', sku: '111179', price: 85.95, unit: 'day' },
    { keywords: ['mi', 't', 'm', 'equipment'], title: 'Mi-T-M Equipment', sku: '111180', price: 165.95, unit: 'day' },
    { keywords: ['ramset', 'tools'], title: 'Ramset Tools', sku: '111181', price: 75.95, unit: 'day' },
    { keywords: ['werner', 'ladders'], title: 'Werner Ladders', sku: '111182', price: 35.95, unit: 'day' },
    { keywords: ['honda', 'power', 'equipment'], title: 'Honda Power Equipment', sku: '111183', price: 125.95, unit: 'day' },
  ];
  
  // Enhanced search logic for better category matching
  function isRelevantResult(item, query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // If query is a single word, require exact match or strong category relevance
    if (queryWords.length === 1) {
      const singleQuery = queryWords[0];
      
      // Category-specific matching for better precision
      if (singleQuery === 'doors') {
        return item.keywords.some(kw => 
          ['doors', 'door', 'hinges', 'knobs', 'handles', 'locks', 'deadbolts', 'hardware', 'trim', 'moulding'].includes(kw)
        ) && item.title.toLowerCase().includes('door');
      }
      
      if (singleQuery === 'windows') {
        return item.keywords.some(kw => 
          ['windows', 'window', 'skylights', 'skylight', 'glass', 'casement', 'hung', 'sliding', 'vinyl', 'aluminum', 'wood'].includes(kw)
        ) && (item.title.toLowerCase().includes('window') || item.title.toLowerCase().includes('skylight'));
      }
      
      if (singleQuery === 'paint') {
        return item.keywords.some(kw => 
          ['paint', 'primer', 'stain', 'brush', 'roller', 'behr', 'kilz', 'zinsser', 'sherwin', 'benjamin', 'moore'].includes(kw)
        ) && (item.title.toLowerCase().includes('paint') || item.title.toLowerCase().includes('primer') || item.title.toLowerCase().includes('stain'));
      }
      
      if (singleQuery === 'plumbing') {
        return item.keywords.some(kw => 
          ['pipe', 'pex', 'copper', 'pvc', 'cpvc', 'abs', 'fitting', 'valve', 'faucet', 'toilet', 'sink', 'drain', 'water', 'heater'].includes(kw)
        ) && (item.title.toLowerCase().includes('pipe') || item.title.toLowerCase().includes('pex') || item.title.toLowerCase().includes('plumbing') || item.title.toLowerCase().includes('fitting') || item.title.toLowerCase().includes('valve'));
      }
      
      if (singleQuery === 'roofing') {
        return item.keywords.some(kw => 
          ['roof', 'shingle', 'tile', 'metal', 'asphalt', 'felt', 'underlayment', 'gutter', 'flashing', 'ridge', 'valley', 'drip', 'cap', 'ice', 'dam'].includes(kw)
        ) && (item.title.toLowerCase().includes('roof') || item.title.toLowerCase().includes('shingle') || item.title.toLowerCase().includes('gutter') || item.title.toLowerCase().includes('flashing') || item.title.toLowerCase().includes('asphalt') || item.title.toLowerCase().includes('underlayment') || item.title.toLowerCase().includes('ridge') || item.title.toLowerCase().includes('valley'));
      }
      
      if (singleQuery === 'tile') {
        return item.keywords.some(kw => 
          ['tile', 'thinset', 'grout', 'backer', 'hardiebacker', 'durock', 'porcelain', 'ceramic', 'marble', 'subway', 'mosaic'].includes(kw)
        ) && (item.title.toLowerCase().includes('tile') || item.title.toLowerCase().includes('thinset') || item.title.toLowerCase().includes('grout'));
      }
      
      if (singleQuery === 'flooring') {
        return item.keywords.some(kw => 
          ['floor', 'flooring', 'lvp', 'lvt', 'laminate', 'hardwood', 'carpet', 'vinyl', 'pergo', 'lifeproof', 'bruce'].includes(kw)
        ) && (item.title.toLowerCase().includes('floor') || item.title.toLowerCase().includes('lvp') || item.title.toLowerCase().includes('laminate') || item.title.toLowerCase().includes('hardwood') || item.title.toLowerCase().includes('carpet'));
      }
      
      if (singleQuery === 'lumber') {
        return item.keywords.some(kw => 
          ['lumber', 'wood', 'board', 'plank', 'beam', 'stud', '2x4', '2x6', '2x8', '2x10', '2x12', 'plywood', 'osb'].includes(kw)
        ) && (item.title.toLowerCase().includes('lumber') || item.title.toLowerCase().includes('wood') || item.title.toLowerCase().includes('board') || item.title.toLowerCase().includes('plywood'));
      }
      
      if (singleQuery === 'electrical') {
        return item.keywords.some(kw => 
          ['wire', 'cable', 'outlet', 'switch', 'breaker', 'panel', 'conduit', 'box', 'electrical', 'romex', 'thhn', 'gfci', 'afci'].includes(kw)
        ) && (item.title.toLowerCase().includes('wire') || item.title.toLowerCase().includes('cable') || item.title.toLowerCase().includes('outlet') || item.title.toLowerCase().includes('switch') || item.title.toLowerCase().includes('electrical') || item.title.toLowerCase().includes('conduit'));
      }
      
      if (singleQuery === 'hvac') {
        return item.keywords.some(kw => 
          ['duct', 'vent', 'register', 'diffuser', 'hvac', 'air', 'conditioning', 'heating', 'furnace', 'thermostat', 'damper', 'filter'].includes(kw)
        ) && (item.title.toLowerCase().includes('duct') || item.title.toLowerCase().includes('vent') || item.title.toLowerCase().includes('hvac') || item.title.toLowerCase().includes('register') || item.title.toLowerCase().includes('thermostat'));
      }
      
      if (singleQuery === 'hardware') {
        return item.keywords.some(kw => 
          ['hardware', 'hinge', 'knob', 'handle', 'lock', 'deadbolt', 'screw', 'bolt', 'nut', 'washer', 'anchor', 'fastener', 'bracket', 'clip'].includes(kw)
        ) && (item.title.toLowerCase().includes('hardware') || item.title.toLowerCase().includes('hinge') || item.title.toLowerCase().includes('knob') || item.title.toLowerCase().includes('handle') || item.title.toLowerCase().includes('lock') || item.title.toLowerCase().includes('screw') || item.title.toLowerCase().includes('bolt') || item.title.toLowerCase().includes('anchor') || item.title.toLowerCase().includes('bracket'));
      }
      
      if (singleQuery === 'tools') {
        return item.keywords.some(kw => 
          ['tool', 'drill', 'saw', 'hammer', 'screwdriver', 'level', 'tape', 'measure', 'wrench', 'pliers', 'knife', 'cutter', 'clamp'].includes(kw)
        ) && (item.title.toLowerCase().includes('tool') || item.title.toLowerCase().includes('drill') || item.title.toLowerCase().includes('saw') || item.title.toLowerCase().includes('hammer') || item.title.toLowerCase().includes('level') || item.title.toLowerCase().includes('wrench') || item.title.toLowerCase().includes('pliers'));
      }
      
      // For other single-word searches, use original logic but require the keyword to be more prominent
      return item.keywords.some(kw => kw === singleQuery) || 
             (item.keywords.some(kw => kw.includes(singleQuery)) && item.title.toLowerCase().includes(singleQuery));
    }
    
    // For multi-word searches, require at least one keyword to match
    return queryWords.some(queryWord => 
      item.keywords.some(kw => kw.includes(queryWord)) || 
      item.title.toLowerCase().includes(queryWord)
    );
  }

  mockCatalog.forEach(item => {
    if (isRelevantResult(item, q)) {
      // Adjust price slightly based on store and add some variation
      let price = item.price;
      if (store === 'lowes') {
        price = price * 0.97; // Lowes typically 3% cheaper
      } else {
        price = price * 1.02; // Home Depot slight premium
      }
      
      // Add some ZIP-based variation (mock regional pricing)
      const zipFactor = parseInt(zip.substring(0, 2)) / 100; // 0.89 for 89011
      price = price * (0.95 + zipFactor * 0.1); // 5-15% variation
      
      const storePrefix = store === 'hd' ? 'HD' : 'LW';
      const storeDomain = store === 'hd' ? 'homedepot' : 'lowes';
      
      // Generate different URL formats for each store
      // IMPORTANT: Use product detail page URLs (not search) so we can fetch real product images
      let url;
      if (store === 'hd') {
        // Check if this is rental equipment (SKU starts with 111)
        if (item.sku.startsWith('111')) {
          // Rental equipment goes to Home Depot rental home page
          url = `https://www.homedepot.com/c/tool-and-equipment-rental?mtc=SEM-BF-RNT-GGL-D78-Multi-NA-NA-NA-RSA-NA-NA-NA-NA-BT2-NA-NA-NA-G_B_THDR_CBT_PACIFIC_CENTRAL_E&cm_mmc=SEM-BF-RNT-GGL-D78-Multi-NA-NA-NA-RSA-NA-NA-NA-NA-BT2-NA-NA-NA-G_B_THDR_CBT_PACIFIC_CENTRAL_E-21840555486-166308936461-648417965&gclsrc=aw.ds&gad_source=1&gad_campaignid=21840555486&gbraid=0AAAAADq61UeHHTaozilRdZoCn5TyiRd1S&gclid=Cj0KCQjwrojHBhDdARIsAJdEJ_crp1-4as_AILwjmcTATl2jYi293U34Zy5OPrSnNM1DxUdXGhtNeHwaAh78EALw_wcB`;
        } else {
          // Try to construct product detail page URL from SKU (format: /p/HD-XXXXXX or /p/XXXXXX)
          // Extract numeric part of SKU
          const skuNumber = item.sku.replace(/\D/g, '');
          if (skuNumber && skuNumber.length >= 5) {
            // Home Depot product detail URL format: /p/{model-number}
            // We'll try with the SKU number
            url = `https://www.homedepot.com/p/HD-${skuNumber}`;
          } else {
            // Fallback to search if SKU format doesn't work
            url = `https://www.homedepot.com/s/${encodeURIComponent(item.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' '))}`;
          }
        }
      } else {
        // Lowe's: Try product detail URL format /p/{product-id}
        const skuNumber = item.sku.replace(/\D/g, '');
        if (skuNumber && skuNumber.length >= 4) {
          url = `https://www.lowes.com/p/${skuNumber}`;
        } else {
          // Fallback to search
          url = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(item.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' '))}`;
        }
      }
      
      // Don't try to construct image URLs from SKU patterns - they're unreliable
      // Home Depot uses GUID-based URLs, and constructed patterns often return 404
      // Instead, we'll fetch images from product pages for all results
      // Set imageUrl to null initially - will be fetched later from product pages
      let imageUrl = null;
      
      // For Lowe's, we can try the pattern as it's more reliable
      if (store === 'lowes') {
        const productId = item.sku && typeof item.sku === 'string' ? item.sku.replace(/\D/g, '') : String(item.sku || '').replace(/\D/g, '');
        if (productId && productId.length >= 4) {
          // Lowes product images pattern (more reliable than HD)
          imageUrl = `https://mobileimages.lowes.com/productimages/${productId}/0.jpg`;
        }
        
        // Also try from URL if still no image
        if (!imageUrl && url && url.includes('lowes.com')) {
          const urlProductId = url.match(/\/p\/([^\/\?]+)/)?.[1] || 
                               url.match(/productId=(\d+)/)?.[1];
          if (urlProductId) {
            imageUrl = `https://mobileimages.lowes.com/productimages/${urlProductId}/0.jpg`;
          }
        }
      }
      
      // Don't use placeholder images upfront - fetch REAL product images from product detail pages
      // Placeholders will only be used as fallback if image fetching fails (handled later)
      // imageUrl remains null here, will be fetched from product detail pages
      
      const resultItem = {
        sku: `${storePrefix}-${item.sku}`,
        title: item.title,
        price: item.sku.startsWith('111') ? null : Math.round(price * 100) / 100, // No pricing for rental equipment
        unit: item.unit,
        url: url,
        store,
        zip,
        image: imageUrl
      };
      
      // Log first few results with image URLs for debugging
      if (results.length < 3) {
        console.log(`📸 Image URL for ${item.title}: ${imageUrl || 'NONE (will try to fetch from product page)'}`);
      }
      
      results.push(resultItem);
    }
  });
  
  // Limit results to top 50 most relevant (increased for comprehensive tile searches)
  // Apply smart sorting to prioritize common items
  const sortedResults = scoreAndSortResults(results, query);
  const limitedResults = sortedResults.slice(0, 50);

  // For mock data results, fetch REAL product images from product detail pages
  // Fetch for first 20 results to get more product images
  // ALL items need images since we're not using placeholders anymore
  if (limitedResults.length > 0) {
    // Filter results that need images - prioritize product detail page URLs
    const resultsNeedingImages = limitedResults.slice(0, 20).filter(r => {
      const needsImage = (!r.image || r.image === null || r.image === '');
      const hasValidUrl = r.url && r.url.includes('http');
      // Prioritize product detail page URLs (contain /p/) over search URLs
      const isProductPage = r.url.includes('/p/');
      return hasValidUrl && (needsImage || isProductPage);
    });
    
    if (resultsNeedingImages.length > 0) {
      console.log(`🖼️ Fetching ${resultsNeedingImages.length} REAL product images from product detail pages...`);
      
      // Fetch images in parallel batches (3 at a time) for better performance
      const batchSize = 3;
      for (let i = 0; i < resultsNeedingImages.length; i += batchSize) {
        const batch = resultsNeedingImages.slice(i, i + batchSize);
        const imagePromises = batch.map(async (result) => {
          try {
            const productImage = await fetchProductImage(result.url, result.store, result.title || '');
            if (productImage) {
              result.image = productImage;
              console.log(`✅ Found REAL product image for ${result.title.substring(0, 30)} (${result.store})`);
            } else {
              // No fake thumbnails — leave null so the app can try SKU-based CDN URLs client-side
              result.image = null;
              console.log(`⚠️ No product image for ${result.title.substring(0, 30)} (client may still try CDN from SKU)`);
            }
          } catch (error) {
            result.image = null;
            console.log(`⚠️ Error fetching image for ${result.title.substring(0, 30)}: ${error.message}`);
          }
        });
        // Wait for batch to complete before starting next batch
        await Promise.allSettled(imagePromises);
      }
    }
  }
  
  return limitedResults;
}

/**
 * Pull a Home Depot product image URL from HTML (PDP, search, or embedded JSON).
 */
function extractHomeDepotProductImageFromHtml(html) {
  if (!html || typeof html !== 'string') return null;

  const directImagePattern =
    /https:\/\/images\.(?:homedepot-static|thdstatic)\.com\/productImages\/[^"'\s<>]+\.(?:jpg|jpeg|webp)/gi;
  const rawMatches = html.match(directImagePattern) || [];
  const directMatches = [...new Set(rawMatches)];
  if (directMatches.length > 0) {
    const thumbish = (u) => /thumb|small|icon|35x35|50x50|sprite/i.test(u);
    directMatches.sort((a, b) => (thumbish(a) ? 1 : 0) - (thumbish(b) ? 1 : 0));
    return directMatches[0];
  }

  const productImagePatterns = [
    /"imageUrl"\s*:\s*"([^"]+)"/gi,
    /"primaryImageUrl"\s*:\s*"([^"]+)"/gi,
    /data-image-url="([^"]+)"/gi,
    /<img[^>]+src="(https:\/\/images\.(?:homedepot-static|thdstatic)\.com[^"]+)"/gi,
  ];

  for (const pattern of productImagePatterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      let imageUrl = match[1] || match[0];
      if (!imageUrl) continue;
      imageUrl = imageUrl.replace(/\\\//g, '/').replace(/\\u002F/g, '/');
      if (
        (imageUrl.includes('homedepot-static.com') || imageUrl.includes('thdstatic.com')) &&
        /\.(jpg|jpeg|png|webp)/i.test(imageUrl)
      ) {
        return imageUrl;
      }
    }
  }

  const ldIter = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of ldIter) {
    try {
      const jsonData = JSON.parse(m[1]);
      const nodes = Array.isArray(jsonData) ? jsonData : [jsonData];
      for (const node of nodes) {
        const img = node?.image;
        if (typeof img === 'string' && (img.includes('homedepot-static') || img.includes('thdstatic'))) return img;
        if (Array.isArray(img) && img.length) {
          const first = img[0];
          const u = typeof first === 'string' ? first : first?.url;
          if (u && (u.includes('homedepot-static') || u.includes('thdstatic'))) return u;
        }
      }
    } catch (e) {
      /* next script */
    }
  }

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogImageMatch?.[1]) {
    const og = ogImageMatch[1].replace(/&amp;/g, '&');
    if (og.includes('homedepot-static.com/productImages') || og.includes('thdstatic.com/productImages')) return og;
  }

  return null;
}

/**
 * Verify that a CDN URL returns a real image (not HTML error page).
 */
async function verifyHomeDepotImageUrl(url) {
  try {
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 6000,
      maxContentLength: 800000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.homedepot.com/',
      },
      validateStatus: (s) => s === 200,
    });
    const len = r.data?.length || 0;
    if (len < 400) return null;
    const ct = String(r.headers['content-type'] || '');
    if (ct.includes('text/html')) return null;
    return url;
  } catch (e) {
    return null;
  }
}

/**
 * Try standard homedepot-static path patterns for a numeric internet item id.
 */
async function tryHomeDepotCdnFromItemId(itemId) {
  if (!itemId || String(itemId).length < 6) return null;
  const id = String(itemId);
  const first2 = id.substring(0, 2);
  const next2 = id.substring(2, 4);
  const candidates = [
    `https://images.homedepot-static.com/productImages/${first2}/${next2}/${id}/sd/${id}.jpg`,
    `https://images.homedepot-static.com/productImages/${first2}/${next2}/${id}/lg/${id}.jpg`,
    `https://images.homedepot-static.com/productImages/${first2}/${next2}/${id}/hd/${id}.jpg`,
    `https://images.homedepot-static.com/productImages/${id}/sd/${id}.jpg`,
  ];
  for (const u of candidates) {
    const ok = await verifyHomeDepotImageUrl(u);
    if (ok) return u;
  }
  return null;
}

/**
 * Fetch product image: try PDP, then title-based search (HD), then verified CDN from item id.
 * @param {string} titleHint - Product title for HD search when PDP has no embed (mock catalog).
 */
async function fetchProductImage(productUrl, store, titleHint = '') {
  if (!productUrl || !productUrl.includes('http')) {
    return null;
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const fetchHtml = async (url) => {
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
      maxRedirects: 5,
    });
    return typeof response.data === 'string' ? response.data : null;
  };

  try {
    if (store === 'hd') {
      const itemIdMatch = productUrl.match(/\/p\/HD-(\d+)/i) || productUrl.match(/HD-(\d{6,})/i);
      const itemId = itemIdMatch ? itemIdMatch[1] : null;

      try {
        const html = await fetchHtml(productUrl);
        const fromPdp = html ? extractHomeDepotProductImageFromHtml(html) : null;
        if (fromPdp) return fromPdp;
      } catch (e) {
        /* PDP may 404 or block */
      }

      const hint = String(titleHint || '').trim();
      if (hint.length >= 3) {
        const words = hint.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 10);
        const searchTerm = words.join(' ');
        if (searchTerm.length >= 3) {
          try {
            const searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(searchTerm)}`;
            const html = await fetchHtml(searchUrl);
            const fromSearch = html ? extractHomeDepotProductImageFromHtml(html) : null;
            if (fromSearch) return fromSearch;
          } catch (e) {
            /* search failed */
          }
          try {
            const mobileUrl = `https://m.homedepot.com/s/${encodeURIComponent(searchTerm)}`;
            const mHtml = await fetchHtml(mobileUrl);
            const fromMobile = mHtml ? extractHomeDepotProductImageFromHtml(mHtml) : null;
            if (fromMobile) return fromMobile;
          } catch (e) {
            /* mobile search failed */
          }
        }
      }

      if (itemId) {
        const fromCdn = await tryHomeDepotCdnFromItemId(itemId);
        if (fromCdn) return fromCdn;
      }

      return null;
    }

    if (store === 'lowes') {
      const html = await fetchHtml(productUrl);
      if (!html) return null;

      const ldIter = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of ldIter) {
        try {
          const jsonData = JSON.parse(m[1]);
          const node = Array.isArray(jsonData) ? jsonData[0] : jsonData;
          const img = node?.image;
          if (typeof img === 'string') return img;
          if (Array.isArray(img) && img[0]) return typeof img[0] === 'string' ? img[0] : img[0]?.url;
        } catch (e) {
          /* continue */
        }
      }

      const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (ogImageMatch?.[1]) return ogImageMatch[1].replace(/&amp;/g, '&');
    }

    return null;
  } catch (error) {
    console.log(`⚠️ Image fetch error for ${productUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Image proxy endpoint - fetches images from external URLs and serves them
 * This bypasses CORS and security restrictions in React Native
 * GET /api/sku/image-proxy?url=https://encrypted-tbn...
 */
router.get('/image-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    // Validate URL
    let imageUrl;
    try {
      imageUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    // Only allow certain domains for security
    const allowedDomains = [
      'encrypted-tbn.gstatic.com',
      'encrypted-tbn0.gstatic.com',
      'encrypted-tbn1.gstatic.com',
      'encrypted-tbn2.gstatic.com',
      'encrypted-tbn3.gstatic.com',
      'images.homedepot-static.com',
      'images.thdstatic.com',
      'thdstatic.com',
      'mobileimages.lowes.com',
      'www.homedepot.com',
      'www.lowes.com',
      'homedepot.com',
      'lowes.com',
      'placehold.co', // Allow placeholder images for mock data
      'lh3.googleusercontent.com', // Google Shopping images
      'googleusercontent.com', // Google images
      'serpapi.com', // SerpAPI image sources
      'webscrapingapi.com', // WebScrapingAPI image sources
    ];
    
    const isAllowed = allowedDomains.some(domain => imageUrl.hostname.includes(domain));
    if (!isAllowed) {
      console.warn(`🚫 Image proxy blocked domain: ${imageUrl.hostname} for URL: ${url.substring(0, 100)}`);
      console.warn(`🚫 Allowed domains: ${allowedDomains.join(', ')}`);
      return res.status(403).json({ 
        error: 'Domain not allowed',
        domain: imageUrl.hostname,
        allowedDomains: allowedDomains
      });
    }
    
    const referer =
      imageUrl.hostname.includes('homedepot-static.com') ||
      imageUrl.hostname.includes('thdstatic.com') ||
      imageUrl.hostname.includes('homedepot.com')
        ? 'https://www.homedepot.com/'
        : imageUrl.hostname.includes('lowes.com')
          ? 'https://www.lowes.com/'
          : 'https://www.google.com/';

    // Fetch the image
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*',
        Referer: referer,
      },
      timeout: 10000,
    });
    
    // Set appropriate headers
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Send the image data
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    console.error('❌ Failed URL:', url);
    console.error('❌ Error details:', error.response?.status, error.response?.statusText);
    res.status(500).json({ 
      error: 'Failed to fetch image',
      message: error.message,
      url: url.substring(0, 200) // Log first 200 chars of URL for debugging
    });
  }
});

module.exports = router;
