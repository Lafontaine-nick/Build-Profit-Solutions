# Timeline Date Sync with Estimate Data

## Overview
The timeline card in project details automatically syncs with the estimated start date and finish date from the estimates page.

## How It Works

### 1. Estimate Data Storage
- **Start Date**: Stored as `projectStartDate` in estimate data
- **End Date**: Calculated as `projectEndDate` based on `projectStartDate` + `projectDuration`
- **Duration**: Stored as `projectDuration` in days

### 2. Project Details Sync
- **Timeline Card**: Uses `startISO` and `endISO` fields from project data
- **Date Source**: Pulls dates from `estimateData?.projectStartDate` and `estimateData?.projectEndDate`
- **Fallback Logic**: Falls back to stored project dates if estimate data is not available

### 3. Code Implementation

#### Project Details Page (`project-detail/[id].tsx`)
```typescript
startISO: realProjectData.estimateData?.projectStartDate || realProjectData.startDate || new Date().toISOString().split('T')[0],
endISO: realProjectData.estimateData?.projectEndDate || realProjectData.estimateData?.endDate || realProjectData.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
```

#### OverviewScreen Component
```typescript
<Text style={[styles.timelineValue, { color: c.text }]}>
  {formatDate(project.startISO)}
</Text>
<Text style={[styles.timelineValue, { color: c.text }]}>
  {formatDate(project.endISO)}
</Text>
```

### 4. Debug Logging
Added console logging to track date synchronization:
- `📅 Estimate Start Date`: Shows the start date from estimate data
- `📅 Estimate End Date`: Shows the end date from estimate data
- `📅 Final Start ISO`: Shows the final start date used in timeline
- `📅 Final End ISO`: Shows the final end date used in timeline

### 5. Project Calculations
Updated `projectCalculations.ts` to also recalculate dates from estimate data:
```typescript
const startDate = estimate.projectStartDate || project.startDate || new Date().toISOString().split('T')[0];
const endDate = estimate.projectEndDate || estimate.endDate || project.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
```

## Benefits

✅ **Automatic Sync**: Timeline dates automatically update when estimate data changes  
✅ **Real-time Updates**: Changes in estimates immediately reflect in project details  
✅ **Fallback Support**: Works even when estimate data is not available  
✅ **Debug Visibility**: Console logging helps track date synchronization  
✅ **Consistent Data**: Timeline card always shows the most current dates  

## Testing

To verify the timeline date sync is working:

1. **Create an estimate** with specific start and end dates
2. **Convert to project** from the estimates page
3. **Check project details** - timeline card should show estimate dates
4. **Update estimate dates** and verify they sync to project details
5. **Check console logs** for date synchronization debug info

## Files Modified

- `mobile/app/project-detail/[id].tsx` - Enhanced date sync logic
- `mobile/utils/projectCalculations.ts` - Added date recalculation
- `mobile/components/OverviewScreen.tsx` - Timeline card display (already working)














