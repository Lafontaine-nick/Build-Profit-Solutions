const {
  isRecordActive,
  upsertEntitlement,
  buildEntitlementResponse,
  _resetMemoryForTests,
} = require('../billingEntitlementStore');

describe('billingEntitlementStore', () => {
  beforeEach(() => {
    _resetMemoryForTests();
    delete process.env.DATABASE_URL;
  });

  it('treats active subscription as entitled', async () => {
    const record = await upsertEntitlement({
      clerkUserId: 'user_1',
      entitlement: 'founding_full',
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(isRecordActive(record)).toBe(true);
    expect(buildEntitlementResponse(record).isActive).toBe(true);
  });

  it('keeps access during grace period', async () => {
    const record = await upsertEntitlement({
      clerkUserId: 'user_2',
      entitlement: 'founding_full',
      status: 'grace_period',
      gracePeriodExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(isRecordActive(record)).toBe(true);
  });

  it('revokes expired subscriptions', async () => {
    const record = await upsertEntitlement({
      clerkUserId: 'user_3',
      entitlement: 'founding_full',
      status: 'active',
      expiresAt: new Date(Date.now() - 3600000).toISOString(),
    });
    expect(isRecordActive(record)).toBe(false);
  });

  it('allows cancelled access until period end', async () => {
    const record = await upsertEntitlement({
      clerkUserId: 'user_4',
      entitlement: 'founding_full',
      status: 'cancelled',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      cancelAtPeriodEnd: true,
    });
    expect(isRecordActive(record)).toBe(true);
  });
});
