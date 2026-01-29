import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUserRole, UserRole } from '../contexts/UserRoleContext';

const RoleSelectionScreen: React.FC = () => {
  const { darkMode } = useTheme();
  const { setUserRole, setUserRoleData } = useUserRole();

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  const handleRoleSelect = async (role: UserRole) => {
    try {
      await setUserRole(role);

      // Set role-specific data
      const roleData = {
        role,
        userId: 'user-123',
        permissions: getPermissionsForRole(role),
        preferences: {
          notifications: true,
          emailUpdates: true,
          smsAlerts: false,
        },
      };

      await setUserRoleData(roleData);

      Alert.alert('Role Set', `You are now logged in as a ${role}`, [
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error setting role:', error);
      Alert.alert('Error', 'Failed to set user role');
    }
  };

  const getPermissionsForRole = (role: UserRole): string[] => {
    switch (role) {
      case 'contractor':
        return [
          'view_leads',
          'accept_leads',
          'reject_leads',
          'update_lead_status',
          'view_analytics',
          'manage_profile',
        ];
      case 'creator':
        return [
          'post_projects',
          'view_contractors',
          'send_messages',
          'manage_projects',
          'view_quotes',
        ];
      case 'admin':
        return [
          'view_all_leads',
          'manage_users',
          'view_analytics',
          'manage_system',
          'view_reports',
        ];
      default:
        return [];
    }
  };

  const RoleCard: React.FC<{
    role: UserRole;
    title: string;
    description: string;
    icon: string;
    color: string;
  }> = ({ role, title, description, icon, color }) => (
    <TouchableOpacity
      style={[styles.roleCard, { backgroundColor: cardColor, borderColor }]}
      onPress={() => handleRoleSelect(role)}
      activeOpacity={0.7}
    >
      <View style={styles.roleHeader}>
        <View style={[styles.roleIcon, { backgroundColor: color }]}>
          <MaterialIcons name={icon as any} size={32} color='white' />
        </View>
        <View style={styles.roleInfo}>
          <Text style={[styles.roleTitle, { color: textColor }]}>{title}</Text>
          <Text style={[styles.roleDescription, { color: textSecondaryColor }]}>
            {description}
          </Text>
        </View>
      </View>

      <View style={styles.roleFeatures}>
        {getPermissionsForRole(role)
          .slice(0, 3)
          .map((permission, index) => (
            <View key={index} style={styles.featureItem}>
              <MaterialIcons name='check' size={16} color={color} />
              <Text style={[styles.featureText, { color: textSecondaryColor }]}>
                {permission
                  .replace('_', ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </View>
          ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Select Your Role
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Choose how you'll use the app
        </Text>
      </View>

      <View style={styles.rolesContainer}>
        <RoleCard
          role='contractor'
          title='Contractor'
          description='Find and manage leads, track projects, and grow your business'
          icon='work'
          color='#4CAF50'
        />

        <RoleCard
          role='creator'
          title='Project Creator'
          description='Post projects, find contractors, and manage your renovations'
          icon='add-circle'
          color='#2196F3'
        />

        <RoleCard
          role='admin'
          title='Administrator'
          description='Manage the platform, view analytics, and oversee operations'
          icon='admin-panel-settings'
          color='#9C27B0'
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: textSecondaryColor }]}>
          You can change your role later in settings
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  rolesContainer: {
    flex: 1,
    gap: 20,
  },
  roleCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  roleFeatures: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default RoleSelectionScreen;
