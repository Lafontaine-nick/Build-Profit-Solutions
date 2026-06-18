/**
 * Universal construction partial-pricing: extract line items from notes/scope,
 * detect partial vs complete packages, and infer unpriced scope.
 */

const { parseSquareFeetFromText, isPerSqftAllowance } = require('./estimateDraftFromNotes');
const {
  labeledPriceMatchIsValid,
  sanitizePricingItemsList,
  sanitizeRoomPrice,
  extractScopeQuantitiesForPackage,
  scopeOnlyMissingHints,
  notesContainExplicitPrice,
  WEAK_LABEL_RE,
  isJunkPriceLabel,
  isAbsurdParsedAmount,
} = require('./estimateDraftQuantityPrice');
const { extractRoomNotesText, filterPricingItemsForRoom } = require('./estimateDraftRoomNotes');

const UNIT_RATE_SUFFIX_RE = /^\s*\/\s*(?:sq\.?\s*ft|sqft|sf|lf|ln|hr|hour|each|ea)\b/i;

const ROUGH_TRIGGERS =
  /\b(roughly|around|maybe|not positive|not sure|let's say|lets say|about|ballpark|approximately|approx\.?|~\s*\$?|\?\s*$)\b/i;

const EXPLICIT_ZERO = /\b(\$?\s*0\.?0{0,2}\s*(total|labor|material)?|explicitly\s+\$?0|no\s+charge|free)\b/i;

/** $X,XXX or $5k attached to a label */
const LABELED_PRICE_RE =
  /([a-z0-9][a-z0-9\s/'-]{1,55}?)\s*(?:—|-|:)?\s*(?:(?:roughly|around|about|maybe|let's say|lets say|not positive|ballpark)\s+)?\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(k|K)?(?:\s*\/\s*(sq\.?\s*ft|sqft|sf|lf|hr|hour|each|ea|square|sq))?/gi;

const TRADE_KEYWORDS = {
  kitchen: ['kitchen', 'cabinet', 'countertop', 'backsplash', 'appliance'],
  bathroom: ['bath', 'shower', 'tile', 'vanity', 'toilet', 'plumb'],
  roofing: ['roof', 'shingle', 'tear-off', 'underlayment'],
  flooring: ['floor', 'lvp', 'hardwood', 'carpet', 'tile floor'],
  painting: ['paint', 'primer', 'trim paint'],
  plumbing_service: ['plumb', 'water heater', 'faucet', 'drain', 'pipe'],
  electrical: ['electrical', 'panel', 'circuit', 'outlet', 'wire'],
  concrete: ['concrete', 'slab', 'patio', 'driveway'],
  framing: ['frame', 'framing', 'lumber package'],
  drywall: ['drywall', 'sheetrock', 'hang', 'finish mud'],
  hvac: ['hvac', 'furnace', 'ac unit', 'duct'],
  landscaping: ['landscape', 'irrigation', 'sod', 'plant'],
  deck_patio: ['deck', 'patio', 'pergola'],
  new_build: ['new build', 'ground-up', 'foundation'],
  home_addition: ['addition', 'adu', 'garage conversion'],
};

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

function isRoughPriceContext(text, amountIndex) {
  const window = text.slice(Math.max(0, amountIndex - 80), amountIndex + 40);
  return ROUGH_TRIGGERS.test(window);
}

function parseAmount(raw, suffixK) {
  let n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  if (suffixK && (String(suffixK).toLowerCase() === 'k' || n < 200)) n *= 1000;
  return roundMoney(n);
}

function inferPricingType(label) {
  const t = label.toLowerCase();
  if (/\b(labor|install|installation|demo|haul|haul-off|disposal|trim-out|rough-in)\b/.test(t)) {
    return 'labor';
  }
  if (/\b(sub|subcontract|trade package)\b/.test(t)) return 'subcontractor';
  if (/\b(allowance|rate)\b/.test(t)) return 'allowance';
  if (/\b(material|supply|supplies|cabinet|countertop|tile|fixture|lvp|shingle|paint)\b/.test(t)) {
    return 'material';
  }
  return 'unknown';
}

function inferUnitFromMatch(unitRaw) {
  if (!unitRaw) return null;
  const u = unitRaw.toLowerCase();
  if (/sq/.test(u)) return 'sqft';
  if (/lf|linear/.test(u)) return 'lf';
  if (/hr|hour/.test(u)) return 'hr';
  if (/each|ea/.test(u)) return 'each';
  if (/square/.test(u)) return 'square';
  return 'unknown';
}

/** Extract labeled dollar amounts from free text (notes + scope). */
function extractPricingItemsFromText(text) {
  const source = String(text || '');
  if (!source.trim()) return [];

  const items = [];
  const seen = new Set();
  let match;
  const re = new RegExp(LABELED_PRICE_RE.source, 'gi');
  while ((match = re.exec(source)) !== null) {
    const label = String(match[1] || '')
      .replace(/^[\s,;•\-–]+/, '')
      .trim();
    if (!label || label.length < 2) continue;
    if (/^(and|or|with|for|the|a|an|includes?)\s*$/i.test(label)) continue;
    if (isJunkPriceLabel(label)) continue;

    if (!labeledPriceMatchIsValid(source, match)) continue;

    const amount = parseAmount(match[2], match[3]);
    if (amount == null || amount <= 0) continue;
    if (isAbsurdParsedAmount(amount, label)) continue;

    const key = `${label.toLowerCase()}-${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const rough = isRoughPriceContext(source, match.index);
    const unit = inferUnitFromMatch(match[4]);
    const isUnitRateSuffix = unit && UNIT_RATE_SUFFIX_RE.test(`/${unit}`);
    const unitRate = isUnitRateSuffix && amount < 500 ? amount : null;
    const lumpAmount = unitRate == null ? amount : null;

    items.push({
      name: label.replace(/\s+/g, ' ').slice(0, 80),
      description: rough ? 'Uncertain price from notes — confirm before bidding' : '',
      quantity: unit === 'sqft' ? parseSquareFeetFromText(source) : null,
      unit,
      unitRate,
      amount: lumpAmount ?? (unitRate && unit === 'sqft' ? null : amount),
      pricingType: inferPricingType(label),
      priceSource: 'user_provided',
      status: rough ? 'rough_price' : 'confirmed',
      formula: null,
      includedInSubtotal: true,
      approvedByUser: true,
      needsReview: rough,
    });
  }

  const roughCommaRe =
    /([a-z][a-z0-9\s]{2,48}?),\s*(?:let'?s\s+say|roughly|around|about|maybe|ballpark)\s+\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(k|K)?/gi;
  let roughMatch;
  while ((roughMatch = roughCommaRe.exec(source)) !== null) {
    const label = String(roughMatch[1] || '')
      .replace(/^[\s,;•\-–]+/, '')
      .trim();
    if (!label || WEAK_LABEL_RE.test(label)) continue;
    const amount = parseAmount(roughMatch[2], roughMatch[3]);
    if (amount == null || amount < 100) continue;
    const key = `${label.toLowerCase()}-${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rough = isRoughPriceContext(source, roughMatch.index);
    items.push({
      name: label.replace(/\s+/g, ' ').slice(0, 80),
      description: rough ? 'Uncertain price from notes — confirm before bidding' : '',
      quantity: null,
      unit: null,
      unitRate: null,
      amount,
      pricingType: inferPricingType(label),
      priceSource: 'user_provided',
      status: rough ? 'rough_price' : 'confirmed',
      formula: null,
      includedInSubtotal: true,
      approvedByUser: true,
      needsReview: rough,
    });
  }

  return items;
}

function mergePricingItems(aiItems, parsedItems) {
  const out = [];
  const seen = new Set();
  for (const item of [...(aiItems || []), ...(parsedItems || [])]) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const amount =
      item?.amount != null
        ? roundMoney(item.amount)
        : item?.unitRate != null && item?.quantity != null
          ? roundMoney(item.unitRate * item.quantity)
          : null;
    const key = `${name.toLowerCase()}-${amount || 'na'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      description: String(item?.description || '').trim(),
      quantity: item?.quantity != null ? Number(item.quantity) : null,
      unit: item?.unit || null,
      unitRate: item?.unitRate != null ? roundMoney(item.unitRate) : null,
      amount,
      pricingType: item?.pricingType || inferPricingType(name),
      priceSource: item?.priceSource || 'user_provided',
      status: item?.status || (amount != null ? 'confirmed' : 'missing_price'),
      formula: item?.formula || null,
      includedInSubtotal: item?.includedInSubtotal !== false,
      approvedByUser: Boolean(item?.approvedByUser),
      needsReview: Boolean(item?.needsReview) || item?.status === 'rough_price',
    });
  }
  return out;
}

/** Scope phrases that often appear without a price in partial notes. */
function inferMissingScopeItems(scopeText, pricingItems, projectType) {
  const scope = String(scopeText || '').toLowerCase();
  const missing = [];
  const add = (s) => {
    if (!missing.some((m) => m.toLowerCase() === s.toLowerCase())) missing.push(s);
  };

  const pricedLabels = (pricingItems || []).map((p) => p.name.toLowerCase()).join(' ');

  const checks = [
    { test: /\b backsplash\b/, label: 'Tile backsplash (material and/or labor)' },
    { test: /\b(backsplash|back splash)\b.*\d+\s*(sq|sf)/, label: 'Backsplash unit rate or total' },
    { test: /\bsink\b|\bfaucet\b/, label: 'Sink and faucet (supply + install)' },
    { test: /\b(demo|demolition|remove old)\b/, label: 'Demo / removal' },
    { test: /\b(haul[- ]?off|disposal|dumpster)\b/, label: 'Haul-off / disposal' },
    { test: /\b(plumb|plumbing|reconnect|hookup)\b/, label: 'Plumbing reconnect / hookup' },
    { test: /\b(electrical|receptacle|outlet)\b/, label: 'Electrical work' },
    { test: /\b(install|installation)\b.*\b(cabinet|counter)/, label: 'Install labor (if not in material price)' },
    { test: /\b waterproof/, label: 'Waterproofing / pan liner' },
    { test: /\b(glass|shower door)\b/, label: 'Glass / shower door' },
    { test: /\b(permits?|permit)\b/, label: 'Permit fees / responsibility' },
    { test: /\b(paint|repaint)\b/, label: 'Painting labor and materials' },
    { test: /\b(floor|lvp|tile floor)\b/, label: 'Flooring labor and materials' },
    { test: /\b(roof|shingle)\b/, label: 'Roofing labor / tear-off scope' },
    { test: /\b(panel|service upgrade)\b/, label: 'Electrical panel / service scope pricing' },
    { test: /\b(concrete|slab|pour)\b/, label: 'Concrete labor / finish / pump' },
    { test: /\b(framing|frame)\b/, label: 'Framing labor package' },
    { test: /\b(drywall|sheetrock)\b/, label: 'Drywall hang / finish' },
    { test: /\b(landscap|irrigation|sod)\b/, label: 'Landscaping install scope' },
    { test: /\b(deck|patio)\b/, label: 'Deck / patio labor and materials' },
    { test: /\b(hvac|furnace|ac)\b/, label: 'HVAC equipment / labor' },
    { test: /\b(cleanup|protection)\b/, label: 'Protection and cleanup' },
    { test: /\b(appliance)\b/, label: 'Appliances (included or excluded?)' },
    { test: /\b(fixture)\b/, label: 'Fixtures (contractor-supplied vs customer)' },
  ];

  for (const { test, label } of checks) {
    if (test.test(scope) && !pricedLabels.includes(label.split('(')[0].trim().slice(0, 12))) {
      const short = label.toLowerCase().slice(0, 20);
      if (![...pricingItems.map((p) => p.name), pricedLabels].some((pl) => pl.includes(short.slice(0, 8)))) {
        add(label);
      }
    }
  }

  if (projectType === 'kitchen' && /\bcabinet\b/.test(scope) && !/cabinet install/i.test(pricedLabels)) {
    add('Cabinet installation labor (if not in cabinet $)');
  }
  if (projectType === 'kitchen' && /\bcounter/.test(scope) && !/countertop install/i.test(pricedLabels)) {
    add('Countertop fabrication / install (if not in countertop $)');
  }

  return missing.slice(0, 14);
}

function detectTrades(projectType, scopeBlob) {
  const trades = new Set();
  const blob = `${projectType || ''} ${scopeBlob || ''}`.toLowerCase();
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some((k) => blob.includes(k))) trades.add(trade);
  }
  if (trades.size === 0 && projectType && projectType !== 'other') trades.add(projectType);
  return [...trades];
}

function inferPackageCategory(room, projectType) {
  const text = `${room?.name || ''} ${room?.scope || ''}`.toLowerCase();
  if (/\b(service call|troubleshoot|repair visit|hourly)\b/.test(text)) return 'service';
  if (/\b(phase|rough-in|trim-out|framing|dry-in)\b/.test(text)) return 'phase';
  if (/\b(plumb|electrical|hvac|roof|paint|concrete|floor)\b/.test(text) && !/\bremodel\b/.test(text)) {
    return 'trade';
  }
  if (/\b(room|bedroom|kitchen|bath|garage|basement|addition)\b/.test(text)) return 'room';
  if (projectType === 'plumbing_service') return 'service';
  return 'area';
}

function buildScopePackage(room, draft, originalNotes) {
  const projectType = draft.projectType || 'other';
  const roomNotesText = extractRoomNotesText(originalNotes, room.name, room.scope);
  const parseText = `${roomNotesText}\n${room.scope || ''}\n${room.name || ''}`.trim();
  const sanitizedRoom = sanitizeRoomPrice(room, parseText);
  const roomContext = `${sanitizedRoom.name} ${sanitizedRoom.scope} ${roomNotesText}`;
  const aiItems = (Array.isArray(sanitizedRoom.pricingItems) ? sanitizedRoom.pricingItems : []).filter(
    (item) => filterPricingItemsForRoom([item], roomContext, null).length > 0
  );
  const parsedItems = extractPricingItemsFromText(parseText);
  let pricingItems = sanitizePricingItemsList(mergePricingItems(aiItems, parsedItems), parseText);

  const hasRoomTotal = sanitizedRoom.price != null && roundMoney(sanitizedRoom.price) > 0;
  pricingItems = filterPricingItemsForRoom(
    pricingItems,
    roomContext,
    hasRoomTotal ? roundMoney(sanitizedRoom.price) : null
  );

  const scopeQuantitiesFromRoom = Array.isArray(sanitizedRoom.scopeQuantities)
    ? sanitizedRoom.scopeQuantities.filter((q) => q.quantity > 0)
    : [];
  const scopeQuantitiesFromNotes = extractScopeQuantitiesForPackage(
    sanitizedRoom.name,
    sanitizedRoom.scope,
    `${roomNotesText}\n${originalNotes || ''}`.trim()
  );
  let scopeQuantities =
    scopeQuantitiesFromRoom.length > 0 ? scopeQuantitiesFromRoom : scopeQuantitiesFromNotes;

  const {
    resolveQuantityForPackage,
    normalizeScopeMeasurements,
  } = require('./scopeItemQuantityCatalog');
  const catalogCtx = {
    measurements: normalizeScopeMeasurements(draft.scopeMeasurements || {}),
    notes: `${roomNotesText}\n${originalNotes || ''}`.trim(),
    existingQuantities: scopeQuantities,
  };
  const catalogResolved = resolveQuantityForPackage(
    sanitizedRoom.name,
    sanitizedRoom.scope,
    catalogCtx
  );
  if (catalogResolved.pricingReady && catalogResolved.quantity != null) {
    scopeQuantities = [
      {
        label: catalogResolved.label || sanitizedRoom.name,
        quantity: catalogResolved.quantity,
        unit: catalogResolved.unit,
        quantitySource: catalogResolved.quantitySource,
      },
    ];
  }

  const pricedFromSqft = Boolean(sanitizedRoom.pricedFromSqftAllowances);
  const splitIsSuggested = Boolean(sanitizedRoom.splitIsSuggested);

  let knownSubtotal = pricingItems
    .filter((p) => p.includedInSubtotal && p.amount != null && p.amount > 0)
    .reduce((sum, p) => sum + p.amount, 0);

  if (hasRoomTotal && knownSubtotal > roundMoney(sanitizedRoom.price)) {
    knownSubtotal = roundMoney(sanitizedRoom.price);
  }

  const roomTotal = hasRoomTotal ? roundMoney(sanitizedRoom.price) : null;
  const userLumpFromNotes =
    hasRoomTotal &&
    sanitizedRoom.priceProvidedByUser !== false &&
    (sanitizedRoom.priceIncludesLaborAndMaterials ||
      notesContainExplicitPrice(parseText, roomTotal));

  if (
    userLumpFromNotes &&
    roomTotal != null &&
    (knownSubtotal === 0 || Math.abs(knownSubtotal - roomTotal) > 1)
  ) {
    pricingItems = [
      {
        name: `${sanitizedRoom.name} — total from notes`,
        description: sanitizedRoom.scope || '',
        quantity: null,
        unit: 'lump_sum',
        unitRate: null,
        amount: roomTotal,
        pricingType: 'lump_sum',
        priceSource: 'user_provided',
        status: 'confirmed',
        formula: null,
        includedInSubtotal: true,
        approvedByUser: true,
        needsReview: false,
      },
    ];
    knownSubtotal = roomTotal;
  }

  let missingPriceItems =
    Array.isArray(sanitizedRoom.missingPriceItems) && sanitizedRoom.missingPriceItems.length > 0
      ? sanitizedRoom.missingPriceItems.map((s) => String(s).trim()).filter(Boolean)
      : inferMissingScopeItems(sanitizedRoom.scope, pricingItems, projectType);

  let status = 'needs_review';
  let priceSource = 'missing';
  let formula = sanitizedRoom.formula || null;
  const warnings = [];

  const hasManualUserSplit =
    hasRoomTotal &&
    sanitizedRoom.laborPrice != null &&
    sanitizedRoom.materialPrice != null &&
    (sanitizedRoom.priceSource === 'user_provided' ||
      sanitizedRoom.status === 'user_provided' ||
      sanitizedRoom.priceProvidedByUser === true ||
      sanitizedRoom.category === 'custom');
  const hasCalculatedSplit =
    hasRoomTotal &&
    sanitizedRoom.laborPrice != null &&
    sanitizedRoom.materialPrice != null &&
    !sanitizedRoom.priceIncludesLaborAndMaterials &&
    !splitIsSuggested &&
    !hasManualUserSplit;

  if (hasManualUserSplit) {
    status = 'user_provided';
    priceSource = 'user_provided';
    missingPriceItems = [];
  } else if ((pricedFromSqft || hasCalculatedSplit) && hasRoomTotal) {
    status = 'calculated';
    priceSource = 'calculated';
    formula =
      sanitizedRoom.formula ||
      formula ||
      `${formatMoney(sanitizedRoom.price)} from unit rates in notes`;
  } else if (hasRoomTotal && !splitIsSuggested && userLumpFromNotes && Math.abs(knownSubtotal - roundMoney(sanitizedRoom.price)) <= 1) {
    status =
      sanitizedRoom.priceIncludesLaborAndMaterials && sanitizedRoom.priceProvidedByUser !== false
        ? 'user_provided'
        : 'confirmed';
    priceSource = 'user_provided';
  } else if (hasRoomTotal && !splitIsSuggested) {
    status =
      sanitizedRoom.priceIncludesLaborAndMaterials && sanitizedRoom.priceProvidedByUser !== false
        ? 'user_provided'
        : 'confirmed';
    priceSource = 'user_provided';
    if (knownSubtotal > 0 && knownSubtotal < roundMoney(sanitizedRoom.price)) {
      status = 'partial_pricing';
      warnings.push(
        `${sanitizedRoom.name}: user total ${formatMoney(sanitizedRoom.price)} exceeds itemized known ${formatMoney(knownSubtotal)} — confirm line items`
      );
    }
  } else if (knownSubtotal > 0) {
    status = 'partial_pricing';
    priceSource = 'user_provided';
    const hasRough = pricingItems.some((p) => p.status === 'rough_price');
    if (hasRough) {
      warnings.push(`${sanitizedRoom.name}: rough prices included in known subtotal — confirm before bidding`);
    }
    warnings.push(
      `Partial pricing found for ${sanitizedRoom.name}: ${formatMoney(knownSubtotal)} known. These items still need pricing before the estimate is complete.`
    );
  } else if (sanitizedRoom.scope?.trim() || scopeQuantities.length > 0) {
    status = 'missing_price';
    priceSource = 'missing';
    if (!missingPriceItems.length) {
      missingPriceItems = scopeOnlyMissingHints(sanitizedRoom.name);
    }
  }

  if (
    pricingItems.length === 0 &&
    knownSubtotal === 0 &&
    hasRoomTotal &&
    status !== 'calculated' &&
    status !== 'partial_pricing' &&
    status !== 'user_provided'
  ) {
    pricingItems = [
      {
        name: `${sanitizedRoom.name} — lump sum from notes`,
        description: sanitizedRoom.scope || '',
        quantity: null,
        unit: 'lump_sum',
        unitRate: null,
        amount: roundMoney(sanitizedRoom.price),
        pricingType: 'lump_sum',
        priceSource: 'user_provided',
        status: 'confirmed',
        formula: null,
        includedInSubtotal: true,
        approvedByUser: true,
        needsReview: false,
      },
    ];
    knownSubtotal = roundMoney(sanitizedRoom.price);
    if (sanitizedRoom.priceIncludesLaborAndMaterials && sanitizedRoom.priceProvidedByUser !== false) {
      status = 'user_provided';
    } else {
      status = 'confirmed';
    }
  }

  const calculatedSubtotal = pricedFromSqft && hasRoomTotal ? roundMoney(sanitizedRoom.price) : null;
  const finalApprovedTotal = hasRoomTotal ? roundMoney(sanitizedRoom.price) : null;

  return {
    name: sanitizedRoom.name,
    category: sanitizedRoom.category || inferPackageCategory(sanitizedRoom, projectType),
    trade: detectTrades(projectType, `${sanitizedRoom.name} ${sanitizedRoom.scope}`)[0] || projectType,
    scope: sanitizedRoom.scope || '',
    scopeQuantities,
    price: hasRoomTotal ? roundMoney(sanitizedRoom.price) : null,
    laborPrice: sanitizedRoom.laborPrice != null ? roundMoney(sanitizedRoom.laborPrice) : null,
    materialPrice: sanitizedRoom.materialPrice != null ? roundMoney(sanitizedRoom.materialPrice) : null,
    status,
    knownSubtotal: knownSubtotal > 0 ? knownSubtotal : null,
    calculatedSubtotal,
    aiSuggestedSubtotal: null,
    finalApprovedTotal,
    includesLabor: sanitizedRoom.priceIncludesLaborAndMaterials
      ? true
      : sanitizedRoom.laborPrice != null
        ? true
        : null,
    includesMaterials: sanitizedRoom.priceIncludesLaborAndMaterials
      ? true
      : sanitizedRoom.materialPrice != null
        ? true
        : null,
    priceSource,
    formula,
    pricingItems,
    missingPriceItems,
    clarificationQuestions: [],
    warnings,
    pricingType:
      status === 'calculated'
        ? 'unit_rate'
        : status === 'partial_pricing'
          ? 'partial'
          : hasManualUserSplit
            ? 'split'
            : 'lump_sum',
    missingInfo: [],
    priceIncludesLaborAndMaterials: Boolean(sanitizedRoom.priceIncludesLaborAndMaterials),
    splitIsSuggested,
    budgetSplitBasis: sanitizedRoom.budgetSplitBasis || null,
    priceProvidedByUser: Boolean(
      (hasRoomTotal && sanitizedRoom.priceProvidedByUser && notesContainExplicitPrice(parseText, sanitizedRoom.price)) ||
        pricingItems.some((p) => p.includedInSubtotal && p.amount > 0 && p.priceSource !== 'quantity_only')
    ),
    applyEligible: hasRoomTotal || knownSubtotal > 0 || status === 'calculated',
  };
}

function computeBidCompleteness(draft, scopePackages) {
  const good = [];
  const needsReview = [];
  let points = 0;
  const maxPoints = 12;

  if (draft.projectType && draft.projectType !== 'other') {
    points += 1;
    good.push('Project type detected');
  } else {
    needsReview.push('Project type unclear');
  }

  if (draft.projectTitle || draft.customerName) {
    points += 1;
    good.push('Project/customer identified');
  }

  if (scopePackages.length > 0) {
    points += 2;
    good.push(`${scopePackages.length} scope package(s) detected`);
  } else {
    needsReview.push('No scope packages detected');
  }

  const withPricing = scopePackages.filter(
    (p) =>
      (p.status === 'confirmed' ||
        p.status === 'user_provided' ||
        p.status === 'calculated' ||
        p.status === 'partial_pricing' ||
        p.status === 'rough_price') &&
      ((p.knownSubtotal != null && p.knownSubtotal > 0) ||
        (p.price != null && p.price > 0) ||
        p.status === 'calculated')
  );
  if (withPricing.length > 0) {
    points += 2;
    good.push('Some pricing found in notes');
  } else if (scopePackages.some((p) => (p.scopeQuantities || []).length > 0)) {
    points += 1;
    good.push('Quantities found in notes — pricing still needed');
    needsReview.push('No pricing found yet — add rates or lump sums');
  } else {
    needsReview.push('No pricing found yet');
  }

  const partial = scopePackages.filter((p) => p.status === 'partial_pricing');
  if (partial.length > 0) {
    needsReview.push(
      `${partial.length} package(s) have partial pricing — finish missing items before bidding`
    );
  }

  if (draft.statedTotal != null) {
    points += 1;
    good.push('Stated bid total in notes');
  } else {
    needsReview.push('No final bid total in notes');
  }

  if (draft.suggestedPaymentSchedule?.length) {
    points += 1;
    good.push('Payment terms mentioned');
  } else {
    needsReview.push('Payment terms missing');
  }

  if (draft.customerName) points += 0.5;
  else needsReview.push('Customer info incomplete');

  if (!draft.missingInfo?.some((m) => /phone/i.test(m))) points += 0.5;
  else needsReview.push('Customer phone missing');

  if (!draft.missingInfo?.some((m) => /address/i.test(m))) points += 0.5;
  else needsReview.push('Project address missing');

  const sqftFound =
    scopePackages.some((p) => /\d+\s*sq/i.test(p.scope)) ||
    (draft.allowances || []).some((a) => a.quantity != null);
  if (sqftFound) {
    points += 1;
    good.push('Quantities (sqft/lf) found');
  }

  const score = Math.min(100, Math.round((points / maxPoints) * 100));

  return {
    bidCompletenessScore: score,
    bidCompletenessGood: good,
    bidCompletenessNeedsReview: needsReview,
  };
}

function syncRoomsFromScopePackages(draft, scopePackages) {
  const byName = new Map(scopePackages.map((p) => [p.name, p]));
  const rooms = (draft.rooms || []).map((room) => {
    const pkg = byName.get(room.name);
    if (!pkg) return room;
    return {
      ...room,
      partialPricing: pkg.status === 'partial_pricing',
      category: pkg.category || room.category,
      knownSubtotal: pkg.knownSubtotal,
      packageStatus: pkg.status,
      applyEligible: pkg.applyEligible,
      laborPrice: pkg.laborPrice ?? room.laborPrice ?? null,
      materialPrice: pkg.materialPrice ?? room.materialPrice ?? null,
      priceSource: pkg.priceSource || room.priceSource,
      budgetSplitBasis: pkg.budgetSplitBasis || room.budgetSplitBasis,
      splitIsSuggested: pkg.splitIsSuggested ?? room.splitIsSuggested,
      priceProvidedByUser: pkg.priceProvidedByUser ?? room.priceProvidedByUser,
      priceIncludesLaborAndMaterials:
        pkg.priceIncludesLaborAndMaterials ?? room.priceIncludesLaborAndMaterials,
      pricingItems: pkg.pricingItems,
      missingPriceItems: pkg.missingPriceItems,
      scopeQuantities: pkg.scopeQuantities?.length ? pkg.scopeQuantities : room.scopeQuantities,
      quantityMeta: pkg.quantityMeta || room.quantityMeta,
      price:
        pkg.status === 'missing_price' || pkg.status === 'needs_review'
          ? null
          : room.price != null
            ? room.price
            : pkg.status === 'partial_pricing' && pkg.knownSubtotal
              ? null
              : pkg.price,
    };
  });
  return rooms;
}

function recomputeDraftTotals(draft, scopePackages) {
  let total = 0;
  for (const pkg of scopePackages) {
    if (pkg.finalApprovedTotal != null) {
      total += pkg.finalApprovedTotal;
    } else if (pkg.status === 'partial_pricing' && pkg.knownSubtotal != null) {
      total += pkg.knownSubtotal;
    } else if (pkg.calculatedSubtotal != null) {
      total += pkg.calculatedSubtotal;
    } else if (pkg.price != null) {
      total += pkg.price;
    }
  }
  return total > 0 ? roundMoney(total) : draft.calculatedLineItemTotal;
}

module.exports = {
  buildScopePackage,
  computeBidCompleteness,
  detectTrades,
  extractPricingItemsFromText,
  syncRoomsFromScopePackages,
  recomputeDraftTotals,
  EXPLICIT_ZERO,
  ROUGH_TRIGGERS,
};
