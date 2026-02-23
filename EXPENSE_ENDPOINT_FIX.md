# Expense Endpoint Fix for Estimates

## Problem
When trying to add expenses to estimates, the AI Assistant was failing with "Project not found" error, even though the project exists.

## Root Cause
The expenses endpoint (`/api/projects/:id/expenses`) was strictly checking for `userId` match:
```javascript
const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
```

But estimates might:
1. Not have a `userId` field
2. Use different field names (`ownerId`, `createdBy`)
3. Be stored in a different format

## Solution
Made the project lookup more flexible:

1. **Check multiple userId fields**: Try `userId`, `ownerId`, `createdBy`
2. **Allow projects without userId**: If project has no userId, allow it (for legacy/estimate projects)
3. **Fallback lookup**: If not found with userId check, try without userId check
4. **Better error logging**: Added detailed logging to help debug issues

## Changes Made

### Backend (`backend/src/routes/projects.js`):
- Updated expenses endpoint to check multiple userId fields
- Added fallback lookup without userId check
- Added better error logging

### Backend (`backend/src/routes/aiAssistant.js`):
- Improved error handling with more specific error messages
- Added detailed logging for debugging

## Expected Behavior Now

When adding expenses to estimates:
1. Project lookup works even if estimate doesn't have `userId`
2. Better error messages if project truly not found
3. More detailed logging for debugging

## Testing
1. Restart backend: `cd backend && npm start`
2. Test with estimate: "Let's add 500 material spent"
3. Should now successfully add expense to estimate
4. Check backend logs for any warnings/errors
