import AsyncStorage from '@react-native-async-storage/async-storage';

// Recalculate project values from estimate data
export async function recalculateProjectValues(project: any) {
  try {
    if (!project.estimateData) {
      // No estimate data, return original values
      return {
        value: project.bidPrice || 0,
        margin: project.margin || 0,
        progress: project.progress || 0,
      };
    }

    const estimate = project.estimateData;
    
    // Calculate materials from global materialsCart (this is how the estimate generator works)
    const materialsCartData = await AsyncStorage.getItem('bps.materialsCart');
    const materialsCart = materialsCartData ? JSON.parse(materialsCartData) : [];
    const materials = materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    
    console.log(`🔍 Recalculation for project ${project.id}:`);
    console.log(`📦 Materials cart length: ${materialsCart.length}`);
    console.log(`💰 Materials total: ${materials}`);
    console.log(`📊 Materials cart:`, materialsCart);
    
    // If materials cart is empty, this might be the issue
    if (materialsCart.length === 0) {
      console.warn(`⚠️ Materials cart is EMPTY for project ${project.id}! This will cause incorrect calculations.`);
      console.log(`🔍 Checking if materials are stored in estimate data...`);
      console.log(`📊 Estimate materialLineItems:`, estimate.materialLineItems);
    }
    
    // Calculate labor from laborLineItems
    const labor = (estimate.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    console.log(`👷 Labor line items length: ${(estimate.laborLineItems || []).length}`);
    console.log(`💰 Labor total: ${labor}`);
    console.log(`📊 Labor line items:`, estimate.laborLineItems);
    
    const planCost = Number(estimate.planCost) || 0;
    const permitCost = Number(estimate.permitCost) || 0;
    const plansPermits = planCost + permitCost;
    const equipmentRental = Number(estimate.equipment) || 0;
    const otherDirectCost = Number(estimate.otherDirectCost) || 0;

    // Markup base matches Estimate Generator: materials + labor + plans/permits + equipment rental + other direct
    const subtotal = materials + labor + plansPermits + equipmentRental + otherDirectCost;
    const markupPct = Number(estimate.markupPct) || 0;
    const markup = subtotal * (markupPct / 100);
    const recalculatedValue = Math.round(subtotal + markup);
    
    // Calculate margin percentage based on actual vs budgeted costs
    const actualCost = Number(project.actualCost) || 0;
    const budgetedCost = subtotal;
    
    // If we have actual costs, calculate margin based on actual performance
    let recalculatedMargin;
    if (actualCost > 0 && budgetedCost > 0) {
      // Margin = (Bid Price - Actual Cost) / Bid Price * 100
      const actualMargin = recalculatedValue > 0 ? ((recalculatedValue - actualCost) / recalculatedValue) * 100 : 0;
      recalculatedMargin = Math.round(actualMargin);
    } else {
      // No actual costs yet, use planned margin
      recalculatedMargin = subtotal > 0 ? Math.round((markup / subtotal) * 100) : 0;
    }
    
    // Calculate progress based on actual vs planned
    const progress = recalculatedValue > 0 ? Math.min(100, Math.round((actualCost / recalculatedValue) * 100)) : 0;
    
    console.log(`🔄 Recalculated project ${project.id}:`, {
      originalValue: project.bidPrice,
      recalculatedValue,
      originalMargin: project.margin,
      recalculatedMargin,
      originalProgress: project.progress,
      recalculatedProgress: progress,
    });
    
    // Get dates from estimate data
    const startDate = estimate.projectStartDate || project.startDate || new Date().toISOString().split('T')[0];
    const endDate = estimate.projectEndDate || estimate.endDate || project.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Project ${project.id} dates:`, {
      estimateStartDate: estimate.projectStartDate,
      estimateEndDate: estimate.projectEndDate,
      finalStartDate: startDate,
      finalEndDate: endDate,
    });
    
    return {
      value: recalculatedValue,
      margin: recalculatedMargin,
      progress: progress,
      startDate: startDate,
      endDate: endDate,
    };
  } catch (error) {
    console.error('Error recalculating project values:', error);
    return {
      value: project.bidPrice || 0,
      margin: project.margin || 0,
      progress: project.progress || 0,
    };
  }
}

// Batch recalculate multiple projects
export async function recalculateAllProjectValues(projects: any[]) {
  const recalculatedProjects = await Promise.all(
    projects.map(async (project) => {
      const recalculated = await recalculateProjectValues(project);
    return {
      ...project,
      bidPrice: recalculated.value,
      margin: recalculated.margin,
      progress: recalculated.progress,
      // Preserve timeline-based progress if it exists
      overallProgressPct: project.overallProgressPct,
    };
    })
  );
  
  return recalculatedProjects;
}
