/**
 * Search Suggestions Component
 * Provides autocomplete and search suggestions for the leads page
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Lead } from '../types';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';

interface SearchSuggestionsProps {
  leads: Lead[];
  onSearch: (query: string) => void;
  onSelectSuggestion: (suggestion: string) => void;
  placeholder?: string;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'contact' | 'company' | 'location' | 'trade' | 'project';
  count: number;
}

export default function SearchSuggestions({
  leads,
  onSearch,
  onSelectSuggestion,
  placeholder = "Search leads...",
}: SearchSuggestionsProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Generate search suggestions from leads data
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];

    const suggestionsMap = new Map<string, SearchSuggestion>();

    leads.forEach(lead => {
      // Contact names
      if (lead.contact.name?.toLowerCase().includes(query.toLowerCase())) {
        const key = lead.contact.name.toLowerCase();
        if (!suggestionsMap.has(key)) {
          suggestionsMap.set(key, {
            id: `contact-${key}`,
            text: lead.contact.name,
            type: 'contact',
            count: 0,
          });
        }
        suggestionsMap.get(key)!.count++;
      }

      // Companies
      if (lead.contact.company?.toLowerCase().includes(query.toLowerCase())) {
        const key = lead.contact.company.toLowerCase();
        if (!suggestionsMap.has(key)) {
          suggestionsMap.set(key, {
            id: `company-${key}`,
            text: lead.contact.company,
            type: 'company',
            count: 0,
          });
        }
        suggestionsMap.get(key)!.count++;
      }

      // Locations
      if (lead.location.city?.toLowerCase().includes(query.toLowerCase())) {
        const key = lead.location.city.toLowerCase();
        if (!suggestionsMap.has(key)) {
          suggestionsMap.set(key, {
            id: `location-${key}`,
            text: lead.location.city,
            type: 'location',
            count: 0,
          });
        }
        suggestionsMap.get(key)!.count++;
      }

      // Trades
      if (lead.trade?.toLowerCase().includes(query.toLowerCase())) {
        const key = lead.trade.toLowerCase();
        if (!suggestionsMap.has(key)) {
          suggestionsMap.set(key, {
            id: `trade-${key}`,
            text: lead.trade,
            type: 'trade',
            count: 0,
          });
        }
        suggestionsMap.get(key)!.count++;
      }

      // Project types
      if (lead.project.type?.toLowerCase().includes(query.toLowerCase())) {
        const key = lead.project.type.toLowerCase();
        if (!suggestionsMap.has(key)) {
          suggestionsMap.set(key, {
            id: `project-${key}`,
            text: lead.project.type,
            type: 'project',
            count: 0,
          });
        }
        suggestionsMap.get(key)!.count++;
      }
    });

    // Convert to array and sort by count (most relevant first)
    return Array.from(suggestionsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Limit to 8 suggestions
  }, [leads, query]);

  // Animate suggestions appearance
  useEffect(() => {
    if (showSuggestions) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showSuggestions, fadeAnim]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    onSearch(text);
    setShowSuggestions(text.length >= 2);
  };

  const handleSuggestionPress = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSelectSuggestion(suggestion.text);
  };

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'contact':
        return 'person';
      case 'company':
        return 'business';
      case 'location':
        return 'location-on';
      case 'trade':
        return 'build';
      case 'project':
        return 'home';
      default:
        return 'search';
    }
  };

  const getSuggestionColor = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'contact':
        return '#43cea2';
      case 'company':
        return '#667eea';
      case 'location':
        return '#f093fb';
      case 'trade':
        return '#ffecd2';
      case 'project':
        return '#a8edea';
      default:
        return '#999';
    }
  };

  const renderSuggestion = ({ item }: { item: SearchSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
    >
      <View style={styles.suggestionContent}>
        <MaterialIcons
          name={getSuggestionIcon(item.type)}
          size={20}
          color={getSuggestionColor(item.type)}
        />
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionTitle}>{item.text}</Text>
          <Text style={styles.suggestionSubtitle}>
            {item.type} • {item.count} lead{item.count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#FFFFFF" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          onFocus={() => setShowSuggestions(query.length >= 2)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              onSearch('');
              setShowSuggestions(false);
            }}
          >
            <MaterialIcons name="clear" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <Animated.View
          style={[
            styles.suggestionsContainer,
            { opacity: fadeAnim }
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={renderSuggestion}
            style={styles.suggestionsList}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: 300,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  suggestionSubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
});


