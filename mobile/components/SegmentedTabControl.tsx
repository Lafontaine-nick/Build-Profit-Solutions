import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUserRole } from '../contexts/UserRoleContext';

interface TabItem {
  id: string;
  title: string;
  icon: string;
  role: 'contractor' | 'creator' | 'admin' | 'all';
}

interface SegmentedTabControlProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SegmentedTabControl: React.FC<SegmentedTabControlProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { darkMode } = useTheme();
  const { userRole, isContractor, isCreator, isAdmin } = useUserRole();

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const accentColor = '#1B365D';

  // Define primary tabs (most important ones)
  const primaryTabs: TabItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'dashboard',
      role: 'contractor',
    },
    { id: 'capture', title: 'Capture', icon: 'add-circle', role: 'contractor' },
    { id: 'approval', title: 'Approval', icon: 'approval', role: 'contractor' },
    { id: 'crm', title: 'CRM', icon: 'business', role: 'contractor' },
    { id: 'ai', title: 'AI', icon: 'smart-toy', role: 'contractor' },
  ];

  // Define secondary tabs (less frequently used)
  const secondaryTabs: TabItem[] = [
    {
      id: 'nurturing',
      title: 'Nurturing',
      icon: 'psychology',
      role: 'contractor',
    },
    {
      id: 'verification',
      title: 'Verification',
      icon: 'verified',
      role: 'contractor',
    },
    { id: 'preview', title: 'Preview', icon: 'preview', role: 'contractor' },
    {
      id: 'preferences',
      title: 'Preferences',
      icon: 'settings',
      role: 'contractor',
    },
    { id: 'table', title: 'Table', icon: 'table-chart', role: 'contractor' },
    { id: 'intake', title: 'Intake', icon: 'input', role: 'contractor' },
    { id: 'status-crm', title: 'Status', icon: 'timeline', role: 'contractor' },
  ];

  // Filter tabs based on user role
  const getVisiblePrimaryTabs = (): TabItem[] => {
    if (isContractor) {
      return primaryTabs.filter(
        tab => tab.role === 'contractor' || tab.role === 'all'
      );
    } else if (isCreator) {
      return primaryTabs.filter(
        tab => tab.role === 'creator' || tab.role === 'all'
      );
    } else if (isAdmin) {
      return primaryTabs.filter(
        tab => tab.role === 'admin' || tab.role === 'all'
      );
    }
    return [];
  };

  const getVisibleSecondaryTabs = (): TabItem[] => {
    if (isContractor) {
      return secondaryTabs.filter(
        tab => tab.role === 'contractor' || tab.role === 'all'
      );
    } else if (isCreator) {
      return secondaryTabs.filter(
        tab => tab.role === 'creator' || tab.role === 'all'
      );
    } else if (isAdmin) {
      return secondaryTabs.filter(
        tab => tab.role === 'admin' || tab.role === 'all'
      );
    }
    return [];
  };

  const visiblePrimaryTabs = getVisiblePrimaryTabs();
  const visibleSecondaryTabs = getVisibleSecondaryTabs();

  const getTabColor = (tabId: string) => {
    if (activeTab === tabId) {
      return '#fff';
    }
    return textSecondaryColor;
  };

  const getTabBackgroundColor = (tabId: string) => {
    if (activeTab === tabId) {
      return accentColor;
    }
    return 'transparent';
  };

  const renderPrimaryTab = (tab: TabItem) => (
    <TouchableOpacity
      key={tab.id}
      style={[
        styles.primaryTabItem,
        { backgroundColor: getTabBackgroundColor(tab.id) },
      ]}
      onPress={() => onTabChange(tab.id)}
    >
      <MaterialIcons
        name={tab.icon as any}
        size={16}
        color={getTabColor(tab.id)}
      />
      <Text style={[styles.primaryTabText, { color: getTabColor(tab.id) }]}>
        {tab.title}
      </Text>
    </TouchableOpacity>
  );

  const renderSecondaryTab = (tab: TabItem) => (
    <TouchableOpacity
      key={tab.id}
      style={[
        styles.secondaryTabItem,
        { backgroundColor: getTabBackgroundColor(tab.id) },
      ]}
      onPress={() => onTabChange(tab.id)}
    >
      <MaterialIcons
        name={tab.icon as any}
        size={14}
        color={getTabColor(tab.id)}
      />
      <Text style={[styles.secondaryTabText, { color: getTabColor(tab.id) }]}>
        {tab.title}
      </Text>
    </TouchableOpacity>
  );

  if (!userRole) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textColor }]}>
          Loading user role...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Primary Tabs - Segmented Control Style */}
      <View style={styles.primaryTabsContainer}>
        {visiblePrimaryTabs.map(renderPrimaryTab)}
      </View>

      {/* Secondary Tabs - Compact Row */}
      {visibleSecondaryTabs.length > 0 && (
        <View style={styles.secondaryTabsContainer}>
          {visibleSecondaryTabs.map(renderSecondaryTab)}
        </View>
      )}

      <View style={styles.roleIndicator}>
        <Text style={[styles.roleText, { color: textSecondaryColor }]}>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Mode
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  primaryTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 2,
  },
  primaryTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  primaryTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryTabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 4,
  },
  secondaryTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
  },
  secondaryTabText: {
    fontSize: 10,
    fontWeight: '500',
  },
  roleIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
  },
});

export default SegmentedTabControl;
