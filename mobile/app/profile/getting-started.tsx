import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  theme: any;
  onPress?: () => void;
  isLast?: boolean;
}

const StepCard = ({ number, title, description, icon, theme, onPress, isLast }: StepCardProps) => (
  <View style={styles.stepContainer}>
    <View style={styles.stepRow}>
        <View style={styles.stepLeft}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>
              {number}
            </Text>
          </View>
          {!isLast && (
            <View style={styles.stepConnector} />
          )}
        </View>
      <TouchableOpacity
        style={[
          styles.stepCard,
          onPress && styles.stepCardClickable,
        ]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <MaterialIcons name={icon as any} size={24} color='#43cea2' />
            <Text style={styles.stepTitle}>{title}</Text>
            {onPress && (
              <MaterialIcons name='chevron-right' size={20} color='#CFE6FF' />
            )}
          </View>
          <Text style={styles.stepDescription}>
            {description}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);


export default function GettingStartedScreen() {
  const router = useRouter();
  const { darkMode } = useTheme();

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#43cea2'] as [string, string, string],
        card: '#FFFFFF',
        text: '#0A2540',
        subtext: '#6C7383',
        accent: '#43cea2',
        border: '#D3D9E6',
        iconBg: '#E8F5F3',
      }
    : {
        background: ['#0b1c38', '#1B365D', '#43cea2'] as [string, string, string],
        card: '#FFFFFF',
        text: '#0A2540',
        subtext: '#6C7383',
        accent: '#43cea2',
        border: '#D3D9E6',
        iconBg: '#E8F5F3',
      };

  const steps = [
    {
      number: 1,
      title: 'Complete Your Profile',
      description:
        'Add your company information, licenses, and insurance details to get started.',
      icon: 'person',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/profile');
      },
    },
    {
      number: 2,
      title: 'Explore the Dashboard',
      description:
        'View your project overview, revenue metrics, and active projects at a glance.',
      icon: 'dashboard',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/dashboard');
      },
    },
    {
      number: 3,
      title: 'Add Your First Lead',
      description:
        'Start managing leads by adding new opportunities from the Leads tab.',
      icon: 'person-add',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/leads');
      },
    },
    {
      number: 4,
      title: 'Create an Estimate',
      description:
        'Use the Estimate Generator to create professional project estimates with AI assistance.',
      icon: 'calculate',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/estimate-generator');
      },
    },
    {
      number: 5,
      title: 'Manage Projects',
      description:
        'Track project progress, manage budgets, and collaborate with your team.',
      icon: 'folder',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/projects');
      },
    },
  ];


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.back();
              }}
              style={[
                styles.backButtonCircle,
                {
                  backgroundColor: 'rgba(67, 206, 162, 0.2)',
                  borderColor: 'rgba(67, 206, 162, 0.3)',
                },
              ]}
            >
              <MaterialIcons name='arrow-back' size={24} color='#FFFFFF' />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: '#FFFFFF' }]}>
                Getting Started
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Content Card */}
          <View style={styles.contentCard}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
            {/* Welcome Section */}
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIcon}>
                <MaterialIcons name='rocket-launch' size={32} color='#43cea2' />
              </View>
              <Text style={styles.welcomeTitle}>
                Welcome to Build Profit Solutions!
              </Text>
              <Text style={styles.welcomeText}>
                We're here to help you manage your construction business more
                efficiently. Follow these steps to get started.
              </Text>
            </View>

            {/* Steps Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
                Quick Start Guide
              </Text>
              <Text style={[styles.sectionSubtitle, { color: '#FFFFFF', opacity: 0.8 }]}>
                Tap on any step to get started
              </Text>
              {steps.map((step, index) => (
                <StepCard
                  key={step.number}
                  number={step.number}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                  theme={theme}
                  onPress={step.onPress}
                  isLast={index === steps.length - 1}
                />
              ))}
            </View>

            {/* Tips Section */}
            <View style={styles.tipsCard}>
              <MaterialIcons name='lightbulb-outline' size={24} color='#43cea2' />
              <View style={styles.tipsContent}>
                <Text style={styles.tipsTitle}>
                  Pro Tips
                </Text>
                <Text style={styles.tipsText}>
                  • Complete your profile to unlock all features{'\n'}
                  • Use the Dashboard to track your business metrics{'\n'}
                  • Create estimates to win more projects{'\n'}
                  • Manage leads to grow your pipeline
                </Text>
              </View>
            </View>

            {/* Help Resources */}
            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>
                Need More Help?
              </Text>
              <Text style={styles.helpSubtitle}>
                Check out these resources
              </Text>
              
              <TouchableOpacity
                style={styles.helpRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/profile/faq');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.helpIcon}>
                  <MaterialIcons name='help-outline' size={20} color='#43cea2' />
                </View>
                <Text style={styles.helpText}>FAQ</Text>
                <MaterialIcons name='chevron-right' size={20} color='#CFE6FF' />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/profile/contact-support');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.helpIcon}>
                  <MaterialIcons name='support-agent' size={20} color='#43cea2' />
                </View>
                <Text style={styles.helpText}>Contact Support</Text>
                <MaterialIcons name='chevron-right' size={20} color='#CFE6FF' />
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    position: 'relative',
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contentCard: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 40, 80, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#CFE6FF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  stepContainer: {
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 12,
    width: 40,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#43cea2',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 40,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
  },
  stepCardClickable: {
    // Additional styling for clickable cards if needed
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#FFFFFF',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CFE6FF',
  },
  tipsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    gap: 16,
    alignItems: 'flex-start',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#CFE6FF',
  },
  helpCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  helpSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: '#CFE6FF',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  helpText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

