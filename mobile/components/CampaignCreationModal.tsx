// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { SubcontractorProfileBuilder } from './SubcontractorProfileBuilder';
import { PhotoUploadComponent } from './PhotoUploadComponent';
import { ServiceAreaSelector } from './ServiceAreaSelector';
import { PricingCalculator } from './PricingCalculator';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import GradientRingBackInner from '@/components/GradientRingBackInner';

const IG_GRADIENT = `
<svg width="18" height="18" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="1" y2="0">
      <stop offset="0" stop-color="#f58529"/>
      <stop offset="0.5" stop-color="#dd2a7b"/>
      <stop offset="1" stop-color="#8134af"/>
    </linearGradient>
  </defs>
  <path fill="url(#g)"
    d="M224 202.7A53.3 53.3 0 1 0 277.3 256 53.38 53.38 0 0 0 224 202.7Zm124.7-41a54.9 54.9 0 0 0-31-31c-21.4-8.5-72.2-6.6-93.7-6.6s-72.3-1.9-93.7 6.6a54.9 54.9 0 0 0-31 31c-8.5 21.4-6.6 72.2-6.6 93.7s-1.9 72.3 6.6 93.7a54.9 54.9 0 0 0 31 31c21.4 8.5 72.2 6.6 93.7 6.6s72.3 1.9 93.7-6.6a54.9 54.9 0 0 0 31-31c8.5-21.4 6.6-72.2 6.6-93.7s1.9-72.3-6.6-93.7ZM224 338a82 82 0 1 1 82-82 82.09 82.09 0 0 1-82 82Zm85.3-148.5a19.2 19.2 0 1 1 19.2-19.2 19.2 19.2 0 0 1-19.2 19.2Z"/>
  <path fill="url(#g)"
    d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h352a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48Zm-24 306.3a94.8 94.8 0 0 1-94.8 94.8H166.8A94.8 94.8 0 0 1 72 338.3V205.2A94.8 94.8 0 0 1 166.8 110.4H281a94.8 94.8 0 0 1 94.8 94.8Z"/>
</svg>
`;

function IGLogo() {
  return <SvgXml xml={IG_GRADIENT} />;
}

interface CampaignCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (campaign: SubcontractorCampaign) => void;
  initialData?: SubcontractorCampaign | null;
  isEditMode?: boolean;
}

export interface SubcontractorCampaign {
  id: string;
  campaignName?: string; // Name/identifier for this campaign
  campaignDescription?: string; // Optional description
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  instagram?: string;
  bio?: string;
  licenseNumber?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  services: string[];
  specialties: string[];
  serviceAreas: {
    city: string;
    state: string;
    radius: number; // miles
  }[];
  pricing: {
    hourlyRate: { min: number; max: number };
    projectMinimum: number;
    specialties: { [key: string]: { min: number; max: number } };
  };
  availability: {
    schedule: 'immediate' | '1-2 weeks' | '1 month' | 'custom';
    customSchedule?: string;
    capacity: 'low' | 'medium' | 'high';
  };
  portfolio: {
    id: string;
    uri: string;
    type: 'before_after' | 'project_complete' | 'work_in_progress' | 'equipment' | 'team';
    caption?: string;
    projectType?: string;
  }[];
  certifications: string[];
  yearsExperience: number;
  teamSize: number;
  equipment: string[];
  responseTime: 'immediate' | 'within_hour' | 'within_day' | 'within_week';
  // Campaign duration/expiry
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string, optional if runUntilPaused is true
  runUntilPaused?: boolean; // If true, campaign runs until manually paused
  // Lead preferences/filters
  leadPreferences?: {
    projectTypes?: string[]; // e.g., ['kitchen_remodel', 'bathroom_remodel', 'new_build']
    budgetRanges?: {
      min?: number;
      max?: number;
    };
    timelines?: string[]; // e.g., ['Normal', 'Soon', 'Urgent']
  };
  createdAt: string;
  status: 'draft' | 'active' | 'paused' | 'expired';
}

export default function CampaignCreationModal({
  visible,
  onClose,
  onSave,
  initialData,
  isEditMode = false,
}: CampaignCreationModalProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const neutralIconColor = darkMode ? '#FFFFFF' : '#000000';
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [campaign, setCampaign] = useState<Partial<SubcontractorCampaign>>({
    campaignName: '',
    campaignDescription: '',
    services: [],
    specialties: [],
    serviceAreas: [],
    pricing: {
      hourlyRate: { min: 0, max: 0 },
      projectMinimum: 0,
      specialties: {},
    },
    availability: {
      schedule: '1-2 weeks',
      capacity: 'medium',
    },
    portfolio: [],
    certifications: [],
    equipment: [],
    responseTime: 'within_day',
    runUntilPaused: true,
    leadPreferences: {
      projectTypes: [],
      budgetRanges: {},
      timelines: [],
    },
    status: 'draft',
  });

  // Populate form with initial data when in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      setCampaign(initialData);
    } else if (!isEditMode) {
      // Reset form for new campaign
      setCampaign({
        campaignName: '',
        campaignDescription: '',
        services: [],
        specialties: [],
        serviceAreas: [],
        pricing: {
          hourlyRate: { min: 0, max: 0 },
          projectMinimum: 0,
          specialties: {},
        },
        availability: {
          schedule: '1-2 weeks',
          capacity: 'medium',
        },
        portfolio: [],
        certifications: [],
        equipment: [],
        responseTime: 'within_day',
        runUntilPaused: true,
        leadPreferences: {
          projectTypes: [],
          budgetRanges: {},
          timelines: [],
        },
        status: 'draft',
      });
    }
  }, [isEditMode, initialData]);

  const totalSteps = 6; // Step 1: Campaign Settings, Step 2: Company Info, Step 3: Portfolio, Step 4: Service Areas, Step 5: Pricing, Step 6: Review

  // Validation function to check for incomplete sections
  const getValidationWarnings = (): string[] => {
    const warnings: string[] = [];
    
    // Step 1: Campaign Settings
    if (!campaign.campaignName || campaign.campaignName.trim() === '') {
      warnings.push('Campaign name is required');
    }
    
    // Step 2: Company Information
    if (!campaign.companyName || !campaign.contactName || !campaign.email || !campaign.phone) {
      warnings.push('Company information is incomplete');
    }
    if (!campaign.services || campaign.services.length === 0) {
      warnings.push('No services selected');
    }
    if (!campaign.specialties || campaign.specialties.length === 0) {
      warnings.push('No specialties selected');
    }
    
    // Step 3: Portfolio
    if (!campaign.portfolio || campaign.portfolio.length === 0) {
      warnings.push('No portfolio photos added (recommended for better visibility)');
    }
    
    // Step 4: Service Areas
    if (!campaign.serviceAreas || campaign.serviceAreas.length === 0) {
      warnings.push('No service areas selected');
    }
    
    // Step 5: Pricing
    if (!campaign.pricing || (campaign.pricing.hourlyRate.max === 0 && campaign.pricing.projectMinimum === 0)) {
      warnings.push('Pricing information is incomplete');
    }
    
    return warnings;
  };

  // Enhanced Deal Flow Intelligence Calculations
  const calculateDealFlowIntelligence = (campaign: Partial<SubcontractorCampaign>) => {
    const primaryService = campaign.services?.[0] || 'General Contracting';
    const primaryLocation = campaign.serviceAreas?.[0];
    const locationText = primaryLocation ? `${primaryLocation.city}, ${primaryLocation.state}` : 'Your Area';
    
    // Service-specific average job sizes (base values, adjusted by market)
    const baseJobSizes: Record<string, number> = {
      'Electrical': 4800,
      'Plumbing': 3200,
      'HVAC': 5200,
      'Roofing': 6800,
      'Flooring': 2800,
      'Painting': 2400,
      'Drywall': 2200,
      'Concrete': 4500,
      'Landscaping': 3500,
      'Kitchen Remodel': 28000,
      'Bathroom Remodel': 12000,
      'General Contracting': 4000,
      'Carpentry': 3200,
      'Tile Work': 2800,
    };
    
    // Service-specific close rates (industry averages)
    const closeRates: Record<string, number> = {
      'Electrical': 32, // Higher demand, emergency work
      'Plumbing': 35, // High urgency, emergency work
      'HVAC': 28, // Seasonal, competitive
      'Roofing': 25, // Competitive, high-stakes
      'Flooring': 30,
      'Painting': 28,
      'Drywall': 26,
      'Concrete': 24,
      'Landscaping': 22,
      'Kitchen Remodel': 20, // Longer sales cycle
      'Bathroom Remodel': 22,
      'General Contracting': 28,
      'Carpentry': 26,
      'Tile Work': 28,
    };
    
    // Get base values
    const baseAvgJobSize = baseJobSizes[primaryService] || 4000;
    const baseCloseRate = closeRates[primaryService] || 28;
    
    // Calculate service area coverage
    const serviceAreas = campaign.serviceAreas || [];
    let totalCoverageArea = 0; // square miles
    
    serviceAreas.forEach(area => {
      const radius = area.radius || 25; // default 25 miles
      const areaSqMiles = Math.PI * radius * radius;
      totalCoverageArea += areaSqMiles;
    });
    
    // Estimate population density (varies by region, using conservative estimate)
    // Urban: ~3000/sq mile, Suburban: ~1500/sq mile, Rural: ~200/sq mile
    // Using average of 1500/sq mile for estimation
    const avgPopulationDensity = 1500; // people per square mile
    const estimatedPopulation = Math.floor(totalCoverageArea * avgPopulationDensity);
    
    // Demand multiplier by service type (requests per 1000 people per month)
    const demandMultipliers: Record<string, number> = {
      'Electrical': 2.5, // High frequency (emergencies, upgrades)
      'Plumbing': 3.0, // Highest frequency (emergencies)
      'HVAC': 1.8, // Seasonal spikes
      'Roofing': 0.8, // Lower frequency, larger jobs
      'Flooring': 1.5,
      'Painting': 2.0,
      'Drywall': 1.2,
      'Concrete': 0.9,
      'Landscaping': 1.8,
      'Kitchen Remodel': 0.4, // Lower frequency, high value
      'Bathroom Remodel': 0.5,
      'General Contracting': 1.5,
      'Carpentry': 1.3,
      'Tile Work': 1.0,
    };
    
    const demandMultiplier = demandMultipliers[primaryService] || 1.5;
    
    // Calculate monthly requests
    // Formula: (population / 1000) * demand multiplier
    const estimatedMonthlyRequests = serviceAreas.length > 0
      ? Math.max(5, Math.floor((estimatedPopulation / 1000) * demandMultiplier))
      : 15; // Default if no service areas
    
    // Apply market adjustments if location data suggests higher/lower prices
    // (In production, this would use real market data from BLS API)
    let marketMultiplier = 1.0;
    if (primaryLocation?.state) {
      // High-cost states (simplified example)
      const highCostStates = ['CA', 'NY', 'MA', 'CT', 'NJ', 'HI'];
      if (highCostStates.includes(primaryLocation.state)) {
        marketMultiplier = 1.2; // 20% higher
      }
    }
    
    const avgJobSize = Math.floor(baseAvgJobSize * marketMultiplier);
    const closeRate = baseCloseRate;
    
    // Calculate monthly awarded value
    // Formula: monthly requests × close rate % × average job size
    const monthlyAwarded = Math.floor(estimatedMonthlyRequests * (closeRate / 100) * avgJobSize);
    
    return {
      primaryService,
      locationText,
      avgJobSize,
      closeRate,
      estimatedMonthlyRequests,
      monthlyAwarded,
      estimatedPopulation,
    };
  };

  // Budget Intelligence Calculations
  const calculateCostPerLead = (campaign: Partial<SubcontractorCampaign>): number => {
    // Base cost per lead varies by platform and targeting
    // Average cost: $25-75 for contractors in home services
    // More specific targeting (service areas, project types) increases cost
    const baseCostPerLead = 50;
    const serviceAreaMultiplier = campaign.serviceAreas?.length || 1;
    const specialtyMultiplier = (campaign.specialties?.length || 1) > 3 ? 1.2 : 1.0;
    
    // More specific targeting costs more
    const hasProjectTypeFilter = campaign.leadPreferences?.projectTypes && campaign.leadPreferences.projectTypes.length > 0;
    const hasBudgetFilter = campaign.leadPreferences?.budgetRanges && 
      (campaign.leadPreferences.budgetRanges.min || campaign.leadPreferences.budgetRanges.max);
    
    let costMultiplier = 1.0;
    if (hasProjectTypeFilter) costMultiplier += 0.15;
    if (hasBudgetFilter) costMultiplier += 0.1;
    
    return baseCostPerLead * serviceAreaMultiplier * specialtyMultiplier * costMultiplier;
  };

  const calculateRecommendedWeeklyBudget = (campaign: Partial<SubcontractorCampaign>): number => {
    const costPerLead = calculateCostPerLead(campaign);
    // Recommended: 10-20 leads per week for steady pipeline
    const targetLeadsPerWeek = 15;
    return costPerLead * targetLeadsPerWeek;
  };

  const calculateExpectedLeads = (campaign: Partial<SubcontractorCampaign>): { min: number; max: number } => {
    // Calculate based on service area coverage
    // Average: 0.5-2 leads per 1000 population per month for home services
    const serviceAreas = campaign.serviceAreas || [];
    let totalRadius = 0;
    
    serviceAreas.forEach(area => {
      totalRadius += area.radius || 0;
    });
    
    // Estimate population covered (rough calculation: 1000 people per square mile)
    // Area = π * r², population ≈ 1000 * area
    const avgRadius = serviceAreas.length > 0 ? totalRadius / serviceAreas.length : 0;
    const estimatedPopulation = Math.PI * Math.pow(avgRadius, 2) * 1000 * serviceAreas.length;
    
    // Monthly leads: 0.5-2 per 1000 population
    const minLeads = Math.max(5, Math.floor(estimatedPopulation / 1000 * 0.5));
    const maxLeads = Math.floor(estimatedPopulation / 1000 * 2);
    
    return {
      min: Math.min(minLeads, 50), // Cap at reasonable maximum
      max: Math.min(maxLeads, 200),
    };
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = () => {
    // Check required fields
    if (!campaign.campaignName) {
      Alert.alert('Missing Information', 'Please enter a campaign name.');
      return;
    }
    if (!campaign.companyName || !campaign.contactName || !campaign.email || !campaign.phone) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    // Check for validation warnings
    const warnings = getValidationWarnings();
    if (warnings.length > 0) {
      Alert.alert(
        'Campaign Incomplete',
        `Your campaign has some incomplete sections:\n\n${warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nYou can still publish, but completing these sections will improve your campaign's visibility.`,
        [
          { text: 'Publish Anyway', onPress: () => publishCampaign() },
          { text: 'Go Back', style: 'cancel' },
        ]
      );
      return;
    }

    publishCampaign();
  };

  const publishCampaign = () => {
    const completeCampaign: SubcontractorCampaign = {
      id: `campaign-${Date.now()}`,
      campaignName: campaign.campaignName,
      campaignDescription: campaign.campaignDescription,
      companyName: campaign.companyName!,
      contactName: campaign.contactName!,
      email: campaign.email!,
      phone: campaign.phone!,
      website: campaign.website,
      licenseNumber: campaign.licenseNumber,
      insuranceProvider: campaign.insuranceProvider,
      insuranceExpiry: campaign.insuranceExpiry,
      services: campaign.services || [],
      specialties: campaign.specialties || [],
      serviceAreas: campaign.serviceAreas || [],
      pricing: campaign.pricing!,
      availability: campaign.availability!,
      portfolio: campaign.portfolio || [],
      certifications: campaign.certifications || [],
      yearsExperience: campaign.yearsExperience || 0,
      teamSize: campaign.teamSize || 1,
      equipment: campaign.equipment || [],
      responseTime: campaign.responseTime!,
      startDate: campaign.startDate || new Date().toISOString(),
      endDate: campaign.endDate,
      runUntilPaused: campaign.runUntilPaused ?? true,
      leadPreferences: campaign.leadPreferences || {
        projectTypes: [],
        budgetRanges: {},
        timelines: [],
      },
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    onSave(completeCampaign);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.campaignSettingsContainer}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="settings" size={20} color={neutralIconColor} />
              <Text style={styles.sectionTitle}>Availability Profile</Text>
            </View>
            <Text style={styles.sectionHint}>This is how you appear in the BPS network.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Availability Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Residential Electrical Services"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                value={campaign.campaignName || ''}
                onChangeText={(text) => setCampaign({ ...campaign, campaignName: text })}
              />
              <Text style={styles.inputHint}>How you'll appear to contractors and developers in the network</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>What type of work you want *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe the types of projects and work you're looking for..."
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                multiline
                numberOfLines={3}
                value={campaign.campaignDescription || ''}
                onChangeText={(text) => setCampaign({ ...campaign, campaignDescription: text })}
              />
            </View>

            <Text style={styles.sectionTitle}>Availability Window</Text>
            
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setCampaign({ ...campaign, runUntilPaused: !campaign.runUntilPaused })}
            >
              <View style={styles.toggleInfo}>
                <MaterialIcons name="schedule" size={20} color={neutralIconColor} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.toggleLabel}>Run Until Paused</Text>
                  <Text style={styles.toggleHint}>Campaign stays active until you manually pause it</Text>
                </View>
              </View>
              <View style={[styles.toggleSwitch, campaign.runUntilPaused && styles.toggleSwitchActive]}>
                <MaterialIcons 
                  name={campaign.runUntilPaused ? "check" : "close"} 
                  size={16} 
                  color={campaign.runUntilPaused ? neutralIconColor : (darkMode ? "#9CA3AF" : Colors.sub)} 
                />
              </View>
            </TouchableOpacity>

            {!campaign.runUntilPaused && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD (leave blank for today)"
                    placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                    value={campaign.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : ''}
                    onChangeText={(text) => {
                      if (text) {
                        const date = new Date(text);
                        if (!isNaN(date.getTime())) {
                          setCampaign({ ...campaign, startDate: date.toISOString() });
                        }
                      } else {
                        setCampaign({ ...campaign, startDate: undefined });
                      }
                    }}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                    value={campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : ''}
                    onChangeText={(text) => {
                      if (text) {
                        const date = new Date(text);
                        if (!isNaN(date.getTime())) {
                          setCampaign({ ...campaign, endDate: date.toISOString() });
                        }
                      } else {
                        setCampaign({ ...campaign, endDate: undefined });
                      }
                    }}
                  />
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Deal Preferences (Optional)</Text>
            <Text style={styles.sectionHint}>Filter which types of deals you want to receive</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Project Types</Text>
              <View style={styles.chipContainer}>
                {['Kitchen Remodel', 'Bathroom Remodel', 'New Build', 'Other'].map((type) => {
                  const key = type.toLowerCase().replace(/\s+/g, '_');
                  const isSelected = campaign.leadPreferences?.projectTypes?.includes(key);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => {
                        const currentTypes = campaign.leadPreferences?.projectTypes || [];
                        const newTypes = isSelected
                          ? currentTypes.filter(t => t !== key)
                          : [...currentTypes, key];
                        setCampaign({
                          ...campaign,
                          leadPreferences: {
                            ...campaign.leadPreferences,
                            projectTypes: newTypes,
                          },
                        });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Budget Range (Optional)</Text>
              <View style={styles.budgetRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                  placeholder="Min $"
                  placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                  keyboardType="numeric"
                  value={campaign.leadPreferences?.budgetRanges?.min?.toString() || ''}
                  onChangeText={(text) => {
                    const min = text ? parseInt(text, 10) : undefined;
                    setCampaign({
                      ...campaign,
                      leadPreferences: {
                        ...campaign.leadPreferences,
                        budgetRanges: {
                          ...campaign.leadPreferences?.budgetRanges,
                          min,
                        },
                      },
                    });
                  }}
                />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="Max $"
                  placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                  keyboardType="numeric"
                  value={campaign.leadPreferences?.budgetRanges?.max?.toString() || ''}
                  onChangeText={(text) => {
                    const max = text ? parseInt(text, 10) : undefined;
                    setCampaign({
                      ...campaign,
                      leadPreferences: {
                        ...campaign.leadPreferences,
                        budgetRanges: {
                          ...campaign.leadPreferences?.budgetRanges,
                          max,
                        },
                      },
                    });
                  }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Timeline Preferences</Text>
              <View style={styles.chipContainer}>
                {['Normal', 'Soon', 'Urgent'].map((timeline) => {
                  const isSelected = campaign.leadPreferences?.timelines?.includes(timeline);
                  return (
                    <TouchableOpacity
                      key={timeline}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => {
                        const currentTimelines = campaign.leadPreferences?.timelines || [];
                        const newTimelines = isSelected
                          ? currentTimelines.filter(t => t !== timeline)
                          : [...currentTimelines, timeline];
                        setCampaign({
                          ...campaign,
                          leadPreferences: {
                            ...campaign.leadPreferences,
                            timelines: newTimelines,
                          },
                        });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {timeline}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        );
      case 2:
        return (
          <SubcontractorProfileBuilder
            campaign={campaign}
            onUpdate={(updates) => setCampaign({ ...campaign, ...updates })}
          />
        );
      case 3:
        return (
          <PhotoUploadComponent
            portfolio={campaign.portfolio || []}
            onUpdate={(portfolio) => setCampaign({ ...campaign, portfolio })}
          />
        );
      case 4:
        return (
          <ServiceAreaSelector
            serviceAreas={campaign.serviceAreas || []}
            onUpdate={(serviceAreas) => setCampaign({ ...campaign, serviceAreas })}
          />
        );
      case 5:
        // Calculate Deal Flow Intelligence
        const dealFlowData = calculateDealFlowIntelligence(campaign);
        
        return (
          <View style={{ flex: 1 }}>
            <PricingCalculator
              pricing={campaign.pricing!}
              onUpdate={(pricing) => setCampaign({ ...campaign, pricing })}
            />
            
            {/* Deal Flow Intelligence */}
            <View style={styles.dealFlowIntelligenceCard}>
              <View style={styles.dealFlowIntelligenceHeader}>
                <MaterialIcons name="trending-up" size={20} color="#19E180" />
                <Text style={styles.dealFlowIntelligenceTitle}>Deal Flow Intelligence</Text>
              </View>
              
              <View style={styles.dealFlowIntelligenceContent}>
                <View style={styles.dealFlowIntelligenceRow}>
                  <MaterialIcons name="business-center" size={18} color="#60A5FA" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.dealFlowIntelligenceLabel}>Average Job Size ({dealFlowData.primaryService})</Text>
                    <Text style={styles.dealFlowIntelligenceValue}>
                      ${dealFlowData.avgJobSize.toLocaleString()}
                    </Text>
                    <Text style={styles.dealFlowIntelligenceSubtext}>
                      Based on {dealFlowData.locationText} market data
                    </Text>
                  </View>
                </View>
                
                <View style={styles.dealFlowIntelligenceRow}>
                  <MaterialIcons name="percent" size={18} color="#43cea2" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.dealFlowIntelligenceLabel}>Typical Close Rate</Text>
                    <Text style={styles.dealFlowIntelligenceValue}>
                      {dealFlowData.closeRate}%
                    </Text>
                    <Text style={styles.dealFlowIntelligenceSubtext}>
                      Industry average for {dealFlowData.primaryService}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.dealFlowIntelligenceRow}>
                  <MaterialIcons name="attach-money" size={18} color="#19E180" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.dealFlowIntelligenceLabel}>Estimated Monthly Awarded Value</Text>
                    <Text style={[styles.dealFlowIntelligenceValue, { color: '#19E180', fontSize: 22 }]}>
                      ${dealFlowData.monthlyAwarded.toLocaleString()}
                    </Text>
                    <Text style={styles.dealFlowIntelligenceSubtext}>
                      With your reach: ~{dealFlowData.estimatedMonthlyRequests} requests/month potential
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      case 6:
        const warnings = getValidationWarnings();
        return (
          <View style={styles.reviewContainer}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="check-circle" size={20} color={neutralIconColor} />
              <Text style={styles.sectionTitle}>Review Your Campaign</Text>
            </View>
            
            {warnings.length > 0 && (
              <View style={styles.warningContainer}>
                <MaterialIcons name="warning" size={20} color="#F59E0B" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.warningTitle}>Incomplete Sections</Text>
                  {warnings.map((warning, index) => (
                    <Text key={index} style={styles.warningText}>• {warning}</Text>
                  ))}
                </View>
              </View>
            )}

            {campaign.campaignName && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Campaign Name:</Text>
                <Text style={styles.reviewValue}>{campaign.campaignName}</Text>
              </View>
            )}

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Company:</Text>
              <Text style={styles.reviewValue}>{campaign.companyName || 'Not set'}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Services:</Text>
              <Text style={styles.reviewValue}>{campaign.services?.join(', ') || 'None'}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Service Areas:</Text>
              <Text style={styles.reviewValue}>
                {campaign.serviceAreas?.length > 0 
                  ? campaign.serviceAreas.map(area => `${area.city}, ${area.state}`).join(', ')
                  : 'None'}
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Hourly Rate:</Text>
              <Text style={styles.reviewValue}>
                ${campaign.pricing?.hourlyRate.min || 0} - ${campaign.pricing?.hourlyRate.max || 0}/hr
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Portfolio Photos:</Text>
              <Text style={styles.reviewValue}>{campaign.portfolio?.length || 0} photos</Text>
            </View>
            {campaign.runUntilPaused ? (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Duration:</Text>
                <Text style={styles.reviewValue}>Run until paused</Text>
              </View>
            ) : (
              <>
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>Start Date:</Text>
                  <Text style={styles.reviewValue}>
                    {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'Not set'}
                  </Text>
                </View>
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>End Date:</Text>
                  <Text style={styles.reviewValue}>
                    {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'Not set'}
                  </Text>
                </View>
              </>
            )}
            {campaign.leadPreferences && (
              (campaign.leadPreferences.projectTypes && campaign.leadPreferences.projectTypes.length > 0) ||
              (campaign.leadPreferences.budgetRanges && (campaign.leadPreferences.budgetRanges.min || campaign.leadPreferences.budgetRanges.max)) ||
              (campaign.leadPreferences.timelines && campaign.leadPreferences.timelines.length > 0)
            ) && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Lead Preferences:</Text>
                <Text style={styles.reviewValue}>
                  {campaign.leadPreferences.projectTypes && campaign.leadPreferences.projectTypes.length > 0 && (
                    `Types: ${campaign.leadPreferences.projectTypes.join(', ')}`
                  )}
                  {campaign.leadPreferences.budgetRanges && (campaign.leadPreferences.budgetRanges.min || campaign.leadPreferences.budgetRanges.max) && (
                    ` | Budget: ${campaign.leadPreferences.budgetRanges.min ? `$${campaign.leadPreferences.budgetRanges.min}` : ''}${campaign.leadPreferences.budgetRanges.min && campaign.leadPreferences.budgetRanges.max ? ' - ' : ''}${campaign.leadPreferences.budgetRanges.max ? `$${campaign.leadPreferences.budgetRanges.max}` : ''}`
                  )}
                  {campaign.leadPreferences.timelines && campaign.leadPreferences.timelines.length > 0 && (
                    ` | Timelines: ${campaign.leadPreferences.timelines.join(', ')}`
                  )}
                </Text>
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Availability Profile';
      case 2: return 'Company Information';
      case 3: return 'Project Proof';
      case 4: return 'Service Areas';
      case 5: return 'Pricing & Rates';
      case 6: return 'Review & Publish';
      default: return '';
    }
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return 'settings';
      case 2: return 'business';
      case 3: return 'photo-library';
      case 4: return 'location-on';
      case 5: return 'attach-money';
      case 6: return 'check-circle';
      default: return 'circle';
    }
  };

  const renderProgressIndicator = () => {
    return (
      <View style={styles.progressIndicatorContainer}>
        {[1, 2, 3, 4, 5, 6].map((step, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isUpcoming = step > currentStep;

          return (
            <View key={step} style={styles.progressStepWrapper}>
              {/* Step Circle */}
              {(isCompleted || isCurrent) ? (
                <View style={[styles.progressStepCircle, { backgroundColor: '#43cea2', borderColor: '#43cea2' }]}>
                  <MaterialIcons
                    name={isCompleted ? 'check' : getStepIcon(step)}
                    size={20}
                    color="#000000"
                  />
                </View>
              ) : (
                <View style={[styles.progressStepCircle, styles.progressStepUpcoming]}>
                  <MaterialIcons
                    name={getStepIcon(step)}
                    size={20}
                    color={darkMode ? "#6B7280" : Colors.sub}
                  />
                </View>
              )}

              {/* Connector Line */}
              {index < 5 && (
                <View
                  style={[
                    styles.progressConnector,
                    isCompleted && { backgroundColor: '#43cea2' },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={styles.backBtn}
                >
                  <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{isEditMode ? 'Edit Campaign' : 'Create Campaign'}</Text>
              <Text style={styles.headerSubtitle}>{getStepTitle()}</Text>
            </View>
            <TouchableOpacity 
              style={styles.previewButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowPreview(true);
              }}
            >
              <MaterialIcons name="visibility" size={20} color={neutralIconColor} />
              <Text style={styles.previewButtonText}>Preview</Text>
            </TouchableOpacity>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>{currentStep}/{totalSteps}</Text>
            </View>
          </View>

          {/* Enhanced Progress Indicator */}
          {renderProgressIndicator()}

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            {renderStepContent()}
            
            {/* Navigation - Inside ScrollView so it scrolls with content */}
            <View style={styles.navigation}>
              <TouchableOpacity 
                style={[styles.navButton, { flex: 1 }, currentStep === 1 && { opacity: 0, pointerEvents: 'none' }]}
                onPress={handlePrevious}
                disabled={currentStep === 1}
              >
                <MaterialIcons name="arrow-back" size={24} color={neutralIconColor} />
                <Text style={styles.navButtonText}>Previous</Text>
              </TouchableOpacity>
              
              <View style={styles.navSpacer} />
              
              {currentStep < totalSteps ? (
                <TouchableOpacity 
                  style={[styles.navButton, styles.primaryButton, { flex: 1 }]}
                  onPress={handleNext}
                >
                  <Text style={styles.primaryButtonText}>Next</Text>
                  <MaterialIcons name="arrow-forward" size={24} color={neutralIconColor} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.navButton, styles.saveButton, { flex: 1 }]}
                  onPress={handleSave}
                >
                  <MaterialIcons name="publish" size={24} color={neutralIconColor} />
                  <Text style={styles.saveButtonText}>{isEditMode ? 'Update Campaign' : 'Publish Campaign'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Campaign Preview Modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="fullScreen">
          <View style={styles.container}>
          {/* Preview Header */}
          <View style={styles.previewHeader}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowPreview(false);
                  }}
                  style={styles.backBtn}
                >
                  <MaterialIcons name="arrow-back" size={24} color={neutralIconColor} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Campaign Preview</Text>
              <Text style={styles.headerSubtitle}>How customers will see your campaign</Text>
            </View>
          </View>

          <ScrollView style={styles.previewContent} showsVerticalScrollIndicator={false}>
            {/* Profile Header Card */}
            <View style={styles.previewSection}>
              <View style={styles.previewCompanyHeader}>
                <View style={styles.previewCompanyIcon}>
                  <Text style={styles.previewCompanyInitials}>
                    {(campaign.companyName || 'C')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.previewCompanyName}>{campaign.companyName || 'Company Name'}</Text>
                  {campaign.serviceAreas && campaign.serviceAreas.length > 0 && campaign.services && campaign.services.length > 0 && (
                    <Text style={styles.previewCompanyLocation}>
                      {campaign.serviceAreas[0].city}, {campaign.serviceAreas[0].state} · {campaign.services[0]}
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.previewStatusPill,
                  campaign.status === 'active' && { backgroundColor: 'rgba(25, 225, 128, 0.2)', borderColor: '#19E180' },
                  campaign.status === 'paused' && { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
                  (campaign.status === 'draft' || !campaign.status) && { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
                ]}>
                  <View style={[
                    styles.previewStatusDot,
                    campaign.status === 'active' && { backgroundColor: '#19E180' },
                    campaign.status === 'paused' && { backgroundColor: '#F59E0B' },
                    (campaign.status === 'draft' || !campaign.status) && { backgroundColor: '#3B82F6' },
                  ]} />
                  <Text style={[
                    styles.previewStatusText,
                    campaign.status === 'active' && { color: '#19E180' },
                    campaign.status === 'paused' && { color: '#F59E0B' },
                    (campaign.status === 'draft' || !campaign.status) && { color: '#3B82F6' },
                  ]}>
                    {campaign.status === 'active' ? 'Active' : campaign.status === 'paused' ? 'Paused' : 'Optimizing'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Company Bio */}
            {campaign.bio && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>About {campaign.companyName || 'Company'}</Text>
                <View style={styles.previewBioCard}>
                  <Text style={styles.previewBioText}>{campaign.bio}</Text>
                </View>
              </View>
            )}

            {/* Credibility Row */}
            {(campaign.licenseNumber || campaign.insuranceProvider || campaign.yearsExperience) && (
              <View style={styles.previewSection}>
                <View style={styles.previewCredibilityRow}>
                  {campaign.licenseNumber && campaign.insuranceProvider && (
                    <View style={styles.previewCredibilityItem}>
                      <MaterialIcons name="verified" size={16} color="#19E180" />
                      <Text style={styles.previewCredibilityText}>Licensed & Insured</Text>
                    </View>
                  )}
                  {campaign.yearsExperience && campaign.yearsExperience > 0 && (
                    <View style={styles.previewCredibilityItem}>
                      <MaterialIcons name="construction" size={16} color="#60A5FA" />
                      <Text style={styles.previewCredibilityText}>{campaign.yearsExperience} yrs exp</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Services */}
            {campaign.services && campaign.services.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Services</Text>
                <View style={styles.previewChipsContainer}>
                  {campaign.services.map((service, index) => (
                    <View key={index} style={styles.previewChip}>
                      <Text style={styles.previewChipText}>{service}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Specialties */}
            {campaign.specialties && campaign.specialties.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Specialties</Text>
                <View style={styles.previewChipsContainer}>
                  {campaign.specialties.map((specialty, index) => (
                    <View key={index} style={styles.previewChip}>
                      <Text style={styles.previewChipText}>{specialty}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pricing */}
            {campaign.pricing && (campaign.pricing.hourlyRate.max > 0 || campaign.pricing.projectMinimum > 0) && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Pricing</Text>
                {campaign.pricing.projectMinimum > 0 && (
                  <View style={styles.previewPricingRow}>
                    <MaterialIcons name="attach-money" size={20} color="#19E180" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.previewPricingLabel}>Typical projects from</Text>
                      <Text style={styles.previewPricingValue}>
                        ${campaign.pricing.projectMinimum.toLocaleString()}{campaign.pricing.hourlyRate.max > 0 ? ` – $${Math.floor(campaign.pricing.projectMinimum * 5).toLocaleString()}` : '+'}
                      </Text>
                    </View>
                  </View>
                )}
                {campaign.pricing.hourlyRate.max > 0 && (
                  <View style={styles.previewPricingRow}>
                    <MaterialIcons name="receipt" size={20} color="#60A5FA" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.previewPricingLabel}>Hourly rate</Text>
                      <Text style={styles.previewPricingValue}>
                        ${campaign.pricing.hourlyRate.min || campaign.pricing.hourlyRate.max}–${campaign.pricing.hourlyRate.max}/hr
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Service Areas */}
            {campaign.serviceAreas && campaign.serviceAreas.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Service Areas</Text>
                {campaign.serviceAreas.map((area, index) => (
                  <View key={index} style={styles.previewAreaCard}>
                    <MaterialIcons name="location-on" size={18} color={neutralIconColor} />
                    <Text style={styles.previewAreaText}>
                      {area.city}, {area.state} ({area.radius} miles)
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Portfolio */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>Project Proof</Text>
              {campaign.portfolio && campaign.portfolio.length > 0 ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewPhotoScroll}>
                    {campaign.portfolio.slice(0, 3).map((photo, index) => (
                      <View key={index} style={styles.previewPhotoCard}>
                        <Image source={{ uri: photo.uri }} style={styles.previewPhotoImage} />
                        {index === 0 && (
                          <View style={styles.previewFeaturedBadge}>
                            <MaterialIcons name="star" size={10} color={neutralIconColor} />
                          </View>
                        )}
                        {photo.caption && (
                          <View style={styles.previewPhotoCaptionOverlay}>
                            <Text style={styles.previewPhotoCaptionText} numberOfLines={2}>
                              {photo.caption}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                  {campaign.portfolio.length > 3 && (
                    <Text style={styles.previewPortfolioMore}>View full portfolio →</Text>
                  )}
                </>
              ) : (
                <View style={styles.previewPortfolioEmpty}>
                  <MaterialIcons name="photo-library" size={32} color="#6B7280" />
                  <Text style={styles.previewPortfolioEmptyText}>Add photos to improve visibility and trust</Text>
                </View>
              )}
            </View>

            {/* Certifications */}
            {campaign.certifications && campaign.certifications.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Certifications</Text>
                <View style={styles.previewChipsContainer}>
                  {campaign.certifications.map((cert, index) => (
                    <View key={index} style={[styles.previewChip, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' }]}>
                      <MaterialIcons name="verified" size={14} color={neutralIconColor} />
                      <Text style={[styles.previewChipText, { color: darkMode ? '#FFFFFF' : Colors.text, marginLeft: 4 }]}>{cert}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Response Time */}
            {campaign.responseTime && (
              <View style={styles.previewSection}>
                <View style={[
                  styles.previewResponseCard,
                  (campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour') && styles.previewResponseCardFast,
                  campaign.responseTime === 'within_day' && styles.previewResponseCardMedium,
                  campaign.responseTime === 'within_week' && styles.previewResponseCardSlow,
                ]}>
                  <MaterialIcons 
                    name={campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour' ? "bolt" : "schedule"} 
                    size={24} 
                    color={
                      campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour' ? '#19E180' :
                      campaign.responseTime === 'within_day' ? '#F59E0B' : (darkMode ? '#9CA3AF' : Colors.sub)
                    } 
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.previewResponseLabel}>Typical Response Time</Text>
                    <Text style={[
                      styles.previewResponseValue,
                      (campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour') && { color: '#19E180' },
                      campaign.responseTime === 'within_day' && { color: '#F59E0B' },
                      campaign.responseTime === 'within_week' && { color: darkMode ? '#9CA3AF' : Colors.sub },
                    ]}>
                      {campaign.responseTime === 'immediate' ? 'Responds within 4 hours' : 
                       campaign.responseTime === 'within_hour' ? 'Responds within 4 hours' :
                       campaign.responseTime === 'within_day' ? 'Responds within 24 hours' : 'Responds within 1 week'}
                    </Text>
                    <Text style={styles.previewResponseSubtext}>Faster responses improve selection priority</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Contact Info */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>Contact Information</Text>
              {campaign.phone && (
                <View style={styles.previewContactRow}>
                  <MaterialIcons name="phone" size={18} color={neutralIconColor} />
                  <Text style={styles.previewContactText}>{campaign.phone}</Text>
                </View>
              )}
              {campaign.email && (
                <View style={styles.previewContactRow}>
                  <MaterialIcons name="email" size={18} color={neutralIconColor} />
                  <Text style={styles.previewContactText}>{campaign.email}</Text>
                </View>
              )}
              {campaign.website && (
                <View style={styles.previewContactRow}>
                  <MaterialIcons name="language" size={18} color={neutralIconColor} />
                  <Text style={styles.previewContactText}>{campaign.website}</Text>
                </View>
              )}
              {campaign.instagram && (
                <TouchableOpacity 
                  style={styles.previewInstagramButton}
                  onPress={() => {
                    const username = campaign.instagram?.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', '');
                    const instagramUrl = `https://instagram.com/${username}`;
                    Linking.openURL(instagramUrl);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.instagramBadgePreview}>
                    <IGLogo />
                    <Text style={styles.instagramBadgePreviewText}>Instagram</Text>
                  </View>
                  <Text style={styles.previewInstagramText}>
                    @{campaign.instagram.replace('@', '').replace('https://instagram.com/', '').replace('https://www.instagram.com/', '')}
                  </Text>
                  <MaterialIcons name="open-in-new" size={16} color="#E1306C" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Preview Footer */}
          <View style={styles.previewFooter}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setShowPreview(false)}
            >
              <Text style={styles.previewCloseButtonText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const getStyles = (darkMode: boolean, Colors: ReturnType<typeof getColors>) => ({
  container: {
    flex: 1,
    backgroundColor: darkMode ? '#000000' : Colors.bg,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden' as const,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: darkMode ? '#000000' : '#FFFFFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: darkMode ? '#E2E8F0' : Colors.sub,
    marginTop: 2,
  },
  stepIndicator: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: darkMode ? '#9CA3AF' : Colors.sub,
  },
  progressIndicatorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressStepWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  progressStepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
  },
  progressStepCompleted: {
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.3)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
  },
  progressStepCurrent: {
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.3)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.15)' : Colors.surface2,
  },
  progressStepUpcoming: {
    borderColor: darkMode ? 'rgba(107, 114, 128, 0.3)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(107, 114, 128, 0.1)' : Colors.surface2,
  },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    marginHorizontal: 4,
  },
  progressConnectorCompleted: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.3)' : Colors.line,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navigation: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
  },
  navButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
  },
  navSpacer: {
    width: 12,
  },
  primaryButton: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  primaryButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  saveButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  navButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginLeft: 8,
  },
  reviewContainer: {
    paddingVertical: 20,
  },
  reviewSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  previewButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    marginRight: 8,
  },
  previewButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  previewHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  previewSection: {
    marginTop: 20,
    marginBottom: 8,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 12,
  },
  previewCompanyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  previewCompanyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewCompanyInitials: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#43cea2',
  },
  previewCompanyName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  previewCompanyLocation: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 4,
  },
  previewContactName: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 2,
  },
  previewStatusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  previewStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  previewCredibilityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  previewCredibilityItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  previewCredibilityText: {
    fontSize: 13,
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontWeight: '500' as const,
  },
  previewBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 10,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  previewBioCard: {
    padding: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  previewBioText: {
    fontSize: 14,
    color: darkMode ? '#FFFFFF' : Colors.text,
    lineHeight: 20,
  },
  previewChipsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  previewChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  previewChipText: {
    fontSize: 12,
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontWeight: '500' as const,
  },
  previewPricingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewPricingLabel: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginLeft: 8,
    flex: 1,
  },
  previewPricingValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  previewAreaCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewAreaText: {
    fontSize: 14,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 8,
  },
  previewPhotoScroll: {
    marginTop: 8,
  },
  previewPhotoCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    marginRight: 12,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  previewPhotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' as const,
  },
  previewFeaturedBadge: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewPhotoCaptionOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 28, 56, 0.9)',
    padding: 6,
  },
  previewPhotoCaptionText: {
    fontSize: 10,
    color: darkMode ? '#E2E8F0' : Colors.sub,
    lineHeight: 12,
  },
  previewResponseCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  previewResponseLabel: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
  },
  previewResponseValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F59E0B',
    marginTop: 2,
  },
  previewResponseSubtext: {
    fontSize: 11,
    color: darkMode ? '#6B7280' : Colors.sub,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  previewResponseCardFast: {
    backgroundColor: 'rgba(25, 225, 128, 0.1)',
    borderColor: 'rgba(25, 225, 128, 0.3)',
  },
  previewResponseCardMedium: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  previewResponseCardSlow: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  previewPortfolioMore: {
    fontSize: 13,
    color: '#60A5FA',
    marginTop: 8,
    fontWeight: '500' as const,
  },
  previewPortfolioEmpty: {
    padding: 32,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewPortfolioEmptyText: {
    fontSize: 13,
    color: darkMode ? '#6B7280' : Colors.sub,
    marginTop: 12,
    textAlign: 'center' as const,
  },
  previewContactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewContactText: {
    fontSize: 14,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 8,
  },
  previewInstagramButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: 'rgba(225, 48, 108, 0.1)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(225, 48, 108, 0.3)',
  },
  instagramBadgePreview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#E1306C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
    gap: 4,
  },
  instagramBadgePreviewText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  previewInstagramText: {
    fontSize: 14,
    color: '#E1306C',
    fontWeight: '500' as const,
  },
  previewFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.line,
  },
  previewCloseButton: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  previewCloseButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  // Campaign Settings Styles
  campaignSettingsContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 8,
  },
  sectionHint: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 16,
    fontStyle: 'italic' as const,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  textInput: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: darkMode ? '#FFFFFF' : Colors.text,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    marginBottom: 16,
  },
  toggleInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  toggleHint: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.5)',
  },
  toggleSwitchActive: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.3)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.4)' : Colors.line,
  },
  chipContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  chipSelected: {
    backgroundColor: '#43cea2',
    borderColor: '#43cea2',
  },
  chipText: {
    fontSize: 14,
    color: darkMode ? '#E2E8F0' : Colors.text,
    fontWeight: '500' as const,
  },
  chipTextSelected: {
    color: '#000000',
    fontWeight: '600' as const,
  },
  budgetRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 8,
  },
  warningContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginBottom: 4,
    lineHeight: 16,
  },
  dealFlowIntelligenceCard: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  dealFlowIntelligenceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    gap: 10,
  },
  dealFlowIntelligenceTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  dealFlowIntelligenceContent: {
    gap: 16,
  },
  dealFlowIntelligenceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  dealFlowIntelligenceLabel: {
    fontSize: 13,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 4,
    fontWeight: '500' as const,
  },
  dealFlowIntelligenceValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  dealFlowIntelligenceSubtext: {
    fontSize: 11,
    color: darkMode ? '#6B7280' : Colors.sub,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
});
