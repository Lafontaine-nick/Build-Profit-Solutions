import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { paymentMethodService, PaymentMethod } from '@/services/paymentMethodService';
import { stripeService } from '@/services/stripeService';
import * as Haptics from 'expo-haptics';

interface PaymentMethodsListProps {
  mode?: 'modal' | 'screen';
  visible?: boolean;
  onClose?: () => void;
}

export default function PaymentMethodsList({
  mode = 'screen',
  visible = true,
  onClose,
}: PaymentMethodsListProps) {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const isScreenMode = mode === 'screen';
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  // Get user email from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('bps.contractorProfile').then((profileData) => {
      if (profileData) {
        try {
          const profile = JSON.parse(profileData);
          if (profile.email) {
            setUserEmail(profile.email);
          }
        } catch (e) {
          // Invalid JSON
        }
      }
    });
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('💳 Loading payment methods for:', userEmail);
      const data = await paymentMethodService.getPaymentMethods(userEmail);
      console.log('✅ Payment methods loaded:', data?.length || 0, 'methods');
      setPaymentMethods(data || []);
    } catch (err: any) {
      console.error('❌ Error loading payment methods:', err);
      setError(err?.message || 'Failed to load payment methods.');
      setPaymentMethods([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if ((visible || isScreenMode) && userEmail) {
      loadPaymentMethods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isScreenMode, userEmail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPaymentMethods();
  }, [loadPaymentMethods]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (isScreenMode) {
      router.back();
    }
  };

  const handleAddCard = () => {
    if (!userEmail) {
      Alert.alert('Error', 'Please log in to add a payment method.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAddModal(true);
  };

  const handleContinueToAddCard = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'Please log in to add a payment method.');
      setShowAddModal(false);
      return;
    }

    try {
      setAddingPaymentMethod(true);
      setShowAddModal(false); // Close the modal

      const { successUrl, cancelUrl } =
        Platform.OS === 'web'
          ? {
              successUrl: `${(window as any).location.origin}/payment/manage-cards?setup=success`,
              cancelUrl: `${(window as any).location.origin}/payment/manage-cards?setup=cancel`,
            }
          : stripeService.getPaymentMethodCheckoutRedirectUrls();

      console.log('💳 Creating checkout session for payment method');
      const { url } = await paymentMethodService.createCheckoutSessionForPaymentMethod(
        userEmail,
        successUrl,
        cancelUrl
      );

      if (url) {
        if (Platform.OS === 'web') {
          // On web, open in same tab
          (window as any).location.href = url;
        } else {
          // On mobile, use WebBrowser
          const result = await WebBrowser.openBrowserAsync(url);

          if (result.type === 'dismiss') {
            Alert.alert('Cancelled', 'Payment method addition was cancelled.');
          } else {
            // User completed checkout - payment method should be added
            // Wait a moment for Stripe to process, then refresh
            setTimeout(async () => {
              await loadPaymentMethods();
              Alert.alert(
                'Success!',
                'Payment method added successfully!',
                [
                  {
                    text: 'OK',
                  },
                ]
              );
            }, 1500);
          }
        }
      }
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      Alert.alert('Error', error?.message || 'Failed to add payment method. Please try again.');
    } finally {
      setAddingPaymentMethod(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await paymentMethodService.setDefaultPaymentMethod(paymentMethodId, userEmail);
      Alert.alert('Success', 'Default payment method updated.');
      await loadPaymentMethods();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update default payment method.');
    }
  };

  const handleDelete = async (paymentMethodId: string, last4: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete card ending in ${last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentMethodService.deletePaymentMethod(paymentMethodId);
              Alert.alert('Success', 'Payment method deleted.');
              await loadPaymentMethods();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete payment method.');
            }
          },
        },
      ]
    );
  };

  const getCardIcon = (brand: string) => {
    const brandLower = brand?.toLowerCase() || '';
    if (brandLower.includes('visa')) return 'credit-card';
    if (brandLower.includes('mastercard')) return 'credit-card';
    if (brandLower.includes('amex') || brandLower.includes('american')) return 'credit-card';
    if (brandLower.includes('discover')) return 'credit-card';
    return 'credit-card';
  };

  const formatCardNumber = (last4: string) => {
    return `•••• •••• •••• ${last4}`;
  };

  const renderPaymentMethod = (method: PaymentMethod) => (
    <View
      key={method.id}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={[styles.cardIconContainer, { backgroundColor: theme.iconBg }]}>
            <MaterialIcons name={getCardIcon(method.brand) as any} size={24} color={theme.accent} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardBrand, { color: theme.text }]}>
              {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Card'}
            </Text>
            <Text style={[styles.cardNumber, { color: theme.subtext }]}>
              {formatCardNumber(method.last4)}
            </Text>
            {method.expMonth && method.expYear && (
              <Text style={[styles.cardExpiry, { color: theme.subtext }]}>
                Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
              </Text>
            )}
          </View>
        </View>
        {method.isDefault && (
          <View style={[styles.defaultBadge, { backgroundColor: theme.success + '20' }]}>
            <Text style={[styles.defaultText, { color: theme.success }]}>Default</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        {!method.isDefault && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.iconBg }]}
            onPress={() => handleSetDefault(method.id)}
          >
            <MaterialIcons name='star-outline' size={18} color={theme.accent} />
            <Text style={[styles.actionText, { color: theme.accent }]}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.iconBg }]}
          onPress={() => handleDelete(method.id, method.last4)}
        >
          <MaterialIcons name='delete-outline' size={18} color={theme.error} />
          <Text style={[styles.actionText, { color: theme.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
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
            <Text style={[styles.screenTitle, { color: darkMode ? "#f9fafb" : "#000000" }]}>Payment Methods</Text>
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
            <Text style={[styles.title, { color: '#FFFFFF' }]}>Payment Methods</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading && paymentMethods.length === 0 && !error && !userEmail ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading...</Text>
          </View>
        ) : loading && paymentMethods.length === 0 && !error ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading payment methods...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name='error-outline' size={48} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            <TouchableOpacity onPress={loadPaymentMethods} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.paymentMethodsContainer}>
            {paymentMethods.map(renderPaymentMethod)}
            
            {paymentMethods.length === 0 && !loading && (
              <View style={styles.emptyContainer}>
                <MaterialIcons name='credit-card-off' size={64} color={theme.subtext} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Payment Methods</Text>
                <Text style={[styles.emptyText, { color: theme.subtext }]}>
                  {userEmail 
                    ? 'Add a payment method to get started. Payment methods added during checkout will appear here.'
                    : 'Please log in to view your payment methods.'}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.accent }]}
          onPress={handleAddCard}
          activeOpacity={0.8}
        >
          <MaterialIcons name='add' size={24} color='#FFFFFF' />
          <Text style={styles.addButtonText}>Add Payment Method</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Card Modal - TODO: Implement Stripe Payment Element */}
      <Modal
        visible={showAddModal}
        transparent
        animationType='slide'
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment Method</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name='close' size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
              You'll be redirected to a secure payment form to add your card. Your payment method will be saved for future use.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.accent },
                  addingPaymentMethod && styles.modalButtonDisabled,
                ]}
                onPress={handleContinueToAddCard}
                disabled={addingPaymentMethod}
              >
                {addingPaymentMethod ? (
                  <ActivityIndicator size='small' color='#FFFFFF' />
                ) : (
                  <Text style={styles.modalButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );

  if (isScreenMode) {
    return <View style={{ flex: 1 }}>{content}</View>;
  }

  return null;
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
  },
  backButtonWrapper: {
    marginRight: 12,
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
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#43cea2',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMethodsContainer: {
    padding: 20,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardBrand: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardNumber: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardExpiry: {
    fontSize: 12,
  },
  defaultBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8F0FE',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: '#E8F0FE',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

