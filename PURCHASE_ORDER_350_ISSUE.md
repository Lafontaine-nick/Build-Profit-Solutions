# Purchase Order $350 Placeholder Amount Issue

## Problem
The AI Assistant keeps using $350 (and other placeholder amounts like $500, $1000) when creating purchase orders, even when the user never provided an amount. The user only said "Windows" as the category, but the AI created a PO for $350.

## Current Status
**Status:** Still not working - AI continues to use $350 despite multiple validation attempts

## What We've Tried

### 1. System Prompt Updates
- Added explicit rules: "NEVER mention any dollar amount ($350, $500, $1000, etc.) unless user explicitly provided it"
- Added step-by-step instructions to ask for amount, category, vendor before calling function
- Removed all $350 examples from system prompt

### 2. Pre-Validation (Before Function Execution)
- Added pre-validation that checks if amount is missing
- Added validation to reject common placeholder amounts (350, 500, 1000) unless explicitly provided
- Checks ALL user messages (not just last one) to see if user ever mentioned the amount
- Blocks function call if placeholder amount not found in user messages

**Location:** Lines 1379-1420 in `aiAssistant.js`

### 3. Function-Level Validation (executeAddPurchaseOrder)
- Removed all extraction logic - function now only uses what AI explicitly provided
- Added hard validation that rejects if amount, category, or vendor is missing
- Added validation to check if vendor is a material name (prevents "Windows" from being treated as vendor)
- Added validation to check ALL user messages for placeholder amounts

**Location:** Lines 483-566 in `aiAssistant.js`

### 4. Fallback Mechanism Fix
- Updated fallback that creates PO if AI says it created one but didn't
- Added check to skip placeholder amounts unless they have explicit indicators ($, "dollars")

**Location:** Lines 2172-2194 in `aiAssistant.js`

## Root Cause Analysis

The issue persists because:
1. **AI is still calling the function with $350** - The validation should block it, but the AI might be:
   - Ignoring the validation errors
   - Getting $350 from somewhere else (training data, examples, etc.)
   - Not properly reading the error messages from function results

2. **Validation might not be strict enough** - Even though we check all user messages, the AI might be finding $350 in:
   - Previous conversations
   - Context data
   - Some other source

3. **AI might be hallucinating the amount** - The AI might be making up $350 based on:
   - Common purchase order amounts in training data
   - Examples in the system prompt
   - General knowledge about typical PO amounts

## Next Steps (When Continuing)

### Option 1: Complete Block of Placeholder Amounts
- Add a hard block that ALWAYS rejects $350, $500, $1000 regardless of context
- Only allow these amounts if user explicitly types "$350" or "350 dollars" in the CURRENT message
- Make the error message even more explicit: "CRITICAL: $350 was NEVER mentioned by user. Function call REJECTED."

### Option 2: Remove Amount Parameter from Function Call
- Don't let AI provide amount in function call at all
- Force AI to ask for amount first, then call function with user's response
- This would require changing the function schema

### Option 3: Add Explicit System Message After Function Call
- When validation fails, add a system message that's very explicit:
  "CRITICAL ERROR: You attempted to use $350 but the user NEVER mentioned this amount. You MUST ask 'How much is the purchase order for?' DO NOT mention $350 in your response."

### Option 4: Check AI's Response for Placeholder Amounts
- After AI generates response, check if it mentions $350, $500, $1000
- If it does and user didn't provide it, regenerate response or add correction

### Option 5: Use State Machine Approach (From User's Suggestion)
- Implement the drop-in package approach the user provided
- Use a PO draft state that tracks missing fields
- Only call function when all fields are explicitly provided
- This would be a more fundamental rewrite

## Current Code Locations

### Pre-Validation
- File: `backend/src/routes/aiAssistant.js`
- Lines: 1379-1420
- Function: Pre-validation before `add_purchase_order` execution

### Function Validation
- File: `backend/src/routes/aiAssistant.js`
- Lines: 483-566
- Function: `executeAddPurchaseOrder`

### Fallback Mechanism
- File: `backend/src/routes/aiAssistant.js`
- Lines: 2140-2233
- Function: Fallback that creates PO if AI says it did but didn't

### System Prompt
- File: `backend/src/routes/aiAssistant.js`
- Lines: 126, 208-223
- Section: Purchase order instructions

## Test Case
**User says:** "Create me a purchase order"
**AI should:** Ask "How much is the purchase order for?"
**User says:** "Windows"
**AI should:** Ask "Which vendor is this from?" (NOT create PO for $350)

**Current behavior:** AI creates PO for $350 even though user never provided amount

## Notes
- Backend is currently running with all validation in place
- All validation logic is active but AI still bypasses it
- May need to check OpenAI API response handling or add post-processing
