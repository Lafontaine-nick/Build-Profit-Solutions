import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService } from '../services/leadService';

const EnhancedLeadCapture: React.FC = () => {
  const { darkMode } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    projectType: 'residential',
    projectSize: 'medium',
    budgetMin: '',
    budgetMax: '',
    requirements: '',
    city: '',
    state: '',
    zipCode: '',
  });

  // Define colors based on theme
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  const handleSubmit = async () => {
    try {
      const leadData = {
        ...formData,
        projectType: formData.projectType as
          | 'residential'
          | 'commercial'
          | 'renovation'
          | 'new-build'
          | 'maintenance',
        projectSize: formData.projectSize as 'small' | 'medium' | 'large',
        budget: {
          min: parseInt(formData.budgetMin) || 0,
          max: parseInt(formData.budgetMax) || 0,
          currency: 'USD',
        },
        location: {
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        },
        timeline: {
          startDate: new Date().toISOString(),
          duration: 4,
          urgency: 'medium' as const,
        },
        source: 'website' as const,
        requirements: formData.requirements,
      };

      await leadService.createLead(leadData);
      Alert.alert('Success', 'Lead captured successfully!');

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        projectType: 'residential',
        projectSize: 'medium',
        budgetMin: '',
        budgetMax: '',
        requirements: '',
        city: '',
        state: '',
        zipCode: '',
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      Alert.alert('Error', 'Failed to capture lead. Please try again.');
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: string,
    keyboardType:
      | 'default'
      | 'email-address'
      | 'phone-pad'
      | 'numeric' = 'default',
    textInputExtras?: Pick<TextInputProps, 'textContentType' | 'autoComplete'>
  ) => (
    <View style={styles.inputContainer}>
      <View style={styles.inputLabel}>
        <MaterialIcons
          name={icon as any}
          size={20}
          color={textSecondaryColor}
        />
        <Text style={[styles.labelText, { color: textSecondaryColor }]}>
          {label}
        </Text>
      </View>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: cardColor,
            color: textColor,
            borderColor,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={textSecondaryColor}
        keyboardType={keyboardType}
        {...textInputExtras}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Capture New Lead
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          AI-powered lead capture with instant scoring
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={[styles.formCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Contact Information
          </Text>

          {renderInput(
            'Full Name',
            formData.name,
            text => setFormData({ ...formData, name: text }),
            'Enter full name',
            'person'
          )}

          {renderInput(
            'Email',
            formData.email,
            text => setFormData({ ...formData, email: text }),
            'Enter email address',
            'email',
            'email-address'
          )}

          {renderInput(
            'Phone',
            formData.phone,
            text => setFormData({ ...formData, phone: text }),
            'Enter phone number',
            'phone',
            'phone-pad'
          )}

          {renderInput(
            'Company (Optional)',
            formData.company,
            text => setFormData({ ...formData, company: text }),
            'Enter company name',
            'business'
          )}
        </View>

        <View style={[styles.formCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Project Details
          </Text>

          {renderInput(
            'Project Requirements',
            formData.requirements,
            text => setFormData({ ...formData, requirements: text }),
            'Describe your project needs',
            'description'
          )}

          {renderInput(
            'City',
            formData.city,
            text => setFormData({ ...formData, city: text }),
            'Enter city',
            'location-city'
          )}

          {renderInput(
            'State',
            formData.state,
            text => setFormData({ ...formData, state: text }),
            'Enter state',
            'location-on'
          )}

          {renderInput(
            'ZIP Code',
            formData.zipCode,
            text => setFormData({ ...formData, zipCode: text }),
            'Enter ZIP code',
            'location-on',
            'phone-pad',
            { textContentType: 'none', autoComplete: 'off' }
          )}
        </View>

        <View style={[styles.formCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Budget & Timeline
          </Text>

          <View style={styles.budgetRow}>
            {renderInput(
              'Min Budget',
              formData.budgetMin,
              text => setFormData({ ...formData, budgetMin: text }),
              '$0',
              'attach-money',
              'numeric'
            )}
            {renderInput(
              'Max Budget',
              formData.budgetMax,
              text => setFormData({ ...formData, budgetMax: text }),
              '$0',
              'attach-money',
              'numeric'
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: accentColor }]}
          onPress={handleSubmit}
        >
          <MaterialIcons name='send' size={20} color='white' />
          <Text style={styles.submitText}>Capture Lead</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
});

export default EnhancedLeadCapture;
