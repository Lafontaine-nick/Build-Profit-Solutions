import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';

interface AIAnalysis {
  leadScore: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    reasoning: string;
    factors: string[];
    confidence: number;
  };
  quoteEmail: {
    subject: string;
    body: string;
    personalizedGreeting: string;
    projectSummary: string;
    pricingBreakdown: string;
    timeline: string;
    callToAction: string;
    signature: string;
  };
  pricingSuggestion: {
    basePrice: number;
    markupPercentage: number;
    finalPrice: number;
    markupReasons: string[];
    marketAnalysis: string;
    competitorPricing: string;
    riskFactors: string[];
  };
  marketInsights: {
    localDemand: 'high' | 'medium' | 'low';
    seasonality: string;
    competitorActivity: string;
    marketTrends: string[];
    pricingRecommendations: string[];
  };
  predictiveAnalytics: {
    conversionProbability: number;
    timeToClose: string;
    nextBestAction: string;
    followUpSchedule: string[];
    riskAssessment: string;
    opportunityValue: number;
  };
  smartRecommendations: {
    actions: string[];
    improvements: string[];
    opportunities: string[];
    alerts: string[];
  };
}

interface AIAddonsProps {
  lead?: Lead;
  onScoreGenerated?: (score: AIAnalysis['leadScore']) => void;
  onQuoteGenerated?: (quote: AIAnalysis['quoteEmail']) => void;
  onPricingGenerated?: (pricing: AIAnalysis['pricingSuggestion']) => void;
}

const AIAddons: React.FC<AIAddonsProps> = ({
  lead,
  onScoreGenerated,
  onQuoteGenerated,
  onPricingGenerated,
}) => {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    | 'scoring'
    | 'quotes'
    | 'pricing'
    | 'insights'
    | 'predictive'
    | 'recommendations'
  >('scoring');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const [similarLeads, setSimilarLeads] = useState<Lead[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiConfidence, setAiConfidence] = useState(85);

  // Define colors based on theme
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const accentColor = '#4CAF50';

  useEffect(() => {
    if (lead) {
      generateAIAnalysis();
      loadSimilarLeads();
    }
  }, [lead]);

  const loadSimilarLeads = async () => {
    try {
      const leads = await leadService.getLeads();
      const similar = leads
        .filter(
          l =>
            l.projectType === lead?.projectType ||
            l.budget?.max === lead?.budget?.max
        )
        .slice(0, 3);
      setSimilarLeads(similar);
    } catch (error) {
      console.error('Error loading similar leads:', error);
    }
  };

  const generateAIAnalysis = async () => {
    if (!lead) return;

    setLoading(true);
    try {
      // Simulate AI analysis with realistic data
      const mockAnalysis: AIAnalysis = {
        leadScore: {
          score: 87,
          grade: 'A',
          reasoning:
            'This lead shows strong conversion potential with clear project scope, realistic budget, and immediate timeline. The client has provided detailed requirements and shows urgency.',
          factors: [
            'Clear project scope and requirements',
            'Realistic budget range for project type',
            'Immediate timeline indicates urgency',
            'Detailed contact information provided',
            'Professional company background',
          ],
          confidence: 92,
        },
        quoteEmail: {
          subject: 'Your Kitchen Remodel Quote - Ready for Review',
          body: `Dear Sarah,

Thank you for your interest in your kitchen remodel project. I've analyzed your requirements and prepared a comprehensive quote that addresses your vision for a modern, functional kitchen.

PROJECT SUMMARY:
Complete kitchen renovation including:
• Custom cabinets with modern hardware
• Quartz countertops with waterfall edge
• Stainless steel appliances package
• LED under-cabinet lighting
• New flooring and backsplash

PRICING BREAKDOWN:
Materials & Labor: $28,500
Appliances Package: $8,200
Custom Features: $3,800
Project Management: $2,500
Total Investment: $43,000

TIMELINE:
• Week 1-2: Demolition and prep work
• Week 3-6: Cabinet installation and countertops
• Week 7-8: Appliance installation and finishing
• Total Duration: 8 weeks

NEXT STEPS:
I'd love to schedule a consultation to discuss the details and answer any questions. Would you be available for a 30-minute call this week?

Best regards,
[Your Name]
[Company Name]`,
          personalizedGreeting: 'Dear Sarah,',
          projectSummary:
            'Complete kitchen renovation with modern appliances and custom cabinets',
          pricingBreakdown:
            'Materials & Labor: $28,500 | Appliances: $8,200 | Custom Features: $3,800 | Total: $43,000',
          timeline: '8 weeks total duration with detailed weekly milestones',
          callToAction: 'Schedule a 30-minute consultation call this week',
          signature: '[Your Name] | [Company Name]',
        },
        pricingSuggestion: {
          basePrice: 28500,
          markupPercentage: 15,
          finalPrice: 43000,
          markupReasons: [
            'Premium materials and craftsmanship',
            'Complex project with custom features',
            'Competitive market positioning',
            'Comprehensive warranty coverage',
          ],
          marketAnalysis:
            'Kitchen remodels in Salt Lake City area average $35K-$50K. Your project falls within the premium range due to custom features and high-end materials.',
          competitorPricing:
            'Local competitors range from $32K-$48K for similar projects. Your pricing is competitive while maintaining quality margins.',
          riskFactors: [
            'Material cost fluctuations',
            'Potential scope creep',
            'Weather delays for material delivery',
          ],
        },
        marketInsights: {
          localDemand: 'high',
          seasonality:
            'Spring and summer are peak seasons for kitchen remodels in Utah. Current timing is optimal for project completion.',
          competitorActivity:
            '3 active competitors in your area with similar project types. Market is competitive but not oversaturated.',
          marketTrends: [
            'Growing demand for modern, open-concept kitchens',
            'Increased preference for quartz countertops',
            'Rising material costs affecting project budgets',
            'Strong interest in smart home integration',
          ],
          pricingRecommendations: [
            'Consider offering flexible payment options',
            'Highlight warranty and quality guarantees',
            'Emphasize energy-efficient appliance options',
            'Offer design consultation as value-add',
          ],
        },
        predictiveAnalytics: {
          conversionProbability: 78,
          timeToClose: '2-3 weeks',
          nextBestAction: 'Schedule in-person consultation within 48 hours',
          followUpSchedule: [
            'Day 1: Send detailed quote and schedule consultation',
            'Day 3: Follow up with project timeline questions',
            'Day 7: Share portfolio of similar projects',
            'Day 14: Offer site visit and detailed planning session',
          ],
          riskAssessment:
            'Medium risk due to budget constraints and timeline pressure. Recommend clear communication and milestone-based payments.',
          opportunityValue: 43000,
        },
        smartRecommendations: {
          actions: [
            'Schedule consultation within 48 hours',
            'Prepare portfolio of similar kitchen projects',
            'Create detailed project timeline with milestones',
            'Develop flexible payment plan options',
          ],
          improvements: [
            'Add more detailed project specifications',
            'Include material samples in presentation',
            'Create 3D visualization of final design',
            'Develop comprehensive warranty package',
          ],
          opportunities: [
            'Upsell to include smart home features',
            'Offer maintenance package for appliances',
            'Recommend additional storage solutions',
            'Suggest energy-efficient upgrades',
          ],
          alerts: [
            'Budget is at upper limit - monitor scope carefully',
            'Timeline is aggressive - ensure resource availability',
            'Competition is active - emphasize unique value propositions',
            'Material costs may fluctuate - include contingency',
          ],
        },
      };

      setAnalysis(mockAnalysis);
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      Alert.alert('Error', 'Failed to generate AI analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabPress = (tab: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    setActiveTab(tab as any);
  };

  const handleAdvancedOptions = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    setShowAdvancedOptions(!showAdvancedOptions);
  };

  const handleCustomPrompt = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    Alert.alert(
      'Custom AI Prompt',
      'Enter your custom prompt for AI analysis:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            Alert.alert('Custom Analysis', 'Generating custom AI analysis...');
            // TODO: Implement custom prompt analysis
          },
        },
      ]
    );
  };

  const handleGenerateScore = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (analysis && onScoreGenerated) {
        onScoreGenerated(analysis.leadScore);
        Alert.alert('Success', 'Lead score generated and saved successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate score. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuote = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (analysis && onQuoteGenerated) {
        onQuoteGenerated(analysis.quoteEmail);
        Alert.alert('Success', 'Quote email generated and saved successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePricing = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (analysis && onPricingGenerated) {
        onPricingGenerated(analysis.pricingSuggestion);
        Alert.alert(
          'Success',
          'Pricing suggestion generated and saved successfully!'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate pricing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return '#4CAF50';
      case 'B':
        return '#8BC34A';
      case 'C':
        return '#FFC107';
      case 'D':
        return '#FF9800';
      case 'E':
        return '#F44336';
      case 'F':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  const getDemandColor = (demand: string) => {
    switch (demand) {
      case 'high':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return '#4CAF50';
    if (probability >= 60) return '#8BC34A';
    if (probability >= 40) return '#FFC107';
    return '#F44336';
  };

  const renderScoringTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <View style={styles.sectionHeader}>
              <MaterialIcons name='psychology' size={24} color={accentColor} />
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                AI Lead Scoring
              </Text>
              <View
                style={[
                  styles.confidenceBadge,
                  { backgroundColor: getGradeColor(analysis.leadScore.grade) },
                ]}
              >
                <Text style={styles.confidenceBadgeText}>
                  {analysis.leadScore.confidence}%
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              GPT-powered analysis of lead quality and conversion probability
            </Text>

            <View style={styles.scoreDisplay}>
              <View
                style={[
                  styles.scoreCircle,
                  { backgroundColor: getGradeColor(analysis.leadScore.grade) },
                ]}
              >
                <Text style={styles.scoreText}>{analysis.leadScore.score}</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={[styles.gradeText, { color: textColor }]}>
                  Grade: {analysis.leadScore.grade}
                </Text>
                <Text
                  style={[styles.confidenceText, { color: textSecondaryColor }]}
                >
                  Confidence: {analysis.leadScore.confidence}%
                </Text>
                <Text
                  style={[styles.scoreLabel, { color: textSecondaryColor }]}
                >
                  Excellent Lead Quality
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Scoring Reasoning
            </Text>
            <Text style={[styles.reasoningText, { color: textColor }]}>
              {analysis.leadScore.reasoning}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Key Factors
            </Text>
            {analysis.leadScore.factors.map((factor, index) => (
              <View key={index} style={styles.factorItem}>
                <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
                <Text style={[styles.factorText, { color: textColor }]}>
                  {factor}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: accentColor }]}
            onPress={handleGenerateScore}
            disabled={loading}
            activeOpacity={0.7}
          >
            <MaterialIcons name='save' size={20} color='white' />
            <Text style={styles.generateButtonText}>
              {loading ? 'Generating...' : 'Generate & Save Score'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  const renderQuotesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <View style={styles.sectionHeader}>
              <MaterialIcons name='email' size={24} color={accentColor} />
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                AI Quote Email
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (error) {
                    console.log('Haptic feedback not available');
                  }
                  Alert.alert('Email Actions', 'What would you like to do?', [
                    {
                      text: 'Send Email',
                      onPress: () =>
                        Alert.alert('Send', 'Sending quote email...'),
                    },
                    {
                      text: 'Save Draft',
                      onPress: () => Alert.alert('Save', 'Saving as draft...'),
                    },
                    {
                      text: 'Edit Email',
                      onPress: () =>
                        Alert.alert('Edit', 'Opening email editor...'),
                    },
                    {
                      text: 'Copy Text',
                      onPress: () => Alert.alert('Copy', 'Email text copied!'),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name='more-vert' size={20} color='white' />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              GPT-generated personalized quote email with project details
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Email Subject
            </Text>
            <Text style={[styles.emailSubject, { color: textColor }]}>
              {analysis.quoteEmail.subject}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Email Preview
            </Text>
            <ScrollView style={styles.emailPreview}>
              <Text style={[styles.emailText, { color: textColor }]}>
                {analysis.quoteEmail.body}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.previewActionButton,
                { backgroundColor: '#4CAF50' },
              ]}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (error) {
                  console.log('Haptic feedback not available');
                }
                Alert.alert('Preview Actions', 'What would you like to do?', [
                  {
                    text: 'Full Preview',
                    onPress: () =>
                      Alert.alert('Preview', 'Opening full email preview...'),
                  },
                  {
                    text: 'Edit Content',
                    onPress: () =>
                      Alert.alert('Edit', 'Opening content editor...'),
                  },
                  {
                    text: 'Test Send',
                    onPress: () => Alert.alert('Test', 'Sending test email...'),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name='visibility' size={16} color='white' />
              <Text style={styles.previewActionText}>Preview Actions</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Email Components
            </Text>
            <View style={styles.emailComponents}>
              <View style={styles.componentItem}>
                <Text
                  style={[styles.componentLabel, { color: textSecondaryColor }]}
                >
                  Greeting:
                </Text>
                <Text style={[styles.componentText, { color: textColor }]}>
                  {analysis.quoteEmail.personalizedGreeting}
                </Text>
              </View>
              <View style={styles.componentItem}>
                <Text
                  style={[styles.componentLabel, { color: textSecondaryColor }]}
                >
                  Summary:
                </Text>
                <Text style={[styles.componentText, { color: textColor }]}>
                  {analysis.quoteEmail.projectSummary}
                </Text>
              </View>
              <View style={styles.componentItem}>
                <Text
                  style={[styles.componentLabel, { color: textSecondaryColor }]}
                >
                  Pricing:
                </Text>
                <Text style={[styles.componentText, { color: textColor }]}>
                  {analysis.quoteEmail.pricingBreakdown}
                </Text>
              </View>
              <View style={styles.componentItem}>
                <Text
                  style={[styles.componentLabel, { color: textSecondaryColor }]}
                >
                  Timeline:
                </Text>
                <Text style={[styles.componentText, { color: textColor }]}>
                  {analysis.quoteEmail.timeline}
                </Text>
              </View>
              <View style={styles.componentItem}>
                <Text
                  style={[styles.componentLabel, { color: textSecondaryColor }]}
                >
                  Call to Action:
                </Text>
                <Text style={[styles.componentText, { color: textColor }]}>
                  {analysis.quoteEmail.callToAction}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: accentColor }]}
            onPress={handleGenerateQuote}
            disabled={loading}
            activeOpacity={0.7}
          >
            <MaterialIcons name='email' size={20} color='white' />
            <Text style={styles.generateButtonText}>
              {loading ? 'Generating...' : 'Generate & Save Quote'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <View style={styles.sectionHeader}>
              <MaterialIcons
                name='attach-money'
                size={24}
                color={accentColor}
              />
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                AI Pricing Suggestion
              </Text>
              <View
                style={[styles.pricingBadge, { backgroundColor: '#FF9800' }]}
              >
                <Text style={styles.pricingBadgeText}>
                  ${analysis.pricingSuggestion.finalPrice.toLocaleString()}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              AI-optimized pricing with market analysis and competitor insights
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Pricing Breakdown
            </Text>
            <View style={styles.pricingBreakdown}>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textColor }]}>
                  Base Price:
                </Text>
                <Text style={[styles.priceValue, { color: textColor }]}>
                  ${analysis.pricingSuggestion.basePrice.toLocaleString()}
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: textColor }]}>
                  Markup ({analysis.pricingSuggestion.markupPercentage}%):
                </Text>
                <Text style={[styles.priceValue, { color: textColor }]}>
                  $
                  {(
                    analysis.pricingSuggestion.finalPrice -
                    analysis.pricingSuggestion.basePrice
                  ).toLocaleString()}
                </Text>
              </View>
              <View
                style={[styles.finalPriceRow, { borderTopColor: borderColor }]}
              >
                <Text
                  style={[
                    styles.priceLabel,
                    { color: textColor, fontWeight: 'bold' },
                  ]}
                >
                  Final Price:
                </Text>
                <Text
                  style={[
                    styles.priceValue,
                    { color: accentColor, fontWeight: 'bold', fontSize: 18 },
                  ]}
                >
                  ${analysis.pricingSuggestion.finalPrice.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Markup Justification
            </Text>
            {analysis.pricingSuggestion.markupReasons.map((reason, index) => (
              <View key={index} style={styles.markupItem}>
                <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
                <Text style={[styles.markupText, { color: textColor }]}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Market Analysis
            </Text>
            <Text style={[styles.marketText, { color: textColor }]}>
              {analysis.pricingSuggestion.marketAnalysis}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Competitor Pricing
            </Text>
            <Text style={[styles.marketText, { color: textColor }]}>
              {analysis.pricingSuggestion.competitorPricing}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Risk Factors
            </Text>
            {analysis.pricingSuggestion.riskFactors.map((risk, index) => (
              <View key={index} style={styles.riskItem}>
                <MaterialIcons name='warning' size={16} color='#FF9800' />
                <Text style={[styles.riskText, { color: textColor }]}>
                  {risk}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: accentColor }]}
            onPress={handleGeneratePricing}
            disabled={loading}
            activeOpacity={0.7}
          >
            <MaterialIcons name='attach-money' size={20} color='white' />
            <Text style={styles.generateButtonText}>
              {loading ? 'Generating...' : 'Generate & Save Pricing'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: '#2196F3', borderColor },
            ]}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (error) {
                console.log('Haptic feedback not available');
              }
              Alert.alert('Pricing Actions', 'What would you like to do?', [
                {
                  text: 'Adjust Pricing',
                  onPress: () =>
                    Alert.alert('Adjust', 'Opening pricing calculator...'),
                },
                {
                  text: 'View Competitors',
                  onPress: () =>
                    Alert.alert(
                      'Competitors',
                      'Loading competitor analysis...'
                    ),
                },
                {
                  text: 'Export Quote',
                  onPress: () =>
                    Alert.alert('Export', 'Generating PDF quote...'),
                },
                {
                  text: 'Send to Client',
                  onPress: () =>
                    Alert.alert('Send', 'Sending pricing to client...'),
                },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name='more-horiz' size={20} color='white' />
            <Text style={styles.secondaryButtonText}>Pricing Actions</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  const renderInsightsTab = () => (
    <ScrollView style={styles.tabContent}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Market Insights
            </Text>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              AI-powered market analysis and trends
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Local Demand
            </Text>
            <View style={styles.demandDisplay}>
              <View
                style={[
                  styles.demandBadge,
                  {
                    backgroundColor: getDemandColor(
                      analysis.marketInsights.localDemand
                    ),
                  },
                ]}
              >
                <Text style={styles.demandText}>
                  {analysis.marketInsights.localDemand.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.seasonalityText, { color: textColor }]}>
                {analysis.marketInsights.seasonality}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Market Trends
            </Text>
            {analysis.marketInsights.marketTrends.map((trend, index) => (
              <View key={index} style={styles.trendItem}>
                <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
                <Text style={[styles.trendText, { color: textColor }]}>
                  {trend}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Pricing Recommendations
            </Text>
            {analysis.marketInsights.pricingRecommendations.map(
              (recommendation, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <MaterialIcons name='lightbulb' size={16} color='#FFC107' />
                  <Text
                    style={[styles.recommendationText, { color: textColor }]}
                  >
                    {recommendation}
                  </Text>
                </View>
              )
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Competitor Activity
            </Text>
            <Text style={[styles.marketText, { color: textColor }]}>
              {analysis.marketInsights.competitorActivity}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderPredictiveTab = () => (
    <ScrollView style={styles.tabContent}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Predictive Analytics
            </Text>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              AI-powered predictions for lead conversion and timeline
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Conversion Probability
            </Text>
            <View style={styles.probabilityDisplay}>
              <View
                style={[
                  styles.probabilityCircle,
                  {
                    backgroundColor: getProbabilityColor(
                      analysis.predictiveAnalytics.conversionProbability
                    ),
                  },
                ]}
              >
                <Text style={styles.probabilityText}>
                  {analysis.predictiveAnalytics.conversionProbability}%
                </Text>
              </View>
              <View style={styles.probabilityInfo}>
                <Text style={[styles.probabilityLabel, { color: textColor }]}>
                  Likely to Convert
                </Text>
                <Text
                  style={[styles.timeToClose, { color: textSecondaryColor }]}
                >
                  Time to Close: {analysis.predictiveAnalytics.timeToClose}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Next Best Action
            </Text>
            <View style={styles.actionCard}>
              <MaterialIcons name='schedule' size={24} color={accentColor} />
              <Text style={[styles.actionText, { color: textColor }]}>
                {analysis.predictiveAnalytics.nextBestAction}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Follow-up Schedule
            </Text>
            {analysis.predictiveAnalytics.followUpSchedule.map(
              (step, index) => (
                <View key={index} style={styles.scheduleItem}>
                  <View
                    style={[
                      styles.scheduleDot,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <Text style={[styles.scheduleText, { color: textColor }]}>
                    {step}
                  </Text>
                </View>
              )
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Risk Assessment
            </Text>
            <Text style={[styles.riskAssessmentText, { color: textColor }]}>
              {analysis.predictiveAnalytics.riskAssessment}
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Opportunity Value
            </Text>
            <Text style={[styles.opportunityValue, { color: accentColor }]}>
              ${analysis.predictiveAnalytics.opportunityValue.toLocaleString()}
            </Text>
            <Text
              style={[styles.opportunityLabel, { color: textSecondaryColor }]}
            >
              Potential project value
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderRecommendationsTab = () => (
    <ScrollView style={styles.tabContent}>
      {analysis && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Smart Recommendations
            </Text>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              AI-powered suggestions to improve your lead conversion
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Recommended Actions
            </Text>
            {analysis.smartRecommendations.actions.map((action, index) => (
              <View key={index} style={styles.recommendationItem}>
                <MaterialIcons name='play-arrow' size={16} color='#4CAF50' />
                <Text style={[styles.recommendationText, { color: textColor }]}>
                  {action}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Improvement Opportunities
            </Text>
            {analysis.smartRecommendations.improvements.map(
              (improvement, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <MaterialIcons name='build' size={16} color='#FF9800' />
                  <Text
                    style={[styles.recommendationText, { color: textColor }]}
                  >
                    {improvement}
                  </Text>
                </View>
              )
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Upsell Opportunities
            </Text>
            {analysis.smartRecommendations.opportunities.map(
              (opportunity, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <MaterialIcons name='trending-up' size={16} color='#2196F3' />
                  <Text
                    style={[styles.recommendationText, { color: textColor }]}
                  >
                    {opportunity}
                  </Text>
                </View>
              )
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Important Alerts
            </Text>
            {analysis.smartRecommendations.alerts.map((alert, index) => (
              <View key={index} style={styles.alertItem}>
                <MaterialIcons name='warning' size={16} color='#F44336' />
                <Text style={[styles.alertText, { color: textColor }]}>
                  {alert}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Similar Leads
            </Text>
            <Text
              style={[styles.sectionDescription, { color: textSecondaryColor }]}
            >
              AI-identified similar leads for reference
            </Text>
            {similarLeads.map(similarLead => (
              <View key={similarLead.id} style={styles.similarLeadItem}>
                <Text style={[styles.similarLeadName, { color: textColor }]}>
                  {similarLead.name}
                </Text>
                <Text
                  style={[
                    styles.similarLeadProject,
                    { color: textSecondaryColor },
                  ]}
                >
                  {similarLead.projectType} - {similarLead.status}
                </Text>
                <Text style={[styles.similarLeadValue, { color: accentColor }]}>
                  ${similarLead.budget.max.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>AI Addons</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          GPT-powered lead analysis and optimization
        </Text>

        <TouchableOpacity
          style={[
            styles.advancedButton,
            {
              backgroundColor: showAdvancedOptions ? accentColor : cardColor,
              borderColor,
            },
          ]}
          onPress={handleAdvancedOptions}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={showAdvancedOptions ? 'expand-less' : 'expand-more'}
            size={20}
            color={showAdvancedOptions ? 'white' : textColor}
          />
          <Text
            style={[
              styles.advancedButtonText,
              { color: showAdvancedOptions ? 'white' : textColor },
            ]}
          >
            Advanced Options
          </Text>
        </TouchableOpacity>

        {showAdvancedOptions && (
          <View
            style={[
              styles.advancedOptions,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <Text style={[styles.advancedTitle, { color: textColor }]}>
              AI Configuration
            </Text>
            <View style={styles.advancedRow}>
              <Text
                style={[styles.advancedLabel, { color: textSecondaryColor }]}
              >
                AI Confidence:
              </Text>
              <Text style={[styles.advancedValue, { color: textColor }]}>
                {aiConfidence}%
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.customPromptButton,
                { backgroundColor: '#2196F3' },
              ]}
              onPress={handleCustomPrompt}
              activeOpacity={0.7}
            >
              <MaterialIcons name='edit' size={16} color='white' />
              <Text style={styles.customPromptText}>Custom Prompt</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'scoring', label: 'Scoring', icon: 'psychology' },
          { key: 'quotes', label: 'Quotes', icon: 'email' },
          { key: 'pricing', label: 'Pricing', icon: 'attach-money' },
          { key: 'insights', label: 'Insights', icon: 'analytics' },
          { key: 'predictive', label: 'Predictive', icon: 'trending-up' },
          { key: 'recommendations', label: 'Smart', icon: 'lightbulb' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              { backgroundColor: cardColor, borderColor },
              activeTab === tab.key && { backgroundColor: accentColor },
            ]}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={16}
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

      {activeTab === 'scoring' && renderScoringTab()}
      {activeTab === 'quotes' && renderQuotesTab()}
      {activeTab === 'pricing' && renderPricingTab()}
      {activeTab === 'insights' && renderInsightsTab()}
      {activeTab === 'predictive' && renderPredictiveTab()}
      {activeTab === 'recommendations' && renderRecommendationsTab()}
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
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  advancedButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  advancedOptions: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  advancedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  advancedLabel: {
    fontSize: 14,
  },
  advancedValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  customPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  customPromptText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreInfo: {
    flex: 1,
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceText: {
    fontSize: 14,
  },
  scoreLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  reasoningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  factorText: {
    fontSize: 14,
    flex: 1,
  },
  emailSubject: {
    fontSize: 16,
    fontWeight: '600',
    padding: 12,
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
    borderRadius: 8,
  },
  emailPreview: {
    maxHeight: 200,
  },
  emailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emailComponents: {
    gap: 12,
  },
  componentItem: {
    marginBottom: 8,
  },
  componentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  componentText: {
    fontSize: 14,
  },
  pricingBreakdown: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  finalPriceRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  markupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  markupText: {
    fontSize: 14,
    flex: 1,
  },
  marketText: {
    fontSize: 14,
    lineHeight: 20,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  riskText: {
    fontSize: 14,
    flex: 1,
  },
  demandDisplay: {
    alignItems: 'center',
    gap: 8,
  },
  demandBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  demandText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  seasonalityText: {
    fontSize: 14,
    textAlign: 'center',
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  trendText: {
    fontSize: 14,
    flex: 1,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  recommendationText: {
    fontSize: 14,
    flex: 1,
  },
  probabilityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  probabilityCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probabilityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  probabilityInfo: {
    flex: 1,
  },
  probabilityLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeToClose: {
    fontSize: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scheduleText: {
    fontSize: 14,
    flex: 1,
  },
  riskAssessmentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  opportunityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  opportunityLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    flex: 1,
  },
  similarLeadItem: {
    padding: 12,
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  similarLeadName: {
    fontSize: 16,
    fontWeight: '600',
  },
  similarLeadProject: {
    fontSize: 14,
    marginTop: 2,
  },
  similarLeadValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    padding: 8,
    borderRadius: 16,
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  previewActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pricingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricingBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AIAddons;
