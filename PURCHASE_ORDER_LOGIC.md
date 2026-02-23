# Purchase Order Creation Logic - WORKING AS INTENDED

## ✅ Current Working Flow

The purchase order creation now works correctly with the following flow:

1. **User:** "Create me a purchase order"
2. **AI:** "How much is the purchase order for? Additionally, which vendor is this from, and what category is this for?"
3. **User:** "It was 400 for lumber" (or similar - amount + category)
4. **AI:** Creates purchase order and confirms

## Key Logic Points (DO NOT CHANGE)

### 1. Amount Validation
- ✅ AI asks for amount if not provided
- ✅ Pre-validation rejects placeholder amounts (350, 500, 1000) unless user explicitly provides them
- ✅ Validation requires explicit indicators ($, "dollars", "for $X") for purchase orders
- ✅ Plain numbers (like "400") are accepted ONLY if AI just asked "How much is the purchase order for?"

### 2. Vendor Extraction
- ✅ Numbers are NOT treated as vendor names (fixed bug where "400" was treated as vendor)
- ✅ AI asks for vendor if not provided
- ✅ Vendor extraction skips numbers: `/^\d+(\.\d+)?$/.test(msgText)` check prevents numbers from being vendors

### 3. Category Extraction
- ✅ Can extract category from user message (e.g., "lumber", "windows", "materials")
- ✅ AI asks for category if not provided

### 4. Function Execution
- ✅ `executeAddPurchaseOrder` validates all required fields
- ✅ Returns both `action` and `projectUpdate` with purchase order
- ✅ Purchase order appears in "Committed POs" in budget

## Critical Code Sections

### Pre-Validation (Lines ~1520-1555)
```javascript
// PRE-VALIDATION: Reject ANY amount that user didn't explicitly provide
if (functionName === 'add_purchase_order' && functionArgs.amount) {
  // Checks for explicit indicators ($, "dollars", "for $X")
  // Rejects placeholder amounts (350, 500, 1000) unless user provided them
}
```

### Vendor Extraction (Lines ~672-706)
```javascript
// CRITICAL: Don't treat numbers as vendor names
const isJustNumber = /^\d+(\.\d+)?$/.test(msgText);
if (isJustNumber) {
  continue; // Skip numbers - they're amounts, not vendors
}
```

### Amount Validation (Lines ~550-670)
```javascript
// Validates that amount was explicitly mentioned by user
// Requires explicit indicators for purchase orders
// Accepts plain numbers only if AI just asked for amount
```

## Configuration Settings

- **Temperature:** 0.3 (lowered from 0.7 for more deterministic behavior)
- **Max Tokens:** 2000 (increased from 1000 to prevent truncation)
- **Model:** gpt-4o-mini

## What NOT to Change

1. **DO NOT** remove the number check in vendor extraction
2. **DO NOT** remove pre-validation for placeholder amounts
3. **DO NOT** change temperature back to 0.7
4. **DO NOT** remove explicit indicator requirements for purchase order amounts
5. **DO NOT** allow plain numbers without AI asking for amount first

## Testing Checklist

When making changes, verify:
- [ ] AI asks for amount if user doesn't provide it
- [ ] AI asks for vendor if user doesn't provide it
- [ ] AI asks for category if user doesn't provide it
- [ ] Numbers are NOT treated as vendor names
- [ ] Placeholder amounts (350, 500, 1000) are rejected unless user provides them
- [ ] Purchase orders appear in "Committed POs" after creation
- [ ] Plain numbers (like "400") work when AI asks "How much?"

## Last Updated
2026-02-18 - Purchase order creation working correctly with proper validation
