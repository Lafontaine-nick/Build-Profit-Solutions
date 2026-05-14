import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Dimensions,
  PanResponder,
  Animated,
  StatusBar,
  StyleSheet,
  Switch,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import GradientRingBackInner from './GradientRingBackInner';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { GooglePlacesResultsFooter } from '@/components/AttributionBadge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTrade } from '../lib/trades';
import { clerkAuthService } from '@/services/clerkAuth';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';
import { withProjectLeadsAuth } from '@/utils/projectLeadsAuthFetch';
import { syncBpsDirectoryListing } from '@/services/bpsDirectorySync';
import { SubWebFormOptionalChrome } from '@/components/SubWebFormOptionalChrome';

function extractZipFromGeocode(addresses: { postalCode?: string | null }[]): string | null {
  for (const a of addresses) {
    const raw = (a.postalCode || '').trim();
    const z = raw.replace(/\D/g, '').slice(0, 5);
    if (z.length === 5) return z;
  }
  return null;
}

function digitsOnlyBudget(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Thousands separators for display only; submit with digitsOnlyBudget. */
function formatBudgetWithCommas(raw: string): string {
  const d = digitsOnlyBudget(raw);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** RN Web: `Alert.alert` often fails for validation/success; use browser alert on web. */
function alertSimple(title: string, message?: string) {
  const combined = message ? `${title}\n\n${message}` : title;
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.alert === 'function'
  ) {
    window.alert(combined);
    return;
  }
  Alert.alert(title, message ?? '');
}

/** Dynamic import can succeed while native methods are missing — validate before calling. */
async function loadExpoLocationNative(): Promise<any | null> {
  try {
    const mod: any = await import('expo-location');
    const api =
      typeof mod.requestForegroundPermissionsAsync === 'function'
        ? mod
        : typeof mod.default?.requestForegroundPermissionsAsync === 'function'
          ? mod.default
          : null;
    if (api && typeof api.getCurrentPositionAsync === 'function') {
      return api;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** ZIP + optional Google address hint so web users see where Safari/Core Location placed the pin. */
type ReverseGeocodeBackendResult = {
  zip: string | null;
  locality?: string | null;
  adminArea1?: string | null;
};

/** Use backend Google Geocoding for accurate US ZIP (free APIs often snap to wrong boundary, e.g. 88914 vs 89141). */
async function reverseGeocodeViaBackend(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeBackendResult> {
  try {
    const base = resolveBackendRestApiBaseUrl();
    const url = `${base}/geocode/reverse?lat=${encodeURIComponent(
      String(latitude)
    )}&lng=${encodeURIComponent(String(longitude))}&_=${encodeURIComponent(String(Date.now()))}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return { zip: null };
    const data = await r.json().catch(() => ({}));
    const z = String(data?.zip ?? '')
      .replace(/\D/g, '')
      .slice(0, 5);
    const zipOk = z.length === 5 ? z : null;
    const locality =
      typeof data?.locality === 'string' && data.locality.trim() ? data.locality.trim() : null;
    const adminArea1 =
      typeof data?.adminArea1 === 'string' && data.adminArea1.trim()
        ? data.adminArea1.trim()
        : null;
    return { zip: zipOk, locality, adminArea1 };
  } catch (e) {
    console.warn('Backend reverse geocode failed', e);
    return { zip: null };
  }
}

/** OSM fallback — CORS * when backend Google reverse geocode is unavailable. */
async function reverseGeocodeWebNominatim(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
        String(latitude)
      )}&lon=${encodeURIComponent(String(longitude))}&format=json&addressdetails=1`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const data = await r.json();
    const pc = String(data?.address?.postcode ?? '')
      .replace(/\D/g, '')
      .slice(0, 5);
    return pc.length === 5 ? pc : null;
  } catch (e) {
    console.warn('Web reverse geocode (Nominatim) failed', e);
    return null;
  }
}

/** Match backend geocode.js — only ask server to refine when GPS is in Clark County valley. */
function inLasVegasMetroBBoxClient(lat: number, lng: number): boolean {
  return lat >= 35.88 && lat <= 36.45 && lng >= -115.55 && lng <= -114.85;
}

/** After OSM Nominatim ZIP, snap to the postal polygon that actually contains the point (89074 vs 88914, etc.). */
async function refineZipLasVegasClient(
  latitude: number,
  longitude: number,
  zip: string | null
): Promise<string | null> {
  const z5 = zip?.replace(/\D/g, '').slice(0, 5);
  if (!z5 || z5.length !== 5) return zip;
  if (!inLasVegasMetroBBoxClient(latitude, longitude)) return z5;
  try {
    const base = resolveBackendRestApiBaseUrl();
    const url = `${base}/geocode/refine-neighbor-zip?lat=${encodeURIComponent(
      String(latitude)
    )}&lng=${encodeURIComponent(String(longitude))}&zip=${encodeURIComponent(z5)}&_=${encodeURIComponent(
      String(Date.now())
    )}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return z5;
    const data = await r.json().catch(() => ({}));
    const z = String(data?.zip ?? '')
      .replace(/\D/g, '')
      .slice(0, 5);
    return z.length === 5 ? z : z5;
  } catch {
    return z5;
  }
}

/** Resolve coordinates to a US ZIP. Native requires expo-location (dynamic import). Web uses HTTP fallback only. */
async function reverseGeocodeToZip(
  latitude: number,
  longitude: number,
  expoLocationApi?: any
): Promise<string | null> {
  if (Platform.OS === 'web') {
    const fromBackend = await reverseGeocodeViaBackend(latitude, longitude);
    if (fromBackend.zip) return fromBackend.zip;
    const fromOsm = await reverseGeocodeWebNominatim(latitude, longitude);
    return refineZipLasVegasClient(latitude, longitude, fromOsm);
  }

  let Location = expoLocationApi;
  if (!Location || typeof Location.reverseGeocodeAsync !== 'function') {
    Location = await loadExpoLocationNative();
    if (!Location || typeof Location.reverseGeocodeAsync !== 'function') {
      return null;
    }
  }
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    const zipRaw = extractZipFromGeocode(addresses);
    const zipRefined = await refineZipLasVegasClient(latitude, longitude, zipRaw);
    if (zipRefined) return zipRefined;
  } catch (e) {
    console.warn('reverseGeocodeAsync failed', e);
  }
  return null;
}

const TRADE_OPTIONS = [
  'All Trades',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Framing',
  'Drywall',
  'Painting',
  'Roofing',
  'Flooring',
  'Concrete',
  'Landscaping',
];

const RADIUS_MI_OPTIONS = [10, 25, 50] as const;

/** Map Google Places API (backend) row → in-app subcontractor card model. */
function mapGooglePlacesRowToSub(row: any, selectedTrade: string): any {
  const tradeLabel =
    selectedTrade !== 'All Trades'
      ? selectedTrade
      : row.primaryTypeDisplayName || 'Contractor';
  const specialties = (row.types || [])
    .filter((t: string) => t && !t.startsWith('establishment'))
    .slice(0, 5)
    .map((t: string) => String(t).replace(/_/g, ' '));
  const status = row.businessStatus
    ? String(row.businessStatus).replace(/_/g, ' ').toLowerCase()
    : '—';
  const isBps = row.source === 'bps' || row.bpsVerified === true;
  return {
    id: row.placeId,
    placeId: row.placeId,
    name: row.name,
    trade: tradeLabel,
    rating: row.rating ?? 0,
    reviews: row.reviewCount ?? 0,
    hourlyRate: { min: 0, max: 0 },
    hideHourlyRate: true,
    location: row.formattedAddress || '—',
    distance: typeof row.distanceMiles === 'number' ? row.distanceMiles : null,
    licensed: false,
    insured: false,
    availability: status,
    image: null,
    specialties: specialties.length ? specialties : [tradeLabel],
    phone: row.phone || null,
    website: row.website || null,
    url: row.website || row.googleMapsUri || null,
    googleMapsUri: row.googleMapsUri || null,
    businessStatus: row.businessStatus || null,
    formattedAddress: row.formattedAddress || null,
    fetchedAt: row.fetchedAt || null,
    primaryTypeDisplayName: row.primaryTypeDisplayName || null,
    types: Array.isArray(row.types) ? row.types : [],
    source: isBps ? 'bps' : 'google_places',
    sourceLabel: isBps ? 'BPS' : 'Google',
    unverifiedLabel: isBps ? 'Verified by BPS' : 'Not verified by BPS',
    bpsVerified: isBps,
  };
}

interface SubcontractorSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (subcontractor: any) => void;
  defaultZip?: string;
  onPhotoClick?: (photo: any, index: number) => void;
  onOpenChat?: (conversationId: string, participantName: string, participantCompany: string) => void;
}

/** Parent often passes `""` when bid has no ZIP — use a sensible Las Vegas–area default for search. */
function initialZipFromProp(z?: string): string {
  const digits = (z ?? '').replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : '89141';
}

function SubcontractorSearchModal({
  visible,
  onClose,
  onSelect,
  defaultZip,
  onPhotoClick,
}: SubcontractorSearchModalProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  /** Shared UI tokens — Find Subcontractors + Contractor Profile polish */
  const subMeta = darkMode ? 'rgba(203, 213, 225, 0.82)' : Colors.sub;
  const subMeta2 = darkMode ? 'rgba(148, 163, 184, 0.9)' : Colors.sub;
  const subCard = {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.045)' : Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line,
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const headerRule = darkMode ? "rgba(148, 163, 184, 0.1)" : "rgba(0,0,0,0.06)";
  const webColumn860 = isWeb
    ? { width: "100%" as const, maxWidth: 860, alignSelf: "center" as const }
    : undefined;
  const inputWebOutline =
    Platform.OS === 'web'
      ? { outlineStyle: 'none' as const, outlineWidth: 0 }
      : {};
  /** Same border/fill as estimate Step 1 customer fields + main search inputs on this modal */
  const requestFormInputShell = {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: darkMode ? '#f8fafc' : Colors.text,
    ...inputWebOutline,
  };
  /** Wide enough to sit Refresh + Request in one row without cramming (native phones stay stacked). */
  const subSearchActionsRow = Dimensions.get("window").width >= 520;
  const [selectedTrade, setSelectedTrade] = useState('All Trades');
  const [zipCode, setZipCode] = useState(() => initialZipFromProp(defaultZip));
  const zipCodeRef = useRef(zipCode);
  zipCodeRef.current = zipCode;
  const [radiusMiles, setRadiusMiles] = useState<number>(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [googlePlacesResults, setGooglePlacesResults] = useState<any[]>([]);
  /** Server returned metadata.disabled (e.g. GOOGLE_PLACES_API_KEY missing on local backend). */
  const [placesDisabledMessage, setPlacesDisabledMessage] = useState<string | null>(null);
  /** Server ignored GPS because it was far from the ZIP (common with desktop Safari). */
  const [gpsZipMismatchNote, setGpsZipMismatchNote] = useState<string | null>(null);
  /** When set, Google search is biased and distance-filtered from device GPS (corrects wrong reverse-ZIP in the field). */
  const [searchAnchor, setSearchAnchor] = useState<{ lat: number; lng: number } | null>(null);
  /** Web: city/state from Google for the browser’s GPS — clarifies when Safari places the pin far from where you expect */
  const [geoHint, setGeoHint] = useState<string | null>(null);
  /** Web: navigator accuracy radius — coarse Wi‑Fi/IP positioning on desktop Safari */
  const [geoAccuracyWarning, setGeoAccuracyWarning] = useState<string | null>(null);
  /** Profile-linked directory listing (same keys as Profile → Find Subcontractors). */
  const [bpsDiscoverListOn, setBpsDiscoverListOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [submittedRequests, setSubmittedRequests] = useState<Set<string>>(new Set());
  
  // Animation for smooth transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Chat state
  
  // Enhanced filtering for campaign data
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [requestFormData, setRequestFormData] = useState({
    trade: '',
    customTrade: '',
    projectName: '',
    budgetMax: '',
    timeline: 'Normal' as 'Normal' | 'Soon' | 'Urgent',
    description: '',
  });
  
  // Get user ID for creating requests
  const getUserId = () => {
    try {
      const authState = clerkAuthService.getAuthState();
      return authState?.user?.id || authState?.user?.email || 'contractor-demo';
    } catch (e) {
      // Fallback to stored profile
      return 'contractor-demo';
    }
  };

  const persistBpsDiscoverability = React.useCallback(async (listOn: boolean) => {
    try {
      const z = zipCode.replace(/\D/g, '').slice(0, 5);
      const raw = await AsyncStorage.getItem('bps.contractorProfile');
      const profile = raw ? JSON.parse(raw) : {};
      const next = {
        ...profile,
        listOnFindSubcontractors: listOn,
        serviceZip: z,
      };
      await AsyncStorage.setItem('bps.contractorProfile', JSON.stringify(next));
      await syncBpsDirectoryListing({
        id: String(getUserId()),
        companyName: next.company || '',
        contactName: next.name || '',
        email: next.email || '',
        phone: String(next.phone || '').replace(/\D/g, ''),
        website: next.website || '',
        trades: next.role ? [next.role] : ['General Contractor'],
        zip: z,
        listOnFindSubcontractors: listOn && z.length === 5,
      });
    } catch (e) {
      console.warn('persistBpsDiscoverability', e);
    }
  }, [zipCode]);

  // When discoverability is on, keep stored / backend ZIP aligned with the search bar ZIP.
  useEffect(() => {
    if (!visible || !bpsDiscoverListOn) return;
    const z = zipCode.replace(/\D/g, '').slice(0, 5);
    if (z.length !== 5) return;
    const t = setTimeout(() => void persistBpsDiscoverability(true), 450);
    return () => clearTimeout(t);
  }, [zipCode, visible, bpsDiscoverListOn, persistBpsDiscoverability]);

  // Animate transition when switching between views
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showRequestForm ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showRequestForm]);

  // Load campaigns and convert to subcontractor format
  const loadCampaigns = async () => {
    try {
      const storedCampaigns = await AsyncStorage.getItem('subcontractorCampaigns');
      if (storedCampaigns) {
        const campaignData = JSON.parse(storedCampaigns);
        setCampaigns(campaignData);
        console.log('📱 Loaded campaigns:', campaignData.length);
        console.log('📱 Campaign data:', campaignData);
        if (campaignData.length > 0) {
          console.log('📸 First campaign portfolio:', campaignData[0].portfolio);
        }
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  // Convert campaign to subcontractor format
  const convertCampaignToSubcontractor = (campaign: any) => {
    const primaryService = campaign.services[0] || 'General Contracting';
    const avgRate = (campaign.pricing.hourlyRate.min + campaign.pricing.hourlyRate.max) / 2;
    
    // Convert campaign to subcontractor format
    
    return {
      id: `campaign-${campaign.id}`,
      name: campaign.companyName,
      trade: primaryService,
      rating: 4.5, // Default rating for campaigns
      reviews: 0, // New campaigns start with 0 reviews
      hourlyRate: campaign.pricing.hourlyRate,
      location: campaign.serviceAreas[0] ? `${campaign.serviceAreas[0].city}, ${campaign.serviceAreas[0].state}` : 'Service Area',
      distance: 5.0, // Default distance
      licensed: !!campaign.licenseNumber,
      insured: !!campaign.insuranceProvider,
      availability: campaign.availability.schedule === 'immediate' ? 'Available Now' : 
                   campaign.availability.schedule === '1-2 weeks' ? 'Available in 1-2 weeks' : 'Available Soon',
      image: 'https://via.placeholder.com/80',
      specialties: campaign.specialties || [],
      // Campaign-specific data
      hasCampaign: true,
      campaignVerified: true,
      portfolioPhotos: campaign.portfolio?.length || 0,
      portfolio: campaign.portfolio || [], // Include actual portfolio photos
      responseTime: campaign.responseTime,
      yearsExperience: campaign.yearsExperience,
      teamSize: campaign.teamSize,
      certifications: campaign.certifications,
      serviceAreas: campaign.serviceAreas,
      projectMinimum: campaign.pricing.projectMinimum,
      specialtyPricing: campaign.pricing.specialties,
      // Contact info
      contactName: campaign.contactName,
      email: campaign.email,
      phone: campaign.phone,
      website: campaign.website,
      // Source identification — BPS campaign profiles (not Google/Yelp).
      source: 'bps_verified',
      sourceLabel: 'BPS Network',
      sourceColor: '#8B5CF6',
    };
  };

  // When the modal opens: reset filters, then auto-run a nearby search so the list is not empty
  // until the user taps Search / Refresh (state from this render is passed via overrides).
  useEffect(() => {
    if (!visible) return undefined;

    loadCampaigns();
    setGooglePlacesResults([]);
    setPlacesDisabledMessage(null);
    setSelectedTrade('All Trades');
    setSearchQuery('');
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem('bps.contractorProfile');
        if (raw) {
          const p = JSON.parse(raw);
          setBpsDiscoverListOn(!!p.listOnFindSubcontractors);
        }
      } catch {
        /* ignore */
      }
    })();

    const z = zipCodeRef.current.replace(/\D/g, '').slice(0, 5);
    if (z.length !== 5) return undefined;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      fetchGooglePlacesContractors(z, undefined, undefined, {
        textQuery: '',
        trade: 'All Trades',
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Reset photo viewer state when profile modal closes


  const filterByTradeAndQuery = (subs: any[]) => {
    let filtered = [...subs];
    if (selectedTrade !== 'All Trades') {
      const canon = normalizeTrade(selectedTrade);
      filtered = filtered.filter((sub) => normalizeTrade(sub.trade) === canon);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((sub) => {
        // Places search already sent `q` to the backend; results are relevant even when
        // the keyword does not appear verbatim in the card (e.g. "Framer" → general contractors).
        if (sub.source === 'google_places' || sub.source === 'bps') {
          return true;
        }
        const certs = sub.certifications;
        const certMatch =
          certs && certs.some((cert: string) => cert.toLowerCase().includes(q));
        const baseMatch =
          sub.name?.toLowerCase().includes(q) ||
          sub.trade?.toLowerCase().includes(q) ||
          certMatch;
        return baseMatch;
      });
    }
    return filtered;
  };

  const campaignSubcontractors = useMemo(
    () => campaigns.map(convertCampaignToSubcontractor),
    [campaigns]
  );

  const realBpsRows = useMemo(
    () => filterByTradeAndQuery(campaignSubcontractors),
    [selectedTrade, searchQuery, campaigns, campaignSubcontractors]
  );

  const apiBpsDirectoryRows = useMemo(
    () => filterByTradeAndQuery(googlePlacesResults.filter((s) => s.source === 'bps')),
    [selectedTrade, searchQuery, googlePlacesResults]
  );

  const combinedBpsRows = useMemo(
    () => [...realBpsRows, ...apiBpsDirectoryRows],
    [realBpsRows, apiBpsDirectoryRows]
  );

  const googleRowsFiltered = useMemo(
    () => filterByTradeAndQuery(googlePlacesResults.filter((s) => s.source !== 'bps')),
    [selectedTrade, searchQuery, googlePlacesResults]
  );

  const resultSections = useMemo(() => {
    const sections: { key: string; title: string; rows: any[] }[] = [];
    if (combinedBpsRows.length > 0) {
      sections.push({
        key: 'bps',
        title: 'Verified BPS Subcontractors',
        rows: combinedBpsRows,
      });
    }
    if (googleRowsFiltered.length > 0) {
      sections.push({
        key: 'google',
        title: 'Nearby Google Results',
        rows: googleRowsFiltered,
      });
    }
    return sections;
  }, [combinedBpsRows, googleRowsFiltered]);

  const hasAnyResults = resultSections.length > 0;

  const fetchGooglePlacesContractors = async (
    zipOverride?: string,
    radiusOverride?: number,
    anchorForRequest?: { lat: number; lng: number },
    opts?: { textQuery?: string; trade?: string }
  ) => {
    try {
      setPlacesDisabledMessage(null);
      setGpsZipMismatchNote(null);
      const zip = (zipOverride ?? zipCode).replace(/\D/g, '');
      if (zip.length < 5) {
        Alert.alert('ZIP code', 'Enter a 5-digit ZIP so we can search near the job site.');
        return;
      }
      const radius = radiusOverride ?? radiusMiles;
      const apiBase = resolveBackendRestApiBaseUrl();
      const tradeForRequest = opts?.trade ?? selectedTrade;
      const q =
        opts && Object.prototype.hasOwnProperty.call(opts, 'textQuery')
          ? String(opts.textQuery ?? '').trim()
          : searchQuery.trim();
      const anchor = anchorForRequest ?? searchAnchor;
      const anchorQs =
        anchor != null
          ? `&anchorLat=${encodeURIComponent(String(anchor.lat))}&anchorLng=${encodeURIComponent(
              String(anchor.lng)
            )}`
          : '';
      const url =
        `${apiBase}/places/contractors/search?trade=${encodeURIComponent(
          tradeForRequest
        )}&zip=${encodeURIComponent(zip)}&limit=15&radiusMiles=${encodeURIComponent(
          String(radius)
        )}` +
        (q ? `&q=${encodeURIComponent(q)}` : '') +
        anchorQs;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 429) {
          const retrySec = response.headers.get('Retry-After');
          const wait =
            retrySec && /^\d+$/.test(retrySec.trim())
              ? ` Try again in about ${retrySec.trim()} seconds.`
              : ' Try again in a few minutes.';
          throw new Error(
            `Too many search requests from this device (server rate limit).${wait} For local dev, raise RATE_LIMIT_MAX_REQUESTS or set DISABLE_API_RATE_LIMIT=true in backend/.env.`
          );
        }
        let detail = '';
        try {
          const errBody = await response.json();
          detail = errBody?.error || '';
        } catch {
          /* ignore */
        }
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (data.metadata?.disabled) {
        setGooglePlacesResults([]);
        const msg =
          typeof data.metadata?.message === 'string' && data.metadata.message.trim()
            ? data.metadata.message.trim()
            : 'Nearby Google search is turned off on this server (missing GOOGLE_PLACES_API_KEY).';
        setPlacesDisabledMessage(msg);
        console.warn('Google Places:', data.metadata?.message || 'Disabled on server.');
        setGpsZipMismatchNote(null);
        return;
      }
      if (data.metadata?.geocodeFailed) {
        setGooglePlacesResults([]);
        const msg =
          typeof data.metadata?.message === 'string' && data.metadata.message.trim()
            ? data.metadata.message.trim()
            : 'Could not locate this ZIP on the map — check the ZIP or Geocoding API configuration.';
        setPlacesDisabledMessage(msg);
        setGpsZipMismatchNote(null);
        return;
      }
      setPlacesDisabledMessage(null);
      if (data.metadata?.anchorDroppedDueToZipMismatch) {
        const mi = data.metadata.anchorZipMismatchMiles;
        setGpsZipMismatchNote(
          typeof mi === 'number'
            ? `Browser location was about ${mi} mi from ZIP ${zip}, so search used your ZIP area instead.`
            : `Browser location did not match your ZIP — search used your ZIP area instead.`
        );
      } else {
        setGpsZipMismatchNote(null);
      }
      const mapped = (data.results || []).map((r: any) =>
        mapGooglePlacesRowToSub(r, tradeForRequest)
      );
      setGooglePlacesResults(mapped);
    } catch (error: any) {
      console.error('Error fetching Google Places contractors:', error);
      setPlacesDisabledMessage(null);
      setGpsZipMismatchNote(null);
      setGooglePlacesResults([]);
      Alert.alert(
        'Search unavailable',
        typeof error?.message === 'string' && error.message
          ? error.message
          : 'Could not load nearby businesses. Check your connection and that the backend has GOOGLE_PLACES_API_KEY set.'
      );
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCampaigns(), fetchGooglePlacesContractors()]);
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLocating(true);
    try {
      let lat: number;
      let lng: number;
      let expoLocationApi: any;
      let webAccuracyM: number | undefined;

      if (Platform.OS === 'web') {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        webAccuracyM = pos.coords.accuracy;
      } else {
        expoLocationApi = await loadExpoLocationNative();
        if (!expoLocationApi) {
          Alert.alert(
            'Rebuild dev app',
            'This build doesn’t include the location native module (expo-location). Run a new EAS development build, or enter your ZIP manually.'
          );
          return;
        }
        const { status } = await expoLocationApi.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location needed',
            'Allow location to fill your ZIP from where you are, or enter a ZIP manually.'
          );
          return;
        }
        const pos = await expoLocationApi.getCurrentPositionAsync({
          accuracy: expoLocationApi.Accuracy?.High ?? expoLocationApi.Accuracy?.Balanced ?? 4,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      setSearchAnchor({ lat, lng });
      setZipCode('');
      setGeoHint(null);
      setGeoAccuracyWarning(null);

      let zip: string | null = null;

      if (Platform.OS === 'web') {
        if (typeof webAccuracyM === 'number') {
          if (webAccuracyM > 25000) {
            setGeoAccuracyWarning(
              `Rough location (~${Math.round(webAccuracyM / 1000)} km accuracy). Desktop Safari often uses Wi‑Fi or IP — disable VPN, allow Precise Location for localhost, or enter ZIP manually.`
            );
          } else if (webAccuracyM > 6000) {
            setGeoAccuracyWarning(
              `Approximate location (~${Math.round(webAccuracyM / 1000)} km). Confirm ZIP if needed.`
            );
          }
        }

        const br = await reverseGeocodeViaBackend(lat, lng);
        if (br.locality || br.adminArea1) {
          setGeoHint([br.locality, br.adminArea1].filter(Boolean).join(', ') || null);
        }
        zip = br.zip;
        if (!zip) {
          const fromOsm = await reverseGeocodeWebNominatim(lat, lng);
          zip = await refineZipLasVegasClient(lat, lng, fromOsm);
          setGeoHint(null);
        }
      } else {
        zip = await reverseGeocodeToZip(lat, lng, expoLocationApi);
      }

      if (!zip) {
        setSearchAnchor(null);
        Alert.alert(
          'Could not resolve ZIP',
          'We could not look up a ZIP for this location. Enter your ZIP manually.'
        );
        return;
      }
      setZipCode(zip);
      setLocating(false);

      setLoading(true);
      try {
        await Promise.all([loadCampaigns(), fetchGooglePlacesContractors(zip, undefined, { lat, lng })]);
      } finally {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Use my location failed', error);
      Alert.alert(
        'Location error',
        typeof error?.message === 'string' && error.message
          ? error.message
          : 'Could not get your location. Try entering a ZIP manually.'
      );
    } finally {
      setLocating(false);
    }
  };

  const openGoogleMaps = (sub: any) => {
    const uri = sub.googleMapsUri;
    if (uri) Linking.openURL(uri);
  };

  const dialPhone = (sub: any) => {
    const raw = (sub.phone || '').replace(/\D/g, '');
    if (raw.length >= 10) Linking.openURL(`tel:${sub.phone}`);
  };

  const openWebsite = (sub: any) => {
    const w = sub.website || sub.url;
    if (w) Linking.openURL(w.startsWith('http') ? w : `https://${w}`);
  };

  const openContractorProfile = async (sub: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sub.source === 'google_places' && sub.placeId) {
      try {
        const apiBase = resolveBackendRestApiBaseUrl();
        const q = encodeURIComponent(sub.placeId);
        const res = await fetch(`${apiBase}/places/contractors/details?placeId=${q}`);
        if (res.ok) {
          const data = await res.json();
          const merged = {
            ...sub,
            ...mapGooglePlacesRowToSub(data.details || data, selectedTrade),
            editorialSummary: data.editorialSummary,
            currentOpeningHours: data.currentOpeningHours,
            profileLocation: data.location,
          };
          setSelectedSubcontractor(merged);
          setShowProfile(true);
          return;
        }
      } catch (e) {
        console.warn('Place details fetch failed', e);
      }
    }
    setSelectedSubcontractor(sub);
    setShowProfile(true);
  };

  const handleSelectSubcontractor = (sub: any) => {
    console.log('🔄 handleSelectSubcontractor called with:', sub.name);
    try {
      const isGoogleListing = sub.source === 'google_places';
      const isBpsListing = sub.source === 'bps';
      const defaultRate =
        sub.hourlyRate && typeof sub.hourlyRate.min === 'number' && sub.hourlyRate.min > 0
          ? sub.hourlyRate.min
          : 0;
      const subData = {
        name: sub.name,
        trade: sub.trade,
        rate: isGoogleListing || isBpsListing || sub.hideHourlyRate ? 0 : defaultRate,
        mode: 'hourly',
        laborType: 'subcontractor',
        hours: 0,
        metadata: {
          rating: sub.rating,
          reviews: sub.reviews,
          location: sub.location,
          licensed: isGoogleListing ? false : !!sub.licensed,
          insured: isGoogleListing ? false : !!sub.insured,
          source: sub.source,
          placeId: sub.placeId,
        }
      };
      console.log('📤 Calling onSelect with:', subData);
      onSelect(subData);
      console.log('✅ onSelect completed, calling onClose');
      onClose();
      console.log('✅ onClose completed');
    } catch (error) {
      console.error('❌ Error in handleSelectSubcontractor:', error);
    }
  };

  const handleRequestSubcontractor = async () => {
    // Reset form and animate to request form
    console.log('📝 Opening Request Subcontractor form modal');
    const preTrade = selectedTrade !== 'All Trades' ? selectedTrade : '';
    setRequestFormData({
      trade: '',
      customTrade: preTrade,
      projectName: '',
      budgetMax: '',
      timeline: 'Normal',
      description: '',
    });
    setShowRequestForm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  
  const handleBackFromRequest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowRequestForm(false);
  };

  const createSubRequest = async () => {
    if (isSubmitting) return;
    
    // Prevent rapid submissions (debounce)
    const now = Date.now();
    if (now - lastSubmissionTime < 3000) { // 3 second cooldown
      alertSimple('Please wait', 'Please wait a moment before submitting another request.');
      return;
    }
    
    // Validate form data before submitting
    if (!requestFormData.trade && !requestFormData.customTrade) {
      alertSimple('Error', 'Please enter a trade type.');
      return;
    }
    
    const budgetDigits = digitsOnlyBudget(requestFormData.budgetMax);
    if (!budgetDigits) {
      alertSimple('Error', 'Please enter maximum budget.');
      return;
    }

    setIsSubmitting(true);
    setLastSubmissionTime(now);

    try {
      const budgetMax = parseInt(budgetDigits, 10) || 5000;
      const userId = getUserId();
      const tradeValue = requestFormData.customTrade || requestFormData.trade;

      /** GC “sub need” posts are scoped to the ZIP shown on Find Subcontractors (not a hardcoded metro). */
      const zip = zipCode.replace(/\D/g, '').slice(0, 5);
      if (zip.length !== 5) {
        alertSimple(
          'ZIP required',
          'Enter a 5-digit job ZIP at the top of Find Subcontractors before requesting subs. That ZIP sets where your request is posted and matched.'
        );
        setIsSubmitting(false);
        return;
      }

      const apiBase = resolveBackendRestApiBaseUrl();
      const geoRes = await fetch(
        `${apiBase}/geocode/zip-locality?zip=${encodeURIComponent(zip)}`,
        { cache: 'no-store' }
      );
      const geo = await geoRes.json().catch(() => ({}));
      if (geoRes.status === 503 && geo?.disabled) {
        throw new Error(
          typeof geo.message === 'string' && geo.message.trim()
            ? geo.message
            : 'ZIP lookup is not available on this server (geocoding API key).'
        );
      }
      if (!geo.ok || !geo.state || !geo.city) {
        alertSimple(
          'ZIP not found',
          'We could not resolve this ZIP to a city and state. Check the ZIP and try again.'
        );
        setIsSubmitting(false);
        return;
      }

      const requestData: any = {
        title: requestFormData.projectName || `${tradeValue} Work Needed`,
        trade: normalizeTrade(tradeValue),
        projectId: `PRJ-${Date.now()}`,
        city: geo.city,
        state: geo.state,
        zip: geo.zip || zip,
        budgetMax: budgetMax,
        timeline: requestFormData.timeline,
        createdBy: userId,
        description:
          requestFormData.description ||
          `Looking for qualified ${tradeValue} subcontractors near ${geo.city}, ${geo.state}.`,
      };

      const requestSignature = `${zip}|${normalizeTrade(requestData.trade)}-${requestData.budgetMax}-${requestData.timeline}`;
      
      if (submittedRequests.has(requestSignature)) {
        alertSimple(
          'Duplicate Request',
          'You have already submitted a similar request. Change trade, budget, or timeline and try again.'
        );
        setIsSubmitting(false);
        return;
      }
      
      // Add to submitted requests
      setSubmittedRequests(prev => new Set([...prev, requestSignature]));

      // Explicitly remove budgetMin if it exists (shouldn't, but just in case)
      const { budgetMin, ...cleanRequestData } = requestData as any;
      
      console.log('🚀 BULLETPROOF REQUEST:', cleanRequestData);
      console.log('📋 Request keys:', Object.keys(cleanRequestData));
      console.log('📋 budgetMin explicitly removed?', !('budgetMin' in cleanRequestData));
      console.log('📋 budgetMax in request?', 'budgetMax' in cleanRequestData, cleanRequestData.budgetMax);

      const response = await fetch(
        `${apiBase}/project-leads`,
        await withProjectLeadsAuth({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cleanRequestData),
        })
      );

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        let detail = errorText.trim();
        try {
          const j = JSON.parse(errorText);
          if (typeof j.message === 'string') detail = j.message;
        } catch {
          /* plain text body */
        }
        if (response.status === 429) {
          throw new Error(
            'Too many API requests (server rate limit). Wait about a minute and try again. For local dev, raise RATE_LIMIT_MAX_REQUESTS or set DISABLE_API_RATE_LIMIT=true in backend/.env.'
          );
        }
        throw new Error(detail ? `API Error: ${detail}` : `Request failed (${response.status})`);
      }

      const result = await response.json();
      console.log('✅ SUCCESS:', result);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRequestForm(false);
      
      // Reset form data to prevent duplicate submissions
      setRequestFormData({
        trade: '',
        customTrade: '',
        projectName: '',
        budgetMax: '',
        timeline: 'Normal',
        description: '',
      });
      
      const matchedCount = result.matchedContractorsCount || result.matchedContractors?.length || 0;
      const contractorList = result.matchedContractors?.slice(0, 3).map((c: any) => `• ${c.name || c.company || 'Contractor'}`).join('\n') || '';
      const moreText = matchedCount > 3 ? `\n...and ${matchedCount - 3} more` : '';
      const summaryBody = [
        `Your ${requestData.trade.toLowerCase()} request has been posted!`,
        '',
        matchedCount > 0
          ? `Matched with ${matchedCount} qualified contractor${matchedCount > 1 ? 's' : ''}:\n${contractorList}${moreText}`
          : `No contractors matched yet. We'll notify you when matches are found.`,
        '',
        'You can view it in the Leads tab.',
      ].join('\n');

      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        typeof window.alert === 'function'
      ) {
        window.alert(`🎉 Request Posted!\n\n${summaryBody}`);
        const goLeads =
          typeof window.confirm === 'function' &&
          window.confirm('Open the Leads tab now?');
        if (goLeads) {
          onClose();
          setTimeout(() => router.push('/(tabs)/leads'), 300);
        }
      } else {
        Alert.alert('🎉 Request Posted!', summaryBody, [
          {
            text: 'View in Leads',
            onPress: () => {
              onClose();
              setTimeout(() => {
                router.push('/(tabs)/leads');
              }, 300);
            },
            style: 'default',
          },
          {
            text: 'OK',
            onPress: () => {
              setShowRequestForm(false);
            },
          },
        ]);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        error instanceof Error ? error.message : 'Failed to create subcontractor request. Please try again.';
      // Defer alert so React can paint the button state off "Sending…" (window.alert blocks the main thread).
      const showErr = () => alertSimple('Error', msg);
      if (Platform.OS === 'web' && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(showErr, 0));
      } else {
        setTimeout(showErr, 0);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}>
        <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}>
          <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} translucent={false} />

          {/* Find Subcontractors View */}
          <Animated.View
            style={{
              flex: 1,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -Dimensions.get('window').width],
                }),
              }],
              opacity: slideAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.3, 0],
              }),
              position: showRequestForm ? 'absolute' : 'relative',
              width: '100%',
              height: '100%',
            }}
            pointerEvents={showRequestForm ? 'none' : 'auto'}
          >
          {!isWeb && (
          <>
          {/* Header Section — title centered; back balances right spacer */}
          <View style={{
            paddingHorizontal: 22,
            paddingTop: Math.max(insets.top, 0) + 10,
            paddingBottom: 14,
            backgroundColor: darkMode ? '#000000' : Colors.bg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.06)',
          }}>
              <View style={[{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, webColumn860]}>
              <View style={{ width: 52, alignItems: 'flex-start' }}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 19,
                      backgroundColor: darkMode ? '#000000' : Colors.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={24}
                      color={darkMode ? '#FFFFFF' : Colors.text}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>

              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: darkMode ? '#FFFFFF' : '#000000', fontSize: 23, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' }}>
                  Find Subcontractors
                </Text>
                <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub, fontSize: 13, marginTop: 5, lineHeight: 18, fontWeight: '500', textAlign: 'center' }}>
                  Search for qualified contractors
                </Text>
              </View>

              <View style={{ width: 52 }} />
              </View>
            </View>
          </>
          )}

          {/* Scrollable Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={
              isWeb
                ? {
                    paddingTop: Math.max(insets.top, 8),
                    paddingBottom: 40,
                    paddingHorizontal: 32,
                    flexGrow: 1,
                    width: '100%',
                    maxWidth: 1040,
                    alignSelf: 'center',
                  }
                : {
              paddingTop: 14,
              paddingBottom: 40,
              paddingHorizontal: 20,
              ...(webColumn860 ? { alignItems: 'center' } : {}),
            }
            }
            showsVerticalScrollIndicator={false}
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
              <View style={{ width: 52, alignItems: 'flex-start', marginRight: 4 }}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 19,
                      backgroundColor: darkMode ? '#000000' : Colors.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : Colors.text} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: darkMode ? '#FFFFFF' : Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 }}>
                  Find Subcontractors
                </Text>
                <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub, fontSize: 14, marginTop: 4, fontWeight: '500' }}>
                  Search for qualified contractors
                </Text>
              </View>
            </View>
          )}
          <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>
          {/* Trade Selector */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000', marginBottom: 8, fontSize: 11, fontWeight: '600', letterSpacing: 0.45, textTransform: 'uppercase' }}>Trade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
              {TRADE_OPTIONS.map(trade => (
                <TouchableOpacity
                  key={trade}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTrade(trade);
                  }}
                  style={{
                    backgroundColor: selectedTrade === trade
                      ? 'rgba(34, 197, 94, 0.16)'
                      : (darkMode ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2),
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 14,
                    marginRight: 0,
                    borderWidth: 1.5,
                    borderColor: selectedTrade === trade
                      ? '#22c55e'
                      : (darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line),
                  }}
                >
                  <Text style={{ color: selectedTrade === trade ? (darkMode ? '#86efac' : '#166534') : (darkMode ? '#f1f5f9' : '#000000'), fontWeight: '700', fontSize: 12 }}>
                    {trade}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search Inputs */}
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or specialty..."
                placeholderTextColor={darkMode ? "rgba(226,232,240,0.55)" : Colors.sub}
                style={{
                  flex: 1,
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : Colors.surface2,
                  color: darkMode ? '#FFFFFF' : '#000000',
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.32)' : Colors.line,
                  fontSize: 15,
                  ...inputWebOutline,
                }}
              />
              <TextInput
                value={zipCode}
                onChangeText={(t) => {
                  setSearchAnchor(null);
                  setGeoHint(null);
                  setGeoAccuracyWarning(null);
                  setGpsZipMismatchNote(null);
                  setZipCode(t);
                }}
                placeholder="ZIP"
                placeholderTextColor={darkMode ? "rgba(226,232,240,0.55)" : Colors.sub}
                keyboardType="phone-pad"
                textContentType="none"
                autoComplete="off"
                maxLength={5}
                style={{
                  width: 86,
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : Colors.surface2,
                  color: darkMode ? '#FFFFFF' : '#000000',
                  paddingHorizontal: 10,
                  paddingVertical: 11,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.32)' : Colors.line,
                  fontSize: 15,
                  textAlign: 'center',
                  ...inputWebOutline,
                }}
              />
            </View>
            <Text
              style={{
                color: subMeta,
                fontSize: 11,
                lineHeight: 15,
                marginTop: 6,
              }}
            >
                Based on your location (US); may differ from mailing ZIP near boundaries.
            </Text>
            {isWeb && (geoHint || geoAccuracyWarning) ? (
              <View style={{ marginTop: 8 }}>
                {geoHint ? (
                  <Text style={{ color: subMeta, fontSize: 12, lineHeight: 17 }}>
                    Browser placed this point near: {geoHint}
                  </Text>
                ) : null}
                {geoAccuracyWarning ? (
                  <Text
                    style={{
                      color: darkMode ? '#fbbf24' : '#b45309',
                      fontSize: 12,
                      marginTop: geoHint ? 4 : 0,
                      lineHeight: 17,
                    }}
                  >
                    {geoAccuracyWarning}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Radius from geocoded ZIP center (server-side filter) */}
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                  marginBottom: 8,
                  fontSize: 11,
                  fontWeight: '600',
                  letterSpacing: 0.45,
                  textTransform: 'uppercase',
                }}
              >
                Within ({searchAnchor ? 'your location' : 'ZIP center'})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                {RADIUS_MI_OPTIONS.map((mi) => (
                  <TouchableOpacity
                    key={mi}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRadiusMiles(mi);
                      const z = zipCode.replace(/\D/g, '');
                      if (z.length !== 5) return;
                      setLoading(true);
                      try {
                        await Promise.all([loadCampaigns(), fetchGooglePlacesContractors(undefined, mi)]);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      backgroundColor:
                        radiusMiles === mi
                          ? 'rgba(34, 197, 94, 0.16)'
                          : darkMode
                            ? 'rgba(255, 255, 255, 0.04)'
                            : Colors.surface2,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor:
                        radiusMiles === mi
                          ? '#22c55e'
                          : darkMode
                            ? 'rgba(148, 163, 184, 0.2)'
                            : Colors.line,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          radiusMiles === mi
                            ? darkMode
                              ? '#86efac'
                              : '#166534'
                            : darkMode
                              ? '#f1f5f9'
                              : '#000000',
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      {mi} mi
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={handleUseMyLocation}
              disabled={loading || locating}
              accessibilityRole="button"
              accessibilityLabel="Use my location to fill ZIP and search"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                alignSelf: 'flex-start',
                opacity: loading || locating ? 0.65 : 1,
              }}
            >
              <MaterialIcons
                name="my-location"
                size={20}
                color={darkMode ? '#4ade80' : '#16a34a'}
              />
              <Text
                style={{
                  color: darkMode ? '#86efac' : '#15803d',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                {locating ? 'Getting location…' : 'Use my location'}
              </Text>
            </TouchableOpacity>

            <View
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line,
              }}
            >
              <Text
                style={{
                  color: darkMode ? 'rgba(248, 250, 252, 0.82)' : Colors.text,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.45,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Your company on Find Subcontractors
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 14, fontWeight: '600' }}>
                  Show my company in search
                </Text>
                <Switch
                  value={bpsDiscoverListOn}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const z = zipCode.replace(/\D/g, '').slice(0, 5);
                    if (v && z.length !== 5) {
                      Alert.alert(
                        'ZIP needed',
                        'Set the ZIP in the search bar above (or tap Use my location) so we can place your listing in the right area.'
                      );
                      return;
                    }
                    setBpsDiscoverListOn(v);
                    void persistBpsDiscoverability(v);
                  }}
                  trackColor={{ false: darkMode ? '#334155' : '#cbd5e1', true: '#22c55e' }}
                  thumbColor="#f8fafc"
                  ios_backgroundColor={darkMode ? '#334155' : '#cbd5e1'}
                />
              </View>
              <Text style={{ color: subMeta, fontSize: 11, marginTop: 8, lineHeight: 15 }}>
                Uses your Profile name, company, and role. Listing uses the ZIP shown above for this search (location-aware).
              </Text>
            </View>
          </View>

          {/* Search & Request Buttons */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: subSearchActionsRow ? 'row' : 'column', gap: 10, alignItems: 'stretch' }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSearch();
              }}
              activeOpacity={0.9}
              disabled={loading || locating}
              style={{
                flex: 1,
                borderRadius: 12,
                overflow: 'hidden',
                opacity: loading || locating ? 0.88 : 1,
              }}
            >
              {isWeb ? (
                <View
                  style={{
                    paddingVertical: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 42,
                    backgroundColor: "#22c55e",
                    shadowColor: "#000000",
                    shadowOpacity: darkMode ? 0.25 : 0.12,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 3,
                  }}
                >
                  <Text style={{ color: '#020617', textAlign: 'center', fontWeight: '700', fontSize: 14, letterSpacing: 0.15 }}>
                    {loading ? 'Searching...' : 'Search / Refresh'}
                  </Text>
                </View>
              ) : (
              <LinearGradient
                colors={['#22c55e', '#22d3ee']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 42,
                  shadowColor: '#000000',
                  shadowOpacity: darkMode ? 0.25 : 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <Text style={{ color: '#020617', textAlign: 'center', fontWeight: '700', fontSize: 14, letterSpacing: 0.15 }}>
                  {loading ? 'Searching...' : 'Search / Refresh'}
                </Text>
              </LinearGradient>
              )}
            </TouchableOpacity>

            {/* Request Subcontractor Button */}
            <TouchableOpacity
              onPress={() => {
                console.log('🔘 Request Subcontractor button pressed');
                console.log('📊 Current showRequestForm state:', showRequestForm);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleRequestSubcontractor();
                console.log('✅ handleRequestSubcontractor called');
              }}
              disabled={loading || locating}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                minHeight: 42,
              }}
            >
              <MaterialIcons name="send" size={17} color={darkMode ? 'rgba(226, 232, 240, 0.85)' : Colors.sub} />
              <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.92)' : Colors.text, textAlign: 'center', fontWeight: '600', fontSize: 13 }}>
                Request Subcontractor
              </Text>
            </TouchableOpacity>
            </View>
          </View>

            {/* Loading */}
            {(loading || locating) && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={{ color: '#FFFFFF', marginTop: 12 }}>
                  {loading ? 'Searching...' : 'Getting location...'}
                </Text>
              </View>
            )}

            {/* Results */}
            {!loading && !locating && hasAnyResults && (
              <View>
                <Text style={{ color: darkMode ? '#FFFFFF' : '#000000', fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 12 }}>
                  {combinedBpsRows.length + googleRowsFiltered.length} Subcontractor
                  {combinedBpsRows.length + googleRowsFiltered.length !== 1 ? 's' : ''} found
                </Text>
                {gpsZipMismatchNote ? (
                  <Text
                    style={{
                      color: darkMode ? '#fbbf24' : '#b45309',
                      fontSize: 13,
                      lineHeight: 18,
                      marginBottom: 12,
                      marginTop: -6,
                    }}
                  >
                    {gpsZipMismatchNote}
                  </Text>
                ) : null}

                {resultSections.map((section) => (
                  <View key={section.key} style={{ marginBottom: 6 }}>
                    <Text
                      style={{
                        color: darkMode ? 'rgba(226, 232, 240, 0.92)' : Colors.text,
                        fontSize: 13,
                        fontWeight: '700',
                        letterSpacing: 0.2,
                        textTransform: 'uppercase',
                        marginBottom: 10,
                        marginTop: section.key === 'google' ? 14 : 0,
                      }}
                    >
                      {section.title}
                    </Text>
                    {section.rows.map((sub) => {
                      const isGoogle = sub.source === 'google_places';
                      const isBpsListing = sub.source === 'bps';
                      const isSample = sub.source === 'sample' || sub.source === 'demo';
                      const locLine =
                        sub.location +
                        (sub.distance != null && sub.distance !== ''
                          ? ` (${sub.distance} mi)`
                          : '');
                      const sourceBadgeBg =
                        isGoogle
                          ? darkMode
                            ? 'rgba(59, 130, 246, 0.14)'
                            : 'rgba(37, 99, 235, 0.08)'
                          : isBpsListing
                            ? darkMode
                              ? 'rgba(34, 197, 94, 0.18)'
                              : 'rgba(22, 163, 74, 0.1)'
                          : sub.source === 'yelp'
                            ? darkMode
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'rgba(239, 68, 68, 0.08)'
                            : isSample
                              ? darkMode
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(245, 158, 11, 0.08)'
                              : darkMode
                                ? 'rgba(255, 255, 255, 0.06)'
                                : Colors.surface2;
                      const sourceBadgeBorder =
                        isGoogle
                          ? 'rgba(96, 165, 250, 0.35)'
                          : isBpsListing
                            ? 'rgba(52, 211, 153, 0.45)'
                          : sub.source === 'yelp'
                            ? 'rgba(248, 113, 113, 0.28)'
                            : isSample
                              ? 'rgba(245, 158, 11, 0.35)'
                              : darkMode
                                ? 'rgba(148, 163, 184, 0.22)'
                                : Colors.line;
                      const sourceIcon =
                        sub.source === 'bps_verified' || sub.hasCampaign
                          ? 'campaign'
                          : sub.source === 'bps'
                            ? 'verified'
                          : sub.source === 'yelp'
                            ? 'business'
                            : isGoogle
                              ? 'map'
                              : isSample
                                ? 'science'
                                : sub.source === 'app'
                                  ? 'person'
                                  : 'apps';
                      const sourceIconColor =
                        isGoogle
                          ? darkMode
                            ? '#93c5fd'
                            : '#1d4ed8'
                          : isBpsListing
                            ? darkMode
                              ? '#86efac'
                              : '#15803d'
                          : sub.source === 'yelp'
                            ? darkMode
                              ? '#fca5a5'
                              : '#b91c1c'
                            : isSample
                              ? darkMode
                                ? '#fbbf24'
                                : '#b45309'
                              : darkMode
                                ? 'rgba(226,232,240,0.75)'
                                : Colors.sub;
                      const sourceTextColor =
                        isGoogle
                          ? darkMode
                            ? '#bfdbfe'
                            : '#1e3a8a'
                          : isBpsListing
                            ? darkMode
                              ? '#bbf7d0'
                              : '#14532d'
                          : sub.source === 'yelp'
                            ? darkMode
                              ? '#fca5a5'
                              : '#b91c1c'
                            : isSample
                              ? darkMode
                                ? '#fcd34d'
                                : '#b45309'
                              : darkMode
                                ? 'rgba(226,232,240,0.85)'
                                : Colors.text;
                      const googleQuickBtn = {
                        flexDirection: 'row' as const,
                        alignItems: 'center' as const,
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                      };

                      return (
                        <View
                          key={String(sub.id || sub.placeId)}
                          style={{
                            marginBottom: 10,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.045)' : Colors.surface2,
                            borderLeftWidth: 3,
                            borderLeftColor: isGoogle
                              ? 'rgba(96, 165, 250, 0.5)'
                              : isBpsListing
                                ? 'rgba(34, 197, 94, 0.55)'
                                : 'rgba(45, 255, 196, 0.45)',
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              borderRadius: 11,
                              overflow: 'hidden',
                              backgroundColor: darkMode ? Colors.card : Colors.bg,
                              borderWidth: 0,
                            }}
                          >
                            <TouchableOpacity
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                backgroundColor: 'transparent',
                              }}
                              onPress={() => openContractorProfile(sub)}
                              activeOpacity={0.85}
                            >
                              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'flex-start',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                      marginBottom: 6,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: darkMode ? '#f8fafc' : '#000000',
                                        fontSize: 16,
                                        fontWeight: '700',
                                        lineHeight: 22,
                                        flex: 1,
                                      }}
                                    >
                                      {sub.name}
                                    </Text>
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        flexShrink: 0,
                                        gap: 4,
                                        flexWrap: 'wrap',
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      <View
                                        style={{
                                          backgroundColor: sourceBadgeBg,
                                          paddingHorizontal: 7,
                                          paddingVertical: 3,
                                          borderRadius: 8,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          borderWidth: 1,
                                          borderColor: sourceBadgeBorder,
                                        }}
                                      >
                                        <MaterialIcons name={sourceIcon as any} size={11} color={sourceIconColor} />
                                        <Text
                                          style={{
                                            color: sourceTextColor,
                                            fontSize: 10,
                                            fontWeight: '600',
                                            marginLeft: 3,
                                          }}
                                        >
                                          {sub.sourceLabel || 'Network'}
                                        </Text>
                                      </View>
                                      {isBpsListing ? (
                                        <>
                                          <View
                                            style={{
                                              backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.14)' : 'rgba(22, 163, 74, 0.08)',
                                              paddingHorizontal: 7,
                                              paddingVertical: 3,
                                              borderRadius: 8,
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              borderWidth: 1,
                                              borderColor: 'rgba(52, 211, 153, 0.4)',
                                            }}
                                          >
                                            <MaterialIcons name={'verified' as any} size={11} color={sourceIconColor} />
                                            <Text
                                              style={{
                                                color: sourceTextColor,
                                                fontSize: 10,
                                                fontWeight: '700',
                                                marginLeft: 3,
                                              }}
                                            >
                                              BPS
                                            </Text>
                                          </View>
                                          <View
                                            style={{
                                              backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.06)',
                                              paddingHorizontal: 7,
                                              paddingVertical: 3,
                                              borderRadius: 8,
                                              borderWidth: 1,
                                              borderColor: 'rgba(52, 211, 153, 0.35)',
                                            }}
                                          >
                                            <Text
                                              style={{
                                                color: darkMode ? '#86efac' : '#166534',
                                                fontSize: 10,
                                                fontWeight: '700',
                                              }}
                                            >
                                              Verified by BPS
                                            </Text>
                                          </View>
                                        </>
                                      ) : null}
                                      {!isBpsListing && isGoogle && sub.unverifiedLabel ? (
                                        <View
                                          style={{
                                            backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15,23,42,0.06)',
                                            paddingHorizontal: 7,
                                            paddingVertical: 3,
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              color: darkMode ? 'rgba(226,232,240,0.82)' : Colors.sub,
                                              fontSize: 10,
                                              fontWeight: '600',
                                            }}
                                          >
                                            {sub.unverifiedLabel}
                                          </Text>
                                        </View>
                                      ) : null}
                                      {sub.campaignVerified && !isGoogle ? (
                                        <MaterialIcons name="verified" size={14} color="#10B981" />
                                      ) : null}
                                    </View>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                    <MaterialIcons name="star" size={15} color="#fbbf24" style={{ marginRight: 4 }} />
                                    <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '700', marginRight: 6 }}>
                                      {typeof sub.rating === 'number' && !Number.isNaN(sub.rating)
                                        ? sub.rating.toFixed(1)
                                        : sub.rating}
                                    </Text>
                                    <Text style={{ color: subMeta, fontSize: 13 }}>({sub.reviews} reviews)</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <View
                                      style={{
                                        backgroundColor: isWeb ? '#22c55e' : 'rgba(34, 197, 94, 0.2)',
                                        paddingHorizontal: 9,
                                        paddingVertical: 4,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: isWeb ? '#22c55e' : 'rgba(34, 197, 94, 0.35)',
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: isWeb ? '#000000' : darkMode ? '#86efac' : '#166534',
                                          fontSize: 11,
                                          fontWeight: '700',
                                        }}
                                      >
                                        {sub.trade}
                                      </Text>
                                    </View>
                                    {isGoogle ? (
                                      <Text style={{ color: subMeta, fontSize: 11, fontWeight: '500' }}>
                                        Public Google listing
                                      </Text>
                                    ) : null}
                                    {!isGoogle && sub.licensed ? (
                                      <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 11, fontWeight: '600' }}>
                                        ✓ Licensed
                                      </Text>
                                    ) : null}
                                    {!isGoogle && sub.insured ? (
                                      <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 11, fontWeight: '600' }}>
                                        ✓ Insured
                                      </Text>
                                    ) : null}
                                    {sub.hasCampaign ? (
                                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        <View
                                          style={{
                                            backgroundColor: '#8B5CF6',
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                            borderRadius: 8,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <MaterialIcons name="campaign" size={10} color="#FFFFFF" />
                                          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '600', marginLeft: 2 }}>
                                            CAMPAIGN CREATOR
                                          </Text>
                                        </View>
                                        {sub.portfolioPhotos ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialIcons name="photo-library" size={12} color="#43cea2" />
                                            <Text style={{ color: '#43cea2', fontSize: 11, marginLeft: 2 }}>
                                              {sub.portfolioPhotos}
                                            </Text>
                                          </View>
                                        ) : null}
                                        {sub.yearsExperience ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialIcons name="work" size={12} color="#F59E0B" />
                                            <Text style={{ color: '#F59E0B', fontSize: 11, marginLeft: 2 }}>
                                              {sub.yearsExperience}y
                                            </Text>
                                          </View>
                                        ) : null}
                                        {sub.responseTime ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <MaterialIcons name="schedule" size={12} color="#3B82F6" />
                                            <Text style={{ color: '#3B82F6', fontSize: 11, marginLeft: 2 }}>
                                              {String(sub.responseTime).replace('_', ' ')}
                                            </Text>
                                          </View>
                                        ) : null}
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              <View style={{ marginBottom: 8, gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <MaterialIcons name="place" size={16} color={subMeta2} style={{ marginTop: 1 }} />
                                  <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18, flex: 1 }}>{locLine}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <MaterialIcons name="payments" size={16} color={subMeta2} style={{ marginTop: 1 }} />
                                  <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18, flex: 1 }}>
                                    {sub.hideHourlyRate
                                      ? 'Pricing not listed — contact for quote'
                                      : `$${sub.hourlyRate.min}-${sub.hourlyRate.max}/hr`}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <MaterialIcons name="event-available" size={16} color={subMeta2} style={{ marginTop: 1 }} />
                                  <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18, flex: 1 }}>
                                    {sub.availability}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {(sub.specialties || []).map((spec: string) => (
                                  <View
                                    key={spec}
                                    style={{
                                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.bg,
                                      paddingHorizontal: 9,
                                      paddingVertical: 4,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: darkMode ? 'rgba(248, 250, 252, 0.9)' : Colors.text,
                                        fontSize: 11,
                                        fontWeight: '500',
                                      }}
                                    >
                                      {spec}
                                    </Text>
                                  </View>
                                ))}
                              </View>

                              {isGoogle ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                  {sub.phone ? (
                                    <TouchableOpacity
                                      style={googleQuickBtn}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    dialPhone(sub);
                                  }}
                                    >
                                      <MaterialIcons name="call" size={16} color="#34d399" />
                                      <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontWeight: '600', fontSize: 12 }}>
                                        Call
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                  {sub.website || sub.url ? (
                                    <TouchableOpacity
                                      style={googleQuickBtn}
                                      onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        openWebsite(sub);
                                      }}
                                    >
                                      <MaterialIcons name="language" size={16} color="#60a5fa" />
                                      <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontWeight: '600', fontSize: 12 }}>
                                        Website
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                  {sub.googleMapsUri ? (
                                    <TouchableOpacity
                                      style={googleQuickBtn}
                                      onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        openGoogleMaps(sub);
                                      }}
                                    >
                                      <MaterialIcons name="map" size={16} color="#fbbf24" />
                                      <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontWeight: '600', fontSize: 12 }}>
                                        Google Maps
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : null}

                              <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                  style={{
                                    flex: 1,
                                    backgroundColor: '#22c55e',
                                    paddingVertical: 9,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#000000',
                                    shadowOpacity: 0.12,
                                    shadowRadius: 4,
                                    shadowOffset: { width: 0, height: 1 },
                                    elevation: 2,
                                  }}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    handleSelectSubcontractor(sub);
                                  }}
                                >
                                  <Text style={{ color: '#020617', fontWeight: '700', fontSize: 14 }}>Add to Bid</Text>
                                </TouchableOpacity>
                                {sub.hasCampaign ? (
                                  <TouchableOpacity
                                    style={{
                                      flex: 1,
                                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                                      paddingVertical: 9,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line,
                                      alignItems: 'center',
                                      flexDirection: 'row',
                                      justifyContent: 'center',
                                    }}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      console.log('🖱️ Contact button pressed for:', sub.name);
                                    }}
                                  >
                                    <MaterialIcons name="campaign" size={16} color={darkMode ? 'rgba(248,250,252,0.85)' : Colors.text} />
                                    <Text
                                      style={{
                                        color: darkMode ? 'rgba(248,250,252,0.88)' : Colors.text,
                                        fontWeight: '600',
                                        fontSize: 13,
                                        marginLeft: 4,
                                      }}
                                    >
                                      Contact
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={{
                                      flex: 1,
                                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                                      paddingVertical: 9,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onPress={() => {
                                      openContractorProfile(sub);
                                    }}
                                  >
                                    <Text style={{ color: darkMode ? 'rgba(248,250,252,0.88)' : Colors.text, fontWeight: '600', fontSize: 13 }}>
                                      View Profile
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}

                {googleRowsFiltered.length > 0 ? (
                  <GooglePlacesResultsFooter darkMode={darkMode} style={{ marginTop: 8, marginBottom: 20 }} />
                ) : null}
              </View>
            )}

            {/* No Results */}
            {!loading && !locating && !hasAnyResults && (
              <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60 }}>
                <MaterialIcons name="search-off" size={64} color="#8DA0B8" />
                <Text style={{ color: darkMode ? '#FFFFFF' : Colors.text, fontSize: 18, textAlign: 'center', marginTop: 16, fontWeight: '600' }}>
                  {placesDisabledMessage ? 'Nearby search unavailable' : 'No subcontractors found'}
                </Text>
                <Text style={{ color: darkMode ? '#8DA0B8' : Colors.sub, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                  {placesDisabledMessage ||
                    "Try another ZIP, trade, or radius — or tap Request Subcontractor above."}
                </Text>
              </View>
            )}
          </SubWebFormOptionalChrome>
          </ScrollView>
          </Animated.View>
          
          {/* Request Subcontractor Form View */}
          <Animated.View
            style={{
              flex: 1,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [Dimensions.get('window').width, 0],
                }),
              }],
              opacity: slideAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.3, 1],
              }),
              position: showRequestForm ? 'relative' : 'absolute',
              width: '100%',
              height: '100%',
            }}
            pointerEvents={showRequestForm ? 'auto' : 'none'}
          >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          {!isWeb && (
          <View style={{
            paddingHorizontal: 22,
            paddingTop: Math.max(insets.top, 0) + 10,
            paddingBottom: 14,
            backgroundColor: darkMode ? '#000000' : Colors.bg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.06)',
          }}>
              <View style={[{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, webColumn860]}>
              <View style={{ width: 52, alignItems: 'flex-start' }}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={handleBackFromRequest}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 19,
                      backgroundColor: darkMode ? '#000000' : Colors.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={24}
                      color={darkMode ? '#FFFFFF' : Colors.text}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>

              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: darkMode ? '#FFFFFF' : '#000000', fontSize: 23, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' }}>
                  Request Subcontractor
                </Text>
                <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub, fontSize: 13, marginTop: 5, lineHeight: 18, fontWeight: '500', textAlign: 'center' }}>
                  Post your subcontractor needs
                </Text>
              </View>

              <View style={{ width: 52 }} />
              </View>
            </View>
          )}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
              isWeb
                ? {
                    paddingTop: Math.max(insets.top, 8),
                    paddingBottom: Math.max(insets.bottom, 12) + 40,
                    paddingHorizontal: 32,
                    flexGrow: 1,
                    width: '100%',
                    maxWidth: 1040,
                    alignSelf: 'center',
                  }
                : {
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom, 12) + 40,
              paddingHorizontal: 20,
              ...(webColumn860 ? { alignItems: 'center' } : {}),
            }
            }
              {...KEYBOARD_SCROLL_DEFAULTS}
              keyboardShouldPersistTaps="always"
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
              <View style={{ width: 52, alignItems: 'flex-start', marginRight: 4 }}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={handleBackFromRequest}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 19,
                      backgroundColor: darkMode ? '#000000' : Colors.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : Colors.text} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: darkMode ? '#FFFFFF' : Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 }}>
                  Request Subcontractor
                </Text>
                <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub, fontSize: 14, marginTop: 4, fontWeight: '500' }}>
                  Post your subcontractor needs
                </Text>
              </View>
            </View>
          )}
          <SubWebFormOptionalChrome isWeb={isWeb} darkMode={darkMode} Colors={Colors} columnStyle={webColumn860}>

      {showProfile && selectedSubcontractor && (
        <Modal
          visible={showProfile}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowProfile(false)}
        >
          <View style={{ flex: 1, backgroundColor: darkMode ? '#000000' : Colors.bg }}>
            <View style={{ flex: 1, paddingTop: 56 }}>
              {/* Back Button */}
              <View style={{
                position: 'absolute',
                top: 48,
                left: 18,
                zIndex: 10,
              }}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowProfile(false);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 19,
                      backgroundColor: darkMode ? '#000000' : Colors.bg,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={24}
                      color={darkMode ? '#FFFFFF' : Colors.text}
                    />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>

              {/* Header */}
              <Text style={{ 
                color: darkMode ? '#f8fafc' : Colors.text, 
                fontSize: 18, 
                fontWeight: '700', 
                textAlign: 'center',
                marginTop: 18,
                marginBottom: 6,
                paddingHorizontal: 56,
                letterSpacing: -0.2,
              }}>
                Contractor Profile
              </Text>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
                {/* Name & Trade */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 24, fontWeight: '700', marginBottom: 10, letterSpacing: -0.35, lineHeight: 30 }}>
                    {selectedSubcontractor.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.35)' }}>
                      <Text style={{ color: darkMode ? '#86efac' : '#166534', fontSize: 13, fontWeight: '700' }}>{selectedSubcontractor.trade}</Text>
                    </View>
                    {selectedSubcontractor.source === 'bps' ? (
                      <>
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.16)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.4)' }}>
                          <Text style={{ color: darkMode ? '#86efac' : '#166534', fontSize: 12, fontWeight: '700' }}>BPS</Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.35)' }}>
                          <Text style={{ color: darkMode ? '#86efac' : '#166534', fontSize: 12, fontWeight: '700' }}>
                            Verified by BPS
                          </Text>
                        </View>
                      </>
                    ) : selectedSubcontractor.source === 'google_places' ? (
                      <>
                        <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.35)' }}>
                          <Text style={{ color: darkMode ? '#bfdbfe' : '#1e40af', fontSize: 12, fontWeight: '700' }}>Google</Text>
                        </View>
                        <View style={{ backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15,23,42,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line }}>
                          <Text style={{ color: subMeta, fontSize: 12, fontWeight: '600' }}>
                            {selectedSubcontractor.unverifiedLabel || 'Not verified by BPS'}
                          </Text>
                        </View>
                      </>
                    ) : null}
                    {selectedSubcontractor.source !== 'google_places' && selectedSubcontractor.source !== 'bps' && selectedSubcontractor.licensed ? (
                      <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#a7f3d0' : '#166534', fontSize: 12, fontWeight: '600' }}>✓ Licensed</Text>
                      </View>
                    ) : null}
                    {selectedSubcontractor.source !== 'google_places' && selectedSubcontractor.source !== 'bps' && selectedSubcontractor.insured ? (
                      <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 12, fontWeight: '600' }}>✓ Insured</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: '700', marginRight: 8 }}>
                      ⭐{' '}
                      {typeof selectedSubcontractor.rating === 'number' && !Number.isNaN(selectedSubcontractor.rating)
                        ? selectedSubcontractor.rating.toFixed(1)
                        : selectedSubcontractor.rating}
                    </Text>
                    <Text style={{ color: subMeta, fontSize: 14 }}>({selectedSubcontractor.reviews} reviews)</Text>
                  </View>
                </View>

                {/* Key Info Cards */}
                <View style={{ gap: 10, marginBottom: 22 }}>
                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>📍 Location</Text>
                    <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>
                      {selectedSubcontractor.location}
                      {selectedSubcontractor.distance != null && selectedSubcontractor.distance !== ''
                        ? ` (${selectedSubcontractor.distance} miles away)`
                        : ''}
                    </Text>
                  </View>

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>💰 Hourly Rate</Text>
                    {selectedSubcontractor.hideHourlyRate || selectedSubcontractor.source === 'google_places' || selectedSubcontractor.source === 'bps' ? (
                      <Text style={{ color: subMeta, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>
                        Not listed for this listing — request a quote to confirm pricing.
                      </Text>
                    ) : (
                      <Text style={{ color: '#4ade80', fontSize: 19, fontWeight: '800', letterSpacing: -0.2 }}>
                        ${selectedSubcontractor.hourlyRate.min} - ${selectedSubcontractor.hourlyRate.max}/hr
                      </Text>
                    )}
                  </View>

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>📅 Availability</Text>
                    <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600', lineHeight: 22 }}>
                      {selectedSubcontractor.availability}
                    </Text>
                  </View>

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 12, letterSpacing: 0.15 }}>📞 Contact</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                      <MaterialIcons name="phone" size={20} color="#4ade80" style={{ marginRight: 12, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: subMeta2, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Phone</Text>
                        {selectedSubcontractor.phone ? (
                          <TouchableOpacity
                            onPress={() => {
                              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                                Linking.openURL(`tel:${selectedSubcontractor.phone}`);
                              }
                            }}
                          >
                            <Text style={{ color: '#4ade80', fontSize: 16, fontWeight: '600', lineHeight: 22 }}>
                              {selectedSubcontractor.phone}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ color: subMeta, fontSize: 15, lineHeight: 22 }}>Not provided</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <MaterialIcons name="email" size={20} color="#60a5fa" style={{ marginRight: 12, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: subMeta2, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Email</Text>
                        {selectedSubcontractor.email ? (
                          <TouchableOpacity
                            onPress={() => {
                              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                                Linking.openURL(`mailto:${selectedSubcontractor.email}`);
                              }
                            }}
                          >
                            <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600', lineHeight: 22 }}>
                              {selectedSubcontractor.email}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ color: subMeta, fontSize: 15, lineHeight: 22 }}>Not provided</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {selectedSubcontractor.source === 'google_places' || selectedSubcontractor.source === 'bps' ? (
                    <View style={{ ...subCard, padding: 18 }}>
                      <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.15 }}>
                        Quick links
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {selectedSubcontractor.website || selectedSubcontractor.url ? (
                          <TouchableOpacity
                            onPress={() => openWebsite(selectedSubcontractor)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: 'rgba(96, 165, 250, 0.35)',
                              backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            }}
                          >
                            <MaterialIcons name="language" size={18} color="#60a5fa" />
                            <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontWeight: '600', fontSize: 14 }}>Website</Text>
                          </TouchableOpacity>
                        ) : null}
                        {selectedSubcontractor.googleMapsUri ? (
                          <TouchableOpacity
                            onPress={() => openGoogleMaps(selectedSubcontractor)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: 'rgba(251, 191, 36, 0.35)',
                              backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            }}
                          >
                            <MaterialIcons name="map" size={18} color="#fbbf24" />
                            <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontWeight: '600', fontSize: 14 }}>Open in Google Maps</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>🏢 Company</Text>
                    <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6, lineHeight: 22 }}>
                      {selectedSubcontractor.company || selectedSubcontractor.name}
                    </Text>
                    {selectedSubcontractor.source === 'google_places' ? (
                      <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                        Public listing from Google Places. Build Profit Solutions has not verified license, insurance, or
                        pricing.
                      </Text>
                    ) : selectedSubcontractor.source === 'bps' ? (
                      <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                        Listed because this company uses Build Profit Solutions. Confirm license, insurance, and pricing
                        directly before hiring.
                      </Text>
                    ) : (
                      <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                        License: {selectedSubcontractor.licenseNumber || 'Not provided'}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Professional Badges */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                    {selectedSubcontractor.source === 'google_places' ? 'Verification' : selectedSubcontractor.source === 'bps' ? 'BPS listing' : 'Professional Credentials'}
                  </Text>
                  {selectedSubcontractor.source === 'google_places' ? (
                    <View style={{ ...subCard, padding: 16 }}>
                      <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22 }}>
                        BPS does not display license or insurance for Google-sourced listings. Confirm credentials
                        directly with the business before hiring.
                      </Text>
                    </View>
                  ) : selectedSubcontractor.source === 'bps' ? (
                    <View style={{ ...subCard, padding: 16 }}>
                      <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22 }}>
                        Directory listings show active BPS accounts only. License and insurance are not verified by BPS
                        here — confirm with the contractor.
                      </Text>
                    </View>
                  ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {/* Licensed Badge */}
                    {selectedSubcontractor.licensed && (
                      <View style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        borderWidth: 1,
                        borderColor: 'rgba(52, 211, 153, 0.45)',
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <MaterialIcons name="verified" size={15} color="#34d399" />
                        <Text style={{ color: '#6ee7b7', fontSize: 12, fontWeight: '600' }}>
                          Licensed
                        </Text>
                      </View>
                    )}
                    
                    {/* Insured Badge */}
                    {selectedSubcontractor.insured && (
                      <View style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(96, 165, 250, 0.4)',
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <MaterialIcons name="security" size={15} color="#60a5fa" />
                        <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '600' }}>
                          Insured
                        </Text>
                      </View>
                    )}
                    
                    {/* Years in Business */}
                    {selectedSubcontractor.yearsExperience && (
                      <View style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(167, 139, 250, 0.4)',
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <MaterialIcons name="business" size={15} color="#a78bfa" />
                        <Text style={{ color: '#c4b5fd', fontSize: 12, fontWeight: '600' }}>
                          {selectedSubcontractor.yearsExperience} Years
                        </Text>
                      </View>
                    )}
                    
                    {/* Response Time */}
                    {selectedSubcontractor.responseTime && (
                      <View style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(251, 191, 36, 0.35)',
                        borderRadius: 999,
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <MaterialIcons name="schedule" size={15} color="#fbbf24" />
                        <Text style={{ color: '#fcd34d', fontSize: 12, fontWeight: '600' }}>
                          {selectedSubcontractor.responseTime === 'within_day' ? 'Quick Response' : 
                           selectedSubcontractor.responseTime === 'within_hour' ? '1 Hour' : 'Quick Response'}
                        </Text>
                      </View>
                    )}
                  </View>
                  )}
                </View>

                {/* Company Bio */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                    About {selectedSubcontractor.name}
                  </Text>
                  <View style={{ ...subCard, padding: 18 }}>
                    <View style={{ alignItems: 'flex-start' }}>
                      {selectedSubcontractor.bio ? (
                        <Text style={{ 
                          color: subMeta, 
                          fontSize: 15, 
                          lineHeight: 24,
                          textAlign: 'left'
                        }}>
                          {selectedSubcontractor.bio}
                        </Text>
                      ) : selectedSubcontractor.source === 'google_places' ? (
                        <View style={{ alignItems: 'flex-start', gap: 8 }}>
                          {typeof selectedSubcontractor.editorialSummary === 'string' &&
                          selectedSubcontractor.editorialSummary.trim() ? (
                            <Text style={{ color: subMeta, fontSize: 15, lineHeight: 24, textAlign: 'left' }}>
                              {selectedSubcontractor.editorialSummary}
                            </Text>
                          ) : null}
                          <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22, textAlign: 'left' }}>
                            This profile is from Google Places. Ratings and reviews reflect public Google data only.
                            Build Profit Solutions has not verified licensing, insurance, pricing, or availability.
                          </Text>
                          {selectedSubcontractor.specialties?.length ? (
                            <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22, textAlign: 'left' }}>
                              Categories: {selectedSubcontractor.specialties.join(', ')}
                            </Text>
                          ) : null}
                        </View>
                      ) : selectedSubcontractor.source === 'bps' ? (
                        <View style={{ alignItems: 'flex-start', gap: 8 }}>
                          <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22, textAlign: 'left' }}>
                            This listing is from the Build Profit Solutions contractor directory (verified account). Ratings
                            from Google are not shown unless this business also appears on Google.
                          </Text>
                          {selectedSubcontractor.specialties?.length ? (
                            <Text style={{ color: subMeta, fontSize: 14, lineHeight: 22, textAlign: 'left' }}>
                              Categories: {selectedSubcontractor.specialties.join(', ')}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ alignItems: 'flex-start', gap: 6 }}>
                          <Text style={{ 
                            color: darkMode ? '#f1f5f9' : Colors.text, 
                            fontSize: 16, 
                            lineHeight: 22,
                            textAlign: 'left',
                            fontWeight: '600',
                            marginBottom: 4
                          }}>
                            Professional {selectedSubcontractor.trade.toLowerCase()} services
                          </Text>
                          
                          <Text style={{ 
                            color: subMeta, 
                            fontSize: 14, 
                            lineHeight: 22,
                            textAlign: 'left',
                          }}>
                            • {selectedSubcontractor.yearsExperience || 'Extensive'} years of experience
                          </Text>
                          
                          <Text style={{ 
                            color: subMeta, 
                            fontSize: 14, 
                            lineHeight: 22,
                            textAlign: 'left',
                          }}>
                            • {selectedSubcontractor.licensed ? 'Fully licensed and ' : ''}{selectedSubcontractor.insured ? 'insured' : 'bonded'} contractor
                          </Text>
                          
                          <Text style={{ 
                            color: subMeta, 
                            fontSize: 14, 
                            lineHeight: 22,
                            textAlign: 'left',
                          }}>
                            • Specializing in {selectedSubcontractor.specialties?.join(', ') || 'quality workmanship'}
                          </Text>
                          
                          <Text style={{ 
                            color: subMeta, 
                            fontSize: 14, 
                            lineHeight: 22,
                            textAlign: 'left',
                          }}>
                            • Available {String(selectedSubcontractor.availability || '').toLowerCase()}
                          </Text>
                          
                          <Text style={{ 
                            color: '#4ade80', 
                            fontSize: 14, 
                            lineHeight: 22,
                            textAlign: 'left',
                            fontWeight: '600',
                            marginTop: 6
                          }}>
                            Competitive rates starting at ${selectedSubcontractor.hourlyRate.min}/hour
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Portfolio Photos */}
                {selectedSubcontractor.portfolioPhotos && selectedSubcontractor.portfolioPhotos > 0 && (
                  <View style={{ marginBottom: 22 }}>
                    <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                      Portfolio ({selectedSubcontractor.portfolioPhotos} photos)
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {selectedSubcontractor.portfolio && selectedSubcontractor.portfolio.length > 0 ? (
                        // Show actual uploaded photos
                        selectedSubcontractor.portfolio.slice(0, 6).map((photo: any, i: number) => (
                          <View
                            key={photo.id || i}
                            style={{ 
                              marginRight: 12, 
                              width: 140, 
                              height: 140, 
                              borderRadius: 12, 
                              overflow: 'hidden',
                              shadowColor: '#43cea2',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 4,
                              elevation: 4,
                              backgroundColor: 'rgba(20, 40, 80, 0.8)',
                            }}
                          >
                            <ZoomImage 
                              uri={photo.uri}
                              thumbStyle={{ 
                                width: '100%', 
                                height: '100%',
                              }}
                              onOpen={() => console.log('🖼️ Photo opened:', photo.uri)}
                            />
                            <View style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>
                                {photo.type?.replace('_', ' ').toUpperCase() || 'PORTFOLIO'}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        // Fallback to sample photos if no portfolio
                        Array.from({ length: Math.min(selectedSubcontractor.portfolioPhotos, 6) }, (_, i) => {
                          const samplePhotos = [
                            'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6b5?w=300&h=300&fit=crop',
                            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop',
                            'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=300&fit=crop',
                            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=300&h=300&fit=crop',
                            'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=300&h=300&fit=crop',
                            'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6b5?w=300&h=300&fit=crop',
                          ];
                          
                          return (
                            <View key={i} style={{ 
                              marginRight: 12, 
                              width: 140, 
                              height: 140, 
                              borderRadius: 12, 
                              overflow: 'hidden',
                              shadowColor: '#43cea2',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 4,
                              elevation: 4,
                              backgroundColor: 'rgba(20, 40, 80, 0.8)',
                            }}>
                              <Image 
                                source={{ uri: samplePhotos[i % samplePhotos.length] }}
                                style={{ 
                                  width: '100%', 
                                  height: '100%',
                                }}
                                resizeMode="cover"
                              />
                              <View style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                              }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600', textAlign: 'center' }}>
                                  {selectedSubcontractor.trade} Work
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Experience & Team */}
                {(selectedSubcontractor.yearsExperience || selectedSubcontractor.teamSize) && (
                  <View style={{ marginBottom: 22 }}>
                    <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                      Experience & Team
                    </Text>
                    <View style={{ ...subCard, padding: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        {selectedSubcontractor.yearsExperience && (
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Experience</Text>
                            <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600' }}>
                              {selectedSubcontractor.yearsExperience} years
                            </Text>
                          </View>
                        )}
                        {selectedSubcontractor.teamSize && (
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Team Size</Text>
                            <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600' }}>
                              {selectedSubcontractor.teamSize} members
                            </Text>
                          </View>
                        )}
                      </View>
                      {selectedSubcontractor.certifications && selectedSubcontractor.certifications.length > 0 && (
                        <View>
                          <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Certifications</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {selectedSubcontractor.certifications.map((cert: string, index: number) => (
                              <View key={index} style={{ backgroundColor: 'rgba(67, 206, 162, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(67, 206, 162, 0.3)' }}>
                                <Text style={{ color: '#43cea2', fontSize: 12, fontWeight: '500' }}>{cert}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Service Areas */}
                {selectedSubcontractor.serviceAreas && selectedSubcontractor.serviceAreas.length > 0 && (
                  <View style={{ marginBottom: 22 }}>
                    <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                      Service Areas
                    </Text>
                    <View style={{ ...subCard, padding: 18 }}>
                      {selectedSubcontractor.serviceAreas.map((area: any, index: number) => (
                        <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: index < selectedSubcontractor.serviceAreas.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line }}>
                          <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600' }}>
                            {area.city}, {area.state}
                          </Text>
                          <Text style={{ color: '#4ade80', fontSize: 14, fontWeight: '600' }}>
                            {area.radius} mile radius
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Specialty Pricing */}
                {selectedSubcontractor.specialtyPricing && Object.keys(selectedSubcontractor.specialtyPricing).length > 0 && (
                  <View style={{ marginBottom: 22 }}>
                    <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                      Specialty Pricing
                    </Text>
                    <View style={{ ...subCard, padding: 18 }}>
                      {Object.entries(selectedSubcontractor.specialtyPricing).map(([specialty, pricing]: [string, any], index, arr) => (
                        <View key={specialty} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: index < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line }}>
                          <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 15, fontWeight: '600' }}>
                            {specialty}
                          </Text>
                          <Text style={{ color: '#4ade80', fontSize: 14, fontWeight: '600' }}>
                            ${pricing.min}-${pricing.max}/hr
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Specialties */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>Specialties</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(selectedSubcontractor.specialties || []).map((spec: string) => (
                      <View key={spec} style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontSize: 13, fontWeight: '600' }}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Experience */}
                {selectedSubcontractor.source !== 'google_places' ? (
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>Experience</Text>
                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta, fontSize: 15, lineHeight: 24 }}>
                      {selectedSubcontractor.yearsExperience} years of professional experience in {selectedSubcontractor.trade.toLowerCase()}. 
                      Completed over {selectedSubcontractor.completedJobs} projects with an average rating of {selectedSubcontractor.rating} stars.
                    </Text>
                  </View>
                </View>
                ) : null}

                {/* Primary actions: bid, then call + message */}
                <View style={{ gap: 10, paddingBottom: 24 }}>
                  {/* Add to Bid Button */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.1)',
                      paddingVertical: 16,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: 'rgba(45, 255, 196, 0.55)',
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8
                    }}
                    onPress={() => {
                      console.log('🆕 NEW BUTTON: Add to Bid pressed');
                      console.log('📋 Subcontractor:', selectedSubcontractor?.name);
                      
                      // SIMPLE APPROACH - Just call onSelect directly without complex logic
                      if (selectedSubcontractor) {
                        const isGoogle = selectedSubcontractor.source === 'google_places';
                        const rateFromHourly =
                          selectedSubcontractor.hourlyRate &&
                          typeof selectedSubcontractor.hourlyRate.min === 'number' &&
                          selectedSubcontractor.hourlyRate.min > 0
                            ? selectedSubcontractor.hourlyRate.min
                            : 0;
                        const simpleSubData = {
                          name: selectedSubcontractor.name,
                          trade: selectedSubcontractor.trade || 'General Contracting',
                          rate: isGoogle || selectedSubcontractor.hideHourlyRate ? 0 : rateFromHourly || 50,
                          mode: 'hourly',
                          laborType: 'subcontractor',
                          hours: 0,
                          metadata: {
                            rating: selectedSubcontractor.rating || 4.5,
                            reviews: selectedSubcontractor.reviews || 0,
                            location: selectedSubcontractor.location || 'Service Area',
                            licensed: isGoogle ? false : !!selectedSubcontractor.licensed,
                            insured: isGoogle ? false : !!selectedSubcontractor.insured,
                            source: selectedSubcontractor.source,
                            placeId: selectedSubcontractor.placeId,
                          }
                        };
                        
                        console.log('📤 Calling onSelect with simple data:', simpleSubData);
                        onSelect(simpleSubData);
                        console.log('✅ onSelect completed');
                        
                        // Close modal
                        setShowProfile(false);
                        console.log('✅ Modal closed');
                      }
                    }}
                  >
                    <MaterialIcons name="add" size={20} color="#4ade80" />
                    <Text style={{ color: '#86efac', fontWeight: '700', fontSize: 16 }}>Add to Bid</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(52, 211, 153, 0.35)',
                        borderRadius: 12,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => {
                        if (Platform.OS === 'ios' || Platform.OS === 'android') {
                          Linking.openURL(`tel:${selectedSubcontractor.phone || selectedSubcontractor.contactPhone}`);
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                    >
                      <MaterialIcons name="phone" size={18} color="#34d399" />
                      <Text style={{ color: '#6ee7b7', fontWeight: '600', fontSize: 14 }}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(167, 139, 250, 0.35)',
                        borderRadius: 12,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={async () => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          const raw = String(
                            selectedSubcontractor.phone ||
                              selectedSubcontractor.contactPhone ||
                              ''
                          ).trim();
                          const digits = raw.replace(/\D/g, '');
                          if (digits.length < 10) {
                            Alert.alert(
                              'No phone number',
                              'This listing does not include a number we can text. Try Call, or use their website if shown above.'
                            );
                            return;
                          }
                          let smsRecipient = digits;
                          if (digits.length === 10) {
                            smsRecipient = `+1${digits}`;
                          } else if (digits.length === 11 && digits.startsWith('1')) {
                            smsRecipient = `+${digits}`;
                          } else {
                            smsRecipient = `+${digits}`;
                          }
                          const url = `sms:${smsRecipient}`;
                          await Linking.openURL(url);
                        } catch (error) {
                          console.error('Error opening Messages:', error);
                          Alert.alert(
                            'Could not open Messages',
                            'Try the Call button, or send a text from your phone using the number on this profile.'
                          );
                        }
                      }}
                    >
                      <MaterialIcons name="message" size={18} color="#a78bfa" />
                      <Text style={{ color: '#c4b5fd', fontWeight: '600', fontSize: 14 }}>Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Trade
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                    {TRADE_OPTIONS.filter((t) => t !== 'All Trades').map((trade) => {
                      const selected = requestFormData.customTrade === trade;
                      return (
                        <TouchableOpacity
                          key={trade}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setRequestFormData({ ...requestFormData, trade: '', customTrade: trade });
                          }}
                          style={{
                            backgroundColor: selected
                              ? 'rgba(34, 197, 94, 0.16)'
                              : darkMode
                                ? 'rgba(255, 255, 255, 0.04)'
                                : Colors.surface2,
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: selected
                              ? '#22c55e'
                              : darkMode
                                ? 'rgba(148, 163, 184, 0.2)'
                                : Colors.line,
                          }}
                        >
                          <Text
                            style={{
                              color: selected
                                ? darkMode
                                  ? '#86efac'
                                  : '#166534'
                                : darkMode
                                  ? '#f1f5f9'
                                  : '#000000',
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {trade}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginTop: 14,
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Or type a trade *
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.customTrade}
                    onChangeText={(text) =>
                      setRequestFormData({ ...requestFormData, trade: '', customTrade: text })
                    }
                    placeholder="e.g. Plumbing, electrical, tile…"
                    placeholderTextColor={darkMode ? 'rgba(226,232,240,0.55)' : Colors.sub}
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Project name <Text style={{ textTransform: 'none', color: subMeta, fontWeight: '600' }}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.projectName}
                    onChangeText={(text) => setRequestFormData({ ...requestFormData, projectName: text })}
                    placeholder="e.g. Kitchen remodel, office build"
                    placeholderTextColor={darkMode ? 'rgba(226,232,240,0.55)' : Colors.sub}
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Job ZIP (search area)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                        minHeight: 46,
                      }}
                    >
                      <Text style={{ color: subMeta, fontSize: 12, lineHeight: 16 }}>
                        Same ZIP as Find Subcontractors (shared). Edit here or on the search screen.
                      </Text>
                    </View>
                    <TextInput
                      value={zipCode}
                      onChangeText={(t) => {
                        setSearchAnchor(null);
                        setGeoHint(null);
                        setGeoAccuracyWarning(null);
                        setGpsZipMismatchNote(null);
                        setZipCode(t);
                      }}
                      placeholder="ZIP"
                      placeholderTextColor={darkMode ? 'rgba(226,232,240,0.55)' : Colors.sub}
                      keyboardType="phone-pad"
                      maxLength={5}
                      style={{
                        width: 86,
                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : Colors.surface2,
                        color: darkMode ? '#FFFFFF' : '#000000',
                        paddingHorizontal: 10,
                        paddingVertical: 11,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.32)' : Colors.line,
                        fontSize: 15,
                        textAlign: 'center',
                        ...inputWebOutline,
                      }}
                    />
                  </View>
                  <Text style={{ color: subMeta, fontSize: 11, lineHeight: 15, marginTop: 6 }}>
                    Based on your location (US); may differ from mailing ZIP near boundaries.
                  </Text>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Maximum budget *
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.budgetMax}
                    onChangeText={(text) =>
                      setRequestFormData({
                        ...requestFormData,
                        budgetMax: formatBudgetWithCommas(text),
                      })
                    }
                    placeholder="$50,000"
                    placeholderTextColor={darkMode ? 'rgba(226,232,240,0.55)' : Colors.sub}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Timeline *
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                    {[
                      { value: 'Normal', label: 'Normal (4+ wk)', color: '#10B981' },
                      { value: 'Soon', label: 'Soon (1–3 wk)', color: '#F59E0B' },
                      { value: 'Urgent', label: 'Urgent (< 1 wk)', color: '#EF4444' },
                    ].map((option) => {
                      const selected = requestFormData.timeline === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          activeOpacity={0.85}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setRequestFormData({ ...requestFormData, timeline: option.value as 'Normal' | 'Soon' | 'Urgent' });
                          }}
                          style={{
                            backgroundColor: selected
                              ? 'rgba(34, 197, 94, 0.16)'
                              : darkMode
                                ? 'rgba(255, 255, 255, 0.04)'
                                : Colors.surface2,
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: selected
                              ? '#22c55e'
                              : darkMode
                                ? 'rgba(148, 163, 184, 0.2)'
                                : Colors.line,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: option.color }} />
                            <Text
                              style={{
                                color: selected
                                  ? darkMode
                                    ? '#86efac'
                                    : '#166534'
                                  : darkMode
                                    ? '#f1f5f9'
                                    : '#000000',
                                fontWeight: '700',
                                fontSize: 12,
                              }}
                            >
                              {option.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      color: darkMode ? 'rgba(248, 250, 252, 0.85)' : '#000000',
                      marginBottom: 8,
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.45,
                      textTransform: 'uppercase',
                    }}
                  >
                    Additional details <Text style={{ textTransform: 'none', color: subMeta, fontWeight: '600' }}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={{
                      ...requestFormInputShell,
                      fontSize: 15,
                      minHeight: 112,
                      textAlignVertical: 'top',
                    }}
                    value={requestFormData.description}
                    onChangeText={(text) => setRequestFormData({ ...requestFormData, description: text })}
                    placeholder="Requirements, site access, materials, or other notes…"
                    placeholderTextColor={darkMode ? 'rgba(226,232,240,0.55)' : Colors.sub}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={{ flexDirection: subSearchActionsRow ? 'row' : 'column', gap: 10, marginBottom: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send subcontractor request"
                    onPress={() => void createSubRequest()}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        borderRadius: 12,
                        overflow: 'hidden',
                        opacity: isSubmitting ? 0.65 : pressed ? 0.92 : 1,
                        minHeight: 42,
                      },
                      isWeb && ({ cursor: isSubmitting ? ('not-allowed' as const) : ('pointer' as const) } as object),
                    ]}
                  >
                    {isWeb ? (
                      <View
                        style={{
                          paddingVertical: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 42,
                          backgroundColor: '#22c55e',
                          shadowColor: '#000000',
                          shadowOpacity: darkMode ? 0.25 : 0.12,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: 3,
                        }}
                      >
                        <Text style={{ color: '#020617', textAlign: 'center', fontWeight: '700', fontSize: 14, letterSpacing: 0.15 }}>
                          {isSubmitting ? 'Sending…' : 'Send request'}
                        </Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={isSubmitting ? ['#6b7280', '#4b5563'] : ['#22c55e', '#22d3ee']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 42,
                        }}
                      >
                        <Text style={{ color: isSubmitting ? '#f8fafc' : '#020617', textAlign: 'center', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 }}>
                          {isSubmitting ? 'Sending…' : 'Send request'}
                        </Text>
                      </LinearGradient>
                    )}
                  </Pressable>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleBackFromRequest}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.28)' : Colors.line,
                      flexDirection: 'row',
                      gap: 6,
                      minHeight: 42,
                      opacity: isSubmitting ? 0.5 : 1,
                    }}
                  >
                    <MaterialIcons name="close" size={17} color={darkMode ? 'rgba(226, 232, 240, 0.85)' : Colors.sub} />
                    <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.92)' : Colors.text, fontWeight: '600', fontSize: 13 }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ ...subCard, flexDirection: 'row', alignItems: 'flex-start', padding: 16 }}>
                  <MaterialIcons name="info-outline" size={20} color="#34d399" style={{ marginTop: 1 }} />
                  <Text style={{ color: subMeta, fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 19 }}>
                    Your request is shared with qualified subs in your area. Matches show up in your Leads tab.
                  </Text>
                </View>
          </SubWebFormOptionalChrome>
            </ScrollView>
          </KeyboardAvoidingView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>

    </>
  );
}

export default SubcontractorSearchModal;

// Photo Viewer Modal - Completely separate component to avoid nesting issues
function PhotoViewerModal({ 
  visible, 
  selectedPhoto, 
  onClose 
}: { 
  visible: boolean; 
  selectedPhoto: any; 
  onClose: () => void; 
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Test element to see if modal is rendering */}
        <Text style={{ color: '#FFFFFF', fontSize: 24, marginBottom: 20 }}>
          Photo Viewer Test - Modal is Working!
        </Text>
        {/* Close Button */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 20,
            padding: 10,
          }}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Photo */}
        {selectedPhoto && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={{
                width: '100%',
                height: '80%',
                resizeMode: 'contain',
              }}
            />
            
            {/* Photo Info */}
            <View style={{
              position: 'absolute',
              bottom: 50,
              left: 20,
              right: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: 12,
              padding: 16,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                {selectedPhoto.type?.replace('_', ' ').toUpperCase() || 'PORTFOLIO'}
              </Text>
              {selectedPhoto.caption && (
                <Text style={{ color: '#E2E8F0', fontSize: 14, marginBottom: 4 }}>
                  {selectedPhoto.caption}
                </Text>
              )}
              {selectedPhoto.projectType && (
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                  Project: {selectedPhoto.projectType}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ----- Zoom Lightbox Components (for photo enlargement) -----
export function ZoomImage({ uri, thumbStyle, onOpen }: { uri: string; thumbStyle?: any; onOpen?: () => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Pressable
        onPress={() => { setOpen(true); onOpen?.(); }}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open image"
        style={thumbStyle}
      >
        <Image source={{ uri }} style={[{ width: '100%', height: '100%', borderRadius: 12 }, thumbStyle]} resizeMode="cover" />
        {/* Magnifying glass overlay */}
        <View style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 20,
          width: 32,
          height: 32,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <MaterialIcons name="zoom-in" size={18} color="#FFFFFF" />
        </View>
      </Pressable>
      <ZoomLightbox uri={uri} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ZoomLightbox({ uri, open, onClose }: { uri: string; open: boolean; onClose: () => void }) {
  const screen = Dimensions.get('window');
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (open) Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    else opacity.setValue(0);
  }, [open]);

  // Simple drag-to-dismiss downward
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => translateY.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) onClose();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', opacity }}>
        {/* Close button in top-right corner */}
        <Pressable 
          style={{ 
            position: 'absolute', 
            top: 50, 
            right: 20, 
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 20,
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
          }} 
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        
        {/* Tap background to close */}
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        
        {/* Image with drag-to-dismiss */}
        <Animated.View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', transform: [{ translateY }] }}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri }}
            style={{ width: screen.width, height: screen.height, resizeMode: 'contain' as const }}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
