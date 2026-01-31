import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { stripeService } from '@/services/stripeService';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';

// Try to import Clerk hooks
let useUser: any = null;
try {
  const clerkModule = require('@clerk/clerk-expo');
  useUser = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  stripePriceId: string;
  description?: string;
  tag?: string;
  cta?: string;
  recommended?: boolean;
}

interface SubscriptionPlansModalProps {
  visible?: boolean;
  onClose?: () => void;
  mode?: 'modal' | 'screen';
}

export default function SubscriptionPlansModal({
  visible = false,
  onClose,
  mode = 'modal',
}: SubscriptionPlansModalProps) {
  console.log('🎭 SubscriptionPlansModal rendered with visible:', visible);
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  console.log('🔄 Loading state:', loading);

  // Get user email from Clerk if available
  let userEmail: string | null = null;
  if (useUser) {
    try {
      const { user } = useUser();
      userEmail = user?.emailAddresses?.[0]?.emailAddress || 
                  user?.primaryEmailAddress?.emailAddress || 
                  null;
    } catch (e) {
      // Not in ClerkProvider or Clerk not available
    }
  }

  // Fallback to clerkAuthService
  if (!userEmail) {
    try {
      const authState = clerkAuthService.getAuthState();
      userEmail = authState?.user?.email || null;
    } catch (e) {
      // Could not get email
    }
  }

  // Final fallback: get email from stored profile
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('bps.contractorProfile').then((profileData) => {
      if (profileData) {
        try {
          const profile = JSON.parse(profileData);
          if (profile.email) {
            setStoredEmail(profile.email);
          }
        } catch (e) {
          // Invalid JSON
        }
      }
    });
  }, []);

  useEffect(() => {
    // Load subscription plans
    const subscriptionPlans = stripeService.getMockSubscriptionPlans();
    setPlans(subscriptionPlans);
    
    // Fetch current plan to show which one the user has
    const fetchCurrentPlan = async () => {
      try {
        const emailToUse = userEmail || storedEmail;
        if (!emailToUse) {
          console.log('⚠️ No email available for plan fetch');
          return;
        }
        
        console.log('📋 Fetching current plan for plans modal, email:', emailToUse);
        const subscriptions = await stripeService.getCustomerSubscriptions(emailToUse);
        const activeSubscription = subscriptions.find(
          (sub: any) => (sub.status === 'active' || sub.status === 'trialing') && !sub.cancel_at_period_end
        ) || subscriptions.find(
          (sub: any) => sub.status === 'active' || sub.status === 'trialing'
        );
        
        if (activeSubscription && activeSubscription.plan) {
          const priceId = activeSubscription.plan.id;
          // Find which plan matches this price ID
          const currentPlan = subscriptionPlans.find(p => p.stripePriceId === priceId);
          if (currentPlan) {
            console.log('✅ Found current plan:', currentPlan.name);
            setCurrentPlanId(currentPlan.id);
          } else {
            console.log('⚠️ No matching plan found for price ID:', priceId);
          }
        }
      } catch (error: any) {
        console.error('❌ Could not fetch current plan:', error);
        // Don't set current plan on error - that's okay, buttons will still work
      }
    };
    
    if (userEmail || storedEmail) {
      fetchCurrentPlan();
    }
  }, [userEmail, storedEmail]);

  // Use same theme system as payment page
  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    success: '#4ADE80',
    warning: '#FACC15',
    error: '#ef4444',
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

  const isScreenMode = mode === 'screen';

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (isScreenMode) {
      router.back();
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      console.log('🚀 Starting subscription for plan:', plan);
      console.log('🚀 handleSubscribe function called successfully');
      console.log('🚀 Plan ID:', plan.id, 'Plan name:', plan.name);
      setSelectedPlan(plan.id);
      setLoading(true);

      // Haptic feedback (only on mobile)
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Create success and cancel URLs - use current origin for web
      const baseUrl =
        Platform.OS === 'web'
          ? window.location.origin
          : 'https://build-profit-solutions.com';

      const successUrl = `${baseUrl}/payment/success`;
      const cancelUrl = `${baseUrl}/payment/cancel`;

      try {
        // Get email to use for checkout
        const emailToUse = userEmail || storedEmail;
        console.log('📧 Using email for checkout:', emailToUse || 'will try to get from service');
        console.log('💳 Creating checkout for plan:', plan.name, 'Price ID:', plan.stripePriceId);
        
        // Validate price ID format
        if (!plan.stripePriceId || !plan.stripePriceId.startsWith('price_')) {
          Alert.alert(
            'Invalid Plan Configuration',
            `The ${plan.name} plan has an invalid price ID. Please contact support.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          setSelectedPlan(null);
          return;
        }
        
        // Create checkout session
        const session = await stripeService.createCheckoutSession(
          plan.stripePriceId,
          successUrl,
          cancelUrl,
          emailToUse
        );

        if (session.url) {
          if (Platform.OS === 'web') {
            // On web, open in same tab
            window.location.href = session.url;
          } else {
            // On mobile, use WebBrowser
            const result = await WebBrowser.openBrowserAsync(session.url);

            if (result.type === 'dismiss') {
              Alert.alert('Cancelled', 'Subscription was cancelled.');
            } else {
              // User completed checkout - subscription should be created
              // Wait a moment for Stripe to process, then show success
              setTimeout(() => {
                Alert.alert(
                  'Success!',
                  `Welcome to ${plan.name}! Your subscription is now active. Please refresh the payment page to see your active plan.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        handleClose();
                        // Trigger a refresh event that the payment page can listen to
                        // This will be handled by useFocusEffect when navigating back
                      },
                    },
                  ]
                );
              }, 1000);
            }
          }
        }
      } catch (error: any) {
        console.error('Subscription error:', error);
        
        const errorMessage = error?.message || error?.toString() || '';
        
        // Check if it's a price not found error
        if (errorMessage.includes('No such price') || errorMessage.includes('not been created in Stripe')) {
          Alert.alert(
            'Plan Not Available',
            errorMessage || `The ${plan.name} plan needs to be created in Stripe. Please contact support or create the plan in your Stripe Dashboard.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          setSelectedPlan(null);
          return;
        }
        
        // Check for network errors in multiple ways
        const isNetworkError = 
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('NetworkError') ||
          error?.name === 'TypeError' && errorMessage.includes('Network');
        
        // If network error, show demo mode option
        if (isNetworkError) {
          Alert.alert(
            'Demo Mode',
            `In demo mode, we'll simulate subscribing to ${plan.name} ($${plan.price}/month). In production, this would redirect to Stripe checkout.`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Continue Demo',
                onPress: () => {
                  // Simulate successful subscription
                  Alert.alert(
                    'Demo Subscription',
                    `You've successfully subscribed to ${plan.name}!\n\nPrice: $${plan.price}/month\n\nIn production, you would be redirected to Stripe to complete payment.`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          handleClose();
                        },
                      },
                    ]
                  );
                },
              },
            ]
          );
        } else {
          // Other errors
          Alert.alert(
            'Error',
            'Failed to initiate subscription. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  // Helper function to get button text based on current plan
  const getButtonText = (plan: SubscriptionPlan): string => {
    if (currentPlanId === plan.id) {
      return 'Current Plan';
    }
    
    if (!currentPlanId) {
      // No current plan, use the plan's default CTA
      return plan.cta || `Choose ${plan.name}`;
    }
    
    // Find current plan to compare prices
    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (!currentPlan) {
      return plan.cta || `Choose ${plan.name}`;
    }
    
    // Compare prices to determine upgrade/downgrade
    if (plan.price > currentPlan.price) {
      // Higher price = upgrade
      return 'Upgrade';
    } else if (plan.price < currentPlan.price) {
      // Lower price = downgrade
      return `Downgrade to ${plan.name}`;
    } else {
      // Same price (shouldn't happen, but fallback)
      return plan.cta || `Choose ${plan.name}`;
    }
  };

  const renderPlan = (plan: SubscriptionPlan) => (
    <LinearGradient
      key={plan.id}
      colors={["#2DFFC4", "#00A6FF"]}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={{ borderRadius: 24, padding: 1, marginBottom: 20 }}
    >
      <View
        style={[
          styles.planCard,
          {
            backgroundColor: Colors.bg,
            borderColor: plan.recommended ? theme.accent : theme.border,
            shadowOpacity: plan.recommended ? 0.15 : 0.08,
            shadowRadius: plan.recommended ? 14 : 12,
          },
        ]}
      >
      <View style={styles.planHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planName, { color: theme.text }]}>
              {plan.name}
            </Text>
            {plan.recommended && (
              <View
                style={[
                  styles.recommendedBadge,
                  { backgroundColor: theme.accent + '20', borderColor: theme.accent },
                ]}
              >
                <Text style={[styles.recommendedBadgeText, { color: theme.accent }]}>
                  Recommended
                </Text>
              </View>
            )}
            {currentPlanId === plan.id && (
              <View
                style={[
                  styles.recommendedBadge,
                  { backgroundColor: theme.success + '20', borderColor: theme.success, marginLeft: 8 },
                ]}
              >
                <Text style={[styles.recommendedBadgeText, { color: theme.success }]}>
                  Current Plan
                </Text>
              </View>
            )}
          </View>
          {plan.description && (
            <Text style={[styles.planDescription, { color: theme.subtext }]}>
              {plan.description}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.planPrice, { color: theme.accent }]}>
            ${plan.price}/month
          </Text>
          {plan.tag && (
            <View style={[styles.planTag, { backgroundColor: theme.iconBg }]}>
              <Text style={[styles.planTagText, { color: theme.accent }]}>{plan.tag}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <MaterialIcons name='check' size={20} color={theme.success} />
            <Text style={[styles.featureText, { color: theme.text }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.subscribeButton,
          { backgroundColor: currentPlanId === plan.id ? theme.subtext : theme.accent },
          selectedPlan === plan.id && styles.subscribeButtonDisabled,
        ]}
        onPress={() => {
          if (currentPlanId === plan.id) {
            Alert.alert('Current Plan', `You are already subscribed to the ${plan.name}.`);
            return;
          }
          console.log('🔘 Subscribe Now button clicked for plan:', plan.id);
          console.log('🔘 Plan details:', plan);
          console.log('🔘 About to call handleSubscribe');
          handleSubscribe(plan);
        }}
        disabled={loading || currentPlanId === plan.id}
      >
        {loading && selectedPlan === plan.id ? (
          <ActivityIndicator color='#fff' />
        ) : (
          <Text style={styles.subscribeButtonText}>
            {getButtonText(plan)}
          </Text>
        )}
      </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const content = (
    <LinearGradient colors={theme.background} style={styles.container}>
      {isScreenMode && (
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
                  handleClose();
                }}
                style={[styles.backButton, { backgroundColor: darkMode ? "#000000" : "#FFFFFF" }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Choose Your Plan</Text>
          </View>
        </View>
      )}
      {!isScreenMode && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
          >
            <MaterialIcons
              name="close"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: '#FFFFFF' }]}>Choose Your Plan</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Select the plan that best fits your business needs
        </Text>

        {plans.map(renderPlan)}

        <View
          style={[
            styles.footer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.footerText, { color: theme.subtext }]}>
            Start with a 7-day free trial
          </Text>
          <Text style={[styles.footerText, { color: theme.subtext }]}>
            Cancel anytime • No setup fees
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );

  if (isScreenMode) {
    return <View style={{ flex: 1 }}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onShow={() => console.log('🎭 Modal is now visible!')}
      onRequestClose={handleClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 20,
    position: 'relative',
  },
  closeButton: {
    padding: 8,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  planCard: {
    borderRadius: 23,
    padding: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  planHeader: {
    marginBottom: 20,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  planTag: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recommendedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  recommendedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  subscribeButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
});
