import AsyncStorage from '@react-native-async-storage/async-storage';

export const ESTIMATE_BID_STORAGE_KEY = 'bps.currentBid.v2';
const MATERIALS_KEY = 'bps.materialsCart';
const RENTALS_KEY = 'bps.rentalCart';

export type EstimateSessionSnapshot = {
  ready: boolean;
  bid: Record<string, unknown> | null;
  materialsCart: unknown[];
  rentalCart: unknown[];
  activeScope: string;
  isFirstTime: boolean;
  savedEstimates: unknown[];
};

let sessionSnapshot: EstimateSessionSnapshot | null = null;
let storagePreloadPromise: Promise<EstimateSessionSnapshot | null> | null = null;

function normalizeScopeSlug(value: unknown): string {
  if (!value) return 'kitchen';
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_');
  if (slug.includes('kitchen')) return 'kitchen';
  if (slug.includes('bathroom')) return 'bathroom';
  if (slug.includes('room_add')) return 'room_addition';
  if (
    slug.includes('whole_home') ||
    slug.includes('whole-home') ||
    slug.includes('full_remodel') ||
    slug.includes('home_add') ||
    slug.includes('home-renov')
  ) {
    return 'home_addition';
  }
  if (slug === 'adu' || slug.includes('accessory_dwelling')) return 'adu';
  if (slug.includes('garage_conversion') || slug.includes('garage-conversion')) {
    return 'garage_conversion';
  }
  if (
    slug.includes('new_build') ||
    slug.includes('new-build') ||
    slug.includes('newhome') ||
    slug.includes('custom')
  ) {
    return 'new_build';
  }
  if (slug.includes('roof')) return 'roofing';
  if (slug.includes('deck') || slug.includes('patio')) return 'deck_patio';
  if (slug.includes('plumbing') || slug.includes('service')) return 'plumbing_service';
  if (slug.includes('landscape')) return 'landscaping';
  return 'other';
}

function materialsFromBidLineItems(
  lineItems: Array<Record<string, unknown>>
): unknown[] {
  return lineItems.map((item) => ({
    id: item.id || String(Date.now()),
    name: item.name || item.description || 'Material',
    description: item.description || item.name || 'Material',
    qty: item.quantity || item.qty || 1,
    quantity: item.quantity || item.qty || 1,
    unit: item.unit || 'ea',
    unitPrice:
      item.unitPrice ||
      item.cost ||
      (Number(item.total) || 0) / (Number(item.quantity) || Number(item.qty) || 1),
    total: item.total || 0,
    section: item.section || 'General Materials',
  }));
}

function resolveOnboardingFirstTime(
  resetFlag: string | null,
  firstEstimateSubmitted: string | null,
  savedEstimatesList: unknown[]
): boolean {
  const hasAnySavedEstimates =
    Array.isArray(savedEstimatesList) && savedEstimatesList.length > 0;
  const hasSubmittedSavedEstimate =
    Array.isArray(savedEstimatesList) &&
    savedEstimatesList.some((entry) => {
      const row = entry as { status?: string; data?: { status?: string } };
      const status = (row?.status || row?.data?.status || '').toLowerCase();
      return (
        status === 'bid_submitted' ||
        status === 'submitted' ||
        status === 'won' ||
        status === 'in_progress' ||
        status === 'active'
      );
    });
  const hasExistingWork =
    firstEstimateSubmitted === 'true' || hasSubmittedSavedEstimate || hasAnySavedEstimates;

  if (resetFlag === 'true') return true;
  if (hasExistingWork) return false;
  return true;
}

export function getEstimateSessionSnapshot(): EstimateSessionSnapshot | null {
  return sessionSnapshot;
}

export function setEstimateSessionSnapshot(snapshot: EstimateSessionSnapshot): void {
  sessionSnapshot = snapshot;
}

export function warmEstimateStoragePreload(): Promise<EstimateSessionSnapshot | null> {
  if (storagePreloadPromise) return storagePreloadPromise;
  storagePreloadPromise = (async () => {
    try {
      const [
        bidRaw,
        materialsRaw,
        rentalsRaw,
        resetFlag,
        firstEstimateSubmitted,
        savedEstimatesRaw,
      ] = await Promise.all([
        AsyncStorage.getItem(ESTIMATE_BID_STORAGE_KEY),
        AsyncStorage.getItem(MATERIALS_KEY),
        AsyncStorage.getItem(RENTALS_KEY),
        AsyncStorage.getItem('bps.forceEstimateOnboarding'),
        AsyncStorage.getItem('bps.firstEstimateSubmitted'),
        AsyncStorage.getItem('savedEstimates'),
      ]);

      const bid = bidRaw ? (JSON.parse(bidRaw) as Record<string, unknown>) : null;
      const isLeadProposal =
        Boolean(bid?.leadId) && bid?.leadSource === 'qualified_lead';

      let materialsCart: unknown[] = [];
      if (!isLeadProposal && materialsRaw) {
        const parsed = JSON.parse(materialsRaw);
        if (Array.isArray(parsed)) materialsCart = parsed;
      }

      if (
        !isLeadProposal &&
        materialsCart.length === 0 &&
        Array.isArray(bid?.materialLineItems) &&
        bid.materialLineItems.length > 0
      ) {
        materialsCart = materialsFromBidLineItems(
          bid.materialLineItems as Array<Record<string, unknown>>
        );
      }

      let rentalCart: unknown[] = [];
      if (!isLeadProposal && rentalsRaw) {
        const parsed = JSON.parse(rentalsRaw);
        if (Array.isArray(parsed)) rentalCart = parsed;
      }

      const savedEstimates = savedEstimatesRaw ? JSON.parse(savedEstimatesRaw) : [];
      const savedEstimatesList = Array.isArray(savedEstimates) ? savedEstimates : [];
      const isFirstTime = resolveOnboardingFirstTime(
        resetFlag,
        firstEstimateSubmitted,
        savedEstimatesList
      );
      const activeScope = normalizeScopeSlug(
        bid?.projectType || bid?.category || bid?.template || 'kitchen'
      );

      const snapshot: EstimateSessionSnapshot = {
        ready: true,
        bid,
        materialsCart,
        rentalCart,
        activeScope,
        isFirstTime,
        savedEstimates: savedEstimatesList,
      };
      sessionSnapshot = snapshot;
      return snapshot;
    } catch {
      return null;
    }
  })();
  return storagePreloadPromise;
}
