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
  Platform,
  Linking,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PHONE_CARD_GUTTER, TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import BackButton from '@/components/ui/BackButton';
import { stripeService, resolveLiveStripePriceId } from '@/services/stripeService';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@clerk/clerk-react';
import {
  priceIdToPlanId,
  resolveBestPlanIdFromSubscriptions,
} from '@/utils/resolveSubscriptionPlan';
import { useAppleBilling } from '@/hooks/useAppleBilling';
import { openAppleSubscriptionManagement } from '@/services/appleBillingService';
import { ENTITLEMENT_FOUNDING_FULL, FOUNDING_PROFESSIONAL_FEATURES } from '@/constants/billingCatalog';

const CACHED_PLAN_KEY = 'bps.cachedPlanId';
const IOS_MINT = '#2dcc9a';
const IOS_CARD_DARK = '#1C1D20';
const IOS = Platform.OS === 'ios';

function BillingPageFrame({
  framed,
  cardColor,
  borderColor,
  children,
}: {
  framed: boolean;
  cardColor: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  if (!framed) return <>{children}</>;
  return (
    <LinearGradient
      colors={['#2DFFC4', '#00A6FF']}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={styles.gradientFrameOuter}
    >
      <View
        style={[
          styles.contentCard,
          {
            backgroundColor: cardColor,
            borderColor,
            borderWidth: 1,
          },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

export default function PaymentScreen() {
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { user: clerkUser } = useUser();
  const appleBilling = useAppleBilling();
  const [currentPlan, setCurrentPlan] = useState<{
    name: string;
    features: string[];
  } | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planCatalog, setPlanCatalog] = useState(() => stripeService.getMockSubscriptionPlans());
  const [previewActive, setPreviewActive] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (appleBilling.entitled) {
      setCurrentPlan({ name: 'Professional', features: FOUNDING_PROFESSIONAL_FEATURES });
      setSubscriptionStatus('active');
    } else {
      setCurrentPlan(null);
      setSubscriptionStatus(null);
    }
    setLoading(appleBilling.loading);
    setError(null);
  }, [appleBilling.entitled, appleBilling.loading]);

  useEffect(() => {
    stripeService.fetchSubscriptionPlans().then(setPlanCatalog).catch(() => {});
  }, []);

  let userEmail: string | null =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;
  if (!userEmail) {
    try {
      userEmail = clerkAuthService.getAuthState()?.user?.email || null;
    } catch {
      userEmail = null;
    }
  }

  // Final fallback: get email from stored profile
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [emailLoaded, setEmailLoaded] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    const failSafe = setTimeout(() => {
      if (mounted) setEmailLoaded(true);
    }, 4000);
    AsyncStorage.getItem('bps.contractorProfile')
      .then((profileData) => {
        if (!mounted) return;
        if (profileData) {
          try {
            const profile = JSON.parse(profileData);
            if (profile.email) {
              setStoredEmail(profile.email);
            }
          } catch {
            // Invalid JSON
          }
        }
      })
      .finally(() => {
        clearTimeout(failSafe);
        if (mounted) setEmailLoaded(true);
      });
    return () => {
      mounted = false;
      clearTimeout(failSafe);
    };
  }, []);

  // Use same theme system as profile page
  const theme = useMemo(() => {
    const iosApp = Platform.OS === 'ios';
    return {
      background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
      card: iosApp && darkMode ? IOS_CARD_DARK : Colors.surface2,
      text: Colors.text,
      subtext: Colors.sub,
      accent: iosApp ? IOS_MINT : Colors.primary,
      border: Colors.line,
      divider: Colors.line,
      success: iosApp ? IOS_MINT : '#4ADE80',
      warning: '#FACC15',
      error: '#F87171',
      iconBg: iosApp
        ? (darkMode ? '#3A3A3C' : '#e2e8f0')
        : (Colors.iconBg || 'rgba(67, 206, 162, 0.15)'),
    };
  }, [Colors, darkMode]);

  const isIosBilling = Platform.OS === 'ios';

  const handleSubscriptionPlans = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/plans');
  };

  const handlePaymentManagement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      try {
        openAppleSubscriptionManagement();
      } catch {
        void Linking.openURL('https://apps.apple.com/account/subscriptions');
      }
      return;
    }
    router.push('/payment/manage-subscriptions');
  };

  const iosActiveDetails = useMemo(() => {
    const entitlement = appleBilling.customerInfo?.entitlements.active?.[ENTITLEMENT_FOUNDING_FULL];
    const productId = entitlement?.productIdentifier || '';
    const previewing = previewActive && !entitlement?.isActive;
    const annual = previewing ? false : productId.includes('annual');
    const pkg = annual ? appleBilling.packages.annual : appleBilling.packages.monthly;
    const price = pkg?.product.priceString || (annual ? '$990.00' : '$99.00');
    let renewsLabel = previewing ? 'Renews Nov 9, 2026' : '';
    if (!previewing && entitlement?.expirationDate) {
      const date = new Date(entitlement.expirationDate);
      if (!Number.isNaN(date.getTime())) {
        const formatted = date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        renewsLabel = entitlement.willRenew === false ? `Access ends ${formatted}` : `Renews ${formatted}`;
      }
    }
    return {
      periodLabel: annual ? 'Annual' : 'Monthly',
      perLabel: annual ? 'per year' : 'per month',
      price,
      renewsLabel,
    };
  }, [appleBilling.customerInfo, appleBilling.packages, previewActive]);

  const handleViewInvoices = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/invoices');
  };

  const handleManageCards = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/payment/manage-cards');
  };

  // Map Stripe price IDs to plan info (catalog from backend / Stripe, matches Render STRIPE_PRICE_*).
  const getPlanInfo = (priceId: string) => {
    const plan = planCatalog.find((p) => p.stripePriceId === priceId);
    if (plan) {
      return { name: plan.name, features: plan.features };
    }
    for (const entry of planCatalog) {
      if (resolveLiveStripePriceId(entry.id, entry.stripePriceId) === priceId) {
        return { name: entry.name, features: entry.features };
      }
    }
    const planId = priceIdToPlanId(priceId, planCatalog);
    if (planId) {
      const matched = planCatalog.find((p) => p.id === planId);
      if (matched) {
        return { name: matched.name, features: matched.features };
      }
    }
    return null;
  };

  const applyPlanFromCatalogId = (planId: string | null) => {
    if (!planId) return false;
    const plan = planCatalog.find((p) => p.id === planId);
    if (!plan) return false;
    setCurrentPlan({ name: plan.name, features: plan.features });
    return true;
  };

  useEffect(() => {
    AsyncStorage.getItem(CACHED_PLAN_KEY)
      .then((cached) => {
        if (applyPlanFromCatalogId(cached)) {
          setLoading(false);
        }
      })
      .catch(() => {});
  }, [planCatalog]);

  const fetchCurrentPlan = async () => {
    try {
      console.log('🚀 fetchCurrentPlan called');
      setLoading(true);
      setError(null); // Clear any previous errors
      // Use stored email as final fallback
      const emailToUse = userEmail || storedEmail;
      console.log('📋 Fetching current plan, user email:', emailToUse || 'not available');
      console.log('📋 userEmail:', userEmail, 'storedEmail:', storedEmail);
      
      if (!emailToUse) {
        console.log('⚠️ No email available, skipping subscription fetch');
        setCurrentPlan(null);
        setError('No email found. Please ensure you are logged in.');
        return;
      }
      
      console.log('📡 Calling stripeService.getCustomerSubscriptions with email:', emailToUse);
      const subscriptions = await stripeService.getCustomerSubscriptions(emailToUse);
      console.log('📋 Subscriptions received:', subscriptions.length);

      const bestPlanId = resolveBestPlanIdFromSubscriptions(subscriptions, planCatalog);
      if (bestPlanId && applyPlanFromCatalogId(bestPlanId)) {
        await AsyncStorage.setItem(CACHED_PLAN_KEY, bestPlanId);
        const bestSub =
          subscriptions.find(
            (sub: any) =>
              priceIdToPlanId(sub.plan?.id, planCatalog) === bestPlanId &&
              (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')
          ) || subscriptions[0];
        setSubscriptionStatus(bestSub?.status || 'active');
        setError(
          bestSub?.status === 'past_due'
            ? 'Your subscription payment is past due. Please update your payment method to continue service.'
            : null
        );
        return;
      }
      
      // Log all subscriptions for debugging
      if (subscriptions.length > 0) {
        console.log('📋 All subscriptions:');
        subscriptions.forEach((sub: any, index: number) => {
          console.log(`  [${index}] ID: ${sub.id}, Status: ${sub.status}, Cancel at period end: ${sub.cancel_at_period_end}, Plan ID: ${sub.plan?.id}, Plan Nickname: ${sub.plan?.nickname}`);
        });
      } else {
        console.log('⚠️ No subscriptions returned from API. This could mean:');
        console.log('  1. No Stripe customer exists for this email');
        console.log('  2. The customer has no subscriptions');
        console.log('  3. Backend API issue');
      }
      
      // Find subscription (prioritize active/trialing, but also include past_due)
      // A past_due subscription is still a valid subscription that needs payment
      const activeSubscription = subscriptions.find(
        (sub: any) => (sub.status === 'active' || sub.status === 'trialing') && !sub.cancel_at_period_end
      ) || subscriptions.find(
        (sub: any) => sub.status === 'active' || sub.status === 'trialing'
      ) || subscriptions.find(
        (sub: any) => sub.status === 'past_due'
      );

      console.log('📋 Subscription found:', activeSubscription ? 'Yes' : 'No');
      if (activeSubscription) {
        console.log('📋 Subscription details:', {
          id: activeSubscription.id,
          status: activeSubscription.status,
          cancel_at_period_end: activeSubscription.cancel_at_period_end,
          plan_id: activeSubscription.plan?.id,
          plan_nickname: activeSubscription.plan?.nickname,
        });
        // Store the subscription status for UI display
        setSubscriptionStatus(activeSubscription.status);
      } else {
        setSubscriptionStatus(null);
      }

      if (activeSubscription && activeSubscription.plan) {
        // Get price ID from plan.id (backend includes this)
        const priceId = activeSubscription.plan.id;
        console.log('📋 Price ID from subscription:', priceId);
        
        if (priceId) {
          const planInfo = getPlanInfo(priceId);
          if (planInfo) {
            console.log('✅ Plan info found:', planInfo.name);
            setCurrentPlan(planInfo);
            // Show warning for past_due, but still display the plan
            if (activeSubscription.status === 'past_due') {
              setError('Your subscription payment is past due. Please update your payment method to continue service.');
            } else {
              setError(null);
            }
          } else {
            // Fallback: use plan nickname from Stripe
            console.log('⚠️ No plan mapping found for price ID:', priceId);
            console.log('📋 Using fallback plan name:', activeSubscription.plan.nickname);
            setCurrentPlan({
              name: activeSubscription.plan.nickname || 'Active Plan',
              features: ['Active subscription'],
            });
            if (activeSubscription.status === 'past_due') {
              setError('Your subscription payment is past due. Please update your payment method to continue service.');
            } else {
              setError(null);
            }
          }
        } else {
          // No price ID, use nickname
          console.log('⚠️ No price ID in subscription, using nickname');
          setCurrentPlan({
            name: activeSubscription.plan.nickname || 'Active Plan',
            features: ['Active subscription'],
          });
          if (activeSubscription.status === 'past_due') {
            setError('Your subscription payment is past due. Please update your payment method to continue service.');
          } else {
            setError(null);
          }
        }
      } else {
        // No subscription found
        console.log('⚠️ No subscription found');
        if (subscriptions.length > 0) {
          const statuses = subscriptions.map((s: any) => s.status).join(', ');
          console.log('📋 Available subscription statuses:', statuses);
          // Only show error if there are subscriptions but none we can display
          const displayableStatuses = ['active', 'trialing', 'past_due'];
          const hasDisplayableStatus = subscriptions.some((s: any) => displayableStatuses.includes(s.status));
          if (!hasDisplayableStatus) {
            setError(`Found ${subscriptions.length} subscription(s), but none are active. Statuses: ${statuses}`);
          }
        } else {
          setError('No subscriptions found. You may need to subscribe to a plan.');
        }
        setCurrentPlan(null);
        setSubscriptionStatus(null);
      }
    } catch (error: any) {
      console.error('❌ Error fetching current plan:', error);
      console.error('❌ Error stack:', error?.stack);
      // Show error message but don't crash
      const errorMessage = error?.message || 'Failed to load subscription';
      if (errorMessage.includes('timed out') || errorMessage.includes('Network')) {
        console.warn('⚠️ Plan fetch slow or offline — using cache if available');
        const cached = await AsyncStorage.getItem(CACHED_PLAN_KEY);
        if (cached && applyPlanFromCatalogId(cached)) {
          setError('Showing your last known plan. Pull down to refresh when back online.');
        } else {
          setError('Connection timeout. Pull down to refresh or check that the backend is running.');
        }
      } else {
        setError(errorMessage);
      }
      // Set plan to null on error
      setCurrentPlan(null);
      console.error('❌ Error details:', errorMessage);
    } finally {
      // Always clear loading so the UI never sticks on "Loading plan..." (success, error, or early return)
      setLoading(false);
    }
  };

  // Wait for AsyncStorage profile read (max ~4s fail-safe). Do not gate on Clerk `isLoaded` — if Clerk
  // never flips loaded, we would never fetch and "Loading plan..." would never clear.
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'ios') {
        void appleBilling.refresh();
        return;
      }
      if (!emailLoaded) {
        setLoading(true);
        return;
      }
      const emailToUse = userEmail || storedEmail;
      if (emailToUse) {
        console.log('🔄 useFocusEffect triggered - fetching plan with email:', emailToUse);
        fetchCurrentPlan().catch((error) => {
          console.error('❌ Unexpected error in fetchCurrentPlan:', error);
          setLoading(false);
        });
      } else {
        console.log('⏳ No email after profile load — show message without hanging');
        setLoading(false);
        setCurrentPlan(null);
        setError('No email found. Please sign in again.');
      }
    }, [appleBilling.refresh, userEmail, storedEmail, emailLoaded, planCatalog])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS === 'ios') {
      await appleBilling.refresh();
    } else {
      await fetchCurrentPlan();
    }
    setRefreshing(false);
  }, [appleBilling.refresh, userEmail, storedEmail, planCatalog]);

  return (
    <LinearGradient colors={theme.background as [string, string, string]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.pageShell, Platform.OS === 'web' && styles.pageShellWeb]}>
        {/* Header with Back Button and Title — same column as body (web) */}
        <View style={styles.headerRow}>
          <View style={styles.backButton}>
            <BackButton darkMode={darkMode} onPress={() => router.back()} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}>
              {isIosBilling ? 'Subscription' : 'Payment & Billing'}
            </Text>
            {isIosBilling ? null : (
              <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
                Plan, invoices, and cards
              </Text>
            )}
          </View>
        </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <BillingPageFrame
          framed={!isIosBilling}
          cardColor={darkMode ? Colors.cardDark : Colors.bg}
          borderColor={Colors.line}
        >
            <View style={styles.content}>
        {/* Current Plan Card */}
        <View style={[styles.currentPlanCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {loading && !currentPlan ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                Loading plan...
              </Text>
            </View>
          ) : error && !currentPlan && !isIosBilling ? (
            <View style={styles.loadingContainer}>
              <MaterialIcons name='error-outline' size={24} color={theme.error} />
              <Text style={[styles.loadingText, { color: theme.error, marginLeft: 8 }]}>
                {error}
              </Text>
            </View>
          ) : currentPlan && !isIosBilling ? (
            <>
              {loading ? (
                <Text style={[styles.loadingText, { color: theme.subtext, marginBottom: 8 }]}>
                  Updating plan…
                </Text>
              ) : null}
              {error ? (
                <Text style={[styles.loadingText, { color: theme.warning, marginBottom: 8 }]}>
                  {error}
                </Text>
              ) : null}
              <View style={styles.currentPlanHeader}>
                <View style={[styles.iconContainer, { backgroundColor: darkMode ? theme.iconBg : 'rgba(67, 206, 162, 0.25)' }]}>
                  <MaterialIcons name='workspace-premium' size={24} color={theme.accent} />
                </View>
                <View style={styles.currentPlanInfo}>
                  <Text style={[styles.currentPlanLabel, { color: darkMode ? "#FFFFFF" : "#000000" }]}>Current Plan</Text>
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
          ) : currentPlan || previewActive ? (
            <>
              <View style={styles.currentPlanHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
                  <MaterialIcons name='workspace-premium' size={24} color={theme.accent} />
                </View>
                <View style={styles.currentPlanInfo}>
                  <Text style={[styles.currentPlanLabel, { color: theme.subtext }]}>Current Plan</Text>
                  <Text style={[styles.currentPlanName, { color: theme.text }]}>Professional</Text>
                  <Text style={styles.iosStatusLine}>
                    <Text style={{ color: theme.accent, fontWeight: '700' }}>Active</Text>
                    <Text style={{ color: theme.subtext }}>{` · ${iosActiveDetails.periodLabel}`}</Text>
                  </Text>
                </View>
              </View>
              <Text style={[styles.iosPrice, { color: theme.text }]}>{iosActiveDetails.price}</Text>
              <Text style={[styles.iosPer, { color: theme.subtext }]}>{iosActiveDetails.perLabel}</Text>
              {iosActiveDetails.renewsLabel ? (
                <Text style={[styles.iosRenews, { color: theme.subtext }]}>{iosActiveDetails.renewsLabel}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.planActionButton, { backgroundColor: theme.accent }]}
                onPress={handlePaymentManagement}
                activeOpacity={0.85}
              >
                <Text style={styles.planActionText}>Manage Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.restoreLink}
                onPress={handleSubscriptionPlans}
                activeOpacity={0.7}
              >
                <Text style={[styles.restoreLinkText, { color: theme.accent }]}>Change Plan</Text>
              </TouchableOpacity>
              {__DEV__ && previewActive ? (
                <TouchableOpacity
                  style={styles.previewLink}
                  onPress={() => setPreviewActive(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.previewLinkText, { color: theme.subtext }]}>Show empty state</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.currentPlanHeader}>
                <View style={[styles.iconContainer, { backgroundColor: darkMode || IOS ? theme.iconBg : 'rgba(67, 206, 162, 0.25)' }]}>
                  <MaterialIcons name='workspace-premium' size={24} color={IOS ? theme.accent : theme.subtext} style={{ opacity: IOS ? 1 : 0.85 }} />
                </View>
                <View style={styles.currentPlanInfo}>
                  <Text style={[styles.currentPlanLabel, { color: IOS ? theme.subtext : darkMode ? "#FFFFFF" : "#000000" }]}>Current Plan</Text>
                  <Text style={[styles.currentPlanName, { color: theme.text }]}>No Active Plan</Text>
                </View>
              </View>
              <View style={styles.currentPlanDetails}>
                <Text style={[styles.planDetailText, styles.planEmptyText, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                  {isIosBilling
                    ? 'Subscribe to Professional through the App Store to unlock the full platform.'
                    : 'Subscribe to a plan to unlock premium features'}
                </Text>
              </View>
              {isIosBilling ? (
                <>
                  <TouchableOpacity
                    style={[styles.planActionButton, { backgroundColor: theme.accent }]}
                    onPress={handleSubscriptionPlans}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.planActionText}>View Plans</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.restoreLink}
                    onPress={() => {
                      void appleBilling.restore();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.restoreLinkText, { color: theme.accent }]}>
                      Restore Purchases
                    </Text>
                  </TouchableOpacity>
                  {__DEV__ ? (
                    <TouchableOpacity
                      style={styles.previewLink}
                      onPress={() => setPreviewActive(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.previewLinkText, { color: theme.subtext }]}>Preview active plan</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </View>

        {/* Web billing rows. iOS actions live on the plan card. */}
        {!isIosBilling ? (
        <>
        {IOS ? (
          <Text style={[styles.iosGroupTitle, { color: theme.subtext }]}>Subscription</Text>
        ) : null}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {IOS ? null : (
            <View style={[styles.sectionHeader, { borderBottomColor: theme.divider }]}>
              <MaterialIcons name='star' size={22} color={theme.accent} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Subscription
              </Text>
            </View>
          )}

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
                <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                  Compare and upgrade your plan
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
              style={{ opacity: darkMode ? 0.85 : 0.7 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.divider }, IOS && { borderBottomWidth: 0 }]}
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
                <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                  Update billing and cancel anytime
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
              style={{ opacity: darkMode ? 0.85 : 0.7 }}
            />
          </TouchableOpacity>
        </View>
        </>
        ) : null}

        {/* App Store receipts live in Apple subscription settings. */}
        {isIosBilling ? null : (
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
                <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                  Download past invoices and receipts
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
              style={{ opacity: darkMode ? 0.85 : 0.7 }}
            />
          </TouchableOpacity>
        </View>
        )}

        {/* Card management is Stripe billing, not App Store subscriptions. */}
        {isIosBilling ? null : (
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
                <Text style={[styles.settingSubtext, { color: theme.subtext, opacity: darkMode ? 0.85 : 0.85 }]}>
                  Add, update, or remove payment methods
                </Text>
              </View>
            </View>
            <MaterialIcons
              name='chevron-right'
              size={24}
              color={theme.subtext}
              style={{ opacity: darkMode ? 0.85 : 0.7 }}
            />
          </TouchableOpacity>
        </View>
        )}
            </View>
        </BillingPageFrame>
      </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /** Align header + card with Tax Center / profile-style narrow column on web. */
  pageShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
  },
  pageShellWeb: {
    maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  gradientFrameOuter: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
  },
  headerRow: IOS
    ? {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginTop: 52,
        marginBottom: 8,
      }
    : {
        position: 'relative',
        width: '100%',
        minHeight: 64,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 52,
        marginBottom: 12,
      },
  headerCopy: IOS
    ? { flex: 1 }
    : {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 52,
      },
  screenTitle: IOS
    ? {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.3,
      }
    : {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        textAlign: 'center',
      },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  backButton: IOS
    ? { marginRight: 12 }
    : {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
      },
  contentCard: {
    borderRadius: 23,
    overflow: 'visible',
  },
  content: {
    paddingTop: 4,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  // Current Plan Card
  currentPlanCard: {
    borderRadius: IOS ? 16 : 20,
    marginBottom: 24,
    padding: IOS ? 20 : 24,
    borderWidth: 1,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IOS ? 16 : 20,
  },
  iconContainer: {
    width: IOS ? 44 : 56,
    height: IOS ? 44 : 56,
    borderRadius: IOS ? 12 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS ? 14 : 16,
  },
  currentPlanInfo: {
    flex: 1,
  },
  currentPlanLabel: IOS
    ? {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 4,
      }
    : {
        fontSize: 13,
        color: '#CFE6FF',
        marginBottom: 4,
      },
  currentPlanName: {
    fontSize: IOS ? 20 : 16,
    fontWeight: IOS ? '700' : '600',
    letterSpacing: IOS ? -0.2 : 0,
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
  },
  planEmptyText: {
    marginLeft: 0,
    lineHeight: IOS ? 20 : 18,
    fontSize: IOS ? 14 : 13,
  },
  planActionButton: {
    marginTop: 20,
    borderRadius: IOS ? 999 : 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS ? '#050B13' : '#04120C',
  },
  iosGroupTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  restoreLink: {
    marginTop: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  iosStatusLine: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
  },
  iosPrice: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  iosPer: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
  },
  iosRenews: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 18,
  },
  previewLink: {
    marginTop: 8,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLinkText: {
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: IOS ? 16 : 20,
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
    paddingHorizontal: IOS ? 16 : 20,
    paddingVertical: IOS ? 14 : 18,
    minHeight: IOS ? 56 : undefined,
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
  },
});
