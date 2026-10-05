import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { businessWorkspaceService } from '@/services/businessWorkspaceService';
import { applyMarkPurchaseOrderReceived } from '@/utils/applyMarkPurchaseOrderReceived';

export { applyMarkPurchaseOrderReceived };

type PurchaseOrderLike = {
  id: string;
  status?: string;
  poNumber?: string;
  vendor?: string;
};

type BucketLike = {
  name?: string;
  spent?: number;
};

/** Budget snapshot wins when it already has this order. Otherwise use the project list. */
function purchaseOrdersForReceive(
  saved: { purchaseOrders?: PurchaseOrderLike[] } | null,
  listProjectData: { purchaseOrders?: PurchaseOrderLike[] } | null | undefined,
  poId: string
): PurchaseOrderLike[] | undefined {
  const savedOrders = Array.isArray(saved?.purchaseOrders) ? saved.purchaseOrders : undefined;
  const listOrders = Array.isArray(listProjectData?.purchaseOrders)
    ? listProjectData.purchaseOrders
    : undefined;
  if (savedOrders?.some((po) => po.id === poId)) return savedOrders;
  if (listOrders?.some((po) => po.id === poId)) return listOrders;
  return savedOrders || listOrders;
}

/**
 * Writes the budget snapshot and the shared purchase-order list.
 * Opening the job afterward loads this same received state.
 */
export async function persistMarkPurchaseOrderReceived(
  projectId: string,
  poId: string,
  listProjectData?: {
    purchaseOrders?: PurchaseOrderLike[];
    buckets?: BucketLike[];
    spent?: number;
  } | null
): Promise<ReturnType<typeof applyMarkPurchaseOrderReceived> | null> {
  const key = `bps.project.${projectId}`;
  let saved: Record<string, unknown> | null = null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) saved = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    saved = null;
  }

  const base = {
    ...(listProjectData || {}),
    ...(saved || {}),
    purchaseOrders: purchaseOrdersForReceive(
      saved as { purchaseOrders?: PurchaseOrderLike[] } | null,
      listProjectData,
      poId
    ),
  };
  const updated = applyMarkPurchaseOrderReceived(base, poId);
  if (!updated) return null;

  await AsyncStorage.setItem(key, JSON.stringify(updated));
  businessWorkspaceService
    .pushProjectResource(projectId, 'purchaseOrders', updated.purchaseOrders)
    .catch((error) => {
      console.warn('Business workspace purchaseOrders sync failed:', error);
    });
  return updated;
}

export function confirmMarkPurchaseOrderReceived(
  po: { poNumber?: string; vendor?: string },
  onConfirm: () => void
) {
  const body = `${po.poNumber ?? 'PO'} from ${po.vendor ?? 'vendor'} will be added to expenses.`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (!window.confirm(`Mark as Received?\n\n${body}`)) return;
    onConfirm();
    return;
  }
  Alert.alert('Mark as Received?', body, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Received', onPress: onConfirm },
  ]);
}
