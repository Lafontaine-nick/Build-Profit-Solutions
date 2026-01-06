#!/usr/bin/env node

/**
 * SKU Search Verification Script
 * 
 * Run this to verify your SKU search is properly configured:
 * node verify-sku-search.js
 */

require('dotenv').config();
const axios = require('axios');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifySKUSearch() {
  log('\n🔍 SKU Search Configuration Verification\n', 'blue');
  
  let allGood = true;
  
  // 1. Check API Keys
  log('1. Checking API Keys...', 'blue');
  const serpApiKey = process.env.SERPAPI_KEY;
  const webScrapingApiKey = process.env.WEBSCRAPINGAPI_KEY;
  
  if (serpApiKey && serpApiKey !== 'YOUR_SERPAPI_KEY_HERE') {
    log('   ✅ SerpAPI key is configured', 'green');
  } else {
    log('   ⚠️  SerpAPI key not configured (optional - free tier: 100 searches/month)', 'yellow');
    log('      Get one at: https://serpapi.com/', 'yellow');
  }
  
  if (webScrapingApiKey && webScrapingApiKey !== 'YOUR_WEBSCRAPINGAPI_KEY_HERE') {
    log('   ✅ WebScrapingAPI key is configured', 'green');
  } else {
    log('   ⚠️  WebScrapingAPI key not configured (optional)', 'yellow');
  }
  
  if (!serpApiKey || serpApiKey === 'YOUR_SERPAPI_KEY_HERE') {
    if (!webScrapingApiKey || webScrapingApiKey === 'YOUR_WEBSCRAPINGAPI_KEY_HERE') {
      log('   ❌ No API keys configured - will use mock data only!', 'red');
      allGood = false;
    }
  }
  
  // 2. Test backend is running
  log('\n2. Testing Backend Connection...', 'blue');
  try {
    const healthCheck = await axios.get('http://localhost:3001/health', { timeout: 3000 });
    if (healthCheck.data.status === 'OK') {
      log('   ✅ Backend is running', 'green');
    } else {
      log('   ⚠️  Backend responded but status is not OK', 'yellow');
      allGood = false;
    }
  } catch (error) {
    log('   ❌ Backend is not running!', 'red');
    log(`      Error: ${error.message}`, 'red');
    log('      Start it with: cd backend && npm start', 'yellow');
    allGood = false;
  }
  
  // 3. Test SKU Search Endpoint
  if (allGood) {
    log('\n3. Testing SKU Search Endpoint...', 'blue');
    try {
      const searchTest = await axios.get('http://localhost:3001/api/sku/search', {
        params: {
          store: 'hd',
          zip: '89109',
          q: 'lumber',
        },
        timeout: 15000, // 15 seconds for API calls
      });
      
      const results = searchTest.data.results || [];
      const metadata = searchTest.data.metadata || {};
      
      if (results.length > 0) {
        log(`   ✅ Search returned ${results.length} results`, 'green');
        
        // Check if real data or mock data
        if (metadata.isMockData) {
          log('   ⚠️  Results are MOCK DATA (estimated prices, placeholder images)', 'yellow');
          log('      This means APIs are not working or not configured', 'yellow');
          allGood = false;
        } else {
          log('   ✅ Results are REAL DATA from APIs', 'green');
        }
        
        // Check if images are present
        const withImages = results.filter(r => r.image && !r.image.includes('placehold'));
        if (withImages.length > 0) {
          log(`   ✅ ${withImages.length} products have real images`, 'green');
        } else {
          log('   ⚠️  No real product images found (only placeholders)', 'yellow');
        }
        
        // Show sample result
        if (results[0]) {
          log('\n   Sample Result:', 'blue');
          log(`      Title: ${results[0].title}`, 'reset');
          log(`      Price: $${results[0].price || 'N/A'}`, 'reset');
          log(`      Image: ${results[0].image ? '✅ Present' : '❌ Missing'}`, results[0].image ? 'green' : 'red');
          log(`      Data Source: ${metadata.dataSource || 'unknown'}`, 'reset');
        }
      } else {
        log('   ⚠️  Search returned no results', 'yellow');
      }
    } catch (error) {
      log('   ❌ SKU search failed', 'red');
      log(`      Error: ${error.message}`, 'red');
      allGood = false;
    }
  }
  
  // Summary
  log('\n' + '='.repeat(50), 'blue');
  if (allGood) {
    log('✅ ALL CHECKS PASSED - SKU Search is properly configured!', 'green');
    log('\nYour SKU search should work with:', 'green');
    log('  • Real product images from Home Depot/Lowe\'s', 'green');
    log('  • Actual current pricing', 'green');
    log('  • Real product data', 'green');
  } else {
    log('⚠️  SOME ISSUES FOUND - Review the warnings above', 'yellow');
    log('\nTo fix:', 'yellow');
    log('  1. Configure SerpAPI key in backend/.env:', 'yellow');
    log('     SERPAPI_KEY=your_key_here', 'yellow');
    log('  2. Restart backend: npm start', 'yellow');
    log('  3. Run this script again to verify', 'yellow');
  }
  log('='.repeat(50) + '\n', 'blue');
  
  process.exit(allGood ? 0 : 1);
}

verifySKUSearch().catch(error => {
  log(`\n❌ Verification failed: ${error.message}`, 'red');
  process.exit(1);
});
