import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import { stripeService } from '@/services/stripeService';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Try to import Clerk hooks
let useUser: any = null;
try {
  const clerkModule = require('@clerk/clerk-expo');
  useUser = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}

export default function PaymentScreen() {
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    features: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user email from Clerk if available - use hooks properly
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
  const [emailLoaded, setEmailLoaded] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('bps.contractorProfile').then((profileData) => {
      if (!mounted) return;
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
      setEmailLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  // Use same theme system as profile page
  const theme = useMemo(() => ({
    background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    card: Colors.surface2,
    text: Colors.text,
    subtext: Colors.sub,
    accent: Colors.primary,
    border: Colors.line,
    divider: Colors.line,
    success: '#4ADE80',
    warning: '#FACC15',
    error: '#F87171',
    iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
  }), [Colors]);

  const handleSubscriptionPlans = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/plans');
  };

  const handlePaymentManagement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/manage-subscriptions');
  };

  const handleViewInvoices = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/invoices');
  };

  const handleManageCards = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/manage-cards');
  };

  // Map Stripe price IDs to plan info
  const getPlanInfo = (priceId: string) => {
    const plans = stripeService.getMockSubscriptionPlans();
    const plan = plans.find((p) => p.stripePriceId === priceId);
    if (plan) {
      console.log('✅ Plan mapped successfully:', plan.name, 'for price ID:', priceId);
      return { name: plan.name, features: plan.features };
    }
    console.log('⚠️ No plan found for price ID:', priceId);
    console.log('Available price IDs:', plans.map(p => `${p.name}: ${p.stripePriceId}`));
    return null;
  };

  const fetchCurrentPlan = async () => {
    let loadingCleared = false;
    try {
      console.log('🚀 fetchCurrentPlan called');
      setLoading(true);
      setError(null); // Clear any previous errors
      // Use stored email as final fallback
      const emailToUse = userEmail || storedEmail;
      console.log('📋 Fetching current plan, user email:', emailToUse || 'not available');
      
      if (!emailToUse) {
        console.log('⚠️ No email available, skipping subscription fetch');
        setCurrentPlan(null);
        setError(null);
        setLoading(false);
        loadingCleared = true;
        return;
      }
      
      console.log('📡 Calling stripeService.getCustomerSubscriptions...');
      const subscriptions = await stripeService.getCustomerSubscriptions(emailToUse);
      console.log('📋 Subscriptions received:', subscriptions.length);
      
      // Find active subscription (prioritize non-cancelling ones)
      const activeSubscription = subscriptions.find(
        (sub: any) => (sub.status === 'active' || sub.status === 'trialing') && !sub.cancel_at_period_end
      ) || subscriptions.find(
        (sub: any) => sub.status === 'active' || sub.status === 'trialing'
      );

      console.log('📋 Active subscription found:', activeSubscription ? 'Yes' : 'No');

      if (activeSubscription && activeSubscription.plan) {
        // Get price ID from plan.id (backend includes this)
        const priceId = activeSubscription.plan.id;
        console.log('📋 Price ID:', priceId);
        
        if (priceId) {
          const planInfo = getPlanInfo(priceId);
          if (planInfo) {
            console.log('📋 Plan info found:', planInfo.name);
            setCurrentPlan(planInfo);
          } else {
            // Fallback: use plan nickname from Stripe
            console.log('📋 Using fallback plan name:', activeSubscription.plan.nickname);
            setCurrentPlan({
              name: activeSubscription.plan.nickname || 'Active Plan',
              features: ['Active subscription'],
            });
          }
        } else {
          // No price ID, use nickname
          console.log('📋 No price ID, using nickname');
          setCurrentPlan({
            name: activeSubscription.plan.nickname || 'Active Plan',
            features: ['Active subscription'],
          });
        }
      } else {
        // No active subscription
        console.log('📋 No active subscription found');
        setCurrentPlan(null);
      }
    } catch (error: any) {
      console.error('❌ Error fetching current plan:', error);
      // Show error message but don't crash
      const errorMessage = error?.message || 'Failed to load subscription';
      if (errorMessage.includes('timed out') || errorMessage.includes('Network')) {
        console.error('⚠️ Network error - check backend connection');
      }
      // Set plan to null on error
      setCurrentPlan(null);
      // Set error message
      const errorMsg = error?.message || 'Failed to load subscription';
      setError(errorMsg);
      console.error('❌ Error details:', errorMsg);
    } finally {
      if (!loadingCleared) {
        console.log('✅ Clearing loading state (finally block)');
        setLoading(false);
        loadingCleared = true;
      }
    }
  };

  // Fetch plan on mount and when screen comes into focus
  // Only fetch once email is loaded to avoid infinite loops
  useFocusEffect(
    React.useCallback(() => {
      // Only fetch if we have an email OR if email has finished loading (even if null)
      const emailToUse = userEmail || storedEmail;
      if (emailToUse || emailLoaded) {
        console.log('🔄 useFocusEffect triggered - fetching plan with email:', emailToUse || 'none');
        fetchCurrentPlan().catch((error) => {
          // Ensure loading is cleared even if there's an unexpected error
          console.error('❌ Unexpected error in fetchCurrentPlan:', error);
          setLoading(false);
        });
      } else {
        // Email not loaded yet, set loading to false so we don't show spinner
        console.log('⏳ Waiting for email to load...');
        setLoading(false);
      }
    }, [userEmail, storedEmail, emailLoaded])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchCurrentPlan();
    setRefreshing(false);
  }, [userEmail, storedEmail]);

  return (
    <LinearGradient colors={theme.background as [string, string, string]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header with Back Button and Title */}
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Payment & Billing</Text>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, paddingHorizontal: 0 }}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{ borderRadius: 24, padding: 1, marginHorizontal: 8, marginBottom: 16 }}
        >
          <View style={[styles.contentCard, { backgroundColor: Colors.bg }]}>
            <View style={styles.content}>
        {/* Current Plan Card */}
        <View style={[styles.currentPlanCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.subtext }]}>
                Loading plan...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.loadingContainer}>
              <MaterialIcons name='error-outline' size={24} color={theme.error} />
              <Text style={[styles.loadingText, { color: theme.error, marginLeft: 8 }]}>
                {error}
              </Text>
            </View>
          ) : currentPlan ? (
            <>
              <View style={styles.currentPlanHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='workspace-premium' size={24} color={theme.accent} />
                </View>
                <View style={styles.currentPlanInfo}>
                  <Text style={[styles.currentPlanLabel, { color: theme.subtext }]}>Current Plan</Text>
                  <Text style={[styles.currentPlanName, { color: theme.text }]}>{currentPlan.name}</Text>
                </View>
              </View>
              <View style={styles.currentPlanDetails}>
                {currentPlan.features.slice(0, 3).map((feature, index) => (
                  <View key={index} style={styles.planDetailRow}>
                    <MaterialIcons name='check-circle' size={18} color={theme.success} />
                    <Text style={[styles.planDetailText, { color: theme.text }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.currentPlanHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='workspace-premium' size={24} color={theme.subtext} />
                </View>
                <View style={styles.currentPlanInfo}>
                  <Text style={[styles.currentPlanLabel, { color: theme.subtext }]}>Current Plan</Text>
                  <Text style={[styles.currentPlanName, { color: theme.text }]}>No Active Plan</Text>
                </View>
              </View>
              <View style={styles.currentPlanDetails}>
                <Text style={[styles.planDetailText, { color: theme.subtext }]}>
                  Subscribe to a plan to unlock premium features
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Subscription Section */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: theme.divider }]}>
            <MaterialIcons name='star' size={22} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Subscription
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.settingItem,
              styles.settingItemFirst,
              { borderBottomColor: theme.divider },
            ]}
            onPress={handleSubscriptionPlans}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                <MaterialIcons name='upgrade' size={20} color={theme.accent} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.text }]}>
                  View Plans
                </Text>
                <Text style={[styles.settingSubtext, { color: theme.subtext }]}>
                  Compare and upgrade your plan
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.divider }]}
            onPress={handlePaymentManagement}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                <MaterialIcons
                  name='credit-card'
                  size={20}
                  color={theme.accent}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.text }]}>
                  Manage Subscription
                </Text>
                <Text style={[styles.settingSubtext, { color: theme.subtext }]}>
                  Update billing and cancel anytime
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
            />
          </TouchableOpacity>
        </View>

        {/* Billing History Section */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: theme.divider }]}>
            <MaterialIcons name='receipt-long' size={22} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Billing History
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.settingItem,
              styles.settingItemFirst,
              { borderBottomColor: theme.divider },
            ]}
            onPress={handleViewInvoices}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                <MaterialIcons name='receipt' size={20} color={theme.accent} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.text }]}>
                  View Invoices
                </Text>
                <Text style={[styles.settingSubtext, { color: theme.subtext }]}>
                  Download past invoices and receipts
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
            />
          </TouchableOpacity>
        </View>

        {/* Payment Methods Section */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: theme.divider }]}>
            <MaterialIcons name='payment' size={22} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Payment Methods
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.settingItem,
              styles.settingItemFirst,
              { borderBottomColor: theme.divider },
            ]}
            onPress={handleManageCards}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: theme.iconBg }]}>
                <MaterialIcons name='credit-card' size={20} color={theme.accent} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.text }]}>
                  Manage Cards
                </Text>
                <Text style={[styles.settingSubtext, { color: theme.subtext }]}>
                  Add, update, or remove payment methods
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
            />
          </TouchableOpacity>
        </View>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </LinearGradient>
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
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  // Current Plan Card
  currentPlanCard: {
    borderRadius: 20,
    marginBottom: 24,
    padding: 24,
    borderWidth: 1,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  currentPlanInfo: {
    flex: 1,
  },
  currentPlanLabel: {
    fontSize: 13,
    color: '#CFE6FF',
    marginBottom: 4,
    opacity: 0.65,
  },
  currentPlanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currentPlanDetails: {
    marginTop: 4,
  },
  planDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planDetailText: {
    fontSize: 13,
    color: '#CFE6FF',
    marginLeft: 10,
    opacity: 0.65,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
  },
  // Section Styles
  section: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingItemFirst: {
    borderTopWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.15)',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 13,
    color: '#CFE6FF',
    opacity: 0.65,
  },
});
