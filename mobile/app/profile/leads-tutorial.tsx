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

interface TutorialStepProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  theme: any;
  isLast?: boolean;
}

const TutorialStep = ({
  number,
  title,
  description,
  icon,
  theme,
  isLast,
}: TutorialStepProps) => (
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
      <View style={styles.stepCard}>
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <MaterialIcons name={icon as any} size={24} color='#43cea2' />
            <Text style={styles.stepTitle}>{title}</Text>
          </View>
          <Text style={styles.stepDescription}>
            {description}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

export default function LeadsTutorialScreen() {
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
      title: 'View Your Leads',
      description:
        'See all your leads organized by stage: New, Contacted, Qualified, Proposal, Won, and Lost. Leads are automatically scored by AI to help you prioritize.',
      icon: 'people',
    },
    {
      number: 2,
      title: 'Understand AI Scoring',
      description:
        'Each lead has a Perfect Fit score (0-100) based on project type, budget, location, and timeline. Higher scores indicate better matches for your business.',
      icon: 'star',
    },
    {
      number: 3,
      title: 'Update Lead Stages',
      description:
        'Tap on leads to update their status and move them through stages. Track your sales pipeline from initial contact to closed deals.',
      icon: 'arrow-forward',
    },
    {
      number: 4,
      title: 'View Lead Details',
      description:
        'Tap any lead to see full information including contact details, project requirements, budget range, timeline, and location.',
      icon: 'info',
    },
    {
      number: 5,
      title: 'Set Your Preferences',
      description:
        'Configure your trade types, service area, budget range, and timeline preferences. The system will prioritize leads that match your criteria.',
      icon: 'tune',
    },
    {
      number: 6,
      title: 'View Lead Analytics',
      description:
        'See your overall lead analytics including total leads, active leads, win rate, closed revenue, and top project types. Track your sales performance at a glance.',
      icon: 'analytics',
    },
    {
      number: 7,
      title: 'Filter and Search',
      description:
        'Use filters to view leads by stage, trade type, or score. Search by project title, location, or contact name to find specific leads quickly.',
      icon: 'search',
    },
    {
      number: 8,
      title: 'Convert to Projects',
      description:
        'When you win a lead, convert it to a project to start tracking progress, budget, and timeline in the Projects section.',
      icon: 'check-circle',
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
                Lead Management
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
                <MaterialIcons name='person-add' size={32} color='#43cea2' />
              </View>
              <Text style={styles.welcomeTitle}>
                Manage Your Sales Pipeline
              </Text>
              <Text style={styles.welcomeText}>
                Track and manage leads from initial contact to closed deals. Use AI-powered
                scoring to prioritize the best opportunities for your business.
              </Text>
            </View>

            {/* Tutorial Steps */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
                Getting Started
              </Text>
              {steps.map((step, index) => (
                <TutorialStep
                  key={step.number}
                  number={step.number}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                  theme={{}}
                  isLast={index === steps.length - 1}
                />
              ))}
            </View>

            {/* Quick Tips */}
            <View style={styles.tipsCard}>
              <MaterialIcons name='lightbulb-outline' size={24} color='#43cea2' />
              <View style={styles.tipsContent}>
                <Text style={styles.tipsTitle}>
                  Pro Tips
                </Text>
                <Text style={styles.tipsText}>
                  • Focus on leads with high AI scores first{'\n'}
                  • Check your analytics regularly to track win rate and revenue{'\n'}
                  • Set preferences to get better-matched leads{'\n'}
                  • Monitor top project types to focus your marketing efforts{'\n'}
                  • Convert won leads to projects immediately
                </Text>
              </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/leads');
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name='play-arrow' size={24} color='#FFFFFF' />
              <Text style={styles.ctaButtonText}>Go to Leads</Text>
            </TouchableOpacity>
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
    marginBottom: 16,
    color: '#FFFFFF',
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
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    backgroundColor: '#43cea2',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

