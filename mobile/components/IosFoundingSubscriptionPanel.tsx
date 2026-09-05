import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  FOUNDING_PLAN_DISPLAY_NAME,
  FOUNDING_PLAN_FEATURES,
} from '@/constants/billingCatalog';
import {
  getFoundingOffering,
  isAppleBillingAvailable,
  openAppleSubscriptionManagement,
  purchaseApplePackage,
  restoreApplePurchases,
  type AppleBillingPackage,
} from '@/services/appleBillingService';
import { fetchBillingEntitlement } from '@/services/billingEntitlementService';

type Props = {
  colors: {
    text: string;
    subtext: string;
    card: string;
    border: string;
    accent: string;
    success: string;
  };
  darkMode: boolean;
  isActive: boolean;
  onEntitlementRefreshed?: () => void;
};

const FEATURES = [...FOUNDING_PLAN_FEATURES];

export default function IosFoundingSubscriptionPanel({
  colors,
  darkMode,
  isActive,
  onEntitlementRefreshed,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<AppleBillingPackage[]>([]);
  const [rcPackages, setRcPackages] = useState<PurchasesPackage[]>([]);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const loadOfferings = useCallback(async () => {
    if (!isAppleBillingAvailable()) {
      setError('In-app purchases are not configured for this build.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { offering, packages: nextPackages } = await getFoundingOffering();
      const available = offering?.availablePackages || [];
      setPackages(nextPackages);
      setRcPackages(available);
      if (nextPackages.length === 0) {
        setError(
          'Subscription pricing is temporarily unavailable. Check your connection and try again.',
        );
      }
      setOffline(false);
    } catch (e: any) {
      const message = String(e?.message || e || 'Could not load subscription options');
      setError(message);
      setOffline(/network|offline|internet/i.test(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setBusyPackageId(pkg.identifier);
    setError(null);
    try {
      const { serverSynced } = await purchaseApplePackage(pkg);
      if (!serverSynced) {
        throw new Error('Purchase completed but server verification failed. Tap Restore Purchases.');
      }
      onEntitlementRefreshed?.();
      Alert.alert(
        'Welcome!',
        `${FOUNDING_PLAN_DISPLAY_NAME} is active. Your founding access stays at this rate while your subscription remains continuously active.`,
      );
    } catch (e: any) {
      if (e?.code === 'PURCHASE_CANCELLED') {
        return;
      }
      if (e?.code === 'PURCHASE_PENDING') {
        Alert.alert(
          'Purchase pending',
          'Apple is still processing this purchase. Try Restore Purchases in a moment.',
        );
        return;
      }
      setError(e?.message || 'Purchase failed');
    } finally {
      setBusyPackageId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const { serverSynced } = await restoreApplePurchases();
      if (!serverSynced) {
        const latest = await fetchBillingEntitlement().catch(() => null);
        if (!latest?.isActive) {
          Alert.alert('No active subscription found', 'No founding subscription was restored for this Apple ID.');
          return;
        }
      }
      onEntitlementRefreshed?.();
      Alert.alert('Restored', 'Your subscription has been restored.');
    } catch (e: any) {
      setError(e?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const annualSavingsCopy = useMemo(() => {
    const monthly = packages.find((p) => p.billingPeriodLabel === 'Monthly');
    const annual = packages.find((p) => p.billingPeriodLabel === 'Annual');
    if (!monthly || !annual) return null;
    return `Save with annual billing (${annual.priceString}/year)`;
  }, [packages]);

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>All features included</Text>
      <Text style={[styles.title, { color: colors.text }]}>{FOUNDING_PLAN_DISPLAY_NAME}</Text>
      <Text style={[styles.body, { color: colors.subtext }]}>
        Full access to estimating, AI, job costing, supplier lookup, and tax organization. One user.
        Founding access remains active while your subscription stays continuously active.
      </Text>

      {FEATURES.map((feature) => (
        <View key={feature} style={styles.featureRow}>
          <MaterialIcons name="check" size={18} color={colors.success} />
          <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
        </View>
      ))}

      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.helper, { color: colors.subtext }]}>Loading App Store pricing…</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>
      ) : null}

      {offline ? (
        <Text style={[styles.helper, { color: colors.subtext }]}>
          You appear to be offline. Connect to the internet to purchase or restore.
        </Text>
      ) : null}

      {!loading && rcPackages.length > 0 ? (
        <View style={styles.packageList}>
          {rcPackages.map((pkg) => {
            const meta = packages.find((p) => p.id === pkg.identifier);
            const busy = busyPackageId === pkg.identifier;
            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[
                  styles.packageButton,
                  { backgroundColor: colors.accent, opacity: busy ? 0.7 : 1 },
                ]}
                disabled={Boolean(busyPackageId) || restoring || isActive}
                onPress={() => void handlePurchase(pkg)}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.packageButtonText}>
                    {isActive
                      ? 'Current plan'
                      : `Subscribe ${meta?.billingPeriodLabel || ''} — ${pkg.product.priceString}`}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {annualSavingsCopy ? (
        <Text style={[styles.helper, { color: colors.subtext }]}>{annualSavingsCopy}</Text>
      ) : null}

      <Text style={[styles.legal, { color: colors.subtext }]}>
        Payment is charged to your Apple ID. Subscriptions auto-renew until cancelled in Apple
        subscription settings. Introductory trial eligibility and length are determined by Apple.
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => void handleRestore()}
          disabled={restoring || Boolean(busyPackageId)}
        >
          {restoring ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Restore Purchases
            </Text>
          )}
        </TouchableOpacity>

        {isActive ? (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={() => {
              try {
                openAppleSubscriptionManagement();
              } catch {
                void Linking.openURL('https://apps.apple.com/account/subscriptions');
              }
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Manage Subscription
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  packageList: {
    gap: 10,
    marginTop: 4,
  },
  packageButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  packageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  legal: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  entitlementHint: {
    fontSize: 11,
    marginTop: 2,
  },
});
