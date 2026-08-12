/** Canonical new-flooring product ids used by the notes/manual Flooring flow. */
export type FlooringProductId =
  | 'lvp'
  | 'laminate'
  | 'engineered_hardwood'
  | 'solid_hardwood'
  | 'tile'
  | 'carpet'
  | 'sheet_vinyl_vct';

export type FlooringExistingTypeId =
  | FlooringProductId
  | 'unknown';

/** Plan-export install area keys mapped to canonical product ids. */
export const FLOORING_PLAN_INSTALL_AREA_KEYS: Record<string, FlooringProductId> =
  {
    flooringLvpSqft: 'lvp',
    flooringLaminateSqft: 'laminate',
    flooringEngineeredHardwoodSqft: 'engineered_hardwood',
    flooringSolidHardwoodSqft: 'solid_hardwood',
    flooringTileSqft: 'tile',
    flooringCarpetSqft: 'carpet',
    flooringSheetVinylSqft: 'sheet_vinyl_vct',
  };

/** Optional per-type demo area keys from plan export (adapter-only). */
export const FLOORING_PLAN_DEMO_AREA_KEYS: Record<string, FlooringProductId> = {
  floorDemoCarpetSqft: 'carpet',
  floorDemoTileSqft: 'tile',
  floorDemoLvpSqft: 'lvp',
  floorDemoLaminateSqft: 'laminate',
  floorDemoEngineeredHardwoodSqft: 'engineered_hardwood',
  floorDemoSolidHardwoodSqft: 'solid_hardwood',
  floorDemoSheetVinylSqft: 'sheet_vinyl_vct',
};

export const FLOORING_REVIEW_MEASUREMENT_KEYS = [
  'flooringSqft',
  'floorAreaSqft',
  'flooringLvpSqft',
  'flooringLaminateSqft',
  'flooringEngineeredHardwoodSqft',
  'flooringSolidHardwoodSqft',
  'flooringTileSqft',
  'flooringCarpetSqft',
  'flooringSheetVinylSqft',
  'floorDemoSqft',
  'floorDemoCarpetSqft',
  'floorDemoTileSqft',
  'floorDemoLvpSqft',
  'floorDemoLaminateSqft',
  'floorDemoEngineeredHardwoodSqft',
  'floorDemoSolidHardwoodSqft',
  'floorDemoSheetVinylSqft',
  'floorPrepSqft',
  'underlaymentSqft',
  'moistureBarrierSqft',
  'baseboardLf',
  'transitionLf',
  'transitionCount',
  'quarterRoundLf',
] as const;

export const FLOORING_PRODUCT_LABELS: Record<FlooringProductId, string> = {
  lvp: 'LVP',
  laminate: 'Laminate',
  engineered_hardwood: 'Engineered hardwood',
  solid_hardwood: 'Solid hardwood',
  tile: 'Tile',
  carpet: 'Carpet',
  sheet_vinyl_vct: 'Sheet vinyl / VCT',
};

export type FlooringAreaByProduct = Partial<Record<FlooringProductId, number>>;

export type FlooringStructuredMeasurements = {
  flooringAreaByProduct?: FlooringAreaByProduct | null;
  flooringProductScope?: string[] | null;
  flooringExistingTypes?: FlooringExistingTypeId[] | null;
  flooringInstallScopeCount?: number | null;
  flooringDemoScopeCount?: number | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readInstallAreaByProduct(
  input: Record<string, unknown>
): FlooringAreaByProduct {
  const merged: FlooringAreaByProduct = {};
  const existing =
    input.flooringAreaByProduct &&
    typeof input.flooringAreaByProduct === 'object' &&
    !Array.isArray(input.flooringAreaByProduct)
      ? (input.flooringAreaByProduct as Record<string, unknown>)
      : {};
  for (const [product, value] of Object.entries(existing)) {
    const n = positiveNumber(value);
    if (n != null) merged[product as FlooringProductId] = n;
  }
  for (const [planKey, product] of Object.entries(
    FLOORING_PLAN_INSTALL_AREA_KEYS
  )) {
    const n = positiveNumber(input[planKey]);
    if (n != null) merged[product] = n;
  }
  return merged;
}

function readDemoAreaByProduct(
  input: Record<string, unknown>
): FlooringAreaByProduct {
  const merged: FlooringAreaByProduct = {};
  for (const [planKey, product] of Object.entries(FLOORING_PLAN_DEMO_AREA_KEYS)) {
    const n = positiveNumber(input[planKey]);
    if (n != null) merged[product] = n;
  }
  return merged;
}

function sumAreaByProduct(areaByProduct: FlooringAreaByProduct): number | null {
  const total = Object.values(areaByProduct).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );
  return total > 0 ? total : null;
}

function readExplicitProductScope(
  input: Record<string, unknown>
): FlooringProductId[] | null {
  if (!Array.isArray(input.flooringProductScope)) return null;
  const allowed = new Set(Object.values(FLOORING_PLAN_INSTALL_AREA_KEYS));
  const scope = input.flooringProductScope
    .map(String)
    .filter(id => allowed.has(id as FlooringProductId)) as FlooringProductId[];
  return scope.length ? scope : null;
}

function readExplicitExistingTypes(
  input: Record<string, unknown>
): FlooringExistingTypeId[] | null {
  if (!Array.isArray(input.flooringExistingTypes)) return null;
  const scope = input.flooringExistingTypes
    .map(String)
    .filter(Boolean) as FlooringExistingTypeId[];
  return scope.length ? scope : null;
}

function buildInstallItemQuantities(
  areaByProduct: FlooringAreaByProduct
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  for (const [product, area] of Object.entries(areaByProduct)) {
    if (!area || area <= 0) continue;
    out[`floor_install__${product}`] = {
      quantity: area,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    };
  }
  return out;
}

function buildDemoItemQuantities(
  demoByProduct: FlooringAreaByProduct,
  aggregateDemo: number | null,
  existingTypes: FlooringExistingTypeId[] | null
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  let total = 0;
  for (const [product, area] of Object.entries(demoByProduct)) {
    if (!area || area <= 0) continue;
    out[`floor_demo__${product}`] = {
      quantity: area,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    };
    total += area;
  }
  if (
    !Object.keys(out).length &&
    aggregateDemo != null &&
    existingTypes?.length === 1 &&
    existingTypes[0] !== 'unknown'
  ) {
    out[`floor_demo__${existingTypes[0]}`] = {
      quantity: aggregateDemo,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    };
    total = aggregateDemo;
  }
  if (total > 0) {
    out.floor_demo = {
      quantity: total,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    };
  }
  return out;
}

/**
 * Converge plan/notes/manual flooring inputs onto the same canonical keys used
 * by the finished notes/manual Flooring flow. Does not invoke pricing.
 */
export function buildFlooringStructuredMeasurements(
  input: Record<string, unknown>
): FlooringStructuredMeasurements {
  const areaByProduct = readInstallAreaByProduct(input);
  const demoByProduct = readDemoAreaByProduct(input);
  const explicitProductScope = readExplicitProductScope(input);
  const productScopeFromAreas = Object.keys(areaByProduct) as FlooringProductId[];
  const productScope = explicitProductScope?.length
    ? [
        ...new Set([
          ...explicitProductScope,
          ...productScopeFromAreas,
        ]),
      ]
    : productScopeFromAreas.length
      ? productScopeFromAreas
      : null;

  const perTypeTotal = sumAreaByProduct(areaByProduct);
  const aggregateInstall =
    positiveNumber(input.flooringSqft) ?? positiveNumber(input.floorAreaSqft);

  const existingTypes = readExplicitExistingTypes(input);
  const aggregateDemo = positiveNumber(input.floorDemoSqft);
  const demoTotal =
    sumAreaByProduct(demoByProduct) ?? aggregateDemo ?? null;

  const installItemQuantities = buildInstallItemQuantities(areaByProduct);
  const demoItemQuantities = buildDemoItemQuantities(
    demoByProduct,
    aggregateDemo,
    existingTypes
  );
  const itemQuantities = {
    ...installItemQuantities,
    ...demoItemQuantities,
  };

  const hasInstallAreas = perTypeTotal != null;
  const installScopeCount =
    productScope?.length && hasInstallAreas ? 1 : null;
  const demoScopeCount = demoTotal != null ? 1 : null;

  return {
    flooringAreaByProduct: Object.keys(areaByProduct).length
      ? areaByProduct
      : null,
    flooringProductScope: productScope,
    flooringExistingTypes: existingTypes,
    flooringInstallScopeCount: installScopeCount,
    flooringDemoScopeCount: demoScopeCount,
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : null,
  };
}

export function normalizeFlooringScalarMeasurements(
  input: Record<string, unknown>,
  structured: FlooringStructuredMeasurements
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  const scalarKeys = [
    'flooringLvpSqft',
    'flooringLaminateSqft',
    'flooringEngineeredHardwoodSqft',
    'flooringSolidHardwoodSqft',
    'flooringTileSqft',
    'flooringCarpetSqft',
    'flooringSheetVinylSqft',
    'floorDemoSqft',
    'floorPrepSqft',
    'underlaymentSqft',
    'moistureBarrierSqft',
    'baseboardLf',
    'transitionLf',
    'transitionCount',
    'quarterRoundLf',
    'flooringNewLvpInstallMethod',
    'flooringNewSheetVinylType',
    'flooringExistingLvpInstallMethod',
    'flooringExistingSheetVinylType',
    'flooringAttachedPad',
    'flooringMoistureMembraneIncluded',
  ] as const;

  const areaByProduct = structured.flooringAreaByProduct || {};
  for (const [product, area] of Object.entries(areaByProduct)) {
    const planKey = Object.entries(FLOORING_PLAN_INSTALL_AREA_KEYS).find(
      ([, id]) => id === product
    )?.[0];
    if (planKey && area != null) out[planKey] = area;
  }

  const perTypeTotal = sumAreaByProduct(areaByProduct);
  if (perTypeTotal != null) {
    out.flooringSqft = perTypeTotal;
    out.floorAreaSqft = perTypeTotal;
  } else {
    const aggregate =
      positiveNumber(input.flooringSqft) ?? positiveNumber(input.floorAreaSqft);
    if (aggregate != null) {
      out.flooringSqft = aggregate;
      if (positiveNumber(input.floorAreaSqft) != null) {
        out.floorAreaSqft = positiveNumber(input.floorAreaSqft)!;
      }
    }
  }

  const demoTotal =
    sumAreaByProduct(readDemoAreaByProduct(input)) ??
    positiveNumber(input.floorDemoSqft);
  if (demoTotal != null) out.floorDemoSqft = demoTotal;

  for (const key of scalarKeys) {
    if (out[key] != null) continue;
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      if (key.includes('Method') || key.includes('Type') || key.includes('Pad') || key.includes('Membrane')) {
        out[key] = value.trim();
      } else {
        const n = positiveNumber(value);
        if (n != null) out[key] = n;
      }
    }
  }

  if (structured.flooringInstallScopeCount != null) {
    out.flooringInstallScopeCount = structured.flooringInstallScopeCount;
  }
  if (structured.flooringDemoScopeCount != null) {
    out.flooringDemoScopeCount = structured.flooringDemoScopeCount;
  }

  return out;
}

/** True when plan only supplied aggregate area without product breakdown. */
export function flooringPlanNeedsTypeConfirmation(
  input: Record<string, unknown>
): boolean {
  const structured = buildFlooringStructuredMeasurements(input);
  const hasPerType = Boolean(
    structured.flooringAreaByProduct &&
      Object.keys(structured.flooringAreaByProduct).length
  );
  const hasProductScope = Boolean(structured.flooringProductScope?.length);
  const aggregate =
    positiveNumber(input.flooringSqft) ?? positiveNumber(input.floorAreaSqft);
  return aggregate != null && !hasPerType && !hasProductScope;
}
