# Border Cutoff Analysis - Customer Information Section

## Problem Summary
The "Customer Information" section's borders are being cut off on the sides and not matching the "Untitled Bid" card's border alignment.

## Root Cause Analysis

### 1. "Untitled Bid" Card (Working Correctly)
**Location:** Lines 6683-6696

**Container Structure:**
- Main ScrollView: `paddingHorizontal: 20` (line 6651)
- "Untitled Bid" card: `marginHorizontal: -8` (line 6684)
- **Effective margin:** 20px - 8px = **12px on each side** ✅

**Result:** Card has proper borders with consistent 12px margin on both sides.

### 2. Customer Information Form Card (Border Cutoff Issue)
**Location:** Lines 4312-4325 (inside `renderStepContent()` for step 2)

**Container Structure:**
- KeyboardAvoidingView wrapper (line 4300)
- Inner ScrollView: `paddingHorizontal: 20` (line 4306)
- Customer Information card: `marginHorizontal: -22` (line 4313)
- **Effective margin:** 20px - 22px = **-2px on each side** ❌

**Result:** Card extends 2px beyond the screen edges on each side, causing borders to be cut off.

### 3. Navigation Buttons Section
**Location:** Lines 6759-6831 (inside "Untitled Bid" card)

The navigation buttons are correctly positioned inside the "Untitled Bid" card, so they inherit the card's proper padding. However, if there's any visual issue with this section, it could be due to:
- The buttons extending to the card's edges
- Potential overflow if button content is too wide
- Missing padding constraints

## The Issue

The **Customer Information form card** uses `marginHorizontal: -22` which is **too aggressive** compared to the "Untitled Bid" card's `marginHorizontal: -8`.

### Calculation Breakdown:

**"Untitled Bid" Card:**
```
ScrollView padding: 20px
Card negative margin: -8px
Effective side margin: 20 - 8 = 12px ✅
```

**Customer Information Card:**
```
Inner ScrollView padding: 20px
Card negative margin: -22px
Effective side margin: 20 - 22 = -2px ❌ (extends beyond screen)
```

## Solution

To fix the border cutoff, the Customer Information card's `marginHorizontal` should match the "Untitled Bid" card's value:

**Change from:**
```jsx
marginHorizontal: -22,  // ❌ Too aggressive, cuts off borders
```

**Change to:**
```jsx
marginHorizontal: -8,  // ✅ Matches "Untitled Bid" card
```

This will result in:
- Effective margin: 20px - 8px = 12px on each side
- Borders will be fully visible
- Alignment will match the "Untitled Bid" card

## Additional Considerations

1. **Nested ScrollView Issue:** The Customer Information section is inside a nested ScrollView (inside KeyboardAvoidingView), which might cause additional layout complications.

2. **Consistency:** All cards that should match the "Untitled Bid" card width should use `marginHorizontal: -8` when inside a container with `paddingHorizontal: 20`.

3. **Overflow:** Ensure parent containers don't have `overflow: 'hidden'` that might clip the borders even if margins are correct.




















