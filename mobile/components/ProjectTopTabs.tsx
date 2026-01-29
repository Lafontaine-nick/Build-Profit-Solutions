import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const TABS = ['Overview', 'Budget', 'Timeline', 'Team', 'Messages'];

interface ProjectTopTabsProps {
  activeTab: string;
  onChange?: (tab: string) => void;
}

export default function ProjectTopTabs({
  activeTab,
  onChange,
}: ProjectTopTabsProps) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContainer}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onChange?.(tab)}
              activeOpacity={0.8}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: 'transparent', // transparent to show gradient
  },
  tabContainer: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tab: {
    // IMPORTANT: no flex: 1 so they won't stretch tall
    height: 42, // compact height
    paddingHorizontal: 14, // pill width
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', // subtle pill for inactive
  },
  tabActive: {
    backgroundColor: '#2ecc71', // your green highlight
  },
  tabText: {
    color: '#cfd8e3',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
});
