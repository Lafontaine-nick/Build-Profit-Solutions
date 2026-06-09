/**
 * Per-scope-item quantity rules for complex jobs (bathroom remodel, etc.).
 * Room sqft must not be blindly applied to every line item.
 */

const { extractScopeQuantitiesForPackage } = require('./estimateDraftQuantityPrice');

const QUANTITY_SOURCES = {
  notes: 'notes',
  user_entered: 'user_entered',
  inferred: 'inferred',
  default_assumption: 'default_assumption',
  missing: 'missing',
  not_applicable: 'not_applicable',
};

/** @typedef {'sqft'|'lf'|'each'|'hr'|'allowance'|'lump_sum'} ScopeQtyUnit */

/**
 * @typedef {object} ScopeItemQuantityRule
 * @property {ScopeQtyUnit} defaultUnit
 * @property {ScopeQtyUnit[]} allowedUnits
 * @property {string} [measurementKey] - key on normalized room measurements
 * @property {boolean} [canUseRoomSqft]
 * @property {boolean} [requiresUserQuantity]
 * @property {number} [defaultQuantity]
 * @property {'unit_rate'|'each'|'lump_sum'|'allowance'|'hourly'|'scope_only'} pricingMethod
 * @property {string} [quantityHelper]
 * @property {string} [missingMessage]
 */

/** Checklist item id → quantity rule (bathroom remodel primary). */
const CHECKLIST_ITEM_QUANTITY_RULES = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Uses bathroom floor sqft for demo area.',
  },
  shower_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower wall tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower wall tile sqft.',
  },
  waterproofing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Usually same as shower wall tile sqft.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Uses bathroom floor sqft.',
  },
  tub_shower: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower wall tile sqft if replacing tile.',
    missingMessage: 'Enter shower area sqft or fixture count.',
  },
  vanity: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 vanity. Edit if different.',
  },
  toilet: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 toilet. Edit if different.',
  },
  plumbing_rough: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    pricingMethod: 'allowance',
    quantityHelper: 'Enter fixture moves or use a plumbing allowance.',
    missingMessage: 'Enter number of fixtures moved or plumbing allowance.',
  },
  electrical_rough: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'hr'],
    requiresUserQuantity: true,
    pricingMethod: 'allowance',
    quantityHelper: 'Enter devices, fixtures, circuits, or use an electrical allowance.',
    missingMessage: 'Enter electrical device/fixture count or allowance.',
  },
  lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 light fixture. Edit count if different.',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter patch/repair sqft or use a lump sum.',
    missingMessage: 'Enter drywall repair sqft or lump sum.',
  },
  paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter wall/ceiling paint sqft or use room allowance.',
    missingMessage: 'Enter wall/ceiling paint sqft.',
  },
  trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf'],
    measurementKey: 'baseboardLf',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Linear feet around bathroom perimeter.',
    missingMessage: 'Enter baseboard linear feet.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 shower door.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'allowance',
    quantityHelper: 'Assuming 1 plumbing trim allowance.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'allowance',
    quantityHelper: 'Assuming 1 electrical trim allowance.',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'allowance',
    quantityHelper: 'Assuming 1 permit allowance.',
  },
  cleanup: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'lump_sum',
    quantityHelper: 'Assuming 1 cleanup/disposal lump sum.',
  },
};

/** Package name patterns → checklist rule key */
const PACKAGE_NAME_TO_RULE_KEY = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: 'demo' },
  { test: /\bshower\b.*\btile\b|\btile\b.*\bshower\b|\bshower\s+wall\s+tile/i, key: 'shower_tile' },
  { test: /\bwaterproof|\bbacker\s+board/i, key: 'waterproofing' },
  { test: /\bfloor\b.*\btile\b|\btile\b.*\bfloor\b/i, key: 'floor_tile' },
  { test: /\bvanity\b/i, key: 'vanity' },
  { test: /\btoilet\b/i, key: 'toilet' },
  { test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i, key: 'plumbing_rough' },
  { test: /\belectrical\b(?!.*trim)|\bnew\s+circuits\b/i, key: 'electrical_rough' },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: 'lighting' },
  { test: /\bdrywall\b|\bpatch/i, key: 'drywall' },
  { test: /\bpaint|\bpainting/i, key: 'paint' },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard/i, key: 'trim' },
  { test: /\bshower\s+door|\bglass\s+door|\benclosure/i, key: 'glass_door' },
  { test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/i, key: 'plumbing_trim' },
  { test: /\belectrical\s+trim|\bdevices.*\bplates/i, key: 'electrical_trim' },
  { test: /\bpermit|\binspection/i, key: 'permits' },
  { test: /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster/i, key: 'cleanup' },
  { test: /\bplumb(?!.*trim)/i, key: 'plumbing_rough' },
];

function parseMeasurementNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeScopeMeasurements(measurements = {}) {
  const bathroomFloorSqft =
    parseMeasurementNumber(measurements.bathroomFloorSqft) ??
    parseMeasurementNumber(measurements.sqft);
  const baseboardLf =
    parseMeasurementNumber(measurements.baseboardLf) ?? parseMeasurementNumber(measurements.lf);
  const showerWallTileSqft = parseMeasurementNumber(measurements.showerWallTileSqft);
  const wallPaintSqft = parseMeasurementNumber(measurements.wallPaintSqft);

  return {
    bathroomFloorSqft,
    baseboardLf,
    showerWallTileSqft,
    wallPaintSqft,
    sqft: bathroomFloorSqft,
    lf: baseboardLf,
    itemQuantities: measurements.itemQuantities || {},
  };
}

function lookupRuleKeyForPackage(name, scope = '') {
  const blob = `${name} ${scope}`;
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(blob)) return row.key;
  }
  return null;
}

function getRuleForChecklistItem(itemId) {
  return CHECKLIST_ITEM_QUANTITY_RULES[itemId] || null;
}

function getRuleForPackage(name, scope = '') {
  const key = lookupRuleKeyForPackage(name, scope);
  return key ? CHECKLIST_ITEM_QUANTITY_RULES[key] : null;
}

function sourceLabel(source) {
  switch (source) {
    case QUANTITY_SOURCES.notes:
      return 'From notes';
    case QUANTITY_SOURCES.user_entered:
      return 'Entered';
    case QUANTITY_SOURCES.inferred:
      return 'From room measurement';
    case QUANTITY_SOURCES.default_assumption:
      return 'Assumed';
    case QUANTITY_SOURCES.missing:
      return 'Needs measurement';
    default:
      return '';
  }
}

/**
 * @returns {{ quantity: number|null, unit: string, quantitySource: string, label: string, sourceLabel: string, rule: ScopeItemQuantityRule|null, pricingReady: boolean, missingMessage?: string }}
 */
function resolveQuantityForChecklistItem(itemId, ctx = {}) {
  const rule = getRuleForChecklistItem(itemId);
  if (!rule) {
    return {
      quantity: null,
      unit: 'lump_sum',
      quantitySource: QUANTITY_SOURCES.missing,
      label: itemId,
      sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
      rule: null,
      pricingReady: false,
    };
  }

  const measurements = normalizeScopeMeasurements(ctx.measurements);
  const itemOverride = measurements.itemQuantities?.[itemId];

  if (itemOverride && itemOverride.quantity != null && itemOverride.quantity > 0) {
    const unit = itemOverride.unit || rule.defaultUnit;
    return {
      quantity: Number(itemOverride.quantity),
      unit,
      quantitySource: itemOverride.quantitySource || QUANTITY_SOURCES.user_entered,
      label: itemId,
      sourceLabel: sourceLabel(itemOverride.quantitySource || QUANTITY_SOURCES.user_entered),
      rule,
      pricingReady: isQuantityValidForPricing({ quantity: itemOverride.quantity, unit }, rule),
    };
  }

  const notes = String(ctx.notes || '');
  const packageName = ctx.packageName || itemId;
  const extracted = extractScopeQuantitiesForPackage(packageName, '', notes);
  if (extracted.length) {
    const match =
      extracted.find((q) => rule.allowedUnits.includes(q.unit)) ||
      (rule.defaultUnit === 'sqft' ? extracted.find((q) => q.unit === 'sqft') : null) ||
      (rule.defaultUnit === 'lf' ? extracted.find((q) => q.unit === 'lf') : null) ||
      (rule.defaultUnit === 'each' ? extracted.find((q) => q.unit === 'each') : null);
    if (match && rule.allowedUnits.includes(match.unit)) {
      return {
        quantity: match.quantity,
        unit: match.unit,
        quantitySource: QUANTITY_SOURCES.notes,
        label: match.label || packageName,
        sourceLabel: sourceLabel(QUANTITY_SOURCES.notes),
        rule,
        pricingReady: true,
      };
    }
  }

  if (rule.measurementKey && measurements[rule.measurementKey]) {
    return {
      quantity: measurements[rule.measurementKey],
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.inferred,
      label: packageName,
      sourceLabel:
        rule.measurementKey === 'bathroomFloorSqft'
          ? 'From room floor sqft'
          : sourceLabel(QUANTITY_SOURCES.inferred),
      rule,
      pricingReady: true,
    };
  }

  if (rule.defaultQuantity != null && !rule.requiresUserQuantity) {
    return {
      quantity: rule.defaultQuantity,
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.default_assumption,
      label: packageName,
      sourceLabel: sourceLabel(QUANTITY_SOURCES.default_assumption),
      rule,
      pricingReady: isQuantityValidForPricing(
        { quantity: rule.defaultQuantity, unit: rule.defaultUnit },
        rule
      ),
    };
  }

  return {
    quantity: null,
    unit: rule.defaultUnit,
    quantitySource: QUANTITY_SOURCES.missing,
    label: packageName,
    sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
    rule,
    pricingReady: false,
    missingMessage: rule.missingMessage || rule.quantityHelper,
  };
}

function resolveQuantityForPackage(name, scope = '', ctx = {}) {
  const ruleKey = lookupRuleKeyForPackage(name, scope);
  if (ruleKey) {
    return resolveQuantityForChecklistItem(ruleKey, { ...ctx, packageName: name });
  }

  const notes = String(ctx.notes || '');
  const fromPkg = ctx.existingQuantities || [];
  if (fromPkg.length) {
    const q = fromPkg[0];
    return {
      quantity: q.quantity,
      unit: q.unit,
      quantitySource: q.quantitySource || QUANTITY_SOURCES.user_entered,
      label: q.label || name,
      sourceLabel: sourceLabel(q.quantitySource || QUANTITY_SOURCES.user_entered),
      rule: null,
      pricingReady: q.quantity > 0,
    };
  }

  const extracted = extractScopeQuantitiesForPackage(name, scope, notes);
  if (extracted.length) {
    const q = extracted[0];
    return {
      quantity: q.quantity,
      unit: q.unit,
      quantitySource: QUANTITY_SOURCES.notes,
      label: q.label || name,
      sourceLabel: sourceLabel(QUANTITY_SOURCES.notes),
      rule: null,
      pricingReady: q.quantity > 0,
    };
  }

  return {
    quantity: null,
    unit: 'lump_sum',
    quantitySource: QUANTITY_SOURCES.missing,
    label: name,
    sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
    rule: null,
    pricingReady: false,
  };
}

function isQuantityValidForPricing(qty, rule) {
  if (!qty || qty.quantity == null || qty.quantity <= 0) return false;
  if (!rule) return true;
  if (!rule.allowedUnits.includes(qty.unit)) return false;
  if (rule.requiresUserQuantity && qty.quantitySource === QUANTITY_SOURCES.missing) return false;
  if (
    qty.unit === 'sqft' &&
    !rule.canUseRoomSqft &&
    !rule.measurementKey &&
    qty.quantitySource === QUANTITY_SOURCES.inferred
  ) {
    return false;
  }
  return true;
}

function isPricingReadyForPackage(name, scope, ctx = {}) {
  const resolved = resolveQuantityForPackage(name, scope, ctx);
  if (!resolved.pricingReady) return false;
  if (resolved.rule) {
    return isQuantityValidForPricing(
      { quantity: resolved.quantity, unit: resolved.unit, quantitySource: resolved.quantitySource },
      resolved.rule
    );
  }
  return resolved.quantity != null && resolved.quantity > 0;
}

function stampPackageWithCatalogRules(pkg, ctx = {}) {
  const name = pkg.name || '';
  const scope = pkg.scope || '';
  const existing = pkg.scopeQuantities || [];

  const resolved = resolveQuantityForPackage(name, scope, {
    ...ctx,
    existingQuantities: existing,
  });

  if (!resolved.pricingReady || resolved.quantity == null) {
    const kept = existing.filter((q) => q.quantity > 0);
    return kept.length ? { ...pkg, scopeQuantities: kept } : { ...pkg, scopeQuantities: undefined };
  }

  return {
    ...pkg,
    scopeQuantities: [
      {
        label: resolved.label || name,
        quantity: resolved.quantity,
        unit: resolved.unit,
        quantitySource: resolved.quantitySource,
      },
    ],
    quantityMeta: {
      quantitySource: resolved.quantitySource,
      sourceLabel: resolved.sourceLabel,
      pricingReady: resolved.pricingReady,
      missingMessage: resolved.missingMessage,
    },
  };
}

function countPricingReadiness(packages, ctx = {}) {
  let ready = 0;
  let needsMeasurement = 0;
  for (const pkg of packages || []) {
    if (isPricingReadyForPackage(pkg.name, pkg.scope, ctx)) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement, total: ready + needsMeasurement };
}

module.exports = {
  QUANTITY_SOURCES,
  CHECKLIST_ITEM_QUANTITY_RULES,
  normalizeScopeMeasurements,
  getRuleForChecklistItem,
  getRuleForPackage,
  lookupRuleKeyForPackage,
  resolveQuantityForChecklistItem,
  resolveQuantityForPackage,
  isQuantityValidForPricing,
  isPricingReadyForPackage,
  stampPackageWithCatalogRules,
  countPricingReadiness,
  sourceLabel,
};
