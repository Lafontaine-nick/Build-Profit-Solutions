/**
 * Phase 2 metadata: estimate confidence, "what AI did", note profiles,
 * no-pricing detection, and optional rough budget ranges (labeled, not auto-applied).
 */

const { parseSquareFeetFromText, parseLinearFeetFromText, extractProjectSquareFeet } = require('./estimateDraftFromNotes');
const { detectTrades } = require('./estimateDraftPartialPricing');

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

const TRADE_LABELS = {
  flooring: 'flooring job',
  bathroom: 'bathroom remodel',
  kitchen: 'kitchen remodel',
  roofing: 'roofing',
  concrete: 'concrete',
  painting: 'painting',
  drywall: 'drywall',
  framing: 'framing',
  plumbing: 'plumbing',
  electrical: 'electrical',
  hvac: 'HVAC',
  landscaping: 'landscaping',
  deck_patio: 'deck/patio',
  plumbing_service: 'service call',
  new_build: 'new build',
  home_addition: 'addition',
  room_addition: 'room addition',
  adu: 'ADU',
  garage_conversion: 'garage conversion',
};

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

function packageHasPricing(pkg) {
  return (
    (pkg.price != null && pkg.price > 0) ||
    (pkg.knownSubtotal != null && pkg.knownSubtotal > 0) ||
    pkg.status === 'calculated' ||
    pkg.status === 'partial_pricing' ||
    pkg.status === 'rough_price'
  );
}

function detectNoteProfile(scopePackages, draft) {
  const pkgs = scopePackages || [];
  const calculated = pkgs.filter((p) => p.status === 'calculated').length;
  const lump = pkgs.filter(
    (p) =>
      p.status === 'user_provided' ||
      (p.status === 'confirmed' && p.priceIncludesLaborAndMaterials && p.price != null)
  ).length;
  const scopeOnly = pkgs.filter((p) => p.status === 'missing_price').length;
  const partial = pkgs.filter((p) => p.status === 'partial_pricing').length;
  const rough = pkgs.filter((p) => p.status === 'rough_price').length;

  let primary = 'mixed';
  if (pkgs.length === 0) {
    primary = draft.calculatedLineItemTotal > 0 ? 'exact_rate' : 'scope_only';
  } else if (scopeOnly === pkgs.length) {
    primary = 'scope_only';
  } else if (calculated > 0 && lump === 0 && scopeOnly === 0) {
    primary = 'exact_rate';
  } else if (lump > 0 && calculated === 0 && scopeOnly === 0) {
    primary = 'lump_sum';
  } else if (lump > 0 || calculated > 0) {
    primary = 'mixed';
  }

  return {
    primary,
    calculatedCount: calculated,
    lumpSumCount: lump,
    scopeOnlyCount: scopeOnly,
    partialCount: partial,
    roughCount: rough,
  };
}

function hasNoPricing(draft, scopePackages) {
  const pkgs = scopePackages || [];
  const lineTotal = draft.calculatedLineItemTotal ?? draft.calculatedTotal;
  if (lineTotal != null && lineTotal > 0) return false;
  if (pkgs.some(packageHasPricing)) return false;
  if ((draft.knownSubtotal || 0) > 0) return false;
  return pkgs.length > 0 || Boolean(draft.projectDescription?.trim());
}

function computeEstimateConfidence(draft, scopePackages) {
  const pkgs = scopePackages || [];
  const profile = detectNoteProfile(pkgs, draft);
  const reasons = [];

  let calculated = 0;
  let userProvided = 0;
  let missing = 0;
  let partial = 0;
  let aiSuggested = 0;
  let rough = 0;

  for (const p of pkgs) {
    if (p.status === 'calculated') calculated++;
    else if (p.status === 'user_provided' || (p.status === 'confirmed' && p.priceProvidedByUser)) {
      userProvided++;
    } else if (p.status === 'missing_price') missing++;
    else if (p.status === 'partial_pricing') partial++;
    else if (p.status === 'ai_suggested') aiSuggested++;
    else if (p.status === 'rough_price') rough++;
  }

  const totalPkgs = pkgs.length || 1;
  const pricedRatio = (calculated + userProvided + partial) / totalPkgs;

  if (hasNoPricing(draft, pkgs)) {
    return {
      level: 'low',
      label: 'Low confidence',
      summary: 'Scope and quantities found. Pricing still needed.',
      reasons: ['No totals or quantity × rate formulas detected'],
    };
  }

  if (rough > 0 || aiSuggested > 0) {
    if (rough > 0) reasons.push(`${rough} item(s) use AI rough estimates — review before bidding`);
    if (aiSuggested > 0) reasons.push(`${aiSuggested} AI-suggested value(s) need approval`);
  }

  if (missing > 0) {
    reasons.push(`${missing} scope package(s) still need pricing`);
  }
  if (partial > 0) {
    reasons.push(`${partial} package(s) have partial pricing only`);
  }

  let level = 'medium';
  let summary = 'Some pricing from notes; review missing details before applying.';

  if (
    pricedRatio >= 0.85 &&
    missing === 0 &&
    rough === 0 &&
    aiSuggested === 0 &&
    (calculated > 0 || userProvided > 0)
  ) {
    level = 'high';
    summary =
      calculated > 0 && userProvided > 0
        ? 'Clear formulas and user-provided totals from your notes.'
        : calculated > 0
          ? 'Quantity × rate formulas calculated from your notes.'
          : 'User-provided totals preserved from your notes.';
    if (calculated > 0) reasons.unshift('Calculated from clear quantity × rate in notes');
    if (userProvided > 0) reasons.unshift('User lump sums preserved exactly');
  } else if (missing >= totalPkgs || profile.primary === 'scope_only') {
    level = 'low';
    summary = 'Scope-only notes — pricing not applied automatically.';
  } else if (partial > 0 || missing > 0 || profile.primary === 'mixed') {
    level = 'medium';
  }

  return {
    level,
    label: level === 'high' ? 'High confidence' : level === 'medium' ? 'Medium confidence' : 'Low confidence',
    summary,
    reasons: reasons.slice(0, 6),
  };
}

function buildWhatAiDid(draft, scopePackages, options = {}) {
  const lines = [];
  const profile = detectNoteProfile(scopePackages, draft);
  const trades = draft.detectedTrades?.length
    ? draft.detectedTrades
    : detectTrades(draft.projectType, scopePackages.map((p) => `${p.name} ${p.scope}`).join(' '));
  const tradeLabel =
    TRADE_LABELS[draft.projectType] ||
    (trades[0] ? TRADE_LABELS[trades[0]] || trades[0].replace(/_/g, ' ') : null);

  if (hasNoPricing(draft, scopePackages) && profile.primary === 'scope_only') {
    if (tradeLabel) {
      lines.push(`Detected ${tradeLabel.replace(/\s+job\s+job$/i, ' job')}.`);
    }
    for (const pkg of scopePackages || []) {
      const q = (pkg.scopeQuantities || [])[0];
      if (q) {
        lines.push(`Found ${q.quantity.toLocaleString()} ${q.unit} for ${pkg.name}.`);
      }
    }
    lines.push('No material or labor rates were provided, so no pricing was calculated.');
    return lines.slice(0, 8);
  }

  if (tradeLabel) {
    lines.push(`Detected ${tradeLabel} job.`);
  } else if (draft.projectType && draft.projectType !== 'other') {
    lines.push(`Detected ${draft.projectType.replace(/_/g, ' ')} project.`);
  }

  for (const pkg of scopePackages || []) {
    if (pkg.status === 'calculated' && pkg.formula) {
      const labor =
        pkg.laborPrice != null && pkg.materialPrice != null
          ? ` (${formatMoney(pkg.laborPrice)} labor, ${formatMoney(pkg.materialPrice)} materials)`
          : '';
      lines.push(`Calculated ${pkg.name}: ${pkg.formula}${labor}.`);
    } else if (pkg.status === 'calculated' && pkg.price != null) {
      lines.push(`Calculated ${pkg.name}: ${formatMoney(pkg.price)} from unit rates in notes.`);
    } else if (pkg.status === 'missing_price' && pkg.scope) {
      const q = (pkg.scopeQuantities || [])[0];
      if (q) {
        lines.push(`Organized ${pkg.name}: ${q.quantity.toLocaleString()} ${q.unit} — pricing needed.`);
      } else {
        lines.push(`Organized scope for ${pkg.name} — no price in notes.`);
      }
    } else if (pkg.status === 'ai_suggested') {
      lines.push(`${pkg.name}: AI suggested split — approval required before apply.`);
    } else if (pkg.status === 'rough_price') {
      lines.push(`${pkg.name}: AI rough estimate — review before apply.`);
    }
  }

  const preserved = (scopePackages || []).filter(
    (p) =>
      p.status === 'user_provided' ||
      (p.status === 'confirmed' && p.priceIncludesLaborAndMaterials && p.price != null)
  );
  if (preserved.length === 1) {
    const p = preserved[0];
    lines.push(`Preserved your total for ${p.name}: ${formatMoney(p.price)} (not changed).`);
  } else if (preserved.length > 1) {
    lines.push(`Preserved ${preserved.length} room totals from your notes (unchanged).`);
  }

  const partial = (scopePackages || []).filter(
    (p) => p.status === 'partial_pricing' && p.knownSubtotal != null
  );
  if (partial.length === 1) {
    const p = partial[0];
    lines.push(
      `Partial pricing for ${p.name}: ${formatMoney(p.knownSubtotal)} known — other scope still needs prices.`
    );
  } else if (partial.length > 1) {
    lines.push(
      `${partial.length} areas have partial pricing — finish missing items before bidding.`
    );
  }

  for (const allowance of draft.allowances || []) {
    if (allowance.status === 'calculated' && allowance.calculatedAmount != null) {
      const qty = allowance.quantity != null ? `${allowance.quantity} ${allowance.quantityUnit || 'sqft'}` : '';
      lines.push(
        `Calculated ${allowance.name || 'allowance'}: ${qty ? `${qty} × ` : ''}${formatMoney(allowance.rate ?? allowance.amount)}${allowance.unit || ''} = ${formatMoney(allowance.calculatedAmount)}.`
      );
    } else if (allowance.status === 'needs_review' && allowance.rate != null) {
      lines.push(`Saved ${allowance.name || 'allowance'} at ${formatMoney(allowance.rate)}${allowance.unit || ''} — quantity or type needs confirmation.`);
    }
  }

  const flagged = [];
  const missing = draft.missingInfo || [];
  if (missing.some((m) => /phone/i.test(m))) flagged.push('customer phone');
  if (missing.some((m) => /customer name/i.test(m))) flagged.push('customer name');
  if (missing.some((m) => /address/i.test(m))) flagged.push('project address');
  if (missing.some((m) => /start date/i.test(m))) flagged.push('start date');
  if (missing.some((m) => /payment/i.test(m))) flagged.push('payment terms');
  if (missing.some((m) => /permit/i.test(m))) flagged.push('permit responsibility');
  if (missing.some((m) => /overall bid total/i.test(m)) && (draft.calculatedLineItemTotal || 0) > 0) {
    flagged.push('overall bid total in notes');
  } else if (missing.some((m) => /overall bid total/i.test(m))) {
    flagged.push('overall bid total');
  }
  if (missing.some((m) => /square footage|sqft/i.test(m))) {
    const hasQty = (scopePackages || []).some((p) => (p.scopeQuantities || []).length > 0);
    if (!hasQty) flagged.push('square footage for $/unit rates');
  }

  if (flagged.length > 0) {
    lines.push(`Flagged ${flagged.join(', ')} as missing.`);
  }

  if ((draft.combinedPriceRoomCount || 0) > 0 && (draft.suggestedSplitRoomCount || 0) === 0) {
    lines.push('Lump-sum totals kept intact — optional labor/material split available on request.');
  }

  if (options.roughEstimate?.enabled) {
    lines.push(
      `Generated AI rough budget range (${formatMoney(options.roughEstimate.low)} – ${formatMoney(options.roughEstimate.high)}) — not applied until you approve.`
    );
  }

  return lines.slice(0, 10);
}

/** Trade-aware rough range — labels only; does not write room prices. */
function buildRoughEstimateRange(draft, scopePackages) {
  const sqft = extractProjectSquareFeet(draft) || parseSquareFeetFromText(draft.projectDescription);
  const trades = draft.detectedTrades || detectTrades(draft.projectType, scopePackages.map((p) => p.scope).join(' '));
  const trade = trades[0] || draft.projectType || 'other';

  const assumptions = [];
  let lowPerSqft = 15;
  let highPerSqft = 45;

  const bands = {
    flooring: { low: 8, high: 22, note: 'Demo, install, and materials vary by product' },
    bathroom: { low: 120, high: 250, note: 'Fixtures and waterproofing drive range' },
    kitchen: { low: 150, high: 320, note: 'Cabinets and countertops drive range' },
    roofing: { low: 450, high: 750, note: 'Per square (100 sqft); tear-off affects high end' },
    concrete: { low: 6, high: 14, note: 'Thickness and finish affect cost' },
    painting: { low: 2, high: 6, note: 'Prep and coat count affect cost' },
    plumbing_service: { low: 0, high: 0, note: 'Service calls often priced per visit, not sqft' },
  };

  const band = bands[trade] || { low: 25, high: 75, note: 'Generic remodel allowance per sqft' };
  if (band.low > 0) {
    lowPerSqft = band.low;
    highPerSqft = band.high;
  }

  assumptions.push(`Trade: ${trade.replace(/_/g, ' ')}`);
  assumptions.push(band.note);
  if (sqft) {
    assumptions.push(`Assumed area: ${sqft.toLocaleString()} sqft from notes`);
  } else {
    assumptions.push('No square footage in notes — range is indicative only');
  }

  let low = null;
  let mid = null;
  let high = null;

  if (sqft && sqft > 0 && band.low > 0) {
    low = roundMoney(sqft * lowPerSqft);
    mid = roundMoney(sqft * ((lowPerSqft + highPerSqft) / 2));
    high = roundMoney(sqft * highPerSqft);
  } else if (trade === 'plumbing_service') {
    low = 350;
    mid = 750;
    high = 1500;
    assumptions.push('Typical service-call range when sqft not provided');
  }

  if (low == null) return null;

  return {
    enabled: true,
    label: 'AI Rough Estimate',
    confidence: 'low',
    low,
    mid,
    high,
    assumptions,
    disclaimer:
      'Indicative range only — not from your notes. Approve before applying; will be labeled AI Rough Estimate on line items.',
  };
}

function enrichDraftPhase2(draft, scopePackages, options = {}) {
  const profile = detectNoteProfile(scopePackages, draft);
  const noPricingDetected = hasNoPricing(draft, scopePackages);
  const estimateConfidence = computeEstimateConfidence(draft, scopePackages);
  const roughEstimate =
    options.roughEstimateRequested || draft.roughEstimateRequested
      ? buildRoughEstimateRange(draft, scopePackages)
      : draft.roughEstimate || null;

  const whatAiDid = buildWhatAiDid(
    { ...draft, detectedTrades: draft.detectedTrades },
    scopePackages,
    { roughEstimate }
  );

  return {
    noteProfile: profile,
    noPricingDetected,
    estimateConfidence,
    whatAiDid,
    roughEstimate,
    pricingMemoryEnabled: options.pricingMemoryEnabled ?? false,
  };
}

module.exports = {
  enrichDraftPhase2,
  computeEstimateConfidence,
  buildWhatAiDid,
  detectNoteProfile,
  hasNoPricing,
  buildRoughEstimateRange,
};
