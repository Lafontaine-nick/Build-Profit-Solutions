import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  type CustomerInfo,
  type Offerings,
  type PurchasesOffering,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import {
  APPLE_PRODUCT_IDS,
  ENTITLEMENT_FOUNDING_FULL,
  PRODUCTION_IOS_BUNDLE_ID,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
} from '@/constants/billingCatalog';
import { syncBillingEntitlement } from '@/services/billingEntitlementService';

type BillingExtra = {
  revenueCatIosApiKey?: string;
};

export type AppleBillingPackage = {
  id: string;
  packageType: string;
  productId: string;
  priceString: string;
  billingPeriodLabel: string;
};

export type AppleBillingPeriod = 'monthly' | 'annual';

let configured = false;
let configuredForUserId: string | null = null;

function getPurchasesModule() {
  if (!Purchases || typeof Purchases.configure !== 'function') {
    throw new Error(
      'Apple subscriptions require a native iOS development or production build. ' +
        'Restarting Expo Go will not load RevenueCat; rebuild the iOS app after installing the SDK.',
    );
  }
  return Purchases;
}

function getIosApiKey(): string {
  const extra = (Constants.expoConfig?.extra || {}) as BillingExtra;
  return String(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
      extra.revenueCatIosApiKey ||
      '',
  ).trim();
}

function assertIos() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple subscriptions are available on iOS only.');
  }
}

export function isAppleBillingAvailable(): boolean {
  const apiKey = getIosApiKey();
  return (
    Platform.OS === 'ios' &&
    Boolean(apiKey) &&
    !apiKey.includes('your_') &&
    Boolean(Purchases) &&
    typeof Purchases.configure === 'function'
  );
}

export async function configureAppleBilling(appUserId?: string | null): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  assertIos();
  const purchases = getPurchasesModule();
  const userId = String(appUserId || '').trim();

  if (configured) {
    if (userId && configuredForUserId !== userId) {
      await purchases.logIn(userId);
      configuredForUserId = userId;
    }
    return;
  }

  const apiKey = getIosApiKey();
  if (!apiKey) throw new Error('RevenueCat iOS API key is not configured.');

  purchases.setLogHandler((level, message) => {
    if (/purchase was cancelled/i.test(message)) return;
    if (/error fetching offerings|problem with your configuration/i.test(message)) {
      if (__DEV__) console.warn(`[RevenueCat] ${message}`);
      return;
    }
    if (!__DEV__) return;
    if (level === purchases.LOG_LEVEL.ERROR) {
      console.error(`[RevenueCat] ${message}`);
      return;
    }
    if (level === purchases.LOG_LEVEL.WARN) {
      console.warn(`[RevenueCat] ${message}`);
      return;
    }
    console.log(`[RevenueCat] ${message}`);
  });
  purchases.setLogLevel(
    __DEV__ ? purchases.LOG_LEVEL.DEBUG : purchases.LOG_LEVEL.ERROR,
  );
  await purchases.configure({
    apiKey,
    appUserID: userId || undefined,
  });
  configured = true;
  configuredForUserId = userId || null;
}

export async function logInAppleBilling(clerkUserId: string): Promise<void> {
  await configureAppleBilling(clerkUserId);
  await getPurchasesModule().logIn(clerkUserId);
  configuredForUserId = clerkUserId;
}

export async function logOutAppleBilling(): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  try {
    await getPurchasesModule().logOut();
  } catch {
    // non-blocking
  }
  configured = false;
  configuredForUserId = null;
}

export async function identifyAppleUser(appUserId: string): Promise<CustomerInfo> {
  await configureAppleBilling(appUserId);
  const result = await getPurchasesModule().logIn(appUserId);
  configuredForUserId = appUserId;
  return result.customerInfo;
}

export async function getAppleCustomerInfo(): Promise<CustomerInfo> {
  await configureAppleBilling();
  return getPurchasesModule().getCustomerInfo();
}

export async function getAppleOfferings(): Promise<Offerings> {
  await configureAppleBilling();
  return getPurchasesModule().getOfferings();
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

  const offerings = await getAppleOfferings();
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

export function formatApplePackageDisplayPrice(
  pkg: PurchasesPackage | undefined,
  period: AppleBillingPeriod,
): string | null {
  const priceString = pkg?.product?.priceString?.trim();
  if (!priceString) return null;
  return period === 'annual' ? `${priceString}/year` : `${priceString}/month`;
}

export function getApplePackageForPeriod(
  packages: { monthly?: PurchasesPackage; annual?: PurchasesPackage },
  period: AppleBillingPeriod,
): PurchasesPackage | undefined {
  return period === 'annual' ? packages.annual : packages.monthly;
}

export function isRevenueCatTestStoreApiKey(apiKey = getIosApiKey()): boolean {
  return apiKey.startsWith('test_');
}

export function getIosBundleIdentifier(): string {
  return String(Constants.expoConfig?.ios?.bundleIdentifier ?? '').trim();
}

export function isProductionIosBundleForBilling(): boolean {
  const bundleId = getIosBundleIdentifier();
  return !bundleId || bundleId === PRODUCTION_IOS_BUNDLE_ID;
}

export function getAppleBillingSetupBlocker(): string | null {
  if (Platform.OS !== 'ios') return null;

  const bundleId = getIosBundleIdentifier();
  if (bundleId && bundleId !== PRODUCTION_IOS_BUNDLE_ID) {
    return (
      `This build uses "${bundleId}". Subscriptions only work on the production app ` +
      `(${PRODUCTION_IOS_BUNDLE_ID}). Use TestFlight or a production EAS build to test billing.`
    );
  }

  if (!getIosApiKey()) {
    return (
      'RevenueCat is not configured in this build. Add EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ' +
      'to EAS production environment variables and rebuild.'
    );
  }

  if (isRevenueCatTestStoreApiKey()) {
    return (
      'This build uses a RevenueCat test API key. Switch to your Apple public SDK key (appl_…) ' +
      'in EAS production env and rebuild.'
    );
  }

  return null;
}

export function getFoundingMonthlyPackage(
  packages: { monthly?: PurchasesPackage; annual?: PurchasesPackage },
): PurchasesPackage | undefined {
  return packages.monthly;
}

export function getAppleSubscriptionSetupMessage(): string {
  const blocker = getAppleBillingSetupBlocker();
  if (blocker) return blocker;

  return (
    'RevenueCat could not load your App Store products yet. In RevenueCat, confirm:\n\n' +
    '1. App Store Connect is linked (In-App Purchase Key + Shared Secret)\n' +
    '2. Bundle ID is com.buildprofitsolutions.mobile\n' +
    '3. Products com.buildprofitsolutions.founding.monthly and .annual exist in App Store Connect (Ready to Submit)\n' +
    `4. Both are on the "${REVENUECAT_OFFERING_ID}" offering → "${REVENUECAT_ENTITLEMENT_ID}" entitlement\n` +
    '5. Paid Applications Agreement is signed in App Store Connect\n\n' +
    'Changes can take up to 24 hours to propagate.'
  );
}

function getFoundingOfferingPackages(offerings: Offerings): PurchasesPackage[] {
  return offerings.all[REVENUECAT_OFFERING_ID]?.availablePackages ?? [];
}

/** Only match real App Store product IDs from the `founding` offering. */
export function findApplePackages(offerings: Offerings): {
  monthly?: PurchasesPackage;
  annual?: PurchasesPackage;
} {
  const packages = getFoundingOfferingPackages(offerings);
  return {
    monthly: packages.find((pkg) => pkg.product.identifier === APPLE_PRODUCT_IDS.monthly),
    annual: packages.find((pkg) => pkg.product.identifier === APPLE_PRODUCT_IDS.annual),
  };
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

  await configureAppleBilling();
  try {
    const { customerInfo } = await getPurchasesModule().purchasePackage(pkg);
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

  await configureAppleBilling();
  const customerInfo = await getPurchasesModule().restorePurchases();
  let serverSynced = false;
  if (hasFoundingEntitlement(customerInfo)) {
    await syncBillingEntitlement();
    serverSynced = true;
  }
  return { customerInfo, serverSynced };
}

export function hasAppleEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  const entitlement = customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  return Boolean(entitlement?.isActive);
}

export async function presentApplePaywall(): Promise<void> {
  await configureAppleBilling();
  await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
  });
}

export async function presentAppleCustomerCenter(): Promise<void> {
  await configureAppleBilling();
  await RevenueCatUI.presentCustomerCenter();
}

export function openAppleSubscriptionManagement(): void {
  if (Platform.OS !== 'ios') return;
  void getPurchasesModule().showManageSubscriptions();
}

export async function syncAppleEntitlement(_customerInfo?: CustomerInfo): Promise<void> {
  if (!isAppleBillingAvailable()) return;
  await syncBillingEntitlement();
}

export function addAppleCustomerInfoListener(
  listener: (customerInfo: CustomerInfo) => void,
): { remove: () => void } {
  const subscription = getPurchasesModule().addCustomerInfoUpdateListener(listener);
  return {
    remove: () => subscription?.remove?.(),
  };
}
