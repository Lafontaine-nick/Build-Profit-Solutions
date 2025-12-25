const { loadProjects } = require('./leadStorage');

/**
 * Calculate dashboard metrics for a user
 * @param {string} userId - The user ID
 * @returns {Object} Dashboard metrics
 */
function getDashboardMetrics(userId) {
  // Load projects from disk
  const projects = loadProjects();

  // Filter projects by user
  const userProjects = projects.filter(p => p.userId === userId);

  // Filter active/won projects
  const activeWonProjects = userProjects.filter((p) => {
    const status = (p.status || '').toString().toLowerCase();
    return ['active', 'won', 'in_progress'].includes(status);
  });

  // Filter completed projects
  const completedProjects = userProjects.filter((p) => {
    const status = (p.status || '').toString().toLowerCase();
    return status === 'completed';
  });

  // Calculate total bids from active/won projects
  const totalBids = activeWonProjects.reduce((sum, p) => {
    // Try multiple revenue fields (same logic as frontend)
    const revenue = 
      p.bidPrice ||
      p.projectData?.bidPrice ||
      p.projectData?.totalBidPrice ||
      p.estimateData?.bidPrice ||
      p.estimateData?.grandTotal ||
      p.total ||
      p.totalRevenue ||
      p.contractValue ||
      p.estimatedCost ||
      0;
    
    return sum + (Number(revenue) || 0);
  }, 0);

  // Calculate overview profit for completed projects
  const overviewProfit = completedProjects.reduce((sum, p) => {
    // Get revenue (same logic as above)
    const revenue = 
      p.bidPrice ||
      p.projectData?.bidPrice ||
      p.projectData?.totalBidPrice ||
      p.estimateData?.bidPrice ||
      p.estimateData?.grandTotal ||
      p.total ||
      p.totalRevenue ||
      p.contractValue ||
      p.estimatedCost ||
      0;

    // Get actual cost
    const actualCost = 
      p.actualCost ||
      p.projectData?.actualCost ||
      p.projectData?.spent ||
      p.projectData?.totalSpent ||
      p.totalSpent ||
      0;

    // Calculate profit: revenue - cost
    const profit = (Number(revenue) || 0) - (Number(actualCost) || 0);
    
    return sum + profit;
  }, 0);

  return {
    totalBids: Math.round(totalBids),
    activeWonCount: activeWonProjects.length,
    overviewProfit: Math.round(overviewProfit),
  };
}

module.exports = {
  getDashboardMetrics,
};

