import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

interface PricingCalculatorProps {
  pricing: {
    hourlyRate: { min: number; max: number };
    projectMinimum: number;
    specialties: { [key: string]: { min: number; max: number } };
  };
  onUpdate: (pricing: any) => void;
}

const SPECIALTY_PRICING_TEMPLATES = {
  'Plumbing': { min: 75, max: 150 },
  'Electrical': { min: 85, max: 175 },
  'HVAC': { min: 90, max: 200 },
  'Framing': { min: 65, max: 120 },
  'Roofing': { min: 80, max: 160 },
  'Flooring': { min: 70, max: 140 },
  'Painting': { min: 45, max: 85 },
  'Drywall': { min: 50, max: 100 },
  'Concrete': { min: 60, max: 130 },
  'Landscaping': { min: 40, max: 90 },
  'Kitchen Remodel': { min: 100, max: 250 },
  'Bathroom Remodel': { min: 80, max: 200 },
  'General Contracting': { min: 70, max: 150 },
  'Carpentry': { min: 55, max: 120 },
  'Tile Work': { min: 60, max: 130 },
  'Stucco': { min: 50, max: 110 },
  'Insulation': { min: 40, max: 80 },
  'Windows & Doors': { min: 60, max: 140 },
  'Siding': { min: 55, max: 125 },
  'Deck Building': { min: 65, max: 135 },
};

export function PricingCalculator({
  pricing,
  onUpdate,
}: PricingCalculatorProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const neutralIconColor = darkMode ? '#FFFFFF' : '#000000';
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  // Local state for text inputs to preserve decimal points while typing
  const [hourlyRateText, setHourlyRateText] = useState(pricing.hourlyRate.max.toString());
  const [sqFtRateText, setSqFtRateText] = useState(pricing.hourlyRate.min.toString());
  const [projectMinText, setProjectMinText] = useState(pricing.projectMinimum.toString());
  
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newSpecialtyMin, setNewSpecialtyMin] = useState('');
  const [newSpecialtyMax, setNewSpecialtyMax] = useState('');

  const addSpecialtyPricing = () => {
    if (!newSpecialty.trim() || !newSpecialtyMin || !newSpecialtyMax) {
      Alert.alert('Missing Information', 'Please fill in all specialty pricing fields.');
      return;
    }

    const min = parseFloat(newSpecialtyMin);
    const max = parseFloat(newSpecialtyMax);

    if (min >= max) {
      Alert.alert('Invalid Range', 'Minimum rate must be less than maximum rate.');
      return;
    }

    const updatedSpecialties = {
      ...pricing.specialties,
      [newSpecialty.trim()]: { min, max },
    };

    onUpdate({
      ...pricing,
      specialties: updatedSpecialties,
    });

    setNewSpecialty('');
    setNewSpecialtyMin('');
    setNewSpecialtyMax('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeSpecialtyPricing = (specialty: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedSpecialties = { ...pricing.specialties };
    delete updatedSpecialties[specialty];
    onUpdate({
      ...pricing,
      specialties: updatedSpecialties,
    });
  };

  const updateSpecialtyPricing = (specialty: string, field: 'min' | 'max', value: number) => {
    const updatedSpecialties = {
      ...pricing.specialties,
      [specialty]: {
        ...pricing.specialties[specialty],
        [field]: value,
      },
    };
    onUpdate({
      ...pricing,
      specialties: updatedSpecialties,
    });
  };

  const applyTemplate = (specialty: string) => {
    const template = SPECIALTY_PRICING_TEMPLATES[specialty as keyof typeof SPECIALTY_PRICING_TEMPLATES];
    if (template) {
      setNewSpecialty(specialty);
      setNewSpecialtyMin(template.min.toString());
      setNewSpecialtyMax(template.max.toString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };


  const renderSpecialtyPricing = (specialty: string, rates: { min: number; max: number }) => (
    <View key={specialty} style={styles.specialtyCard}>
      <View style={styles.specialtyHeader}>
        <Text style={styles.specialtyName}>{specialty}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeSpecialtyPricing(specialty)}
        >
          <MaterialIcons name="close" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.rateInputs}>
        <View style={styles.rateInput}>
          <Text style={styles.rateLabel}>Min Rate</Text>
          <TextInput
            style={styles.rateTextInput}
            placeholder="0"
            placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
            keyboardType="numeric"
            value={rates.min.toString()}
            onChangeText={(text) => updateSpecialtyPricing(specialty, 'min', parseFloat(text) || 0)}
          />
        </View>
        <View style={styles.rateInput}>
          <Text style={styles.rateLabel}>Max Rate</Text>
          <TextInput
            style={styles.rateTextInput}
            placeholder="0"
            placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
            keyboardType="numeric"
            value={rates.max.toString()}
            onChangeText={(text) => updateSpecialtyPricing(specialty, 'max', parseFloat(text) || 0)}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="attach-money" size={20} color={neutralIconColor} />
          <Text style={styles.title}>Pricing & Rates</Text>
        </View>
        <Text style={styles.subtitle}>
          Set your rates to help customers understand your pricing
        </Text>
      </View>

      {/* Labor Rate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Labor Rate</Text>
        <Text style={styles.sectionSubtitle}>
          Set your pricing structure for labor
        </Text>
        
        {/* Hourly Rate */}
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.rateTypeLabel}>Hourly Rate</Text>
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '700', marginRight: 8 }}>$</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="0"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                keyboardType="decimal-pad"
                value={hourlyRateText}
                onChangeText={(text) => {
                  // Allow any valid decimal number pattern
                  if (text === '' || /^\d*\.?\d*$/.test(text)) {
                    setHourlyRateText(text);
                    onUpdate({
                      ...pricing,
                      hourlyRate: { ...pricing.hourlyRate, max: text === '' ? 0 : Number(text) || 0 }
                    });
                  }
                }}
              />
            <Text style={{ color: darkMode ? '#a7bed9' : Colors.sub, fontSize: 16, marginLeft: 8 }}>/hour</Text>
            </View>
          </View>
        </View>

        {/* Price per Sq Ft */}
        <View>
          <Text style={styles.rateTypeLabel}>Price per Sq Ft</Text>
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '700', marginRight: 8 }}>$</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="0"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                keyboardType="decimal-pad"
                value={sqFtRateText}
                onChangeText={(text) => {
                  // Allow any valid decimal number pattern
                  if (text === '' || /^\d*\.?\d*$/.test(text)) {
                    setSqFtRateText(text);
                    onUpdate({
                      ...pricing,
                      hourlyRate: { ...pricing.hourlyRate, min: text === '' ? 0 : Number(text) || 0 }
                    });
                  }
                }}
              />
            <Text style={{ color: darkMode ? '#a7bed9' : Colors.sub, fontSize: 16, marginLeft: 8 }}>/sq ft</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Project Minimum */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Minimum</Text>
        <Text style={styles.sectionSubtitle}>
          Minimum project value you'll accept
        </Text>
        
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.textInput}
            placeholder="0"
            placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
            keyboardType="decimal-pad"
            value={projectMinText}
            onChangeText={(text) => {
              // Allow any valid decimal number pattern
              if (text === '' || /^\d*\.?\d*$/.test(text)) {
                setProjectMinText(text);
                onUpdate({
                  ...pricing,
                  projectMinimum: text === '' ? 0 : Number(text) || 0
                });
              }
            }}
          />
        </View>
      </View>

      {/* Specialty Pricing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specialty Pricing</Text>
        <Text style={styles.sectionSubtitle}>
          Set different rates for specialized work
        </Text>

        {/* Add New Specialty */}
        <View style={styles.addSpecialtySection}>
          <View style={styles.specialtyInputs}>
            <View style={styles.specialtyNameInput}>
              <Text style={styles.inputLabel}>Specialty</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Kitchen Remodel"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                value={newSpecialty}
                onChangeText={setNewSpecialty}
              />
            </View>
            <View style={styles.rateInputs}>
              <View style={styles.rateInput}>
                <Text style={styles.rateLabel}>Min</Text>
                <TextInput
                  style={styles.rateTextInput}
                  placeholder="0"
                  placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                  keyboardType="decimal-pad"
                  value={newSpecialtyMin}
                  onChangeText={(text) => {
                    if (text === '' || /^\d*\.?\d*$/.test(text)) {
                      setNewSpecialtyMin(text);
                    }
                  }}
                />
              </View>
              <View style={styles.rateInput}>
                <Text style={styles.rateLabel}>Max</Text>
                <TextInput
                  style={styles.rateTextInput}
                  placeholder="0"
                  placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                  keyboardType="decimal-pad"
                  value={newSpecialtyMax}
                  onChangeText={(text) => {
                    if (text === '' || /^\d*\.?\d*$/.test(text)) {
                      setNewSpecialtyMax(text);
                    }
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Templates */}
        <View style={styles.templatesSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialIcons name="flash-on" size={16} color="#F59E0B" />
            <Text style={styles.templatesTitle}>Quick Templates</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesList}>
            {Object.keys(SPECIALTY_PRICING_TEMPLATES).map((specialty) => {
              const template = SPECIALTY_PRICING_TEMPLATES[specialty as keyof typeof SPECIALTY_PRICING_TEMPLATES];
              return (
                <TouchableOpacity
                  key={specialty}
                  style={styles.templateChip}
                  onPress={() => applyTemplate(specialty)}
                >
                  <Text style={styles.templateChipText}>{specialty}</Text>
                  <Text style={styles.templateChipRate}>${template.min}-${template.max}/hr</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Existing Specialties */}
        {Object.keys(pricing.specialties).length > 0 && (
          <View style={styles.specialtiesList}>
            {Object.entries(pricing.specialties).map(([specialty, rates]) =>
              renderSpecialtyPricing(specialty, rates)
            )}
          </View>
        )}
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
        <Text style={styles.tipsText}>
          Pro tip: Research local market rates and consider your experience level when setting prices. 
          Competitive pricing helps you win more jobs.
        </Text>
      </View>
    </View>
  );
}

const getStyles = (darkMode: boolean, Colors: ReturnType<typeof getColors>) => ({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
  },
  revenueCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  revenueHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  revenueTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
    marginLeft: 8,
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#10B981',
    marginBottom: 4,
  },
  revenueSubtext: {
    fontSize: 12,
    color: darkMode ? '#6B7280' : Colors.sub,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 16,
  },
  rateTypeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 8,
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
  rateInputs: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  rateInput: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 4,
  },
  rateTextInput: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 14,
    textAlign: 'center' as const,
  },
  addSpecialtySection: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  specialtyInputs: {
    marginBottom: 12,
  },
  specialtyNameInput: {
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#43cea2',
    borderRadius: 6,
  },
  addButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  templatesSection: {
    marginBottom: 16,
  },
  templatesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginLeft: 4,
  },
  templatesList: {
    marginTop: 8,
  },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(67, 206, 162, 0.4)',
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    marginRight: 10,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  templateChipText: {
    fontSize: 13,
    color: '#43cea2',
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  templateChipRate: {
    fontSize: 11,
    color: darkMode ? '#a7bed9' : Colors.sub,
    fontWeight: '500' as const,
  },
  specialtiesList: {
    marginTop: 8,
  },
  specialtyCard: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  specialtyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  specialtyName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tipsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginTop: 16,
  },
  tipsText: {
    flex: 1,
    fontSize: 12,
    color: '#FCD34D',
    marginLeft: 8,
    lineHeight: 16,
  },
});

