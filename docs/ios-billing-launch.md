# iOS billing launch

## Product configuration

RevenueCat entitlement:

```text
founding_full
```

RevenueCat offering:

```text
founding
```

App Store product IDs (both attach to `founding_full`):

```text
com.buildprofitsolutions.founding.monthly
com.buildprofitsolutions.founding.annual
```

Attach both products to the `founding` offering in RevenueCat. Do not use the
`default` offering. The mobile app reads packages only from the `founding`
offering and displays prices returned by App Store Connect through RevenueCat.

### Test API key vs Apple API key

RevenueCat keys that start with `test_` connect to RevenueCat's Test Store and
expose generic `$9.99` / `$79.99` products. The app ignores those and only
purchases the App Store product IDs above from the `founding` offering.

For real App Store pricing and sandbox purchases, finish the App Store Connect
link in RevenueCat, attach products to `founding_full` / `founding`, then set:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<Apple public SDK key from RevenueCat>
```

Use the **Apple** public SDK key (`appl_…`, not `test_…`) in EAS / `.env.local`.

## Environment

Mobile EAS environment:

```text
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
```

Backend Render environment:

```text
REVENUECAT_SECRET_API_KEY=
REVENUECAT_WEBHOOK_AUTH=
BILLING_ENFORCEMENT_ENABLED=false
```

The public iOS key may be bundled in the app. The RevenueCat secret key and
webhook authorization must only exist on the backend. Do not hardcode keys in
source files.

## Build and test

RevenueCat requires a native development build; Expo Go cannot load the native
purchase modules.

```bash
npx expo install react-native-purchases react-native-purchases-ui
npx expo run:ios
```

For an EAS development build:

```bash
npx eas build --profile development --platform ios
```

Test:

1. Sign in with Clerk.
2. Open Profile → Payment & Billing → View Plans.
3. Confirm the custom plan screen shows live App Store prices from RevenueCat.
4. Tap Subscribe to complete the Apple purchase sheet (no RevenueCat paywall screen).
5. Confirm the `founding_full` entitlement becomes active.
6. Use Restore Purchases on another sandbox device/account.
7. Use Manage with Apple to open Customer Center.
8. Cancel/expire the sandbox subscription and confirm entitlement refresh.

The backend verifies entitlement state directly through RevenueCat at
`GET /api/billing/entitlement` and `POST /api/billing/sync`. Configure the
RevenueCat webhook URL as:

```text
https://build-profit-solutions-backend.onrender.com/api/billing/revenuecat-webhook
```

Set `BILLING_ENFORCEMENT_ENABLED=true` only after the sandbox purchase,
restore, renewal, cancellation, and webhook flows have been verified.
