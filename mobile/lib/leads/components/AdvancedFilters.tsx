/**
 * Advanced Filtering & Search System
 * Enterprise-grade lead filtering with smart search
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Lead, LeadStage } from '../types';
import { c, radius, shadow, type } from '../ui/tokens';

export interface FilterOptions {
  search: string;
  stage: LeadStage | 'all';
  scoreRange: { min: number; max: number };
  budgetRange: { min: number; max: number };
  projectType: string | 'all';
  source: string | 'all';
  timeline: string | 'all';
  location: string;
  verified: boolean | 'all';
  dateRange: { start: Date | null; end: Date | null };
  tags: string[];
  customFields: Record<string, any>;
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onApplyFilters: () => void;
  totalResults: number;
}

const PROJECT_TYPES = ['kitchen', 'bathroom', 'addition', 'new_build', 'landscaping', 'other'];
const SOURCES = ['web', 'referral', 'import', 'manual'];
const TIMELINES = ['urgent', 'soon', 'flex'];

export default function AdvancedFilters({ 
  filters, 
  onFiltersChange, 
  onApplyFilters, 
  totalResults 
}: AdvancedFiltersProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempFilters, setTempFilters] = useState<FilterOptions>(filters);
  
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.stage !== 'all') count++;
    if (filters.scoreRange.min > 0 || filters.scoreRange.max < 100) count++;
    if (filters.budgetRange.min > 0 || filters.budgetRange.max < 1000000) count++;
    if (filters.projectType !== 'all') count++;
    if (filters.source !== 'all') count++;
    if (filters.timeline !== 'all') count++;
    if (filters.location) count++;
    if (filters.verified !== 'all') count++;
    if (filters.tags.length > 0) count++;
    return count;
  }, [filters]);
  
  const handleApplyFilters = () => {
    onFiltersChange(tempFilters);
    onApplyFilters();
    setShowModal(false);
  };
  
  const handleResetFilters = () => {
    const resetFilters: FilterOptions = {
      search: '',
      stage: 'all',
      scoreRange: { min: 0, max: 100 },
      budgetRange: { min: 0, max: 1000000 },
      projectType: 'all',
      source: 'all',
      timeline: 'all',
      location: '',
      verified: 'all',
      dateRange: { start: null, end: null },
      tags: [],
      customFields: {}
    };
    setTempFilters(resetFilters);
    onFiltersChange(resetFilters);
    onApplyFilters();
    setShowModal(false);
  };
  
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={c.sub} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads, companies, locations..."
          placeholderTextColor={c.sub}
          value={filters.search}
          onChangeText={(text) => onFiltersChange({ ...filters, search: text })}
        />
        {filters.search ? (
          <TouchableOpacity onPress={() => onFiltersChange({ ...filters, search: '' })}>
            <MaterialIcons name="clear" size={20} color={c.sub} />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {/* Quick Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.quickFilters}
        contentContainerStyle={styles.quickFiltersContent}
      >
        <FilterChip
          label="All Stages"
          active={filters.stage === 'all'}
          onPress={() => onFiltersChange({ ...filters, stage: 'all' })}
        />
        {(['new', 'verified', 'qualified', 'proposal', 'won'] as LeadStage[]).map(stage => (
          <FilterChip
            key={stage}
            label={stage.charAt(0).toUpperCase() + stage.slice(1)}
            active={filters.stage === stage}
            onPress={() => onFiltersChange({ ...filters, stage })}
          />
        ))}
        
        <FilterChip
          label="High Score (80+)"
          active={filters.scoreRange.min >= 80}
          onPress={() => onFiltersChange({ 
            ...filters, 
            scoreRange: filters.scoreRange.min >= 80 ? { min: 0, max: 100 } : { min: 80, max: 100 }
          })}
        />
        
        <FilterChip
          label="Premium ($50K+)"
          active={filters.budgetRange.min >= 50000}
          onPress={() => onFiltersChange({ 
            ...filters, 
            budgetRange: filters.budgetRange.min >= 50000 ? { min: 0, max: 1000000 } : { min: 50000, max: 1000000 }
          })}
        />
        
        <FilterChip
          label="Verified"
          active={filters.verified === true}
          onPress={() => onFiltersChange({ 
            ...filters, 
            verified: filters.verified === true ? 'all' : true
          })}
        />
        
        <TouchableOpacity
          style={[styles.advancedButton, activeFiltersCount > 0 && styles.advancedButtonActive]}
          onPress={() => setShowModal(true)}
        >
          <MaterialIcons name="tune" size={16} color={activeFiltersCount > 0 ? '#052016' : c.accent} />
          <Text style={[styles.advancedButtonText, activeFiltersCount > 0 && styles.advancedButtonTextActive]}>
            Advanced {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {totalResults.toLocaleString()} lead{totalResults !== 1 ? 's' : ''} found
        </Text>
        {activeFiltersCount > 0 && (
          <TouchableOpacity onPress={handleResetFilters}>
            <Text style={styles.clearFiltersText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Advanced Filters Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <AdvancedFiltersModal
          filters={tempFilters}
          onFiltersChange={setTempFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onClose={() => setShowModal(false)}
        />
      </Modal>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface AdvancedFiltersModalProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

function AdvancedFiltersModal({ 
  filters, 
  onFiltersChange, 
  onApply, 
  onReset, 
  onClose 
}: AdvancedFiltersModalProps) {
  return (
    <View style={styles.modalContainer}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Advanced Filters</Text>
        <TouchableOpacity onPress={onReset}>
          <Text style={styles.modalResetText}>Reset</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
        {/* Score Range */}
        <FilterSection title="AI Score Range">
          <View style={styles.rangeContainer}>
            <Text style={styles.rangeLabel}>Min: {filters.scoreRange.min}</Text>
            <Text style={styles.rangeLabel}>Max: {filters.scoreRange.max}</Text>
          </View>
        </FilterSection>
        
        {/* Budget Range */}
        <FilterSection title="Budget Range">
          <View style={styles.rangeContainer}>
            <Text style={styles.rangeLabel}>
              Min: ${(filters.budgetRange.min / 1000).toFixed(0)}K
            </Text>
            <Text style={styles.rangeLabel}>
              Max: ${(filters.budgetRange.max / 1000).toFixed(0)}K
            </Text>
          </View>
        </FilterSection>
        
        {/* Project Type */}
        <FilterSection title="Project Type">
          <View style={styles.optionsContainer}>
            {PROJECT_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionChip,
                  filters.projectType === type && styles.optionChipActive
                ]}
                onPress={() => onFiltersChange({
                  ...filters,
                  projectType: filters.projectType === type ? 'all' : type
                })}
              >
                <Text style={[
                  styles.optionChipText,
                  filters.projectType === type && styles.optionChipTextActive
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FilterSection>
        
        {/* Source */}
        <FilterSection title="Lead Source">
          <View style={styles.optionsContainer}>
            {SOURCES.map(source => (
              <TouchableOpacity
                key={source}
                style={[
                  styles.optionChip,
                  filters.source === source && styles.optionChipActive
                ]}
                onPress={() => onFiltersChange({
                  ...filters,
                  source: filters.source === source ? 'all' : source
                })}
              >
                <Text style={[
                  styles.optionChipText,
                  filters.source === source && styles.optionChipTextActive
                ]}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FilterSection>
        
        {/* Timeline */}
        <FilterSection title="Timeline">
          <View style={styles.optionsContainer}>
            {TIMELINES.map(timeline => (
              <TouchableOpacity
                key={timeline}
                style={[
                  styles.optionChip,
                  filters.timeline === timeline && styles.optionChipActive
                ]}
                onPress={() => onFiltersChange({
                  ...filters,
                  timeline: filters.timeline === timeline ? 'all' : timeline
                })}
              >
                <Text style={[
                  styles.optionChipText,
                  filters.timeline === timeline && styles.optionChipTextActive
                ]}>
                  {timeline.charAt(0).toUpperCase() + timeline.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FilterSection>
        
        {/* Location */}
        <FilterSection title="Location">
          <TextInput
            style={styles.textInput}
            placeholder="City, State, or ZIP"
            placeholderTextColor={c.sub}
            value={filters.location}
            onChangeText={(text) => onFiltersChange({ ...filters, location: text })}
          />
        </FilterSection>
        
        {/* Verification Status */}
        <FilterSection title="Verification Status">
          <View style={styles.optionsContainer}>
            {[
              { value: 'all', label: 'All' },
              { value: true, label: 'Verified' },
              { value: false, label: 'Unverified' }
            ].map(option => (
              <TouchableOpacity
                key={String(option.value)}
                style={[
                  styles.optionChip,
                  filters.verified === option.value && styles.optionChipActive
                ]}
                onPress={() => onFiltersChange({
                  ...filters,
                  verified: option.value
                })}
              >
                <Text style={[
                  styles.optionChipText,
                  filters.verified === option.value && styles.optionChipTextActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FilterSection>
      </ScrollView>
      
      {/* Footer */}
      <View style={styles.modalFooter}>
        <TouchableOpacity style={styles.applyButton} onPress={onApply}>
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: c.bg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 16,
  },
  quickFilters: {
    marginBottom: 12,
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.railTrack,
  },
  filterChipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  filterChipText: {
    color: c.sub,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#052016',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.accent,
  },
  advancedButtonActive: {
    backgroundColor: c.accent,
  },
  advancedButtonText: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  advancedButtonTextActive: {
    color: '#052016',
  },
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsText: {
    color: c.sub,
    fontSize: 14,
  },
  clearFiltersText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: c.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.railTrack,
  },
  modalCancelText: {
    color: c.sub,
    fontSize: 16,
  },
  modalTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalResetText: {
    color: c.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    color: c.sub,
    fontSize: 14,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.railTrack,
  },
  optionChipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  optionChipText: {
    color: c.sub,
    fontSize: 12,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: '#052016',
  },
  textInput: {
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: c.railTrack,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: c.railTrack,
  },
  applyButton: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#052016',
    fontSize: 16,
    fontWeight: '700',
  },
});


