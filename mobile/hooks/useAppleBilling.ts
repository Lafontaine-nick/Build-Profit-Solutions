import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-react';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import {
  addAppleCustomerInfoListener,
  configureAppleBilling,
  findApplePackages,
  getAppleCustomerInfo,
  getAppleOfferings,
  getApplePackageForPeriod,
  getFoundingMonthlyPackage,
  hasAppleEntitlement,
  identifyAppleUser,
  isAppleBillingAvailable,
  presentAppleCustomerCenter,
  purchaseApplePackage,
  restoreApplePurchases,
  syncAppleEntitlement,
  type AppleBillingPeriod,
} from '@/services/appleBillingService';

export function useAppleBilling() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<{ monthly?: PurchasesPackage; annual?: PurchasesPackage }>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = Platform.OS === 'ios' && isAppleBillingAvailable();
  const entitled = useMemo(() => hasAppleEntitlement(customerInfo), [customerInfo]);

  const refresh = useCallback(async () => {
    if (!available || !isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const info = user?.id
        ? await identifyAppleUser(user.id)
        : await getAppleCustomerInfo();
      setCustomerInfo(info);
      const offerings = await getAppleOfferings();
      setPackages(findApplePackages(offerings));
      await syncAppleEntitlement(info);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Apple subscription.');
    } finally {
      setLoading(false);
    }
  }, [available, isSignedIn, user?.id]);

  useEffect(() => {
    if (!available || !isSignedIn) return;
    let mounted = true;
    let listener: { remove: () => void } | null = null;
    void refresh();
    configureAppleBilling(user?.id)
      .then(() => {
        if (!mounted) return;
        listener = addAppleCustomerInfoListener((info) => {
          setCustomerInfo(info);
          void syncAppleEntitlement(info).catch(() => {});
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
      listener?.remove();
    };
  }, [available, isSignedIn, refresh, user?.id]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setLoading(true);
      setError(null);
      try {
        const { customerInfo: info } = await purchaseApplePackage(pkg);
        setCustomerInfo(info);
        return { info, error: null as string | null, cancelled: false };
      } catch (cause) {
        const cancelled = Boolean((cause as { userCancelled?: boolean })?.userCancelled);
        const message = cancelled
          ? null
          : cause instanceof Error
            ? cause.message
            : 'Purchase could not be completed.';
        if (message) setError(message);
        return { info: null, error: message, cancelled };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const restore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { customerInfo: info } = await restoreApplePurchases();
      setCustomerInfo(info);
      return info;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Purchases could not be restored.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const purchasePeriod = useCallback(
    async (period: AppleBillingPeriod) => {
      const pkg = getApplePackageForPeriod(packages, period);
      if (!pkg) {
        const message = 'Subscription products are not available yet. Try again in a moment.';
        setError(message);
        return { info: null, error: message, cancelled: false };
      }
      return purchase(pkg);
    },
    [packages, purchase],
  );

  const purchaseFoundingMonthly = useCallback(async () => {
    const pkg = getFoundingMonthlyPackage(packages);
    if (!pkg) {
      const message = 'Subscription products are not available yet. Try again in a moment.';
      setError(message);
      return { info: null, error: message, cancelled: false };
    }
    return purchase(pkg);
  }, [packages, purchase]);

  return {
    available,
    customerInfo,
    packages,
    entitled,
    loading,
    error,
    refresh,
    purchase,
    purchasePeriod,
    purchaseFoundingMonthly,
    restore,
    presentCustomerCenter: presentAppleCustomerCenter,
  };
}
