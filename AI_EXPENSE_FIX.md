# AI Assistant Expense Fix

## Problem
When user said "Let's add 500 material spent", the AI:
1. Added it to budget items (via `add_material_to_estimate`)
2. Did NOT add it to Material Transactions (expenses)
3. Did NOT update the overall budget/spent totals correctly

## Root Cause
The AI was checking project status first (Estimate phase) and using `add_material_to_estimate` instead of checking user language first. When user says "spent", they want an expense transaction, not a budget line item.

## Solution
Updated the system prompt to prioritize user language over project status:

1. **Check "spent" language FIRST**: If user says "spent", "bought", "purchased", "paid", "expense" → ALWAYS use `add_material_expense` (regardless of project status)

2. **Updated function descriptions**: Made it clear that `add_material_expense` works for both estimates and active projects when user says "spent"

3. **Updated routing logic**: Check user language first, then project status

## Changes Made

### Backend (`backend/src/routes/aiAssistant.js`):
- Updated system prompt to prioritize "spent" language
- Updated `add_material_expense` function description to work for estimates too
- Updated routing logic to check user language before project status

## Expected Behavior Now

When user says "add 500 material spent":
1. AI detects "spent" language
2. Uses `add_material_expense` function (even for estimates)
3. Creates expense transaction in Material Transactions
4. Updates overall budget/spent totals
5. Expense appears in project's expense list

## Testing
1. Restart backend: `cd backend && npm start`
2. Test with: "Let's add 500 material spent"
3. Should create expense transaction, not budget item
4. Should appear in Material Transactions
5. Should update overall budget totals
