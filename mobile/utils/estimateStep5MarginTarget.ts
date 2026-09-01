type PricingProfileRecommendation = {
  profitRange?: { min: number; max: number };
  safeMarkupRange?: { min: number; max: number };
};

export function getEstimateStep5MarginTargetFeedback({
  subtotal = 0,
  netProfitPct = 0,
  currentMarkupNum = 0,
  recommendedMarkupNum = 0,
  recommendationInfo = null,
}: {
  subtotal?: number;
  netProfitPct?: number;
  currentMarkupNum?: number;
  recommendedMarkupNum?: number;
  recommendationInfo?: PricingProfileRecommendation | null;
}) {
  const hasProjectCost = subtotal > 0;
  const projectedNetMarginLabel = hasProjectCost
    ? `${netProfitPct.toFixed(1)}% projected net margin`
    : 'Add project costs to see projected net margin';

  const makeMessage = (type: string, text: string, color: string) => ({ type, text, color });

  if (hasProjectCost && recommendationInfo?.profitRange) {
    const profitMin = Number(recommendationInfo.profitRange.min);
    const profitMax = Number(recommendationInfo.profitRange.max);
    let headline = 'Meets your target';
    let messageType = 'inRange';
    let statusColor = '#22c55e';
    let markupStatus = 'good';
    let applyButtonText = 'Apply 0%';

    if (netProfitPct < 0 || netProfitPct < profitMin) {
      headline = 'Below your target';
      messageType = 'low';
      statusColor = '#ef4444';
      markupStatus = 'risk';
      const diffToRecommended = Math.max(0, Math.round(recommendedMarkupNum - currentMarkupNum));
      applyButtonText =
        diffToRecommended > 0 ? `Apply ${diffToRecommended}%` : `Apply ${recommendedMarkupNum}%`;
    } else if (netProfitPct > profitMax + 1) {
      headline = 'Above your target';
      messageType = 'high';
      statusColor = '#fbbf24';
      markupStatus = 'warn';
      applyButtonText = `Lower to ${recommendedMarkupNum}% (optional)`;
    } else if (netProfitPct >= profitMax) {
      markupStatus = 'strong';
    }

    return {
      applyButtonText,
      contextualMessage: makeMessage(messageType, headline, statusColor),
      markupStatus,
      markupStatusText: projectedNetMarginLabel,
      markupStatusColor: statusColor,
    };
  }

  if (hasProjectCost) {
    let headline = 'Meets your target';
    let messageType = 'inRange';
    let statusColor = '#22c55e';
    let markupStatus = 'good';
    let applyButtonText = 'Apply 0%';

    if (netProfitPct < 0) {
      headline = 'Below your target';
      messageType = 'low';
      statusColor = '#ef4444';
      markupStatus = 'risk';
      const diffToRecommended = Math.max(0, Math.round(recommendedMarkupNum - currentMarkupNum));
      applyButtonText =
        diffToRecommended > 0 ? `Apply ${diffToRecommended}%` : `Apply ${recommendedMarkupNum}%`;
    } else if (netProfitPct < 5) {
      headline = 'Below your target';
      messageType = 'low';
      statusColor = '#ef4444';
      markupStatus = 'risk';
    } else if (netProfitPct < 8) {
      headline = 'Thin margin — review markup';
      messageType = 'high';
      statusColor = '#fbbf24';
      markupStatus = 'warn';
    } else if (netProfitPct >= 15) {
      headline = 'Strong projected margin';
      markupStatus = 'strong';
    }

    return {
      applyButtonText,
      contextualMessage: makeMessage(messageType, headline, statusColor),
      markupStatus,
      markupStatusText: projectedNetMarginLabel,
      markupStatusColor: statusColor,
    };
  }

  const safeMarkupRange = recommendationInfo?.safeMarkupRange;
  let headline = 'Add project costs to evaluate margin';
  let messageType = 'inRange';
  let statusColor = '#fbbf24';
  let markupStatus = 'warn';
  let applyButtonText = `Apply ${recommendedMarkupNum}%`;
  let markupStatusText = 'Set markup after adding materials, labor, and job costs';

  if (safeMarkupRange) {
    const minMarkup = Number(safeMarkupRange.min);
    const maxMarkup = Number(safeMarkupRange.max);
    if (currentMarkupNum === 0) {
      headline = 'Set your markup percentage';
      markupStatusText = `Profile target: ${minMarkup}–${maxMarkup}% markup`;
    } else if (currentMarkupNum < minMarkup) {
      headline = 'Below profile markup range';
      messageType = 'low';
      statusColor = '#ef4444';
      markupStatus = 'risk';
      const diffToMin = Math.round(minMarkup - currentMarkupNum);
      const diffToMax = Math.round(maxMarkup - currentMarkupNum);
      applyButtonText = `Apply ${diffToMin}-${diffToMax}%`;
      markupStatusText = `Typical markup: ${minMarkup}–${maxMarkup}%`;
    } else if (currentMarkupNum > maxMarkup) {
      headline = 'Above profile markup range';
      messageType = 'high';
      markupStatusText = `Typical markup: ${minMarkup}–${maxMarkup}%`;
    } else {
      headline = 'Markup within profile range';
      messageType = 'inRange';
      statusColor = '#22c55e';
      markupStatus = 'good';
      applyButtonText = 'Apply 0%';
      markupStatusText = `Typical markup: ${minMarkup}–${maxMarkup}%`;
    }
  } else if (currentMarkupNum > 0) {
    headline = 'Markup set — add project costs to evaluate margin';
    messageType = 'inRange';
    statusColor = '#22c55e';
    markupStatus = 'good';
    applyButtonText = 'Apply 0%';
  }

  return {
    applyButtonText,
    contextualMessage: makeMessage(messageType, headline, statusColor),
    markupStatus,
    markupStatusText,
    markupStatusColor: statusColor,
  };
}
