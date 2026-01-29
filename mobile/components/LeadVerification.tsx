import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const LeadVerification: React.FC = () => {
  const { darkMode } = useTheme();
  const [verificationMode, setVerificationMode] = useState<
    'auto' | 'manual' | 'bulk'
  >('auto');

  const backgroundColor = 'transparent';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';

  const renderVerificationOverview = () => (
    <View
      style={[styles.overviewCard, { backgroundColor: cardColor, borderColor }]}
    >
      <View style={styles.overviewHeader}>
        <MaterialIcons name='verified' size={24} color='#4CAF50' />
        <Text style={[styles.overviewTitle, { color: textColor }]}>
          Verification Status
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.statusBadgeText}>LIVE</Text>
        </View>
      </View>
      <View style={styles.overviewStats}>
        <View style={styles.overviewStat}>
          <Text style={[styles.overviewStatValue, { color: '#4CAF50' }]}>
            2,847
          </Text>
          <Text
            style={[styles.overviewStatLabel, { color: textSecondaryColor }]}
          >
            Total Leads
          </Text>
        </View>
        <View style={styles.overviewStat}>
          <Text style={[styles.overviewStatValue, { color: '#2196F3' }]}>
            2,156
          </Text>
          <Text
            style={[styles.overviewStatLabel, { color: textSecondaryColor }]}
          >
            Verified
          </Text>
        </View>
        <View style={styles.overviewStat}>
          <Text style={[styles.overviewStatValue, { color: '#FF9800' }]}>
            691
          </Text>
          <Text
            style={[styles.overviewStatLabel, { color: textSecondaryColor }]}
          >
            Pending
          </Text>
        </View>
      </View>
    </View>
  );

  const renderVerificationTools = () => (
    <View style={styles.toolsSection}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Verification Tools
      </Text>

      {/* Auto Verification */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'Auto Verification',
            'What would you like to verify automatically?',
            [
              {
                text: 'Email Validation',
                onPress: () => {
                  Alert.alert(
                    'Email Validation',
                    'Running email validation on all leads...'
                  );
                  // TODO: Run email validation
                },
              },
              {
                text: 'Phone Verification',
                onPress: () => {
                  Alert.alert(
                    'Phone Verification',
                    'Running phone verification on all leads...'
                  );
                  // TODO: Run phone verification
                },
              },
              {
                text: 'Address Validation',
                onPress: () => {
                  Alert.alert(
                    'Address Validation',
                    'Running address validation on all leads...'
                  );
                  // TODO: Run address validation
                },
              },
              {
                text: 'Company Verification',
                onPress: () => {
                  Alert.alert(
                    'Company Verification',
                    'Running company verification on all leads...'
                  );
                  // TODO: Run company verification
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              Auto Verification
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Automated Checks
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.toolStatusText}>ACTIVE</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          Automatically verify email addresses, phone numbers, and company
          information
        </Text>
        <View style={styles.toolStats}>
          <View style={styles.toolStatItem}>
            <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
            <Text style={[styles.toolStatText, { color: '#4CAF50' }]}>
              2,156 verified
            </Text>
          </View>
          <View style={styles.toolStatItem}>
            <MaterialIcons
              name='schedule'
              size={16}
              color={textSecondaryColor}
            />
            <Text style={[styles.toolStatText, { color: textSecondaryColor }]}>
              Last run: 2h ago
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Manual Verification */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'Manual Verification',
            'What would you like to verify manually?',
            [
              {
                text: 'Review Pending',
                onPress: () => {
                  Alert.alert(
                    'Review Pending',
                    'Opening pending verification queue...'
                  );
                  // TODO: Open pending verification screen
                },
              },
              {
                text: 'Verify Specific Lead',
                onPress: () => {
                  Alert.alert(
                    'Verify Lead',
                    'Opening lead verification form...'
                  );
                  // TODO: Open verification form
                },
              },
              {
                text: 'Bulk Verification',
                onPress: () => {
                  Alert.alert(
                    'Bulk Verification',
                    'Opening bulk verification tool...'
                  );
                  // TODO: Open bulk verification
                },
              },
              {
                text: 'Override Results',
                onPress: () => {
                  Alert.alert(
                    'Override',
                    'Opening verification override panel...'
                  );
                  // TODO: Open override panel
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              Manual Verification
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Human Review
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#FF9800' }]}>
            <Text style={styles.toolStatusText}>PENDING</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          Manually review and verify leads that require human intervention
        </Text>
        <View style={styles.toolStats}>
          <View style={styles.toolStatItem}>
            <MaterialIcons name='pending' size={16} color='#FF9800' />
            <Text style={[styles.toolStatText, { color: '#FF9800' }]}>
              691 pending
            </Text>
          </View>
          <View style={styles.toolStatItem}>
            <MaterialIcons
              name='schedule'
              size={16}
              color={textSecondaryColor}
            />
            <Text style={[styles.toolStatText, { color: textSecondaryColor }]}>
              Avg time: 4.2h
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Verification Reports */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'Verification Reports',
            'What report would you like to view?',
            [
              {
                text: 'Verification Summary',
                onPress: () => {
                  Alert.alert(
                    'Summary',
                    'Opening verification summary report...'
                  );
                  // TODO: Open summary report
                },
              },
              {
                text: 'Failed Verifications',
                onPress: () => {
                  Alert.alert(
                    'Failed',
                    'Opening failed verification report...'
                  );
                  // TODO: Open failed report
                },
              },
              {
                text: 'Verification Trends',
                onPress: () => {
                  Alert.alert(
                    'Trends',
                    'Opening verification trends report...'
                  );
                  // TODO: Open trends report
                },
              },
              {
                text: 'Export Report',
                onPress: () => {
                  Alert.alert('Export', 'Exporting verification report...');
                  // TODO: Export report
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              Verification Reports
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Analytics & Reports
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#2196F3' }]}>
            <Text style={styles.toolStatusText}>READY</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          View detailed verification reports, trends, and analytics
        </Text>
        <View style={styles.toolStats}>
          <View style={styles.toolStatItem}>
            <MaterialIcons name='assessment' size={16} color='#2196F3' />
            <Text style={[styles.toolStatText, { color: '#2196F3' }]}>
              5 reports
            </Text>
          </View>
          <View style={styles.toolStatItem}>
            <MaterialIcons
              name='schedule'
              size={16}
              color={textSecondaryColor}
            />
            <Text style={[styles.toolStatText, { color: textSecondaryColor }]}>
              Updated 1h ago
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* AI Verification */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'AI Verification',
            'What AI verification would you like to run?',
            [
              {
                text: 'Fraud Detection',
                onPress: () => {
                  Alert.alert(
                    'Fraud Detection',
                    'Running AI fraud detection...'
                  );
                  // TODO: Run fraud detection
                },
              },
              {
                text: 'Lead Scoring',
                onPress: () => {
                  Alert.alert('Lead Scoring', 'Running AI lead scoring...');
                  // TODO: Run lead scoring
                },
              },
              {
                text: 'Duplicate Detection',
                onPress: () => {
                  Alert.alert(
                    'Duplicate Detection',
                    'Running AI duplicate detection...'
                  );
                  // TODO: Run duplicate detection
                },
              },
              {
                text: 'Quality Assessment',
                onPress: () => {
                  Alert.alert(
                    'Quality Assessment',
                    'Running AI quality assessment...'
                  );
                  // TODO: Run quality assessment
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              AI Verification
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Machine Learning
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#9C27B0' }]}>
            <Text style={styles.toolStatusText}>AI</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          AI-powered fraud detection, lead scoring, and quality assessment
        </Text>
        <View style={styles.toolStats}>
          <View style={styles.toolStatItem}>
            <MaterialIcons name='psychology' size={16} color='#9C27B0' />
            <Text style={[styles.toolStatText, { color: '#9C27B0' }]}>
              94% accuracy
            </Text>
          </View>
          <View style={styles.toolStatItem}>
            <MaterialIcons
              name='schedule'
              size={16}
              color={textSecondaryColor}
            />
            <Text style={[styles.toolStatText, { color: textSecondaryColor }]}>
              Updated 30m ago
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Lead Verification
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          AI-powered lead validation and verification
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderVerificationOverview()}
        {renderVerificationTools()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  overviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
  },
  overviewStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  overviewStatLabel: {
    fontSize: 12,
  },
  toolsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  toolCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  toolType: {
    fontSize: 12,
  },
  toolStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toolStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  toolDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  toolStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toolStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolStatText: {
    fontSize: 12,
    marginLeft: 8,
  },
});

export default LeadVerification;
