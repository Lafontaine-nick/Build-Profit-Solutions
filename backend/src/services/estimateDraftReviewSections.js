/**
 * Structured review sections for AI Estimate Draft (display-only metadata).
 */

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function extractAddressFromDraft(draft) {
  const blob = `${draft.projectDescription || ''} ${draft.contractScope || ''} ${draft.originalNotes || ''}`;
  const street = blob.match(/\d+\s+[\w\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|way)\b/i);
  const cityState = blob.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/);
  if (street && cityState) {
    return `${street[0].trim()}, ${cityState[1].trim()}, ${cityState[2]}${cityState[3] ? ` ${cityState[3]}` : ''}`;
  }
  if (cityState) return `${cityState[1].trim()}, ${cityState[2]}`;
  return null;
}

function buildLaborTradeItems(draft) {
  const items = [];
  for (const pkg of draft.scopePackages || []) {
    if (pkg.laborPrice != null && pkg.laborPrice > 0) {
      items.push({
        packageName: pkg.name,
        name: `${pkg.name} — labor`,
        amount: pkg.laborPrice,
        status: pkg.splitIsSuggested ? 'ai_suggested' : pkg.status,
        scope: pkg.scope,
        priceSource: pkg.priceSource,
      });
    }
    for (const pi of pkg.pricingItems || []) {
      if (pi.pricingType === 'labor' && pi.amount != null && pi.amount > 0) {
        items.push({
          packageName: pkg.name,
          name: pi.name,
          amount: pi.amount,
          status: pi.status || 'confirmed',
          unitRate: pi.unitRate,
          quantity: pi.quantity,
          unit: pi.unit,
        });
      }
    }
    if (pkg.status === 'missing_price' || (pkg.missingPriceItems || []).length > 0) {
      items.push({
        packageName: pkg.name,
        name: `${pkg.name} — labor/trade`,
        amount: null,
        status: 'missing_price',
        missing: true,
        missingItems: pkg.missingPriceItems || [],
      });
    }
  }
  return items;
}

function buildTotalValidation(draft) {
  const materials = roundMoney(draft.calculatedMaterialTotal) || 0;
  const labor = roundMoney(draft.calculatedLaborTotal) || 0;
  const lineItems = roundMoney(draft.calculatedLineItemTotal ?? draft.calculatedTotal) || 0;
  const knownSubtotal = roundMoney(draft.knownSubtotal) || 0;
  const stated = draft.statedTotal != null ? roundMoney(draft.statedTotal) : null;

  const aiSuggestedSubtotal = (draft.suggestedSplits || [])
    .filter((s) => s.approvedByUser)
    .reduce((sum, s) => sum + roundMoney(s.total), 0);

  const partialOnly = (draft.scopePackages || [])
    .filter((p) => p.status === 'partial_pricing' && p.knownSubtotal)
    .reduce((sum, p) => sum + roundMoney(p.knownSubtotal), 0);

  const warnings = [];
  if (stated != null && lineItems > 0 && Math.abs(stated - lineItems) > 1) {
    warnings.push(
      `Line items (${lineItems.toLocaleString()}) differ from stated total (${stated.toLocaleString()}) in notes.`
    );
  }
  if (partialOnly > 0 && lineItems < partialOnly) {
    warnings.push('Some packages still have unpriced scope — known subtotal only.');
  }

  return {
    materialsTotal: materials > 0 ? materials : null,
    laborTotal: labor > 0 ? labor : null,
    calculatedLineItemsTotal: lineItems > 0 ? lineItems : null,
    knownSubtotal: knownSubtotal > 0 ? knownSubtotal : partialOnly > 0 ? partialOnly : null,
    aiSuggestedSubtotal: aiSuggestedSubtotal > 0 ? aiSuggestedSubtotal : null,
    statedTotal: stated,
    totalMatches: draft.totalMatches,
    warnings,
  };
}

function enrichDraftReviewSections(draft) {
  const projectAddress = extractAddressFromDraft(draft);
  const addressMissing = !projectAddress && (draft.missingInfo || []).some((m) => /address/i.test(m));

  return {
    ...draft,
    projectAddress,
    addressMissing,
    laborTradeItems: buildLaborTradeItems(draft),
    totalValidation: buildTotalValidation(draft),
  };
}

module.exports = {
  enrichDraftReviewSections,
  buildLaborTradeItems,
  buildTotalValidation,
  extractAddressFromDraft,
};
