import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SubcontractorCampaign } from './CampaignCreationModal';
import InstagramField from './InstagramField';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

interface SubcontractorProfileBuilderProps {
  campaign: Partial<SubcontractorCampaign>;
  onUpdate: (updates: Partial<SubcontractorCampaign>) => void;
}

const SERVICE_OPTIONS = [
  'Plumbing', 'Electrical', 'HVAC', 'Framing', 'Roofing', 'Flooring',
  'Painting', 'Drywall', 'Concrete', 'Landscaping', 'Kitchen Remodel',
  'Bathroom Remodel', 'General Contracting', 'Carpentry', 'Tile Work',
  'Stucco', 'Insulation', 'Windows & Doors', 'Siding', 'Deck Building'
];

const SPECIALTY_OPTIONS = [
  'Residential', 'Commercial', 'Industrial', 'Emergency Services',
  'Green Building', 'Historic Restoration', 'High-End Custom',
  'Multi-Family', 'Single Family', 'New Construction', 'Renovation',
  'Maintenance', 'Repair', 'Installation', 'Design-Build'
];

const CERTIFICATION_OPTIONS = [
  'Licensed Contractor', 'Bonded & Insured', 'OSHA Certified',
  'LEED Certified', 'EPA Certified', 'NATE Certified',
  'Master Electrician', 'Master Plumber', 'General Contractor License',
  'Specialty Trade License', 'Safety Certified', 'Quality Certified'
];

export function SubcontractorProfileBuilder({
  campaign,
  onUpdate,
}: SubcontractorProfileBuilderProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const neutralIconColor = darkMode ? '#FFFFFF' : '#000000';
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  const [selectedServices, setSelectedServices] = useState<string[]>(campaign.services || []);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(campaign.specialties || []);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>(campaign.certifications || []);

  const handleServiceToggle = (service: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = selectedServices.includes(service)
      ? selectedServices.filter(s => s !== service)
      : [...selectedServices, service];
    setSelectedServices(updated);
    onUpdate({ services: updated });
  };

  const handleSpecialtyToggle = (specialty: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = selectedSpecialties.includes(specialty)
      ? selectedSpecialties.filter(s => s !== specialty)
      : [...selectedSpecialties, specialty];
    setSelectedSpecialties(updated);
    onUpdate({ specialties: updated });
  };

  const handleCertificationToggle = (cert: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = selectedCertifications.includes(cert)
      ? selectedCertifications.filter(c => c !== cert)
      : [...selectedCertifications, cert];
    setSelectedCertifications(updated);
    onUpdate({ certifications: updated });
  };

  const renderMultiSelect = (
    title: string,
    options: string[],
    selected: string[],
    onToggle: (item: string) => void,
    icon: string
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name={icon} size={20} color={neutralIconColor} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>
          {selected.length} selected
        </Text>
      </View>
      <View style={styles.optionsGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionChip,
              selected.includes(option) && styles.optionChipSelected,
            ]}
            onPress={() => onToggle(option)}
          >
            <Text
              style={[
                styles.optionText,
                selected.includes(option) && styles.optionTextSelected,
              ]}
            >
              {option}
            </Text>
            {selected.includes(option) && (
              <MaterialIcons name="check" size={16} color={neutralIconColor} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Basic Information */}
      <View style={styles.section}>
      <View style={styles.sectionHeader}>
          <MaterialIcons name="business" size={20} color={neutralIconColor} />
          <Text style={styles.sectionTitle}>Company Information</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Company Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your company name"
            placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
            value={campaign.companyName || ''}
            onChangeText={(text) => onUpdate({ companyName: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Contact Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Your full name"
            placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
            value={campaign.contactName || ''}
            onChangeText={(text) => onUpdate({ contactName: text })}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="email@company.com"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              keyboardType="email-address"
              autoCapitalize="none"
              value={campaign.email || ''}
              onChangeText={(text) => onUpdate({ email: text })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Phone *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="(555) 123-4567"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              keyboardType="phone-pad"
              value={campaign.phone || ''}
              onChangeText={(text) => onUpdate({ phone: text })}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Website (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="https://yourcompany.com"
            placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
            keyboardType="url"
            autoCapitalize="none"
            value={campaign.website || ''}
            onChangeText={(text) => onUpdate({ website: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Instagram (Optional)</Text>
          <Text style={styles.inputSubtitle}>Share your Instagram to showcase your work</Text>
          <InstagramField
            value={campaign.instagram || ''}
            onChange={(username) => onUpdate({ instagram: username })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Company Bio</Text>
          <Text style={styles.inputSubtitle}>Tell contractors about your company, experience, and what makes you stand out</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="We are a family-owned business with 15 years of experience in residential and commercial construction..."
            placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
            multiline
            numberOfLines={6}
            maxLength={500}
            value={campaign.bio || ''}
            onChangeText={(text) => onUpdate({ bio: text })}
          />
          <Text style={styles.charCounter}>{(campaign.bio || '').length}/500</Text>
        </View>
      </View>

      {/* Professional Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="verified" size={20} color={neutralIconColor} />
          <Text style={styles.sectionTitle}>Professional Details</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>License Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="License #"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              value={campaign.licenseNumber || ''}
              onChangeText={(text) => onUpdate({ licenseNumber: text })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Years Experience</Text>
            <TextInput
              style={styles.textInput}
              placeholder="5"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              keyboardType="numeric"
              value={campaign.yearsExperience?.toString() || ''}
              onChangeText={(text) => onUpdate({ yearsExperience: parseInt(text) || 0 })}
            />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Team Size</Text>
            <TextInput
              style={styles.textInput}
              placeholder="1"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              keyboardType="numeric"
              value={campaign.teamSize?.toString() || ''}
              onChangeText={(text) => onUpdate({ teamSize: parseInt(text) || 1 })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Response Time</Text>
            <View style={styles.responseTimeContainer}>
              {[
                { key: 'immediate', label: 'Immediate' },
                { key: 'within_hour', label: 'Within Hour' },
                { key: 'within_day', label: 'Within Day' },
                { key: 'within_week', label: 'Within Week' }
              ].map((option) => {
                const isSelected = campaign.responseTime === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.responseTimeOption,
                      isSelected && styles.responseTimeSelected,
                      { 
                        borderColor: isSelected ? '#43cea2' : (darkMode ? '#E5E7EB' : Colors.line),
                        backgroundColor: isSelected ? '#43cea2' : (darkMode ? 'rgba(107, 114, 128, 0.1)' : Colors.surface2)
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onUpdate({ responseTime: option.key as any });
                    }}
                  >
                    <Text style={[
                      styles.responseTimeText,
                      { 
                        color: isSelected ? '#000000' : (darkMode ? '#9CA3AF' : Colors.sub),
                        fontWeight: isSelected ? '700' : '500'
                      }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Insurance Provider</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Insurance Co."
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              value={campaign.insuranceProvider || ''}
              onChangeText={(text) => onUpdate({ insuranceProvider: text })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Insurance Expiry</Text>
            <TextInput
              style={styles.textInput}
              placeholder="MM/YYYY"
              placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
              value={campaign.insuranceExpiry || ''}
              onChangeText={(text) => onUpdate({ insuranceExpiry: text })}
            />
          </View>
        </View>
      </View>

      {/* Services */}
      {renderMultiSelect(
        'Services Offered',
        SERVICE_OPTIONS,
        selectedServices,
        handleServiceToggle,
        'build'
      )}

      {/* Specialties */}
      {renderMultiSelect(
        'Specialties',
        SPECIALTY_OPTIONS,
        selectedSpecialties,
        handleSpecialtyToggle,
        'star'
      )}

      {/* Certifications */}
      {renderMultiSelect(
        'Certifications & Licenses',
        CERTIFICATION_OPTIONS,
        selectedCertifications,
        handleCertificationToggle,
        'verified'
      )}

      {/* Equipment */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="construction" size={20} color={neutralIconColor} />
          <Text style={styles.sectionTitle}>Equipment & Tools</Text>
        </View>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="List your major equipment and tools (e.g., Excavator, Crane, Specialized Tools)"
          placeholderTextColor={darkMode ? "#E5E7EB" : "#64748B"}
          multiline
          numberOfLines={3}
          value={campaign.equipment?.join(', ') || ''}
          onChangeText={(text) => onUpdate({ equipment: text.split(',').map(item => item.trim()).filter(item => item) })}
        />
      </View>
    </ScrollView>
  );
}

const getStyles = (darkMode: boolean, Colors: ReturnType<typeof getColors>) => ({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
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
  sectionSubtitle: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginLeft: 'auto',
    fontWeight: '500' as const,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row' as const,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  textInput: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top' as const,
  },
  inputSubtitle: {
    fontSize: 12,
    color: darkMode ? '#E5E7EB' : Colors.sub,
    marginBottom: 8,
    lineHeight: 16,
  },
  charCounter: {
    fontSize: 12,
    color: darkMode ? '#E5E7EB' : Colors.sub,
    textAlign: 'right' as const,
    marginTop: 4,
  },
  instagramInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 48, 108, 0.3)',
    overflow: 'hidden' as const,
  },
  instagramBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#E1306C',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  instagramBadgeText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  instagramInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: darkMode ? '#E2E8F0' : Colors.text,
    fontSize: 16,
  },
  optionsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    marginBottom: 8,
  },
  optionChipSelected: {
    backgroundColor: '#43cea2',
    borderColor: '#43cea2',
  },
  optionText: {
    fontSize: 14,
    color: darkMode ? '#E2E8F0' : Colors.text,
    marginRight: 4,
    fontWeight: '500' as const,
  },
  optionTextSelected: {
    color: '#000000',
    fontWeight: '600' as const,
  },
  responseTimeContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  responseTimeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    minWidth: 80,
    alignItems: 'center' as const,
  },
  responseTimeSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  responseTimeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});

