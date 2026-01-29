import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService } from '../services/leadService';
import * as ImagePicker from 'expo-image-picker';

interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  projectType:
    | 'residential'
    | 'commercial'
    | 'renovation'
    | 'new-build'
    | 'maintenance';
  projectSize: 'small' | 'medium' | 'large';
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  timeline: {
    startDate: string;
    duration: number;
    urgency: 'low' | 'medium' | 'high';
  };
  location: {
    city: string;
    state: string;
    zipCode: string;
  };
  requirements: string;
  source:
    | 'website'
    | 'referral'
    | 'social-media'
    | 'cold-outreach'
    | 'advertisement';

  // 🧠 Smart Qualifying Questions
  urgency:
    | 'immediate'
    | 'within-30-days'
    | 'within-3-months'
    | 'planning-stage';
  financing: 'cash' | 'loan-approved' | 'need-financing' | 'not-sure';
  decisionMaker: boolean;
  hasPhotos: boolean;
  photos: string[];
  additionalDetails: string;
  preferredContact: 'phone' | 'email' | 'text';
  bestTimeToContact: 'morning' | 'afternoon' | 'evening' | 'anytime';

  // 🔐 Trust & Transparency
  emailVerified: boolean;
  phoneVerified: boolean;
  consentToContact: boolean;
  marketingConsent: boolean;
}

const LeadCaptureForm: React.FC = () => {
  const { darkMode } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    projectType: 'residential',
    projectSize: 'medium',
    budget: { min: 0, max: 0, currency: 'USD' },
    timeline: { startDate: '', duration: 0, urgency: 'medium' },
    location: { city: '', state: '', zipCode: '' },
    requirements: '',
    source: 'website',
    urgency: 'within-30-days',
    financing: 'not-sure',
    decisionMaker: false,
    hasPhotos: false,
    photos: [],
    additionalDetails: '',
    preferredContact: 'phone',
    bestTimeToContact: 'anytime',
    emailVerified: false,
    phoneVerified: false,
    consentToContact: true,
    marketingConsent: false,
  });

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  const updateFormData = (field: keyof LeadFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload project photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map(asset => asset.uri);
        updateFormData('photos', [...formData.photos, ...newPhotos]);
        updateFormData('hasPhotos', true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.consentToContact) {
      Alert.alert(
        'Consent Required',
        'You must agree to be contacted about your project.'
      );
      return;
    }

    setLoading(true);
    try {
      // 🧠 AI-Powered Lead Scoring & Grading
      const leadData = {
        ...formData,
        status: 'new',
        // Calculate intent score based on qualifying questions
        intentScore: calculateIntentScore(formData),
        leadGrade: calculateLeadGrade(formData),
      };

      const lead = await leadService.createLead(leadData);

      Alert.alert(
        'Lead Submitted Successfully!',
        `Your project has been submitted and scored as a Grade ${lead.leadGrade} lead. Contractors will be notified and can review your project details.`,
        [{ text: 'OK', onPress: () => setCurrentStep(1) }]
      );

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        projectType: 'residential',
        projectSize: 'medium',
        budget: { min: 0, max: 0, currency: 'USD' },
        timeline: { startDate: '', duration: 0, urgency: 'medium' },
        location: { city: '', state: '', zipCode: '' },
        requirements: '',
        source: 'website',
        urgency: 'within-30-days',
        financing: 'not-sure',
        decisionMaker: false,
        hasPhotos: false,
        photos: [],
        additionalDetails: '',
        preferredContact: 'phone',
        bestTimeToContact: 'anytime',
        emailVerified: false,
        phoneVerified: false,
        consentToContact: true,
        marketingConsent: false,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🧠 AI-Powered Lead Scoring
  const calculateIntentScore = (data: LeadFormData): number => {
    let score = 0;

    // Urgency scoring
    switch (data.urgency) {
      case 'immediate':
        score += 25;
        break;
      case 'within-30-days':
        score += 20;
        break;
      case 'within-3-months':
        score += 15;
        break;
      case 'planning-stage':
        score += 5;
        break;
    }

    // Financing scoring
    switch (data.financing) {
      case 'cash':
        score += 20;
        break;
      case 'loan-approved':
        score += 15;
        break;
      case 'need-financing':
        score += 10;
        break;
      case 'not-sure':
        score += 5;
        break;
    }

    // Decision maker
    if (data.decisionMaker) score += 15;

    // Photos
    if (data.hasPhotos) score += 10;

    // Budget range (more specific = higher score)
    const budgetRange = data.budget.max - data.budget.min;
    if (budgetRange < 10000) score += 15;
    else if (budgetRange < 25000) score += 10;
    else score += 5;

    // Project details
    if (data.requirements.length > 100) score += 10;
    else if (data.requirements.length > 50) score += 5;

    return Math.min(score, 100);
  };

  // 🎯 Lead Grading (A-F)
  const calculateLeadGrade = (data: LeadFormData): string => {
    const intentScore = calculateIntentScore(data);

    if (intentScore >= 85) return 'A';
    if (intentScore >= 70) return 'B';
    if (intentScore >= 55) return 'C';
    if (intentScore >= 40) return 'D';
    if (intentScore >= 25) return 'E';
    return 'F';
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        Basic Information
      </Text>

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Full Name *'
        placeholderTextColor={textSecondaryColor}
        value={formData.name}
        onChangeText={text => updateFormData('name', text)}
      />

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Email Address *'
        placeholderTextColor={textSecondaryColor}
        value={formData.email}
        onChangeText={text => updateFormData('email', text)}
        keyboardType='email-address'
      />

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Phone Number *'
        placeholderTextColor={textSecondaryColor}
        value={formData.phone}
        onChangeText={text => updateFormData('phone', text)}
        keyboardType='phone-pad'
      />

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Company (Optional)'
        placeholderTextColor={textSecondaryColor}
        value={formData.company}
        onChangeText={text => updateFormData('company', text)}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        Project Details
      </Text>

      <Text style={[styles.label, { color: textColor }]}>Project Type *</Text>
      <View style={styles.radioGroup}>
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
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.projectType === type && { backgroundColor: accentColor },
            ]}
            onPress={() => updateFormData('projectType', type)}
          >
            <Text
              style={[
                styles.radioText,
                { color: formData.projectType === type ? 'white' : textColor },
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: textColor }]}>Project Size *</Text>
      <View style={styles.radioGroup}>
        {['small', 'medium', 'large'].map(size => (
          <TouchableOpacity
            key={size}
            style={[
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.projectSize === size && { backgroundColor: accentColor },
            ]}
            onPress={() => updateFormData('projectSize', size)}
          >
            <Text
              style={[
                styles.radioText,
                { color: formData.projectSize === size ? 'white' : textColor },
              ]}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Project Requirements *'
        placeholderTextColor={textSecondaryColor}
        value={formData.requirements}
        onChangeText={text => updateFormData('requirements', text)}
        multiline
        numberOfLines={4}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        🧠 Smart Qualifying Questions
      </Text>

      <Text style={[styles.label, { color: textColor }]}>
        How urgent is your project? *
      </Text>
      <View style={styles.radioGroup}>
        {[
          { value: 'immediate', label: 'Immediate (Start within 1 week)' },
          { value: 'within-30-days', label: 'Within 30 days' },
          { value: 'within-3-months', label: 'Within 3 months' },
          { value: 'planning-stage', label: 'Planning stage' },
        ].map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.urgency === option.value && {
                backgroundColor: accentColor,
              },
            ]}
            onPress={() => updateFormData('urgency', option.value)}
          >
            <Text
              style={[
                styles.radioText,
                {
                  color:
                    formData.urgency === option.value ? 'white' : textColor,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: textColor }]}>
        How will you finance this project? *
      </Text>
      <View style={styles.radioGroup}>
        {[
          { value: 'cash', label: 'Cash/Check' },
          { value: 'loan-approved', label: 'Loan Approved' },
          { value: 'need-financing', label: 'Need Financing' },
          { value: 'not-sure', label: 'Not Sure Yet' },
        ].map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.financing === option.value && {
                backgroundColor: accentColor,
              },
            ]}
            onPress={() => updateFormData('financing', option.value)}
          >
            <Text
              style={[
                styles.radioText,
                {
                  color:
                    formData.financing === option.value ? 'white' : textColor,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: textColor }]}>
          Are you the decision maker?
        </Text>
        <Switch
          value={formData.decisionMaker}
          onValueChange={value => updateFormData('decisionMaker', value)}
          trackColor={{ false: borderColor, true: accentColor }}
          thumbColor={formData.decisionMaker ? 'white' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        Budget & Timeline
      </Text>

      <View style={styles.budgetRow}>
        <TextInput
          style={[
            styles.budgetInput,
            { backgroundColor: cardColor, color: textColor, borderColor },
          ]}
          placeholder='Min Budget'
          placeholderTextColor={textSecondaryColor}
          value={formData.budget.min.toString()}
          onChangeText={text =>
            updateFormData('budget', {
              ...formData.budget,
              min: parseInt(text) || 0,
            })
          }
          keyboardType='numeric'
        />
        <Text style={[styles.budgetSeparator, { color: textColor }]}>to</Text>
        <TextInput
          style={[
            styles.budgetInput,
            { backgroundColor: cardColor, color: textColor, borderColor },
          ]}
          placeholder='Max Budget'
          placeholderTextColor={textSecondaryColor}
          value={formData.budget.max.toString()}
          onChangeText={text =>
            updateFormData('budget', {
              ...formData.budget,
              max: parseInt(text) || 0,
            })
          }
          keyboardType='numeric'
        />
      </View>

      <Text style={[styles.label, { color: textColor }]}>
        Preferred Contact Method
      </Text>
      <View style={styles.radioGroup}>
        {['phone', 'email', 'text'].map(method => (
          <TouchableOpacity
            key={method}
            style={[
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.preferredContact === method && {
                backgroundColor: accentColor,
              },
            ]}
            onPress={() => updateFormData('preferredContact', method)}
          >
            <Text
              style={[
                styles.radioText,
                {
                  color:
                    formData.preferredContact === method ? 'white' : textColor,
                },
              ]}
            >
              {method.charAt(0).toUpperCase() + method.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: textColor }]}>
        Best Time to Contact
      </Text>
      <View style={styles.radioGroup}>
        {['morning', 'afternoon', 'evening', 'anytime'].map(time => (
          <TouchableOpacity
            key={time}
            style={[
              styles.radioButton,
              { backgroundColor: cardColor, borderColor },
              formData.bestTimeToContact === time && {
                backgroundColor: accentColor,
              },
            ]}
            onPress={() => updateFormData('bestTimeToContact', time)}
          >
            <Text
              style={[
                styles.radioText,
                {
                  color:
                    formData.bestTimeToContact === time ? 'white' : textColor,
                },
              ]}
            >
              {time.charAt(0).toUpperCase() + time.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        📸 Project Photos (Optional)
      </Text>

      <TouchableOpacity
        style={[
          styles.photoButton,
          { backgroundColor: cardColor, borderColor },
        ]}
        onPress={handlePhotoUpload}
      >
        <MaterialIcons name='photo-camera' size={24} color={accentColor} />
        <Text style={[styles.photoButtonText, { color: textColor }]}>
          {formData.photos.length > 0
            ? `Uploaded ${formData.photos.length} photos`
            : 'Upload Project Photos'}
        </Text>
      </TouchableOpacity>

      {formData.photos.length > 0 && (
        <Text style={[styles.photoCount, { color: textSecondaryColor }]}>
          Photos help contractors better understand your project and may improve
          your lead score.
        </Text>
      )}

      <TextInput
        style={[
          styles.input,
          { backgroundColor: cardColor, color: textColor, borderColor },
        ]}
        placeholder='Additional Details (Optional)'
        placeholderTextColor={textSecondaryColor}
        value={formData.additionalDetails}
        onChangeText={text => updateFormData('additionalDetails', text)}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: textColor }]}>
        🔐 Trust & Transparency
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: textColor }]}>
          I consent to be contacted about my project *
        </Text>
        <Switch
          value={formData.consentToContact}
          onValueChange={value => updateFormData('consentToContact', value)}
          trackColor={{ false: borderColor, true: accentColor }}
          thumbColor={formData.consentToContact ? 'white' : '#f4f3f4'}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: textColor }]}>
          I agree to receive marketing communications
        </Text>
        <Switch
          value={formData.marketingConsent}
          onValueChange={value => updateFormData('marketingConsent', value)}
          trackColor={{ false: borderColor, true: accentColor }}
          thumbColor={formData.marketingConsent ? 'white' : '#f4f3f4'}
        />
      </View>

      <View
        style={[styles.infoBox, { backgroundColor: cardColor, borderColor }]}
      >
        <MaterialIcons name='info' size={20} color={accentColor} />
        <Text style={[styles.infoText, { color: textSecondaryColor }]}>
          Your contact information will be shared only with contractors who
          accept your project. You can verify your email and phone number for
          additional trust.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: accentColor }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Submitting...' : 'Submit Lead'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return renderStep1();
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Submit Your Project
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Get matched with qualified contractors
        </Text>
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5, 6].map(step => (
          <View
            key={step}
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  step <= currentStep ? accentColor : borderColor,
              },
            ]}
          />
        ))}
      </View>

      {renderStep()}

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

        {currentStep < 6 && (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: accentColor }]}
            onPress={() => setCurrentStep(currentStep + 1)}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  radioGroup: {
    marginBottom: 20,
  },
  radioButton: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  radioText: {
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
    marginRight: 15,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  budgetInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  budgetSeparator: {
    marginHorizontal: 10,
    fontSize: 16,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  photoButtonText: {
    fontSize: 16,
    marginLeft: 10,
  },
  photoCount: {
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  submitButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  navButton: {
    padding: 15,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LeadCaptureForm;
