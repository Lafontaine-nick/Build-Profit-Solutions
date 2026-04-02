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

const LeadPreview: React.FC = () => {
  const { darkMode } = useTheme();
  const [selectedLead, setSelectedLead] = useState<any>({
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '(555) 123-4567',
    company: 'Johnson Construction LLC',
    projectType: 'Kitchen Remodel',
    budget: { min: 25000, max: 45000 },
    location: { city: 'Salt Lake City', state: 'UT' },
    timeline: '3-4 months',
    description:
      'Complete kitchen renovation with modern appliances and custom cabinets',
    isUnlocked: true,
    contractorMatches: [
      {
        id: '1',
        name: 'Elite Remodeling',
        rating: 4.8,
        matchScore: 95,
        specialties: ['Kitchen', 'Bathroom'],
        verified: true,
      },
      {
        id: '2',
        name: 'Premier Contractors',
        rating: 4.6,
        matchScore: 87,
        specialties: ['Kitchen', 'General'],
        verified: true,
      },
      {
        id: '3',
        name: 'Quality Builders',
        rating: 4.4,
        matchScore: 82,
        specialties: ['Kitchen', 'Renovation'],
        verified: false,
      },
    ],
  });

  const backgroundColor = 'transparent';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#FFFFFF' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';

  const renderLeadInformation = () => (
    <View
      style={[styles.leadCard, { backgroundColor: cardColor, borderColor }]}
    >
      <View style={styles.leadHeader}>
        <MaterialIcons name='person' size={24} color='#4CAF50' />
        <Text style={[styles.leadTitle, { color: textColor }]}>
          Lead Information
        </Text>
        <View
          style={[
            styles.unlockBadge,
            {
              backgroundColor: selectedLead.isUnlocked ? '#4CAF50' : '#FF9800',
            },
          ]}
        >
          <Text style={styles.unlockBadgeText}>
            {selectedLead.isUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </Text>
        </View>
      </View>

      <View style={styles.leadDetails}>
        <View style={styles.detailRow}>
          <MaterialIcons name='person' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>Name:</Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.name}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='email' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>Email:</Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.email}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='phone' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>Phone:</Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.phone}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='business' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>
            Company:
          </Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.company}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='home' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>
            Location:
          </Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.location.city}, {selectedLead.location.state}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='build' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>
            Project:
          </Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.projectType}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons
            name='attach-money'
            size={16}
            color={textSecondaryColor}
          />
          <Text style={[styles.detailLabel, { color: textColor }]}>
            Budget:
          </Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            ${selectedLead.budget.min.toLocaleString()} - $
            {selectedLead.budget.max.toLocaleString()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='schedule' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailLabel, { color: textColor }]}>
            Timeline:
          </Text>
          <Text style={[styles.detailValue, { color: textSecondaryColor }]}>
            {selectedLead.timeline}
          </Text>
        </View>
      </View>

      <View style={styles.descriptionSection}>
        <Text style={[styles.descriptionTitle, { color: textColor }]}>
          Project Description
        </Text>
        <Text style={[styles.descriptionText, { color: textSecondaryColor }]}>
          {selectedLead.description}
        </Text>
      </View>
    </View>
  );

  const renderContractorMatches = () => (
    <View style={styles.matchesSection}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Contractor Matches
      </Text>

      {selectedLead.contractorMatches.map((contractor: any, index: number) => (
        <TouchableOpacity
          key={contractor.id}
          style={[
            styles.contractorCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(`${contractor.name}`, 'What would you like to do?', [
              {
                text: 'View Profile',
                onPress: () => {
                  Alert.alert(
                    'Profile',
                    `Opening ${contractor.name} profile...`
                  );
                  // TODO: Open contractor profile
                },
              },
              {
                text: 'Contact Contractor',
                onPress: () => {
                  Alert.alert('Contact', `Contacting ${contractor.name}...`);
                  // TODO: Contact contractor
                },
              },
              {
                text: 'View Reviews',
                onPress: () => {
                  Alert.alert(
                    'Reviews',
                    `Opening ${contractor.name} reviews...`
                  );
                  // TODO: Open reviews
                },
              },
              {
                text: 'Request Quote',
                onPress: () => {
                  Alert.alert(
                    'Quote',
                    `Requesting quote from ${contractor.name}...`
                  );
                  // TODO: Request quote
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.contractorHeader}>
            <View style={styles.contractorInfo}>
              <Text style={[styles.contractorName, { color: textColor }]}>
                {contractor.name}
              </Text>
              <View style={styles.contractorRating}>
                <MaterialIcons name='star' size={14} color='#FFD700' />
                <Text
                  style={[styles.ratingText, { color: textSecondaryColor }]}
                >
                  {contractor.rating}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.matchScore,
                {
                  backgroundColor:
                    contractor.matchScore >= 90
                      ? '#4CAF50'
                      : contractor.matchScore >= 80
                        ? '#FF9800'
                        : '#F44336',
                },
              ]}
            >
              <Text style={styles.matchScoreText}>
                {contractor.matchScore}%
              </Text>
            </View>
          </View>

          <View style={styles.contractorDetails}>
            <View style={styles.specialtiesContainer}>
              {contractor.specialties.map(
                (specialty: string, specIndex: number) => (
                  <View
                    key={specIndex}
                    style={[
                      styles.specialtyTag,
                      { backgroundColor: '#E3F2FD' },
                    ]}
                  >
                    <Text style={[styles.specialtyText, { color: '#1976D2' }]}>
                      {specialty}
                    </Text>
                  </View>
                )
              )}
            </View>

            <View style={styles.verificationStatus}>
              <MaterialIcons
                name={contractor.verified ? 'verified' : 'warning'}
                size={16}
                color={contractor.verified ? '#4CAF50' : '#FF9800'}
              />
              <Text
                style={[
                  styles.verificationText,
                  { color: contractor.verified ? '#4CAF50' : '#FF9800' },
                ]}
              >
                {contractor.verified ? 'Verified' : 'Pending Verification'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPreviewTools = () => (
    <View style={styles.toolsSection}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Preview Tools
      </Text>

      {/* Edit Lead */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert('Edit Lead', 'What would you like to edit?', [
            {
              text: 'Basic Information',
              onPress: () => {
                Alert.alert('Basic Info', 'Opening lead information editor...');
                // TODO: Open basic info editor
              },
            },
            {
              text: 'Project Details',
              onPress: () => {
                Alert.alert(
                  'Project Details',
                  'Opening project details editor...'
                );
                // TODO: Open project editor
              },
            },
            {
              text: 'Contact Information',
              onPress: () => {
                Alert.alert(
                  'Contact Info',
                  'Opening contact information editor...'
                );
                // TODO: Open contact editor
              },
            },
            {
              text: 'Budget & Timeline',
              onPress: () => {
                Alert.alert(
                  'Budget & Timeline',
                  'Opening budget and timeline editor...'
                );
                // TODO: Open budget editor
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              Edit Lead
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Modify Information
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#2196F3' }]}>
            <Text style={styles.toolStatusText}>EDIT</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          Modify lead information, project details, and contact information
        </Text>
      </TouchableOpacity>

      {/* Share Preview */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'Share Preview',
            'How would you like to share this lead?',
            [
              {
                text: 'Share with Team',
                onPress: () => {
                  Alert.alert(
                    'Share with Team',
                    'Sharing lead preview with team members...'
                  );
                  // TODO: Share with team
                },
              },
              {
                text: 'Export PDF',
                onPress: () => {
                  Alert.alert('Export PDF', 'Generating PDF preview...');
                  // TODO: Export PDF
                },
              },
              {
                text: 'Send to Contractor',
                onPress: () => {
                  Alert.alert(
                    'Send to Contractor',
                    'Sending lead preview to selected contractor...'
                  );
                  // TODO: Send to contractor
                },
              },
              {
                text: 'Copy Link',
                onPress: () => {
                  Alert.alert('Copy Link', 'Copying lead preview link...');
                  // TODO: Copy link
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
              Share Preview
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Export & Share
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.toolStatusText}>SHARE</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          Share lead preview with team members or export as PDF
        </Text>
      </TouchableOpacity>

      {/* Preview Settings */}
      <TouchableOpacity
        style={[styles.toolCard, { backgroundColor: cardColor, borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert('Preview Settings', 'What would you like to configure?', [
            {
              text: 'Privacy Settings',
              onPress: () => {
                Alert.alert('Privacy', 'Opening privacy settings...');
                // TODO: Open privacy settings
              },
            },
            {
              text: 'Display Options',
              onPress: () => {
                Alert.alert('Display', 'Opening display options...');
                // TODO: Open display options
              },
            },
            {
              text: 'Matching Criteria',
              onPress: () => {
                Alert.alert('Matching', 'Opening matching criteria...');
                // TODO: Open matching criteria
              },
            },
            {
              text: 'Notification Settings',
              onPress: () => {
                Alert.alert(
                  'Notifications',
                  'Opening notification settings...'
                );
                // TODO: Open notification settings
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.toolHeader}>
          <View style={styles.toolInfo}>
            <Text style={[styles.toolName, { color: textColor }]}>
              Preview Settings
            </Text>
            <Text style={[styles.toolType, { color: textSecondaryColor }]}>
              Configuration
            </Text>
          </View>
          <View style={[styles.toolStatus, { backgroundColor: '#FF9800' }]}>
            <Text style={styles.toolStatusText}>SETTINGS</Text>
          </View>
        </View>
        <Text style={[styles.toolDescription, { color: textSecondaryColor }]}>
          Configure privacy settings, display options, and matching criteria
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Lead Preview</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Preview lead information and contractor matches
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderLeadInformation()}
        {renderContractorMatches()}
        {renderPreviewTools()}
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
  leadCard: {
    padding: 22,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  unlockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unlockBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  leadDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  descriptionSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  matchesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contractorCard: {
    padding: 22,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contractorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractorInfo: {
    flex: 1,
  },
  contractorName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contractorRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 4,
  },
  matchScore: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchScoreText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contractorDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  specialtyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  toolsSection: {
    marginBottom: 20,
  },
  toolCard: {
    padding: 22,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
  },
});

export default LeadPreview;
