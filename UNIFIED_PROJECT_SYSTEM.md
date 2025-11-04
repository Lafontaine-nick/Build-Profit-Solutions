# 🔄 Unified Project System - Connecting Dashboard, Projects & Estimates

## 🎯 **Goal:**
Connect the Dashboard, Projects, and Estimates pages so data flows seamlessly:
- **Estimates** → Creates bids/estimates
- **Win bid** → Becomes a **Project**
- **Projects** → Track progress, costs
- **Dashboard** → Shows real metrics from actual projects

---

## ✅ **What's Been Built:**

### **1. Unified ProjectListContext** ✅
**Location:** `mobile/contexts/ProjectListContext.tsx`

**Features:**
- ✅ Single source of truth for all project data
- ✅ `UnifiedProject` interface combining all data
- ✅ Automatic AsyncStorage persistence
- ✅ Real-time dashboard metrics calculation
- ✅ Status lifecycle management

**Project Lifecycle:**
```
estimate → bid_submitted → won → in_progress → completed
                            ↓
                          lost
```

---

## 📊 **Unified Project Interface:**

```typescript
interface UnifiedProject {
  id: string;
  title: string;
  
  // Status lifecycle
  status: 'estimate' | 'bid_submitted' | 'won' | 'in_progress' | 'completed' | 'lost';
  
  // Financial data
  estimatedCost: number;
  bidPrice: number;
  actualCost?: number;
  margin: number;
  markup: number;
  
  // Location
  location: string;
  city?: string;
  state?: string;
  
  // Timeline
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  
  // Client
  client: string;
  clientEmail?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔄 **Data Flow:**

### **Step 1: Create Estimate (Estimates Page)**
```
User creates estimate/bid
↓
addEstimate() called
↓
Project added with status: 'estimate'
↓
Saved to AsyncStorage
```

### **Step 2: Submit Bid**
```
User submits bid to client
↓
updateProject(id, { status: 'bid_submitted' })
↓
Appears in "Pending Bids" count
```

### **Step 3: Win Bid**
```
User marks bid as won
↓
convertBidToProject(bidId) called
↓
Status changes: 'bid_submitted' → 'won'
↓
Appears in Projects page
↓
Dashboard metrics update
```

### **Step 4: Track Progress**
```
User updates project progress in Projects page
↓
updateProjectProgress(id, 75, actualCost)
↓
Status: 'won' → 'in_progress'
↓
Dashboard shows real-time metrics
```

### **Step 5: Complete Project**
```
Progress reaches 100%
↓
Status: 'in_progress' → 'completed'
↓
Dashboard calculates final profit
```

---

## 🎯 **Integration Points:**

### **Estimates Page:**
```typescript
import { useProjectList } from '@/contexts/ProjectListContext';

// When user creates estimate
const { addEstimate } = useProjectList();

const handleSaveEstimate = () => {
  addEstimate({
    id: `EST-${Date.now()}`,
    title: bid.title,
    status: 'estimate',
    estimatedCost: calcData.materials + calcData.labor,
    bidPrice: calcData.grandTotal,
    margin: calcData.margin,
    markup: bid.markupPct,
    location: `${bid.customerCity}, ${bid.customerState}`,
    client: bid.customerName,
    startDate: bid.startDate,
    endDate: bid.endDate,
    progress: 0,
  });
};
```

### **Projects Page:**
```typescript
import { useProjectList } from '@/contexts/ProjectListContext';

const { activeProjects, estimates } = useProjectList();

// Show real projects instead of mock data
const allProjects = [...activeProjects, ...estimates];
```

### **Dashboard Page:**
```typescript
import { useProjectList } from '@/contexts/ProjectListContext';

const { dashboardMetrics, activeProjects } = useProjectList();

// Use real metrics
<MetricCard
  label='Revenue'
  value={`$${(dashboardMetrics.totalRevenue / 1000).toFixed(1)}K`}
  trend={12.5}
/>

<MetricCard
  label='Active Projects'
  value={dashboardMetrics.activeProjectsCount.toString()}
  trend={16.7}
/>
```

---

## 📈 **Dashboard Metrics (Auto-Calculated):**

```typescript
dashboardMetrics = {
  totalRevenue: sum of all bidPrice from won/in_progress projects,
  totalExpenses: sum of all actualCost (or estimatedCost if not started),
  totalProfit: totalRevenue - totalExpenses,
  activeProjectsCount: count of 'in_progress' projects,
  wonBidsCount: count of 'won' projects (not started yet),
  pendingBidsCount: count of 'bid_submitted' estimates,
}
```

---

## 🔥 **Next Steps to Complete Integration:**

### **1. Connect Estimates Page**
- Add "Save Estimate" button
- Call `addEstimate()` when user finishes estimate
- Add "Submit Bid" button (changes status to 'bid_submitted')
- Add "Mark as Won" button (calls `convertBidToProject()`)

### **2. Update Projects Page**
- Replace `mockProjects` with `activeProjects` from context
- Show real projects from won bids
- Add progress tracking that updates context

### **3. Update Dashboard**
- Replace static metrics with `dashboardMetrics`
- Show real project list from context
- Calculate trends from actual data

---

## 🎯 **User Experience:**

**Before (Disconnected):**
- Dashboard shows fake metrics
- Projects page shows mock projects
- Estimates don't become projects
- No data connection

**After (Connected):**
```
Create estimate → Save → Shows in Estimates
                         ↓
Submit bid → Pending Bids count increases on Dashboard
                         ↓
Win bid → Becomes active project
        → Shows in Projects page
        → Dashboard revenue updates
                         ↓
Track progress → Projects page updates
              → Dashboard shows real-time profit
                         ↓
Complete project → Dashboard shows completed value
                → Project archived
```

---

## ✅ **Benefits:**

1. **Single Source of Truth** - All pages share same data
2. **Real-Time Updates** - Change in one page reflects everywhere
3. **Persistent Data** - AsyncStorage saves everything
4. **Accurate Metrics** - Dashboard shows real numbers
5. **Project Lifecycle** - Track from estimate to completion
6. **Better UX** - No more fake/mock data

---

## 🚀 **Implementation Status:**

- ✅ UnifiedProjectListContext created
- ✅ Data structures defined
- ✅ Lifecycle methods implemented
- ✅ Dashboard metrics calculator built
- ⏳ Need to integrate into Estimates page
- ⏳ Need to integrate into Projects page  
- ⏳ Need to integrate into Dashboard page

**Ready to proceed with connecting the pages!**




