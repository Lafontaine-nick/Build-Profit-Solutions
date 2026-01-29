import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ProjectFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  sortBy: string;
  sortOrder: string;
  onSortChange: (sortBy: string, order: string) => void;
  theme: any;
}

export default function ProjectFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  theme,
}: ProjectFiltersProps) {
  const statuses = ['all', 'Draft', 'Submitted', 'Won', 'Lost'];
  const sortOptions = [
    { key: 'lastUpdated', label: 'Last Updated' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'margin', label: 'Margin' },
    { key: 'budget', label: 'Budget' },
  ];

  return (
    <View style={styles.container}>
      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
      >
        {statuses.map(status => (
          <TouchableOpacity
            key={status}
            onPress={() => onFilterChange(status)}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterStatus === status ? theme.accent : theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: filterStatus === status ? '#fff' : theme.text,
                fontWeight: filterStatus === status ? 'bold' : 'normal',
              }}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <Text style={[styles.sortLabel, { color: theme.subtext }]}>
          Sort by:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {sortOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              onPress={() => {
                const newOrder =
                  sortBy === option.key && sortOrder === 'desc'
                    ? 'asc'
                    : 'desc';
                onSortChange(option.key, newOrder);
              }}
              style={[
                styles.sortOption,
                {
                  backgroundColor:
                    sortBy === option.key ? theme.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: sortBy === option.key ? '#fff' : theme.text,
                  fontSize: 12,
                  marginRight: 4,
                }}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <MaterialIcons
                  name={
                    sortOrder === 'asc'
                      ? 'keyboard-arrow-up'
                      : 'keyboard-arrow-down'
                  }
                  size={16}
                  color='#fff'
                />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  filtersRow: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 14,
    marginRight: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
});
