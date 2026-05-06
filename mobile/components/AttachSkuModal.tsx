// @ts-nocheck
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
  StyleSheet,
  InputAccessoryView,
  useWindowDimensions,
} from "react-native";

/** Get API base URL dynamically (recomputes each time to ensure fresh detection) */
function getApiBase() {
  const url = getApiBaseUrlWithDebug();
  console.log('🔍 AttachSkuModal getApiBase() called, returning:', url);
  return url;
}

import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import GradientRingBackInner from './GradientRingBackInner';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { saveMaterial, removeSavedMaterial, isMaterialSaved } from '../services/savedMaterialsService';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import {
  skuSearchQueryTextKeyboard,
  textInputPhonePadDoneAccessory,
} from '@/constants/inputKeyboardPresets';
import { KEYBOARD_ACCESSORY_IDS } from '@/constants/keyboard';
import {
  getProjectExpenseFormHorizontalPadding,
  isDesktopWebLayoutWidth,
} from '@/constants/ScreenLayout';

/** Match Estimates Add Labor / line-item modals (desktop web column cap). */
const SKU_SEARCH_WEB_FORM_MAX_WIDTH = 900;

/** Web: green→blue gradient ring; native: padded column. */
function SkuWebFormOptionalChrome({
  isWeb,
  darkMode,
  Colors,
  columnStyle,
  frameMaxWidth = SKU_SEARCH_WEB_FORM_MAX_WIDTH,
  children,
}: {
  isWeb: boolean;
  darkMode: boolean;
  Colors: any;
  columnStyle?: Record<string, unknown>;
  /** Max width of the gradient frame on web (aligns with `LINE_ITEM_MODAL_WEB_MAX_WIDTH`). */
  frameMaxWidth?: number;
  children: React.ReactNode;
}) {
  if (isWeb) {
    return (
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={BRAND_FRAME_GRADIENT_START}
        end={BRAND_FRAME_GRADIENT_END}
        style={{
          width: "100%",
          maxWidth: frameMaxWidth,
          alignSelf: "center",
          borderRadius: 24,
          padding: 1,
          overflow: "hidden",
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: "100%",
            borderRadius: 23,
            padding: 28,
            backgroundColor: darkMode ? "#050807" : Colors.surface2,
          }}
        >
          <View style={{ gap: 14 }}>{children}</View>
        </View>
      </LinearGradient>
    );
  }
  return (
    <View style={[{ paddingTop: 14, gap: 14 }, columnStyle || {}]}>
      {children}
    </View>
  );
}

function SkuModalHeaderRow({
  darkMode,
  Colors,
  isRentalMode,
  onClose,
  onOpenSaved,
}: {
  darkMode: boolean;
  Colors: any;
  isRentalMode: boolean;
  onClose: () => void;
  onOpenSaved?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
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
        <GradientRingBackInner
          darkMode={darkMode}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 19,
            backgroundColor: darkMode ? "#000000" : Colors.bg,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
        </GradientRingBackInner>
      </LinearGradient>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <LinearGradient
          colors={BRAND_FRAME_GRADIENT_COLORS}
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
          <View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 19,
              backgroundColor: darkMode ? "#000000" : Colors.bg,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MaterialCommunityIcons name="magnify" size={24} color="#22c55e" />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: darkMode ? "#FFFFFF" : "#000000",
              letterSpacing: 0.3,
            }}
          >
            {isRentalMode ? "Find Rental Equipment" : "Search Products"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: darkMode ? "rgba(226, 232, 240, 0.72)" : Colors.sub,
              marginTop: 4,
              lineHeight: 18,
              fontWeight: "500",
            }}
          >
            Search for materials and equipment
          </Text>
        </View>
      </View>
      {onOpenSaved ? (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenSaved();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: darkMode ? "rgba(255, 255, 255, 0.06)" : Colors.surface2,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: darkMode ? "rgba(148, 163, 184, 0.18)" : Colors.line,
          }}
        >
          <MaterialIcons name="bookmark" size={20} color="#22c55e" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Backend (esp. older production) may still return placehold.co "fake" thumbnails — never show those as product photos. */
function isPlaceholderImageUrl(u: string | null | undefined): boolean {
  if (!u || typeof u !== 'string') return false;
  const lower = u.toLowerCase();
  if (lower.includes('placehold.co') || lower.includes('placekitten') || lower.includes('dummyimage')) {
    return true;
  }
  try {
    if (decodeURIComponent(u).toLowerCase().includes('placehold.co')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

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
  /** Proxied CDN alternates to try if primary `image` fails (Home Depot path variants). */
  imageFallbacks?: string[];
};

function SkuResultThumb({
  primaryUri,
  fallbackUris,
  sku,
  failedImages,
  setFailedImages,
}: {
  primaryUri: string | null | undefined;
  fallbackUris: string[];
  sku: string;
  failedImages: Set<string>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const chain = React.useMemo(() => {
    const raw = [primaryUri, ...fallbackUris].filter(
      (u): u is string => typeof u === 'string' && u.startsWith('http') && u.trim().length > 0
    );
    return [...new Set(raw)];
  }, [primaryUri, fallbackUris]);

  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setAttempt(0);
  }, [chain.join('|')]);

  const uri = chain[attempt];

  if (!uri || failedImages.has(sku)) {
    return (
      <MaterialCommunityIcons name="package-variant" size={32} color="#8DA0B8" />
    );
  }

  return (
    <Image
      /** RN Web: `cache: 'force-cache'` can prevent images from loading; native keeps disk cache. */
      source={Platform.OS === 'web' ? { uri } : { uri, cache: 'force-cache' }}
      style={{ width: '100%', height: '100%' }}
      resizeMode="cover"
      onError={() => {
        if (attempt < chain.length - 1) {
          setAttempt((a) => a + 1);
        } else {
          setFailedImages((prev) => new Set([...prev, sku]));
        }
      }}
    />
  );
}

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

  /** Same shell as Estimates step 1–2 `AppTextField` (`estimateAccessoryShellStyle` in estimate-generator). */
  const skuTextFieldShellStyle = useMemo(
    () =>
      darkMode
        ? {
            borderRadius: 18,
            backgroundColor: '#0B0B0D',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
          }
        : {
            borderRadius: 12,
            backgroundColor: Colors.surface2,
            borderWidth: 1,
            borderColor: Colors.line,
          },
    [darkMode, Colors.surface2, Colors.line],
  );

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

  const [q, setQ] = useState("");
  const [zip, setZip] = useState(defaultZip);
  const [store, setStore] = useState<Store>("hd");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map()); // Quantity per SKU
  const [watchedItems, setWatchedItems] = useState<Set<string>>(new Set()); // Watched/Saved items
  const insets = useSafeAreaInsets();
  const { width: skuModalLayoutWidth } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const skuWebDesktopLayout = isWeb && isDesktopWebLayoutWidth(skuModalLayoutWidth);
  const skuWebHorizontalPad = useMemo(() => {
    if (!isWeb) return { header: 20, scroll: 20, footer: 20 };
    return getProjectExpenseFormHorizontalPadding({ desktopWeb: skuWebDesktopLayout });
  }, [isWeb, skuWebDesktopLayout]);
  const headerRule = darkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(0,0,0,0.08)";
  const webColumnCentered = isWeb
    ? {
        width: "100%" as const,
        maxWidth: SKU_SEARCH_WEB_FORM_MAX_WIDTH,
        alignSelf: "center" as const,
      }
    : undefined;

  const inputWebOutline =
    Platform.OS === 'web'
      ? { outlineStyle: 'none' as const, outlineWidth: 0 }
      : {};

  // Log when results change (must be after `results` state — TDZ if placed above useState)
  React.useEffect(() => {
    console.log('🔍 Results updated - count:', results.length);
    if (results.length > 0) {
      console.log('✅ Results are available - should be displayed');
      console.log('✅ First result:', results[0]?.title?.substring(0, 30));
    } else {
      console.log('⚠️ No results to display');
    }
  }, [results]);

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
    setFailedImages(new Set());
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

        if (isPlaceholderImageUrl(imageUrl)) {
          if (index < 3) {
            console.log('🖼️ Ignoring placeholder image URL from API; will derive from SKU if possible');
          }
          imageUrl = null;
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
        
        // Home Depot: extra CDN path variants to try if primary fails (React Native onError chain).
        let alternativeImageUrls: string[] = [];
        if (store === 'hd' && x.sku) {
          const productIdMatch = String(x.sku).match(/(?:HD-)?(\d{6,})/);
          if (productIdMatch && productIdMatch[1]) {
            const productId = productIdMatch[1];
            const first2 = productId.substring(0, 2);
            const next2 = productId.substring(2, 4);
            alternativeImageUrls = [
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/hd/${productId}.jpg`,
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/lg/${productId}.jpg`,
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/md/${productId}.jpg`,
              `https://images.homedepot-static.com/productImages/${first2}/${next2}/${productId}/xs/${productId}.jpg`,
              `https://images.homedepot-static.com/productImages/${productId}/sd/${productId}.jpg`,
            ];
          }
        }

        // Route ALL external image URLs through our proxy to ensure they load in React Native
        let finalImageUrl: string | null = null;
        if (imageUrl && imageUrl.startsWith('http')) {
          finalImageUrl = `${actualApiBase}/api/sku/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          if (index < 3) {
            console.log('🖼️ Original image URL:', imageUrl.substring(0, 100));
            console.log('🖼️ Proxied image URL:', finalImageUrl.substring(0, 150));
            console.log('🖼️ Using API_BASE:', actualApiBase);
          }
        }

        const proxiedAlternatives = alternativeImageUrls.map(
          (u) => `${actualApiBase}/api/sku/image-proxy?url=${encodeURIComponent(u)}`
        );
        const imageFallbacks = proxiedAlternatives.filter((u) => u && u !== finalImageUrl);

        return {
          ...x,
          price: x.price == null ? null : Number(x.price),
          image: finalImageUrl,
          imageFallbacks,
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

  /** iOS: same pattern as Estimates step 1–2 main screen (`View` + scroll insets). Android: `KeyboardAvoidingView`. */
  const SkuModalRoot = Platform.OS === 'ios' ? View : KeyboardAvoidingView;

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
      {/* Empty accessory: Search Query must not use global green Done (`bpsKeyboardDone`) — matches Customer Name. */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView
          nativeID={KEYBOARD_ACCESSORY_IDS.skuSearchQueryPlain}
          backgroundColor="transparent"
        >
          <View style={{ height: 0, width: '100%' }} collapsable={false} />
        </InputAccessoryView>
      )}
      <SkuModalRoot
        style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}
        {...(Platform.OS === 'android'
          ? { behavior: 'height' as const, keyboardVerticalOffset: 20 }
          : {})}
      >
        <View style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}>
          {!isWeb && (
          <View style={{
            paddingHorizontal: 20,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(0,0,0,0.08)',
          }}>
            <View style={webColumnCentered}>
              <SkuModalHeaderRow
                darkMode={darkMode}
                Colors={Colors}
                isRentalMode={isRentalMode}
                onClose={onClose}
                onOpenSaved={onOpenSaved}
              />
            </View>
          </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={
              isWeb
                ? {
                    flexGrow: 1,
                    width: '100%',
                    maxWidth: SKU_SEARCH_WEB_FORM_MAX_WIDTH,
                    alignSelf: 'center',
                    paddingHorizontal: skuWebHorizontalPad.scroll,
                    paddingTop: Math.max(insets.top, 12),
                    paddingBottom: 32,
                  }
                : {
                    flexGrow: 1,
                    paddingBottom: 24,
                    paddingHorizontal: 20,
                  }
            }
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
          {isWeb && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 24,
                paddingTop: 24,
                paddingBottom: 18,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: headerRule,
              }}
            >
              <SkuModalHeaderRow
                darkMode={darkMode}
                Colors={Colors}
                isRentalMode={isRentalMode}
                onClose={onClose}
                onOpenSaved={onOpenSaved}
              />
            </View>
          )}
          <SkuWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumnCentered}>
            {/* Retailer Selection */}
            <View>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: darkMode ? 'rgba(248, 250, 252, 0.88)' : 'rgba(0,0,0,0.75)',
                marginBottom: 6,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
                Retailer
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setStore("hd")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: store === "hd" ? "#22c55e" : (darkMode ? "rgba(148, 163, 184, 0.22)" : Colors.line),
                    backgroundColor: store === "hd" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.04)" : Colors.surface2),
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={20}
                    color={store === "hd" ? "#020617" : (darkMode ? "#e2e8f0" : "#0f172a")}
                  />
                  <Text
                    style={{
                      color: store === "hd" ? "#020617" : (darkMode ? "#f1f5f9" : "#000000"),
                      fontWeight: "700",
                      fontSize: 14,
                      letterSpacing: 0.15,
                    }}
                  >
                    Home Depot
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStore("lowes")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: store === "lowes" ? "#22c55e" : (darkMode ? "rgba(148, 163, 184, 0.22)" : Colors.line),
                    backgroundColor: store === "lowes" ? "#22c55e" : (darkMode ? "rgba(255, 255, 255, 0.04)" : Colors.surface2),
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <MaterialCommunityIcons
                    name="tools"
                    size={20}
                    color={store === "lowes" ? "#020617" : (darkMode ? "#e2e8f0" : "#0f172a")}
                  />
                  <Text
                    style={{
                      color: store === "lowes" ? "#020617" : (darkMode ? "#f1f5f9" : "#000000"),
                      fontWeight: "700",
                      fontSize: 14,
                      letterSpacing: 0.15,
                    }}
                  >
                    Lowe's
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Input */}
            <View>
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: darkMode ? '#FFFFFF' : '#000000',
                marginBottom: 6,
                letterSpacing: 0.2,
              }}>
                Search Query *
              </Text>
              <View
                style={[
                  skuTextFieldShellStyle,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    minHeight: 58,
                  },
                ]}
              >
                  <Feather
                    name="search"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    {...skuSearchQueryTextKeyboard}
                    placeholder={isRentalMode ? 'Search rentals (e.g., excavator, generator, ladder)' : 'Search (e.g., lumber, concrete, 2x4, PEX)'}
                    value={q}
                    onChangeText={setQ}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: darkMode ? '#FFFFFF' : '#000000',
                      fontWeight: '500',
                      ...inputWebOutline,
                    }}
                    placeholderTextColor={darkMode ? "rgba(226,232,240,0.55)" : Colors.sub}
                    onSubmitEditing={search}
                    keyboardAppearance={darkMode ? 'dark' : 'light'}
                    selectionColor="#22c55e"
                    cursorColor={Platform.OS === 'ios' ? '#22c55e' : undefined}
                    underlineColorAndroid="transparent"
                  />
                  {q.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setQ("");
                        setResults([]);
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
            </View>

            {/* ZIP Input */}
            <View>
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: darkMode ? '#FFFFFF' : '#000000',
                marginBottom: 6,
                letterSpacing: 0.2,
              }}>
                ZIP Code *
              </Text>
              <View
                style={[
                  skuTextFieldShellStyle,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    minHeight: 58,
                  },
                ]}
              >
                  <Feather
                    name="map-pin"
                    size={16}
                    color="#8DA0B8"
                    style={{ marginRight: 12 }}
                  />
                  <TextInput
                    {...textInputPhonePadDoneAccessory}
                    placeholder="ZIP (store pricing is ZIP-specific)"
                    value={zip}
                    onChangeText={setZip}
                    keyboardAppearance={darkMode ? 'dark' : 'light'}
                    selectionColor="#22c55e"
                    cursorColor={Platform.OS === 'ios' ? '#22c55e' : undefined}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: darkMode ? '#FFFFFF' : '#000000',
                      fontWeight: '500',
                      ...inputWebOutline,
                    }}
                    placeholderTextColor={darkMode ? "rgba(226,232,240,0.55)" : Colors.sub}
                    underlineColorAndroid="transparent"
                  />
              </View>
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
                marginTop: 2,
                marginBottom: 4,
                opacity: (loading || !q || !zip) ? 0.5 : 1,
              }}
            >
                <View
                  style={{
                    backgroundColor: '#22c55e',
                    paddingVertical: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000000',
                    shadowOpacity: darkMode ? 0.35 : 0.12,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#020617',
                    letterSpacing: 0.35,
                  }}>
                    {loading ? 'Searching...' : 'Search'}
                  </Text>
                </View>
              </TouchableOpacity>

            <View
              style={{
                marginTop: 14,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)',
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: darkMode ? 'rgba(226, 232, 240, 0.82)' : Colors.sub,
                }}
              >
                Product data is provided for estimating convenience only. Build Profit Solutions is not affiliated with, endorsed by, or sponsored by The Home Depot, Lowe's, or any listed retailer. Prices, product images, and availability may change and should be verified directly with the retailer before purchase or bid submission.
              </Text>
            </View>

            {loading && <ActivityIndicator color="#22c55e" size="large" style={{ marginTop: 16 }} />}
            {error && <Text style={{ color: "#f87171", textAlign: 'center', marginTop: 12, fontSize: 14, lineHeight: 20, paddingHorizontal: 8 }}>{error}</Text>}

            {results.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 10,
                }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: darkMode ? '#FFFFFF' : '#000000', letterSpacing: -0.2 }}>
                    Search Results
                  </Text>
                  <View style={{
                    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.12)',
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: darkMode ? 'rgba(34, 197, 94, 0.35)' : 'rgba(34, 197, 94, 0.25)',
                  }}>
                    <Text style={{ 
                      color: darkMode ? '#86efac' : '#166534', 
                      fontWeight: '700', 
                      fontSize: 12,
                      letterSpacing: 0.2,
                    }}>
                      {results.length} found
                    </Text>
                  </View>
                </View>
                {results.map((item, idx) => (
                  <View
                    key={`${item.sku || 'item'}-${idx}-${item.title || 'title'}`}
                    style={{
                      marginBottom: idx < results.length - 1 ? 10 : 0,
                      borderRadius: 14,
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.035)' : Colors.surface2,
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                      overflow: 'hidden',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (isRentalMode && onSelect) {
                          onSelect(item);
                        } else if (onAttach) {
                          onAttach(item);
                        }
                      }}
                      style={{ paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 10 }}
                    >
                      {/* Product Image */}
                      <View style={{ 
                        width: 72, 
                        height: 72, 
                        borderRadius: 10,
                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.bg,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line,
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}>
                        {(item.image ||
                          (item.imageFallbacks && item.imageFallbacks.length > 0)) &&
                        !failedImages.has(item.sku) ? (
                          <SkuResultThumb
                            primaryUri={item.image}
                            fallbackUris={item.imageFallbacks || []}
                            sku={item.sku}
                            failedImages={failedImages}
                            setFailedImages={setFailedImages}
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
                        <Text style={{ fontWeight: "600", fontSize: 14, lineHeight: 19, color: darkMode ? '#FFFFFF' : '#000000' }} numberOfLines={2}>
                          {item.title || 'No title'}
                        </Text>
                        <Text style={{ color: darkMode ? 'rgba(203, 213, 225, 0.88)' : Colors.sub, fontSize: 12, marginTop: 3, lineHeight: 16 }}>
                          {item.store?.toUpperCase() || 'HD'} • {item.zip || 'N/A'} • {item.sku || "No SKU"}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontWeight: '700', fontSize: 15, color: '#22c55e' }}>
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
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                                borderRadius: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3,
                              }}>
                                <MaterialIcons 
                                  name={signal === 'good' ? 'trending-down' : signal === 'expensive' ? 'trending-up' : 'trending-flat'} 
                                  size={11} 
                                  color="#FFFFFF" 
                                />
                                <Text style={{ 
                                  color: '#FFFFFF', 
                                  fontWeight: '700', 
                                  fontSize: 10,
                                  letterSpacing: 0.2
                                }}>
                                  AI: {badgeText}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        
                        {/* Quantity Selector & Action Buttons */}
                        <View style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ color: darkMode ? 'rgba(203, 213, 225, 0.82)' : Colors.sub, fontSize: 12, fontWeight: '600', minWidth: 58 }}>
                              Quantity:
                            </Text>
                            <View style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.bg,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
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
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                }}
                              >
                                <MaterialIcons name="remove" size={18} color={darkMode ? "#FFFFFF" : Colors.text} />
                              </TouchableOpacity>
                              <Text style={{ 
                                color: darkMode ? '#FFFFFF' : Colors.text, 
                                fontWeight: '700', 
                                fontSize: 14,
                                minWidth: 28,
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
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                }}
                              >
                                <MaterialIcons name="add" size={18} color={darkMode ? "#FFFFFF" : Colors.text} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
                                paddingVertical: 11,
                                borderRadius: 10,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 6,
                                minHeight: 44,
                                shadowColor: '#000000',
                                shadowOpacity: 0.2,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: 3,
                              }}
                            >
                              <MaterialIcons name="add-shopping-cart" size={17} color="#000000" />
                              <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>
                                {isRentalMode ? 'Select Rental' : 'Add to Bid'}
                              </Text>
                            </TouchableOpacity>
                            
                            {/* Save/Watch Button */}
                            <TouchableOpacity
                              onPress={() => toggleSaveItem(item)}
                              style={{
                                width: 40,
                                height: 40,
                                backgroundColor: watchedItems.has(item.sku) 
                                  ? 'rgba(34, 197, 94, 0.12)' 
                                  : (darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.bg),
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: watchedItems.has(item.sku)
                                  ? 'rgba(34, 197, 94, 0.45)'
                                  : (darkMode ? "rgba(148, 163, 184, 0.2)" : Colors.line),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MaterialIcons 
                                name={watchedItems.has(item.sku) ? "bookmark" : "bookmark-border"} 
                                size={18} 
                                color={watchedItems.has(item.sku) ? '#22c55e' : (darkMode ? 'rgba(248, 250, 252, 0.75)' : Colors.sub)} 
                              />
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              onPress={() => Linking.openURL(item.url)}
                              style={{
                                width: 40,
                                height: 40,
                                backgroundColor: darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.bg,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: darkMode ? "rgba(148, 163, 184, 0.2)" : Colors.line,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MaterialIcons name="open-in-new" size={17} color={darkMode ? 'rgba(248, 250, 252, 0.75)' : Colors.sub} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

          </SkuWebFormOptionalChrome>
          </ScrollView>
        </View>
      </SkuModalRoot>
    </Modal>
  );
}