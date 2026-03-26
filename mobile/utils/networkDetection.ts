import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

/**
 * Network detection utilities to prevent localhost connectivity issues
 * AUTO-DETECTS IP from Expo/Metro to prevent IP mismatch issues
 */

export interface NetworkInfo {
  isLocalhost: boolean;
  isSimulator: boolean;
  recommendedApiUrl: string;
  platform: string;
}

/**
 * Auto-detect the local network IP from Expo/Metro
 * This prevents IP mismatch issues when network changes
 */
function extractIpFromSource(src: string): string | null {
  const cleaned = String(src)
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .split(/[/?#]/)[0]
    .split(':')[0];

  if (
    cleaned &&
    (/^192\.168\./.test(cleaned) || /^10\./.test(cleaned) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(cleaned))
  ) {
    return cleaned;
  }

  return null;
}

function getAutoDetectedIP(): string | null {
  try {
    // Expo Go / Metro may expose values like:
    // - "192.168.0.11:8081"
    // - "exp://192.168.0.11:8081"
    // - "http://192.168.0.11:8081/index.bundle?platform=ios"
    const expoHost =
      (Constants as any)?.expoGoConfig?.debuggerHost ||
      (Constants as any)?.expoConfig?.hostUri ||
      (Constants as any)?.linkingUri ||
      "";

    // Plain React Native / Metro: scriptURL looks like
    // "http://192.168.0.11:8081/index.bundle?..."
    const rnURL = (NativeModules as any)?.SourceCode?.scriptURL || "";
    const sources = [expoHost, rnURL].filter(Boolean);

    for (const source of sources) {
      const ip = extractIpFromSource(source);
      if (ip) {
        return ip;
      }
    }

    return null;
  } catch (error) {
    console.warn('⚠️ Failed to auto-detect IP:', error);
    return null;
  }
}

/**
 * Detect if we're running in a simulator/emulator environment
 */
export const isSimulator = (): boolean => {
  if (Platform.OS === 'ios') {
    // iOS Simulator detection
    return !Constants.isDevice;
  }
  
  if (Platform.OS === 'android') {
    // Android Emulator detection
    return !Constants.isDevice;
  }
  
  return false;
};

/**
 * Get network information and recommended API URL
 * AUTO-DETECTS IP to prevent manual updates when network changes
 */
export const getNetworkInfo = (): NetworkInfo => {
  const isDev = __DEV__;
  const isSim = isSimulator();
  const isDevice = Constants.isDevice;
  
  let recommendedApiUrl: string;
  
  // AUTO-DETECT IP from Expo/Metro (prevents IP mismatch issues)
  const autoDetectedIP = getAutoDetectedIP();
  
  // Optional explicit override for physical devices when auto-detection fails.
  const configuredDevUrl =
    process.env.EXPO_PUBLIC_DEV_API_BASE_URL ||
    (Constants.expoConfig?.extra?.devApiBaseUrl as string | undefined) ||
    '';
  const configuredDevIp = configuredDevUrl ? extractIpFromSource(configuredDevUrl) : null;
  const localBackendUrl = autoDetectedIP
    ? `http://${autoDetectedIP}:3001`
    : configuredDevIp
      ? `http://${configuredDevIp}:3001`
      : null;
  
  // FORCE: In Expo Go on physical devices, always use local IP (not localhost)
  // Expo Go on physical devices cannot reach localhost, must use LAN IP
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  // CRITICAL: Detect simulator more robustly - check multiple conditions
  const isActuallySimulator = !Constants.isDevice && Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
  const isPhysicalDevice = Constants.isDevice && Platform.OS !== 'web';
  
  // Debug logging
  console.log('🌐 Device Detection:', {
    isDev,
    isSim,
    isDevice: Constants.isDevice,
    isActuallySimulator,
    isExpoGo,
    isPhysicalDevice,
    platform: Platform.OS,
    executionEnvironment: Constants.executionEnvironment
  });
  
  // CRITICAL: iOS Simulator - use network IP (more reliable than localhost for some network configs)
  // Android Emulator MUST use 10.0.2.2
  if (isActuallySimulator || isSim) {
    if (Platform.OS === 'ios') {
      // iOS Simulator: Use network IP instead of localhost (more reliable)
      // localhost sometimes doesn't work in iOS Simulator depending on network configuration
      recommendedApiUrl = localBackendUrl || 'http://localhost:3001';
      console.log('✅ iOS Simulator detected - using:', recommendedApiUrl);
    } else if (Platform.OS === 'android') {
      // Android emulator needs special IP
      recommendedApiUrl = 'http://10.0.2.2:3001';
      console.log('✅ Android Emulator detected - using 10.0.2.2:3001');
    } else {
      // Fallback for other platforms - try network IP
      recommendedApiUrl = localBackendUrl || 'http://localhost:3001';
      console.log('✅ Simulator/Emulator detected - using:', recommendedApiUrl);
    }
  } else if (Platform.OS === 'web') {
    // Web browser - can use localhost
    recommendedApiUrl = 'http://localhost:3001';
    console.log('✅ Web browser detected - using localhost:3001');
  } else if (!isDev) {
    // Production
    recommendedApiUrl = 'https://build-profit-solutions-backend.onrender.com';
    console.log('✅ Production mode - using Render backend');
  } else if (isExpoGo || isPhysicalDevice) {
    // Expo Go or physical device - use auto-detected or configured local IP
    const envUrl = Constants.expoConfig?.extra?.devApiBaseUrl;
    if (envUrl && (envUrl.includes('192.168') || envUrl.includes('10.0.2.2') || envUrl.includes('172.'))) {
      recommendedApiUrl = envUrl;
      console.log('✅ Using LOCAL backend from config:', envUrl);
    } else if (autoDetectedIP) {
      recommendedApiUrl = `http://${autoDetectedIP}:3001`;
      console.log('✅ Using AUTO-DETECTED LOCAL backend:', recommendedApiUrl, '(IP from Expo/Metro)');
    } else if (configuredDevIp) {
      recommendedApiUrl = `http://${configuredDevIp}:3001`;
      console.log('✅ Using configured LOCAL backend:', recommendedApiUrl);
    } else {
      recommendedApiUrl = 'https://build-profit-solutions-backend.onrender.com';
      console.warn('⚠️ Could not detect LAN IP; falling back to Render backend:', recommendedApiUrl);
    }
  } else {
    // Final fallback - for iOS/Android, default to network IP (iOS) or 10.0.2.2 (Android)
    if (Platform.OS === 'ios') {
      recommendedApiUrl = localBackendUrl || 'http://localhost:3001';
      console.log('⚠️ Final fallback for iOS:', recommendedApiUrl);
    } else if (Platform.OS === 'android') {
      recommendedApiUrl = 'http://10.0.2.2:3001';
      console.log('⚠️ Final fallback: Using 10.0.2.2:3001 for Android (assuming emulator)');
    } else {
      recommendedApiUrl = localBackendUrl || 'https://build-profit-solutions-backend.onrender.com';
      console.log('⚠️ Final fallback:', recommendedApiUrl);
    }
  }
  
  // Note: We always try local IP first (from auto-detection or fallback)
  // Production backend is used as last resort if local backend is unreachable
  // (handled by the API service layer, not here)
  
  console.log('🌐 Network Detection:', {
    isDev,
    isSim,
    isDevice,
    isExpoGo,
    isPhysicalDevice,
    platform: Platform.OS,
    selectedUrl: recommendedApiUrl,
    autoDetectedIP: autoDetectedIP || 'none',
    reason: !isDev ? 'production' : Platform.OS === 'web' ? 'web' : (isSim && !isDevice && !isExpoGo) ? 'simulator' : 'physical-device-or-expo-go'
  });
  
  return {
    isLocalhost: recommendedApiUrl.includes('localhost'),
    isSimulator: isSim,
    recommendedApiUrl,
    platform: Platform.OS
  };
};

/**
 * Log network configuration for debugging
 */
export const logNetworkConfig = (): void => {
  const info = getNetworkInfo();
  
  console.log('🌐 Network Configuration:', {
    platform: info.platform,
    isSimulator: info.isSimulator,
    isLocalhost: info.isLocalhost,
    recommendedUrl: info.recommendedApiUrl,
    isDevelopment: __DEV__,
    isDevice: Constants.isDevice
  });
};


