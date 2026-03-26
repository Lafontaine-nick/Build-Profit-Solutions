// Simple API test to verify connectivity
import Constants from 'expo-constants';

/** Backend mounts routes under /api — avoid 404 when env URL is host-only (e.g. http://192.168.x.x:3001). */
const normalizeApiBaseUrl = (url: string): string => {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://build-profit-solutions-backend.onrender.com/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

/** Use for all mobile `fetch` calls to the Node backend (project-leads, marketplace, etc.). */
export const resolveMobileApiBaseUrl = (): string =>
  normalizeApiBaseUrl(
    Constants.expoConfig?.extra?.apiBaseUrl ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      'https://build-profit-solutions-backend.onrender.com/api'
  );

export const testApiConnection = async () => {
  const API_BASE_URL = resolveMobileApiBaseUrl();

  console.log('🧪 Testing API connection...');
  console.log('🧪 API_BASE_URL:', API_BASE_URL);
  
  try {
    // Test unified leads endpoint directly
    const leadsUrl = `${API_BASE_URL}/unified-leads/contractor/contractor-demo`;
    console.log('🧪 Testing leads endpoint:', leadsUrl);
    
    const leadsResponse = await fetch(leadsUrl, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store'
    });
    console.log('🧪 Leads response status:', leadsResponse.status);
    
    if (leadsResponse.ok) {
      const leadsData = await leadsResponse.json();
      console.log('🧪 Leads data count:', leadsData.leads?.length || 0);
      console.log('🧪 Leads data success:', leadsData.success);
      return leadsData.leads || [];
    } else {
      // HTTP error - return empty array instead of throwing
      const errorText = await leadsResponse.text();
      console.warn(`🧪 API returned HTTP ${leadsResponse.status}:`, errorText);
      return []; // Return empty array so app continues normally
    }
    
  } catch (error) {
    // Network errors are expected when backend is not running or not accessible
    // Return empty array instead of throwing to prevent error screens
    console.warn('🧪 API test failed (non-critical):', error instanceof Error ? error.message : error);
    return []; // Return empty array so app continues normally
  }
};
