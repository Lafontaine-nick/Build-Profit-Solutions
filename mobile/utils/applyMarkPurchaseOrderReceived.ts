type PurchaseOrderLike = {
  id: string;
  status?: string;
  category?: string;
  amount?: number;
};

type BucketLike = {
  name?: string;
  spent?: number;
};

/**
 * Same transition as Budget → Received.
 * A received purchase order stays on the purchase-order list. It is not copied
 * into expenses, because actual cost is expenses plus received orders.
 */
export function applyMarkPurchaseOrderReceived<T extends {
  purchaseOrders?: PurchaseOrderLike[];
  buckets?: BucketLike[];
  spent?: number;
  committedPOs?: number;
  lastUpdated?: string;
}>(prev: T, poId: string): T | null {
  const po = prev.purchaseOrders?.find((p) => p.id === poId);
  if (!po || po.status === 'Received') return null;

  const amount = Number(po.amount) || 0;
  const category = String(po.category || '').toLowerCase();
  const updatedPOs = (prev.purchaseOrders || []).map((p) =>
    p.id === poId ? { ...p, status: 'Received' as const } : p
  );
  const updatedBuckets = (prev.buckets || []).map((bucket) => {
    if (String(bucket.name || '').toLowerCase() === category) {
      return {
        ...bucket,
        spent: (Number(bucket.spent) || 0) + amount,
      };
    }
    return bucket;
  });
  const committedPOs = updatedPOs
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return {
    ...prev,
    purchaseOrders: updatedPOs,
    buckets: updatedBuckets,
    spent: (Number(prev.spent) || 0) + amount,
    committedPOs,
    lastUpdated: new Date().toISOString(),
  };
}
