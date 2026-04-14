import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';

interface LeadIntakeData {
  // Basic Information
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;

  // Project Details
  projectType:
    | 'residential'
    | 'commercial'
    | 'renovation'
    | 'new-build'
    | 'maintenance';
  projectSize: 'small' | 'medium' | 'large';
  projectDescription: string;

  // Budget & Timeline
  budgetMin: number;
  budgetMax: number;
  timeline: 'asap' | 'within_week' | 'within_month' | 'planning_ahead';
  urgency: 'low' | 'medium' | 'high';

  // Property Details
  propertyType:
    | 'single-family'
    | 'multi-family'
    | 'condo'
    | 'commercial'
    | 'industrial';
  squareFootage: number;
  propertyAge: 'new' | '1-5_years' | '6-15_years' | '16-30_years' | '30+_years';

  // Project Requirements
  requirements: string[];
  specialFeatures: string[];
  mustHaves: string[];
  niceToHaves: string[];

  // Contact Preferences
  preferredContact: 'phone' | 'email' | 'text';
  bestTimeToContact: 'morning' | 'afternoon' | 'evening' | 'anytime';
  availability: string;

  // Additional Information
  financing: 'cash' | 'loan' | 'credit' | 'undecided';
  previousExperience: boolean;
  referralSource:
    | 'website'
    | 'referral'
    | 'social-media'
    | 'advertisement'
    | 'other';
  additionalNotes: string;
}

interface AIScore {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  confidence: number;
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  recommendations: string[];
  riskFactors: string[];
  urgency: 'high' | 'medium' | 'low';
  conversionProbability: number;
}

const AIScoredLeadIntake: React.FC = () => {
  const { darkMode } = useTheme();
  const [formData, setFormData] = useState<LeadIntakeData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    projectType: 'residential',
    projectSize: 'medium',
    projectDescription: '',
    budgetMin: 0,
    budgetMax: 0,
    timeline: 'planning_ahead',
    urgency: 'medium',
    propertyType: 'single-family',
    squareFootage: 0,
    propertyAge: '6-15_years',
    requirements: [],
    specialFeatures: [],
    mustHaves: [],
    niceToHaves: [],
    preferredContact: 'phone',
    bestTimeToContact: 'anytime',
    availability: '',
    financing: 'undecided',
    previousExperience: false,
    referralSource: 'website',
    additionalNotes: '',
  });

  const [aiScore, setAiScore] = useState<AIScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [formProgress, setFormProgress] = useState(0);

  // Define colors based on theme
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    calculateFormProgress();
    if (formProgress > 30) {
      generateAIScore();
    }
  }, [formData]);

  const calculateFormProgress = () => {
    const totalFields = 20;
    let completedFields = 0;

    if (formData.name) completedFields++;
    if (formData.email) completedFields++;
    if (formData.phone) completedFields++;
    if (formData.address) completedFields++;
    if (formData.city) completedFields++;
    if (formData.state) completedFields++;
    if (formData.zipCode) completedFields++;
    if (formData.projectDescription) completedFields++;
    if (formData.budgetMin > 0) completedFields++;
    if (formData.budgetMax > 0) completedFields++;
    if (formData.squareFootage > 0) completedFields++;
    if (formData.requirements.length > 0) completedFields++;
    if (formData.mustHaves.length > 0) completedFields++;
    if (formData.availability) completedFields++;
    if (formData.additionalNotes) completedFields++;
    if (formData.previousExperience !== undefined) completedFields++;
    if (formData.financing !== 'undecided') completedFields++;
    if (formData.referralSource) completedFields++;
    if (formData.timeline) completedFields++;

    setFormProgress((completedFields / totalFields) * 100);
  };

  const generateAIScore = async () => {
    if (formProgress < 30) return;

    setLoading(true);
    try {
      // Mock AI scoring - in real app, this would call GPT API
      const mockScore: AIScore = {
        overallScore: calculateMockScore(),
        grade: calculateGrade(),
        confidence: Math.min(formProgress, 95),
        factors: {
          positive: generatePositiveFactors(),
          negative: generateNegativeFactors(),
          neutral: generateNeutralFactors(),
        },
        recommendations: generateRecommendations(),
        riskFactors: generateRiskFactors(),
        urgency: formData.urgency,
        conversionProbability: calculateConversionProbability(),
      };

      setAiScore(mockScore);
    } catch (error) {
      console.error('Error generating AI score:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMockScore = (): number => {
    let score = 50; // Base score

    // Budget factors
    if (formData.budgetMax > 50000) score += 15;
    else if (formData.budgetMax > 25000) score += 10;
    else if (formData.budgetMax > 10000) score += 5;

    // Timeline factors
    if (formData.timeline === 'asap') score += 15;
    else if (formData.timeline === 'within_week') score += 10;
    else if (formData.timeline === 'within_month') score += 5;

    // Project size factors
    if (formData.projectSize === 'large') score += 10;
    else if (formData.projectSize === 'medium') score += 5;

    // Financing factors
    if (formData.financing === 'cash') score += 10;
    else if (formData.financing === 'loan') score += 5;

    // Experience factors
    if (formData.previousExperience) score += 5;

    // Requirements factors
    if (formData.requirements.length > 3) score += 10;
    else if (formData.requirements.length > 1) score += 5;

    return Math.min(score, 100);
  };

  const calculateGrade = (): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' => {
    const score = calculateMockScore();
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    if (score >= 55) return 'D';
    if (score >= 45) return 'E';
    return 'F';
  };

  const calculateConversionProbability = (): number => {
    const score = calculateMockScore();
    return Math.min(score + 10, 95);
  };

  const generatePositiveFactors = (): string[] => {
    const factors = [];
    if (formData.budgetMax > 25000)
      factors.push('High budget indicates serious intent');
    if (formData.timeline === 'asap')
      factors.push('Urgent timeline shows immediate need');
    if (formData.financing === 'cash')
      factors.push('Cash financing reduces risk');
    if (formData.requirements.length > 2)
      factors.push('Detailed requirements show planning');
    if (formData.previousExperience)
      factors.push('Previous contractor experience');
    return factors;
  };

  const generateNegativeFactors = (): string[] => {
    const factors = [];
    if (formData.budgetMax < 5000)
      factors.push('Low budget may indicate price sensitivity');
    if (formData.timeline === 'planning_ahead')
      factors.push('Long timeline may reduce urgency');
    if (formData.financing === 'undecided')
      factors.push('Uncertain financing status');
    if (!formData.requirements.length)
      factors.push('Vague project requirements');
    return factors;
  };

  const generateNeutralFactors = (): string[] => {
    const factors = [];
    if (formData.projectSize === 'small') factors.push('Small project size');
    if (formData.propertyAge === '30+_years')
      factors.push('Older property may need additional work');
    return factors;
  };

  const generateRecommendations = (): string[] => {
    const recommendations = [];
    if (formData.budgetMax > 25000)
      recommendations.push('Send detailed proposal within 24 hours');
    if (formData.timeline === 'asap')
      recommendations.push('Highlight quick start availability');
    if (formData.financing === 'undecided')
      recommendations.push('Offer financing options');
    if (formData.requirements.length < 2)
      recommendations.push('Schedule consultation to clarify scope');
    return recommendations;
  };

  const generateRiskFactors = (): string[] => {
    const risks = [];
    if (formData.budgetMax < 10000)
      risks.push('Budget constraints may limit scope');
    if (formData.timeline === 'planning_ahead')
      risks.push('Long timeline may lead to delays');
    if (formData.financing === 'undecided') risks.push('Financing uncertainty');
    return risks;
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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const updateFormData = (field: keyof LeadIntakeData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!aiScore) return;

    setLoading(true);
    try {
      // Mock API call to save lead
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert('Success', 'Lead submitted successfully!');
      setShowScoreModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit lead');
    } finally {
      setLoading(false);
    }
  };

  const renderAIScoreCard = () => {
    if (!aiScore || formProgress < 30) return null;

    return (
      <View
        style={[styles.scoreCard, { backgroundColor: cardColor, borderColor }]}
      >
        <View style={styles.scoreHeader}>
          <Text style={[styles.scoreTitle, { color: textColor }]}>
            AI Lead Score
          </Text>
          <View
            style={[
              styles.scoreBadge,
              { backgroundColor: getGradeColor(aiScore.grade) },
            ]}
          >
            <Text style={styles.scoreGrade}>{aiScore.grade}</Text>
          </View>
        </View>

        <View style={styles.scoreDetails}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreLabel, { color: textSecondaryColor }]}>
              Overall Score:
            </Text>
            <Text style={[styles.scoreValue, { color: textColor }]}>
              {aiScore.overallScore}/100
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreLabel, { color: textSecondaryColor }]}>
              Confidence:
            </Text>
            <Text style={[styles.scoreValue, { color: textColor }]}>
              {aiScore.confidence}%
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreLabel, { color: textSecondaryColor }]}>
              Conversion:
            </Text>
            <Text style={[styles.scoreValue, { color: textColor }]}>
              {aiScore.conversionProbability}%
            </Text>
          </View>
        </View>

        <View style={styles.urgencyIndicator}>
          <Text
            style={[
              styles.urgencyText,
              { color: getUrgencyColor(aiScore.urgency) },
            ]}
          >
            {aiScore.urgency.toUpperCase()} URGENCY
          </Text>
        </View>
      </View>
    );
  };

  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.formStep}>
            <Text style={[styles.stepTitle, { color: textColor }]}>
              Basic Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Full Name *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.name}
                onChangeText={text => updateFormData('name', text)}
                placeholder='Enter your full name'
                placeholderTextColor={textSecondaryColor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Email *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.email}
                onChangeText={text => updateFormData('email', text)}
                placeholder='Enter your email address'
                placeholderTextColor={textSecondaryColor}
                keyboardType='email-address'
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Phone *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.phone}
                onChangeText={text => updateFormData('phone', text)}
                placeholder='Enter your phone number'
                placeholderTextColor={textSecondaryColor}
                keyboardType='phone-pad'
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Address
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.address}
                onChangeText={text => updateFormData('address', text)}
                placeholder='Enter your address'
                placeholderTextColor={textSecondaryColor}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={[styles.inputLabel, { color: textColor }]}>
                  City
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: cardColor,
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  value={formData.city}
                  onChangeText={text => updateFormData('city', text)}
                  placeholder='City'
                  placeholderTextColor={textSecondaryColor}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                <Text style={[styles.inputLabel, { color: textColor }]}>
                  State
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: cardColor,
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  value={formData.state}
                  onChangeText={text => updateFormData('state', text)}
                  placeholder='State'
                  placeholderTextColor={textSecondaryColor}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                ZIP Code
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.zipCode}
                onChangeText={text => updateFormData('zipCode', text)}
                placeholder='Enter ZIP code'
                placeholderTextColor={textSecondaryColor}
                keyboardType='phone-pad'
                textContentType='none'
                autoComplete='off'
                maxLength={5}
              />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.formStep}>
            <Text style={[styles.stepTitle, { color: textColor }]}>
              Project Details
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Project Type *
              </Text>
              <View style={styles.optionGroup}>
                {[
                  'residential',
                  'commercial',
                  'renovation',
                  'new-build',
                  'maintenance',
                ].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      { backgroundColor: cardColor, borderColor },
                      formData.projectType === type && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() => updateFormData('projectType', type)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            formData.projectType === type ? 'white' : textColor,
                        },
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Project Size *
              </Text>
              <View style={styles.optionGroup}>
                {['small', 'medium', 'large'].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.optionButton,
                      { backgroundColor: cardColor, borderColor },
                      formData.projectSize === size && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() => updateFormData('projectSize', size)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            formData.projectSize === size ? 'white' : textColor,
                        },
                      ]}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Project Description *
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.projectDescription}
                onChangeText={text =>
                  updateFormData('projectDescription', text)
                }
                placeholder='Describe your project in detail...'
                placeholderTextColor={textSecondaryColor}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Budget Range *
              </Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: cardColor,
                        color: textColor,
                        borderColor,
                      },
                    ]}
                    value={formData.budgetMin.toString()}
                    onChangeText={text =>
                      updateFormData('budgetMin', parseInt(text) || 0)
                    }
                    placeholder='Min'
                    placeholderTextColor={textSecondaryColor}
                    keyboardType='numeric'
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: cardColor,
                        color: textColor,
                        borderColor,
                      },
                    ]}
                    value={formData.budgetMax.toString()}
                    onChangeText={text =>
                      updateFormData('budgetMax', parseInt(text) || 0)
                    }
                    placeholder='Max'
                    placeholderTextColor={textSecondaryColor}
                    keyboardType='numeric'
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Timeline *
              </Text>
              <View style={styles.optionGroup}>
                {[
                  { value: 'asap', label: 'ASAP' },
                  { value: 'within_week', label: 'Within Week' },
                  { value: 'within_month', label: 'Within Month' },
                  { value: 'planning_ahead', label: 'Planning Ahead' },
                ].map(timeline => (
                  <TouchableOpacity
                    key={timeline.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: cardColor, borderColor },
                      formData.timeline === timeline.value && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() => updateFormData('timeline', timeline.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            formData.timeline === timeline.value
                              ? 'white'
                              : textColor,
                        },
                      ]}
                    >
                      {timeline.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.formStep}>
            <Text style={[styles.stepTitle, { color: textColor }]}>
              Additional Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Financing
              </Text>
              <View style={styles.optionGroup}>
                {['cash', 'loan', 'credit', 'undecided'].map(finance => (
                  <TouchableOpacity
                    key={finance}
                    style={[
                      styles.optionButton,
                      { backgroundColor: cardColor, borderColor },
                      formData.financing === finance && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() => updateFormData('financing', finance)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            formData.financing === finance
                              ? 'white'
                              : textColor,
                        },
                      ]}
                    >
                      {finance.charAt(0).toUpperCase() + finance.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Previous Contractor Experience
              </Text>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: textColor }]}>
                  Have you worked with contractors before?
                </Text>
                <Switch
                  value={formData.previousExperience}
                  onValueChange={value =>
                    updateFormData('previousExperience', value)
                  }
                  trackColor={{ false: borderColor, true: accentColor }}
                  thumbColor={formData.previousExperience ? 'white' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                How did you hear about us?
              </Text>
              <View style={styles.optionGroup}>
                {[
                  'website',
                  'referral',
                  'social-media',
                  'advertisement',
                  'other',
                ].map(source => (
                  <TouchableOpacity
                    key={source}
                    style={[
                      styles.optionButton,
                      { backgroundColor: cardColor, borderColor },
                      formData.referralSource === source && {
                        backgroundColor: accentColor,
                      },
                    ]}
                    onPress={() => updateFormData('referralSource', source)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        {
                          color:
                            formData.referralSource === source
                              ? 'white'
                              : textColor,
                        },
                      ]}
                    >
                      {source
                        .replace('-', ' ')
                        .split(' ')
                        .map(
                          word => word.charAt(0).toUpperCase() + word.slice(1)
                        )
                        .join(' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>
                Additional Notes
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: cardColor, color: textColor, borderColor },
                ]}
                value={formData.additionalNotes}
                onChangeText={text => updateFormData('additionalNotes', text)}
                placeholder='Any additional information about your project...'
                placeholderTextColor={textSecondaryColor}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          AI-Scored Lead Intake
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Real-time AI scoring as you complete the form
        </Text>
      </View>

      {/* Progress Bar */}
      <View
        style={[
          styles.progressContainer,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.progressHeader}>
          <Text style={[styles.progressText, { color: textColor }]}>
            Form Progress: {Math.round(formProgress)}%
          </Text>
          <Text style={[styles.stepText, { color: textSecondaryColor }]}>
            Step {currentStep} of 3
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: accentColor, width: `${formProgress}%` },
            ]}
          />
        </View>
      </View>

      {/* AI Score Card */}
      {renderAIScoreCard()}

      {/* Form Content */}
      <ScrollView style={styles.formContainer}>{renderFormStep()}</ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: cardColor, borderColor },
            ]}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={[styles.navButtonText, { color: textColor }]}>
              Previous
            </Text>
          </TouchableOpacity>
        )}

        {currentStep < 3 ? (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: accentColor }]}
            onPress={() => setCurrentStep(currentStep + 1)}
          >
            <Text style={[styles.navButtonText, { color: 'white' }]}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: accentColor }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Submitting...' : 'Submit Lead'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* AI Score Modal */}
      <Modal
        visible={showScoreModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            {aiScore && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    AI Lead Analysis
                  </Text>
                  <TouchableOpacity onPress={() => setShowScoreModal(false)}>
                    <MaterialIcons name='close' size={24} color={textColor} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.scoreSummary}>
                    <View
                      style={[
                        styles.scoreCircle,
                        { backgroundColor: getGradeColor(aiScore.grade) },
                      ]}
                    >
                      <Text style={styles.scoreText}>
                        {aiScore.overallScore}
                      </Text>
                    </View>
                    <View style={styles.scoreInfo}>
                      <Text style={[styles.gradeText, { color: textColor }]}>
                        Grade: {aiScore.grade}
                      </Text>
                      <Text
                        style={[
                          styles.confidenceText,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Confidence: {aiScore.confidence}%
                      </Text>
                      <Text
                        style={[
                          styles.conversionText,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Conversion Probability: {aiScore.conversionProbability}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.factorsSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Positive Factors
                    </Text>
                    {aiScore.factors.positive.map((factor, index) => (
                      <View key={index} style={styles.factorItem}>
                        <MaterialIcons
                          name='check-circle'
                          size={16}
                          color='#4CAF50'
                        />
                        <Text style={[styles.factorText, { color: textColor }]}>
                          {factor}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {aiScore.factors.negative.length > 0 && (
                    <View style={styles.factorsSection}>
                      <Text style={[styles.sectionTitle, { color: textColor }]}>
                        Areas of Concern
                      </Text>
                      {aiScore.factors.negative.map((factor, index) => (
                        <View key={index} style={styles.factorItem}>
                          <MaterialIcons
                            name='warning'
                            size={16}
                            color='#F44336'
                          />
                          <Text
                            style={[styles.factorText, { color: textColor }]}
                          >
                            {factor}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.factorsSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Recommendations
                    </Text>
                    {aiScore.recommendations.map((recommendation, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <MaterialIcons
                          name='lightbulb'
                          size={16}
                          color='#FFC107'
                        />
                        <Text
                          style={[
                            styles.recommendationText,
                            { color: textColor },
                          ]}
                        >
                          {recommendation}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  progressContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreGrade: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreDetails: {
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  urgencyIndicator: {
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
  },
  formStep: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 15,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  scoreSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  conversionText: {
    fontSize: 14,
  },
  factorsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
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
});

export default AIScoredLeadIntake;
