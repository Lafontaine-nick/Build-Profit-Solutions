# Root Cause: "Nick materials 400% above estimate" When Project Is Within Budget

## Summary

The AI Command Center (Today Brief, Biggest Risk) was showing "Nick materials 400% above estimate" while the Budget tab correctly showed the project within budget. The root cause is **stale bucket data** in the project list vs. **live-computed buckets** in the Budget tab.

---

## Data Flow

### Budget Tab (correct)

1. **Source**: `convertToBudgetData()` in project-detail
2. **Builds buckets from**: `data.lines` = estimate line items (`materialsCart`, `materialLineItems`, `laborLineItems`)
3. **Materials budget**: Sum of materialsCart or materialLineItems (e.g. $26,592.99)
4. **Spent**: Sum of expenses in that category
5. **Result**: Materials 24.4% used, $20,092.99 remaining ✓

### Command Center / Today Brief (incorrect)

1. **Source**: `allProjects` from ProjectListContext
2. **Buckets from**: `p.projectData?.buckets || p.buckets` — stored in AsyncStorage (`bps.project.${id}`)
3. **When written**: When project is created (from estimate) or when `addExpense` updates bucket **spent** (not budget)
4. **Problem**: Bucket **budget** is never updated when:
   - Change orders add to materials
   - Estimate line items change
   - User edits materials in the estimate
5. **Result**: Stale bucket can have budget = $1,300 (original) while spent = $6,500 → 400% over

---

## Why the Mismatch?

| Aspect | Budget Tab | Command Center |
|--------|------------|----------------|
| Bucket source | `data.lines` from `convertToBudgetData()` | `projectData.buckets` from AsyncStorage |
| Materials budget | materialsCart / materialLineItems total | Stale value from project creation |
| When computed | On every render (fresh) | From last save (can be old) |
| Change orders | Applied at total level | Not reflected in bucket budgets |

---

## Fixes Applied

1. **Use larger of bucket vs estimate**: `materialBudget = Math.max(bucketBudget, estimateData.materialTotal)`
2. **Fallback from line items**: When `materialTotal` is 0, compute from `materialLineItems` / `materialsCart` (same as Budget tab)
3. **Skip when project within budget**: If `actualCost <= adjustedCostBudget`, don't flag category overrun (likely stale data)
4. **Suspicious budget check**: If material budget < 5% of total project cost, treat as bad data and skip
5. **Use cost budget, not revenue**: Compare `actualCost` to `estimatedCost + changeOrders`, not `bidPrice`

---

## Long-Term Fix (Optional)

To eliminate the mismatch entirely, the **project list context** could compute buckets the same way as the Budget tab when building `allProjects` for the greeting:

- For each project, run logic similar to `convertToBudgetData` using `estimateData.materialLineItems`, `estimateData.laborLineItems`
- Use that computed structure instead of `projectData.buckets` from storage

This would require either:
- A shared utility on the frontend to compute buckets from estimate
- Or ensuring `projectData.buckets` is synced whenever the Budget tab's `data.lines` change (currently it is not)
