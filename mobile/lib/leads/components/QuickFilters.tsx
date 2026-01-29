/**
 * Quick Filters Component
 * Provides saved filter presets for common lead filtering scenarios
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export interface FilterPreset {
  id: string;
  name: string;
  icon: string;
  color: string;
  filters: {
    source?: string;
    budget?: 'low' | 'medium' | 'high';
    timeline?: 'Urgent' | 'Soon' | 'Normal';
    trade?: string;
    stage?: string;
  };
}

interface QuickFiltersProps {
  onApplyPreset: (preset: FilterPreset) => void;
  onSavePreset: (preset: Omit<FilterPreset, 'id'>) => void;
  currentFilters: {
    source: string;
    budget: string;
    timeline: string;
    trade: string;
    stage: string;
  };
}

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'hot-leads',
    name: 'Hot Leads',
    icon: 'local-fire-department',
    color: '#FF6B6B',
    filters: {
      timeline: 'Urgent',
      budget: 'high',
    },
  },
  {
    id: 'new-leads',
    name: 'New Leads',
    icon: 'fiber-new',
    color: '#4ECDC4',
    filters: {
      stage: 'new',
    },
  },
  {
    id: 'high-value',
    name: 'High Value',
    icon: 'attach-money',
    color: '#45B7D1',
    filters: {
      budget: 'high',
    },
  },
  {
    id: 'urgent-timeline',
    name: 'Urgent Timeline',
    icon: 'schedule',
    color: '#FFA07A',
    filters: {
      timeline: 'Urgent',
    },
  },
  {
    id: 'qualified-leads',
    name: 'Qualified',
    icon: 'verified',
    color: '#98D8C8',
    filters: {
      stage: 'qualified',
    },
  },
  {
    id: 'proposal-stage',
    name: 'Proposals',
    icon: 'description',
    color: '#F7DC6F',
    filters: {
      stage: 'proposal',
    },
  },
];

export default function QuickFilters({
  onApplyPreset,
  onSavePreset,
  currentFilters,
}: QuickFiltersProps) {
  const [presets, setPresets] = useState<FilterPreset[]>(DEFAULT_PRESETS);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    loadCustomPresets();
  }, []);

  const loadCustomPresets = async () => {
    try {
      const savedPresets = await AsyncStorage.getItem('leadFilterPresets');
      if (savedPresets) {
        const customPresets = JSON.parse(savedPresets);
        setPresets([...DEFAULT_PRESETS, ...customPresets]);
      }
    } catch (error) {
      console.error('Error loading custom presets:', error);
    }
  };

  const saveCustomPreset = async (preset: Omit<FilterPreset, 'id'>) => {
    try {
      const newPreset: FilterPreset = {
        ...preset,
        id: `custom-${Date.now()}`,
      };

      const savedPresets = await AsyncStorage.getItem('leadFilterPresets');
      const customPresets = savedPresets ? JSON.parse(savedPresets) : [];
      customPresets.push(newPreset);

      await AsyncStorage.setItem('leadFilterPresets', JSON.stringify(customPresets));
      setPresets([...DEFAULT_PRESETS, ...customPresets]);
      setShowSaveModal(false);
      setNewPresetName('');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving preset:', error);
      Alert.alert('Error', 'Failed to save filter preset');
    }
  };

  const deleteCustomPreset = async (presetId: string) => {
    try {
      const savedPresets = await AsyncStorage.getItem('leadFilterPresets');
      if (savedPresets) {
        const customPresets = JSON.parse(savedPresets);
        const updatedPresets = customPresets.filter((p: FilterPreset) => p.id !== presetId);
        await AsyncStorage.setItem('leadFilterPresets', JSON.stringify(updatedPresets));
        setPresets([...DEFAULT_PRESETS, ...updatedPresets]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting preset:', error);
    }
  };

  const handlePresetPress = (preset: FilterPreset) => {
    onApplyPreset(preset);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveCurrentFilters = () => {
    if (!newPresetName.trim()) {
      Alert.alert('Error', 'Please enter a name for the filter preset');
      return;
    }

    const preset: Omit<FilterPreset, 'id'> = {
      name: newPresetName.trim(),
      icon: 'bookmark',
      color: '#9B59B6',
      filters: {
        source: currentFilters.source !== 'all' ? currentFilters.source : undefined,
        budget: currentFilters.budget !== 'all' ? currentFilters.budget as any : undefined,
        timeline: currentFilters.timeline !== 'all' ? currentFilters.timeline as any : undefined,
        trade: currentFilters.trade !== 'all' ? currentFilters.trade : undefined,
        stage: currentFilters.stage !== 'all' ? currentFilters.stage : undefined,
      },
    };

    saveCustomPreset(preset);
  };

  const getFilterDescription = (preset: FilterPreset) => {
    const descriptions: string[] = [];
    
    if (preset.filters.source) descriptions.push(`Source: ${preset.filters.source}`);
    if (preset.filters.budget) descriptions.push(`Budget: ${preset.filters.budget}`);
    if (preset.filters.timeline) descriptions.push(`Timeline: ${preset.filters.timeline}`);
    if (preset.filters.trade) descriptions.push(`Trade: ${preset.filters.trade}`);
    if (preset.filters.stage) descriptions.push(`Stage: ${preset.filters.stage}`);

    return descriptions.length > 0 ? descriptions.join(' • ') : 'All leads';
  };

  const renderPreset = (preset: FilterPreset) => (
    <TouchableOpacity
      key={preset.id}
      style={[styles.presetButton, { borderLeftColor: preset.color }]}
      onPress={() => handlePresetPress(preset)}
      onLongPress={() => {
        if (preset.id.startsWith('custom-')) {
          Alert.alert(
            'Delete Preset',
            `Are you sure you want to delete "${preset.name}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteCustomPreset(preset.id) },
            ]
          );
        }
      }}
    >
      <View style={styles.presetContent}>
        <MaterialIcons name={preset.icon as any} size={20} color={preset.color} />
        <View style={styles.presetText}>
          <Text style={styles.presetName}>{preset.name}</Text>
          <Text style={styles.presetDescription}>{getFilterDescription(preset)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {presets.map(renderPreset)}
        
        <TouchableOpacity
          style={styles.addPresetButton}
          onPress={() => setShowSaveModal(true)}
        >
          <MaterialIcons name="add" size={20} color="#43cea2" />
          <Text style={styles.addPresetText}>Save Current</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Filter Preset</Text>
            <Text style={styles.modalSubtitle}>
              Save your current filter settings as a quick preset
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Preset Name</Text>
              <View style={styles.textInputContainer}>
                <MaterialIcons name="bookmark" size={20} color="#43cea2" />
                <TextInput
                  style={styles.textInput}
                  value={newPresetName}
                  onChangeText={setNewPresetName}
                  placeholder="Enter preset name..."
                  placeholderTextColor="#666"
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveCurrentFilters}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  presetButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    borderLeftWidth: 3,
    minWidth: 140,
  },
  presetContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetText: {
    marginLeft: 8,
    flex: 1,
  },
  presetName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  presetDescription: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  addPresetButton: {
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  addPresetText: {
    color: '#43cea2',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 300,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#43cea2',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
