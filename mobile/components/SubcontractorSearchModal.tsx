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
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { YelpResultsFooter } from '@/components/AttributionBadge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChat } from '../contexts/ChatContext';
import { ChatModal } from './ChatModal';
import { normalizeTrade } from '../lib/trades';
import { clerkAuthService } from '@/services/clerkAuth';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';

/** Off by default — set `EXPO_PUBLIC_YELP_SUB_SEARCH_ENABLED=true` + `YELP_API_KEY` on backend when you enable Yelp. */
function isYelpSubSearchEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_YELP_SUB_SEARCH_ENABLED === 'true') return true;
  const extra = Constants.expoConfig?.extra as { yelpSubSearchEnabled?: boolean } | undefined;
  return extra?.yelpSubSearchEnabled === true;
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

/** Matches estimate-generator Step 4 `GlassBorderCard` / `GRAD` — green → cyan border */
const ESTIMATE_STEP_GLASS_BORDER_GRAD = ['#2DFFC4', '#00A6FF'] as const;

/**
 * UI-only samples when Yelp is off and there are no campaign subs — not real Yelp listings.
 * (Previously labeled "Yelp Business" without an API; restored as honest "Sample" rows.)
 */
const DEMO_SUBCONTRACTORS: any[] = [
  {
    id: 'demo-1',
    name: 'Elite Plumbing Services',
    trade: 'Plumbing',
    rating: 4.9,
    reviews: 156,
    hourlyRate: { min: 85, max: 120 },
    location: 'Las Vegas, NV',
    distance: 3.2,
    licensed: true,
    insured: true,
    availability: 'Available Now',
    image: 'https://via.placeholder.com/80',
    specialties: ['Residential', 'Commercial', 'Emergency'],
    source: 'demo',
    sourceLabel: 'Sample',
  },
  {
    id: 'demo-2',
    name: 'Apex Electrical Contractors',
    trade: 'Electrical',
    rating: 4.8,
    reviews: 203,
    hourlyRate: { min: 95, max: 140 },
    location: 'Henderson, NV',
    distance: 5.7,
    licensed: true,
    insured: true,
    availability: 'Available in 3 days',
    image: 'https://via.placeholder.com/80',
    specialties: ['Residential', 'Industrial', 'Solar'],
    source: 'demo',
    sourceLabel: 'Sample',
  },
  {
    id: 'demo-3',
    name: 'Desert Framing Crew',
    trade: 'Framing',
    rating: 4.7,
    reviews: 89,
    hourlyRate: { min: 65, max: 95 },
    location: 'North Las Vegas, NV',
    distance: 8.1,
    licensed: true,
    insured: true,
    availability: 'Available Now',
    image: 'https://via.placeholder.com/80',
    specialties: ['Residential', 'Commercial', 'Metal Framing'],
    source: 'demo',
    sourceLabel: 'Sample',
  },
];

interface SubcontractorSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (subcontractor: any) => void;
  defaultZip?: string;
  onPhotoClick?: (photo: any, index: number) => void;
  onOpenChat?: (conversationId: string, participantName: string, participantCompany: string) => void;
}

function SubcontractorSearchModal({
  visible,
  onClose,
  onSelect,
  defaultZip = '89011',
  onPhotoClick,
  onOpenChat,
}: SubcontractorSearchModalProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const yelpSubSearchEnabled = useMemo(() => isYelpSubSearchEnabled(), []);
  /** Shared UI tokens — Find Subcontractors + Contractor Profile polish */
  const subMeta = darkMode ? 'rgba(203, 213, 225, 0.82)' : Colors.sub;
  const subMeta2 = darkMode ? 'rgba(148, 163, 184, 0.9)' : Colors.sub;
  const subCard = {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.045)' : Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line,
  };
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
  };
  const { createConversation } = useChat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedTrade, setSelectedTrade] = useState('All Trades');
  const [zipCode, setZipCode] = useState(defaultZip);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [submittedRequests, setSubmittedRequests] = useState<Set<string>>(new Set());
  
  // Animation for smooth transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  
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
      // Source identification
      source: 'campaign',
      sourceLabel: 'Campaign Creator',
      sourceColor: '#8B5CF6',
    };
  };

  // Load all subcontractors when modal opens
  useEffect(() => {
    if (visible) {
      loadCampaigns();
      // Real Yelp rows load when user taps Search (see fetchYelpSubcontractors).
      setYelpResults([]);
      setSelectedTrade('All Trades');
      setSearchQuery('');
    }
  }, [visible]);

  // Reset photo viewer state when profile modal closes


  // Convert Yelp business to subcontractor format
  const convertYelpToSubcontractor = (yelpBusiness: any): any => {
    // Extract primary category as trade
    const primaryCategory = yelpBusiness.categories?.[0]?.title || 'General Contracting';
    
    // Calculate distance in miles if available
    const distance = yelpBusiness.distance ? (yelpBusiness.distance / 1609.34) : null;
    
    // Determine availability based on hours (if open now, show "Available Now")
    let availability = 'Available Soon'; // Default
    if (yelpBusiness.is_closed === false) {
      availability = 'Available Now';
    } else if (yelpBusiness.hours && yelpBusiness.hours[0]?.is_open_now) {
      availability = 'Available Now';
    }
    
    // Estimate hourly rate from price level (Yelp uses $, $$, $$$, $$$$)
    // Rough estimate: $ = $50-75/hr, $$ = $75-100/hr, $$$ = $100-150/hr, $$$$ = $150+/hr
    let hourlyRate = { min: 50, max: 100 };
    if (yelpBusiness.price === '$') {
      hourlyRate = { min: 50, max: 75 };
    } else if (yelpBusiness.price === '$$') {
      hourlyRate = { min: 75, max: 100 };
    } else if (yelpBusiness.price === '$$$') {
      hourlyRate = { min: 100, max: 150 };
    } else if (yelpBusiness.price === '$$$$') {
      hourlyRate = { min: 150, max: 200 };
    }
    
    return {
      id: `yelp-${yelpBusiness.id}`,
      name: yelpBusiness.name,
      trade: primaryCategory,
      rating: yelpBusiness.rating || 0,
      reviews: yelpBusiness.review_count || 0,
      hourlyRate,
      location: yelpBusiness.location?.city && yelpBusiness.location?.state 
        ? `${yelpBusiness.location.city}, ${yelpBusiness.location.state}`
        : yelpBusiness.location?.display_address?.[0] || 'Location not available',
      distance: distance ? parseFloat(distance.toFixed(1)) : null,
      licensed: true, // Yelp doesn't provide this, default to true
      insured: true, // Yelp doesn't provide this, default to true
      availability,
      image: yelpBusiness.image_url || 'https://via.placeholder.com/80',
      specialties: yelpBusiness.categories?.map((c: any) => c.title) || [],
      phone: yelpBusiness.phone,
      url: yelpBusiness.url,
      address: yelpBusiness.location?.address1 || '',
      city: yelpBusiness.location?.city || '',
      state: yelpBusiness.location?.state || '',
      zip: yelpBusiness.location?.zip_code || '',
      // Source identification
      source: 'yelp',
      sourceLabel: 'Yelp Business',
      sourceColor: '#FF1A1A',
      yelpId: yelpBusiness.id,
    };
  };

  // Fetch subcontractors via backend → Yelp Fusion (requires YELP_API_KEY on server)
  const fetchYelpSubcontractors = async () => {
    if (!yelpSubSearchEnabled) return;
    try {
      setLoading(true);
      const zip = zipCode.replace(/\D/g, '');
      if (zip.length < 5) {
        Alert.alert('ZIP code', 'Enter a 5-digit ZIP so we can search near the job site.');
        setLoading(false);
        return;
      }

      // Map trade to Yelp search term
      const tradeMap: { [key: string]: string } = {
        'All Trades': 'contractors',
        'Plumbing': 'plumber',
        'Electrical': 'electrician',
        'HVAC': 'hvac',
        'Framing': 'framing contractor',
        'Drywall': 'drywall contractor',
        'Painting': 'painting contractor',
        'Roofing': 'roofer',
        'Flooring': 'flooring contractor',
        'Concrete': 'concrete contractor',
        'Landscaping': 'landscaper',
      };

      const searchTerm = tradeMap[selectedTrade] || selectedTrade.toLowerCase();
      const apiBase = resolveBackendRestApiBaseUrl();
      const url = `${apiBase}/yelp/search?term=${encodeURIComponent(searchTerm)}&location=${encodeURIComponent(zip)}&categories=contractors&limit=20&sort_by=rating`;

      const response = await fetch(url);

      if (!response.ok) {
        let detail = '';
        try {
          const errBody = await response.json();
          detail = errBody?.error || errBody?.details || '';
        } catch {
          /* ignore */
        }
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const yelpSubcontractors = (data.businesses || []).map(convertYelpToSubcontractor);
      setYelpResults(yelpSubcontractors);

      if (data.metadata?.isMockData) {
        console.warn('Yelp:', data.metadata?.message || 'Server returned mock businesses (set YELP_API_KEY on backend for live Yelp).');
      }
    } catch (error: any) {
      console.error('Error fetching Yelp subcontractors:', error);
      setYelpResults([]);
      Alert.alert(
        'Search unavailable',
        typeof error?.message === 'string' && error.message
          ? error.message
          : 'Could not load businesses. Check your connection and that the backend has Yelp configured.',
      );
    } finally {
      setLoading(false);
    }
  };

  // Store raw Yelp results separately to avoid filtering issues
  const [yelpResults, setYelpResults] = useState<any[]>([]);

  // Enhanced filtering with campaign data
  useEffect(() => {
    const campaignSubcontractors = campaigns.map(convertCampaignToSubcontractor);
    let filtered = [...yelpResults, ...campaignSubcontractors];

    // When Yelp search is off and there is no network data, show labeled samples (not Yelp).
    const noNetwork =
      !yelpSubSearchEnabled && yelpResults.length === 0 && campaignSubcontractors.length === 0;
    if (noNetwork) {
      filtered = [...filtered, ...DEMO_SUBCONTRACTORS];
    }

    // Filter by trade
    if (selectedTrade !== 'All Trades') {
      const canon = normalizeTrade(selectedTrade);
      filtered = filtered.filter(sub => normalizeTrade(sub.trade) === canon);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(sub => 
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.trade.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((sub as any).certifications && (sub as any).certifications.some((cert: string) => 
          cert.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
    }
    
    setResults(filtered);
  }, [selectedTrade, searchQuery, campaigns, yelpResults, yelpSubSearchEnabled]);

  const handleSearch = async () => {
    if (yelpSubSearchEnabled) {
      await fetchYelpSubcontractors();
      return;
    }
    setLoading(true);
    try {
      await loadCampaigns();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubcontractor = (sub: any) => {
    console.log('🔄 handleSelectSubcontractor called with:', sub.name);
    try {
      const subData = {
        name: sub.name,
        trade: sub.trade,
        rate: sub.hourlyRate.min, // Use minimum rate as default
        mode: 'hourly',
        laborType: 'subcontractor',
        hours: 0,
        metadata: {
          rating: sub.rating,
          reviews: sub.reviews,
          location: sub.location,
          licensed: sub.licensed,
          insured: sub.insured,
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
    setRequestFormData({
      trade: '',
      customTrade: '',
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
      Alert.alert('Please wait', 'Please wait a moment before submitting another request.');
      return;
    }
    
    // Validate form data before submitting
    if (!requestFormData.trade && !requestFormData.customTrade) {
      Alert.alert('Error', 'Please enter a trade type.');
      return;
    }
    
    if (!requestFormData.budgetMax) {
      Alert.alert('Error', 'Please enter maximum budget.');
      return;
    }

    setIsSubmitting(true);
    setLastSubmissionTime(now);

    try {
      // Use actual form data with proper validation
      const budgetMax = parseInt(requestFormData.budgetMax) || 5000; // Default to $5000 if empty
      
      // Get actual user ID
      const userId = getUserId();

      const tradeValue = requestFormData.customTrade || requestFormData.trade;
      const requestData: any = {
        title: requestFormData.projectName || `${tradeValue} Work Needed`,
        trade: normalizeTrade(tradeValue),
        projectId: `PRJ-${Date.now()}`,
        city: "Las Vegas", // Default for now - could be made dynamic
        state: "NV",
        budgetMax: budgetMax,
        timeline: requestFormData.timeline,
        createdBy: userId,
        description: requestFormData.description || `Looking for qualified ${tradeValue} subcontractors`
      };
      // Don't send budgetMin - backend will default it to 0

      // Create a unique request signature to prevent duplicates
      const requestSignature = `${normalizeTrade(requestData.trade)}-${requestData.budgetMax}-${requestData.timeline}`;
      
      if (submittedRequests.has(requestSignature)) {
        Alert.alert('Duplicate Request', 'You have already submitted a similar request. Please wait before submitting another.');
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

      const apiBase = resolveBackendRestApiBaseUrl();
      const response = await fetch(`${apiBase}/project-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanRequestData),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`API Error: ${errorText}`);
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
      
      Alert.alert(
        '🎉 Request Posted!',
        `Your ${requestData.trade.toLowerCase()} request has been posted!\n\n${matchedCount > 0 ? `✅ Matched with ${matchedCount} qualified contractor${matchedCount > 1 ? 's' : ''}:\n${contractorList}${moreText}` : '⏳ No contractors matched yet. We\'ll notify you when matches are found.'}\n\nView your request in the Leads page.`,
        [
          { 
            text: 'View in Leads', 
            onPress: () => {
              onClose();
              // Navigate to leads tab
              setTimeout(() => {
                router.push('/(tabs)/leads');
              }, 300);
            },
            style: 'default'
          },
          { 
            text: 'OK', 
            onPress: () => {
              setShowRequestForm(false);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create subcontractor request. Please try again.');
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
          {/* Header Section — title centered; back balances right spacer */}
          <View style={{
            paddingHorizontal: 22,
            paddingTop: Math.max(insets.top, 0) + 10,
            paddingBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: darkMode ? '#000000' : Colors.bg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.06)',
          }}>
              <View style={{ width: 52, alignItems: 'flex-start' }}>
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
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
                  </TouchableOpacity>
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

          {/* Scrollable Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              paddingTop: 18,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
          {/* Trade Selector */}
          <View style={{ marginHorizontal: -20, paddingHorizontal: 28, marginBottom: 14 }}>
            <Text style={{ color: darkMode ? '#FFFFFF' : '#000000', marginBottom: 10, fontSize: 12, fontWeight: '600', letterSpacing: 0.35, textTransform: 'uppercase', opacity: 0.9 }}>Trade</Text>
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
          <View style={{ marginHorizontal: -20, paddingHorizontal: 28, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or specialty..."
                placeholderTextColor={darkMode ? "rgba(226,232,240,0.48)" : Colors.sub}
                style={{
                  flex: 1,
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                  color: darkMode ? '#FFFFFF' : '#000000',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                  fontSize: 15,
                }}
              />
              <TextInput
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="ZIP"
                placeholderTextColor={darkMode ? "rgba(226,232,240,0.48)" : Colors.sub}
                keyboardType="phone-pad"
                textContentType="none"
                autoComplete="off"
                maxLength={5}
                style={{
                  width: 86,
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                  color: darkMode ? '#FFFFFF' : '#000000',
                  paddingHorizontal: 12,
                  paddingVertical: 13,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
                  fontSize: 15,
                  textAlign: 'center',
                }}
              />
            </View>
          </View>

          {/* Search & Request Buttons */}
          <View style={{ marginHorizontal: -20, paddingHorizontal: 28, marginBottom: 18 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSearch();
              }}
              activeOpacity={0.9}
              disabled={loading}
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                marginBottom: 10,
                opacity: loading ? 0.88 : 1,
              }}
            >
              <LinearGradient
                colors={['#22c55e', '#22d3ee']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOpacity: darkMode ? 0.25 : 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <Text style={{ color: '#020617', textAlign: 'center', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 }}>
                  {loading
                    ? yelpSubSearchEnabled
                      ? 'Searching...'
                      : 'Refreshing...'
                    : yelpSubSearchEnabled
                      ? 'Search Subcontractors'
                      : 'Refresh list'}
                </Text>
              </LinearGradient>
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
              style={{
                backgroundColor: 'transparent',
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: darkMode ? 'rgba(148, 163, 184, 0.24)' : Colors.line,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MaterialIcons name="send" size={18} color={darkMode ? 'rgba(226, 232, 240, 0.75)' : Colors.sub} />
              <Text style={{ color: darkMode ? 'rgba(226, 232, 240, 0.88)' : Colors.text, textAlign: 'center', fontWeight: '600', fontSize: 14 }}>
                Request Subcontractor
              </Text>
            </TouchableOpacity>
          </View>

            {/* Loading */}
            {loading && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={{ color: '#FFFFFF', marginTop: 12 }}>
                  {yelpSubSearchEnabled ? 'Searching...' : 'Refreshing...'}
                </Text>
              </View>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
              <View style={{ marginHorizontal: -20, paddingHorizontal: 28 }}>
                <Text style={{ color: darkMode ? '#FFFFFF' : '#000000', fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 12 }}>
                  {results.length} Subcontractor{results.length !== 1 ? 's' : ''} Found
                </Text>
                
                {results.map(sub => (
                <LinearGradient
                  key={sub.id}
                  colors={[...ESTIMATE_STEP_GLASS_BORDER_GRAD]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{ borderRadius: 14, padding: 1, marginBottom: 10 }}
                >
                  <View
                    style={{
                      borderRadius: 13,
                      overflow: 'hidden',
                      backgroundColor: darkMode ? Colors.card : Colors.bg,
                      borderWidth: 1,
                      borderColor: Colors.line,
                    }}
                  >
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      backgroundColor: 'transparent',
                    }}
                    onPress={() => {
                      setSelectedSubcontractor(sub);
                      setShowProfile(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.85}
                  >
                  {/* Header Row */}
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <Text style={{ color: darkMode ? '#f8fafc' : '#000000', fontSize: 16, fontWeight: '700', lineHeight: 22, flex: 1 }}>
                        {sub.name}
                      </Text>
                        {/* Source Badge — toned down */}
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          flexShrink: 0,
                          gap: 4
                        }}>
                          <View style={{
                            backgroundColor:
                              sub.source === 'yelp'
                                ? (darkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)')
                                : sub.source === 'demo'
                                  ? (darkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)')
                                  : (darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.surface2),
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor:
                              sub.source === 'yelp'
                                ? 'rgba(248, 113, 113, 0.28)'
                                : sub.source === 'demo'
                                  ? 'rgba(245, 158, 11, 0.35)'
                                  : (darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line),
                          }}>
                            <MaterialIcons
                              name={
                                sub.source === 'campaign' ? 'campaign' :
                                sub.source === 'yelp' ? 'business' :
                                sub.source === 'demo' ? 'science' :
                                sub.source === 'app' ? 'person' : 'apps'
                              }
                              size={11}
                              color={
                                sub.source === 'yelp'
                                  ? (darkMode ? '#fca5a5' : '#b91c1c')
                                  : sub.source === 'demo'
                                    ? (darkMode ? '#fbbf24' : '#b45309')
                                    : (darkMode ? 'rgba(226,232,240,0.75)' : Colors.sub)
                              }
                            />
                            <Text
                              style={{
                                color:
                                  sub.source === 'yelp'
                                    ? (darkMode ? '#fca5a5' : '#b91c1c')
                                    : sub.source === 'demo'
                                      ? (darkMode ? '#fcd34d' : '#b45309')
                                      : (darkMode ? 'rgba(226,232,240,0.85)' : Colors.text),
                                fontSize: 10,
                                fontWeight: '600',
                                marginLeft: 3,
                              }}
                            >
                              {sub.sourceLabel || 'Network'}
                            </Text>
                          </View>
                          {sub.campaignVerified && (
                            <MaterialIcons name="verified" size={14} color="#10B981" />
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '700', marginRight: 6 }}>
                          ⭐{' '}
                          {typeof sub.rating === 'number' && !Number.isNaN(sub.rating)
                            ? sub.rating.toFixed(1)
                            : sub.rating}
                        </Text>
                        <Text style={{ color: subMeta, fontSize: 13 }}>({sub.reviews} reviews)</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.35)' }}>
                          <Text style={{ color: darkMode ? '#86efac' : '#166534', fontSize: 11, fontWeight: '700' }}>{sub.trade}</Text>
                        </View>
                        {sub.licensed && (
                          <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 11, fontWeight: '600' }}>✓ Licensed</Text>
                        )}
                        {sub.insured && (
                          <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 11, fontWeight: '600' }}>✓ Insured</Text>
                        )}
                        {/* Campaign Info */}
                        {sub.hasCampaign && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            <View style={{ 
                              backgroundColor: '#8B5CF6', 
                              paddingHorizontal: 6, 
                              paddingVertical: 2, 
                              borderRadius: 8,
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}>
                              <MaterialIcons name="campaign" size={10} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '600', marginLeft: 2 }}>
                                CAMPAIGN CREATOR
                              </Text>
                            </View>
                            {sub.portfolioPhotos && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialIcons name="photo-library" size={12} color="#43cea2" />
                                <Text style={{ color: '#43cea2', fontSize: 11, marginLeft: 2 }}>
                                  {sub.portfolioPhotos}
                                </Text>
                              </View>
                            )}
                            {sub.yearsExperience && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialIcons name="work" size={12} color="#F59E0B" />
                                <Text style={{ color: '#F59E0B', fontSize: 11, marginLeft: 2 }}>
                                  {sub.yearsExperience}y
                                </Text>
                              </View>
                            )}
                            {sub.responseTime && (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialIcons name="schedule" size={12} color="#3B82F6" />
                                <Text style={{ color: '#3B82F6', fontSize: 11, marginLeft: 2 }}>
                                  {sub.responseTime.replace('_', ' ')}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Details */}
                  <View style={{ marginBottom: 8, gap: 4 }}>
                    <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                      📍 {sub.location} ({sub.distance} mi)
                    </Text>
                    <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                      💰 ${sub.hourlyRate.min}-${sub.hourlyRate.max}/hr
                    </Text>
                    <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                      📅 {sub.availability}
                    </Text>
                  </View>

                  {/* Specialties */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {sub.specialties.map((spec: string) => (
                      <View key={spec} style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line }}>
                        <Text style={{ color: darkMode ? 'rgba(248, 250, 252, 0.9)' : Colors.text, fontSize: 11, fontWeight: '500' }}>{spec}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: '#22c55e',
                        paddingVertical: 11,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 44,
                        shadowColor: '#000000',
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
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
                          paddingVertical: 11,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line,
                          alignItems: 'center',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          minHeight: 44,
                        }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          console.log('🖱️ Contact button pressed for:', sub.name);
                          console.log('📞 Contact info:', {
                            company: sub.name,
                            phone: sub.phone || 'Not provided',
                            email: sub.email || 'Not provided'
                          });
                          // Just log for now to test if this prevents freezing
                        }}
                      >
                        <MaterialIcons name="campaign" size={16} color={darkMode ? 'rgba(248,250,252,0.85)' : Colors.text} />
                        <Text style={{ color: darkMode ? 'rgba(248,250,252,0.88)' : Colors.text, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>
                          Contact
                        </Text>
                      </TouchableOpacity>
                    ) : (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                        paddingVertical: 11,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 44,
                      }}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedSubcontractor(sub);
                        setShowProfile(true);
                      }}
                    >
                      <Text style={{ color: darkMode ? 'rgba(248,250,252,0.88)' : Colors.text, fontWeight: '600', fontSize: 13 }}>View Profile</Text>
                    </TouchableOpacity>
                    )}
                  </View>
                  </TouchableOpacity>
                  </View>
                </LinearGradient>
                ))}
                
                {yelpSubSearchEnabled && yelpResults.length > 0 ? (
                  <YelpResultsFooter style={{ marginTop: 16, marginBottom: 20 }} />
                ) : null}
              </View>
            )}

            {/* No Results */}
            {!loading && results.length === 0 && (
              <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60 }}>
                <MaterialIcons name="search-off" size={64} color="#8DA0B8" />
                <Text style={{ color: '#FFFFFF', fontSize: 18, textAlign: 'center', marginTop: 16, fontWeight: '600' }}>
                  No subcontractors found
                </Text>
                <Text style={{ color: '#8DA0B8', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                  Can't find what you're looking for? Request subcontractors to come to you.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: showRequestForm ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginTop: 24,
                    borderWidth: 1,
                    borderColor: showRequestForm ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleRequestSubcontractor();
                  }}
                >
                  <MaterialIcons name="send" size={20} color={showRequestForm ? '#000000' : '#FFFFFF'} />
                  <Text style={{ color: showRequestForm ? '#000000' : '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                    Request {selectedTrade === 'All Trades' ? 'Subcontractors' : selectedTrade}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 40 }}
              {...KEYBOARD_SCROLL_DEFAULTS}
            >
              {/* Header — respects status bar / notch */}
              <View style={{
                paddingTop: Math.max(insets.top, 0) + 14,
                paddingHorizontal: 22,
                paddingBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: darkMode ? '#000000' : Colors.bg,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0,0,0,0.06)',
              }}>
                <View style={{ marginRight: 12 }}>
                  <LinearGradient
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      padding: 1,
                    }}
                  >
                    <TouchableOpacity
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
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.35 }}>
                    Request Subcontractor
                  </Text>
                  <Text style={{ color: subMeta2, fontSize: 14, marginTop: 5, lineHeight: 20 }}>
                    Post your subcontractor needs
                  </Text>
                </View>
              </View>

              <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>

                {/* Trade Selection */}
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
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    padding: 1,
                  }}
                >
                  <TouchableOpacity
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
                  </TouchableOpacity>
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
                    {selectedSubcontractor.licensed && (
                      <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#a7f3d0' : '#166534', fontSize: 12, fontWeight: '600' }}>✓ Licensed</Text>
                      </View>
                    )}
                    {selectedSubcontractor.insured && (
                      <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#93c5fd' : '#1d4ed8', fontSize: 12, fontWeight: '600' }}>✓ Insured</Text>
                      </View>
                    )}
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
                      {selectedSubcontractor.location} ({selectedSubcontractor.distance} miles away)
                    </Text>
                  </View>

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>💰 Hourly Rate</Text>
                    <Text style={{ color: '#4ade80', fontSize: 19, fontWeight: '800', letterSpacing: -0.2 }}>
                      ${selectedSubcontractor.hourlyRate.min} - ${selectedSubcontractor.hourlyRate.max}/hr
                    </Text>
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

                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta2, fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.15 }}>🏢 Company</Text>
                    <Text style={{ color: darkMode ? '#f1f5f9' : Colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6, lineHeight: 22 }}>
                      {selectedSubcontractor.company || selectedSubcontractor.name}
                    </Text>
                    <Text style={{ color: subMeta, fontSize: 13, lineHeight: 18 }}>
                      License: {selectedSubcontractor.licenseNumber || 'Not provided'}
                    </Text>
                  </View>
                </View>

                {/* Professional Badges */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                    Professional Credentials
                  </Text>
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
                            • Available {selectedSubcontractor.availability.toLowerCase()}
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
                    {selectedSubcontractor.specialties.map((spec: string) => (
                      <View key={spec} style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.28)' }}>
                        <Text style={{ color: darkMode ? '#e2e8f0' : Colors.text, fontSize: 13, fontWeight: '600' }}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Experience */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>Experience</Text>
                  <View style={{ ...subCard, padding: 18 }}>
                    <Text style={{ color: subMeta, fontSize: 15, lineHeight: 24 }}>
                      {selectedSubcontractor.yearsExperience} years of professional experience in {selectedSubcontractor.trade.toLowerCase()}. 
                      Completed over {selectedSubcontractor.completedJobs} projects with an average rating of {selectedSubcontractor.rating} stars.
                    </Text>
                  </View>
                </View>

                {/* Primary actions: quote + bid, then call + message */}
                <View style={{ gap: 10, paddingBottom: 24 }}>
                  {/* Get Quote Button */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Alert.alert(
                        'Get Quote',
                        'This will open a project details form to request a custom quote.',
                        [{ text: 'OK', style: 'default' }]
                      );
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={{ borderRadius: 14, overflow: 'hidden' }}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#22d3ee']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 16,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                        shadowColor: '#000000',
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 4,
                      }}
                    >
                    <MaterialIcons name="request-quote" size={20} color="#020617" />
                    <Text style={{ color: '#020617', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 }}>Get Custom Quote</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
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
                        const simpleSubData = {
                          name: selectedSubcontractor.name,
                          trade: selectedSubcontractor.trade || 'General Contracting',
                          rate: selectedSubcontractor.hourlyRate?.min || 50,
                          mode: 'hourly',
                          laborType: 'subcontractor',
                          hours: 0,
                          metadata: {
                            rating: selectedSubcontractor.rating || 4.5,
                            reviews: selectedSubcontractor.reviews || 0,
                            location: selectedSubcontractor.location || 'Service Area',
                            licensed: selectedSubcontractor.licensed || false,
                            insured: selectedSubcontractor.insured || false,
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
                          const subId = selectedSubcontractor.id;
                          const subName = selectedSubcontractor.name;
                          const subCompany = selectedSubcontractor.company || selectedSubcontractor.name;
                          const subPhone = selectedSubcontractor.phone;
                          const subEmail = selectedSubcontractor.email;
                          const conversationId = await createConversation(
                            subId,
                            subName,
                            subCompany,
                            subPhone,
                            subEmail,
                            'contractor'
                          );
                          setShowProfile(false);
                          setTimeout(() => {
                            onClose();
                            setTimeout(() => {
                              setCurrentConversationId(conversationId);
                              setShowChat(true);
                            }, 500);
                          }, 300);
                        } catch (error) {
                          console.error('Error opening chat:', error);
                          Alert.alert('Error', 'Failed to open chat. Please try again.');
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
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 }}>
                    Trade type *
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.trade || requestFormData.customTrade}
                    onChangeText={(text) => setRequestFormData({ ...requestFormData, trade: '', customTrade: text })}
                    placeholder="e.g. Plumbing, electrical, tile…"
                    placeholderTextColor={subMeta2}
                  />
                </View>

                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 }}>
                    Project name <Text style={{ color: subMeta2, fontWeight: '600' }}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.projectName}
                    onChangeText={(text) => setRequestFormData({ ...requestFormData, projectName: text })}
                    placeholder="e.g. Kitchen remodel, office build"
                    placeholderTextColor={subMeta2}
                  />
                </View>

                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 }}>
                    Maximum budget *
                  </Text>
                  <TextInput
                    style={{ ...requestFormInputShell, minHeight: 52 }}
                    value={requestFormData.budgetMax}
                    onChangeText={(text) => setRequestFormData({ ...requestFormData, budgetMax: text })}
                    placeholder="$50,000"
                    placeholderTextColor={subMeta2}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 }}>
                    Timeline *
                  </Text>
                  {[
                    { value: 'Normal', label: 'Normal (4+ weeks)', color: '#10B981' },
                    { value: 'Soon', label: 'Soon (1–3 weeks)', color: '#F59E0B' },
                    { value: 'Urgent', label: 'Urgent (< 1 week)', color: '#EF4444' },
                  ].map((option) => {
                    const selected = requestFormData.timeline === option.value;
                    return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.85}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRequestFormData({ ...requestFormData, timeline: option.value as any });
                      }}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: selected
                          ? (darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.surface2)
                          : (darkMode ? 'rgba(255, 255, 255, 0.03)' : Colors.surface),
                        borderRadius: 14,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        marginBottom: 8,
                        borderWidth: selected ? 1.5 : 1,
                        borderColor: selected ? option.color : (darkMode ? 'rgba(148, 163, 184, 0.2)' : Colors.line),
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: option.color, marginRight: 12 }} />
                        <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 15, fontWeight: '600' }}>{option.label}</Text>
                      </View>
                      {selected && (
                        <MaterialIcons name="check-circle" size={22} color={option.color} />
                      )}
                    </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 }}>
                    Additional details <Text style={{ color: subMeta2, fontWeight: '600' }}>(optional)</Text>
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
                    placeholderTextColor={subMeta2}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={createSubRequest}
                    disabled={isSubmitting}
                    style={{ borderRadius: 14, overflow: 'hidden', opacity: isSubmitting ? 0.65 : 1 }}
                  >
                    <LinearGradient
                      colors={isSubmitting ? ['#6b7280', '#4b5563'] : ['#22c55e', '#22d3ee']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: isSubmitting ? '#f8fafc' : '#020617', textAlign: 'center', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                        {isSubmitting ? 'Sending…' : 'Send request'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleBackFromRequest}
                    style={{
                      backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
                      paddingVertical: 15,
                      borderRadius: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.22)' : Colors.line,
                    }}
                  >
                    <Text style={{ color: darkMode ? '#f8fafc' : Colors.text, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ ...subCard, flexDirection: 'row', alignItems: 'flex-start', padding: 16, marginTop: 18 }}>
                  <MaterialIcons name="info-outline" size={20} color="#34d399" style={{ marginTop: 1 }} />
                  <Text style={{ color: subMeta, fontSize: 13, marginLeft: 12, flex: 1, lineHeight: 19 }}>
                    Your request is shared with qualified subs in your area. Matches show up in your Leads tab.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>

      {/* Chat Modal */}
      {(() => {
        console.log('🔍 Chat Modal Conditional Check:', {
          showChat,
          hasSubcontractor: !!selectedSubcontractor,
          hasConversationId: !!currentConversationId,
          conversationId: currentConversationId
        });
        return showChat && selectedSubcontractor && currentConversationId;
      })() && (
        <ChatModal
          visible={showChat}
          onClose={() => {
            console.log('🔒 Closing chat modal');
            setShowChat(false);
          }}
          conversationId={currentConversationId}
          participantName={selectedSubcontractor.name}
          participantCompany={selectedSubcontractor.company || selectedSubcontractor.name}
        />
      )}
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
