import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

export default function AboutScreen() {
  const router = useRouter();

  const theme = {
    background: ['#0b1c38', '#1B365D', '#43cea2'] as [string, string, string],
    text: '#FFFFFF',
    subtext: '#E5E7EB',
    accent: '#A7F3D0',
    sectionTitle: '#ECFEFF',
  };

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
                styles.backButton,
                {
                  backgroundColor: 'rgba(67, 206, 162, 0.2)',
                  borderColor: 'rgba(67, 206, 162, 0.3)',
                },
              ]}
            >
              <MaterialIcons name='arrow-back' size={24} color='#FFFFFF' />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>About</Text>
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
              {/* Header Section */}
              <View style={styles.headerSection}>
                <Text style={styles.appTitle}>Build Profit Solutions</Text>
                <Text style={styles.subtitle}>
                  All-in-One AI-Powered Construction Management Platform
                </Text>
                <Text style={styles.version}>
                  Version {Constants.expoConfig?.version || '1.0.0'}
                </Text>
              </View>

              {/* Section: About */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bodyText}>
                  Build Profit Solutions is an AI-driven construction management
                  platform built for contractors, subcontractors, builders, and
                  real-estate investors. Our mission is to give you smarter tools,
                  faster workflows, and clearer insights, helping you bid
                  confidently and run your business with precision.
                </Text>
                <Text style={styles.bodyText}>
                  Powered by advanced AI, BPS automates time-consuming tasks,
                  reduces human error, and helps you make better decisions—whether
                  you're estimating a project, analyzing job costs, or managing
                  leads.
                </Text>
                <Text style={styles.bodyText}>
                  From the field to the office, our platform empowers construction
                  professionals to operate with the speed, accuracy, and efficiency
                  of a full back-office team.
                </Text>
              </View>

              {/* Section: What You Can Do */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What You Can Do with BPS</Text>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>AI-Powered Estimating</Text>
                  <Text style={styles.bulletText}>
                    Generate fast, accurate estimates using real-time material
                    pricing, labor calculations, overhead, and markup automatically
                    suggested by AI.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>AI Assistant</Text>
                  <Text style={styles.bulletText}>
                    Ask questions, request calculations, troubleshoot issues, and
                    get professional-grade guidance instantly—all directly inside the
                    app.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>
                    Lead Management & Sales Pipeline
                  </Text>
                  <Text style={styles.bulletText}>
                    Track inquiries, communication, and conversions with AI-powered
                    insights that highlight your strongest opportunities.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>
                    Project Tracking & Documentation
                  </Text>
                  <Text style={styles.bulletText}>
                    Keep tasks, schedules, files, and project status organized with
                    AI-supported reminders and suggested next steps.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>
                    Job Costing & Financial Insights
                  </Text>
                  <Text style={styles.bulletText}>
                    Instantly see profitability trends and budget health. AI flags
                    unexpected costs, waste, or margin risks in real time.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>Subcontractor Marketplace</Text>
                  <Text style={styles.bulletText}>
                    Compare pricing, discover subcontractors, and build competitive
                    bids with AI-assisted labor cost suggestions.
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Text style={styles.bulletTitle}>All-In-One Workflow</Text>
                  <Text style={styles.bulletText}>
                    Manage every part of your construction business—from the first
                    lead to the final payout—inside a single intelligent platform.
                  </Text>
                </View>
              </View>

              {/* Section: Mission */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Our Mission</Text>
                <Text style={styles.bodyText}>
                  To combine construction expertise with cutting-edge AI, delivering
                  professional-grade tools that help contractors win more work, grow
                  profitably, and operate with complete confidence.
                </Text>
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
  backButton: {
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
  headerTitle: {
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    color: '#D1FAE5',
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ECFEFF',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#E5E7EB',
    marginBottom: 8,
  },
  featureItem: {
    marginBottom: 16,
  },
  bulletTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#A7F3D0',
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#E5E7EB',
  },
});

