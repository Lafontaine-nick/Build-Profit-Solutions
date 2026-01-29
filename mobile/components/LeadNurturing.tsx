import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import AutomationWorkflowBuilder from './AutomationWorkflowBuilder';
import AutomationAnalytics from './AutomationAnalytics';
import SmartPersonalization from './SmartPersonalization';

const LeadNurturing: React.FC = () => {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'campaigns' | 'segments' | 'automation' | 'analytics'
  >('campaigns');
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);

  const backgroundColor = 'transparent';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';

  const renderAutomationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.automationHeader}>
        <View>
          <Text style={[styles.automationTitle, { color: textColor }]}>
            Automation Workflows
          </Text>
          <Text
            style={[styles.automationSubtitle, { color: textSecondaryColor }]}
          >
            AI-powered automation with real-time analytics
          </Text>
        </View>
        <View style={styles.automationButtons}>
          <TouchableOpacity
            style={[styles.analyticsButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => setShowAnalytics(true)}
          >
            <MaterialIcons name='analytics' size={16} color='white' />
            <Text style={styles.analyticsButtonText}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.personalizationButton,
              { backgroundColor: '#9C27B0' },
            ]}
            onPress={() => setShowPersonalization(true)}
          >
            <MaterialIcons name='psychology' size={16} color='white' />
            <Text style={styles.personalizationButtonText}>AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.automationList}>
        {/* Analytics Overview Card */}
        <TouchableOpacity
          style={[
            styles.analyticsOverviewCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => setShowAnalytics(true)}
          activeOpacity={0.7}
        >
          <View style={styles.analyticsOverviewHeader}>
            <MaterialIcons name='analytics' size={24} color='#4CAF50' />
            <Text style={[styles.analyticsOverviewTitle, { color: textColor }]}>
              Performance Analytics
            </Text>
            <View
              style={[styles.analyticsBadge, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.analyticsBadgeText}>LIVE</Text>
            </View>
          </View>
          <Text
            style={[
              styles.analyticsOverviewDescription,
              { color: textSecondaryColor },
            ]}
          >
            Real-time insights into automation performance, conversion rates,
            and optimization opportunities
          </Text>
          <View style={styles.analyticsOverviewStats}>
            <View style={styles.analyticsStat}>
              <Text style={[styles.analyticsStatValue, { color: '#4CAF50' }]}>
                23.5%
              </Text>
              <Text
                style={[
                  styles.analyticsStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Avg Conversion
              </Text>
            </View>
            <View style={styles.analyticsStat}>
              <Text style={[styles.analyticsStatValue, { color: '#2196F3' }]}>
                156
              </Text>
              <Text
                style={[
                  styles.analyticsStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Active Leads
              </Text>
            </View>
            <View style={styles.analyticsStat}>
              <Text style={[styles.analyticsStatValue, { color: '#FF9800' }]}>
                2.3h
              </Text>
              <Text
                style={[
                  styles.analyticsStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Response Time
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Smart Triggers Card */}
        <TouchableOpacity
          style={[
            styles.automationCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowWorkflowBuilder(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.automationFeature}>
            <MaterialIcons name='smart-toy' size={24} color='#4CAF50' />
            <Text style={[styles.automationText, { color: textColor }]}>
              Smart Triggers
            </Text>
          </View>
          <Text
            style={[
              styles.automationDescription,
              { color: textSecondaryColor },
            ]}
          >
            Automatically trigger campaigns based on lead behavior and
            engagement
          </Text>
          <View style={styles.automationStats}>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              12 active triggers
            </Text>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              156 leads processed
            </Text>
          </View>
        </TouchableOpacity>

        {/* Performance Optimization Card */}
        <TouchableOpacity
          style={[
            styles.automationCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowWorkflowBuilder(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.automationFeature}>
            <MaterialIcons name='speed' size={24} color='#FF9800' />
            <Text style={[styles.automationText, { color: textColor }]}>
              Performance Optimization
            </Text>
          </View>
          <Text
            style={[
              styles.automationDescription,
              { color: textSecondaryColor },
            ]}
          >
            AI-powered optimization of automation workflows for maximum
            performance
          </Text>
          <View style={styles.automationStats}>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              8 optimizations active
            </Text>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              31.2% conversion rate
            </Text>
          </View>
        </TouchableOpacity>

        {/* Personalization Engine Card */}
        <TouchableOpacity
          style={[
            styles.automationCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => setShowPersonalization(true)}
          activeOpacity={0.7}
        >
          <View style={styles.automationFeature}>
            <MaterialIcons name='psychology' size={24} color='#9C27B0' />
            <Text style={[styles.automationText, { color: textColor }]}>
              Personalization Engine
            </Text>
          </View>
          <Text
            style={[
              styles.automationDescription,
              { color: textSecondaryColor },
            ]}
          >
            AI-driven personalization for hyper-targeted lead nurturing
            campaigns
          </Text>
          <View style={styles.automationStats}>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              15 personalization rules
            </Text>
            <Text
              style={[styles.automationStat, { color: textSecondaryColor }]}
            >
              89% engagement rate
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderCampaignsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.campaignsHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: textColor }]}>Campaigns</Text>
          <Text style={[styles.tabDescription, { color: textSecondaryColor }]}>
            Manage your lead nurturing campaigns
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createCampaignButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Create Campaign',
              'What type of campaign would you like to create?',
              [
                {
                  text: 'Welcome Series',
                  onPress: () => {
                    Alert.alert(
                      'Welcome Series',
                      'Creating new welcome series campaign...'
                    );
                    // TODO: Navigate to campaign creation screen
                  },
                },
                {
                  text: 'Re-engagement',
                  onPress: () => {
                    Alert.alert(
                      'Re-engagement',
                      'Creating new re-engagement campaign...'
                    );
                    // TODO: Navigate to campaign creation screen
                  },
                },
                {
                  text: 'Upsell',
                  onPress: () => {
                    Alert.alert('Upsell', 'Creating new upsell campaign...');
                    // TODO: Navigate to campaign creation screen
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <MaterialIcons name='add' size={20} color='white' />
          <Text style={styles.createCampaignButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.campaignsList}
        showsVerticalScrollIndicator={false}
      >
        {/* Campaign Performance Overview */}
        <View
          style={[
            styles.campaignOverviewCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.campaignOverviewHeader}>
            <MaterialIcons name='campaign' size={24} color='#4CAF50' />
            <Text style={[styles.campaignOverviewTitle, { color: textColor }]}>
              Active Campaigns
            </Text>
            <View
              style={[styles.campaignBadge, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignBadgeText}>5 ACTIVE</Text>
            </View>
          </View>
          <View style={styles.campaignOverviewStats}>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#4CAF50' }]}>
                2,847
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Total Leads
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#2196F3' }]}>
                23.5%
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Avg Conversion
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#FF9800' }]}>
                $45.2K
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Revenue
              </Text>
            </View>
          </View>
        </View>

        {/* Welcome Series Campaign */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Welcome Series Campaign',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Campaign Details',
                      'Opening welcome series campaign details...'
                    );
                    // TODO: Navigate to campaign details screen
                  },
                },
                {
                  text: 'Edit Campaign',
                  onPress: () => {
                    Alert.alert('Edit Campaign', 'Opening campaign editor...');
                    // TODO: Navigate to campaign editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening campaign analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Pause Campaign',
                  onPress: () => {
                    Alert.alert(
                      'Pause Campaign',
                      'Campaign paused successfully!'
                    );
                    // TODO: Update campaign status
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of welcome series campaign...'
                    );
                    // TODO: Duplicate campaign
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Welcome Series
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Onboarding Campaign
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Automated welcome series for new leads with personalized content and
            follow-up sequences
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                1,247 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                28.3% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                7 emails
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Re-engagement Campaign */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Re-engagement Campaign',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Campaign Details',
                      'Opening re-engagement campaign details...'
                    );
                    // TODO: Navigate to campaign details screen
                  },
                },
                {
                  text: 'Edit Campaign',
                  onPress: () => {
                    Alert.alert('Edit Campaign', 'Opening campaign editor...');
                    // TODO: Navigate to campaign editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening campaign analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Resume Campaign',
                  onPress: () => {
                    Alert.alert(
                      'Resume Campaign',
                      'Campaign resumed successfully!'
                    );
                    // TODO: Update campaign status
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of re-engagement campaign...'
                    );
                    // TODO: Duplicate campaign
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Re-engagement
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Win-back Campaign
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#FF9800' }]}
            >
              <Text style={styles.campaignStatusText}>PAUSED</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Re-engage cold leads with targeted offers and personalized messaging
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                892 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#FF9800' />
              <Text style={[styles.campaignStatText, { color: '#FF9800' }]}>
                15.7% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                5 emails
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Upsell Campaign */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Premium Upsell Campaign',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Campaign Details',
                      'Opening upsell campaign details...'
                    );
                    // TODO: Navigate to campaign details screen
                  },
                },
                {
                  text: 'Edit Campaign',
                  onPress: () => {
                    Alert.alert('Edit Campaign', 'Opening campaign editor...');
                    // TODO: Navigate to campaign editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening campaign analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Pause Campaign',
                  onPress: () => {
                    Alert.alert(
                      'Pause Campaign',
                      'Campaign paused successfully!'
                    );
                    // TODO: Update campaign status
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of upsell campaign...'
                    );
                    // TODO: Duplicate campaign
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Premium Upsell
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Revenue Campaign
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Upsell premium services to existing customers with exclusive offers
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                456 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                34.2% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                3 emails
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Seasonal Campaign */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Spring Remodeling Campaign',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Campaign Details',
                      'Opening seasonal campaign details...'
                    );
                    // TODO: Navigate to campaign details screen
                  },
                },
                {
                  text: 'Edit Campaign',
                  onPress: () => {
                    Alert.alert('Edit Campaign', 'Opening campaign editor...');
                    // TODO: Navigate to campaign editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening campaign analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Pause Campaign',
                  onPress: () => {
                    Alert.alert(
                      'Pause Campaign',
                      'Campaign paused successfully!'
                    );
                    // TODO: Update campaign status
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of seasonal campaign...'
                    );
                    // TODO: Duplicate campaign
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Spring Remodeling
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Seasonal Campaign
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Seasonal promotion for spring remodeling projects with special
            pricing
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                1,203 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                31.8% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                6 emails
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Referral Campaign */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Referral Program Campaign',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Campaign Details',
                      'Opening referral campaign details...'
                    );
                    // TODO: Navigate to campaign details screen
                  },
                },
                {
                  text: 'Edit Campaign',
                  onPress: () => {
                    Alert.alert('Edit Campaign', 'Opening campaign editor...');
                    // TODO: Navigate to campaign editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening campaign analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Pause Campaign',
                  onPress: () => {
                    Alert.alert(
                      'Pause Campaign',
                      'Campaign paused successfully!'
                    );
                    // TODO: Update campaign status
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of referral campaign...'
                    );
                    // TODO: Duplicate campaign
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Referral Program
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Growth Campaign
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Encourage customer referrals with rewards and incentives program
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                567 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                42.1% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                4 emails
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderSegmentsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.campaignsHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: textColor }]}>Segments</Text>
          <Text style={[styles.tabDescription, { color: textSecondaryColor }]}>
            Organize leads into targeted segments
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createCampaignButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Create Segment',
              'What type of segment would you like to create?',
              [
                {
                  text: 'Demographic',
                  onPress: () => {
                    Alert.alert(
                      'Demographic Segment',
                      'Creating new demographic segment...'
                    );
                    // TODO: Navigate to segment creation screen
                  },
                },
                {
                  text: 'Behavioral',
                  onPress: () => {
                    Alert.alert(
                      'Behavioral Segment',
                      'Creating new behavioral segment...'
                    );
                    // TODO: Navigate to segment creation screen
                  },
                },
                {
                  text: 'Geographic',
                  onPress: () => {
                    Alert.alert(
                      'Geographic Segment',
                      'Creating new geographic segment...'
                    );
                    // TODO: Navigate to segment creation screen
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <MaterialIcons name='add' size={20} color='white' />
          <Text style={styles.createCampaignButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.campaignsList}
        showsVerticalScrollIndicator={false}
      >
        {/* Segments Overview */}
        <View
          style={[
            styles.campaignOverviewCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.campaignOverviewHeader}>
            <MaterialIcons name='group' size={24} color='#4CAF50' />
            <Text style={[styles.campaignOverviewTitle, { color: textColor }]}>
              Lead Segments
            </Text>
            <View
              style={[styles.campaignBadge, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignBadgeText}>8 ACTIVE</Text>
            </View>
          </View>
          <View style={styles.campaignOverviewStats}>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#4CAF50' }]}>
                3,247
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Total Leads
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#2196F3' }]}>
                85.2%
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Segmented
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#FF9800' }]}>
                12.3%
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Avg Response
              </Text>
            </View>
          </View>
        </View>

        {/* High-Value Leads Segment */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'High-Value Leads Segment',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Segment Details',
                      'Opening high-value leads segment details...'
                    );
                    // TODO: Navigate to segment details screen
                  },
                },
                {
                  text: 'Edit Segment',
                  onPress: () => {
                    Alert.alert('Edit Segment', 'Opening segment editor...');
                    // TODO: Navigate to segment editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening segment analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Export Leads',
                  onPress: () => {
                    Alert.alert('Export', 'Exporting segment leads...');
                    // TODO: Export segment data
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of high-value segment...'
                    );
                    // TODO: Duplicate segment
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                High-Value Leads
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Revenue Segment
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Leads with budget over $50K and high engagement scores for premium
            services
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                247 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                18.5% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 2h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* New Leads Segment */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('New Leads Segment', 'What would you like to do?', [
              {
                text: 'View Details',
                onPress: () => {
                  Alert.alert(
                    'Segment Details',
                    'Opening new leads segment details...'
                  );
                  // TODO: Navigate to segment details screen
                },
              },
              {
                text: 'Edit Segment',
                onPress: () => {
                  Alert.alert('Edit Segment', 'Opening segment editor...');
                  // TODO: Navigate to segment editor
                },
              },
              {
                text: 'View Analytics',
                onPress: () => {
                  Alert.alert(
                    'Analytics',
                    'Opening segment analytics dashboard...'
                  );
                  // TODO: Navigate to analytics screen
                },
              },
              {
                text: 'Export Leads',
                onPress: () => {
                  Alert.alert('Export', 'Exporting segment leads...');
                  // TODO: Export segment data
                },
              },
              {
                text: 'Duplicate',
                onPress: () => {
                  Alert.alert(
                    'Duplicate',
                    'Creating copy of new leads segment...'
                  );
                  // TODO: Duplicate segment
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                New Leads
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Growth Segment
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Recently acquired leads within the last 30 days requiring immediate
            follow-up
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                892 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                12.3% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 1h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Cold Leads Segment */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Cold Leads Segment', 'What would you like to do?', [
              {
                text: 'View Details',
                onPress: () => {
                  Alert.alert(
                    'Segment Details',
                    'Opening cold leads segment details...'
                  );
                  // TODO: Navigate to segment details screen
                },
              },
              {
                text: 'Edit Segment',
                onPress: () => {
                  Alert.alert('Edit Segment', 'Opening segment editor...');
                  // TODO: Navigate to segment editor
                },
              },
              {
                text: 'View Analytics',
                onPress: () => {
                  Alert.alert(
                    'Analytics',
                    'Opening segment analytics dashboard...'
                  );
                  // TODO: Navigate to analytics screen
                },
              },
              {
                text: 'Export Leads',
                onPress: () => {
                  Alert.alert('Export', 'Exporting segment leads...');
                  // TODO: Export segment data
                },
              },
              {
                text: 'Duplicate',
                onPress: () => {
                  Alert.alert(
                    'Duplicate',
                    'Creating copy of cold leads segment...'
                  );
                  // TODO: Duplicate segment
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Cold Leads
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Re-engagement Segment
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#FF9800' }]}
            >
              <Text style={styles.campaignStatusText}>PAUSED</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Leads with no engagement for 60+ days requiring re-engagement
            campaigns
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                1,456 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-down' size={16} color='#FF9800' />
              <Text style={[styles.campaignStatText, { color: '#FF9800' }]}>
                2.1% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 3h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Geographic Segment */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Utah Valley Segment', 'What would you like to do?', [
              {
                text: 'View Details',
                onPress: () => {
                  Alert.alert(
                    'Segment Details',
                    'Opening Utah Valley segment details...'
                  );
                  // TODO: Navigate to segment details screen
                },
              },
              {
                text: 'Edit Segment',
                onPress: () => {
                  Alert.alert('Edit Segment', 'Opening segment editor...');
                  // TODO: Navigate to segment editor
                },
              },
              {
                text: 'View Analytics',
                onPress: () => {
                  Alert.alert(
                    'Analytics',
                    'Opening segment analytics dashboard...'
                  );
                  // TODO: Navigate to analytics screen
                },
              },
              {
                text: 'Export Leads',
                onPress: () => {
                  Alert.alert('Export', 'Exporting segment leads...');
                  // TODO: Export segment data
                },
              },
              {
                text: 'Duplicate',
                onPress: () => {
                  Alert.alert(
                    'Duplicate',
                    'Creating copy of Utah Valley segment...'
                  );
                  // TODO: Duplicate segment
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Utah Valley
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Geographic Segment
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Leads located in Utah Valley area for local service campaigns
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                567 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                15.7% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 4h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Budget Range Segment */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Mid-Range Budget Segment',
              'What would you like to do?',
              [
                {
                  text: 'View Details',
                  onPress: () => {
                    Alert.alert(
                      'Segment Details',
                      'Opening mid-range budget segment details...'
                    );
                    // TODO: Navigate to segment details screen
                  },
                },
                {
                  text: 'Edit Segment',
                  onPress: () => {
                    Alert.alert('Edit Segment', 'Opening segment editor...');
                    // TODO: Navigate to segment editor
                  },
                },
                {
                  text: 'View Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Analytics',
                      'Opening segment analytics dashboard...'
                    );
                    // TODO: Navigate to analytics screen
                  },
                },
                {
                  text: 'Export Leads',
                  onPress: () => {
                    Alert.alert('Export', 'Exporting segment leads...');
                    // TODO: Export segment data
                  },
                },
                {
                  text: 'Duplicate',
                  onPress: () => {
                    Alert.alert(
                      'Duplicate',
                      'Creating copy of mid-range budget segment...'
                    );
                    // TODO: Duplicate segment
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Mid-Range Budget
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Budget Segment
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Leads with budgets between $25K-$50K for standard service packages
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                1,203 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                21.4% conversion
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 1h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.campaignsHeader}>
        <View>
          <Text style={[styles.tabTitle, { color: textColor }]}>Analytics</Text>
          <Text style={[styles.tabDescription, { color: textSecondaryColor }]}>
            View performance metrics and insights
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.createCampaignButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Export Analytics', 'What would you like to export?', [
              {
                text: 'PDF Report',
                onPress: () => {
                  Alert.alert(
                    'Export PDF',
                    'Generating PDF analytics report...'
                  );
                  // TODO: Generate PDF report
                },
              },
              {
                text: 'CSV Data',
                onPress: () => {
                  Alert.alert(
                    'Export CSV',
                    'Exporting analytics data to CSV...'
                  );
                  // TODO: Export CSV data
                },
              },
              {
                text: 'Share Insights',
                onPress: () => {
                  Alert.alert('Share', 'Sharing analytics insights...');
                  // TODO: Share analytics
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <MaterialIcons name='file-download' size={20} color='white' />
          <Text style={styles.createCampaignButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.campaignsList}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Overview */}
        <View
          style={[
            styles.campaignOverviewCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.campaignOverviewHeader}>
            <MaterialIcons name='analytics' size={24} color='#4CAF50' />
            <Text style={[styles.campaignOverviewTitle, { color: textColor }]}>
              Performance Overview
            </Text>
            <View
              style={[styles.campaignBadge, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignBadgeText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.campaignOverviewStats}>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#4CAF50' }]}>
                23.5%
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Avg Conversion
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#2196F3' }]}>
                2.3h
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Response Time
              </Text>
            </View>
            <View style={styles.campaignStat}>
              <Text style={[styles.campaignStatValue, { color: '#FF9800' }]}>
                $45.2K
              </Text>
              <Text
                style={[
                  styles.campaignStatLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Revenue
              </Text>
            </View>
          </View>
        </View>

        {/* Campaign Performance */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Campaign Analytics', 'What would you like to view?', [
              {
                text: 'Performance Metrics',
                onPress: () => {
                  Alert.alert(
                    'Performance',
                    'Opening campaign performance metrics...'
                  );
                  // TODO: Navigate to performance screen
                },
              },
              {
                text: 'Conversion Funnel',
                onPress: () => {
                  Alert.alert(
                    'Funnel',
                    'Opening conversion funnel analysis...'
                  );
                  // TODO: Navigate to funnel screen
                },
              },
              {
                text: 'A/B Test Results',
                onPress: () => {
                  Alert.alert('A/B Tests', 'Opening A/B test results...');
                  // TODO: Navigate to A/B test screen
                },
              },
              {
                text: 'ROI Analysis',
                onPress: () => {
                  Alert.alert('ROI', 'Opening ROI analysis...');
                  // TODO: Navigate to ROI screen
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Campaign Performance
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Conversion Analytics
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Track campaign performance, conversion rates, and engagement metrics
            across all campaigns
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                +12.3% growth
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                5 campaigns
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 1h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Lead Quality Analytics */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Lead Quality Analytics',
              'What would you like to view?',
              [
                {
                  text: 'Quality Scores',
                  onPress: () => {
                    Alert.alert(
                      'Quality Scores',
                      'Opening lead quality scores...'
                    );
                    // TODO: Navigate to quality scores screen
                  },
                },
                {
                  text: 'Engagement Metrics',
                  onPress: () => {
                    Alert.alert('Engagement', 'Opening engagement metrics...');
                    // TODO: Navigate to engagement screen
                  },
                },
                {
                  text: 'Behavioral Patterns',
                  onPress: () => {
                    Alert.alert('Behavior', 'Opening behavioral patterns...');
                    // TODO: Navigate to behavior screen
                  },
                },
                {
                  text: 'Predictive Analytics',
                  onPress: () => {
                    Alert.alert(
                      'Predictive',
                      'Opening predictive analytics...'
                    );
                    // TODO: Navigate to predictive screen
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Lead Quality
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Quality Analytics
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Analyze lead quality scores, engagement levels, and behavioral
            patterns for optimization
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='star' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                8.5 avg score
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                2,847 leads
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 30m ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Revenue Analytics */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert('Revenue Analytics', 'What would you like to view?', [
              {
                text: 'Revenue Trends',
                onPress: () => {
                  Alert.alert(
                    'Revenue Trends',
                    'Opening revenue trend analysis...'
                  );
                  // TODO: Navigate to revenue trends screen
                },
              },
              {
                text: 'Customer Lifetime Value',
                onPress: () => {
                  Alert.alert(
                    'CLV',
                    'Opening customer lifetime value analysis...'
                  );
                  // TODO: Navigate to CLV screen
                },
              },
              {
                text: 'ROI by Campaign',
                onPress: () => {
                  Alert.alert('ROI', 'Opening ROI by campaign analysis...');
                  // TODO: Navigate to ROI screen
                },
              },
              {
                text: 'Revenue Forecasting',
                onPress: () => {
                  Alert.alert('Forecasting', 'Opening revenue forecasting...');
                  // TODO: Navigate to forecasting screen
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Revenue Analytics
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Financial Metrics
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Track revenue generation, customer lifetime value, and ROI across
            all lead nurturing activities
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='attach-money' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                $45.2K revenue
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                +18.7% growth
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 2h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Automation Analytics */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Automation Analytics',
              'What would you like to view?',
              [
                {
                  text: 'Workflow Performance',
                  onPress: () => {
                    Alert.alert(
                      'Workflows',
                      'Opening workflow performance metrics...'
                    );
                    // TODO: Navigate to workflow screen
                  },
                },
                {
                  text: 'Trigger Analytics',
                  onPress: () => {
                    Alert.alert('Triggers', 'Opening trigger analytics...');
                    // TODO: Navigate to trigger screen
                  },
                },
                {
                  text: 'Automation ROI',
                  onPress: () => {
                    Alert.alert(
                      'Automation ROI',
                      'Opening automation ROI analysis...'
                    );
                    // TODO: Navigate to automation ROI screen
                  },
                },
                {
                  text: 'Optimization Suggestions',
                  onPress: () => {
                    Alert.alert(
                      'Optimization',
                      'Opening optimization suggestions...'
                    );
                    // TODO: Navigate to optimization screen
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Automation Analytics
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                Workflow Metrics
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#4CAF50' }]}
            >
              <Text style={styles.campaignStatusText}>ACTIVE</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            Monitor automation workflow performance, trigger effectiveness, and
            optimization opportunities
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='smart-toy' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                12 workflows
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                31.2% efficiency
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 45m ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Predictive Analytics */}
        <TouchableOpacity
          style={[
            styles.campaignCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(
              'Predictive Analytics',
              'What would you like to view?',
              [
                {
                  text: 'Lead Scoring',
                  onPress: () => {
                    Alert.alert(
                      'Lead Scoring',
                      'Opening predictive lead scoring...'
                    );
                    // TODO: Navigate to lead scoring screen
                  },
                },
                {
                  text: 'Conversion Predictions',
                  onPress: () => {
                    Alert.alert(
                      'Predictions',
                      'Opening conversion predictions...'
                    );
                    // TODO: Navigate to predictions screen
                  },
                },
                {
                  text: 'Churn Analysis',
                  onPress: () => {
                    Alert.alert('Churn', 'Opening churn analysis...');
                    // TODO: Navigate to churn screen
                  },
                },
                {
                  text: 'Market Trends',
                  onPress: () => {
                    Alert.alert('Trends', 'Opening market trend analysis...');
                    // TODO: Navigate to trends screen
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.campaignHeader}>
            <View style={styles.campaignInfo}>
              <Text style={[styles.campaignName, { color: textColor }]}>
                Predictive Analytics
              </Text>
              <Text
                style={[styles.campaignType, { color: textSecondaryColor }]}
              >
                AI Insights
              </Text>
            </View>
            <View
              style={[styles.campaignStatus, { backgroundColor: '#9C27B0' }]}
            >
              <Text style={styles.campaignStatusText}>AI</Text>
            </View>
          </View>
          <Text
            style={[styles.campaignDescription, { color: textSecondaryColor }]}
          >
            AI-powered predictive analytics for lead scoring, conversion
            predictions, and market trends
          </Text>
          <View style={styles.campaignStats}>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='psychology' size={16} color='#9C27B0' />
              <Text style={[styles.campaignStatText, { color: '#9C27B0' }]}>
                89% accuracy
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.campaignStatText, { color: '#4CAF50' }]}>
                +15.3% lift
              </Text>
            </View>
            <View style={styles.campaignStatItem}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[styles.campaignStatText, { color: textSecondaryColor }]}
              >
                Updated 1h ago
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Lead Nurturing</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          AI-powered lead nurturing and automation
        </Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'campaigns' && styles.activeTab]}
          onPress={() => setActiveTab('campaigns')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'campaigns' ? '#4CAF50' : textSecondaryColor,
              },
            ]}
          >
            Campaigns
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'segments' && styles.activeTab]}
          onPress={() => setActiveTab('segments')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'segments' ? '#4CAF50' : textSecondaryColor,
              },
            ]}
          >
            Segments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'automation' && styles.activeTab]}
          onPress={() => setActiveTab('automation')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'automation' ? '#4CAF50' : textSecondaryColor,
              },
            ]}
          >
            Automation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'analytics' ? '#4CAF50' : textSecondaryColor,
              },
            ]}
          >
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'campaigns' && renderCampaignsTab()}
      {activeTab === 'segments' && renderSegmentsTab()}
      {activeTab === 'automation' && renderAutomationTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}

      {/* Modals */}
      <AutomationWorkflowBuilder
        visible={showWorkflowBuilder}
        onClose={() => setShowWorkflowBuilder(false)}
        onSave={workflow => {
          console.log('Workflow saved:', workflow);
          setShowWorkflowBuilder(false);
        }}
      />

      <AutomationAnalytics
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      <SmartPersonalization
        visible={showPersonalization}
        onClose={() => setShowPersonalization(false)}
      />
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
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tabDescription: {
    fontSize: 16,
    marginBottom: 20,
  },
  automationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  automationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  automationSubtitle: {
    fontSize: 16,
  },
  automationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  analyticsButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  personalizationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  personalizationButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  automationList: {
    flex: 1,
  },
  analyticsOverviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  analyticsOverviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  analyticsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  analyticsBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  analyticsOverviewDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  analyticsOverviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analyticsStat: {
    alignItems: 'center',
    flex: 1,
  },
  analyticsStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  analyticsStatLabel: {
    fontSize: 12,
  },
  automationCard: {
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
  automationFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  automationText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  automationDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  automationStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  automationStat: {
    fontSize: 12,
  },
  campaignsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  createCampaignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createCampaignButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  campaignsList: {
    flex: 1,
  },
  campaignOverviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  campaignOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  campaignOverviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  campaignBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  campaignBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignOverviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  campaignStat: {
    alignItems: 'center',
    flex: 1,
  },
  campaignStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  campaignStatLabel: {
    fontSize: 12,
  },
  campaignCard: {
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
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  campaignType: {
    fontSize: 12,
  },
  campaignStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  campaignStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  campaignDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  campaignStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  campaignStatText: {
    fontSize: 12,
    marginLeft: 8,
  },
});

export default LeadNurturing;
