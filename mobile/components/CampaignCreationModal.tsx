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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { SubcontractorProfileBuilder } from './SubcontractorProfileBuilder';
import { PhotoUploadComponent } from './PhotoUploadComponent';
import { ServiceAreaSelector } from './ServiceAreaSelector';
import { SPECIALTY_PRICING_TEMPLATES } from './PricingCalculator';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
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

const DEFAULT_PROJECT_MINIMUM = 2500;

function typicalHourlyForServices(services: string[] | undefined) {
  const primary = services?.[0] as keyof typeof SPECIALTY_PRICING_TEMPLATES | undefined;
  if (primary && SPECIALTY_PRICING_TEMPLATES[primary]) {
    return SPECIALTY_PRICING_TEMPLATES[primary];
  }
  return SPECIALTY_PRICING_TEMPLATES['General Contracting'];
}

/** Legacy campaigns may have $0 pricing; merge templates so the short form shows sensible defaults. */
function mergePricingDefaultsForForm(
  pricing: SubcontractorCampaign['pricing'] | undefined,
  services: string[] | undefined,
): SubcontractorCampaign['pricing'] {
  const tpl = typicalHourlyForServices(services);
  const hrMin = pricing?.hourlyRate?.min;
  const hrMax = pricing?.hourlyRate?.max;
  const min = typeof hrMin === 'number' && hrMin > 0 ? hrMin : tpl.min;
  const max = typeof hrMax === 'number' && hrMax > 0 ? hrMax : tpl.max;
  const projectMinimum =
    typeof pricing?.projectMinimum === 'number' && pricing.projectMinimum > 0
      ? pricing.projectMinimum
      : DEFAULT_PROJECT_MINIMUM;
  return {
    hourlyRate: { min, max },
    projectMinimum,
    specialties: pricing?.specialties || {},
  };
}

/** Web: gradient frame (860) like Find Subcontractors / Messages; native: simple column. */
function CampaignWebFormOptionalChrome({
  isWeb,
  darkMode,
  Colors,
  columnStyle,
  fillVertical,
  children,
}: {
  isWeb: boolean;
  darkMode: boolean;
  Colors: ReturnType<typeof getColors>;
  columnStyle?: Record<string, unknown>;
  fillVertical?: boolean;
  children: React.ReactNode;
}) {
  const fill = fillVertical ? ({ flex: 1, minHeight: 0 } as const) : {};
  if (isWeb) {
    return (
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={BRAND_FRAME_GRADIENT_START}
        end={BRAND_FRAME_GRADIENT_END}
        style={{
          width: '100%',
          maxWidth: 860,
          alignSelf: 'center',
          borderRadius: 24,
          padding: 1,
          overflow: 'hidden',
          marginBottom: 4,
          ...fill,
        }}
      >
        <View
          style={{
            width: '100%',
            borderRadius: 23,
            padding: 28,
            backgroundColor: darkMode ? '#050807' : Colors.surface2,
            ...fill,
          }}
        >
          <View style={{ gap: 14, width: '100%', ...fill }}>{children}</View>
        </View>
      </LinearGradient>
    );
  }
  return (
    <View style={[{ paddingTop: 0, gap: 14, width: '100%' }, columnStyle || {}]}>
      {children}
    </View>
  );
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
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const webColumn860 = isWeb
    ? ({ width: '100%' as const, maxWidth: 860, alignSelf: 'center' as const } as const)
    : undefined;
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
      hourlyRate: { ...typicalHourlyForServices([]) },
      projectMinimum: DEFAULT_PROJECT_MINIMUM,
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
      setCampaign({
        ...initialData,
        pricing: mergePricingDefaultsForForm(initialData.pricing, initialData.services),
      });
    } else if (!isEditMode) {
      // Reset form for new campaign
      setCampaign({
        campaignName: '',
        campaignDescription: '',
        services: [],
        specialties: [],
        serviceAreas: [],
        pricing: {
          hourlyRate: { ...typicalHourlyForServices([]) },
          projectMinimum: DEFAULT_PROJECT_MINIMUM,
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

  useEffect(() => {
    if (!visible) return;
    setShowPreview(false);
    if (!isEditMode) {
      setCurrentStep(1);
    }
  }, [visible, isEditMode]);

  /** Three steps: basics + company, reach + pricing, review (was six). */
  const totalSteps = 3;

  // Validation: required fields only; portfolio and fine-grained pricing are optional / defaulted on publish.
  const getValidationWarnings = (): string[] => {
    const warnings: string[] = [];

    if (!campaign.campaignName || campaign.campaignName.trim() === '') {
      warnings.push('Campaign name is required');
    }

    if (!campaign.companyName || !campaign.contactName || !campaign.email || !campaign.phone) {
      warnings.push('Company information is incomplete');
    }
    if (!campaign.services || campaign.services.length === 0) {
      warnings.push('No services selected');
    }
    if (!campaign.specialties || campaign.specialties.length === 0) {
      warnings.push('No markets selected');
    }

    if (!campaign.serviceAreas || campaign.serviceAreas.length === 0) {
      warnings.push('No service areas selected');
    }

    const hr = campaign.pricing?.hourlyRate;
    const pm = campaign.pricing?.projectMinimum ?? 0;
    if (!hr || hr.min <= 0 || hr.max <= 0 || hr.min > hr.max) {
      warnings.push('Hourly rate range looks incomplete');
    }
    if (pm <= 0) {
      warnings.push('Minimum job size is missing');
    }

    return warnings;
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
    const tpl = typicalHourlyForServices(campaign.services);
    const specialtiesFinal =
      campaign.specialties && campaign.specialties.length > 0
        ? campaign.specialties
        : ['Residential'];

    let hourlyMin = campaign.pricing?.hourlyRate?.min ?? tpl.min;
    let hourlyMax = campaign.pricing?.hourlyRate?.max ?? tpl.max;
    if (hourlyMin <= 0 || hourlyMax <= 0) {
      hourlyMin = tpl.min;
      hourlyMax = tpl.max;
    }
    if (hourlyMin > hourlyMax) {
      const t = hourlyMin;
      hourlyMin = hourlyMax;
      hourlyMax = t;
    }
    const projectMinimum =
      campaign.pricing?.projectMinimum && campaign.pricing.projectMinimum > 0
        ? campaign.pricing.projectMinimum
        : DEFAULT_PROJECT_MINIMUM;

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
      specialties: specialtiesFinal,
      serviceAreas: campaign.serviceAreas || [],
      pricing: {
        hourlyRate: { min: hourlyMin, max: hourlyMax },
        projectMinimum,
        specialties: campaign.pricing?.specialties || {},
      },
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
          <View>
            <View style={styles.campaignSettingsContainer}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="settings" size={20} color={neutralIconColor} />
              <Text style={styles.sectionTitle}>Your campaign</Text>
            </View>
            <Text style={styles.sectionHint}>How you appear in the BPS network.</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Campaign name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Residential Electrical Services"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                value={campaign.campaignName || ''}
                onChangeText={(text) => setCampaign({ ...campaign, campaignName: text })}
                {...resolveTextInputKeyboardProps()}
              />
            </View>

            <Text style={styles.sectionTitle}>Availability</Text>
            
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
                    {...resolveTextInputKeyboardProps()}
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
                    {...resolveTextInputKeyboardProps()}
                  />
                </View>
              </>
            )}
          </View>
            <SubcontractorProfileBuilder
              variant="essential"
              campaign={campaign}
              onUpdate={(updates) => setCampaign({ ...campaign, ...updates })}
            />
          </View>
        );
      case 2:
        return (
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="photo-library" size={20} color={neutralIconColor} />
              <Text style={styles.sectionTitle}>Your work</Text>
            </View>
            <Text style={styles.sectionHint}>
              Show completed jobs or before & after — helps contractors see your quality.
            </Text>
            <PhotoUploadComponent
              portfolio={campaign.portfolio || []}
              onUpdate={(portfolio) => setCampaign({ ...campaign, portfolio })}
            />

            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <MaterialIcons name="location-on" size={20} color={neutralIconColor} />
              <Text style={styles.sectionTitle}>Where you work</Text>
            </View>
            <Text style={styles.sectionHint}>
              Add at least one area. You can refine coverage later.
            </Text>
            <ServiceAreaSelector
              serviceAreas={campaign.serviceAreas || []}
              onUpdate={(serviceAreas) => setCampaign({ ...campaign, serviceAreas })}
            />

            <Text style={[styles.sectionHint, { marginTop: 12 }]}>
              Hourly rates and minimum job size use trade defaults until you set them in Profile. You can add more photos there too.
            </Text>
          </View>
        );
      case 3:
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
              <Text style={styles.reviewLabel}>Markets:</Text>
              <Text style={styles.reviewValue}>{campaign.specialties?.join(', ') || 'None'}</Text>
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
              <Text style={styles.reviewLabel}>Hourly rate:</Text>
              <Text style={styles.reviewValue}>
                ${campaign.pricing?.hourlyRate.min || 0} – ${campaign.pricing?.hourlyRate.max || 0}/hr
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Minimum job:</Text>
              <Text style={styles.reviewValue}>
                {campaign.pricing?.projectMinimum
                  ? `$${campaign.pricing.projectMinimum.toLocaleString()}`
                  : 'Not set'}
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Portfolio:</Text>
              <Text style={styles.reviewValue}>
                {(campaign.portfolio?.length ?? 0) > 0
                  ? `${campaign.portfolio.length} photo${campaign.portfolio.length === 1 ? '' : 's'}`
                  : 'None (optional — add in Profile)'}
              </Text>
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

  const getSubtitleForWizardStep = (step: number) => {
    switch (step) {
      case 1:
        return 'Campaign & company';
      case 2:
        return 'Work & areas';
      case 3:
        return 'Review & publish';
      default:
        return '';
    }
  };

  const getStepTitle = () => {
    return getSubtitleForWizardStep(currentStep);
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1:
        return 'business';
      case 2:
        return 'place';
      case 3:
        return 'check-circle';
      default:
        return 'circle';
    }
  };

  const renderProgressIndicator = () => {
    return (
      <View
        style={[
          styles.progressIndicatorContainer,
          isWeb && { paddingHorizontal: 0, paddingVertical: 14 },
        ]}
      >
        {[1, 2, 3].map((step, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <View key={step} style={styles.progressStepWrapper}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Step ${step} of ${totalSteps}: ${getSubtitleForWizardStep(step)}`}
                accessibilityState={{ selected: isCurrent }}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
                activeOpacity={0.75}
                onPress={() => {
                  if (step === currentStep) return;
                  setCurrentStep(step);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={isWeb ? ({ cursor: 'pointer' } as const) : undefined}
              >
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
              </TouchableOpacity>

              {/* Connector Line */}
              {index < totalSteps - 1 && (
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

  const renderCampaignPreviewBody = () => (
    <>
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
          <View
            style={[
              styles.previewStatusPill,
              campaign.status === 'active' && { backgroundColor: 'rgba(25, 225, 128, 0.2)', borderColor: '#19E180' },
              campaign.status === 'paused' && { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
              (campaign.status === 'draft' || !campaign.status) && { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
            ]}
          >
            <View
              style={[
                styles.previewStatusDot,
                campaign.status === 'active' && { backgroundColor: '#19E180' },
                campaign.status === 'paused' && { backgroundColor: '#F59E0B' },
                (campaign.status === 'draft' || !campaign.status) && { backgroundColor: '#3B82F6' },
              ]}
            />
            <Text
              style={[
                styles.previewStatusText,
                campaign.status === 'active' && { color: '#19E180' },
                campaign.status === 'paused' && { color: '#F59E0B' },
                (campaign.status === 'draft' || !campaign.status) && { color: '#3B82F6' },
              ]}
            >
              {campaign.status === 'active' ? 'Active' : campaign.status === 'paused' ? 'Paused' : 'Optimizing'}
            </Text>
          </View>
        </View>
      </View>

      {campaign.bio && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionTitle}>About {campaign.companyName || 'Company'}</Text>
          <View style={styles.previewBioCard}>
            <Text style={styles.previewBioText}>{campaign.bio}</Text>
          </View>
        </View>
      )}

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

      {campaign.pricing && (campaign.pricing.hourlyRate.max > 0 || campaign.pricing.projectMinimum > 0) && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionTitle}>Pricing</Text>
          {campaign.pricing.projectMinimum > 0 && (
            <View style={styles.previewPricingRow}>
              <MaterialIcons name="attach-money" size={20} color="#19E180" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.previewPricingLabel}>Typical projects from</Text>
                <Text style={styles.previewPricingValue}>
                  ${campaign.pricing.projectMinimum.toLocaleString()}
                  {campaign.pricing.hourlyRate.max > 0
                    ? ` – $${Math.floor(campaign.pricing.projectMinimum * 5).toLocaleString()}`
                    : '+'}
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

      {campaign.portfolio && campaign.portfolio.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionTitle}>Project proof</Text>
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
        </View>
      )}

      {campaign.certifications && campaign.certifications.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.previewSectionTitle}>Certifications</Text>
          <View style={styles.previewChipsContainer}>
            {campaign.certifications.map((cert, index) => (
              <View
                key={index}
                style={[styles.previewChip, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' }]}
              >
                <MaterialIcons name="verified" size={14} color={neutralIconColor} />
                <Text style={[styles.previewChipText, { color: darkMode ? '#FFFFFF' : Colors.text, marginLeft: 4 }]}>
                  {cert}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {campaign.responseTime && (
        <View style={styles.previewSection}>
          <View
            style={[
              styles.previewResponseCard,
              (campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour') && styles.previewResponseCardFast,
              campaign.responseTime === 'within_day' && styles.previewResponseCardMedium,
              campaign.responseTime === 'within_week' && styles.previewResponseCardSlow,
            ]}
          >
            <MaterialIcons
              name={campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour' ? 'bolt' : 'schedule'}
              size={24}
              color={
                campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour'
                  ? '#19E180'
                  : campaign.responseTime === 'within_day'
                    ? '#F59E0B'
                    : darkMode
                      ? '#9CA3AF'
                      : Colors.sub
              }
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.previewResponseLabel}>Typical Response Time</Text>
              <Text
                style={[
                  styles.previewResponseValue,
                  (campaign.responseTime === 'immediate' || campaign.responseTime === 'within_hour') && { color: '#19E180' },
                  campaign.responseTime === 'within_day' && { color: '#F59E0B' },
                  campaign.responseTime === 'within_week' && { color: darkMode ? '#9CA3AF' : Colors.sub },
                ]}
              >
                {campaign.responseTime === 'immediate'
                  ? 'Responds within 4 hours'
                  : campaign.responseTime === 'within_hour'
                    ? 'Responds within 4 hours'
                    : campaign.responseTime === 'within_day'
                      ? 'Responds within 24 hours'
                      : 'Responds within 1 week'}
              </Text>
              <Text style={styles.previewResponseSubtext}>Faster responses improve selection priority</Text>
            </View>
          </View>
        </View>
      )}

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
              const username = campaign.instagram
                ?.replace('@', '')
                .replace('https://instagram.com/', '')
                .replace('https://www.instagram.com/', '');
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
              @{campaign.instagram
                .replace('@', '')
                .replace('https://instagram.com/', '')
                .replace('https://www.instagram.com/', '')}
            </Text>
            <MaterialIcons name="open-in-new" size={16} color="#E1306C" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View
          style={[
            styles.container,
            isWeb && { width: '100%', alignItems: 'center', minHeight: 0 },
          ]}
        >
          <View
            style={[
              { flex: 1, width: '100%', minHeight: 0 },
              isWeb && {
                maxWidth: 1040,
                alignSelf: 'center',
              },
            ]}
          >
          <View
            style={[
              styles.header,
              isWeb && { paddingTop: Math.max(insets.top, 12) + 12 },
            ]}
          >
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
                  style={[
                    styles.backBtn,
                    !darkMode && { backgroundColor: Colors.bg },
                  ]}
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

          {/* Enhanced Progress Indicator + form — web: same gradient border shell as Find Sub / Messages */}
          {isWeb ? (
            <CampaignWebFormOptionalChrome
              isWeb={isWeb}
              darkMode={darkMode}
              Colors={Colors}
              columnStyle={webColumn860}
              fillVertical
            >
              {renderProgressIndicator()}
              <ScrollView
                style={[styles.content, { flex: 1, minHeight: 0, paddingHorizontal: 0 }]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[{ paddingBottom: 20 }, isWeb && { paddingHorizontal: 0 }]}
                {...FORM_KEYBOARD_SCROLL_PROPS}
              >
                {renderStepContent()}

                <View style={[styles.navigation, isWeb && { paddingHorizontal: 0 }]}>
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
                    <TouchableOpacity style={[styles.navButton, styles.primaryButton, { flex: 1 }]} onPress={handleNext}>
                      <Text style={styles.primaryButtonText}>Next</Text>
                      <MaterialIcons name="arrow-forward" size={24} color={neutralIconColor} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.navButton, styles.saveButton, { flex: 1 }]} onPress={handleSave}>
                      <MaterialIcons name="publish" size={24} color={neutralIconColor} />
                      <Text style={styles.saveButtonText}>{isEditMode ? 'Update Campaign' : 'Publish Campaign'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </CampaignWebFormOptionalChrome>
          ) : (
            <>
              {renderProgressIndicator()}
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                {...FORM_KEYBOARD_SCROLL_PROPS}
              >
                {renderStepContent()}

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
                    <TouchableOpacity style={[styles.navButton, styles.primaryButton, { flex: 1 }]} onPress={handleNext}>
                      <Text style={styles.primaryButtonText}>Next</Text>
                      <MaterialIcons name="arrow-forward" size={24} color={neutralIconColor} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.navButton, styles.saveButton, { flex: 1 }]} onPress={handleSave}>
                      <MaterialIcons name="publish" size={24} color={neutralIconColor} />
                      <Text style={styles.saveButtonText}>{isEditMode ? 'Update Campaign' : 'Publish Campaign'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </>
          )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Campaign Preview Modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="fullScreen">
          <View
            style={[
              styles.container,
              isWeb && { width: '100%', alignItems: 'center', minHeight: 0 },
            ]}
          >
          <View style={[{ flex: 1, width: '100%', minHeight: 0 }, isWeb && { maxWidth: 1040, alignSelf: 'center' }]}>
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
                  style={[styles.backBtn, !darkMode && { backgroundColor: Colors.bg }]}
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

          {isWeb ? (
            <CampaignWebFormOptionalChrome
              isWeb={isWeb}
              darkMode={darkMode}
              Colors={Colors}
              columnStyle={webColumn860}
              fillVertical
            >
              <ScrollView
                style={[styles.previewContent, { flex: 1, minHeight: 0, paddingHorizontal: 0 }]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {renderCampaignPreviewBody()}
              </ScrollView>
            </CampaignWebFormOptionalChrome>
          ) : (
            <ScrollView style={styles.previewContent} showsVerticalScrollIndicator={false}>
              {renderCampaignPreviewBody()}
            </ScrollView>
          )}

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
});
