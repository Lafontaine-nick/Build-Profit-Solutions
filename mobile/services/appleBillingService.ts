import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import {
  ENTITLEMENT_FOUNDING_FULL,
  REVENUECAT_OFFERING_ID,
} from '@/constants/billingCatalog';
import { syncBillingEntitlement } from '@/services/billingEntitlementService';

export type AppleBillingPackage = {
  id: string;
  packageType: string;
  productId: string;
  priceString: string;
  billingPeriodLabel: string;
};

export type AppleBillingState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'purchasing'
  | 'restoring'
  | 'success'
  | 'cancelled'
  | 'pending'
  | 'offline'
  | 'error';

let configuredForUserId: string | null = null;

function getIosApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
  if (!key || key.includes('your_')) return null;
  return key;
}

export function isAppleBillingAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(getIosApiKey());
}

export async function configureAppleBilling(clerkUserId: string): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  const userId = clerkUserId.trim();
  if (!userId) {
    throw new Error('Clerk user id is required before configuring purchases.');
  }

  if (configuredForUserId === userId) {
    return;
  }

  Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
  Purchases.configure({
    apiKey: getIosApiKey()!,
    appUserID: userId,
  });
  configuredForUserId = userId;
}

export async function logInAppleBilling(clerkUserId: string): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  await configureAppleBilling(clerkUserId);
  await Purchases.logIn(clerkUserId);
  configuredForUserId = clerkUserId;
}

export async function logOutAppleBilling(): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  try {
    await Purchases.logOut();
  } catch {
    // non-blocking
  }
  configuredForUserId = null;
}

function labelForPackage(pkg: PurchasesPackage): string {
  const type = String(pkg.packageType || '').toLowerCase();
  if (type.includes('annual') || type.includes('year')) return 'Annual';
  if (type.includes('month')) return 'Monthly';
  return 'Subscription';
}

export async function getFoundingOffering(): Promise<{
  offering: PurchasesOffering | null;
  packages: AppleBillingPackage[];
}> {
  if (!isAppleBillingAvailable()) {
    return { offering: null, packages: [] };
  }

  const offerings = await Purchases.getOfferings();
  const offering =
    offerings.all[REVENUECAT_OFFERING_ID] || offerings.current || null;

  const packages: AppleBillingPackage[] = (offering?.availablePackages || []).map(
    (pkg) => ({
      id: pkg.identifier,
      packageType: String(pkg.packageType),
      productId: pkg.product.identifier,
      priceString: pkg.product.priceString,
      billingPeriodLabel: labelForPackage(pkg),
    }),
  );

  return { offering, packages };
}

function hasFoundingEntitlement(info: CustomerInfo): boolean {
  const active = info.entitlements.active[ENTITLEMENT_FOUNDING_FULL];
  return Boolean(active?.isActive);
}

export async function purchaseApplePackage(
  pkg: PurchasesPackage,
): Promise<{ customerInfo: CustomerInfo; serverSynced: boolean }> {
  if (!isAppleBillingAvailable()) {
    throw new Error('In-app purchases are only available on iOS.');
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    let serverSynced = false;
    if (hasFoundingEntitlement(customerInfo)) {
      await syncBillingEntitlement();
      serverSynced = true;
    }
    return { customerInfo, serverSynced };
  } catch (error: any) {
    if (error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      const cancelled = new Error('Purchase cancelled');
      (cancelled as any).code = 'PURCHASE_CANCELLED';
      throw cancelled;
    }
    if (error?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      const pending = new Error('Purchase pending approval');
      (pending as any).code = 'PURCHASE_PENDING';
      throw pending;
    }
    throw error;
  }
}

export async function restoreApplePurchases(): Promise<{
  customerInfo: CustomerInfo;
  serverSynced: boolean;
}> {
  if (!isAppleBillingAvailable()) {
    throw new Error('Restore is only available on iOS.');
  }

  const customerInfo = await Purchases.restorePurchases();
  let serverSynced = false;
  if (hasFoundingEntitlement(customerInfo)) {
    await syncBillingEntitlement();
    serverSynced = true;
  }
  return { customerInfo, serverSynced };
}

export function openAppleSubscriptionManagement(): void {
  if (Platform.OS !== 'ios') return;
  void Purchases.showManageSubscriptions();
}
