/** Revenue for dashboard/analytics — must stay aligned with projects list logic. */

export const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === "string"
      ? Number(value.replace(/[$,\s]/g, ""))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

export const getProjectRevenue = (project: any): number => {
  if (!project) return 0;

  const originalBudgetCandidates: any[] = [
    project?.estimateData?.grandTotal,
    project?.estimateData?.bidPrice,
    project?.estimateData?.total,
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.projectData?.totalBidPrice,
    project?.total,
    project?.totalRevenue,
    project?.contractValue,
  ];

  let originalBudget = 0;
  for (const candidate of originalBudgetCandidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      originalBudget = sanitized;
      break;
    }
  }

  if (originalBudget <= 0) {
    const status = (project?.status || "").toString().toLowerCase();
    if (__DEV__ && status !== "estimate" && status !== "draft") {
      const projectName = project?.title || project?.name || "Unknown";
      console.warn(
        `⚠️ [Dashboard] No original budget found for ${projectName}. Estimate fields missing.`
      );
    }
    return 0;
  }

  const changeOrderSources: any[] = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
  ];

  const collected: any[] = [];
  for (const source of changeOrderSources) {
    if (Array.isArray(source) && source.length > 0) {
      collected.push(...source);
    }
  }

  const seen = new Set<string>();
  const uniqueChangeOrders = collected.filter((co: any) => {
    const key =
      co?.id != null
        ? `id:${String(co.id)}`
        : `sig:${String(co?.title || "")}:${String(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let approvedChangeOrdersTotal = uniqueChangeOrders.reduce((sum, co) => {
    const amount = Number(co.amount ?? co.clientPrice ?? co.cost ?? 0);
    const isApproved =
      (typeof co.approved === "boolean" && co.approved) ||
      (typeof co.status === "string" && co.status.toLowerCase() === "approved");
    return isApproved ? sum + amount : sum;
  }, 0);

  if (approvedChangeOrdersTotal <= 0) {
    approvedChangeOrdersTotal = sanitizePositiveNumber(
      project?.projectData?.changeOrderTotal ??
        (project as any)?.changeOrderTotal ??
        (project as any)?.rawProject?.projectData?.changeOrderTotal
    );
  }

  return originalBudget + approvedChangeOrdersTotal;
};
