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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import { stripeService } from '@/services/stripeService';
import { clerkAuthService } from '@/services/clerkAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Try to import Clerk hooks
let useUser: any = null;
try {
  const clerkModule = require('@clerk/clerk-expo');
  useUser = clerkModule.useUser;
} catch (e) {
  // Clerk not available
}

interface Subscription {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start: number;
  current_period_end: number;
  plan: {
    id: string;
    nickname: string;
    amount: number;
  };
}

interface PaymentManagementModalProps {
  visible?: boolean;
  onClose?: () => void;
  mode?: 'modal' | 'screen';
}

export default function PaymentManagementModal({
  visible = true,
  onClose,
  mode = 'modal',
}: PaymentManagementModalProps) {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const isScreenMode = mode === 'screen';
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'cancelled'>('active');

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (isScreenMode) {
      router.back();
    }
  };

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

  useEffect(() => {
    if (visible || isScreenMode) {
      loadSubscriptions();
    }
  }, [visible, isScreenMode, userEmail, storedEmail, activeTab]);

  const getPlanInfo = (priceId: string) => {
    const plans = stripeService.getMockSubscriptionPlans();
    const plan = plans.find((p) => p.stripePriceId === priceId);
    if (plan) {
      return { name: plan.name, price: plan.price };
    }
    return null;
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const emailToUse = userEmail || storedEmail;
      if (!emailToUse) {
        console.log('⚠️ No email available for subscription fetch');
        setAllSubscriptions([]);
        setSubscriptions([]);
        setLoading(false);
        return;
      }
      
      console.log('📋 Loading subscriptions for email:', emailToUse);
      const customerSubscriptions = await stripeService.getCustomerSubscriptions(emailToUse);
      
      console.log('✅ Raw subscriptions from API:', customerSubscriptions.length);
      customerSubscriptions.forEach((sub: any) => {
        console.log('  - Subscription:', {
          id: sub.id,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
        });
      });
      
      // Filter subscriptions that are active, trialing, or set to cancel at period end
      const filteredSubscriptions = customerSubscriptions.filter(
        (sub: any) => 
          sub.status === 'active' || 
          sub.status === 'trialing' || 
          sub.cancel_at_period_end === true ||
          sub.status === 'canceled' ||
          sub.status === 'cancelled'
      );
      
      // Sort by current_period_end (most recent first)
      const sortedSubscriptions = filteredSubscriptions.sort((a: any, b: any) => {
        return (b.current_period_end || 0) - (a.current_period_end || 0);
      });
      
      // Map price IDs to plan names
      const mappedSubscriptions = sortedSubscriptions.map((sub: any) => {
        const planInfo = sub.plan?.id ? getPlanInfo(sub.plan.id) : null;
        const mapped = {
          ...sub,
          cancel_at_period_end: sub.cancel_at_period_end === true, // Explicitly check for true
          plan: {
            ...sub.plan,
            nickname: planInfo?.name || sub.plan?.nickname || 'Unknown Plan',
            amount: planInfo ? planInfo.price * 100 : (sub.plan?.amount || 0), // Convert to cents
          },
        };
        console.log('📋 Mapped subscription:', {
          id: mapped.id,
          status: mapped.status,
          cancel_at_period_end: mapped.cancel_at_period_end,
          plan: mapped.plan.nickname,
        });
        return mapped;
      });
      
      setAllSubscriptions(mappedSubscriptions);
      
      // Filter based on active tab
      const activeSubscriptions = mappedSubscriptions.filter((sub: Subscription) => {
        if (activeTab === 'active') {
          return sub.status === 'active' || sub.status === 'trialing';
        } else {
          return sub.cancel_at_period_end === true || sub.status === 'canceled' || sub.status === 'cancelled';
        }
      });
      
      // For active tab, show only the most recent one
      // For cancelled tab, show all cancelled subscriptions
      if (activeTab === 'active') {
        setSubscriptions(activeSubscriptions.length > 0 ? [activeSubscriptions[0]] : []);
      } else {
        setSubscriptions(activeSubscriptions);
      }
    } catch (error: any) {
      console.error('❌ Error loading subscriptions:', error);
      const errorMessage = error?.message || 'Failed to load subscriptions';
      if (errorMessage.includes('timed out') || errorMessage.includes('Network')) {
        console.error('⚠️ Network error - check backend connection');
      }
      setAllSubscriptions([]);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const success = await stripeService.cancelSubscription(subscriptionId);
              
              if (success) {
                Alert.alert(
                  'Subscription Cancelled',
                  'Your subscription will remain active until the end of your current billing period. You will lose access to premium features after that date.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Refresh the list after a short delay to allow Stripe to update
                        setTimeout(() => {
                          loadSubscriptions();
                        }, 1000);
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(
                  'Error',
                  'Failed to cancel subscription. Please try again or contact support.'
                );
                setLoading(false);
              }
            } catch (error: any) {
              console.error('Error cancelling subscription:', error);
              const errorMessage = error?.message || 'Failed to cancel subscription. Please try again or contact support.';
              Alert.alert('Error', errorMessage);
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getStatusInfo = (subscription: Subscription) => {
    // If subscription is set to cancel at period end, show as "Inactive"
    // Note: status may still be "active" but cancel_at_period_end will be true
    if (subscription.cancel_at_period_end === true) {
      console.log('🔴 Subscription is set to cancel:', subscription.id, 'cancel_at_period_end:', subscription.cancel_at_period_end);
      return {
        label: 'Inactive',
        color: theme.subtext,
      };
    }
    
    // Otherwise use the actual status
    switch (subscription.status) {
      case 'active':
        return {
          label: 'Active',
          color: theme.success,
        };
      case 'trialing':
        return {
          label: 'Trialing',
          color: theme.success,
        };
      case 'past_due':
        return {
          label: 'Past Due',
          color: theme.warning,
        };
      case 'canceled':
      case 'cancelled':
        return {
          label: 'Inactive',
          color: theme.subtext,
        };
      default:
        return {
          label: subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1),
          color: theme.subtext,
        };
    }
  };

  const renderSubscription = (subscription: Subscription) => {
    const statusInfo = getStatusInfo(subscription);
    console.log('🎨 Rendering subscription:', {
      id: subscription.id,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      statusLabel: statusInfo.label,
    });
    
    return (
    <View
      key={subscription.id}
      style={[
        styles.subscriptionCard,
        { 
          backgroundColor: theme.card, 
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
      ]}
    >
      <View style={styles.subscriptionHeader}>
        <View style={styles.planInfoContainer}>
          <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
            <MaterialIcons name='workspace-premium' size={24} color={theme.accent} />
          </View>
          <View style={styles.planTextContainer}>
            <Text style={[styles.planName, { color: theme.text }]}>
              {subscription.plan.nickname}
            </Text>
            <Text style={[styles.planPrice, { color: theme.accent }]}>
              {formatAmount(subscription.plan.amount)}/month
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusInfo.color + '20' },
            { borderColor: statusInfo.color, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <View style={styles.subscriptionDetails}>
        <View style={styles.detailRow}>
          <View style={[styles.detailIconContainer, { backgroundColor: theme.iconBg }]}>
            <MaterialIcons
              name='calendar-today'
              size={18}
              color={theme.accent}
            />
          </View>
          <View style={styles.detailTextContainer}>
            <Text style={[styles.detailLabel, { color: theme.subtext }]}>
              Billing Period
            </Text>
            <Text style={[styles.detailText, { color: theme.text }]}>
              {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
            </Text>
          </View>
        </View>
      </View>

      {subscription.status === 'active' && !subscription.cancel_at_period_end && (
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.error }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleCancelSubscription(subscription.id);
          }}
          disabled={loading}
        >
          <MaterialIcons name='cancel' size={18} color={theme.error} />
          <Text style={[styles.cancelButtonText, { color: theme.error }]}>
            Cancel Subscription
          </Text>
        </TouchableOpacity>
      )}
      
      {subscription.cancel_at_period_end && (
        <View style={[styles.infoBox, { backgroundColor: theme.iconBg, borderColor: theme.border }]}>
          <MaterialIcons name='info-outline' size={18} color={theme.subtext} />
          <Text style={[styles.infoText, { color: theme.subtext }]}>
            This subscription will end on {formatDate(subscription.current_period_end)}
          </Text>
        </View>
      )}
    </View>
    );
  };

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
          <View style={styles.titleContainerCentered}>
            <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Manage</Text>
            <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Subscription</Text>
          </View>
          <View style={{ width: 52 }} />
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
            <Text style={[styles.title, { color: '#FFFFFF' }]}>
              Manage Subscription
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>
      )}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'active' && styles.activeTab,
              { 
                borderColor: activeTab === 'active' ? theme.accent : theme.border,
                backgroundColor: theme.card,
              },
            ]}
            onPress={() => setActiveTab('active')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'active' ? theme.accent : theme.subtext,
                  fontWeight: activeTab === 'active' ? '600' : '400',
                },
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'cancelled' && styles.activeTab,
              { 
                borderColor: activeTab === 'cancelled' ? theme.accent : theme.border,
                backgroundColor: theme.card,
              },
            ]}
            onPress={() => setActiveTab('cancelled')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'cancelled' ? theme.accent : theme.subtext,
                  fontWeight: activeTab === 'cancelled' ? '600' : '400',
                },
              ]}
            >
              Cancelled
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading && subscriptions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color={theme.accent} />
              <Text style={[styles.loadingText, { color: theme.subtext }]}>
                Loading subscriptions...
              </Text>
            </View>
          ) : subscriptions.length > 0 ? (
            <View style={styles.subscriptionsContainer}>
              {subscriptions.map(renderSubscription)}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons 
                name={activeTab === 'active' ? 'payment' : 'cancel'} 
                size={64} 
                color={theme.subtext} 
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {activeTab === 'active' 
                  ? 'No Active Subscriptions' 
                  : 'No Cancelled Subscriptions'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                {activeTab === 'active'
                  ? 'You don\'t have any active subscriptions. Subscribe to a plan to unlock premium features.'
                  : 'You don\'t have any cancelled subscriptions.'}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
              },
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
    marginBottom: 20,
    marginHorizontal: 20,
    paddingBottom: 8,
    position: 'relative',
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  titleContainerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.15,
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
    width: 24,
    height: 24,
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  activeTab: {
    borderWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  subscriptionsContainer: {
    gap: 16,
  },
  subscriptionCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    marginBottom: 20,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  planInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planTextContainer: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  footer: {
    marginTop: 30,
    marginBottom: 40,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});
