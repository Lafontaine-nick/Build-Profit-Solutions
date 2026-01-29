import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService } from '../services/leadService';
import LeadCaptureForm from './LeadCaptureForm';

interface LeadGenerationProps {
  onLeadCreated?: (lead: any) => void;
}

interface LeadCampaign {
  id: string;
  name: string;
  type:
    | 'website'
    | 'social-media'
    | 'referral'
    | 'cold-outreach'
    | 'advertisement'
    | 'ai-powered'
    | 'automated';
  status: 'active' | 'paused' | 'completed' | 'optimizing';
  targetAudience: string[];
  conversionRate: number;
  totalLeads: number;
  qualifiedLeads: number;
  revenue: number;
  cost: number;
  roi: number;
  startDate: string;
  endDate?: string;
  aiOptimization: {
    enabled: boolean;
    autoAdjustBudget: boolean;
    smartTargeting: boolean;
    conversionOptimization: boolean;
  };
  performanceMetrics: {
    ctr: number;
    cpc: number;
    qualityScore: number;
    avgLeadValue: number;
  };
}

const LeadGeneration: React.FC<LeadGenerationProps> = ({ onLeadCreated }) => {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'capture' | 'campaigns' | 'analytics' | 'automation' | 'optimization'
  >('capture');
  const [campaigns, setCampaigns] = useState<LeadCampaign[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'website' as const,
    targetAudience: [] as string[],
    budget: 0,
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    loadCampaigns();
    loadAnalytics();
  }, []);

  const loadCampaigns = async () => {
    try {
      // Mock campaign data
      const mockCampaigns: LeadCampaign[] = [
        {
          id: '1',
          name: 'AI-Powered Website Capture',
          type: 'ai-powered',
          status: 'optimizing',
          targetAudience: ['residential', 'commercial'],
          conversionRate: 18.5,
          totalLeads: 156,
          qualifiedLeads: 89,
          revenue: 45000,
          cost: 2500,
          roi: 1700,
          startDate: '2024-01-01',
          aiOptimization: {
            enabled: true,
            autoAdjustBudget: true,
            smartTargeting: true,
            conversionOptimization: true,
          },
          performanceMetrics: {
            ctr: 3.2,
            cpc: 15.5,
            qualityScore: 92,
            avgLeadValue: 289,
          },
        },
        {
          id: '2',
          name: 'Smart Social Media',
          type: 'social-media',
          status: 'active',
          targetAudience: ['renovation', 'new-build'],
          conversionRate: 12.2,
          totalLeads: 89,
          qualifiedLeads: 45,
          revenue: 28000,
          cost: 1200,
          roi: 2233,
          startDate: '2024-01-15',
          aiOptimization: {
            enabled: true,
            autoAdjustBudget: false,
            smartTargeting: true,
            conversionOptimization: false,
          },
          performanceMetrics: {
            ctr: 2.8,
            cpc: 8.75,
            qualityScore: 85,
            avgLeadValue: 315,
          },
        },
        {
          id: '3',
          name: 'Automated Referral System',
          type: 'automated',
          status: 'active',
          targetAudience: ['residential'],
          conversionRate: 35.0,
          totalLeads: 34,
          qualifiedLeads: 28,
          revenue: 67000,
          cost: 500,
          roi: 13300,
          startDate: '2024-01-01',
          aiOptimization: {
            enabled: true,
            autoAdjustBudget: true,
            smartTargeting: true,
            conversionOptimization: true,
          },
          performanceMetrics: {
            ctr: 5.1,
            cpc: 2.25,
            qualityScore: 98,
            avgLeadValue: 425,
          },
        },
      ];
      setCampaigns(mockCampaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const analyticsData = await leadService.getLeadAnalytics();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Mock analytics data
      setAnalytics({
        total: 279,
        byStatus: {
          new: 45,
          contacted: 89,
          qualified: 67,
          'proposal-sent': 34,
          won: 23,
          lost: 21,
        },
        bySource: { website: 156, 'social-media': 89, referral: 34 },
        averageAIScore: 78.5,
        conversionRate: 8.2,
        monthlyTrend: [
          { month: 'Jan', count: 45 },
          { month: 'Feb', count: 67 },
          { month: 'Mar', count: 89 },
        ],
      });
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name.trim()) {
      Alert.alert('Error', 'Please enter a campaign name');
      return;
    }

    setLoading(true);
    try {
      const campaign: LeadCampaign = {
        id: Date.now().toString(),
        name: newCampaign.name,
        type: newCampaign.type,
        status: 'active',
        targetAudience: newCampaign.targetAudience,
        conversionRate: 0,
        totalLeads: 0,
        qualifiedLeads: 0,
        revenue: 0,
        cost: newCampaign.budget,
        roi: 0,
        startDate: new Date().toISOString(),
        aiOptimization: {
          enabled: false,
          autoAdjustBudget: false,
          smartTargeting: false,
          conversionOptimization: false,
        },
        performanceMetrics: {
          ctr: 0,
          cpc: 0,
          qualityScore: 0,
          avgLeadValue: 0,
        },
      };

      setCampaigns([...campaigns, campaign]);
      setNewCampaign({
        name: '',
        type: 'website',
        targetAudience: [],
        budget: 0,
      });
      setShowCampaignModal(false);
      Alert.alert('Success', 'Campaign created successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'website':
        return 'language';
      case 'social-media':
        return 'share';
      case 'referral':
        return 'people';
      case 'cold-outreach':
        return 'phone';
      case 'advertisement':
        return 'campaign';
      default:
        return 'campaign';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'paused':
        return '#FF9800';
      case 'completed':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const CampaignCard: React.FC<{ campaign: LeadCampaign }> = ({ campaign }) => (
    <TouchableOpacity
      style={[styles.campaignCard, { backgroundColor: cardColor, borderColor }]}
      onPress={() => {
        // Navigate to campaign details
      }}
    >
      <View style={styles.campaignHeader}>
        <View style={styles.campaignInfo}>
          <MaterialIcons
            name={getCampaignTypeIcon(campaign.type)}
            size={24}
            color={accentColor}
          />
          <View style={styles.campaignDetails}>
            <Text style={[styles.campaignName, { color: textColor }]}>
              {campaign.name}
            </Text>
            <Text style={[styles.campaignType, { color: textSecondaryColor }]}>
              {campaign.type.replace('-', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(campaign.status) },
          ]}
        >
          <Text style={styles.statusText}>{campaign.status}</Text>
        </View>
      </View>

      <View style={styles.campaignMetrics}>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: textColor }]}>
            {campaign.totalLeads}
          </Text>
          <Text style={[styles.metricLabel, { color: textSecondaryColor }]}>
            Total Leads
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: textColor }]}>
            {campaign.qualifiedLeads}
          </Text>
          <Text style={[styles.metricLabel, { color: textSecondaryColor }]}>
            Qualified
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: textColor }]}>
            {campaign.conversionRate}%
          </Text>
          <Text style={[styles.metricLabel, { color: textSecondaryColor }]}>
            Conversion
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: textColor }]}>
            ${campaign.roi.toLocaleString()}
          </Text>
          <Text style={[styles.metricLabel, { color: textSecondaryColor }]}>
            ROI
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const AnalyticsCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: string;
  }> = ({ title, value, subtitle, icon }) => (
    <View
      style={[
        styles.analyticsCard,
        { backgroundColor: cardColor, borderColor },
      ]}
    >
      {icon && (
        <MaterialIcons name={icon as any} size={24} color={accentColor} />
      )}
      <Text style={[styles.analyticsValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.analyticsTitle, { color: textColor }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.analyticsSubtitle, { color: textSecondaryColor }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const renderCaptureTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.captureHeader}>
        <Text style={[styles.captureTitle, { color: textColor }]}>
          Lead Capture Form
        </Text>
        <Text style={[styles.captureSubtitle, { color: textSecondaryColor }]}>
          AI-powered lead generation with smart qualifying questions
        </Text>
      </View>
      <LeadCaptureForm />
    </View>
  );

  const renderCampaignsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.campaignsHeader}>
        <Text style={[styles.campaignsTitle, { color: textColor }]}>
          Lead Campaigns
        </Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: accentColor }]}
          onPress={() => setShowCampaignModal(true)}
        >
          <MaterialIcons name='add' size={20} color='white' />
          <Text style={styles.createButtonText}>New Campaign</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.campaignsList}>
        {campaigns.map(campaign => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </ScrollView>

      {/* Create Campaign Modal */}
      <Modal
        visible={showCampaignModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowCampaignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                Create Campaign
              </Text>
              <TouchableOpacity onPress={() => setShowCampaignModal(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: backgroundColor,
                    color: textColor,
                    borderColor,
                  },
                ]}
                placeholder='Campaign Name'
                placeholderTextColor={textSecondaryColor}
                value={newCampaign.name}
                onChangeText={text =>
                  setNewCampaign({ ...newCampaign, name: text })
                }
              />

              <Text style={[styles.modalLabel, { color: textColor }]}>
                Campaign Type
              </Text>
              <View style={styles.typeSelector}>
                {[
                  'website',
                  'social-media',
                  'referral',
                  'cold-outreach',
                  'advertisement',
                ].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      { backgroundColor: backgroundColor, borderColor },
                      newCampaign.type === type && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() =>
                      setNewCampaign({ ...newCampaign, type: type as any })
                    }
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color:
                            newCampaign.type === type ? 'white' : textColor,
                        },
                      ]}
                    >
                      {type.replace('-', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: backgroundColor,
                    color: textColor,
                    borderColor,
                  },
                ]}
                placeholder='Budget (Optional)'
                placeholderTextColor={textSecondaryColor}
                value={newCampaign.budget.toString()}
                onChangeText={text =>
                  setNewCampaign({
                    ...newCampaign,
                    budget: parseInt(text) || 0,
                  })
                }
                keyboardType='numeric'
              />

              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  { backgroundColor: accentColor },
                ]}
                onPress={handleCreateCampaign}
                disabled={loading}
              >
                <Text style={styles.modalSubmitButtonText}>
                  {loading ? 'Creating...' : 'Create Campaign'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.analyticsHeader}>
        <Text style={[styles.analyticsTitle, { color: textColor }]}>
          Lead Analytics
        </Text>
        <Text style={[styles.analyticsSubtitle, { color: textSecondaryColor }]}>
          Performance insights and conversion metrics
        </Text>
      </View>

      <ScrollView style={styles.analyticsGrid}>
        <View style={styles.analyticsRow}>
          <AnalyticsCard
            title='Total Leads'
            value={analytics?.total || 0}
            icon='people'
          />
          <AnalyticsCard
            title='Conversion Rate'
            value={`${analytics?.conversionRate || 0}%`}
            icon='trending-up'
          />
        </View>

        <View style={styles.analyticsRow}>
          <AnalyticsCard
            title='Avg AI Score'
            value={analytics?.averageAIScore || 0}
            subtitle='Lead quality'
            icon='psychology'
          />
          <AnalyticsCard
            title='Revenue'
            value={`$${(analytics?.total * 2500 || 0).toLocaleString()}`}
            subtitle='Estimated'
            icon='attach-money'
          />
        </View>

        {analytics?.byStatus && (
          <View style={styles.statusBreakdown}>
            <Text style={[styles.breakdownTitle, { color: textColor }]}>
              Lead Status Breakdown
            </Text>
            {Object.entries(analytics.byStatus).map(([status, count]) => (
              <View key={status} style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: textColor }]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                <Text style={[styles.statusCount, { color: textColor }]}>
                  {count}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderAutomationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.analyticsHeader}>
        <Text style={[styles.analyticsTitle, { color: textColor }]}>
          Lead Automation
        </Text>
        <Text style={[styles.analyticsSubtitle, { color: textSecondaryColor }]}>
          AI-powered automation workflows
        </Text>
      </View>

      <ScrollView style={styles.analyticsGrid}>
        <View
          style={[styles.section, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            🤖 AI Automation Features
          </Text>
          <View style={styles.automationFeatures}>
            <View style={styles.automationFeature}>
              <MaterialIcons name='smart-toy' size={24} color='#4CAF50' />
              <Text style={[styles.automationText, { color: textColor }]}>
                Smart Lead Scoring
              </Text>
            </View>
            <View style={styles.automationFeature}>
              <MaterialIcons name='auto-awesome' size={24} color='#2196F3' />
              <Text style={[styles.automationText, { color: textColor }]}>
                Auto Follow-ups
              </Text>
            </View>
            <View style={styles.automationFeature}>
              <MaterialIcons name='psychology' size={24} color='#FF9800' />
              <Text style={[styles.automationText, { color: textColor }]}>
                Predictive Analytics
              </Text>
            </View>
            <View style={styles.automationFeature}>
              <MaterialIcons name='trending-up' size={24} color='#9C27B0' />
              <Text style={[styles.automationText, { color: textColor }]}>
                Performance Optimization
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderOptimizationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.analyticsHeader}>
        <Text style={[styles.analyticsTitle, { color: textColor }]}>
          AI Optimization
        </Text>
        <Text style={[styles.analyticsSubtitle, { color: textSecondaryColor }]}>
          Machine learning campaign optimization
        </Text>
      </View>

      <ScrollView style={styles.analyticsGrid}>
        <View
          style={[styles.section, { backgroundColor: cardColor, borderColor }]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            🎯 Optimization Strategies
          </Text>
          <View style={styles.optimizationFeatures}>
            <View style={styles.optimizationFeature}>
              <MaterialIcons name='target' size={24} color='#4CAF50' />
              <Text style={[styles.optimizationText, { color: textColor }]}>
                Smart Targeting
              </Text>
            </View>
            <View style={styles.optimizationFeature}>
              <MaterialIcons name='attach-money' size={24} color='#2196F3' />
              <Text style={[styles.optimizationText, { color: textColor }]}>
                Budget Optimization
              </Text>
            </View>
            <View style={styles.optimizationFeature}>
              <MaterialIcons name='speed' size={24} color='#FF9800' />
              <Text style={[styles.optimizationText, { color: textColor }]}>
                Conversion Optimization
              </Text>
            </View>
            <View style={styles.optimizationFeature}>
              <MaterialIcons name='analytics' size={24} color='#9C27B0' />
              <Text style={[styles.optimizationText, { color: textColor }]}>
                Performance Analytics
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Lead Generation
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          AI-powered lead capture and campaign management
        </Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'capture', label: 'Capture', icon: 'add-circle' },
          { key: 'campaigns', label: 'Campaigns', icon: 'campaign' },
          { key: 'analytics', label: 'Analytics', icon: 'analytics' },
          { key: 'automation', label: 'Automation', icon: 'auto-awesome' },
          { key: 'optimization', label: 'AI Optimize', icon: 'psychology' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              { backgroundColor: cardColor, borderColor },
              activeTab === tab.key && { backgroundColor: accentColor },
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? 'white' : textColor}
            />
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === tab.key ? 'white' : textColor },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'capture' && renderCaptureTab()}
      {activeTab === 'campaigns' && renderCampaignsTab()}
      {activeTab === 'analytics' && renderAnalyticsTab()}
      {activeTab === 'automation' && renderAutomationTab()}
      {activeTab === 'optimization' && renderOptimizationTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  tabContent: {
    flex: 1,
  },
  captureHeader: {
    marginBottom: 20,
  },
  captureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  captureSubtitle: {
    fontSize: 14,
  },
  campaignsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  campaignsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  campaignsList: {
    flex: 1,
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
    marginBottom: 12,
  },
  campaignInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  campaignDetails: {
    marginLeft: 12,
    flex: 1,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  campaignType: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  campaignMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  modalInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 12,
  },
  modalSubmitButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  analyticsHeader: {
    marginBottom: 20,
  },
  analyticsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  analyticsSubtitle: {
    fontSize: 14,
  },
  analyticsGrid: {
    flex: 1,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  analyticsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  analyticsSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  statusBreakdown: {
    marginTop: 20,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusLabel: {
    fontSize: 14,
  },
  statusCount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  automationFeatures: {
    gap: 12,
  },
  automationFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
    borderRadius: 8,
  },
  automationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optimizationFeatures: {
    gap: 12,
  },
  optimizationFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
    borderRadius: 8,
  },
  optimizationText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LeadGeneration;
