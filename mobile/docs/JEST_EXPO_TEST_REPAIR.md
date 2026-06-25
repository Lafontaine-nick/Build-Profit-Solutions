# Jest / Expo Test Repair

## Current blocker

Focused utility suites for the benchmark pricing catalog currently fail before
test code executes. Jest loads `jest-expo`, then fails parsing:

```text
node_modules/expo-modules-core/src/polyfill/dangerous-internal.ts
SyntaxError: Cannot use import statement outside a module
```

This blocks the new catalog coverage/profile tests from running even though IDE
TypeScript diagnostics are clean.

## Repair path

1. Add an explicit Jest config for the mobile app instead of relying only on the
   package-level default.
2. Use the Expo preset and make sure Expo/React Native ESM packages are included
   in `transformIgnorePatterns`.
3. Run tests on a Node version supported by the installed Expo/Jest stack. The
   local shell used during this work reported Node `v25.2.1`, which is likely
   newer than the tested Expo/Jest matrix.
4. Re-run the focused catalog suites:

```sh
npm test -- --testPathPattern="benchmarkPricingCoverage|scopeItemPricing|scopeIntelligence|scopeReviewUi|tradeScopeGuidance" --no-coverage
```

5. Once the focused suites pass, run the full mobile Jest suite before enabling
   hard production gating.

## Candidate config shape

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-modules-core|@expo/.*)/)',
  ],
};
```

Validate this against the installed Expo SDK before committing a Jest config
change.
