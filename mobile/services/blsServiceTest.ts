/**
 * BLS Service Connection Test
 * Run this to verify the BLS API integration is working
 */

import { fetchLaborRates, fetchMarketAnalysis } from './blsService';

export async function testBLSConnection() {
  console.log('🧪 Testing BLS Service Connection...\n');
  
  try {
    // Test 1: Fetch labor rates
    console.log('Test 1: Fetching labor rates for Las Vegas...');
    const laborRates = await fetchLaborRates('Las Vegas');
    console.log('✅ Labor Rates:', JSON.stringify(laborRates, null, 2));
    console.log(`   Source: ${laborRates.source}`);
    console.log(`   Carpenter Rate: $${laborRates.data.carpenters}/hr`);
    console.log(`   Electrician Rate: $${laborRates.data.electricians}/hr\n`);
    
    // Test 2: Fetch market analysis
    console.log('Test 2: Fetching market analysis for kitchen remodel in Las Vegas...');
    const marketAnalysis = await fetchMarketAnalysis('Las Vegas', 'kitchen');
    console.log('✅ Market Analysis:', JSON.stringify(marketAnalysis.analysis, null, 2));
    console.log(`   Avg Rate per Sq Ft: $${marketAnalysis.analysis.adjustedRates.avg}`);
    console.log(`   Market Trend: ${marketAnalysis.analysis.marketTrend}`);
    console.log(`   Competitiveness: ${marketAnalysis.analysis.competitivenessScore}\n`);
    
    console.log('🎉 All BLS Service tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ BLS Service test failed:', error);
    return false;
  }
}

// Auto-run test if this file is imported
testBLSConnection();





