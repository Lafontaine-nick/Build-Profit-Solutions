# Budget Totals Sync Fix

## Problem
Budget totals displayed in the **project details page** were not reflecting in the **overview page**. This caused inconsistencies where the detailed view showed different budget values than the project list/overview.

## Root Cause
The project details page was **recalculating** the budget total on-the-fly from estimate data (materials + labor + overhead + markup), but this recalculated value was **not being saved back** to the `ProjectListContext`. 

The overview page reads from `ProjectListContext`, which only had the original `bidPrice` that was set when the estimate was first created.

### Data Flow Issue:
```
Estimate Generator → Saves bidPrice to ProjectListContext
                     ↓
Project Details Page → Recalculates budget (but doesn't save it back!)
                     ↓
Overview Page → Reads old bidPrice from ProjectListContext ❌
```

## Solution
Modified `/mobile/app/project-detail/[id].tsx` to:

1. **Extract budget calculation** into a reusable `recalculatedBudget` variable (lines 48-61)
2. **Add sync logic** using a `useEffect` hook that automatically updates the ProjectListContext whenever the budget is recalculated (lines 63-76)
3. **Use the recalculated budget** consistently throughout the component (line 100)

### New Data Flow:
```
Estimate Generator → Saves bidPrice to ProjectListContext
                     ↓
Project Details Page → Recalculates budget
                     ↓
                     → Syncs back to ProjectListContext ✅
                     ↓
Overview Page → Reads updated bidPrice from ProjectListContext ✅
```

## Changes Made

### File: `/mobile/app/project-detail/[id].tsx`

✅ **Added `updateProject` to imports** (line 24)
```typescript
const { getProjectById, updateProject } = useProjectList();
```

✅ **Added budget recalculation logic** (lines 48-61)
```typescript
const recalculatedBudget = realProjectData?.estimateData ? (() => {
  const materials = materialsCart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const equipment = Number(realProjectData.estimateData.equipment) || 0;
  const facilities = Number(realProjectData.estimateData.facilities) || 0;
  const insuranceOverhead = Number(realProjectData.estimateData.insuranceOverhead) || 0;
  const otherOverhead = Number(realProjectData.estimateData.otherOverhead) || 0;
  const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
  const subtotal = materials + labor + equipment + facilities + insuranceOverhead + otherOverhead + permitCost;
  const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
  const markup = subtotal * (markupPct / 100);
  return Math.round(subtotal + markup);
})() : null;
```

✅ **Added sync effect** (lines 63-76)
```typescript
useEffect(() => {
  if (recalculatedBudget !== null && realProjectData && id) {
    const currentBidPrice = realProjectData.bidPrice || 0;
    // Only update if the recalculated budget is different from the stored one
    if (Math.abs(recalculatedBudget - currentBidPrice) > 0.01) {
      console.log(`💰 Syncing budget: ${currentBidPrice} → ${recalculatedBudget}`);
      updateProject(id as string, {
        bidPrice: recalculatedBudget,
        estimatedCost: recalculatedBudget,
      });
    }
  }
}, [recalculatedBudget, realProjectData?.bidPrice, id]);
```

✅ **Updated budgeted field** (line 100)
```typescript
budgeted: recalculatedBudget !== null ? recalculatedBudget : (Number(realProjectData.bidPrice) || Number(realProjectData.estimatedCost) || 0),
```

## Additional Fix: Budget Breakdown Sync

After the initial fix, there was still a mismatch in the **budget breakdown by category** between the Overview tab and Budget tab. This was because:

1. **Overview tab** showed all categories: Labor, Materials, Overhead, Markup
2. **Budget tab** was only including Labor and Materials in its "Planned Budget" calculation
3. The `convertToBudgetData` function was creating separate categories instead of matching the Overview structure

### Additional Changes Made:

✅ **Updated `convertToBudgetData` function** in `/mobile/app/project-detail/[id].tsx` (lines 251-293):
- Combined all overhead costs (equipment, facilities, insurance, permits, subcontractors) into a single "Overhead" category
- Added a separate "Markup" category for profit/markup
- Now matches the exact bucket structure used by OverviewScreen

✅ **Updated BudgetTab planned budget calculation** in `/mobile/components/BudgetTab.tsx` (lines 222-225):
- Changed from only including "Materials" and "Labor" 
- Now includes all categories: "Materials", "Labor", "Overhead", "Markup"
- This matches what the OverviewScreen displays

## Final Fix: Spent Amounts Not Updating

After the budget breakdown sync, there was still an issue where **spent amounts and remaining balances** weren't updating when expenses were added. This was because:

1. **ProjectDataContext** correctly tracked expenses and updated spent amounts in buckets
2. **Project details page** was creating its own `projectData` object that overwrote buckets with `spent: 0`
3. **BudgetTab and OverviewScreen** never saw the updated spent amounts

### Final Changes Made:

✅ **Updated project data creation** in `/mobile/app/project-detail/[id].tsx`:
- Changed from using `mockProjectData` to using `contextProjectData` as base
- Updated bucket creation to preserve spent amounts from ProjectDataContext:
  ```typescript
  spent: contextProjectData?.buckets?.find(b => b.name === 'Labor')?.spent || 0
  ```
- Preserved expenses, changeOrders, and other tracked data from ProjectDataContext

✅ **Updated `convertToBudgetData` function**:
- Added spent amounts from ProjectDataContext for all categories (Materials, Labor, Overhead, Markup)
- Included expenses and changeOrders from ProjectDataContext

## Result
✅ Budget totals now stay synchronized across:
- Project Details Page
- Overview Page (Budget Summary section)
- Budget Tab (Planned Budget calculation)
- Dashboard Metrics
- Project List

✅ Budget breakdown by category now matches between:
- Overview tab: Labor, Materials, Overhead, Markup
- Budget tab: Same categories with same totals

✅ **Spent amounts and remaining balances now update correctly:**
- When you add expenses/transactions, they're reflected immediately
- Budget categories show correct spent vs budget amounts
- Remaining balances are calculated correctly
- Progress bars show actual spending progress

The budget is automatically recalculated when you open a project detail page, and the updated value is persisted to AsyncStorage through the ProjectListContext.

## Timeline Sync with Estimates

✅ **Timeline page cleared and synced with estimates:**
- Removed hardcoded initial milestone data
- Timeline now starts empty and syncs with estimate payment milestones
- Automatic sync when project has payment milestones from estimates
- Manual "Sync Estimate" button to refresh timeline from estimate data
- Payment milestones converted to timeline milestones with proper dependencies

**Timeline Features:**
- ✅ Auto-sync with estimate payment milestones on first load
- ✅ Manual sync button to refresh from estimate data
- ✅ Timeline milestones include payment amounts and schedules
- ✅ Dependencies between milestones (each payment depends on previous)
- ✅ Progress tracking and status updates

## Projects Page Sync

✅ **Projects page now syncs value, margin, and progress:**
- Created `projectCalculations.ts` utility to recalculate project values from estimate data
- Projects page now recalculates `value`, `margin`, and `progress` from estimate data
- Real-time sync with materials cart and labor line items
- Loading indicator shows when recalculating values
- All project cards show updated values from estimate calculations

**Projects Page Features:**
- ✅ Auto-recalculates project values when projects change
- ✅ Uses recalculated `bidPrice` as project value
- ✅ Calculates margin percentage from estimate markup
- ✅ Calculates progress based on actual vs planned costs
- ✅ Loading state during recalculation
- ✅ Console logging for debugging value changes

## Testing
To verify the fix:
1. Create/open an estimate
2. Navigate to the project details page
3. Check the budget total displayed
4. Navigate back to the overview/project list
5. Verify the budget total matches

You should see a console log: `💰 Syncing budget: [old value] → [new value]` when the sync happens.

