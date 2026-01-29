import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUserRole } from '../contexts/UserRoleContext';

interface TabItem {
  id: string;
  title: string;
  icon: string;
  role: 'contractor' | 'creator' | 'admin' | 'all';
}

interface RoleBasedTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const RoleBasedTabs: React.FC<RoleBasedTabsProps> = ({
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

  // Define all possible tabs
  const allTabs: TabItem[] = [
    // Contractor tabs for leads page
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'dashboard',
      role: 'contractor',
    },
    { id: 'capture', title: 'Capture', icon: 'add-circle', role: 'contractor' },
    { id: 'approval', title: 'Approval', icon: 'approval', role: 'contractor' },
    { id: 'crm', title: 'CRM', icon: 'business', role: 'contractor' },
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
    {
      id: 'modern',
      title: 'Modern',
      icon: 'auto-awesome',
      role: 'contractor',
    },
    { id: 'table', title: 'Table', icon: 'table-chart', role: 'contractor' },
    { id: 'ai', title: 'AI', icon: 'smart-toy', role: 'contractor' },
    { id: 'intake', title: 'Intake', icon: 'input', role: 'contractor' },
    { id: 'status-crm', title: 'Status', icon: 'timeline', role: 'contractor' },
    {
      id: 'perfect-fit',
      title: 'Perfect Fit',
      icon: 'star',
      role: 'contractor',
    },

    // Creator tabs
    {
      id: 'post-project',
      title: 'Post Project',
      icon: 'add-circle',
      role: 'creator',
    },
    {
      id: 'my-projects',
      title: 'My Projects',
      icon: 'folder',
      role: 'creator',
    },
    {
      id: 'contractors',
      title: 'Contractors',
      icon: 'people',
      role: 'creator',
    },
    { id: 'messages', title: 'Messages', icon: 'message', role: 'creator' },
    { id: 'profile', title: 'Profile', icon: 'person', role: 'creator' },

    // Admin tabs
    {
      id: 'admin-dashboard',
      title: 'Admin',
      icon: 'admin-panel-settings',
      role: 'admin',
    },
    { id: 'users', title: 'Users', icon: 'people', role: 'admin' },
    { id: 'analytics', title: 'Analytics', icon: 'analytics', role: 'admin' },
    { id: 'settings', title: 'Settings', icon: 'settings', role: 'admin' },

    // Common tabs
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications',
      role: 'all',
    },
    { id: 'help', title: 'Help', icon: 'help', role: 'all' },
  ];

  // Filter tabs based on user role
  const getVisibleTabs = (): TabItem[] => {
    if (isContractor) {
      return allTabs.filter(
        tab => tab.role === 'contractor' || tab.role === 'all'
      );
    } else if (isCreator) {
      return allTabs.filter(
        tab => tab.role === 'creator' || tab.role === 'all'
      );
    } else if (isAdmin) {
      return allTabs.filter(tab => tab.role === 'admin' || tab.role === 'all');
    }
    return [];
  };

  const visibleTabs = getVisibleTabs();

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

  const renderTab = (tab: TabItem) => (
    <TouchableOpacity
      key={tab.id}
      style={[
        styles.tabItem,
        { backgroundColor: getTabBackgroundColor(tab.id) },
      ]}
      onPress={() => onTabChange(tab.id)}
    >
      <MaterialIcons
        name={tab.icon as any}
        size={18}
        color={getTabColor(tab.id)}
      />
      <Text style={[styles.tabText, { color: getTabColor(tab.id) }]}>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        style={styles.tabsScrollView}
      >
        {visibleTabs.map(renderTab)}
      </ScrollView>

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
  tabsScrollView: {
    flexGrow: 0,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
    minWidth: 80,
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
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

export default RoleBasedTabs;
