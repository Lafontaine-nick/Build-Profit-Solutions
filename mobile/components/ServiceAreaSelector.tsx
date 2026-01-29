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

interface ServiceAreaSelectorProps {
  serviceAreas: Array<{
    city: string;
    state: string;
    radius: number;
  }>;
  onUpdate: (serviceAreas: any[]) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
  { value: 200, label: '200+ miles' },
];

export function ServiceAreaSelector({
  serviceAreas,
  onUpdate,
}: ServiceAreaSelectorProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const neutralIconColor = darkMode ? '#FFFFFF' : '#000000';
  const styles = useMemo(() => getStyles(darkMode, Colors), [darkMode, Colors]);
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newRadius, setNewRadius] = useState(25);

  const addServiceArea = () => {
    // Validate inputs
    if (!newCity.trim()) {
      Alert.alert('Missing City', 'Please enter a city name.');
      return;
    }

    if (!newState || newState.length !== 2) {
      Alert.alert('Invalid State', 'Please enter a valid 2-letter state code (e.g., NV, CA, TX).');
      return;
    }

    const newArea = {
      city: newCity.trim(),
      state: newState.toUpperCase(),
      radius: newRadius,
    };

    // Check for duplicates
    const isDuplicate = serviceAreas.some(
      area => area.city.toLowerCase() === newArea.city.toLowerCase() && 
              area.state === newArea.state
    );

    if (isDuplicate) {
      Alert.alert('Duplicate Area', 'This city and state combination already exists.');
      return;
    }

    // Add the new area
    onUpdate([...serviceAreas, newArea]);
    
    // Clear form
    setNewCity('');
    setNewState('');
    setNewRadius(25);
    
    // Success feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Show success message
    Alert.alert(
      'Service Area Added!', 
      `${newArea.city}, ${newArea.state} (${newRadius} mile radius) has been added to your service areas.`,
      [{ text: 'Great!', style: 'default' }]
    );
  };

  const removeServiceArea = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = serviceAreas.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  const updateRadius = (index: number, radius: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = serviceAreas.map((area, i) => 
      i === index ? { ...area, radius } : area
    );
    onUpdate(updated);
  };

  // Memoize the total coverage calculation to ensure it updates when serviceAreas changes
  const totalCoverage = useMemo(() => {
    if (serviceAreas.length === 0) return 0;
    return serviceAreas.reduce((total, area) => total + (Math.PI * area.radius * area.radius), 0);
  }, [serviceAreas]);

  const renderServiceArea = (area: any, index: number) => (
    <View key={index} style={styles.areaCard}>
      <View style={styles.areaHeader}>
        <View style={styles.areaInfo}>
          <MaterialIcons name="location-on" size={20} color="#43cea2" />
          <Text style={styles.areaText}>
            {area.city}, {area.state}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeServiceArea(index)}
        >
          <MaterialIcons name="close" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.radiusSection}>
        <Text style={styles.radiusLabel}>Service Radius:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiusOptions}>
          {RADIUS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radiusChip,
                area.radius === option.value && styles.radiusChipSelected,
              ]}
              onPress={() => updateRadius(index, option.value)}
            >
              <Text
                style={[
                  styles.radiusChipText,
                  area.radius === option.value && styles.radiusChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="location-on" size={20} color={neutralIconColor} />
          <Text style={styles.title}>Service Areas</Text>
        </View>
        <Text style={styles.subtitle}>
          Define where you provide services to help customers find you
        </Text>
      </View>

      {/* Coverage Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <MaterialIcons name="location-on" size={20} color="#43cea2" />
          <Text style={styles.statLabel}>Areas Covered</Text>
          <Text style={styles.statValue}>{serviceAreas.length}</Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons name="my-location" size={20} color="#F59E0B" />
          <Text style={styles.statLabel}>Total Coverage</Text>
          <Text style={styles.statValue}>
            {Math.round(totalCoverage).toLocaleString()} sq mi
          </Text>
        </View>
      </View>

      {/* Add New Area */}
      <View style={styles.addSection}>
        <Text style={styles.addSectionTitle}>Add Service Area</Text>
        
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 2 }]}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter city name"
              placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
              value={newCity}
              onChangeText={setNewCity}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>State</Text>
            <View style={styles.stateInputContainer}>
              <TextInput
                style={styles.stateTextInput}
                placeholder="State (e.g., NV)"
                placeholderTextColor={darkMode ? "#6B7280" : "#64748B"}
                value={newState}
                onChangeText={(text) => setNewState(text.toUpperCase())}
                maxLength={2}
                autoCapitalize="characters"
              />
              <Text style={styles.stateHint}>or select below</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateSelector}>
              {US_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[
                    styles.stateChip,
                    newState === state && styles.stateChipSelected,
                  ]}
                  onPress={() => setNewState(state)}
                >
                  <Text
                    style={[
                      styles.stateChipText,
                      newState === state && styles.stateChipTextSelected,
                    ]}
                  >
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Default Service Radius</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiusSelector}>
            {RADIUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.radiusChip,
                  newRadius === option.value && styles.radiusChipSelected,
                ]}
                onPress={() => setNewRadius(option.value)}
              >
                <Text
                  style={[
                    styles.radiusChipText,
                    newRadius === option.value && styles.radiusChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[
            styles.addButton,
            (!newCity.trim() || !newState || newState.length !== 2) && styles.addButtonDisabled
          ]}
          onPress={addServiceArea}
          disabled={!newCity.trim() || !newState || newState.length !== 2}
        >
          <MaterialIcons 
            name="add" 
            size={20} 
            color={(!newCity.trim() || !newState || newState.length !== 2) ? (darkMode ? "#6B7280" : Colors.sub) : neutralIconColor} 
          />
          <Text style={[
            styles.addButtonText,
            (!newCity.trim() || !newState || newState.length !== 2) && styles.addButtonTextDisabled
          ]}>
            Add Service Area
          </Text>
        </TouchableOpacity>
      </View>

      {/* Service Areas List */}
      <View style={styles.areasSection}>
        <Text style={styles.areasTitle}>
          Your Service Areas ({serviceAreas.length})
        </Text>
        
        {serviceAreas.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="location-off" size={48} color={darkMode ? "#6B7280" : Colors.sub} />
            <Text style={styles.emptyStateText}>No service areas added yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add your service areas to help customers find you
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.areasList} showsVerticalScrollIndicator={false}>
            {serviceAreas.map(renderServiceArea)}
          </ScrollView>
        )}
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
        <Text style={styles.tipsText}>
          Pro tip: Be realistic about your service radius. Customers prefer contractors who can respond quickly.
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
  statsContainer: {
    flexDirection: 'row' as const,
    marginBottom: 20,
    gap: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  statLabel: {
    fontSize: 11,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 6,
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginTop: 4,
  },
  addSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
  },
  addSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#FFFFFF' : Colors.text,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row' as const,
    marginBottom: 16,
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
  stateInputContainer: {
    marginBottom: 8,
  },
  stateTextInput: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : Colors.surface2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : Colors.line,
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  stateHint: {
    fontSize: 10,
    color: darkMode ? '#6B7280' : Colors.sub,
    textAlign: 'center',
  },
  stateSelector: {
    marginTop: 8,
  },
  stateChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    marginRight: 6,
  },
  stateChipSelected: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderColor: '#43cea2',
  },
  stateChipText: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    fontWeight: '500' as const,
  },
  stateChipTextSelected: {
    color: '#43cea2',
  },
  radiusSelector: {
    marginTop: 8,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    marginRight: 8,
  },
  radiusChipSelected: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderColor: '#43cea2',
  },
  radiusChipText: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    fontWeight: '500' as const,
  },
  radiusChipTextSelected: {
    color: '#43cea2',
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#43cea2',
    borderRadius: 8,
    marginTop: 8,
  },
  addButtonText: {
    color: darkMode ? '#FFFFFF' : Colors.text,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  addButtonTextDisabled: {
    color: darkMode ? '#6B7280' : Colors.sub,
  },
  areasSection: {
    flex: 1,
  },
  areasTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#E2E8F0' : Colors.text,
    marginBottom: 12,
  },
  areasList: {
    flex: 1,
  },
  areaCard: {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(67, 206, 162, 0.2)' : Colors.line,
  },
  areaHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  areaInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  areaText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: darkMode ? '#E2E8F0' : Colors.text,
    marginLeft: 8,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radiusSection: {
    marginTop: 8,
  },
  radiusLabel: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginBottom: 8,
  },
  radiusOptions: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.1)',
    borderStyle: 'dashed' as const,
  },
  emptyStateText: {
    fontSize: 14,
    color: darkMode ? '#9CA3AF' : Colors.sub,
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: darkMode ? '#6B7280' : Colors.sub,
    marginTop: 4,
    textAlign: 'center' as const,
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
