# Step 1 Bid Summary - Width Fix (Permanent)

**Date:** December 2024  
**Status:** ✅ FIXED - DO NOT REVERT

## Root Cause
Step 1 had a **nested ScrollView** inside the main ScrollView, which caused width calculation issues and made cards appear cut off.

## Solution
Removed the nested ScrollView and changed Step 1 to return a simple `View` like Steps 2-3, using `s.wideContainer` for consistent width.

## Correct Structure (DO NOT CHANGE)

```jsx
case 1: {
  return (
    <View style={[s.wideContainer, {
      paddingVertical: 20,
      backgroundColor: Colors.card,
      marginBottom: 16,
      marginTop: 16,
    }]}>
      {/* Card content here */}
    </View>
  );
}
```

## Key Points
- ✅ **NO nested ScrollView** - Main ScrollView handles all scrolling
- ✅ Uses `s.wideContainer` (same as Steps 2-3 and dashboard)
- ✅ Border width: `padding: 1` (matches dashboard)
- ✅ Border radius: outer `20`, inner `18` (matches dashboard)

## What NOT to Do
- ❌ Do NOT add a ScrollView inside Step 1's return
- ❌ Do NOT use hardcoded `marginHorizontal: -24` or similar
- ❌ Do NOT change border width from `padding: 1`
- ❌ Do NOT use different container styling than `s.wideContainer`

## Verification
Step 1 cards should:
- Match dashboard/analytics/projects card width exactly
- Have consistent 1px borders (green-to-blue gradient)
- Not be cut off on edges
- Use same structure as Steps 2-3

## File Location
`mobile/app/(tabs)/estimate-generator.jsx` - Lines ~5082-5370
