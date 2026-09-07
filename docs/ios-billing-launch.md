# iOS Billing Launch — Founding Professional (RevenueCat + App Store)

This guide covers manual setup for **Founding Professional** on iOS. Do not commit secrets.

## Launch configuration

| Item | Value |
|------|-------|
| Plan name | Founding Professional |
| Monthly | $99 (App Store Connect) |
| Annual | $990 (App Store Connect) |
| Introductory trial | Configure in App Store Connect (not hardcoded in app) |
| Entitlement | `founding_full` |
| RevenueCat offering | `founding` |
| Apple product IDs | `com.buildprofitsolutions.founding.monthly`, `com.buildprofitsolutions.founding.annual` |
| Identity | Clerk `userId` = RevenueCat App User ID |

## Test API key vs Apple API key

RevenueCat keys that start with `test_` connect to RevenueCat's Test Store and expose generic placeholder products. The app ignores those and only purchases the App Store product IDs above from the `founding` offering.

For real App Store pricing and sandbox purchases, finish the App Store Connect link in RevenueCat, attach products to `founding_full` / `founding`, then set:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<Apple public SDK key from RevenueCat>
```

Use the **Apple** public SDK key (`appl_…`, not `test_…`) in EAS / `.env.local`.

## 1. App Store Connect

1. Complete **Paid Apps Agreement**, banking, and tax.
2. Open app **6761603832** (Build Profit Solutions).
3. Create a **Subscription Group** (e.g. “Founding Professional”).
4. Add auto-renewable subscriptions:
   - `com.buildprofitsolutions.founding.monthly` — $99/month
   - `com.buildprofitsolutions.founding.annual` — $990/year
5. Configure **introductory offer** (free trial length) on each product if desired.
6. Disable **Family Sharing** for launch unless explicitly approved later.
7. Add subscription **review notes** explaining full app access, restore purchases, and manage subscription in Settings.
8. Submit subscription metadata with your next TestFlight / App Store build.

## 2. RevenueCat

1. Create a project for BPS.
2. Connect **App Store Connect** (API key with subscription access).
3. Create entitlement: **`founding_full`**.
4. Import/link both Apple product IDs.
5. Create offering **`founding`** with packages:
   - Monthly → `$rc_monthly`
   - Annual → `$rc_annual`
6. Set offering **`founding`** as **Current** (not `default`).
7. Configure webhook:
   - URL: `https://build-profit-solutions-backend.onrender.com/api/billing/revenuecat-webhook`
   - Authorization header: same value as `REVENUECAT_WEBHOOK_AUTH` on Render
8. Copy **iOS public API key** for EAS.

Attach both products to the `founding` offering in RevenueCat. The mobile app reads packages only from the `founding` offering and displays prices returned by App Store Connect through RevenueCat.

## 3. Backend (Render)

Set environment variables (never commit):

```env
REVENUECAT_SECRET_API_KEY=sk_...
REVENUECAT_WEBHOOK_AUTH=your-long-random-secret
BILLING_ENFORCEMENT_ENABLED=false
DATABASE_URL=postgres://...
```

Set `BILLING_ENFORCEMENT_ENABLED=true` only after sandbox purchase, restore, renewal, cancellation, and webhook flows have been verified.

Deploy backend so these routes are live before TestFlight:

- `GET /api/billing/entitlement`
- `POST /api/billing/sync`
- `POST /api/billing/revenuecat-webhook`

The backend verifies entitlement state through RevenueCat at `GET /api/billing/entitlement` and `POST /api/billing/sync`.

## 4. EAS / Expo

Mobile EAS environment:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
```

RevenueCat requires a native development build; Expo Go cannot load the native purchase modules.

```bash
cd mobile
npx expo install react-native-purchases react-native-purchases-ui
npx expo run:ios
```

For an EAS development build:

```bash
npx eas build --profile development --platform ios
# or production TestFlight build
eas build --profile production --platform ios
```

Use sandbox Apple IDs for purchase testing.

## 5. Testing checklist

### Sandbox / TestFlight

- [ ] Sign in with Clerk before purchase screen
- [ ] Monthly purchase unlocks immediately after `POST /billing/sync`
- [ ] Restore purchases on second device / reinstall
- [ ] Manage Subscription opens Apple subscriptions UI
- [ ] Cancelled sub keeps access until period end
- [ ] Expired sandbox sub revokes premium API access (403 `ENTITLEMENT_REQUIRED`)
- [ ] iOS never opens Stripe Checkout

Test flow:

1. Sign in with Clerk.
2. Open Profile → Payment & Billing → View Plans.
3. Confirm the custom plan screen shows live App Store prices from RevenueCat.
4. Tap Subscribe to complete the Apple purchase sheet.
5. Confirm the `founding_full` entitlement becomes active.
6. Use Restore Purchases on another sandbox device/account.
7. Use Manage with Apple to open Customer Center.
8. Cancel/expire the sandbox subscription and confirm entitlement refresh.

### Backend

- [ ] Duplicate RevenueCat webhook ignored (idempotent)
- [ ] Invalid webhook auth returns 401
- [ ] AI / OCR / SKU routes reject without entitlement when enforcement enabled

## 6. Platform rules

**iOS app**

- RevenueCat + Apple auto-renewable subscriptions only
- No Stripe Checkout
- No external web checkout links for digital access
- No standard Apple Pay button (not used for subscriptions)

**Web (future)**

- Stripe code preserved but not part of this iOS launch

## 7. Grandfathering copy

Founding subscribers keep full access at their subscribed rate while **continuously subscribed**. If they cancel and return later, they purchase at whatever plans/prices are current in the App Store.

## 8. Support

For billing disputes on iOS, users must use **Apple’s** refund/subscription tools. BPS cannot refund App Store transactions directly (see Legal Hub).
