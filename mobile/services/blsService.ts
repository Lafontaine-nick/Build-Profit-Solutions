import Constants from 'expo-constants';

// Get base URL and ensure it doesn't have /api suffix (we'll add it in the endpoints)
const getApiBaseUrl = () => {
  const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 
                  process.env.EXPO_PUBLIC_API_BASE_URL || 
                  'https://build-profit-solutions-backend.onrender.com';
  
  // Remove /api suffix if present, we'll add it back in the fetch calls
  return baseUrl.replace(/\/api$/, '');
};

const API_BASE_URL = getApiBaseUrl();

// Log the API base URL for debugging
console.log('📡 BLS Service initialized with API URL:', API_BASE_URL);

export interface BLSLaborRates {
  carpenters: number;
  electricians: number;
  plumbers: number;
  painters: number;
  laborers: number;
  equipment_operators: number;
}

export interface BLSMarketAnalysis {
  regionalMultiplier: number;
  adjustedRates: {
    min: number;
    max: number;
    avg: number;
  };
  competitivenessScore: 'competitive' | 'moderate' | 'aggressive';
  avgLaborRate: number;
  marketTrend: 'rising' | 'stable' | 'declining';
}

export interface BLSResponse {
  location: string;
  data: BLSLaborRates;
  source: 'bls_api' | 'mock';
  lastUpdated: string;
}

export interface MarketAnalysisResponse {
  location: string;
  projectType: string;
  analysis: BLSMarketAnalysis;
  laborRates: BLSLaborRates;
  lastUpdated: string;
}

/**
 * Fetch labor rates for a specific location from BLS API
 */
export async function fetchLaborRates(location: string): Promise<BLSResponse> {
  try {
    const cleanLocation = location.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, '_');
    const url = `${API_BASE_URL}/api/bls/labor-rates/${cleanLocation}`;
    
    console.log('🔍 Fetching BLS labor rates from:', url);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ BLS API returned status ${response.status}, using fallback data`);
      throw new Error(`BLS API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ BLS labor rates fetched successfully:', data.source);
    return data;
  } catch (error) {
    console.warn('⚠️ Error fetching BLS labor rates, using fallback:', error);
    // Return fallback data
    return {
      location,
      data: {
        carpenters: 28.50,
        electricians: 32.75,
        plumbers: 30.25,
        painters: 24.80,
        laborers: 22.15,
        equipment_operators: 26.90,
      },
      source: 'mock',
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Fetch market analysis for a specific location and project type
 */
export async function fetchMarketAnalysis(
  location: string,
  projectType: string
): Promise<MarketAnalysisResponse> {
  try {
    const cleanLocation = location.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, '_');
    const cleanProjectType = projectType.toLowerCase().replace(/\s+/g, '_');
    const url = `${API_BASE_URL}/api/bls/market-analysis/${cleanLocation}/${cleanProjectType}`;
    
    console.log('🔍 Fetching market analysis from:', url);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ Market analysis API returned status ${response.status}, using fallback`);
      throw new Error(`Market analysis API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Market analysis fetched successfully');
    return data;
  } catch (error) {
    console.warn('⚠️ Error fetching market analysis, using fallback:', error);
    // Return fallback data
    const laborRates = await fetchLaborRates(location);
    return {
      location,
      projectType,
      analysis: {
        regionalMultiplier: 1.0,
        adjustedRates: {
          min: 85,
          max: 140,
          avg: 112,
        },
        competitivenessScore: 'moderate',
        avgLaborRate: 28.5,
        marketTrend: 'stable',
      },
      laborRates: laborRates.data,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Map project type to BLS-compatible format
 */
export function mapProjectTypeToBLS(projectType: string): string {
  const mapping: Record<string, string> = {
    'kitchen': 'kitchen_remodel',
    'bathroom': 'bathroom_remodel',
    'hvac': 'home_renovation',
    'roofing': 'home_renovation',
    'electrical': 'home_renovation',
    'flooring': 'home_renovation',
    'painting': 'home_renovation',
    'landscaping': 'home_renovation',
    'addition': 'addition',
    'new_build': 'new_build',
  };

  return mapping[projectType.toLowerCase()] || 'home_renovation';
}

/**
 * Calculate average labor rate from BLS data
 */
export function calculateAverageLaborRate(laborRates: BLSLaborRates): number {
  const rates = Object.values(laborRates);
  const sum = rates.reduce((acc, rate) => acc + rate, 0);
  return Math.round((sum / rates.length) * 100) / 100;
}

/**
 * Get labor rate for specific trade
 */
export function getLaborRateForTrade(
  laborRates: BLSLaborRates,
  projectType: string
): number {
  const tradeMapping: Record<string, keyof BLSLaborRates> = {
    'kitchen': 'carpenters',
    'bathroom': 'plumbers',
    'hvac': 'equipment_operators',
    'roofing': 'laborers',
    'electrical': 'electricians',
    'flooring': 'carpenters',
    'painting': 'painters',
    'landscaping': 'laborers',
  };

  const trade = tradeMapping[projectType.toLowerCase()] || 'laborers';
  return laborRates[trade];
}

