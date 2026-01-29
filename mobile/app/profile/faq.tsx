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
import { getColors } from '@/theme/getColors';
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

function FAQItemComponent({ item, isExpanded, onToggle, theme }: { item: FAQItem; isExpanded: boolean; onToggle: () => void; theme: any }) {
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
    <View style={[styles.faqItem, { borderBottomColor: theme.border }]}>
      <TouchableOpacity
        style={styles.faqHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.accent}
        />
      </TouchableOpacity>
      <Animated.View style={[styles.faqAnswerContainer, animatedStyle, { borderTopColor: theme.border }]}>
        <Text style={[styles.faqAnswer, { color: theme.subtext }]}>{item.answer}</Text>
      </Animated.View>
    </View>
  );
}

export default function FAQScreen() {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

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
      <LinearGradient colors={theme.background} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.back();
                  }}
                  style={[styles.backButton, { backgroundColor: "#000000" }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                Frequently Asked Questions
              </Text>
            </View>
            <View style={styles.backButtonWrapper} />
          </View>

          {/* Content Card */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, paddingHorizontal: 0 }}
            showsVerticalScrollIndicator={true}
          >
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{ borderRadius: 24, padding: 1, marginHorizontal: 8, marginBottom: 16 }}
            >
              <View style={[styles.contentCard, { backgroundColor: theme.background[0] }]}>
                <View style={styles.scrollContent}>
                  {/* Search Bar */}
                  <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='search' size={20} color={theme.subtext} style={styles.searchIcon} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.text }]}
                      placeholder='Search FAQs...'
                      placeholderTextColor={theme.subtext}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSearchQuery('')}
                        style={styles.clearButton}
                      >
                        <MaterialIcons name='close' size={20} color={theme.subtext} />
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
                          { backgroundColor: theme.card, borderColor: theme.border },
                          selectedCategory === category && { backgroundColor: theme.iconBg, borderColor: theme.accent },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedCategory(category);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            { color: theme.subtext },
                            selectedCategory === category && { color: theme.text, fontWeight: '600' },
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
                        <MaterialIcons name='help-outline' size={48} color={theme.subtext} />
                        <Text style={[styles.emptyText, { color: theme.text }]}>No FAQs found</Text>
                        <Text style={[styles.emptySubtext, { color: theme.subtext }]}>
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
                          theme={theme}
                        />
                      ))
                    )}
                  </View>

                  {/* Help Text */}
                  <View style={[styles.helpCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='support-agent' size={24} color={theme.accent} />
                    <Text style={[styles.helpTitle, { color: theme.text }]}>Still have questions?</Text>
                    <Text style={[styles.helpText, { color: theme.subtext }]}>
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
                </View>
              </View>
            </LinearGradient>
          </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 12,
    marginHorizontal: 20,
    position: 'relative',
  },
  backButtonWrapper: {
    width: 42,
    zIndex: 1,
    alignItems: 'center',
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 50,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
    marginRight: 8,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginRight: 12,
    lineHeight: 22,
  },
  faqAnswerContainer: {
    overflow: 'hidden',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 22,
    opacity: 0.65,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.65,
  },
  helpCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    opacity: 0.65,
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


