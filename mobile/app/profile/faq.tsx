import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'billing' | 'technical' | 'features' | 'account';
}

const faqData: FAQItem[] = [
  // General
  {
    id: '1',
    question: 'What is Build Profit Solutions?',
    answer:
      'Build Profit Solutions is a comprehensive contractor management platform that helps you manage leads, create estimates, track projects, and grow your business with AI-powered insights and tools.',
    category: 'general',
  },
  {
    id: '2',
    question: 'How do I get started?',
    answer:
      'Getting started is easy! After signing up, complete your profile setup, then explore the Dashboard to see your overview. Start by adding your first lead or creating an estimate to see how the platform works.',
    category: 'general',
  },
  {
    id: '3',
    question: 'Is there a mobile app?',
    answer:
      'Yes! Build Profit Solutions is available as a mobile app for iOS and Android, allowing you to manage your business on the go.',
    category: 'general',
  },
  // Features
  {
    id: '4',
    question: 'How does lead scoring work?',
    answer:
      'Our AI analyzes lead data including project type, budget, location, and timeline to generate a Perfect Fit score. This score helps you prioritize leads that best match your business profile and preferences.',
    category: 'features',
  },
  {
    id: '5',
    question: 'Can I create estimates with materials pricing?',
    answer:
      'Yes! The Estimate Generator includes integrated materials pricing from major retailers. You can search for materials, add them to your estimate, and automatically calculate costs with current pricing.',
    category: 'features',
  },
  {
    id: '6',
    question: 'What AI features are available?',
    answer:
      'Build Profit Solutions includes AI-powered lead scoring, budget forecasting, expense validation, predictive analytics, and automated contract generation to help you make smarter business decisions.',
    category: 'features',
  },
  // Billing
  {
    id: '7',
    question: 'What are the subscription plans?',
    answer:
      'We offer three subscription plans: Basic ($25/month), Professional ($49/month), and Business ($79/month). Each plan includes different features and limits. You can upgrade or downgrade at any time.',
    category: 'billing',
  },
  {
    id: '8',
    question: 'Can I cancel my subscription?',
    answer:
      'Yes, you can cancel your subscription at any time from the Payment & Billing section in your Profile. Your access will continue until the end of your current billing period.',
    category: 'billing',
  },
  {
    id: '9',
    question: 'Do you offer refunds?',
    answer:
      'Refunds are handled on a case-by-case basis. Please contact our support team through the Help & Support section to discuss your refund request.',
    category: 'billing',
  },
  {
    id: '10',
    question: 'How do I update my payment method?',
    answer:
      'You can update your payment method in the Payment & Billing section. Tap "Manage Cards" to add, remove, or set a default payment method.',
    category: 'billing',
  },
  // Technical
  {
    id: '11',
    question: 'The app won\'t load. What should I do?',
    answer:
      'First, check your internet connection. Try closing and reopening the app, or clear the app cache. If the issue persists, try restarting your device or updating to the latest version of the app.',
    category: 'technical',
  },
  {
    id: '12',
    question: 'How do I sync my data?',
    answer:
      'Data syncs automatically when you have an internet connection. You can manually refresh by pulling down on most screens. The app also works offline and will sync when connection is restored.',
    category: 'technical',
  },
  {
    id: '13',
    question: 'Can I export my data?',
    answer:
      'Yes, you can export your leads, projects, and estimates from the relevant sections. Look for the export or share button in each section to download your data as PDF or CSV.',
    category: 'technical',
  },
  // Account
  {
    id: '14',
    question: 'How do I change my email address?',
    answer:
      'You can update your email address and other account information in Account Settings, which you can access from the Profile tab.',
    category: 'account',
  },
  {
    id: '15',
    question: 'How do I delete my account?',
    answer:
      'To delete your account, go to Account Settings and scroll to the bottom. Tap "Delete Account" and follow the prompts. This action cannot be undone, so make sure to export any important data first.',
    category: 'account',
  },
];

const categoryLabels: Record<string, string> = {
  all: 'All',
  general: 'General',
  billing: 'Billing',
  technical: 'Technical',
  features: 'Features',
  account: 'Account',
};

function FAQItemComponent({ item, isExpanded, onToggle }: { item: FAQItem; isExpanded: boolean; onToggle: () => void }) {
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (isExpanded) {
      height.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      height.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    maxHeight: height.value === 1 ? 500 : 0,
    opacity: opacity.value,
  }));

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={24}
          color='#43cea2'
        />
      </TouchableOpacity>
      <Animated.View style={[styles.faqAnswerContainer, animatedStyle]}>
        <Text style={styles.faqAnswer}>{item.answer}</Text>
      </Animated.View>
    </View>
  );
}

export default function FAQScreen() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const gradientColors = ['#0b1c38', '#1B365D', '#43cea2'] as const;

  const filteredFAQs = useMemo(() => {
    let filtered = faqData;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        faq =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selectedCategory, searchQuery]);

  const toggleItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const categories = ['all', 'general', 'billing', 'technical', 'features', 'account'];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.back();
              }}
              style={styles.backButtonHeader}
            >
              <MaterialIcons name='arrow-back' size={24} color='#FFFFFF' />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
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
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <MaterialIcons name='search' size={20} color='#CFE6FF' style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder='Search FAQs...'
                  placeholderTextColor='rgba(207, 230, 255, 0.6)'
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    style={styles.clearButton}
                  >
                    <MaterialIcons name='close' size={20} color='#CFE6FF' />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryContainer}
                contentContainerStyle={styles.categoryContent}
              >
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCategory(category);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === category && styles.categoryTextActive,
                      ]}
                    >
                      {categoryLabels[category]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* FAQ List */}
              <View style={styles.faqCard}>
                {filteredFAQs.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name='help-outline' size={48} color='#A0A9B6' />
                    <Text style={styles.emptyText}>No FAQs found</Text>
                    <Text style={styles.emptySubtext}>
                      Try adjusting your search or filter
                    </Text>
                  </View>
                ) : (
                  filteredFAQs.map(item => (
                    <FAQItemComponent
                      key={item.id}
                      item={item}
                      isExpanded={expandedItems.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                    />
                  ))
                )}
              </View>

              {/* Help Text */}
              <View style={styles.helpCard}>
                <MaterialIcons name='support-agent' size={24} color='#43cea2' />
                <Text style={styles.helpTitle}>Still have questions?</Text>
                <Text style={styles.helpText}>
                  Can't find what you're looking for? Contact our support team for
                  personalized assistance.
                </Text>
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/profile/help-support');
                  }}
                >
                  <Text style={styles.helpButtonText}>Contact Support</Text>
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
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    position: 'relative',
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 4,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryContent: {
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(67, 206, 162, 0.25)',
    borderColor: '#43cea2',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CFE6FF',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  faqCard: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 16,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
    lineHeight: 22,
  },
  faqAnswerContainer: {
    overflow: 'hidden',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  faqAnswer: {
    fontSize: 15,
    color: '#CFE6FF',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CFE6FF',
    textAlign: 'center',
  },
  helpCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.25)',
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#CFE6FF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  helpButton: {
    backgroundColor: '#43cea2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


