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
import * as WebBrowser from 'expo-web-browser';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  FOUNDING_PLAN_DISPLAY_NAME,
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

type PlanKey = 'annual' | 'monthly';

type PlanOption = {
  key: PlanKey;
  priceString: string;
  price: number;
  currencyCode: string;
  pkg: PurchasesPackage | null;
  intro: string | null;
};

function offeringsUnavailableMessage(message: string): string | null {
  if (
    /configuration|offerings empty|could not be fetched|app store connect|storekit|problem with your configuration/i.test(
      message,
    )
  ) {
    return 'Prices show on a device or TestFlight build.';
  }
  return null;
}

const ON_ACCENT = '#050B13';
const TERMS_URL = 'https://buildprofitsolutions.com/terms';
const PRIVACY_URL = 'https://buildprofitsolutions.com/privacy';

/** Simulator has no StoreKit products; these mirror App Store Connect so the layout can be reviewed. */
const DEV_PREVIEW_PLANS: PlanOption[] = [
  { key: 'annual', priceString: '$990.00', price: 990, currencyCode: 'USD', pkg: null, intro: null },
  { key: 'monthly', priceString: '$99.00', price: 99, currencyCode: 'USD', pkg: null, intro: null },
];

function unitLabel(unit: string | undefined, count: number): string {
  const base = String(unit || '').toLowerCase();
  const word = base === 'day' ? 'day' : base === 'week' ? 'week' : base === 'year' ? 'year' : 'month';
  return count === 1 ? word : `${word}s`;
}

function introOfferCopy(pkg: PurchasesPackage, per: 'year' | 'month'): string | null {
  const intro = pkg.product.introPrice;
  if (!intro) return null;
  const count = Number(intro.periodNumberOfUnits || 1) * Number(intro.cycles || 1);
  const length = `${count} ${unitLabel(intro.periodUnit, count)}`;
  if (Number(intro.price) === 0) {
    return `Free for ${length}, then ${pkg.product.priceString} per ${per}.`;
  }
  return `${intro.priceString} for ${length}, then ${pkg.product.priceString} per ${per}.`;
}

function formatMoney(amount: number, currencyCode: string, wholeOnly = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: wholeOnly ? 0 : 2,
      maximumFractionDigits: wholeOnly ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${wholeOnly ? Math.round(amount) : amount.toFixed(2)}`;
  }
}

function planKeyFor(pkg: PurchasesPackage, meta: AppleBillingPackage | undefined): PlanKey | null {
  const label = String(meta?.billingPeriodLabel || '').toLowerCase();
  const type = String(pkg.packageType || '').toUpperCase();
  if (label === 'annual' || type === 'ANNUAL') return 'annual';
  if (label === 'monthly' || type === 'MONTHLY') return 'monthly';
  return null;
}

const FEATURES = [
  'Build with AI estimates & AI Assistant',
  'Plan/PDF takeoff, photo scope & supplier pricing',
  'Job costing, budgets & change orders',
  'Branded estimate PDFs, photos & daily logs',
  'Tax Center & receipt scanning',
  'Unlimited projects',
];

export default function IosFoundingSubscriptionPanel({
  colors,
  darkMode,
  isActive,
  onEntitlementRefreshed,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<AppleBillingPackage[]>([]);
  const [rcPackages, setRcPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PlanKey>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const loadOfferings = useCallback(async () => {
    if (!isAppleBillingAvailable()) {
      setPriceNotice('In-app purchases are not configured for this build.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPriceNotice(null);
    try {
      const { offering, packages: nextPackages } = await getFoundingOffering();
      const available = offering?.availablePackages || [];
      setPackages(nextPackages);
      setRcPackages(available);
      if (nextPackages.length === 0) {
        setPriceNotice('Prices show on a device or TestFlight build.');
      }
      setOffline(false);
    } catch (e: any) {
      const message = String(e?.message || e || 'Could not load subscription options');
      const unavailable = offeringsUnavailableMessage(message);
      if (unavailable) {
        setPriceNotice(unavailable);
      } else {
        setError('Subscription pricing is temporarily unavailable. Check your connection and try again.');
      }
      setOffline(/network|offline|internet/i.test(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const storePlans = useMemo<PlanOption[]>(() => {
    const out: PlanOption[] = [];
    for (const pkg of rcPackages) {
      const key = planKeyFor(pkg, packages.find((p) => p.id === pkg.identifier));
      if (!key || out.some((p) => p.key === key)) continue;
      out.push({
        key,
        priceString: pkg.product.priceString,
        price: Number(pkg.product.price) || 0,
        currencyCode: pkg.product.currencyCode || 'USD',
        pkg,
        intro: introOfferCopy(pkg, key === 'annual' ? 'year' : 'month'),
      });
    }
    return out.sort((a, b) => (a.key === 'annual' ? -1 : b.key === 'annual' ? 1 : 0));
  }, [rcPackages, packages]);

  const isPreview = __DEV__ && !loading && storePlans.length === 0;
  const plans = isPreview ? DEV_PREVIEW_PLANS : storePlans;
  const selectedPlan = plans.find((p) => p.key === selected) ?? plans[0] ?? null;

  const annualSavings = useMemo(() => {
    const monthly = plans.find((p) => p.key === 'monthly');
    const annual = plans.find((p) => p.key === 'annual');
    if (!monthly || !annual || !(monthly.price > 0) || !(annual.price > 0)) return null;
    const saved = monthly.price * 12 - annual.price;
    if (!(saved > 0.5)) return null;
    const freeMonths = Math.floor(saved / monthly.price + 0.01);
    return {
      saved: formatMoney(saved, annual.currencyCode, true),
      perMonth: formatMoney(annual.price / 12, annual.currencyCode),
      freeMonths,
    };
  }, [plans]);

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    if (!selectedPlan.pkg) {
      Alert.alert('Preview only', 'Purchases work on a device or TestFlight build.');
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const { serverSynced } = await purchaseApplePackage(selectedPlan.pkg);
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
      setPurchasing(false);
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

  if (Platform.OS !== 'ios') {
    return null;
  }

  const optionBg = darkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const selectedBg = darkMode ? 'rgba(45,204,154,0.10)' : 'rgba(45,204,154,0.08)';
  const per = selectedPlan?.key === 'annual' ? 'year' : 'month';

  const renderPlanCard = (plan: PlanOption) => {
    const active = plan.key === selectedPlan?.key;
    const annual = plan.key === 'annual';
    return (
      <TouchableOpacity
        key={plan.key}
        activeOpacity={0.85}
        onPress={() => setSelected(plan.key)}
        disabled={purchasing}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${annual ? 'Annual' : 'Monthly'}, ${plan.priceString} per ${annual ? 'year' : 'month'}`}
        style={[
          styles.planCard,
          {
            backgroundColor: active ? selectedBg : optionBg,
            borderColor: active ? colors.accent : colors.border,
          },
        ]}
      >
        <View style={styles.planTopRow}>
          {annual && annualSavings ? (
            <Text style={[styles.planBadge, { color: ON_ACCENT, backgroundColor: colors.accent }]}>
              {annualSavings.freeMonths >= 1
                ? `${annualSavings.freeMonths} MONTHS FREE`
                : 'BEST VALUE'}
            </Text>
          ) : (
            <View />
          )}
          <MaterialIcons
            name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
            size={20}
            color={active ? colors.accent : colors.subtext}
          />
        </View>
        <Text style={[styles.planName, { color: colors.text }]}>{annual ? 'Annual' : 'Monthly'}</Text>
        <Text style={[styles.planPrice, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {plan.priceString}
        </Text>
        <Text style={[styles.planPer, { color: colors.subtext }]}>{annual ? 'per year' : 'per month'}</Text>
        {annual && annualSavings ? (
          <>
            <Text style={[styles.planNote, { color: colors.accent }]}>Save {annualSavings.saved} a year</Text>
            <Text style={[styles.planSubNote, { color: colors.subtext }]} numberOfLines={1}>
              {annualSavings.perMonth}/mo equivalent
            </Text>
          </>
        ) : (
          <Text style={[styles.planNote, { color: colors.subtext }]}>Billed monthly</Text>
        )}
      </TouchableOpacity>
    );
  };

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
      <View style={styles.headerRow}>
        <View style={[styles.iconTile, { backgroundColor: darkMode ? '#3A3A3C' : '#e2e8f0' }]}>
          <MaterialIcons name="workspace-premium" size={24} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{FOUNDING_PLAN_DISPLAY_NAME}</Text>
          <Text style={[styles.headerSub, { color: colors.subtext }]}>Every feature · One user</Text>
        </View>
      </View>

      {isActive ? (
        <>
          <Text style={[styles.body, { color: colors.text }]}>This plan is active on your Apple ID.</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              try {
                openAppleSubscriptionManagement();
              } catch {
                void Linking.openURL('https://apps.apple.com/account/subscriptions');
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Manage Subscription</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {!isActive && loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.helper, { color: colors.subtext }]}>Loading App Store pricing…</Text>
        </View>
      ) : null}

      {!isActive && !loading && plans.length > 0 ? (
        <>
          <View style={styles.planRow}>{plans.map(renderPlanCard)}</View>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: purchasing ? 0.7 : 1 }]}
            disabled={purchasing || restoring}
            onPress={() => void handlePurchase()}
            accessibilityRole="button"
          >
            {purchasing ? (
              <ActivityIndicator color={ON_ACCENT} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {selectedPlan ? `Subscribe for ${selectedPlan.priceString}/${per}` : 'Subscribe'}
              </Text>
            )}
          </TouchableOpacity>
          {selectedPlan?.intro ? (
            <Text style={[styles.helper, styles.centerText, { color: colors.subtext }]}>{selectedPlan.intro}</Text>
          ) : null}
          <Text style={[styles.helper, styles.centerText, { color: colors.subtext }]}>
            Founding rate stays locked while your subscription is active. Cancel anytime.
          </Text>
          {isPreview ? (
            <Text style={[styles.previewNote, { color: colors.subtext }]}>
              Preview prices. Real App Store prices show on a device or TestFlight build.
            </Text>
          ) : null}
        </>
      ) : null}

      {!isActive && !loading && plans.length === 0 && priceNotice ? (
        <Text style={[styles.helper, { color: colors.subtext }]}>{priceNotice}</Text>
      ) : null}

      {error ? <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text> : null}

      {offline ? (
        <Text style={[styles.helper, { color: colors.subtext }]}>
          You appear to be offline. Connect to the internet to purchase or restore.
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.restoreLink}
        onPress={() => void handleRestore()}
        disabled={restoring || purchasing}
      >
        {restoring ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={[styles.restoreLinkText, { color: colors.accent }]}>Restore Purchases</Text>
        )}
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Everything included</Text>
      <View style={styles.featureList}>
        {FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={18} color={colors.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.legal, { color: colors.subtext }]}>
        Payment is charged to your Apple ID when you confirm. Your subscription renews automatically
        at the same price each month or year unless you cancel at least 24 hours before the current
        period ends. Manage or cancel anytime in your Apple ID subscription settings.
      </Text>

      <View style={styles.legalLinks}>
        <TouchableOpacity onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8}>
          <Text style={[styles.legalLink, { color: colors.accent }]}>Terms of Use</Text>
        </TouchableOpacity>
        <Text style={[styles.legal, { color: colors.subtext }]}>·</Text>
        <TouchableOpacity onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}>
          <Text style={[styles.legalLink, { color: colors.accent }]}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 14,
    marginTop: 2,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    minHeight: 150,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
    marginBottom: 10,
  },
  planBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  planPer: {
    fontSize: 13,
    marginTop: 1,
  },
  planNote: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  planSubNote: {
    fontSize: 11,
    marginTop: 2,
  },
  primaryButton: {
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  primaryButtonText: {
    color: ON_ACCENT,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  centerText: {
    textAlign: 'center',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewNote: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  restoreLink: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    alignSelf: 'center',
  },
  restoreLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  legal: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});
