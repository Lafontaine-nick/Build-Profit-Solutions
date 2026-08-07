import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';

export type FlooringDemoPrepWorkCode =
  | 'REMOVE_FINISH_FLOOR'
  | 'REMOVE_PAD'
  | 'REMOVE_TACK_STRIP'
  | 'REMOVE_FLOATING_UNDERLAYMENT'
  | 'REMOVE_BULK_ADHESIVE'
  | 'REMOVE_BULK_THINSET'
  | 'DEMO_SUBSTRATE_CLEAN'
  | 'DEMO_PROTECTION'
  | 'DEMO_EQUIPMENT'
  | 'DEMO_HAUL_OFF'
  | 'DEMO_DISPOSAL'
  | 'REMOVE_RESIDUAL_ADHESIVE'
  | 'REMOVE_RESIDUAL_THINSET'
  | 'FINAL_GRINDING'
  | 'PATCH_SUBSTRATE'
  | 'SKIM_COAT'
  | 'LOCAL_LEVELING'
  | 'FULL_SELF_LEVELING';

export type FlooringSubstratePrepDisclosure = 'no' | 'yes' | 'unsure';

export type FloorPrepLevel = 0 | 1 | 2 | 3 | 4;

export const FLOORING_DEMO_PREP_OVERLAP_WARNING =
  'Possible duplicate scope: demolition and floor prep both appear to include the same substrate-preparation work. Confirm whether final grinding, patching, skim coating, or leveling is included in demolition before applying both prices.';

const DEMO_WORK_CODES: FlooringDemoPrepWorkCode[] = [
  'REMOVE_FINISH_FLOOR',
  'REMOVE_PAD',
  'REMOVE_TACK_STRIP',
  'REMOVE_FLOATING_UNDERLAYMENT',
  'REMOVE_BULK_ADHESIVE',
  'REMOVE_BULK_THINSET',
  'DEMO_SUBSTRATE_CLEAN',
  'DEMO_PROTECTION',
  'DEMO_EQUIPMENT',
  'DEMO_HAUL_OFF',
  'DEMO_DISPOSAL',
];

const PREP_WORK_CODES: FlooringDemoPrepWorkCode[] = [
  'REMOVE_RESIDUAL_ADHESIVE',
  'REMOVE_RESIDUAL_THINSET',
  'FINAL_GRINDING',
  'PATCH_SUBSTRATE',
  'SKIM_COAT',
  'LOCAL_LEVELING',
  'FULL_SELF_LEVELING',
];

const PREP_CODES_BY_LEVEL: Record<FloorPrepLevel, FlooringDemoPrepWorkCode[]> = {
  0: [],
  1: ['PATCH_SUBSTRATE'],
  2: ['REMOVE_RESIDUAL_ADHESIVE', 'PATCH_SUBSTRATE', 'LOCAL_LEVELING'],
  3: ['REMOVE_RESIDUAL_THINSET', 'REMOVE_RESIDUAL_ADHESIVE', 'FINAL_GRINDING', 'PATCH_SUBSTRATE', 'SKIM_COAT'],
  4: ['REMOVE_RESIDUAL_THINSET', 'FINAL_GRINDING', 'PATCH_SUBSTRATE', 'SKIM_COAT', 'FULL_SELF_LEVELING'],
};

/** Demo owns removal + ordinary substrate cleanup. Prep owns only extra work after that. */
export const FLOORING_DEMO_SCOPE_SUMMARY =
  'Removes existing flooring and bulk setting material, then cleans the exposed substrate (sweep, vacuum, scrape loose debris). Includes protection, haul-off, and disposal.';

export const FLOORING_PREP_SCOPE_SUMMARY =
  'Extra substrate work after demolition and cleaning — residual adhesive/thinset grinding, patching, skim coating, or leveling required for the new floor. Ordinary demo cleanup is not included here.';

export function demoWorkCodesForType(
  existingType: string,
  lvpInstallMethod?: string | null
): FlooringDemoPrepWorkCode[] {
  const codes: FlooringDemoPrepWorkCode[] = [
    'REMOVE_FINISH_FLOOR',
    'DEMO_SUBSTRATE_CLEAN',
    'DEMO_PROTECTION',
    'DEMO_EQUIPMENT',
    'DEMO_HAUL_OFF',
    'DEMO_DISPOSAL',
  ];
  if (existingType === 'carpet') {
    codes.push('REMOVE_PAD', 'REMOVE_TACK_STRIP');
  }
  if (existingType === 'laminate' || (existingType === 'lvp' && lvpInstallMethod === 'floating')) {
    codes.push('REMOVE_FLOATING_UNDERLAYMENT');
  }
  if (existingType === 'lvp' && lvpInstallMethod === 'glue_down') {
    codes.push('REMOVE_BULK_ADHESIVE');
  }
  if (existingType === 'sheet_vinyl_vct') {
    codes.push('REMOVE_BULK_ADHESIVE');
  }
  if (existingType === 'tile') {
    codes.push('REMOVE_BULK_THINSET');
  }
  return codes;
}

export function prepWorkCodesForLevel(level: FloorPrepLevel): FlooringDemoPrepWorkCode[] {
  return PREP_CODES_BY_LEVEL[level] || [];
}

export function demoCatalogAssumptionNote(
  existingType: string,
  measurementsInput?: ScopeMeasurementsInputExtended
): string {
  const cleanTail =
    'Includes ordinary substrate cleaning after removal. Excludes residual grinding, patching, skim coating, and leveling (priced under floor prep).';
  if (existingType === 'tile') {
    return `Includes tile removal, bulk thinset removal, protection, haul-off, and disposal. ${cleanTail}`;
  }
  if (existingType === 'carpet') {
    return `Includes carpet, pad, tack-strip removal, protection, haul-off, and disposal. ${cleanTail}`;
  }
  if (existingType === 'laminate') {
    return `Includes plank removal, attached or loose underlayment removal, protection, haul-off, and disposal. ${cleanTail}`;
  }
  if (existingType === 'lvp') {
    if (measurementsInput?.flooringExistingLvpInstallMethod === 'glue_down') {
      return `Includes flooring removal and bulk adhesive removal required to expose the substrate. ${cleanTail}`;
    }
    return `Includes plank removal, attached or loose underlayment removal, protection, haul-off, and disposal. ${cleanTail}`;
  }
  if (existingType === 'sheet_vinyl_vct') {
    return `Includes flooring removal and bulk adhesive removal required to expose the substrate. ${cleanTail}`;
  }
  if (
    existingType === 'solid_hardwood' ||
    existingType === 'engineered_hardwood' ||
    existingType === 'hardwood'
  ) {
    return `Includes hardwood flooring removal, protection, haul-off, and disposal. ${cleanTail}`;
  }
  return `Includes standard flooring removal, protection, haul-off, and disposal. ${cleanTail}`;
}

export function prepIncludesSummaryForLevel(level: FloorPrepLevel): string {
  switch (level) {
    case 0:
      return 'No extra prep beyond demo cleaning';
    case 1:
      return 'Minor fastener-hole / staple patching and surface touch-up after demo cleaning';
    case 2:
      return 'Residual adhesive scraping, surface patching, and localized leveling';
    case 3:
      return 'Residual thinset/adhesive grinding, patching, and skim coating';
    case 4:
      return 'Full-area self-leveling plus grinding, patching, and skim coating';
    default:
      return 'Extra substrate preparation after demolition';
  }
}

export function floorPrepLevelLabel(level: FloorPrepLevel): string {
  return (
    {
      0: 'No prep',
      1: 'Light prep',
      2: 'Moderate prep',
      3: 'Heavy prep',
      4: 'Extensive prep / self-leveling',
    }[level] || 'Prep level not confirmed'
  );
}

function label(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isSoftNewFloor(
  product: string,
  newLvpInstallMethod: string
): boolean {
  if (product === 'carpet' || product === 'laminate') return true;
  if (product === 'lvp') {
    // Unknown new LVP method defaults to floating planning assumption.
    return newLvpInstallMethod !== 'glue_down';
  }
  return false;
}

function isHardNewFloor(product: string, newLvpInstallMethod: string): boolean {
  if (product === 'tile' || product.includes('hardwood') || product === 'sheet_vinyl_vct') {
    return true;
  }
  return product === 'lvp' && newLvpInstallMethod === 'glue_down';
}

/**
 * Extra prep needed after demo removal + ordinary substrate cleaning.
 * Level is driven by residual substrate condition left by the old floor and
 * flatness/bond requirements of the new floor — not by demo cleaning itself.
 */
export function inferFloorPrepLevel(
  existing: string,
  product: string,
  measurementsInput: ScopeMeasurementsInputExtended
): FloorPrepLevel {
  const lvpInstallMethod = measurementsInput.flooringExistingLvpInstallMethod || 'unknown';
  const newLvpInstallMethod = measurementsInput.flooringNewLvpInstallMethod || 'unknown';
  const effectiveNewLvpInstallMethod =
    product === 'lvp' && newLvpInstallMethod === 'unknown' && existing === 'lvp'
      ? lvpInstallMethod
      : newLvpInstallMethod;
  const sheetVinylType = measurementsInput.flooringExistingSheetVinylType || 'unknown';
  const softNew = isSoftNewFloor(product, effectiveNewLvpInstallMethod);
  const hardNew = isHardNewFloor(product, effectiveNewLvpInstallMethod);

  if (existing === 'carpet') {
    return softNew ? 1 : 2;
  }
  if (existing === 'laminate' || (existing === 'lvp' && lvpInstallMethod === 'floating')) {
    return softNew ? 1 : 2;
  }
  if (existing === 'lvp' && lvpInstallMethod === 'glue_down') {
    return softNew ? 2 : 3;
  }
  if (existing === 'lvp') {
    // Existing LVP method unknown — plan moderate residual-adhesive risk.
    return softNew ? 2 : 3;
  }
  if (existing === 'sheet_vinyl_vct') {
    if (sheetVinylType === 'vct') return 3;
    // Sheet vinyl leaves adhesive; soft new floors still need residual cleanup.
    return softNew ? 2 : 3;
  }
  if (existing === 'tile') {
    // Bulk thinset is in demo; residual grind/skim for any new floor is prep.
    return 3;
  }
  if (existing === 'solid_hardwood' || existing === 'engineered_hardwood' || existing === 'hardwood') {
    return softNew ? 2 : 3;
  }
  if (existing === 'unknown' || product === 'unknown' || product === 'unspecified') {
    return 2;
  }
  return hardNew ? 2 : softNew ? 1 : 2;
}

export type FloorPrepTransitionContext = {
  existingType: string;
  newProduct: string;
  demoArea: number;
  prepArea: number;
  prepLevel: FloorPrepLevel;
};

export type FloorPrepPricingBuildResult =
  | {
      ok: false;
      sourceLabel: string;
      pricingDetail: string;
      blockAutoApply?: boolean;
      reviewBeforeBid?: boolean;
    }
  | {
      ok: true;
      transitions: Array<
        FloorPrepTransitionContext & {
          materialTotal: number;
          laborTotal: number;
          total: number;
          catalogRate: number;
          minimum: number;
        }
      >;
      totalPrepArea: number;
      totalMaterial: number;
      totalLabor: number;
      hasReview: boolean;
      includedInDemo: boolean;
      summaryLines: string[];
      pricingDetail: string;
      sourceLabel: string;
      blockAutoApply: boolean;
    };

const PREP_CATALOG: Record<FloorPrepLevel, { rate: number; material: number; labor: number; minimum: number }> = {
  0: { rate: 0, material: 0, labor: 0, minimum: 0 },
  1: { rate: 0.75, material: 0.15, labor: 0.6, minimum: 250 },
  2: { rate: 1.5, material: 0.45, labor: 1.05, minimum: 350 },
  3: { rate: 3, material: 1.05, labor: 1.95, minimum: 500 },
  4: { rate: 4.5, material: 1.8, labor: 2.7, minimum: 750 },
};

export type FloorPrepSeverity = 'none' | 'light' | 'medium' | 'heavy' | 'extensive';

export type FloorPrepByProductEntry = {
  sqft: number | null;
  severity: FloorPrepSeverity | null;
};

export const FLOOR_PREP_SEVERITY_OPTIONS: Array<{
  id: FloorPrepSeverity;
  label: string;
  level: FloorPrepLevel;
  helper: string;
}> = [
  {
    id: 'none',
    label: 'Not needed',
    level: 0,
    helper: 'Substrate is installation-ready after ordinary demolition cleanup.',
  },
  {
    id: 'light',
    label: 'Light',
    level: 1,
    helper: 'Small patches, fastener holes, isolated scraping, minor low spots, or minor surface correction.',
  },
  {
    id: 'medium',
    label: 'Medium',
    level: 2,
    helper: 'Localized adhesive or thinset residue, spot grinding, patching, limited skim coating, or local leveling.',
  },
  {
    id: 'heavy',
    label: 'Heavy',
    level: 3,
    helper: 'Widespread residue removal, grinding, patching, skim coating, or significant nonstructural substrate correction.',
  },
  {
    id: 'extensive',
    label: 'Extensive',
    level: 4,
    helper: 'Full-area skim coating, standard self-leveling, extensive grinding, or major nonstructural substrate correction.',
  },
];

export const FLOORING_PRODUCT_LABELS: Record<string, string> = {
  carpet: 'Carpet',
  tile: 'Tile',
  lvp: 'LVP',
  laminate: 'Laminate',
  engineered_hardwood: 'Engineered hardwood',
  solid_hardwood: 'Solid hardwood',
  sheet_vinyl_vct: 'Sheet vinyl / VCT',
  unknown: 'Unknown',
};

export function severityToLevel(severity: FloorPrepSeverity | null | undefined): FloorPrepLevel {
  return FLOOR_PREP_SEVERITY_OPTIONS.find((option) => option.id === severity)?.level ?? 2;
}

export function levelToSeverity(level: FloorPrepLevel | null | undefined): FloorPrepSeverity {
  return FLOOR_PREP_SEVERITY_OPTIONS.find((option) => option.level === level)?.id ?? 'medium';
}

export function floorPrepSeverityLabel(severity: FloorPrepSeverity | null | undefined): string {
  const match = FLOOR_PREP_SEVERITY_OPTIONS.find((option) => option.id === severity);
  if (!match) return 'Prep severity not confirmed';
  return severity === 'none' ? 'Not needed' : `${match.label} prep`;
}

export function flooringProductLabel(product: string): string {
  return FLOORING_PRODUCT_LABELS[product] || label(product);
}

export function installSqftForProduct(
  measurementsInput: ScopeMeasurementsInputExtended,
  product: string
): number {
  const measurementKeys: Record<string, keyof ScopeMeasurementsInputExtended> = {
    lvp: 'flooringLvpSqft',
    laminate: 'flooringLaminateSqft',
    engineered_hardwood: 'flooringEngineeredHardwoodSqft',
    solid_hardwood: 'flooringSolidHardwoodSqft',
    tile: 'flooringTileSqft',
    carpet: 'flooringCarpetSqft',
  };
  const key = measurementKeys[product];
  const direct = key ? Number(measurementsInput[key] || 0) : 0;
  const scopeItemId =
    product === 'lvp'
      ? 'flooring_lvp'
      : product === 'laminate'
        ? 'flooring_laminate'
        : product === 'engineered_hardwood'
          ? 'flooring_engineered_hardwood'
          : product === 'solid_hardwood'
            ? 'flooring_solid_hardwood'
            : product === 'tile'
              ? 'tile_flooring'
              : product === 'carpet'
                ? 'flooring_carpet'
                : product === 'sheet_vinyl_vct'
                  ? 'flooring_sheet_vinyl'
                  : null;
  const fallback = Number(
    (measurementsInput.itemQuantities || {})[`floor_install__${product}`]?.quantity ||
      (scopeItemId ? (measurementsInput.itemQuantities || {})[scopeItemId]?.quantity : 0) ||
      0
  );
  return direct || fallback;
}

/** AI-suggested starting severity — contractor must still confirm area + severity. */
export function recommendFloorPrepSeverity(
  product: string,
  measurementsInput: ScopeMeasurementsInputExtended
): FloorPrepSeverity {
  const existingTypes = Array.isArray(measurementsInput.flooringExistingTypes)
    ? measurementsInput.flooringExistingTypes.filter((type) => typeof type === 'string')
    : [];
  if (!existingTypes.length) return 'medium';

  // When multiple existing floors are selected, do not apply the worst
  // condition to every new product. A same-type match is the best available
  // recommendation; otherwise use the new-product default and let the
  // contractor confirm the actual condition.
  const relevantExistingTypes = existingTypes.includes(product)
    ? [product]
    : existingTypes.length === 1
      ? existingTypes
      : [];
  if (!relevantExistingTypes.length) {
    if (product === 'carpet' || product === 'laminate') return 'light';
    if (product === 'tile' || product === 'sheet_vinyl_vct') return 'heavy';
    if (product === 'lvp') {
      return measurementsInput.flooringNewLvpInstallMethod === 'glue_down' ? 'medium' : 'light';
    }
    return 'medium';
  }

  const levels = relevantExistingTypes.map((existingType) =>
    inferFloorPrepLevel(existingType, product, measurementsInput)
  );
  const maxLevel = Math.max(...levels) as FloorPrepLevel;
  return levelToSeverity(maxLevel);
}

function migrateFloorPrepTransitionsToByProduct(
  measurementsInput: ScopeMeasurementsInputExtended
): Record<string, FloorPrepByProductEntry> {
  const selectedProducts = Array.isArray(measurementsInput.flooringProductScope)
    ? measurementsInput.flooringProductScope.filter(
        (type) => typeof type === 'string' && type !== 'unknown' && type !== 'unspecified'
      )
    : [];
  const migrated: Record<string, FloorPrepByProductEntry> = {};
  const transitions = Array.isArray(measurementsInput.floorPrepTransitions)
    ? measurementsInput.floorPrepTransitions
    : [];
  for (const transition of transitions) {
    if (!transition?.newProduct || !selectedProducts.includes(transition.newProduct)) continue;
    migrated[transition.newProduct] = {
      sqft: Number(transition.sqft) > 0 ? Number(transition.sqft) : null,
      severity:
        transition.prepLevel != null
          ? levelToSeverity(transition.prepLevel as FloorPrepLevel)
          : inferFloorPrepLevel(
              transition.existingType,
              transition.newProduct,
              measurementsInput
            ) === 0
            ? 'none'
            : levelToSeverity(
                inferFloorPrepLevel(transition.existingType, transition.newProduct, measurementsInput)
              ),
    };
  }
  return migrated;
}

export function resolveFloorPrepByProduct(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): Record<string, FloorPrepByProductEntry> {
  const selectedProducts = Array.isArray(measurementsInput.flooringProductScope)
    ? measurementsInput.flooringProductScope.filter(
        (type) => typeof type === 'string' && type !== 'unknown' && type !== 'unspecified'
      )
    : [];
  const saved = measurementsInput.floorPrepByProduct || {};
  const merged: Record<string, FloorPrepByProductEntry> = {};
  for (const product of selectedProducts) {
    if (saved[product]) {
      merged[product] = saved[product];
    }
  }
  if (Object.keys(merged).length > 0) return merged;

  const migrated = migrateFloorPrepTransitionsToByProduct(measurementsInput);
  if (Object.keys(migrated).length > 0) return migrated;

  // Legacy single-product fallback: global floorPrepLevel + confirmed total sqft.
  if (selectedProducts.length === 1) {
    const product = selectedProducts[0];
    const sqft = resolveLegacyTotalPrepSqft(measurementsInput, options);
    if (sqft > 0 || measurementsInput.floorPrepLevel != null) {
      return {
        [product]: {
          sqft: sqft > 0 ? sqft : null,
          severity:
            measurementsInput.floorPrepLevel != null
              ? levelToSeverity(measurementsInput.floorPrepLevel as FloorPrepLevel)
              : sqft > 0
                ? recommendFloorPrepSeverity(product, measurementsInput)
                : null,
        },
      };
    }
  }
  return {};
}

function resolveLegacyTotalPrepSqft(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): number {
  const fromField = Number(measurementsInput.floorPrepSqft || 0);
  if (fromField > 0) return fromField;
  const scopeQty = Number((measurementsInput.itemQuantities || {}).floor_prep?.quantity || 0);
  if (scopeQty > 0) return scopeQty;
  const pricingCount = Number(options?.pricingCount || 0);
  if (pricingCount > 0 && isConfirmedPrepQuantitySource(options?.quantitySource)) {
    return pricingCount;
  }
  return 0;
}

export type FloorPrepProductLine = {
  product: string;
  productLabel: string;
  prepArea: number;
  severity: FloorPrepSeverity;
  prepLevel: FloorPrepLevel;
  installArea: number;
};

export function resolveFloorPrepProductLines(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): FloorPrepProductLine[] {
  const byProduct = resolveFloorPrepByProduct(measurementsInput, options);
  return Object.entries(byProduct).map(([product, entry]) => {
    const severity = entry.severity ?? 'medium';
    const prepLevel = severityToLevel(severity);
    const prepArea = Math.max(0, Number(entry.sqft || 0));
    return {
      product,
      productLabel: flooringProductLabel(product),
      prepArea,
      severity,
      prepLevel,
      installArea: installSqftForProduct(measurementsInput, product),
    };
  });
}

function sumConfirmedPrepAreaFromProducts(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): number {
  return resolveFloorPrepProductLines(measurementsInput, options)
    .filter((line) => line.severity !== 'none' && line.prepArea > 0)
    .reduce((sum, line) => sum + line.prepArea, 0);
}

function productLinesReadyForPricing(lines: FloorPrepProductLine[]): boolean {
  if (!lines.length) return false;
  if (lines.every((line) => line.severity === 'none')) return true;
  return lines
    .filter((line) => line.severity !== 'none')
    .every((line) => line.prepArea > 0);
}

function pricedProductLines(
  lines: FloorPrepProductLine[]
): Array<
  FloorPrepProductLine & {
    materialTotal: number;
    laborTotal: number;
    total: number;
    catalogRate: number;
    minimum: number;
  }
> {
  return lines
    .filter((line) => line.severity !== 'none' && line.prepArea > 0)
    .map((line) => {
      const catalog = PREP_CATALOG[line.prepLevel];
      const rawTotal = line.prepArea * catalog.rate;
      const total = rawTotal > 0 ? Math.max(rawTotal, catalog.minimum) : 0;
      const materialTotal = catalog.rate > 0 ? total * (catalog.material / catalog.rate) : 0;
      const laborTotal = Math.max(0, total - materialTotal);
      return {
        ...line,
        catalogRate: catalog.rate,
        minimum: catalog.minimum,
        total,
        materialTotal,
        laborTotal,
      };
    });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FloorPrepPricingOptions = {
  pricingCount?: number | null;
  quantitySource?: string | null;
};

function isConfirmedPrepQuantitySource(source?: string | null): boolean {
  return (
    source === 'notes' ||
    source === 'user_entered' ||
    source === 'calculated_confirmed' ||
    source === 'inferred' ||
    source === 'suggested_prefill'
  );
}

/** Affected prep area from per-product QM entries, scope quantity, or confirmed takeoff. */
export function resolveConfirmedAffectedPrepArea(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): number {
  const fromProducts = sumConfirmedPrepAreaFromProducts(measurementsInput, options);
  if (fromProducts > 0) return fromProducts;

  const fromField = Number(measurementsInput.floorPrepSqft || 0);
  if (fromField > 0) return fromField;

  const scopeEntry = (measurementsInput.itemQuantities || {}).floor_prep;
  const scopeQty = Number(scopeEntry?.quantity || 0);
  if (scopeQty > 0 && isConfirmedPrepQuantitySource(scopeEntry?.quantitySource)) {
    return scopeQty;
  }

  const pricingCount = Number(options?.pricingCount || 0);
  if (pricingCount > 0 && isConfirmedPrepQuantitySource(options?.quantitySource)) {
    return pricingCount;
  }

  return 0;
}

/** Best available ceiling for prep-area sanity checks — never install SF alone. */
function resolveFlooringAreaCeiling(measurementsInput: ScopeMeasurementsInputExtended): number {
  const fromFields = Math.max(
    Number(measurementsInput.floorAreaSqft || 0),
    Number(measurementsInput.flooringSqft || 0),
    Number(measurementsInput.floorDemoSqft || 0)
  );
  const demoTotal = Object.entries(measurementsInput.itemQuantities || {}).reduce((sum, [key, entry]) => {
    if (!key.startsWith('floor_demo__')) return sum;
    const qty = Number(entry?.quantity || 0);
    return qty > 0 ? sum + qty : sum;
  }, 0);
  const products = Array.isArray(measurementsInput.flooringProductScope)
    ? measurementsInput.flooringProductScope.filter((type) => typeof type === 'string')
    : [];
  const installTotal = products.reduce(
    (sum, product) => sum + installSqftForProduct(measurementsInput, product),
    0
  );
  return Math.max(fromFields, demoTotal, installTotal, 0);
}

function distributeConfirmedPrepArea(
  pairs: Array<{ existingType: string; newProduct: string; demoArea: number }>,
  totalPrepArea: number,
  measurementsInput: ScopeMeasurementsInputExtended
): FloorPrepTransitionContext[] {
  const weights = pairs.map((pair) => {
    const install = installSqftForProduct(measurementsInput, pair.newProduct);
    return install > 0 ? install : pair.demoArea;
  });
  // Notes may provide only one confirmed affected-prep total while the
  // flooring types are known but subtype SF is not. Keep pricing visible as a
  // review-only estimate instead of dropping the entire card.
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights = weightSum > 0 ? weights : pairs.map(() => 1);
  const effectiveWeightSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

  let assigned = 0;
  return pairs.map((pair, index) => {
    const prepArea =
      index === pairs.length - 1
        ? Math.max(0, totalPrepArea - assigned)
        : Math.round((totalPrepArea * effectiveWeights[index]) / effectiveWeightSum);
    assigned += prepArea;
    return {
      existingType: pair.existingType,
      newProduct: pair.newProduct,
      demoArea: pair.demoArea,
      prepArea,
      prepLevel:
        measurementsInput.floorPrepLevel != null
          ? (measurementsInput.floorPrepLevel as FloorPrepLevel)
          : inferFloorPrepLevel(pair.existingType, pair.newProduct, measurementsInput),
    };
  });
}

function inferTransitionPairs(measurementsInput: ScopeMeasurementsInputExtended): Array<{
  existingType: string;
  newProduct: string;
  demoArea: number;
}> {
  const existingTypes =
    Array.isArray(measurementsInput.flooringExistingTypes) && measurementsInput.flooringExistingTypes.length
      ? measurementsInput.flooringExistingTypes.filter((type) => typeof type === 'string')
      : ['unknown'];
  const newProducts =
    Array.isArray(measurementsInput.flooringProductScope) && measurementsInput.flooringProductScope.length
      ? measurementsInput.flooringProductScope.filter((type) => typeof type === 'string')
      : ['unspecified'];
  const demoAreasByExistingType = existingTypes
    .map((existingType) => ({
      existingType,
      demoArea: Number(
        (measurementsInput.itemQuantities || {})[`floor_demo__${existingType}`]?.quantity || 0
      ),
    }))
    .filter((entry) => entry.demoArea > 0);

  const knownNewProducts = newProducts.filter(
    (product) => product !== 'unknown' && product !== 'unspecified'
  );
  const typeMatched = knownNewProducts
    .map((newProduct) => {
      if (!existingTypes.includes(newProduct)) return null;
      const demoArea =
        demoAreasByExistingType.find((entry) => entry.existingType === newProduct)?.demoArea || 0;
      return { existingType: newProduct, newProduct, demoArea };
    })
    .filter((transition): transition is { existingType: string; newProduct: string; demoArea: number } =>
      Boolean(transition)
    );

  const matchedExisting = new Set(typeMatched.map((transition) => transition.existingType));
  const matchedNew = new Set(typeMatched.map((transition) => transition.newProduct));
  const remainingExisting = existingTypes
    .filter((existingType) => !matchedExisting.has(existingType))
    .map((existingType) => ({
      existingType,
      demoArea:
        demoAreasByExistingType.find((entry) => entry.existingType === existingType)?.demoArea || 0,
    }));
  const remainingNew = knownNewProducts.filter((product) => !matchedNew.has(product));

  const pairByArea = (
    existingEntries: Array<{ existingType: string; demoArea: number }>,
    newEntries: string[]
  ) => {
    const sortedExisting = [...existingEntries].sort((a, b) => b.demoArea - a.demoArea);
    const sortedNew = [...newEntries].sort(
      (a, b) => installSqftForProduct(measurementsInput, b) - installSqftForProduct(measurementsInput, a)
    );
    if (sortedExisting.length === sortedNew.length) {
      return sortedExisting.map((entry, index) => ({
        existingType: entry.existingType,
        newProduct: sortedNew[index],
        demoArea: entry.demoArea,
      }));
    }
    // Unequal counts: map every remaining existing type onto the best-matching
    // new product (or every new product onto the one remaining existing type).
    if (sortedNew.length === 1) {
      return sortedExisting.map((entry) => ({
        existingType: entry.existingType,
        newProduct: sortedNew[0],
        demoArea: entry.demoArea,
      }));
    }
    if (sortedExisting.length === 1) {
      return sortedNew.map((newProduct) => ({
        existingType: sortedExisting[0].existingType,
        newProduct,
        demoArea: sortedExisting[0].demoArea,
      }));
    }
    const pairCount = Math.min(sortedExisting.length, sortedNew.length);
    return Array.from({ length: pairCount }, (_, index) => ({
      existingType: sortedExisting[index].existingType,
      newProduct: sortedNew[index],
      demoArea: sortedExisting[index].demoArea,
    }));
  };

  // Same-type matches are only safe when every selected existing/new product is covered.
  // Partial matches (carpet+tile → carpet+lvp) must keep the unmatched cross-type pairs,
  // otherwise the entire prep area is dumped onto one demo type and pricing disappears.
  if (typeMatched.length > 0 && remainingExisting.length === 0 && remainingNew.length === 0) {
    return typeMatched;
  }
  if (typeMatched.length > 0 && (remainingExisting.length > 0 || remainingNew.length > 0)) {
    return [...typeMatched, ...pairByArea(remainingExisting, remainingNew)];
  }

  if (knownNewProducts.length === 1) {
    const existingEntries =
      demoAreasByExistingType.length > 0
        ? demoAreasByExistingType
        : existingTypes.map((existingType) => ({ existingType, demoArea: 0 }));
    return existingEntries.map((entry) => ({
      existingType: entry.existingType,
      newProduct: knownNewProducts[0],
      demoArea: entry.demoArea,
    }));
  }
  if (existingTypes.length === 1 && knownNewProducts.length >= 1) {
    const demoArea = demoAreasByExistingType[0]?.demoArea || 0;
    return knownNewProducts.map((newProduct) => ({
      existingType: existingTypes[0],
      newProduct,
      demoArea,
    }));
  }
  if (existingTypes.length > 1 && knownNewProducts.length > 1) {
    return pairByArea(
      existingTypes.map((existingType) => ({
        existingType,
        demoArea:
          demoAreasByExistingType.find((entry) => entry.existingType === existingType)?.demoArea || 0,
      })),
      knownNewProducts
    );
  }
  return [];
}

export function buildFloorPrepPricingContext(
  measurementsInput: ScopeMeasurementsInputExtended,
  options?: FloorPrepPricingOptions
): FloorPrepPricingBuildResult {
  const disclosure = measurementsInput.flooringDemoIncludesSubstratePrep ?? null;
  const overlap = evaluateFlooringDemoPrepOverlap(measurementsInput);
  const productLines = resolveFloorPrepProductLines(measurementsInput, options);
  const pricedLines = pricedProductLines(productLines);
  const affectedArea = pricedLines.reduce((sum, line) => sum + line.prepArea, 0);

  if (disclosure === 'unsure') {
    return {
      ok: false,
      sourceLabel: 'Suggested · National Average · floor prep · Review before bid',
      pricingDetail:
        'Review before bid: confirm whether demolition already includes final substrate preparation before pricing floor prep.',
      blockAutoApply: true,
      reviewBeforeBid: true,
    };
  }

  if (disclosure === 'yes' && !(affectedArea > 0)) {
    return {
      ok: true,
      transitions: [],
      totalPrepArea: 0,
      totalMaterial: 0,
      totalLabor: 0,
      hasReview: false,
      includedInDemo: true,
      summaryLines: [
        'Affected prep area: Included in demo',
        'Prep level: Not needed',
        'Includes: Final substrate preparation included in demolition pricing',
      ],
      pricingDetail:
        'Included in demo\nFinal substrate preparation is included in the demolition price. Add a separate affected prep area only for work outside the demolition scope.',
      sourceLabel: 'Suggested · National Average · floor prep · Included in demo',
      blockAutoApply: false,
    };
  }

  if (productLines.length > 0 && productLines.every((line) => line.severity === 'none')) {
    return {
      ok: true,
      transitions: [],
      totalPrepArea: 0,
      totalMaterial: 0,
      totalLabor: 0,
      hasReview: false,
      includedInDemo: false,
      summaryLines: ['Included prep:', '- Not needed for selected flooring products'],
      pricingDetail: 'Not needed\nNo additional floor preparation after demolition.',
      sourceLabel: 'Suggested · National Average · floor prep',
      blockAutoApply: false,
    };
  }

  if (!productLinesReadyForPricing(productLines)) {
    const hasSelectedProducts =
      Array.isArray(measurementsInput.flooringProductScope) &&
      measurementsInput.flooringProductScope.some(
        (type) => typeof type === 'string' && type !== 'unknown' && type !== 'unspecified'
      );
    if (!hasSelectedProducts && !(resolveConfirmedAffectedPrepArea(measurementsInput, options) > 0)) {
      return {
        ok: false,
        sourceLabel: 'Suggested · National Average · floor prep area required',
        pricingDetail:
          'Enter the affected floor-prep area for each new flooring product. Do not assume the entire flooring area requires additional preparation after demolition.',
        blockAutoApply: true,
      };
    }
    if (hasSelectedProducts) {
      return {
        ok: false,
        sourceLabel: 'Suggested · National Average · floor prep area required',
        pricingDetail:
          'Confirm the affected prep area and severity for each new flooring product before pricing floor prep.',
        blockAutoApply: true,
      };
    }
  }

  if (!(affectedArea > 0)) {
    const legacyArea = resolveConfirmedAffectedPrepArea(measurementsInput, options);
    if (!(legacyArea > 0)) {
      return {
        ok: false,
        sourceLabel: 'Suggested · National Average · floor prep area required',
        pricingDetail:
          'Enter the affected floor-prep area for each new flooring product. Do not assume the entire flooring area requires additional preparation after demolition.',
        blockAutoApply: true,
      };
    }
  }

  if (overlap.blockAutoApply) {
    return {
      ok: false,
      sourceLabel: 'Suggested · National Average · floor prep · Review before bid',
      pricingDetail: overlap.message,
      blockAutoApply: true,
      reviewBeforeBid: true,
    };
  }

  const prepExceedsInstall = pricedLines.some(
    (line) => line.installArea > 0 && line.prepArea > line.installArea + 0.01
  );
  const flooringAreaCeiling = resolveFlooringAreaCeiling(measurementsInput);
  const prepExceedsFlooringArea =
    flooringAreaCeiling > 0 && affectedArea > flooringAreaCeiling + 0.01;

  const pricedTransitions = pricedLines.map((line) => ({
    existingType: '',
    newProduct: line.product,
    demoArea: 0,
    prepArea: line.prepArea,
    prepLevel: line.prepLevel,
    catalogRate: line.catalogRate,
    minimum: line.minimum,
    total: line.total,
    materialTotal: line.materialTotal,
    laborTotal: line.laborTotal,
  }));

  const totalPrepArea = pricedLines.reduce((sum, line) => sum + line.prepArea, 0);
  const totalMaterial = pricedLines.reduce((sum, line) => sum + line.materialTotal, 0);
  const totalLabor = pricedLines.reduce((sum, line) => sum + line.laborTotal, 0);
  const totalPrep = round2(totalMaterial + totalLabor);
  const blendedRate = totalPrepArea > 0 ? round2(totalPrep / totalPrepArea) : 0;

  const hasReview =
    prepExceedsInstall ||
    prepExceedsFlooringArea ||
    pricedLines.some((line) => line.severity === 'extensive') ||
    disclosure === 'unsure';

  const summaryLines = [
    'Included prep:',
    ...pricedLines.map(
      (line) =>
        `- ${line.prepArea.toLocaleString()} SF ${line.productLabel} area — ${floorPrepSeverityLabel(line.severity)}`
    ),
  ];
  const detailLines = [
    ...summaryLines,
    '',
    ...pricedLines.map((line) => {
      const raw = line.prepArea * line.catalogRate;
      const minNote =
        line.total > raw ? ` (minimum $${line.minimum.toLocaleString()} applied)` : '';
      return `${line.prepArea.toLocaleString()} SF ${line.productLabel} prep @ $${line.catalogRate.toFixed(2)}/SF = $${round2(line.total).toLocaleString()}${minNote}`;
    }),
    `Total floor prep = $${totalPrep.toLocaleString()}`,
    `$${blendedRate.toFixed(2)}/SF blended`,
    `Material $${round2(totalMaterial).toLocaleString()} · Labor $${round2(totalLabor).toLocaleString()}`,
    ...(prepExceedsInstall
      ? [
          'Review before bid: at least one prep area exceeds that product’s installation area — confirm the affected prep SF.',
        ]
      : prepExceedsFlooringArea
        ? [
            'Review before bid: total affected prep area is larger than the current flooring area takeoff — confirm after product areas are finalized.',
          ]
        : hasReview
          ? ['Review before bid: confirm affected prep area and substrate condition before bidding.']
          : []),
  ];

  return {
    ok: true,
    transitions: pricedTransitions,
    totalPrepArea,
    totalMaterial,
    totalLabor,
    hasReview,
    includedInDemo: false,
    summaryLines,
    pricingDetail: detailLines.join('\n'),
    sourceLabel: `Suggested · National Average · floor prep${hasReview ? ' · Review before bid' : ''}`,
    blockAutoApply: false,
  };
}

export function evaluateFlooringDemoPrepOverlap(measurementsInput: ScopeMeasurementsInputExtended): {
  hasOverlap: boolean;
  message: string;
  blockAutoApply: boolean;
  overlappingCodes: FlooringDemoPrepWorkCode[];
} {
  const disclosure = measurementsInput.flooringDemoIncludesSubstratePrep ?? null;
  if (disclosure === 'yes' && !(resolveConfirmedAffectedPrepArea(measurementsInput) > 0)) {
    return {
      hasOverlap: true,
      message: FLOORING_DEMO_PREP_OVERLAP_WARNING,
      blockAutoApply: false,
      overlappingCodes: PREP_WORK_CODES,
    };
  }
  if (disclosure === 'unsure') {
    return {
      hasOverlap: true,
      message: FLOORING_DEMO_PREP_OVERLAP_WARNING,
      blockAutoApply: true,
      overlappingCodes: [],
    };
  }

  const productLines = resolveFloorPrepProductLines(measurementsInput).filter(
    (line) => line.severity !== 'none' && line.prepArea > 0
  );
  const existingTypes = Array.isArray(measurementsInput.flooringExistingTypes)
    ? measurementsInput.flooringExistingTypes.filter((type) => typeof type === 'string')
    : [];
  const overlapping = new Set<FlooringDemoPrepWorkCode>();
  for (const line of productLines) {
    const prepLevel = line.prepLevel;
    for (const existingType of existingTypes.length ? existingTypes : ['unknown']) {
      const demoCodes = new Set(
        demoWorkCodesForType(existingType, measurementsInput.flooringExistingLvpInstallMethod)
      );
      for (const code of prepWorkCodesForLevel(prepLevel)) {
        if (demoCodes.has(code)) overlapping.add(code);
      }
    }
  }

  if (disclosure === 'yes' && !(resolveConfirmedAffectedPrepArea(measurementsInput) > 0)) {
    return { hasOverlap: false, message: '', blockAutoApply: false, overlappingCodes: [] };
  }

  return {
    hasOverlap: overlapping.size > 0,
    message: overlapping.size > 0 ? FLOORING_DEMO_PREP_OVERLAP_WARNING : '',
    blockAutoApply: overlapping.size > 0 && disclosure !== 'no',
    overlappingCodes: [...overlapping],
  };
}

export function isCustomFlooringDemoPriceBlock(block: {
  rateSourceLabel?: string | null;
  materialSource?: string | null;
  laborSource?: string | null;
  mode?: string | null;
}): boolean {
  const rateLabel = String(block.rateSourceLabel || '');
  if (/national\s*average/i.test(rateLabel) && block.materialSource === 'national_average') {
    return false;
  }
  return (
    block.materialSource === 'user_entered' ||
    block.laborSource === 'user_entered' ||
    block.materialSource === 'local_benchmark' ||
    block.laborSource === 'local_benchmark' ||
    block.mode === 'user_entered' ||
    !/national\s*average/i.test(rateLabel)
  );
}

export { DEMO_WORK_CODES, PREP_WORK_CODES };
