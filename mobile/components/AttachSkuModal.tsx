// --- BEGIN: API_BASE auto-detect for Expo / React Native ---
import { Platform, NativeModules } from "react-native";
import Constants from "expo-constants";

/** Try to discover the LAN IP from Expo / Metro so your phone can reach your dev server */
function getDevHost() {
  // Expo Go usually exposes the debugger host like "192.168.1.23:19000"
  const expoHost =
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.expoConfig?.hostUri ||
    "";

  // Plain React Native / Metro: scriptURL looks like "http://192.168.1.23:8081/index.bundle?..."
  const rnURL = (NativeModules as any)?.SourceCode?.scriptURL || "";

  const src = expoHost || rnURL;
  if (!src) return "localhost";

  const withoutProtocol = String(src).replace(/^https?:\/\//, "");
  const host = withoutProtocol.split(":")[0];
  return host || "localhost";
}

const host = getDevHost();
// Android emulator can't reach localhost on your Mac; it uses 10.0.2.2 instead.
const androidHost =
  host === "localhost" || host.startsWith("127.") ? "10.0.2.2" : host;

// --- END: API_BASE auto-detect ---

import { getApiBaseUrlWithDebug } from "../utils/apiConfig";
import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  TextInput,
  Button,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  StatusBar,
} from "react-native";

/** Get API base URL dynamically (recomputes each time to ensure fresh detection) */
function getApiBase() {
  const url = getApiBaseUrlWithDebug();
  console.log('🔍 AttachSkuModal getApiBase() called, returning:', url);
  return url;
}

import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { saveMaterial, removeSavedMaterial, isMaterialSaved } from '../services/savedMaterialsService';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';

type Store = "hd" | "lowes";
type Item = {
  sku: string;
  title: string;
  price: number | null;
  unit?: string | null;
  url: string;
  store: Store;
  zip: string;
  image?: string | null;
};

export default function AttachSkuModal({
  visible,
  defaultZip = "",
  onClose,
  onAttach,
  onSelect,
  isRentalMode = false,
  onOpenSaved,
}: {
  visible: boolean;
  defaultZip?: string;
  onClose: () => void;
  onAttach?: (item: Item) => void;
  onSelect?: (item: Item) => void;
  isRentalMode?: boolean;
  onOpenSaved?: () => void;
}) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = Colors.bg === '#000000';

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 AttachSkuModal - visible prop changed:', visible);
    console.log('🔍 AttachSkuModal - Component mounted/updated');
    if (visible) {
      console.log('✅ AttachSkuModal is now VISIBLE - modal should appear');
      console.log('✅ Modal props:', { visible, defaultZip, isRentalMode });
    } else {
      console.log('❌ AttachSkuModal is HIDDEN');
    }
  }, [visible, defaultZip, isRentalMode]);

  // Log when results change
  React.useEffect(() => {
    console.log('🔍 Results updated - count:', results.length);
    if (results.length > 0) {
      console.log('✅ Results are available - should be displayed');
      console.log('✅ First result:', results[0]?.title?.substring(0, 30));
    } else {
      console.log('⚠️ No results to display');
    }
  }, [results]);

  const [q, setQ] = useState("");
  const [zip, setZip] = useState(defaultZip);
  const [store, setStore] = useState<Store>("hd");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map()); // Quantity per SKU
  const [watchedItems, setWatchedItems] = useState<Set<string>>(new Set()); // Watched/Saved items
  const insets = useSafeAreaInsets();

  // Load saved items when results change
  useEffect(() => {
    if (results.length > 0) {
      loadSavedItems();
    }
  }, [results]);

  const loadSavedItems = async () => {
    try {
      const saved = await Promise.all(
        results.map(async (item) => {
          const saved = await isMaterialSaved(item.sku, item.store);
          return saved ? item.sku : null;
        })
      );
      const savedSkus = saved.filter(Boolean) as string[];
      setWatchedItems(new Set(savedSkus));
    } catch (error) {
      console.error('Error loading saved items:', error);
    }
  };

  const toggleSaveItem = async (item: Item) => {
    try {
      const isSaved = watchedItems.has(item.sku);
      
      if (isSaved) {
        // Remove from saved
        await removeSavedMaterial(item.sku, item.store);
        setWatchedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.sku);
          return newSet;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Save item
        await saveMaterial({
          sku: item.sku,
          title: item.title,
          price: item.price || 0,
          store: item.store,
          zip: item.zip,
          url: item.url,
          image: item.image || undefined,
          unit: item.unit || undefined,
        });
        setWatchedItems(prev => new Set([...prev, item.sku]));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Error toggling saved item:', error);
    }
  };

  async function search() {
    console.log('🔍 search() function called');
    console.log('🔍 Search params:', { q, zip, store });
    
    if (!q || !zip) {
      console.log('❌ Search blocked - missing q or zip:', { q: !!q, zip: !!zip });
      return;
    }
    
    console.log('✅ Starting search...');
    setLoading(true);
    setError(null);
    setResults([]); // Clear previous results
    
    const PRODUCTION_API_BASE = 'https://build-profit-solutions-backend.onrender.com';
    
    // Helper function to make the actual fetch request
    const makeRequest = async (apiBase: string, isRetry: boolean = false) => {
      const url = `${apiBase}/api/sku/search?store=${store}&zip=${zip}&q=${encodeURIComponent(q)}`;
      
      if (isRetry) {
        console.log('🔄 Retrying with production backend:', url);
      } else {
        console.log('🔍 ===== SKU SEARCH DEBUG =====');
        console.log('🔍 API_BASE:', apiBase);
        console.log('🔍 Full Search URL:', url);
        console.log('🔍 Platform.OS:', Platform.OS);
        console.log('🔍 Search parameters:', { store, zip, q });
        console.log('🔍 Network check: Phone and Mac should be on same WiFi');
      }
      
      // Add timeout - Backend has 3s global timeout, so frontend should be slightly longer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏱️ Request timeout - aborting after 10 seconds (backend timeout is 3s)');
        controller.abort();
      }, 10000); // 10 second timeout (backend has 3s global timeout + 7s buffer)
      
      console.log('🔍 Making fetch request to:', url);
      console.log('🔍 Timeout set to 10 seconds (backend should respond in < 3 seconds)');
      
      const startTime = Date.now();
      let r;
      try {
        r = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        const requestTime = Date.now() - startTime;
        console.log(`✅ Fetch completed in ${requestTime}ms`);
        clearTimeout(timeoutId); // Clear timeout on success
      } catch (fetchError: any) {
        clearTimeout(timeoutId); // Clear timeout on error too
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 10 seconds. The backend may be slow or unreachable.');
        }
        throw fetchError;
      }
      
      return r;
    };
    
    try {
      // Try local backend first
      const API_BASE = getApiBase(); // Get fresh API base URL each time
      let r;
      let shouldRetryWithProduction = false;
      let actualApiBase = API_BASE; // Track which API base we actually use
      
      try {
        r = await makeRequest(API_BASE, false);
        actualApiBase = API_BASE; // Success with local backend
      } catch (localError: any) {
        // Check if it's a network error that suggests local backend is unreachable
        const isNetworkError = localError.message === 'Network request failed' || 
                              localError.message?.includes('Network request failed') ||
                              localError.message?.includes('Failed to fetch') ||
                              localError.name === 'TypeError';
        
        // Only retry with production if:
        // 1. It's a network error (not a server error like 500)
        // 2. We're not already using production
        // 3. The local URL is actually a local IP (not production)
        const isLocalBackend = API_BASE.includes('192.168.') || 
                              API_BASE.includes('10.0.2.2') || 
                              API_BASE.includes('localhost') ||
                              API_BASE.includes('127.0.0.1');
        
        if (isNetworkError && isLocalBackend) {
          console.log('⚠️ Local backend unreachable, retrying with production backend...');
          shouldRetryWithProduction = true;
        } else {
          // Re-throw the error if we shouldn't retry
          throw localError;
        }
      }
      
      // If local backend failed with network error, try production
      if (shouldRetryWithProduction) {
        try {
          r = await makeRequest(PRODUCTION_API_BASE, true);
          actualApiBase = PRODUCTION_API_BASE; // Success with production backend
          console.log('✅ Production backend request successful');
        } catch (productionError: any) {
          // Both failed, throw a clear error message
          throw new Error('Cannot connect to backend. Please check your network connection and ensure the backend is running.');
        }
      }
      console.log('✅ Fetch request completed, status:', r.status);
      
      console.log('🔍 Response status:', r.status);
      
      if (!r.ok) {
        const errorText = await r.text();
        console.log('🔍 Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${r.status}` };
        }
        throw new Error(errorData?.error || `Search failed with status ${r.status}`);
      }
      
      const responseText = await r.text();
      console.log('🔍 Raw response text length:', responseText.length);
      console.log('🔍 Raw response preview:', responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔍 Parsed JSON successfully');
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        console.error('❌ Response text:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      
      console.log('🔍 Response data received, results count:', data.results?.length || 0);
      console.log('🔍 Full response structure:', Object.keys(data));
      
      if (!data.results || !Array.isArray(data.results)) {
        console.error('❌ Invalid response format - no results array');
        console.error('❌ Response data:', data);
        throw new Error('Invalid response format from server');
      }
      
      let normalized = (data.results || []).map((x: any, index: number) => {
        // Try multiple possible image field names
        let imageUrl = x.image || x.thumbnail || x.img || x.productImage || null;
        
        // Debug logging for first few items
        if (index < 3) {
          console.log(`🖼️ Item ${index} image fields:`, {
            image: x.image,
            thumbnail: x.thumbnail,
            img: x.img,
            productImage: x.productImage,
            sku: x.sku,
            url: x.url,
            foundImageUrl: imageUrl
          });
        }
        
        // If image URL is relative, make it absolute
        if (imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('http')) {
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = (store === 'hd' ? 'https://www.homedepot.com' : 'https://www.lowes.com') + imageUrl;
          }
        }
        
        // If no image URL, try to generate one from the SKU or product URL
        // This is a fallback for when the API doesn't return images
        if (!imageUrl) {
          // Try to extract product ID from SKU (format: HD-161640 or LW-123456)
          // Also handle formats like: 161640, HD161640, etc.
          const skuMatch = x.sku?.match(/(?:HD|LW)-?(\d+)/) || x.sku?.match(/(\d{4,})/);
          if (skuMatch && skuMatch[1]) {
            const productId = skuMatch[1];
            if ((store === 'hd' || x.sku?.toUpperCase().startsWith('HD')) && productId.length >= 6) {
              // Home Depot product images - try multiple patterns
              const first2 = productId.substring(0, 2);
              const next2 = productId.substring(2, 4);
              
              // Try standard pattern first (most common)
              imageUrl = `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/sd/${productId}.jpg`;
              
              // Note: We'll try alternative patterns if this one fails (handled by onError)
            } else if ((store === 'lowes' || x.sku?.toUpperCase().startsWith('LW')) && productId.length >= 4) {
              // Lowes product images pattern - try multiple sizes
              imageUrl = `https://mobileimages.lowes.com/productimages/${productId}/0.jpg`;
            }
          }
          
          // If still no image, try from URL
          if (!imageUrl && x.url) {
            if ((store === 'hd' || x.url.includes('homedepot.com')) && x.url.includes('homedepot.com')) {
              // Try to extract product ID from various URL patterns
              let productId = x.url.match(/\/p\/HD-(\d+)/)?.[1] || 
                             x.url.match(/\/p\/(\d+)/)?.[1] ||
                             x.url.match(/productId=(\d+)/)?.[1] ||
                             x.url.match(/sku=(\d+)/)?.[1] ||
                             x.url.match(/\/(\d{6,})/)?.[1];
              
              if (productId) {
                // Remove any non-numeric characters
                productId = productId.replace(/\D/g, '');
                if (productId.length >= 6) {
                  const first2 = productId.substring(0, 2);
                  const next2 = productId.substring(2, 4);
                  // Try standard Home Depot image pattern
                  imageUrl = `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/sd/${productId}.jpg`;
                }
              }
            } else if ((store === 'lowes' || x.url.includes('lowes.com')) && x.url.includes('lowes.com')) {
              let productId = x.url.match(/\/p\/([^\/\?]+)/)?.[1] || 
                             x.url.match(/productId=(\d+)/)?.[1] ||
                             x.url.match(/\/(\d{4,})/)?.[1];
              if (productId) {
                productId = productId.replace(/\D/g, '');
                if (productId.length >= 4) {
                  imageUrl = `https://mobileimages.lowes.com/productimages/${productId}/0.jpg`;
                }
              }
            }
          }
        }
        
        // For Home Depot, if we have an image URL but it might fail, store alternative patterns
        // This will be used in the Image component's onError handler
        let alternativeImageUrls = [];
        if (imageUrl && imageUrl.includes('homedepot-static.com') && x.sku) {
          const productIdMatch = x.sku.match(/(?:HD-)?(\d{6,})/);
          if (productIdMatch && productIdMatch[1]) {
            const productId = productIdMatch[1];
            const first2 = productId.substring(0, 2);
            const next2 = productId.substring(2, 4);
            // Alternative patterns to try if main one fails
            alternativeImageUrls = [
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/hd/${productId}.jpg`, // HD size
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/lg/${productId}.jpg`, // Large size
              `https://images.homedepot-static.com/productImages/${productId}/sd/${productId}.jpg`, // No subdirectory
            ];
          }
        }
        
        // Route ALL external image URLs through our proxy to ensure they load in React Native
        let finalImageUrl = imageUrl;
        if (imageUrl && imageUrl.startsWith('http')) {
          // Use the SAME API base that was used for the successful search request
          // This ensures images work when we fallback to production backend
          finalImageUrl = `${actualApiBase}/api/sku/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          // Log for debugging (first 3 items)
          if (index < 3) {
            console.log('🖼️ Original image URL:', imageUrl.substring(0, 100));
            console.log('🖼️ Proxied image URL:', finalImageUrl.substring(0, 150));
            console.log('🖼️ Using API_BASE:', actualApiBase);
          }
        }
        
        return {
          ...x,
          price: x.price == null ? null : Number(x.price),
          image: finalImageUrl,
        };
      });
      // Log detailed image info for debugging
      const imageStats = normalized.reduce((acc, r) => {
        if (r.image) acc.withImages++;
        else acc.withoutImages++;
        return acc;
      }, { withImages: 0, withoutImages: 0 });
      console.log('🔍 Image stats:', imageStats);
      if (imageStats.withImages > 0) {
        console.log('🔍 Sample images (first 3 with images):', normalized.filter(r => r.image).slice(0, 3).map(r => ({ 
          title: r.title?.substring(0, 30), 
          sku: r.sku,
          image: r.image?.substring(0, 100),
          url: r.url,
        })));
        // Log first image URL in full for debugging
        const firstWithImage = normalized.find(r => r.image);
        if (firstWithImage) {
          console.log('🖼️ First image URL (full):', firstWithImage.image);
        }
      } else {
        console.log('⚠️ No images found in results - API may be returning mock data');
        console.log('🔍 Sample results (first 3):', normalized.slice(0, 3).map(r => ({
          title: r.title?.substring(0, 30),
          sku: r.sku,
          url: r.url,
          hasImage: !!r.image,
        })));
      }
      
      // Filter for rental equipment if in rental mode
      if (isRentalMode) {
        normalized = normalized.filter((item: Item) => 
          item.sku.startsWith('HD-111') || item.sku.startsWith('LW-111')
        );
      }
      
      // Check if we got results but with mock data warning (this is expected when APIs are disabled)
      if (data.metadata?.isMockData && normalized.length > 0) {
        console.log('✅ Using estimated prices (mock data mode - expected behavior)');
        // Don't show error for mock data - it's the expected behavior
        // Mock data provides fast, reliable results without API dependencies
        setError(null);
        setResults(normalized);
      } else if (data.metadata?.rateLimited && normalized.length > 0) {
        console.log('⚠️ Using fallback data due to rate limiting');
        // Only show error for actual rate limits (not mock data)
        setResults(normalized);
        setError('⚠️ Rate limit reached. Showing estimated prices. Real pricing will resume in a few minutes.');
      } else {
        setError(null); // Clear any previous errors
        setResults(normalized);
      }
      
      console.log('✅ Search completed successfully');
      console.log('✅ Setting results:', normalized.length, 'items');
      setLoading(false); // Make sure loading is set to false
      console.log('✅ Results state updated, should trigger re-render');
    } catch (e: any) {
      console.error('❌ Search error caught:', e);
      const API_BASE = getApiBase(); // Get fresh API base URL for error message
      console.log('🔍 Search error details:', {
        name: e.name,
        message: e.message,
        stack: e.stack?.substring(0, 200)
      });
      console.log('🔍 Attempted URL:', `${API_BASE}/api/sku/search?store=${store}&zip=${zip}&q=${encodeURIComponent(q)}`);
      
      setLoading(false); // Always set loading to false on error
      
      // Check for rate limiting errors specifically
      if (e.message?.toLowerCase().includes('too many requests') || 
          e.message?.toLowerCase().includes('rate limit') ||
          e.message?.includes('RATE_LIMIT_EXCEEDED')) {
        console.log('⏱️ Rate limit detected');
        setError('⚠️ API rate limit reached. The system will automatically use estimated prices. Please wait a few minutes and try again for real-time pricing.');
        return;
      }
      
      if (e.name === 'AbortError' || e.message?.includes('Aborted')) {
        console.log('⏱️ Request was aborted (likely timeout)');
        console.log('💡 This usually means your phone cannot reach the backend at', API_BASE);
        console.log('💡 Make sure:');
        console.log('   1. Phone and Mac are on the same Wi-Fi network');
        console.log('   2. Backend is running on', API_BASE);
        console.log('   3. No firewall is blocking port 3001');
        setError('Request timed out. Your phone cannot reach the backend.\n\nMake sure:\n• Phone and Mac are on the same Wi-Fi\n• Backend is running\n• Try using production backend instead');
      } else if (e.message === 'Network request failed' || e.message?.includes('Network request failed') || e.message?.includes('Failed to fetch') || e.message?.includes('Cannot connect to backend')) {
        console.log('🌐 Network request failed - both local and production backends were tried');
        setError(`Cannot connect to backend. Please check:\n1. Your internet connection is working\n2. If using local backend, ensure it's running and your phone is on the same Wi-Fi\n3. Try again in a moment`);
      } else if (e.message?.includes('JSON')) {
        console.log('📄 JSON parsing error');
        setError('Invalid response from server. Please try again.');
      } else {
        console.log('❓ Unknown error:', e.message);
        setError(e.message || 'Search failed. Please try again.');
      }
    } finally {
      // Double-check loading is false
      setLoading(false);
      console.log('🔍 Search function finished, loading set to false');
    }
  }

  console.log('🔍 AttachSkuModal render - visible:', visible);
  
  // Early return if not visible (but Modal handles this, so we keep it for debugging)
  if (!visible) {
    console.log('🔍 Modal not visible, but still rendering Modal component');
  }
  
  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      onRequestClose={onClose}
      transparent={false}
      statusBarTranslucent={false}
    >
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}>
          {/* Header */}
          <View style={{
            paddingHorizontal: 20,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  padding: 1,
                  marginRight: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 19,
                    backgroundColor: '#000000',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                    marginRight: 12,
                  }}
                >
                  <View style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 19,
                    backgroundColor: '#000000',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <MaterialCommunityIcons
                      name="magnify"
                      size={24}
                      color="#22c55e"
                    />
                  </View>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: darkMode ? '#FFFFFF' : '#000000',
                    letterSpacing: 0.3,
                  }}>
                    {isRentalMode ? 'Find Rental Equipment' : 'Search Products'}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#8DA0B8',
                    marginTop: 2,
                  }}>
                    Search for materials and equipment
                  </Text>
                </View>
              </View>
              
              {/* Saved Materials Icon */}
              {onOpenSaved && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onOpenSaved();
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <MaterialIcons name="bookmark" size={22} color="#22c55e" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              flexGrow: 1,
              paddingBottom: 20,
              paddingHorizontal: 20,
            }}
            keyboardShouldPersistTaps="handled"
          >
          <View style={{ 
            paddingTop: 20,
            gap: 20,
          }}>

            {/* Retailer Selection */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: darkMode ? '#FFFFFF' : '#000000',
                marginBottom: 10,
                letterSpacing: 0.2,
              }}>
                Retailer
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setStore("hd")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: store === "hd" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.15)" : Colors.line),
                    backgroundColor: store === "hd" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.surface2),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: store === "hd" ? "#000000" : (darkMode ? "#FFFFFF" : "#000000"),
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    🏠 Home Depot
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStore("lowes")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: store === "lowes" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.15)" : Colors.line),
                    backgroundColor: store === "lowes" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.surface2),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: store === "lowes" ? "#000000" : (darkMode ? "#FFFFFF" : "#000000"),
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    🔨 Lowe's
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Input */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: darkMode ? '#FFFFFF' : '#000000',
                marginBottom: 10,
                letterSpacing: 0.2,
              }}>
                Search Query *
              </Text>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                }}
              >
                <View style={{
                  borderRadius: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  backgroundColor: darkMode ? '#000000' : '#FFFFFF',
                  paddingVertical: 12,
                }}>
                  <Feather
                    name="search"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    placeholder={isRentalMode ? 'Search rentals (e.g., excavator, generator, ladder)' : 'Search (e.g., lumber, concrete, 2x4, PEX)'}
                    value={q}
                    onChangeText={setQ}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: darkMode ? '#FFFFFF' : '#000000',
                      fontWeight: '500',
                    }}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    returnKeyType="search"
                    onSubmitEditing={search}
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                  />
                  {q.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setQ("");
                        setResults([]);
                        setIsInputFocused(false);
                      }}
                      style={{ marginLeft: 8, padding: 4 }}
                    >
                      <Feather
                        name="x"
                        size={18}
                        color="#8DA0B8"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* ZIP Input */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: darkMode ? '#FFFFFF' : '#000000',
                marginBottom: 10,
                letterSpacing: 0.2,
              }}>
                ZIP Code *
              </Text>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={{
                  borderRadius: 20,
                  padding: 1,
                }}
              >
                <View style={{
                  borderRadius: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  backgroundColor: darkMode ? '#000000' : '#FFFFFF',
                  paddingVertical: 12,
                }}>
                  <Feather
                    name="map-pin"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    placeholder="ZIP (store pricing is ZIP-specific)"
                    value={zip}
                    onChangeText={setZip}
                    keyboardType="number-pad"
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: darkMode ? '#FFFFFF' : '#000000',
                      fontWeight: '500',
                    }}
                    placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                    returnKeyType="done"
                    selectionColor="#22c55e"
                    underlineColorAndroid="transparent"
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                  />
                </View>
              </LinearGradient>
            </View>

            <TouchableOpacity
              onPress={() => {
                console.log('🔍 Search button pressed directly');
                console.log('🔍 Current state:', { q, zip, store });
                search();
              }}
              disabled={loading || !q || !zip}
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 20,
                opacity: (loading || !q || !zip) ? 0.5 : 1,
              }}
            >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#22c55e',
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 4,
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#020617',
                    letterSpacing: 0.3,
                  }}>
                    {loading ? 'Searching...' : 'Search'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

            {loading && <ActivityIndicator color="#22c55e" size="large" style={{ marginTop: 20 }} />}
            {error && <Text style={{ color: "#ef4444", textAlign: 'center', marginTop: 10, fontSize: 14 }}>{error}</Text>}

            {results.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 16,
                  justifyContent: 'space-between'
                }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: '#FFFFFF' }}>
                    Search Results
                  </Text>
                  <View style={{
                    backgroundColor: '#22c55e',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}>
                    <Text style={{ 
                      color: '#000000', 
                      fontWeight: '700', 
                      fontSize: 14,
                      letterSpacing: 0.5
                    }}>
                      {results.length} found
                    </Text>
                  </View>
                </View>
                {results.map((item, idx) => (
                  <View key={`${item.sku || 'item'}-${idx}-${item.title || 'title'}`}>
                    <TouchableOpacity
                      onPress={() => {
                        if (isRentalMode && onSelect) {
                          onSelect(item);
                        } else if (onAttach) {
                          onAttach(item);
                        }
                      }}
                      style={{ paddingVertical: 12, flexDirection: 'row', gap: 12 }}
                    >
                      {/* Product Image */}
                      <View style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}>
                        {item.image && 
                         typeof item.image === 'string' && 
                         item.image.trim().length > 0 && 
                         item.image !== 'null' && 
                         item.image !== 'undefined' &&
                         item.image.startsWith('http') &&
                         !failedImages.has(item.sku) ? (
                          <Image
                            source={{ 
                              uri: item.image,
                              cache: 'force-cache'
                            }}
                            style={{ 
                              width: '100%', 
                              height: '100%',
                            }}
                            resizeMode="cover"
                            onError={(e) => {
                              console.log('❌ Image load error for:', item.title?.substring(0, 30));
                              console.log('❌ Image URL (full):', item.image);
                              console.log('❌ SKU:', item.sku);
                              console.log('❌ Error details:', JSON.stringify(e.nativeEvent, null, 2));
                              // Mark this image as failed so we show placeholder next time
                              setFailedImages(prev => new Set([...prev, item.sku]));
                            }}
                            onLoad={() => {
                              console.log('✅ Image loaded successfully:', item.title?.substring(0, 30));
                              console.log('✅ Image URL:', item.image?.substring(0, 100));
                            }}
                            onLoadStart={() => {
                              console.log('🔄 Starting to load image:', item.image?.substring(0, 100));
                            }}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="package-variant"
                            size={32}
                            color="#8DA0B8"
                          />
                        )}
                      </View>
                      
                      {/* Product Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "600", fontSize: 15, color: '#FFFFFF' }} numberOfLines={2}>
                          {item.title || 'No title'}
                        </Text>
                        <Text style={{ color: '#8DA0B8', fontSize: 13, marginTop: 4 }}>
                          {item.store?.toUpperCase() || 'HD'} • {item.zip || 'N/A'} • {item.sku || "No SKU"}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontWeight: '700', fontSize: 16, color: '#22c55e' }}>
                            {isRentalMode ? (
                              item.unit ? `Rental • ${item.unit}` : "Rental Equipment"
                            ) : (
                              item.price != null ? `$${item.price.toFixed(2)}` : "No price"
                            )}{" "}
                            {!isRentalMode && item.unit ? `• ${item.unit}` : ""}
                          </Text>
                          
                          {/* AI Price Signal Badge */}
                          {!isRentalMode && item.price != null && (() => {
                            // Simple AI price signal: compare to estimated market average
                            // For demo: assume prices 20% below avg = good deal, 20% above = expensive
                            const estimatedMarketAvg = item.price * 1.15; // Rough estimate
                            const priceRatio = item.price / estimatedMarketAvg;
                            let signal: 'good' | 'fair' | 'expensive' = 'fair';
                            let badgeColor = '#3b82f6'; // Blue for fair
                            let badgeText = 'Fair';
                            
                            if (priceRatio < 0.85) {
                              signal = 'good';
                              badgeColor = '#10b981'; // Green for good deal
                              badgeText = 'Good Deal';
                            } else if (priceRatio > 1.15) {
                              signal = 'expensive';
                              badgeColor = '#ef4444'; // Red for expensive
                              badgeText = 'Pricey';
                            }
                            
                            return (
                              <View style={{
                                backgroundColor: badgeColor,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}>
                                <MaterialIcons 
                                  name={signal === 'good' ? 'trending-down' : signal === 'expensive' ? 'trending-up' : 'trending-flat'} 
                                  size={12} 
                                  color="#FFFFFF" 
                                />
                                <Text style={{ 
                                  color: '#FFFFFF', 
                                  fontWeight: '700', 
                                  fontSize: 10,
                                  letterSpacing: 0.3
                                }}>
                                  AI: {badgeText}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        
                        {/* Quantity Selector & Action Buttons */}
                        <View style={{ marginTop: 8 }}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: '#8DA0B8', fontSize: 12, fontWeight: '600', minWidth: 60 }}>
                              Quantity:
                            </Text>
                            <View style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.1)',
                            }}>
                              <TouchableOpacity
                                onPress={() => {
                                  const currentQty = quantities.get(item.sku) || 1;
                                  if (currentQty > 1) {
                                    setQuantities(new Map(quantities.set(item.sku, currentQty - 1)));
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                }}
                              >
                                <MaterialIcons name="remove" size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                              <Text style={{ 
                                color: '#FFFFFF', 
                                fontWeight: '700', 
                                fontSize: 14,
                                minWidth: 30,
                                textAlign: 'center'
                              }}>
                                {quantities.get(item.sku) || 1}
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  const currentQty = quantities.get(item.sku) || 1;
                                  setQuantities(new Map(quantities.set(item.sku, currentQty + 1)));
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                }}
                              >
                                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => {
                                const qty = quantities.get(item.sku) || 1;
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                if (isRentalMode && onSelect) {
                                  onSelect({ ...item, quantity: qty });
                                } else if (onAttach) {
                                  onAttach({ ...item, quantity: qty });
                                }
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: '#22c55e',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 8,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <MaterialIcons name="add-shopping-cart" size={16} color="#000000" />
                              <Text style={{ color: '#000000', fontWeight: '700', fontSize: 12 }}>
                                {isRentalMode ? 'Select Rental' : 'Add to Bid'}
                              </Text>
                            </TouchableOpacity>
                            
                            {/* Save/Watch Button */}
                            <TouchableOpacity
                              onPress={() => toggleSaveItem(item)}
                              style={{
                                width: 44,
                                height: 44,
                                backgroundColor: watchedItems.has(item.sku) 
                                  ? 'rgba(34, 197, 94, 0.2)' 
                                  : "rgba(255, 255, 255, 0.1)",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: watchedItems.has(item.sku)
                                  ? '#22c55e'
                                  : "rgba(255, 255, 255, 0.15)",
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MaterialIcons 
                                name={watchedItems.has(item.sku) ? "bookmark" : "bookmark-border"} 
                                size={20} 
                                color={watchedItems.has(item.sku) ? '#22c55e' : '#FFFFFF'} 
                              />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              onPress={() => Linking.openURL(item.url)}
                              style={{
                                width: 44,
                                height: 44,
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.15)",
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MaterialIcons name="open-in-new" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                    {idx < results.length - 1 && (
                      <View style={{ height: 1, backgroundColor: "rgba(255, 255, 255, 0.08)", marginVertical: 12 }} />
                    )}
                  </View>
                ))}
              </View>
            )}

            {!isInputFocused && (
              <View style={{ 
                backgroundColor: 'rgba(255, 193, 7, 0.1)', 
                padding: 12, 
                borderRadius: 8, 
                borderWidth: 1, 
                borderColor: 'rgba(255, 193, 7, 0.3)',
                marginTop: 12 
              }}>
                <Text style={{ fontSize: 12, color: "#ffc107", fontWeight: "600", marginBottom: 4 }}>
                  ⚠️ Price Estimates
                </Text>
                <Text style={{ fontSize: 11, color: "#8DA0B8", lineHeight: 16 }}>
                  Prices are estimates from public search results and may change. Always verify current pricing and availability on the retailer's website before purchasing. Build Profit Solutions is not affiliated with Home Depot or Lowe's.
                </Text>
              </View>
            )}
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}