/**
 * Canonical drywall measurements for plan export, notes, and manual entry.
 *
 * Drywall is an interior wall + ceiling surface quantity. Living area is only
 * a transparent planning fallback; it is never treated as a plan takeoff.
 */

import {
  DRYWALL_INSTALLED_BY_PROJECT,
} from '@/utils/groundUpBarometerLumpPackages';
import { SOUTHERN_UTAH_PLAN_FACTS } from '@/utils/southernUtahPlanFacts';
import { matchSouthernUtahProjectByLivingSf } from '@/utils/southernUtahPaintTrimComparables';

export const DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS = [
  'drywallSqft',
  'drywallWallSqft',
  'drywallCeilingSqft',
  'drywallOpeningDeductionSqft',
  'drywallGarageFireRatedSqft',
  'drywallMoistureResistantSqft',
  'drywallVaultedSlopedSqft',
  'drywallHighCeilingSqft',
  'drywallFinishLevel',
  'drywallSheetLength',
  'drywallStandardBoardType',
  'garageWallDrywallSqft',
  'garageCeilingDrywallSqft',
  'moistureResistantDrywallSqft',
  'fireRatedDrywallSqft',
  'specialtyDrywallSqft',
  'highCeilingDrywallSqft',
  'vaultedCeilingDrywallSqft',
  'level5FinishSqft',
  'floorAreaSqft',
  'garageSqft',
  'storyCount',
  'wallHeightFt',
  'plateHeightFt',
] as const;

export const DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS = [
  'drywallWallSqft',
  'drywallCeilingSqft',
  'garageWallDrywallSqft',
  'garageCeilingDrywallSqft',
  'moistureResistantDrywallSqft',
  'fireRatedDrywallSqft',
  'highCeilingDrywallSqft',
  'vaultedCeilingDrywallSqft',
  'level5FinishSqft',
] as const;

/** Quick measurements plus total/opening fields persisted on scopeMeasurements. */
export const DRYWALL_QUANTITY_KEYS = [
  'drywallSqft',
  'drywallOpeningDeductionSqft',
  ...DRYWALL_PLAN_QUICK_MEASUREMENT_KEYS,
] as const;

export type DrywallQuantityKey = (typeof DRYWALL_QUANTITY_KEYS)[number];

/** Persist drywall quick-measurement fields through Confirm Scope payload round-trips. */
export function copyDrywallQuantityFields(
  source: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null = positiveNumber
): Partial<Record<DrywallQuantityKey, number | null>> {
  const out: Partial<Record<DrywallQuantityKey, number | null>> = {};
  if (!source) return out;
  for (const key of DRYWALL_QUANTITY_KEYS) {
    const parsed = parse(source[key]);
    if (parsed != null) out[key] = parsed;
  }
  const componentTotal = drywallPackageSurfaceFromComponents(source);
  if (componentTotal != null && out.drywallSqft == null) {
    out.drywallSqft = componentTotal;
  }
  return out;
}

export type DrywallMeasurementKey =
  (typeof DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS)[number];

export const DRYWALL_PLAN_ALIASES: Record<string, DrywallMeasurementKey> = {
  drywallSurfaceSqft: 'drywallSqft',
  drywallSurfaceAreaSqft: 'drywallSqft',
  wallCeilingDrywallSqft: 'drywallSqft',
  drywallWallsSqft: 'drywallWallSqft',
  drywallWallSurfaceSqft: 'drywallWallSqft',
  drywallCeilingsSqft: 'drywallCeilingSqft',
  drywallCeilingSurfaceSqft: 'drywallCeilingSqft',
  drywallOpeningsSqft: 'drywallOpeningDeductionSqft',
  drywallGarageSqft: 'drywallGarageFireRatedSqft',
  drywallFireRatedSqft: 'drywallGarageFireRatedSqft',
  drywallMoistureSqft: 'drywallMoistureResistantSqft',
  drywallVaultedSqft: 'drywallVaultedSlopedSqft',
  drywallHighCeilingsSqft: 'drywallHighCeilingSqft',
  garageDrywallWallSqft: 'garageWallDrywallSqft',
  garageDrywallCeilingSqft: 'garageCeilingDrywallSqft',
  drywallMoistureResistantSqft: 'moistureResistantDrywallSqft',
  drywallFireRatedSqft: 'fireRatedDrywallSqft',
  drywallHighCeilingSqft: 'highCeilingDrywallSqft',
  drywallVaultedCeilingSqft: 'vaultedCeilingDrywallSqft',
  drywallLevel5Sqft: 'level5FinishSqft',
};

export const DRYWALL_PLAN_SCOPE_ALLOWLIST = [
  'drywall',
  'hang',
  'finish_tape',
  'texture',
  'patch_repair',
  'demo_removal',
  'finish_level',
  'cleanup',
];

/** Installed drywall assembly split for SHV-matched production planning. */
export const DRYWALL_PRODUCTION_ASSEMBLY_BASELINE = {
  material: 0.68,
  labor: 0.98,
} as const;

export const DRYWALL_PRODUCTION_RATE_CARD_LABEL = 'Production planning rate';

/** Material share of installed gypsum-board package (~41% at SHV production). */
export const DRYWALL_INSTALLED_MATERIAL_SHARE = 0.41;

export const COMPLETE_DRYWALL_ASSEMBLY_LABEL =
  'Complete drywall assembly — hang, mud/tape & finish';

export const COMPLETE_DRYWALL_ASSEMBLY_HELPER =
  'Includes standard gypsum board, fasteners, hanging, mud/tape, sanding, standard finish preparation, orange-peel texture, and normal drywall cleanup.';

/** Remodel split shares — sum to 1.0 when hang + finish are both priced. */
export const DRYWALL_REMODEL_HANG_PACKAGE_SHARE = 0.45;
export const DRYWALL_REMODEL_FINISH_PACKAGE_SHARE = 0.55;

/** True for ground-up and single-trade plan export — one priced complete package. */
export function isDrywallCompletePackageScope(params: {
  templateKey?: string | null;
  planImportMode?: string | null;
  planImportTradeKey?: string | null;
}): boolean {
  const template = String(params.templateKey || '').toLowerCase();
  if (template === 'ground_up') return true;
  return (
    params.planImportMode === 'selected_trade' &&
    params.planImportTradeKey === 'drywall'
  );
}

export function drywallFinishLaborMultiplier(
  choiceId?: string | null
): number {
  const choice = String(choiceId || '').toLowerCase();
  if (choice === 'knockdown') return 1.1;
  if (choice === 'skip_trowel') return 1.23;
  if (choice === 'smooth_level_4') return 1.17;
  if (choice === 'smooth_level_5') return 1.52;
  return 1;
}

const DRYWALL_FINISH_TEXTURE_NAMES: Record<string, string> = {
  orange_peel: 'orange-peel',
  knockdown: 'knockdown',
  skip_trowel: 'skip trowel / hand texture',
  smooth_level_4: 'Level 4 smooth',
  smooth_level_5: 'Level 5 smooth',
  custom_specialty: 'custom / specialty',
};

/** Short finish name for pricing labels and card summaries. */
export function drywallFinishDisplayLabel(choiceId?: string | null): string {
  const choice = String(choiceId || 'orange_peel').toLowerCase();
  return DRYWALL_FINISH_TEXTURE_NAMES[choice] || 'orange-peel';
}

/** Labor bucket label on suggested-pricing split lines. */
export function drywallFinishLaborBucketLabel(
  choiceId?: string | null,
  options?: { scope?: 'complete' | 'finish_tape' }
): string {
  const choice = String(choiceId || 'orange_peel').toLowerCase();
  const textureName = drywallFinishDisplayLabel(choice);
  const prefix =
    options?.scope === 'finish_tape'
      ? 'Tape, mud, finish, and'
      : 'Hang, tape, finish, and';
  return `${prefix} ${textureName} texture labor`;
}

/** Embedded finish picker — persisted on scopeMeasurements.drywallFinishLevel. */
export function resolveDrywallFinishChoiceId(
  measurements?: Record<string, unknown> | null,
  checklistItems?: Array<{ id: string; choiceId?: string | null }> | null
): string {
  const fromMeasurements = String(
    measurements?.drywallFinishLevel || ''
  ).trim();
  if (fromMeasurements && fromMeasurements !== 'unsure') {
    return fromMeasurements;
  }
  const legacy = checklistItems?.find(item => item.id === 'texture')?.choiceId;
  const legacyChoice = String(legacy || '').trim();
  if (legacyChoice && legacyChoice !== 'unsure') return legacyChoice;
  return 'orange_peel';
}

export type DrywallStandardBoardTypeId =
  | 'half_inch_standard'
  | 'five_eighth_standard';

export const DRYWALL_STANDARD_BOARD_CHOICE_OPTIONS: Array<{
  id: DrywallStandardBoardTypeId;
  label: string;
}> = [
  { id: 'half_inch_standard', label: '1/2" standard gypsum — base material' },
  {
    id: 'five_eighth_standard',
    label: '5/8" standard gypsum — +8% material on house board',
  },
];

export function resolveDrywallStandardBoardType(
  measurements?: Record<string, unknown> | null
): DrywallStandardBoardTypeId {
  const stored = String(measurements?.drywallStandardBoardType || '').trim();
  return stored === 'five_eighth_standard'
    ? 'five_eighth_standard'
    : 'half_inch_standard';
}

export type DrywallSheetLengthId = '8ft' | '10ft' | '12ft' | 'unsure';

export const DRYWALL_SHEET_LENGTH_CHOICE_OPTIONS: Array<{
  id: DrywallSheetLengthId;
  label: string;
}> = [
  { id: '8ft', label: '8\' sheets' },
  { id: '10ft', label: '10\' sheets' },
  { id: '12ft', label: '12\' sheets' },
  { id: 'unsure', label: 'Not sure yet' },
];

const DRYWALL_SHEET_LENGTH_LABOR_MULTIPLIERS: Record<
  DrywallSheetLengthId,
  number
> = {
  '8ft': 1,
  '10ft': 1,
  '12ft': 1,
  unsure: 1,
};

/** Longer sheets reduce board $/SF — material only, modest retail-aligned spreads. */
const DRYWALL_SHEET_LENGTH_MATERIAL_MULTIPLIERS: Record<
  DrywallSheetLengthId,
  number
> = {
  '8ft': 1,
  '10ft': 0.98,
  '12ft': 0.96,
  unsure: 1,
};

/** Two-story carry or heavy vaulted/high-ceiling share — labor only. */
export const DRYWALL_DIFFICULT_ACCESS_LABOR_MULTIPLIER = 1.03;

/** Upper floors or complex ceiling work increase handling labor. */
export function hasDifficultDrywallAccess(
  measurements: Record<string, unknown>,
  packageSqft?: number | null
): boolean {
  const stories = positiveNumber(measurements.storyCount);
  if (stories != null && stories >= 2) return true;
  const count =
    positiveNumber(packageSqft) ??
    positiveNumber(measurements.drywallSqft) ??
    0;
  if (!(count > 0)) return false;
  const vaulted = positiveNumber(measurements.vaultedCeilingDrywallSqft) ?? 0;
  const high = positiveNumber(measurements.highCeilingDrywallSqft) ?? 0;
  return (vaulted + high) / count >= 0.2;
}

/** @deprecated Use {@link hasDifficultDrywallAccess}. */
export const hasDifficultDrywallSheetHandlingAccess = hasDifficultDrywallAccess;

export function resolveDrywallSheetLengthChoiceId(
  measurements?: Record<string, unknown> | null,
  options?: { completePackage?: boolean }
): DrywallSheetLengthId {
  const stored = String(measurements?.drywallSheetLength || '').trim();
  if (stored === '8ft' || stored === '10ft' || stored === '12ft') {
    return stored;
  }
  if (stored === 'unsure') return 'unsure';
  return options?.completePackage === false ? '8ft' : '12ft';
}

/** Sheet length is a planning preference — labor stays at base for all lengths. */
export function drywallSheetLengthLaborMultiplier(
  measurements?: Record<string, unknown> | null,
  options?: { packageSqft?: number | null; completePackage?: boolean }
): number {
  const choice = resolveDrywallSheetLengthChoiceId(measurements, {
    completePackage: options?.completePackage,
  });
  return DRYWALL_SHEET_LENGTH_LABOR_MULTIPLIERS[choice] ?? 1;
}

/** Sheet length adjusts board material $/SF only. */
export function drywallSheetLengthMaterialMultiplier(
  measurements?: Record<string, unknown> | null,
  options?: { completePackage?: boolean }
): number {
  const choice = resolveDrywallSheetLengthChoiceId(measurements, {
    completePackage: options?.completePackage,
  });
  return DRYWALL_SHEET_LENGTH_MATERIAL_MULTIPLIERS[choice] ?? 1;
}

/** Story height and difficult access — labor only, independent of sheet length. */
export function drywallAccessLaborMultiplier(
  measurements?: Record<string, unknown> | null,
  packageSqft?: number | null
): number {
  return hasDifficultDrywallAccess(measurements ?? {}, packageSqft)
    ? DRYWALL_DIFFICULT_ACCESS_LABOR_MULTIPLIER
    : 1;
}

function drywallVaultAndHeightLaborMultiplier(
  measurements: Record<string, unknown>,
  packageSqft: number
): number {
  if (!(packageSqft > 0)) return 1;
  const vaultedSloped = Math.min(
    packageSqft,
    positiveNumber(measurements.vaultedCeilingDrywallSqft) ?? 0
  );
  const highCeiling = Math.min(
    packageSqft,
    positiveNumber(measurements.highCeilingDrywallSqft) ?? 0
  );
  const weighted = (area: number, premium: number) =>
    area > 0 ? (area / packageSqft) * premium : 0;
  return (
    1 + weighted(vaultedSloped, 0.1) + weighted(highCeiling, 0.08)
  );
}

export function resolveDrywallPackageMaterialMultiplier(
  measurements: Record<string, unknown>,
  packageSqft: number,
  options?: { planFacts?: Record<string, unknown> | null; completePackage?: boolean }
): number {
  return (
    resolveDrywallBoardMaterialMultiplier(measurements, packageSqft, options) *
    drywallSheetLengthMaterialMultiplier(measurements, {
      completePackage: options?.completePackage,
    })
  );
}

export function resolveDrywallPackageLaborMultiplier(
  measurements: Record<string, unknown>,
  packageSqft: number,
  options?: {
    planFacts?: Record<string, unknown> | null;
    completePackage?: boolean;
    checklistItems?: Array<{ id: string; choiceId?: string | null }> | null;
  }
): number {
  const finishChoice = resolveDrywallFinishChoiceId(
    measurements,
    options?.checklistItems
  );
  return (
    resolveDrywallBoardLaborMultiplier(measurements, packageSqft, options) *
    drywallSheetLengthLaborMultiplier(measurements, {
      packageSqft,
      completePackage: options?.completePackage,
    }) *
    drywallAccessLaborMultiplier(measurements, packageSqft) *
    drywallVaultAndHeightLaborMultiplier(measurements, packageSqft) *
    drywallFinishLaborMultiplier(finishChoice)
  );
}

export type DrywallBoardTypeId =
  | 'half_inch_standard'
  | 'five_eighth_standard'
  | 'five_eighth_type_x'
  | 'half_inch_moisture'
  | 'five_eighth_moisture_fire';

/** Material-only board premiums — 1/2" standard gypsum is the package baseline. */
export const DRYWALL_BOARD_MATERIAL_MULTIPLIERS: Record<
  DrywallBoardTypeId,
  number
> = {
  half_inch_standard: 1,
  five_eighth_standard: 1.08,
  five_eighth_type_x: 1.14,
  half_inch_moisture: 1.1,
  five_eighth_moisture_fire: 1.2,
};

/** Board thickness/type does not adjust labor — finish and site access do. */
export const DRYWALL_BOARD_LABOR_MULTIPLIERS: Record<DrywallBoardTypeId, number> =
  {
    half_inch_standard: 1,
    five_eighth_standard: 1,
    five_eighth_type_x: 1,
    half_inch_moisture: 1,
    five_eighth_moisture_fire: 1,
  };

export type DrywallBoardBucketId =
  | 'house_walls_half_inch'
  | 'house_ceilings_five_eighth'
  | 'garage_rated_type_x'
  | 'moisture_resistant';

export type DrywallBoardBucketDefinition = {
  id: DrywallBoardBucketId;
  measurementKey:
    | 'drywallWallSqft'
    | 'drywallCeilingSqft'
    | 'fireRatedDrywallSqft'
    | 'moistureResistantDrywallSqft';
  boardTypeId: DrywallBoardTypeId;
  title: string;
  helperText: string;
  confirmation: 'suggested' | 'needs_confirmation' | 'optional';
};

export const DRYWALL_BOARD_BUCKET_DEFINITIONS: DrywallBoardBucketDefinition[] = [
  {
    id: 'house_walls_half_inch',
    measurementKey: 'drywallWallSqft',
    boardTypeId: 'half_inch_standard',
    title: '1/2" standard gypsum',
    helperText: 'House walls · suggested from plan',
    confirmation: 'suggested',
  },
  {
    id: 'house_ceilings_five_eighth',
    measurementKey: 'drywallCeilingSqft',
    boardTypeId: 'five_eighth_standard',
    title: '5/8" standard gypsum',
    helperText: 'House ceilings · needs confirmation',
    confirmation: 'needs_confirmation',
  },
  {
    id: 'garage_rated_type_x',
    measurementKey: 'fireRatedDrywallSqft',
    boardTypeId: 'five_eighth_type_x',
    title: '5/8" Type X',
    helperText: 'Garage / rated surfaces · needs confirmation',
    confirmation: 'needs_confirmation',
  },
  {
    id: 'moisture_resistant',
    measurementKey: 'moistureResistantDrywallSqft',
    boardTypeId: 'half_inch_moisture',
    title: '1/2" moisture-resistant',
    helperText: 'Wet-area walls · optional',
    confirmation: 'optional',
  },
];

const DRYWALL_BOARD_TYPE_LABELS: Record<DrywallBoardTypeId, string> = {
  half_inch_standard: '1/2" standard gypsum',
  five_eighth_standard: '5/8" standard gypsum',
  five_eighth_type_x: '5/8" Type X',
  half_inch_moisture: '1/2" moisture-resistant',
  five_eighth_moisture_fire: '5/8" moisture / fire board',
};

export type DrywallBoardMixZone = {
  id: string;
  label: string;
  boardTypeId: DrywallBoardTypeId;
  boardLabel: string;
  sqft: number;
  measurementKey?: DrywallBoardBucketDefinition['measurementKey'];
  helperText?: string;
  confirmation?: DrywallBoardBucketDefinition['confirmation'];
};

function resolvedFireRatedDrywallSqft(
  input: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): number {
  const explicit = positiveNumber(input.fireRatedDrywallSqft);
  if (explicit != null && explicit > 0) return explicit;
  const garage = resolveDrywallGarageSurfaceQuantity(input, options);
  return garage != null && garage > 0 ? garage : 0;
}

/** Read one board-bucket SF from persisted measurements (with garage fallback). */
export function resolveDrywallBoardBucketSqft(
  measurements: Record<string, unknown>,
  bucketId: DrywallBoardBucketId,
  options?: { planFacts?: Record<string, unknown> | null }
): number {
  const planFacts =
    options?.planFacts ??
    (measurements.planFacts as Record<string, unknown> | null | undefined);
  if (bucketId === 'garage_rated_type_x') {
    return rounded(resolvedFireRatedDrywallSqft(measurements, { planFacts }));
  }
  const def = DRYWALL_BOARD_BUCKET_DEFINITIONS.find(row => row.id === bucketId);
  if (!def) return 0;
  return rounded(positiveNumber(measurements[def.measurementKey]) ?? 0);
}

/** Sum board-bucket SF for package total (moisture is a wall subset, not additive). */
export function resolveDrywallBoardBucketPackageTotal(
  measurements: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): number {
  const walls = resolveDrywallBoardBucketSqft(
    measurements,
    'house_walls_half_inch',
    options
  );
  const ceilings = resolveDrywallBoardBucketSqft(
    measurements,
    'house_ceilings_five_eighth',
    options
  );
  const fireRated = resolveDrywallBoardBucketSqft(
    measurements,
    'garage_rated_type_x',
    options
  );
  if (walls > 0 || ceilings > 0 || fireRated > 0) {
    return rounded(walls + ceilings + fireRated);
  }
  return (
    resolveDrywallPackageSurfaceQuantity(measurements, { planFacts: options?.planFacts }) ??
    positiveNumber(measurements.drywallSqft) ??
    0
  );
}

export function syncDrywallPackageTotalFromBoardBuckets(
  measurements: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): Record<string, unknown> {
  const total = resolveDrywallBoardBucketPackageTotal(measurements, options);
  if (!(total > 0)) return measurements;
  return { ...measurements, drywallSqft: total };
}

/** Split the package into board zones for display and material-weighted pricing. */
export function resolveDrywallBoardMix(
  measurements: Record<string, unknown>,
  options?: { packageSqft?: number | null; planFacts?: Record<string, unknown> | null }
): DrywallBoardMixZone[] {
  const planFacts =
    options?.planFacts ??
    (measurements.planFacts as Record<string, unknown> | null | undefined);
  const walls = resolveDrywallBoardBucketSqft(
    measurements,
    'house_walls_half_inch',
    { planFacts }
  );
  const ceilings = resolveDrywallBoardBucketSqft(
    measurements,
    'house_ceilings_five_eighth',
    { planFacts }
  );
  const fireRated = resolveDrywallBoardBucketSqft(
    measurements,
    'garage_rated_type_x',
    { planFacts }
  );
  const moistureRaw = resolveDrywallBoardBucketSqft(
    measurements,
    'moisture_resistant',
    { planFacts }
  );
  const moisture = walls > 0 ? Math.min(walls, moistureRaw) : moistureRaw;
  const halfInchWalls = Math.max(0, walls - moisture);
  const hasLocationSplit = walls > 0 || ceilings > 0 || fireRated > 0;

  const zones: DrywallBoardMixZone[] = [];
  const pushZone = (
    def: DrywallBoardBucketDefinition,
    sqft: number,
    boardTypeId: DrywallBoardTypeId = def.boardTypeId
  ) => {
    if (!(sqft > 0)) return;
    zones.push({
      id: def.id,
      label: def.title,
      boardTypeId,
      boardLabel: DRYWALL_BOARD_TYPE_LABELS[boardTypeId],
      sqft: rounded(sqft),
      measurementKey: def.measurementKey,
      helperText: def.helperText,
      confirmation: def.confirmation,
    });
  };

  if (hasLocationSplit) {
    pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[0], halfInchWalls);
    if (moisture > 0) {
      pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[3], moisture);
    }
    pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[1], ceilings);
    pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[2], fireRated);
    return zones;
  }

  const packageSf =
    positiveNumber(options?.packageSqft) ??
    resolveDrywallPackageSurfaceQuantity(measurements, { planFacts }) ??
    positiveNumber(measurements.drywallSqft) ??
    0;
  if (!(packageSf > 0)) return [];

  const legacyFireRated = Math.min(
    packageSf,
    resolvedFireRatedDrywallSqft(measurements, { planFacts })
  );
  const legacyMoisture = Math.min(
    Math.max(0, packageSf - legacyFireRated),
    positiveNumber(measurements.moistureResistantDrywallSqft) ?? 0
  );
  const legacyStandard = Math.max(0, packageSf - legacyFireRated - legacyMoisture);
  const standardBoardType = resolveDrywallStandardBoardType(measurements);
  if (legacyStandard > 0) {
    zones.push({
      id: 'legacy_standard',
      label: 'House drywall',
      boardTypeId: standardBoardType,
      boardLabel: DRYWALL_BOARD_TYPE_LABELS[standardBoardType],
      sqft: rounded(legacyStandard),
    });
  }
  if (legacyFireRated > 0) {
    pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[2], legacyFireRated);
  }
  if (legacyMoisture > 0) {
    pushZone(DRYWALL_BOARD_BUCKET_DEFINITIONS[3], legacyMoisture);
  }
  return zones;
}

export function resolveDrywallBoardMaterialMultiplier(
  measurements: Record<string, unknown>,
  packageSqft: number,
  options?: { planFacts?: Record<string, unknown> | null }
): number {
  if (!(packageSqft > 0)) return 1;
  const zones = resolveDrywallBoardMix(measurements, {
    packageSqft,
    planFacts: options?.planFacts,
  });
  if (!zones.length) return 1;
  return zones.reduce(
    (sum, zone) =>
      sum +
      (zone.sqft / packageSqft) *
        DRYWALL_BOARD_MATERIAL_MULTIPLIERS[zone.boardTypeId],
    0
  );
}

export function resolveDrywallBoardLaborMultiplier(
  measurements: Record<string, unknown>,
  packageSqft: number,
  options?: { planFacts?: Record<string, unknown> | null }
): number {
  if (!(packageSqft > 0)) return 1;
  const zones = resolveDrywallBoardMix(measurements, {
    packageSqft,
    planFacts: options?.planFacts,
  });
  if (!zones.length) return 1;
  return zones.reduce(
    (sum, zone) =>
      sum +
      (zone.sqft / packageSqft) *
        DRYWALL_BOARD_LABOR_MULTIPLIERS[zone.boardTypeId],
    0
  );
}

/** Infer fire-rated board SF from garage takeoff when the plan did not label it separately. */
export function hydrateDrywallSpecialtyBoardMeasurements(
  measurements: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): Record<string, unknown> {
  const next = { ...measurements };
  const planFacts =
    options?.planFacts ??
    (next.planFacts as Record<string, unknown> | null | undefined);

  if (
    positiveNumber(next.fireRatedDrywallSqft) == null &&
    !PROTECTED_QUANTITY_SOURCES.has(
      quantitySource(next, 'fireRatedDrywallSqft', '')
    )
  ) {
    const garageSf = resolveDrywallGarageSurfaceQuantity(next, { planFacts });
    if (garageSf != null && garageSf > 0) {
      next.fireRatedDrywallSqft = garageSf;
      const sources =
        next.quickMeasurementSources &&
        typeof next.quickMeasurementSources === 'object' &&
        !Array.isArray(next.quickMeasurementSources)
          ? { ...(next.quickMeasurementSources as Record<string, unknown>) }
          : {};
      if (!sources.fireRatedDrywallSqft) {
        sources.fireRatedDrywallSqft = 'inferred_from_garage_takeoff';
        next.quickMeasurementSources = sources;
      }
    }
  }
  return next;
}

/** Split installed assembly pricing for remodel hang vs tape/mud/finish cards. */
export function resolveRemodelDrywallAssemblyBaseline(
  itemId: 'hang' | 'finish_tape',
  options?: { scopeAlone?: boolean }
): { material: number; labor: number; sourceLabel: string } {
  const base = DRYWALL_PRODUCTION_ASSEMBLY_BASELINE;
  const total = base.material + base.labor;
  const alone = options?.scopeAlone === true;
  if (itemId === 'hang') {
    const share = alone ? 0.62 : DRYWALL_REMODEL_HANG_PACKAGE_SHARE;
    const material = roundRate(base.material * (alone ? 0.98 : 0.92));
    const labor = roundRate(Math.max(0, total * share - material));
    return {
      material,
      labor,
      sourceLabel: `${DRYWALL_PRODUCTION_RATE_CARD_LABEL} · hang / board`,
    };
  }
  const share = alone ? 0.55 : DRYWALL_REMODEL_FINISH_PACKAGE_SHARE;
  const material = roundRate(base.material * (alone ? 0.05 : 0.08));
  const labor = roundRate(Math.max(0, total * share - material));
  return {
    material,
    labor,
    sourceLabel: `${DRYWALL_PRODUCTION_RATE_CARD_LABEL} · tape / mud / finish`,
  };
}

const PROTECTED_QUANTITY_SOURCES = new Set([
  'user_entered',
  'manual_override',
  'user_confirmed_suggestion',
  'contractor_confirmed_from_plan_review',
  'plan_verified',
  'plan_detected',
  'plan_vision',
  'calculated_from_components',
  'measured_from_geometry',
]);

function positiveNumber(value: unknown): number | null {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function rounded(value: number): number {
  return Math.round(value);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

type DrywallRoomGeometry = {
  area: number;
  perimeter: number;
};

/** Room footprint from labeled L×W or explicit area (square footprint when only area exists). */
function drywallRoomGeometry(
  room: Record<string, unknown>
): DrywallRoomGeometry | null {
  const length = positiveNumber(room.lengthFt);
  const width = positiveNumber(room.widthFt);
  const areaFromDims =
    length != null && width != null ? length * width : null;
  const area = positiveNumber(room.areaSqft) ?? areaFromDims;
  if (area == null) return null;
  const perimeter =
    length != null && width != null
      ? 2 * (length + width)
      : 4 * Math.sqrt(area);
  return { area, perimeter };
}

function resolveScheduleGarageSqft(
  measurements: Record<string, unknown>,
  planFacts: Record<string, unknown> | null | undefined
): number | null {
  const buildingAreas = planFacts?.buildingAreas as
    | Record<string, unknown>
    | undefined;
  return (
    positiveNumber(measurements.garageSqft) ??
    positiveNumber(buildingAreas?.garageSqft) ??
    null
  );
}

function numberFromMatch(match: RegExpMatchArray | null): number | null {
  return match?.[1] ? positiveNumber(match[1]) : null;
}

function quantitySource(
  input: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const sources = input.quickMeasurementSources;
  if (sources && typeof sources === 'object' && !Array.isArray(sources)) {
    const source = (sources as Record<string, unknown>)[key];
    if (typeof source === 'string' && source) return source;
  }
  const itemQuantities = input.itemQuantities;
  if (
    itemQuantities &&
    typeof itemQuantities === 'object' &&
    !Array.isArray(itemQuantities)
  ) {
    const item = (itemQuantities as Record<string, unknown>)[key];
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const source = (item as Record<string, unknown>).quantitySource;
      if (typeof source === 'string' && source) return source;
    }
  }
  return fallback;
}

/** True when an existing quantity must not be replaced by a planning fallback. */
export function isProtectedDrywallQuantity(
  input: Record<string, unknown>,
  key = 'drywallSqft'
): boolean {
  return PROTECTED_QUANTITY_SOURCES.has(quantitySource(input, key, ''));
}

/**
 * Plan/notes quantities below 2.5× living area are generally floor-area
 * proxies rather than wall + ceiling surfaces. This intentionally matches the
 * existing Plan 39 correction threshold.
 */
export function isUndercountedDrywallSurface(
  drywallSqft: number,
  livingSqft: number | null | undefined
): boolean {
  const living = positiveNumber(livingSqft);
  if (!(drywallSqft > 0) || living == null) return false;
  if (Math.abs(drywallSqft - living) < 0.51) return true;
  return drywallSqft / living < 2.5;
}

export function drywallSurfacePlanningQuantity(
  livingSqft: number | null | undefined
): number | null {
  const living = positiveNumber(livingSqft);
  return living == null ? null : rounded(living * 3.5);
}

/**
 * Resolve a canonical total from explicit wall/ceiling components. Returns
 * null when the plan did not provide enough surface information.
 */
/** Conditioned-house wall + ceiling surface only (excludes garage). */
export function drywallSurfaceFromComponents(
  input: Record<string, unknown>
): number | null {
  const walls =
    positiveNumber(input.drywallWallSqft) ??
    positiveNumber(input.drywallWallsSqft);
  const ceilings =
    positiveNumber(input.drywallCeilingSqft) ??
    positiveNumber(input.drywallCeilingsSqft);
  if (walls == null && ceilings == null) return null;
  return rounded((walls ?? 0) + (ceilings ?? 0));
}

/** Garage wall + ceiling surface when labeled or estimated. */
export function drywallGarageSurfaceFromComponents(
  input: Record<string, unknown>
): number | null {
  const walls = positiveNumber(input.garageWallDrywallSqft);
  const ceilings = positiveNumber(input.garageCeilingDrywallSqft);
  if (walls == null && ceilings == null) return null;
  return rounded((walls ?? 0) + (ceilings ?? 0));
}

/** Complete subcontractor package — house + garage surfaces. */
export function drywallPackageSurfaceFromComponents(
  input: Record<string, unknown>
): number | null {
  const house = drywallSurfaceFromComponents(input);
  const garage = drywallGarageSurfaceFromComponents(input);
  if (house == null && garage == null) return null;
  return rounded((house ?? 0) + (garage ?? 0));
}

function resolveDrywallWallHeightFt(
  planFacts?: Record<string, unknown> | null,
  measurements?: Record<string, unknown>
): number | null {
  return (
    positiveNumber(measurements?.wallHeightFt) ??
    positiveNumber(planFacts?.wallHeightFt) ??
    positiveNumber(planFacts?.plateHeightFt) ??
    positiveNumber(measurements?.plateHeightFt) ??
    null
  );
}

/** Garage drywall SF from components or schedule footprint estimate. */
export function resolveDrywallGarageSurfaceQuantity(
  input: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): number | null {
  const fromComponents = drywallGarageSurfaceFromComponents(input);
  if (fromComponents != null && fromComponents > 0) return fromComponents;

  const planFacts =
    options?.planFacts ??
    (input.planFacts as Record<string, unknown> | null | undefined);
  const scheduleGarage = resolveScheduleGarageSqft(input, planFacts);
  if (scheduleGarage == null || scheduleGarage <= 0) return null;

  const height = resolveDrywallWallHeightFt(planFacts, input) ?? 10;
  const ceiling = scheduleGarage;
  return rounded(ceiling + 4 * Math.sqrt(scheduleGarage) * height);
}

/** Planning fallback for the full house + garage drywall package. */
export function drywallPackageSurfacePlanningQuantity(
  livingSqft: number | null | undefined,
  garageSqft?: number | null,
  wallHeightFt?: number | null
): number | null {
  const house = drywallSurfacePlanningQuantity(livingSqft);
  if (house == null) return null;
  const garage = positiveNumber(garageSqft);
  if (garage == null) return house;
  const height = positiveNumber(wallHeightFt) ?? 10;
  return rounded(house + garage + 4 * Math.sqrt(garage) * height);
}

export const DRYWALL_ROOM_CEILING_COVERAGE_MIN = 0.7;

/** Labeled main + upper living SF when available; otherwise total living / floor area. */
export function resolveConditionedCeilingSqftFromPlan(
  planFacts?: Record<string, unknown> | null,
  measurements?: Record<string, unknown>
): number | null {
  const buildingAreas = planFacts?.buildingAreas as
    | Record<string, unknown>
    | undefined;
  const main = positiveNumber(buildingAreas?.mainFloorLivingSqft);
  const upstairs = positiveNumber(buildingAreas?.upstairsLivingSqft);
  if (main != null || upstairs != null) {
    return roundTenth((main || 0) + (upstairs || 0));
  }
  return (
    positiveNumber(measurements?.floorAreaSqft) ??
    positiveNumber(buildingAreas?.totalLivingSqft) ??
    null
  );
}

/** Total conditioned living floor area for the 3.5× planning multiplier. */
export function resolveLivingFloorSqftFromPlan(
  planFacts?: Record<string, unknown> | null,
  measurements?: Record<string, unknown>
): number | null {
  const buildingAreas = planFacts?.buildingAreas as
    | Record<string, unknown>
    | undefined;
  return (
    positiveNumber(measurements?.floorAreaSqft) ??
    positiveNumber(buildingAreas?.totalLivingSqft) ??
    resolveConditionedCeilingSqftFromPlan(planFacts, measurements)
  );
}

export type ReconcileIncompleteDrywallGeometryResult = {
  measurements: Record<string, unknown>;
  reconciled: boolean;
  assumptions: string[];
  planningEstimateKeys: string[];
};

/**
 * Upgrade partial room-geometry takeoffs to schedule ceiling + planning wall split
 * when readable rooms cover less than a complete house.
 */
export function reconcileIncompleteDrywallGeometryTakeoff(
  input: Record<string, unknown>,
  options?: {
    planFacts?: Record<string, unknown> | null;
    protectedInput?: boolean;
  }
): ReconcileIncompleteDrywallGeometryResult {
  if (options?.protectedInput || isProtectedDrywallQuantity(input)) {
    return {
      measurements: input,
      reconciled: false,
      assumptions: [],
      planningEstimateKeys: [],
    };
  }

  const planFacts =
    options?.planFacts ??
    (input.planFacts as Record<string, unknown> | null | undefined);
  const next = { ...input };
  const assumptions: string[] = [];
  const planningEstimateKeys: string[] = [];
  let reconciled = false;

  const scheduleCeiling = resolveConditionedCeilingSqftFromPlan(planFacts, next);
  const livingFloor = resolveLivingFloorSqftFromPlan(planFacts, next);
  let wall = positiveNumber(next.drywallWallSqft);
  let ceiling = positiveNumber(next.drywallCeilingSqft);

  if (
    scheduleCeiling != null &&
    ceiling != null &&
    ceiling < scheduleCeiling * DRYWALL_ROOM_CEILING_COVERAGE_MIN
  ) {
    assumptions.push(
      `Ceiling drywall upgraded from ${ceiling.toLocaleString()} SF to ${scheduleCeiling.toLocaleString()} SF using labeled main + upper living areas because dimensioned rooms covered less than 70% of the conditioned ceiling footprint.`
    );
    ceiling = scheduleCeiling;
    next.drywallCeilingSqft = scheduleCeiling;
    planningEstimateKeys.push('drywallCeilingSqft');
    reconciled = true;
  }

  const updatedTotal = (wall || 0) + (ceiling || 0);
  const explicitTotal = positiveNumber(next.drywallSqft);
  const surfaceBasis =
    updatedTotal > 0 ? updatedTotal : explicitTotal != null ? explicitTotal : 0;
  if (
    livingFloor != null &&
    (surfaceBasis <= 0 || isUndercountedDrywallSurface(surfaceBasis, livingFloor))
  ) {
    const planningTotal = drywallSurfacePlanningQuantity(livingFloor);
    if (planningTotal != null) {
      const targetCeiling = scheduleCeiling ?? ceiling ?? livingFloor;
      const targetWall = Math.max(wall || 0, planningTotal - targetCeiling);
      if (
        targetWall !== wall ||
        targetCeiling !== ceiling ||
        positiveNumber(next.drywallSqft) !== planningTotal
      ) {
        assumptions.push(
          `House drywall upgraded to a ${planningTotal.toLocaleString()} SF planning split (${targetWall.toLocaleString()} SF walls + ${targetCeiling.toLocaleString()} SF ceilings) because readable room geometry did not cover a complete takeoff.`
        );
        next.drywallWallSqft = roundTenth(targetWall);
        next.drywallCeilingSqft = roundTenth(targetCeiling);
        next.drywallSqft = roundTenth(planningTotal);
        planningEstimateKeys.push(
          'drywallWallSqft',
          'drywallCeilingSqft',
          'drywallSqft'
        );
        reconciled = true;
      }
    }
  } else if (reconciled) {
    next.drywallSqft = roundTenth(
      (positiveNumber(next.drywallWallSqft) || 0) +
        (positiveNumber(next.drywallCeilingSqft) || 0)
    );
    planningEstimateKeys.push('drywallSqft');
  }

  const houseTotal =
    positiveNumber(next.drywallSqft) ??
    drywallSurfaceFromComponents(next);
  const garageTotal = resolveDrywallGarageSurfaceQuantity(next, { planFacts });
  if (houseTotal != null) {
    next.drywallSqft = roundTenth(
      garageTotal != null && garageTotal > 0
        ? houseTotal + garageTotal
        : houseTotal
    );
  }

  return {
    measurements: hydrateDrywallSpecialtyBoardMeasurements(next, { planFacts }),
    reconciled,
    assumptions,
    planningEstimateKeys: [...new Set(planningEstimateKeys)],
  };
}

function resolveDrywallHouseSurfaceQuantity(
  measurements: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): number | null {
  const planFacts =
    options?.planFacts ??
    (measurements.planFacts as Record<string, unknown> | null | undefined);
  const livingFloor = resolveLivingFloorSqftFromPlan(planFacts, measurements);
  const component = drywallSurfaceFromComponents(measurements);
  if (component != null) {
    if (livingFloor == null || !isUndercountedDrywallSurface(component, livingFloor)) {
      return component;
    }
  }
  const explicit = positiveNumber(measurements.drywallSqft);
  if (
    explicit != null &&
    (livingFloor == null || !isUndercountedDrywallSurface(explicit, livingFloor))
  ) {
    return explicit;
  }
  return livingFloor != null ? drywallSurfacePlanningQuantity(livingFloor) : component;
}

/** Resolve conditioned-house drywall SF — never prefer a partial geometry undercount. */
export function resolveDrywallConditionedSurfaceQuantity(
  input: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): number | null {
  const reconciled = reconcileIncompleteDrywallGeometryTakeoff(input, options);
  return resolveDrywallHouseSurfaceQuantity(reconciled.measurements, {
    planFacts:
      options?.planFacts ??
      (reconciled.measurements.planFacts as Record<string, unknown> | null),
  });
}

/**
 * Resolve the complete drywall subcontractor package (house + garage) for pricing.
 * Garage is included when schedule or component takeoff is available.
 */
export function resolveDrywallPackageSurfaceQuantity(
  input: Record<string, unknown>,
  options?: {
    planFacts?: Record<string, unknown> | null;
    includeGarage?: boolean;
  }
): number | null {
  const planFacts =
    options?.planFacts ??
    (input.planFacts as Record<string, unknown> | null | undefined);
  const reconciled = reconcileIncompleteDrywallGeometryTakeoff(input, {
    planFacts,
  });
  const house = resolveDrywallHouseSurfaceQuantity(reconciled.measurements, {
    planFacts,
  });
  if (house == null) return null;
  const living = resolveLivingFloorSqftFromPlan(planFacts, reconciled.measurements);
  const expectedPackage =
    living != null
      ? drywallPackageSurfacePlanningQuantity(
          living,
          resolveScheduleGarageSqft(reconciled.measurements, planFacts)
        )
      : null;
  if (
    expectedPackage != null &&
    Math.abs(house - expectedPackage) / expectedPackage <= 0.1
  ) {
    return house;
  }
  if (
    options?.includeGarage === false ||
    isProtectedDrywallQuantity(reconciled.measurements)
  ) {
    return house;
  }

  const garage = resolveDrywallGarageSurfaceQuantity(
    reconciled.measurements,
    { planFacts }
  );
  return garage != null && garage > 0 ? rounded(house + garage) : house;
}

/** True when the input contains an actual wall/ceiling surface takeoff. */
export function hasDrywallSurfaceComponentTakeoff(
  input: Record<string, unknown>,
  options?: { planFacts?: Record<string, unknown> | null }
): boolean {
  const component = drywallSurfaceFromComponents(input);
  if (component == null) return false;
  const living = resolveConditionedCeilingSqftFromPlan(
    options?.planFacts ??
      (input.planFacts as Record<string, unknown> | null | undefined),
    input
  );
  if (living != null && isUndercountedDrywallSurface(component, living)) {
    return false;
  }
  return true;
}

/**
 * Normalize plan output without manufacturing a quantity from living area.
 * A total is calculated only when wall and/or ceiling surface components are
 * explicitly supplied.
 */
export function normalizeDrywallPlanMeasurements(
  input: Record<string, unknown>
): Record<string, unknown> {
  const aliased = { ...input };
  for (const [alias, canonical] of Object.entries(DRYWALL_PLAN_ALIASES)) {
    if (positiveNumber(aliased[canonical]) != null) continue;
    const value = positiveNumber(aliased[alias]);
    if (value != null) aliased[canonical] = value;
  }

  const out: Record<string, unknown> = {};
  for (const key of DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveNumber(aliased[key]);
    if (value != null) out[key] = value;
  }
  const finishLevel = String(aliased.drywallFinishLevel || '').trim();
  if (finishLevel) out.drywallFinishLevel = finishLevel;
  const sheetLength = String(aliased.drywallSheetLength || '').trim();
  if (sheetLength) out.drywallSheetLength = sheetLength;
  const standardBoard = String(aliased.drywallStandardBoardType || '').trim();
  if (standardBoard) out.drywallStandardBoardType = standardBoard;

  const componentTotal = drywallSurfaceFromComponents(aliased);
  const packageTotal = drywallPackageSurfaceFromComponents(aliased);
  const existingTotal = positiveNumber(out.drywallSqft);
  const shouldUseComponentTotal =
    componentTotal != null &&
    (existingTotal == null ||
      isUndercountedDrywallSurface(
        existingTotal,
        positiveNumber(out.floorAreaSqft)
      )) &&
    !isProtectedDrywallQuantity(aliased);
  if (shouldUseComponentTotal) {
    out.drywallSqft = packageTotal ?? componentTotal;
  }
  return out;
}

/**
 * Small, deliberately conservative notes adapter. It only accepts quantities
 * that are adjacent to drywall/surface language; generic living-area numbers
 * are ignored.
 */
export function parseDrywallMeasurementsFromNotes(
  notes: string
): Record<string, number> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, number> = {};
  const assign = (key: string, value: number | null) => {
    if (value != null && value > 0) out[key] = rounded(value);
  };
  const number = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const unit = '(?:sf|sq\\.?\\s*ft\\.?|sqft|square\\s+feet)';

  assign(
    'drywallWallSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:interior\\s+)?wall(?:s)?\\s+drywall`,
          'i'
        )
      )
    ) ??
      numberFromMatch(
        text.match(
          new RegExp(
            `wall(?:s)?\\s*(?:area\\s*)?(?:is|are|=|:)\\s*${number}\\s*${unit}`,
            'i'
          )
        )
      )
  );
  assign(
    'drywallCeilingSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:interior\\s+)?ceiling(?:s)?\\s+drywall`,
          'i'
        )
      )
    ) ??
      numberFromMatch(
        text.match(
          new RegExp(
            `ceiling(?:s)?\\s*(?:area\\s*)?(?:is|are|=|:)\\s*${number}\\s*${unit}`,
            'i'
          )
        )
      )
  );
  assign(
    'drywallOpeningDeductionSqft',
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:drywall\\s*)?(?:opening|deduction)s?`,
          'i'
        )
      )
    )
  );

  const total =
    numberFromMatch(
      text.match(
        new RegExp(
          `${number}\\s*${unit}\\s*(?:of\\s*)?(?:wall\\s*(?:and|&)\\s*ceiling\\s*)?drywall`,
          'i'
        )
      )
    ) ??
    numberFromMatch(
      text.match(
        new RegExp(
          `drywall(?:\\s+(?:surface|area))?\\s*(?:is|=|:)\\s*${number}\\s*${unit}`,
          'i'
        )
      )
    );
  assign('drywallSqft', total);

  const componentTotal = drywallSurfaceFromComponents(out);
  if (out.drywallSqft == null && componentTotal != null) {
    out.drywallSqft = componentTotal;
  }
  return out;
}

export type DrywallStructuredMeasurements = {
  drywallScope?: string[] | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

/** Derive wall/ceiling/garage component SF from dimensioned rooms when the takeoff only has a total. */
export function hydrateDrywallComponentMeasurementsFromPlanContext(
  measurements: Record<string, unknown>,
  rooms: unknown,
  planFacts: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const next = { ...measurements };
  const height =
    positiveNumber(planFacts?.wallHeightFt) ??
    positiveNumber(planFacts?.plateHeightFt) ??
    positiveNumber(planFacts?.ceilingHeightFt);
  const roomList = Array.isArray(rooms) ? rooms : [];
  const conditioned = roomList
    .filter(
      (room: Record<string, unknown>) =>
        !/\bgarage\b|\brv\s*garage\b|patio|porch|deck|attic|unfinished|mechanical/i.test(
          String(room?.name || '')
        )
    )
    .map((room: Record<string, unknown>) => drywallRoomGeometry(room))
    .filter(Boolean) as DrywallRoomGeometry[];
  const garages = roomList
    .filter((room: Record<string, unknown>) =>
      /\bgarage\b|\brv\s*garage\b/i.test(String(room?.name || ''))
    )
    .map((room: Record<string, unknown>) => drywallRoomGeometry(room))
    .filter(Boolean) as DrywallRoomGeometry[];

  if (
    positiveNumber(next.drywallWallSqft) == null &&
    height != null &&
    conditioned.length > 0
  ) {
    next.drywallWallSqft = roundTenth(
      conditioned.reduce((sum, room) => sum + room.perimeter * height, 0)
    );
  }
  if (positiveNumber(next.drywallCeilingSqft) == null && conditioned.length > 0) {
    next.drywallCeilingSqft = roundTenth(
      conditioned.reduce((sum, room) => sum + room.area, 0)
    );
  }
  if (positiveNumber(next.garageCeilingDrywallSqft) == null && garages.length > 0) {
    next.garageCeilingDrywallSqft = roundTenth(
      garages.reduce((sum, room) => sum + room.area, 0)
    );
  }
  if (
    positiveNumber(next.garageWallDrywallSqft) == null &&
    height != null &&
    garages.length > 0
  ) {
    next.garageWallDrywallSqft = roundTenth(
      garages.reduce((sum, room) => sum + room.perimeter * height, 0)
    );
  }

  const scheduleGarage = resolveScheduleGarageSqft(next, planFacts);
  if (
    positiveNumber(next.garageCeilingDrywallSqft) == null &&
    scheduleGarage != null
  ) {
    next.garageCeilingDrywallSqft = roundTenth(scheduleGarage);
  }
  if (
    positiveNumber(next.garageWallDrywallSqft) == null &&
    scheduleGarage != null &&
    height != null
  ) {
    next.garageWallDrywallSqft = roundTenth(4 * Math.sqrt(scheduleGarage) * height);
  }

  const wall = positiveNumber(next.drywallWallSqft);
  const ceiling = positiveNumber(next.drywallCeilingSqft);
  const packageTotal = drywallPackageSurfaceFromComponents(next);
  if (packageTotal != null) {
    next.drywallSqft = roundTenth(packageTotal);
  } else if (wall != null || ceiling != null) {
    next.drywallSqft = roundTenth((wall || 0) + (ceiling || 0));
  }
  return hydrateDrywallSpecialtyBoardMeasurements(
    reconcileIncompleteDrywallGeometryTakeoff(next, { planFacts }).measurements,
    { planFacts }
  );
}

export function buildDrywallStructuredMeasurements(
  input: Record<string, unknown>,
  quantitySource = 'user_entered'
): DrywallStructuredMeasurements {
  const reconciled = reconcileIncompleteDrywallGeometryTakeoff(input, {
    planFacts: input.planFacts as Record<string, unknown> | null | undefined,
  });
  const normalized = normalizeDrywallPlanMeasurements(reconciled.measurements);
  const total =
    resolveDrywallPackageSurfaceQuantity(reconciled.measurements, {
      planFacts: input.planFacts as Record<string, unknown> | null | undefined,
    }) ?? positiveNumber(normalized.drywallSqft);
  if (total == null) return {};

  const living = resolveLivingFloorSqftFromPlan(
    input.planFacts as Record<string, unknown> | null | undefined,
    reconciled.measurements
  );
  const houseTotal = resolveDrywallHouseSurfaceQuantity(
    reconciled.measurements,
    {
      planFacts: input.planFacts as Record<string, unknown> | null | undefined,
    }
  );
  const planningHouseTotal =
    living != null ? drywallSurfacePlanningQuantity(living) : null;
  const usesPlanningSplit =
    reconciled.reconciled ||
    (planningHouseTotal != null &&
      houseTotal === planningHouseTotal &&
      positiveNumber(normalized.drywallCeilingSqft) ===
        resolveConditionedCeilingSqftFromPlan(
          input.planFacts as Record<string, unknown> | null | undefined,
          reconciled.measurements
        ));

  const resolvedSource = usesPlanningSplit
    ? quantitySource === 'user_entered'
      ? 'user_entered'
      : 'needs_confirmation'
    : quantitySource;

  return {
    drywallScope: ['drywall'],
    itemQuantities: {
      drywall: {
        quantity: total,
        unit: 'sqft',
        quantitySource: resolvedSource,
      },
    },
  };
}

export type DrywallProductionAssemblyBaseline = {
  material: number;
  labor: number;
  sourceLabel: string;
  barometerTotal?: number;
  impliedUnitRate?: number;
};

/** Derive installed $/SF from SHV gypsum-board lump when living SF matches a barometer plan. */
export function resolveDrywallProductionAssemblyBaseline(params: {
  livingSf?: number | null;
  packageSurfaceSqft?: number | null;
}): DrywallProductionAssemblyBaseline {
  const packageSf = positiveNumber(params.packageSurfaceSqft);
  const project = matchSouthernUtahProjectByLivingSf(params.livingSf);
  if (project && packageSf != null) {
    const expectedPackage = drywallPackageSurfacePlanningQuantity(
      project.livingSf,
      SOUTHERN_UTAH_PLAN_FACTS[project.id]?.buildingAreas.garageSqft ?? null
    );
    const matchesBarometerPackage =
      expectedPackage != null &&
      Math.abs(packageSf - expectedPackage) / expectedPackage <= 0.1;
    if (matchesBarometerPackage) {
      const lump = DRYWALL_INSTALLED_BY_PROJECT[project.id];
      const material = roundRate(
        (lump * DRYWALL_INSTALLED_MATERIAL_SHARE) / packageSf
      );
      const labor = roundRate(
        (lump * (1 - DRYWALL_INSTALLED_MATERIAL_SHARE)) / packageSf
      );
      return {
        material,
        labor,
        sourceLabel: `${DRYWALL_PRODUCTION_RATE_CARD_LABEL} · ${project.label} gypsum board benchmark`,
        barometerTotal: lump,
        impliedUnitRate: roundRate(lump / packageSf),
      };
    }
  }

  return {
    material: DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.material,
    labor: DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.labor,
    sourceLabel: `${DRYWALL_PRODUCTION_RATE_CARD_LABEL} · Southern Utah production baseline`,
  };
}

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
}
