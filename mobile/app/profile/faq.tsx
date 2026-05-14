import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import * as Haptics from 'expo-haptics';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import WebPageShell from '@/components/layout/WebPageShell';
import {
  PROFILE_HELP_CHROME_H_MARGIN,
  useWebProfileHelpHeaderMargins,
} from '@/lib/useWebProfileHelpHeaderMargins';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { leadSourcesFaqAnswer } from '@/lib/leads/leadSourcesHelp';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'billing' | 'technical' | 'features' | 'account';
  bestFor?: string; // Contextual cue for when this is relevant
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
      'Our AI analyzes lead data including project type, budget, location, and timeline to generate a Perfect Fit score. This score helps you prioritize leads that best match your business profile and preferences. AI recommendations, not automatic changes—you decide which leads to pursue.',
    category: 'features',
    bestFor: 'Prioritizing new leads',
  },
  {
    id: '4-lead-sources',
    question: 'How do leads show up in my app?',
    answer: leadSourcesFaqAnswer(),
    category: 'features',
    bestFor: 'Leads tab and Find Subcontractors',
  },
  {
    id: '5',
    question: 'Can I create estimates with materials pricing?',
    answer:
      'Yes! The Estimate Generator includes integrated materials pricing from major retailers. You can search for materials, add them to your estimate, and automatically calculate costs with current pricing.',
    category: 'features',
    bestFor: 'Creating accurate estimates',
  },
  {
    id: '6',
    question: 'What AI features are available?',
    answer:
      'Build Profit Solutions includes AI-powered lead scoring, budget forecasting, expense validation, predictive analytics, and automated contract generation to help you make smarter business decisions. AI assists—you\'re always in control. Nothing is submitted without your review, and all AI recommendations require your approval before any changes are made.',
    category: 'features',
  },
  // Behavioral FAQs
  {
    id: '6a',
    question: 'What happens after I submit a bid?',
    answer:
      'After you submit a bid, it\'s sent to your client for review. You can track the status in your Leads tab. If the client accepts, you can mark it as "Won" and it will automatically convert to an active project with budget tracking enabled. You\'ll be able to monitor expenses, timeline, and progress all in one place.',
    category: 'features',
    bestFor: 'Understanding the estimate-to-project flow',
  },
  {
    id: '6b',
    question: 'What happens if I win a project?',
    answer:
      'When you mark a bid as "Won", it becomes an active project. Your estimate budget is locked in as the baseline, and you can start tracking actual expenses against it. The project moves to your Projects tab where you can manage timeline, payments, team assignments, and monitor budget health in real time.',
    category: 'features',
    bestFor: 'New projects and budget tracking',
  },
  {
    id: '6c',
    question: 'Can I edit an estimate after submitting?',
    answer:
      'Yes, you can edit estimates after submitting. Changes are tracked automatically, and you can send updated versions to your client. If the project has already been marked as "Won", edits will be reflected as change orders that you can approve or adjust.',
    category: 'features',
    bestFor: 'Making updates to submitted bids',
  },
  // Billing
  {
    id: '7',
    question: 'What are the subscription plans?',
    answer:
      'You can upgrade, downgrade, or cancel anytime—no contracts. We offer three subscription plans: Basic ($39/month), Professional ($89/month), and Business ($179/month). Each plan includes different features and limits, and you can change your plan at any time from your Profile settings.',
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
    bestFor: 'Working offline or switching devices',
  },
  {
    id: '13',
    question: 'Can I export my data?',
    answer:
      'Yes, you can export your leads, projects, and estimates from the relevant sections. Look for the export or share button in each section to download your data as PDF or CSV.',
    category: 'technical',
    bestFor: 'Accountants, reports, client sharing',
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

function FAQItemAnswerBody({
  item,
  theme,
  darkMode,
}: {
  item: FAQItem;
  theme: any;
  darkMode: boolean;
}) {
  return (
    <>
      {item.bestFor && (
        <Text style={[styles.bestForText, { color: theme.accent, opacity: 0.8 }]}>
          Best for: {item.bestFor}
        </Text>
      )}
      <Text
        style={[
          styles.faqAnswer,
          { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 },
          item.bestFor && { marginTop: 8 },
        ]}
      >
        {item.answer}
      </Text>
    </>
  );
}

/** Web: Reanimated layout on `Animated.View` is unreliable inside nested scroll on RN Web. */
function FAQItemWeb({
  item,
  isExpanded,
  onToggle,
  theme,
  darkMode,
}: {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
  theme: any;
  darkMode: boolean;
}) {
  return (
    <View style={[styles.faqItem, { borderBottomColor: theme.border }]}>
      <TouchableOpacity style={styles.faqHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.accent}
        />
      </TouchableOpacity>
      {isExpanded ? (
        <View style={[styles.faqAnswerContainer, styles.faqAnswerContainerWeb, { borderTopColor: theme.border }]}>
          <FAQItemAnswerBody item={item} theme={theme} darkMode={darkMode} />
        </View>
      ) : null}
    </View>
  );
}

function FAQItemNative({
  item,
  isExpanded,
  onToggle,
  theme,
  darkMode,
}: {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
  theme: any;
  darkMode: boolean;
}) {
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
    maxHeight: interpolate(height.value, [0, 1], [0, 4000]),
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.faqItem, { borderBottomColor: theme.border }]}>
      <TouchableOpacity style={styles.faqHeader} onPress={onToggle} activeOpacity={0.7}>
        <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.accent}
        />
      </TouchableOpacity>
      <Animated.View style={[styles.faqAnswerContainer, animatedStyle, { borderTopColor: theme.border }]}>
        <FAQItemAnswerBody item={item} theme={theme} darkMode={darkMode} />
      </Animated.View>
    </View>
  );
}

function FAQItemComponent({
  item,
  isExpanded,
  onToggle,
  theme,
  darkMode,
}: {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
  theme: any;
  darkMode: boolean;
}) {
  if (Platform.OS === 'web') {
    return (
      <FAQItemWeb item={item} isExpanded={isExpanded} onToggle={onToggle} theme={theme} darkMode={darkMode} />
    );
  }
  return (
    <FAQItemNative item={item} isExpanded={isExpanded} onToggle={onToggle} theme={theme} darkMode={darkMode} />
  );
}

export default function FAQScreen() {
  const router = useRouter();
  const webHelpHeaderMargins = useWebProfileHelpHeaderMargins();
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
          {Platform.OS === 'web' ? (
            <HelpSupportSubpageWebHeader
              title='Frequently Asked Questions'
              darkMode={darkMode}
              lightBg={Colors.bg}
              webHelpHeaderMargins={webHelpHeaderMargins}
            />
          ) : (
            <View style={[styles.headerRow, webHelpHeaderMargins]}>
              <View style={styles.backButtonWrapper}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.back();
                    }}
                    style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>
                  Frequently Asked Questions
                </Text>
              </View>
              <View style={styles.backButtonWrapper} />
            </View>
          )}

          {/* Content Card */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: Platform.OS === 'web' ? 0 : 16,
              paddingBottom: 40,
              paddingHorizontal: 0,
            }}
            showsVerticalScrollIndicator={true}
          >
            <WebPageShell size="profile" scroll={false} contentStyle={{ paddingBottom: 0 }}>
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.chromeFrame}
            >
              <View
                style={[
                  styles.contentCard,
                  {
                    backgroundColor: darkMode ? Colors.cardDark : Colors.bg,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.scrollContent}>
                  {/* Search Bar */}
                  <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='search' size={20} color={theme.subtext} style={[styles.searchIcon, { opacity: darkMode ? 0.85 : 1 }]} />
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
                        <MaterialIcons name='close' size={20} color={theme.subtext} style={{ opacity: darkMode ? 0.85 : 1 }} />
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
                            { color: theme.subtext, opacity: (selectedCategory !== category && darkMode) ? 0.85 : 1 },
                            selectedCategory === category && { color: theme.text, fontWeight: '600', opacity: 1 },
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
                        <MaterialIcons name='help-outline' size={48} color={theme.subtext} style={{ opacity: darkMode ? 0.85 : 1 }} />
                        <Text style={[styles.emptyText, { color: theme.text }]}>No FAQs found</Text>
                        <Text style={[styles.emptySubtext, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
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
                          darkMode={darkMode}
                        />
                      ))
                    )}
                  </View>

                  {/* Help Text */}
                  <View style={[styles.helpCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <MaterialIcons name='support-agent' size={24} color={theme.accent} />
                    <Text style={[styles.helpTitle, { color: theme.text }]}>Still have questions?</Text>
                    <Text style={[styles.helpText, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
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
            </WebPageShell>
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
    ...(Platform.OS === 'web' ? {} : { marginHorizontal: 20 }),
    position: 'relative',
  },
  chromeFrame: {
    borderRadius: 24,
    padding: 1,
    marginHorizontal: PROFILE_HELP_CHROME_H_MARGIN,
    marginBottom: 16,
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
  /** Web: parent `overflow: 'hidden'` + animated maxHeight breaks answer layout in RN Web. */
  faqAnswerContainerWeb: {
    overflow: 'visible',
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 22,
  },
  bestForText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
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


