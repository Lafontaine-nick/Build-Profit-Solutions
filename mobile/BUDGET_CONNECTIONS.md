# Budget Data Connections

## 📊 How Budget Numbers Flow Through the App

### Data Source: ProjectDataContext

All budget data is managed through `ProjectDataContext` (`contexts/ProjectDataContext.tsx`):

```typescript
{
  projectData: {
    budgeted: 45000,        // Total planned budget
    spent: 31500,           // Total spent
    buckets: [              // Budget categories
      { 
        id: '1', 
        name: 'Materials', 
        spent: 15000,       // Spent in this category
        budget: 20000,      // Budget for this category
        bidBudget: 18000    // Original bid budget
      },
      // ... Labor, Equipment, Subs
    ],
    expenses: [             // All transactions
      {
        id: 'txn-123',
        category: 'Materials',  // Links to bucket
        vendor: 'Home Depot',
        amount: 1250.43,
        date: '2025-01-15',
        notes: 'Lumber & framing'
      }
    ],
    changeOrders: [         // Change orders
      {
        id: 'co-1',
        title: 'Additional Electrical',
        amount: 5000,
        approved: true,     // If approved, updates budgeted amount
        status: 'Approved'
      }
    ]
  }
}
```

---

## 🔗 Connected Components

### 1. **Budget Tab → Line Items**
**Location**: `components/BudgetTab.tsx`

Shows budget categories (Materials, Labor, Equipment, Subs) with:
- **Budget** (from `bucket.budget`)
- **Spent** (from `bucket.spent`)
- **Progress bar** (spent / budget)

When you **tap a category card**, it opens:

### 2. **Category Detail Modal**
**Location**: `components/CategoryDetailModal.tsx`

Shows all transactions for that category:
- Filters `projectData.expenses` by `category` field
- Displays vendor, amount, date, description
- Calculates total spent in category

When you **tap "+ Add Materials"**, it opens:

### 3. **Add Transaction Modal**
**Location**: `components/AddTransactionModal.tsx`

Collects transaction details:
- Vendor name
- Amount
- Description
- PO number (optional)

When you **tap "Save Transaction"**:
1. Calls `addExpense()` from ProjectDataContext
2. Expense is added to `projectData.expenses[]`
3. **Automatically updates the matching bucket's spent amount**
4. **Updates total `projectData.spent`**

```typescript
addExpense({
  id: 'txn-123',
  category: 'Materials',  // ← Matches bucket.name
  vendor: 'Home Depot',
  amount: 1250.43,
  date: '2025-01-15',
  notes: 'Lumber'
});

// Result:
// ✅ Materials bucket.spent increases by 1250.43
// ✅ projectData.spent increases by 1250.43
// ✅ Overview card reflects new total
```

---

### 4. **Budget Tab → Orders (Change Orders)**
**Location**: `components/BudgetTab.tsx`

When you **add a change order**:
1. Calls `addChangeOrder()` from ProjectDataContext
2. Change order is added to `projectData.changeOrders[]`
3. **If approved = true**: increases `projectData.budgeted`

```typescript
addChangeOrder({
  id: 'co-1',
  title: 'Additional Electrical',
  amount: 5000,
  approved: true
});

// Result:
// ✅ projectData.budgeted increases by 5000
// ✅ Overview card shows new budget
```

---

### 5. **Overview Card/Page**
**Location**: `components/OverviewScreen.tsx`

Displays summary from `projectData`:
- **Total Budget**: `projectData.budgeted` (includes approved change orders)
- **Total Spent**: `projectData.spent` (sum of all expenses)
- **Progress**: calculated from buckets
- **Spending Trend Chart**: uses `projectData.expenses` by date

---

## ✅ What's Automatically Connected

### When you add a transaction:
- ✅ **Bucket spent** updates (e.g., Materials)
- ✅ **Total spent** updates
- ✅ **Overview card** reflects new total
- ✅ **Progress bars** update
- ✅ **Spending chart** includes new transaction
- ✅ **AI Budget Insights** gets new data
- ✅ **Budget Alerts** trigger if over threshold

### When you add a change order (approved):
- ✅ **Total budget** increases
- ✅ **Overview card** shows new budget
- ✅ **Budget variance** recalculates

### When you add a change order (not approved):
- ✅ **Shows in Orders list**
- ❌ **Doesn't affect budget yet** (until approved)

---

## 🎯 Category Matching

Expenses link to buckets by matching the `category` field (case-insensitive):

| Category in Expense | Matches Bucket |
|---------------------|----------------|
| `"Materials"` | Materials |
| `"materials"` | Materials |
| `"Labor"` | Labor |
| `"Equipment"` | Equipment |
| `"Subs"` | Subs |

If no match found, expense goes to the first bucket as fallback.

---

## 📱 User Flow Example

1. **View Budget** → See Materials at $15,000 / $20,000
2. **Tap Materials** → See all Materials transactions
3. **Tap "+ Add Materials"** → Fill form: Home Depot, $1,250.43
4. **Tap "Save Transaction"** → 
   - Success alert shows
   - Materials updates to $16,250.43 / $20,000
   - Total spent increases
   - Overview card updates
   - Spending chart adds new point

---

## 🚀 Real-Time Updates

All updates happen **instantly in the app** because:
- Context state triggers re-renders
- All components use the same `projectData`
- No API calls needed (local state)

In production, you'd sync to backend API after each update.

---

## 💡 Key Files

- **Context**: `contexts/ProjectDataContext.tsx`
- **Budget Tab**: `components/BudgetTab.tsx`
- **Category Modal**: `components/CategoryDetailModal.tsx`
- **Add Transaction**: `components/AddTransactionModal.tsx`
- **Overview**: `components/OverviewScreen.tsx` 