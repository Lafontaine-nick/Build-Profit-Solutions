import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  image?: any;
  color: string;
}

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Build Profit Solutions',
    subtitle: 'Your Complete Construction Business Platform',
    description:
      'Streamline your construction business with AI-powered estimates, lead management, and project tracking.',
    icon: 'construction',
    color: '#43cea2',
  },
  {
    id: 'estimates',
    title: 'AI-Powered Estimates',
    subtitle: 'Generate Accurate Project Estimates',
    description:
      'Create detailed project estimates with AI assistance, including materials, labor, and overhead costs.',
    icon: 'calculate',
    color: '#2196F3',
  },
  {
    id: 'leads',
    title: 'Smart Lead Management',
    subtitle: 'Convert More Leads to Projects',
    description:
      'Track and nurture leads with AI scoring, automated follow-ups, and contractor matching.',
    icon: 'people',
    color: '#FF9800',
  },
  {
    id: 'projects',
    title: 'Project Tracking',
    subtitle: 'Manage Projects from Start to Finish',
    description:
      'Track project progress, manage timelines, and monitor profitability in real-time.',
    icon: 'assignment',
    color: '#9C27B0',
  },
  {
    id: 'invoices',
    title: 'Invoice & Payment Tracking',
    subtitle: 'Get Paid Faster',
    description:
      'Generate professional invoices, track payments, and manage your cash flow effectively.',
    icon: 'receipt',
    color: '#4CAF50',
  },
  {
    id: 'analytics',
    title: 'Business Analytics',
    subtitle: 'Make Data-Driven Decisions',
    description:
      'Get insights into your business performance, profitability, and growth opportunities.',
    icon: 'analytics',
    color: '#E91E63',
  },
];

export default function OnboardingFlow({
  onComplete,
  onSkip,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep < onboardingSteps.length - 1) {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep + 1);
        // Animate in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSkip();
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep > 0) {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep - 1);
        // Animate in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const currentStepData = onboardingSteps[currentStep];

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#2d5a3d', '#43cea2']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    index === currentStep
                      ? currentStepData.color
                      : 'rgba(255,255,255,0.3)',
                  width: index === currentStep ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconBackground,
              { backgroundColor: currentStepData.color },
            ]}
          >
            <MaterialIcons
              name={currentStepData.icon as any}
              size={60}
              color='white'
            />
          </View>
        </View>

        <Text style={styles.title}>{currentStepData.title}</Text>
        <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
        <Text style={styles.description}>{currentStepData.description}</Text>

        {currentStepData.image && (
          <View style={styles.imageContainer}>
            <Image
              source={currentStepData.image}
              style={styles.image}
              resizeMode='contain'
            />
          </View>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.navigationButtons}>
          {currentStep > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <MaterialIcons name='arrow-back' size={24} color='white' />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: currentStepData.color },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === onboardingSteps.length - 1
                ? 'Get Started'
                : 'Next'}
            </Text>
            <MaterialIcons
              name={
                currentStep === onboardingSteps.length - 1
                  ? 'check'
                  : 'arrow-forward'
              }
              size={24}
              color='white'
            />
          </TouchableOpacity>
        </View>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <MaterialIcons name='check-circle' size={20} color='#4CAF50' />
            <Text style={styles.featureText}>AI-powered estimates</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name='check-circle' size={20} color='#4CAF50' />
            <Text style={styles.featureText}>Lead management</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name='check-circle' size={20} color='#4CAF50' />
            <Text style={styles.featureText}>Project tracking</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 40,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  imageContainer: {
    marginTop: 40,
    width: width * 0.8,
    height: height * 0.3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  featuresList: {
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginLeft: 10,
  },
});
