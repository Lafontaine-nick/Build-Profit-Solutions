describe('stripeEntitlementStore', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    jest.resetModules();
  });

  test('deduplicates webhook event ids without a database', async () => {
    const store = require('../stripeEntitlementStore');
    const event = { id: 'evt_test_1', type: 'customer.subscription.created' };

    await expect(store.recordEvent(event)).resolves.toBe(true);
    await expect(store.recordEvent(event)).resolves.toBe(false);
  });

  test('accepts subscription entitlement updates in memory when database is unavailable', async () => {
    const store = require('../stripeEntitlementStore');

    await expect(
      store.upsertEntitlement({
        id: 'sub_test_1',
        status: 'active',
        customer: { id: 'cus_test_1', email: 'owner@example.com' },
        items: { data: [{ price: { id: 'price_test_1' } }] },
        current_period_end: 1_800_000_000,
        cancel_at_period_end: false,
      }),
    ).resolves.toBeUndefined();
  });
});
