import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNetworkInfo, logNetworkConfig } from './networkDetection';

/**
 * Smart API configuration that automatically detects the correct backend URL
 * based on platform and environment
 */
export const getApiBaseUrl = (): string => {
  const networkInfo = getNetworkInfo();
  return networkInfo.recommendedApiUrl;
};

/**
 * Get the current API base URL with debug logging
 */
export const getApiBaseUrlWithDebug = (): string => {
  const url = getApiBaseUrl();
  
  // Log detailed network configuration
  logNetworkConfig();
  
  console.log('🔧 API Configuration:', {
    selectedUrl: url,
    constants: Constants.expoConfig?.extra?.apiBaseUrl
  });
  
  return url;
};
