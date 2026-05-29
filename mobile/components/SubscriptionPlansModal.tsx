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
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { stripeService, resolveLiveStripePriceId } from '@/services/stripeService';
import { resolveBestPlanIdFromSubscriptions } from '@/utils/resolveSubscriptionPlan';
import { savePostCheckoutReturn } from '@/utils/postCheckoutReturn';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { BRAND_FRAME_GRADIENT_COLORS } from '@/constants/brandFrameGradient';
import WebPageShell, {
  getWebPageShellMaxWidth,
  WEB_PAGE_SHELL_HORIZONTAL_PADDING,
} from '@/components/layout/WebPageShell';

function planShortName(name: string): string {
  return name.replace(/\s+Plan\s*$/i, '').trim() || name;
}

function formatDisplayPrice(price: number): string {
  if (!Number.isFinite(price)) return '—';
  const rounded = Math.round(price * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
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
  /** After Business checkout, return user to this project tab (e.g. Team upgrade from project detail). */
  returnToProjectId?: string;
  returnTab?: string;
  onUpgradeComplete?: () => void;
}

export default function SubscriptionPlansModal({
  visible = false,
  onClose,
  mode = 'modal',
  returnToProjectId,
  returnTab = 'Team',
  onUpgradeComplete,
}: SubscriptionPlansModalProps) {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { user: clerkUser } = useUser();
  const insets = useSafeAreaInsets();
  const { width: layoutWidth } = useWindowDimensions();
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => stripeService.getMockSubscriptionPlans());
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [detectingCurrentPlan, setDetectingCurrentPlan] = useState(true);

  let userEmail: string | null =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;
  if (!userEmail) {
    try {
      const authState = clerkAuthService.getAuthState();
      userEmail = authState?.user?.email || null;
    } catch {
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
    let cancelled = false;
    stripeService.fetchSubscriptionPlans().then((next) => {
      if (!cancelled && next.length > 0) {
        setPlans(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!visible && mode !== 'screen') return;
    let cancelled = false;
    stripeService.fetchSubscriptionPlans().then((next) => {
      if (!cancelled && next.length > 0) {
        setPlans(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      setDetectingCurrentPlan(true);
      try {
        const emailToUse = userEmail || storedEmail;
        if (!emailToUse) {
          console.log('⚠️ No email available for plan fetch');
          setCurrentPlanId(null);
          return;
        }

        console.log('📋 Fetching current plan for plans modal, email:', emailToUse);
        const subscriptions = await stripeService.getCustomerSubscriptions(emailToUse);
        const bestPlanId = resolveBestPlanIdFromSubscriptions(subscriptions, plans);

        if (bestPlanId) {
          const match = plans.find((p) => p.id === bestPlanId);
          console.log('✅ Found current plan:', match?.name || bestPlanId);
          setCurrentPlanId(bestPlanId);
        } else {
          setCurrentPlanId(null);
        }
      } catch (error: any) {
        console.error('❌ Could not fetch current plan:', error);
        setCurrentPlanId(null);
      } finally {
        setDetectingCurrentPlan(false);
      }
    };

    if (plans.length > 0 && (userEmail || storedEmail)) {
      fetchCurrentPlan();
    } else if (!userEmail && !storedEmail) {
      setDetectingCurrentPlan(false);
    }
  }, [userEmail, storedEmail, plans]);

  // Align tokens with payment/index.tsx (Payment & Billing)
  const theme = useMemo(
    () => ({
      background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
      card: Colors.surface2,
      cardDark: Colors.cardDark,
      text: Colors.text,
      subtext: Colors.sub,
      accent: Colors.primary,
      border: Colors.line,
      divider: Colors.line,
      success: '#4ADE80',
      warning: '#FACC15',
      error: '#ef4444',
      iconBg: Colors.iconBg || 'rgba(67, 206, 162, 0.15)',
    }),
    [Colors]
  );

  const isScreenMode = mode === 'screen';

  /** Web: align header with WebPageShell column (same math as Profile). */
  const webPaymentScreenHeaderMargins = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    const maxW = getWebPageShellMaxWidth('profile');
    const gutter = (layoutWidth - Math.min(layoutWidth, maxW)) / 2;
    const inset = gutter + WEB_PAGE_SHELL_HORIZONTAL_PADDING;
    return { marginLeft: inset, marginRight: inset };
  }, [layoutWidth]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (isScreenMode) {
      try {
        const r = router as { canGoBack?: () => boolean; back: () => void; replace: (href: string) => void };
        if (typeof r.canGoBack === 'function' && r.canGoBack()) {
          r.back();
        } else {
          r.replace('/payment');
        }
      } catch {
        router.replace('/payment');
      }
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (detectingCurrentPlan) {
      Alert.alert('One moment', 'Still loading your current plan. Try again in a second.');
      return;
    }
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

      // Stripe requires https:// URLs. Native cannot use the marketing domain unless it hosts this app.
      // Use our API “bridge” pages that redirect to the app scheme (see backend /api/stripe/checkout-return).
      const { successUrl, cancelUrl } =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? {
              successUrl: `${window.location.origin}/payment/success`,
              cancelUrl: `${window.location.origin}/payment/cancel`,
            }
          : stripeService.getCheckoutRedirectUrls();

      try {
        // Get email to use for checkout
        const emailToUse = userEmail || storedEmail;
        console.log('📧 Using email for checkout:', emailToUse || 'will try to get from service');
        console.log('💳 Creating checkout for plan:', plan.name, 'Price ID:', plan.stripePriceId);
        
        const livePriceId = resolveLiveStripePriceId(plan.id, plan.stripePriceId);

        // Validate price ID format
        if (!livePriceId || !livePriceId.startsWith('price_')) {
          Alert.alert(
            'Invalid Plan Configuration',
            `The ${plan.name} plan has an invalid price ID. Please contact support.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          setSelectedPlan(null);
          return;
        }

        const currentPlan = currentPlanId ? plans.find((p) => p.id === currentPlanId) : null;
        const isDowngrade =
          !!currentPlan && !!plan && plan.price < currentPlan.price;
        const isPlanChange =
          !!currentPlanId &&
          !!currentPlan &&
          currentPlan.id !== plan.id &&
          currentPlan.price !== plan.price;

        if (isPlanChange) {
          const changeResult = await stripeService.changeSubscriptionPlan(
            livePriceId,
            emailToUse
          );

          if (changeResult.success) {
            setCurrentPlanId(plan.id);
            setLoading(false);
            setSelectedPlan(null);
            try {
              await AsyncStorage.setItem('bps.cachedPlanId', plan.id);
              const { setBusinessEntitlementSnapshot } = await import(
                '@/utils/businessEntitlementCache'
              );
              setBusinessEntitlementSnapshot({ hasBusiness: plan.id === 'business' });
            } catch {
              // non-blocking
            }
            onUpgradeComplete?.();
            if (plan.id !== 'business') {
              try {
                const { clearWorkspaceAccessSnapshot } = await import(
                  '@/utils/workspaceAccessCache'
                );
                await clearWorkspaceAccessSnapshot();
              } catch {
                // non-blocking
              }
            }
            Alert.alert(
              'Plan updated',
              isDowngrade
                ? `You're now on ${changeResult.planName || plan.name}. Team workspace access will update accordingly.`
                : `You're now on ${changeResult.planName || plan.name}. Team access will refresh automatically.`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    handleClose();
                  },
                },
              ]
            );
            return;
          }

          const changeError = changeResult.error || '';

          if (isDowngrade) {
            const isInactivePrice =
              /inactive|only accepts active prices/i.test(changeError);
            const isRouteMissing =
              /not found|404|change-plan/i.test(changeError);
            const isNetwork =
              changeError.includes('Network request failed') ||
              changeError.includes('Failed to connect') ||
              changeError.includes('timed out');

            if (isInactivePrice) {
              throw new Error(
                'PLAN_PRICE_INACTIVE: That plan price is inactive in Stripe. Reload the app and try again — if it persists, contact support.'
              );
            }
            if (isRouteMissing) {
              throw new Error(
                'PLAN_CHANGE_NOT_DEPLOYED: Plan downgrades need the latest backend on Render (includes /stripe/change-plan). Deploy backend, then try again.'
              );
            }
            if (isNetwork) {
              throw new Error(
                'PLAN_CHANGE_OFFLINE: Could not reach your Mac backend. Start the backend (port 3001) on the same Wi‑Fi as your phone, or deploy the latest backend to Render.'
              );
            }
            throw new Error(
              changeError ||
                'Could not downgrade your plan. Try again or contact support if this continues.'
            );
          }

          const shouldTryCheckout =
            changeError.includes('No active subscription') ||
            changeError.includes('No Stripe customer') ||
            changeError.includes('Not Found') ||
            changeError.includes('Route') ||
            changeError.includes('change-plan') ||
            /404/.test(changeError);

          if (!shouldTryCheckout) {
            throw new Error(
              changeError ||
                'Could not change your plan. Try again or contact support if this continues.'
            );
          }
        }
        
        if (returnToProjectId) {
          await savePostCheckoutReturn({
            projectId: returnToProjectId,
            tab: returnTab,
            targetPlanId: plan.id,
          });
        }

        // Create checkout session (new subscription or fallback when no active sub exists)
        const session = await stripeService.createCheckoutSession(
          livePriceId,
          successUrl,
          cancelUrl,
          emailToUse
        );

        if (session.url) {
          if (Platform.OS === 'web') {
            setLoading(false);
            setSelectedPlan(null);
            window.location.href = session.url;
            return;
          } else {
            // Clear loading BEFORE opening checkout: openBrowserAsync only resolves when the
            // user closes Safari/Chrome — otherwise the button spins the entire checkout session.
            setLoading(false);
            setSelectedPlan(null);
            const result = await WebBrowser.openBrowserAsync(session.url);

            let resolvedPlanId: string | null = null;
            try {
              const emailToRefresh = userEmail || storedEmail;
              if (emailToRefresh) {
                const subscriptions = await stripeService.getCustomerSubscriptions(emailToRefresh);
                resolvedPlanId = resolveBestPlanIdFromSubscriptions(subscriptions, plans);
                if (resolvedPlanId) {
                  await AsyncStorage.setItem('bps.cachedPlanId', resolvedPlanId);
                  const { setBusinessEntitlementSnapshot } = await import(
                    '@/utils/businessEntitlementCache'
                  );
                  setBusinessEntitlementSnapshot({ hasBusiness: resolvedPlanId === 'business' });
                  setCurrentPlanId(resolvedPlanId);
                } else if (plan.id === 'business') {
                  resolvedPlanId = plan.id;
                  await AsyncStorage.setItem('bps.cachedPlanId', plan.id);
                  const { setBusinessEntitlementSnapshot } = await import(
                    '@/utils/businessEntitlementCache'
                  );
                  setBusinessEntitlementSnapshot({ hasBusiness: true });
                  setCurrentPlanId(plan.id);
                }
              }
            } catch {
              // non-blocking — entitlement refresh on modal close still runs
            }

            const businessUnlocked =
              resolvedPlanId === 'business' ||
              (plan.id === 'business' && result.type !== 'dismiss');

            if (returnToProjectId && businessUnlocked) {
              onUpgradeComplete?.();
              handleClose();
              return;
            }

            if (result.type === 'dismiss') {
              Alert.alert(
                'Checkout closed',
                'If you completed payment, tap Refresh on the Team tab to unlock Business workspace access.',
                [{ text: 'OK', onPress: () => handleClose() }]
              );
            } else {
              setTimeout(() => {
                Alert.alert(
                  'Success!',
                  `Welcome to ${plan.name}! Your subscription is now active. Open Payment & Billing to confirm your plan.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        handleClose();
                      },
                    },
                  ]
                );
              }, 1000);
            }
          }
        } else {
          throw new Error('Stripe did not return a checkout URL.');
        }
      } catch (error: any) {
        console.error('Subscription error:', error);
        
        const errorMessage = error?.message || error?.toString() || '';
        
        // Check if it's a price not found error
        if (
          errorMessage.includes('No such price') ||
          errorMessage.includes('not been created in Stripe') ||
          errorMessage.includes('inactive')
        ) {
          Alert.alert(
            'Plan Not Available',
            `The ${plan.name} plan is not configured in Stripe yet. If you're testing locally, use the hosted backend or run backend/setup-stripe.js and set STRIPE_PRICE_BUSINESS in backend/.env.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          setSelectedPlan(null);
          return;
        }
        
        const isNetworkError =
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('Failed to connect') ||
          errorMessage.includes('NetworkError') ||
          (error?.name === 'TypeError' && errorMessage.includes('Network')) ||
          errorMessage.includes('timed out') ||
          errorMessage.startsWith('PLAN_CHANGE_OFFLINE:');

        if (errorMessage.startsWith('PLAN_CHANGE_NOT_DEPLOYED:')) {
          Alert.alert(
            'Plan change unavailable',
            errorMessage.replace(/^PLAN_CHANGE_NOT_DEPLOYED:\s*/, ''),
            [{ text: 'OK' }]
          );
        } else if (errorMessage.startsWith('PLAN_PRICE_INACTIVE:')) {
          Alert.alert(
            'Plan not available',
            errorMessage.replace(/^PLAN_PRICE_INACTIVE:\s*/, ''),
            [{ text: 'OK' }]
          );
        } else if (isNetworkError) {
          Alert.alert(
            'Connection issue',
            errorMessage.startsWith('PLAN_CHANGE_OFFLINE:')
              ? errorMessage.replace(/^PLAN_CHANGE_OFFLINE:\s*/, '')
              : 'Could not reach the billing server to update your plan. Check that you are online and try again.\n\nIf you are testing on a phone, make sure your Mac backend is running on the same Wi‑Fi (port 3001), or deploy the latest backend to Render.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Could not update plan',
            errorMessage || 'Something went wrong while updating your subscription. Please try again.',
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

  type CtaVariant = 'current' | 'primary' | 'downgrade' | 'subscribe';

  const getCtaVariant = (plan: SubscriptionPlan): CtaVariant => {
    if (currentPlanId === plan.id) return 'current';
    if (!currentPlanId) return 'subscribe';
    const currentPlan = plans.find((p) => p.id === currentPlanId);
    if (!currentPlan) return 'subscribe';
    if (plan.price > currentPlan.price) return 'primary';
    if (plan.price < currentPlan.price) return 'downgrade';
    return 'subscribe';
  };

  // Same branching as before; labels only for clarity / conversion
  const getButtonText = (plan: SubscriptionPlan): string => {
    if (currentPlanId === plan.id) {
      return 'Current plan';
    }
    if (!currentPlanId) {
      return plan.cta || `Choose ${plan.name}`;
    }
    const currentPlan = plans.find((p) => p.id === currentPlanId);
    if (!currentPlan) {
      return plan.cta || `Choose ${plan.name}`;
    }
    if (plan.price > currentPlan.price) {
      return `Upgrade to ${planShortName(plan.name)}`;
    }
    if (plan.price < currentPlan.price) {
      return `Downgrade to ${planShortName(plan.name)}`;
    }
    return plan.cta || `Choose ${plan.name}`;
  };

  type PlanBadge = { kind: 'current' | 'hero' | 'subtle'; label: string };

  const getPlanCardBadge = (plan: SubscriptionPlan): PlanBadge | null => {
    if (currentPlanId === plan.id) {
      return { kind: 'current', label: 'Current plan' };
    }
    if (plan.recommended) {
      return { kind: 'hero', label: 'Most Popular' };
    }
    if (plan.tag) {
      return { kind: 'subtle', label: plan.tag };
    }
    return null;
  };

  const isHeroCard = (plan: SubscriptionPlan) =>
    Boolean(plan.recommended && currentPlanId !== plan.id);

  const renderPlan = (plan: SubscriptionPlan) => {
    const ctaVariant = getCtaVariant(plan);
    const badge = getPlanCardBadge(plan);
    const hero = isHeroCard(plan);

    const ctaStyles = (() => {
      if (ctaVariant === 'current') {
        return {
          wrap: [
            styles.ctaButton,
            {
              backgroundColor: darkMode ? 'rgba(74, 222, 128, 0.1)' : 'rgba(22, 163, 74, 0.1)',
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: darkMode ? 'rgba(74, 222, 128, 0.35)' : 'rgba(22, 163, 74, 0.35)',
            },
          ] as const,
          text: [styles.ctaButtonText, { color: theme.success }] as const,
        };
      }
      if (ctaVariant === 'downgrade') {
        return {
          wrap: [
            styles.ctaButton,
            {
              backgroundColor: 'transparent',
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.45)',
            },
          ] as const,
          text: [styles.ctaButtonText, { color: theme.text }] as const,
        };
      }
      return {
        wrap: [styles.ctaButton, { backgroundColor: theme.accent }] as const,
        text: [styles.ctaButtonText, { color: '#FFFFFF' }] as const,
      };
    })();

    const isCurrent = currentPlanId === plan.id;

    return (
      <View
        key={plan.id}
        style={[
          styles.planSurface,
          { backgroundColor: theme.card, borderColor: theme.border },
          hero && styles.planSurfaceHero,
          isCurrent && styles.planSurfaceCurrent,
          isCurrent && {
            borderColor: darkMode ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.14)',
          },
        ]}
      >
        {hero ? (
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.planHeroTopLine}
          />
        ) : null}
        <View style={styles.planCardBody}>
          <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
          {plan.description ? (
            <Text style={[styles.planDescription, { color: theme.subtext }]}>{plan.description}</Text>
          ) : null}

          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceCurrency, { color: theme.subtext }]}>$</Text>
              <Text style={[styles.priceAmount, { color: theme.text }]}>{formatDisplayPrice(plan.price)}</Text>
              <Text style={[styles.pricePeriod, { color: theme.subtext }]}>/month</Text>
            </View>
            {badge ? (
              <View
                style={[
                  styles.planBadge,
                  badge.kind === 'hero' && [
                    styles.planBadgeHero,
                    { backgroundColor: darkMode ? 'rgba(45, 255, 196, 0.12)' : 'rgba(45, 255, 196, 0.18)' },
                  ],
                  badge.kind === 'subtle' && [
                    styles.planBadgeSubtle,
                    { backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                  ],
                  badge.kind === 'current' && [
                    styles.planBadgeCurrent,
                    {
                      backgroundColor: darkMode ? 'rgba(74, 222, 128, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                    },
                  ],
                ]}
              >
                {badge.kind === 'current' ? (
                  <MaterialIcons name="check-circle" size={14} color={theme.success} style={{ marginRight: 4 }} />
                ) : null}
                <Text
                  style={[
                    styles.planBadgeText,
                    badge.kind === 'hero' && { color: theme.accent },
                    badge.kind === 'subtle' && { color: theme.subtext },
                    badge.kind === 'current' && { color: theme.success },
                  ]}
                >
                  {badge.label}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.featuresContainer}>
            {plan.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <MaterialIcons name="check" size={18} color={theme.success} style={styles.featureCheck} />
                <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[...ctaStyles.wrap, selectedPlan === plan.id && loading && styles.ctaButtonLoading]}
            onPress={() => {
              if (currentPlanId === plan.id) {
                Alert.alert('Current Plan', `You are already subscribed to the ${plan.name}.`);
                return;
              }
              handleSubscribe(plan);
            }}
            disabled={loading || detectingCurrentPlan || currentPlanId === plan.id}
            activeOpacity={0.88}
          >
            {detectingCurrentPlan && !currentPlanId ? (
              <ActivityIndicator color={ctaVariant === 'downgrade' ? theme.text : '#fff'} />
            ) : loading && selectedPlan === plan.id ? (
              <ActivityIndicator color={ctaVariant === 'downgrade' ? theme.text : '#fff'} />
            ) : ctaVariant === 'current' ? (
              <View style={styles.ctaCurrentInner}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={[...ctaStyles.text, styles.ctaCurrentLabel]}>{getButtonText(plan)}</Text>
              </View>
            ) : (
              <Text style={ctaStyles.text}>{getButtonText(plan)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const subtitleCopy =
    'Simple pricing for serious builders. Start in minutes—upgrade or downgrade anytime.';

  const billingChromeTree = (
    <LinearGradient
      colors={['#2DFFC4', '#00A6FF']}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={styles.billingChrome}
    >
      <View
        style={[
          styles.billingInner,
          {
            backgroundColor: darkMode ? theme.cardDark : Colors.bg,
            borderColor: theme.border,
          },
        ]}
      >
        {plans.map(renderPlan)}

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.footerText, { color: theme.text }]}>Start with a 7-day free trial</Text>
          <Text style={[styles.footerMuted, { color: theme.subtext }]}>Cancel anytime · No setup fees</Text>
        </View>
      </View>
    </LinearGradient>
  );

  const content = (
    <LinearGradient colors={theme.background} style={styles.container}>
      {isScreenMode && (
        <View
          style={[
            styles.headerRow,
            webPaymentScreenHeaderMargins,
            {
              // Web: safe-area insets are usually 0 in Safari/Chrome — add space below the tab bar.
              paddingTop:
                Platform.OS === 'web'
                  ? Math.max(insets.top, 12) + 36
                  : Math.max(insets.top, 8) + 4,
            },
          ]}
        >
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
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  handleClose();
                }}
                style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? '#FFFFFF' : '#000000'} />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={styles.headerTitleBlock}>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Choose Your Plan</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>{subtitleCopy}</Text>
          </View>
        </View>
      )}
      {!isScreenMode && (
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]}>Choose Your Plan</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      )}

      <ScrollView
        style={[
          styles.content,
          isScreenMode && Platform.OS === 'web' && { paddingHorizontal: 0 },
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isScreenMode ? (
          <Text style={[styles.subtitle, { color: theme.subtext }]}>{subtitleCopy}</Text>
        ) : (
          <View style={styles.screenSubtitleSpacer} />
        )}

        {isScreenMode ? (
          <WebPageShell size="profile" scroll={false} contentStyle={{ paddingTop: 4, paddingBottom: 24 }}>
            {billingChromeTree}
          </WebPageShell>
        ) : (
          billingChromeTree
        )}
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
    alignItems: 'flex-start',
    paddingBottom: 8,
    ...(Platform.OS === 'web' ? {} : { marginHorizontal: 20 }),
    gap: 12,
  },
  headerTitleBlock: {
    flex: 1,
    paddingTop: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    letterSpacing: 0.15,
    opacity: 0.92,
  },
  backButtonWrapper: {
    marginTop: 2,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
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
    paddingBottom: 12,
    position: 'relative',
  },
  closeButton: {
    padding: 8,
    zIndex: 1,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  screenSubtitleSpacer: {
    height: 4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
    letterSpacing: 0.12,
    opacity: 0.95,
  },
  /** Same chrome as payment/index.tsx main stack */
  billingChrome: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 8,
  },
  billingInner: {
    borderRadius: 23,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 20,
    overflow: 'visible',
  },
  /** Elevated plan row: theme.card on top of cardDark (matches billing sections) */
  planSurface: {
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  planSurfaceHero: {
    borderColor: 'rgba(45, 255, 196, 0.35)',
    shadowColor: '#2DFFC4',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  planSurfaceCurrent: {
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  planHeroTopLine: {
    height: 2,
    width: '100%',
  },
  planCardBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    opacity: 0.95,
  },
  priceBlock: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  priceCurrency: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 2,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  planBadgeHero: {},
  planBadgeSubtle: {},
  planBadgeCurrent: {},
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  featuresContainer: {
    marginBottom: 14,
    paddingTop: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureCheck: {
    marginTop: 2,
    marginRight: 0,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 10,
    flex: 1,
  },
  ctaButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonLoading: {
    opacity: 0.85,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ctaCurrentInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaCurrentLabel: {
    marginLeft: 8,
  },
  footer: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.15,
  },
  footerMuted: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.85,
    letterSpacing: 0.1,
  },
});
