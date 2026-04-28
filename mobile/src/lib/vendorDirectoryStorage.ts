import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TaxCategory } from '@/src/lib/taxCenter';
import type { AccountingIntegration, Vendor } from '@/src/lib/vendorTypes';

const STORAGE_KEY = 'bps.vendorDirectory.v1';

export type VendorDirectorySnapshot = {
  version: 1;
  vendors: Vendor[];
  /** Map each BPS tax category to a QuickBooks (or external) account label for export prep only. */
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
  /** Reserved for backend-driven connections — not used for OAuth in the app. */
  integrations: AccountingIntegration[];
};

export function defaultVendorDirectorySnapshot(): VendorDirectorySnapshot {
  return {
    version: 1,
    vendors: [],
    quickBooksCategoryMap: {},
    integrations: [],
  };
}

export async function loadVendorDirectorySnapshot(): Promise<VendorDirectorySnapshot> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVendorDirectorySnapshot();
    const parsed = JSON.parse(raw) as Partial<VendorDirectorySnapshot>;
    return {
      ...defaultVendorDirectorySnapshot(),
      ...parsed,
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      quickBooksCategoryMap:
        parsed.quickBooksCategoryMap && typeof parsed.quickBooksCategoryMap === 'object'
          ? parsed.quickBooksCategoryMap
          : {},
      integrations: Array.isArray(parsed.integrations) ? parsed.integrations : [],
    };
  } catch {
    return defaultVendorDirectorySnapshot();
  }
}

export async function saveVendorDirectorySnapshot(snapshot: VendorDirectorySnapshot): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
