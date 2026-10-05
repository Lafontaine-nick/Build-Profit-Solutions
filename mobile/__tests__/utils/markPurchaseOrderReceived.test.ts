import { applyMarkPurchaseOrderReceived } from '@/utils/applyMarkPurchaseOrderReceived';

describe('applyMarkPurchaseOrderReceived', () => {
  it('moves a pending order into actual cost and out of committed', () => {
    const next = applyMarkPurchaseOrderReceived(
      {
        purchaseOrders: [
          { id: 'received', status: 'Received', category: 'Materials', amount: 1000 },
          { id: 'pending', status: 'Pending', category: 'Materials', amount: 500 },
        ],
        buckets: [{ name: 'Materials', spent: 400 }],
        spent: 2100,
      },
      'pending'
    );

    expect(next?.purchaseOrders?.map((po) => po.status)).toEqual(['Received', 'Received']);
    expect(next?.committedPOs).toBe(0);
    expect(next?.spent).toBe(2600);
    expect(next?.buckets?.[0].spent).toBe(900);
  });

  it('leaves an already received order unchanged', () => {
    const next = applyMarkPurchaseOrderReceived(
      {
        purchaseOrders: [{ id: 'received', status: 'Received', category: 'Materials', amount: 1000 }],
        buckets: [{ name: 'Materials', spent: 1000 }],
        spent: 1000,
      },
      'received'
    );

    expect(next).toBeNull();
  });
});
