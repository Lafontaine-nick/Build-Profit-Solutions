import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { ELECTRICAL_PRICING_OWNERSHIP } from '@/utils/subcontractorTrade/electricalPricingOwnership';

export const ADDITION_CONVERSION_PROJECT_TYPES = new Set([
  'garage_conversion',
  'room_addition',
  'home_addition',
  'addition',
  'adu',
]);

export const ADDITION_CONVERSION_NOTES =
  /\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage|(?:convert(?:ing)?|conversion\s+of)\s+(?:an?\s+)?(?:existing\s+)?(?:room|bedroom|basement|attic|bonus\s+room|office|studio|shop|storage)|room\s+conversion|basement\s+conversion|attic\s+conversion|room\s+addition|home\s+addition|bedroom\s+addition|casita|\badu\b|accessory\s+dwelling|in[\s-]?law\s+suite|add(?:ition)?\s+(?:a\s+)?(?:new\s+)?(?:room|bedroom|bathroom|suite)|(?:new|add)\s+\d[\d,]*\s*sq\.?\s*ft\s+(?:room|addition|bedroom))\b/i;

const GARAGE_CONVERSION_NOTES =
  /\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage)\b/i;

/** Room/garage/basement conversions that reuse an existing shell — not new construction. */
const EXISTING_SHELL_CONVERSION_NOTES =
  /\b(?:garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage|(?:convert(?:ing)?|conversion\s+of)\s+(?:an?\s+)?(?:existing\s+)?(?:room|bedroom|basement|attic|bonus\s+room|office|studio|shop|storage|garage)|room\s+conversion|basement\s+conversion|attic\s+conversion)\b/i;

/** Physical new structure — room/home addition, detached ADU/casita, etc. */
const NEW_STRUCTURE_ADDITION_NOTES =
  /\b(?:room\s+addition|home\s+addition|bedroom\s+addition|(?:add|adding)\s+(?:a\s+)?(?:new\s+)?(?:room|bedroom|bathroom|suite|wing)|(?:new|add)\s+\d[\d,]*\s*sq\.?\s*ft\s+(?:room|addition|bedroom)|detached\s+(?:adu|casita|guest\s+house)|accessory\s+dwelling\s+unit)\b/i;

const NEW_STRUCTURE_ADDITION_PROJECT_TYPES = new Set([
  'room_addition',
  'home_addition',
  'adu',
]);

const CONVERSION_WALL_HEIGHT_FT = 8;

export function detectAdditionConversionIntent(
  projectType?: string | null,
  notes?: string | null
): boolean {
  const pt = String(projectType || '').toLowerCase();
  if (ADDITION_CONVERSION_PROJECT_TYPES.has(pt)) return true;
  return ADDITION_CONVERSION_NOTES.test(String(notes || ''));
}

export function isAdditionConversionJob(
  templateKey?: string | null,
  projectType?: string | null,
  notes?: string | null
): boolean {
  if (String(templateKey || '').toLowerCase() !== 'addition') return false;
  const pt = String(projectType || '').toLowerCase();
  if (ADDITION_CONVERSION_PROJECT_TYPES.has(pt)) return true;
  return ADDITION_CONVERSION_NOTES.test(String(notes || ''));
}

export function isGarageConversionJob(
  projectType?: string | null,
  notes?: string | null
): boolean {
  const pt = String(projectType || '').toLowerCase();
  if (pt === 'garage_conversion') return true;
  return GARAGE_CONVERSION_NOTES.test(String(notes || ''));
}

/** New room/home addition or detached ADU — full shell framing, not partition walls only. */
export function isNewStructureAdditionJob(
  projectType?: string | null,
  notes?: string | null
): boolean {
  const pt = String(projectType || '').toLowerCase();
  const n = String(notes || '');
  // Notes describing an existing shell take precedence over a broad project
  // type such as room_addition or ADU.
  if (EXISTING_SHELL_CONVERSION_NOTES.test(n)) return false;
  if (pt === 'garage_conversion') return false;
  if (NEW_STRUCTURE_ADDITION_PROJECT_TYPES.has(pt)) return true;
  return NEW_STRUCTURE_ADDITION_NOTES.test(n) || pt === 'addition';
}

/** Garage/room/basement conversion in an existing shell — interior wall framing only. */
export function isExistingShellConversionJob(
  templateKey?: string | null,
  projectType?: string | null,
  notes?: string | null
): boolean {
  if (!isAdditionConversionJob(templateKey, projectType, notes)) return false;
  return !isNewStructureAdditionJob(projectType, notes);
}

/**
 * Finish-out conversions/remodels in an existing shell (no new structure).
 * Same workflow for garage, bonus room, basement, and attic conversions on the addition template.
 */
export function existingShellConversionUsesPackageElectrical(
  templateKey?: string | null,
  projectType?: string | null,
  notes?: string | null
): boolean {
  return isExistingShellConversionJob(templateKey, projectType, notes);
}

/** True when notes explicitly call for new/replaced window or exterior door openings. */
export function notesExplicitlyAddOpenings(notes?: string | null): boolean {
  return /\b(?:new|add|install|replace)\b[^.]{0,40}\b(?:window|exterior\s+door|sliding\s+door|entry\s+door|patio\s+door)\b/i.test(
    String(notes || '')
  );
}

const EXISTING_SHELL_PACKAGE_ELECTRICAL_ITEM_IDS = new Set([
  'electrical',
  'electrical_trim',
  ...Object.keys(ELECTRICAL_PRICING_OWNERSHIP),
  'electrical_recessed_light',
  'electrical_standard_receptacle',
  'electrical_gfci_receptacle',
  'electrical_exterior_receptacle',
  'electrical_single_pole_switch',
  'electrical_three_way_switch',
  'electrical_four_way_switch',
  'electrical_ceiling_fan',
  'electrical_main_panel',
  'electrical_sub_panel',
  'electrical_service_upgrade',
  'electrical_circuit_30a',
  'electrical_circuit_40a',
  'electrical_circuit_50a',
  'electrical_circuit_60a_plus',
  'electrical_dedicated_20a',
  'electrical_disposal_hookup',
  'electrical_dishwasher_hookup',
  'electrical_microwave_hookup',
  'electrical_refrigerator_hookup',
  'electrical_range_hookup',
  'electrical_dryer_hookup',
  'electrical_water_heater_hookup',
  'electrical_ev_charger_hookup',
  'electrical_hvac_hookup',
  'electrical_conduit',
  'electrical_trenching',
]);

const EXISTING_SHELL_ELECTRICAL_MEASUREMENT_KEYS = [
  'recessedLightCount',
  'standardReceptacleCount',
  'gfciReceptacleCount',
  'exteriorReceptacleCount',
  'singlePoleSwitchCount',
  'threeWaySwitchCount',
  'fourWaySwitchCount',
  'ceilingFanCount',
  'mainPanelCount',
  'subPanelCount',
  'hvacHookupCount',
  'rangeHookupCount',
  'dryerHookupCount',
  'dishwasherHookupCount',
  'disposalHookupCount',
  'microwaveHookupCount',
  'refrigeratorHookupCount',
  'waterHeaterHookupCount',
  'evChargerHookupCount',
] as const;

const EXISTING_SHELL_SINGLE_PAINT_ITEM_IDS = [
  'interior_paint',
  'prep',
  'paint_trim',
  'ceiling_paint',
  'trim_paint',
] as const;

function readPositiveMeasurementCount(
  input: Record<string, unknown>,
  fieldKey: string,
  itemId: string
): number {
  const fromField = Number(input[fieldKey]);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const itemQuantities = (input.itemQuantities || {}) as Record<
    string,
    { quantity?: unknown }
  >;
  const fromQty = Number(itemQuantities[itemId]?.quantity);
  if (Number.isFinite(fromQty) && fromQty > 0) return fromQty;
  return 0;
}

export type ExistingShellConversionElectricalBreakdown = {
  lights: number;
  lightCircuits: number;
  receptacles: number;
  receptacleCircuits: number;
  switches: number;
  switchCircuits: number;
  dedicatedHookups: number;
  total: number;
};

/** Display-only explanation for the package circuit count on Confirm Scope. */
export function existingShellConversionElectricalBreakdown(
  input: Record<string, unknown>
): ExistingShellConversionElectricalBreakdown {
  const lights = readPositiveMeasurementCount(
    input,
    'recessedLightCount',
    'electrical_recessed_light'
  );
  const standard = readPositiveMeasurementCount(
    input,
    'standardReceptacleCount',
    'electrical_standard_receptacle'
  );
  const gfci = readPositiveMeasurementCount(
    input,
    'gfciReceptacleCount',
    'electrical_gfci_receptacle'
  );
  const receptacles = standard + gfci;
  const switches =
    readPositiveMeasurementCount(
      input,
      'singlePoleSwitchCount',
      'electrical_single_pole_switch'
    ) +
    readPositiveMeasurementCount(
      input,
      'threeWaySwitchCount',
      'electrical_three_way_switch'
    );
  let dedicatedHookups = 0;
  for (const [itemId, owner] of Object.entries(ELECTRICAL_PRICING_OWNERSHIP)) {
    dedicatedHookups += readPositiveMeasurementCount(
      input,
      owner.measurementKey,
      itemId
    );
  }
  const lightCircuits = lights > 0 ? Math.max(1, Math.ceil(lights / 6)) : 0;
  const receptacleCircuits =
    receptacles > 0 ? Math.max(1, Math.ceil(receptacles / 8)) : 0;
  const switchCircuits = switches > 0 ? Math.max(1, Math.ceil(switches / 10)) : 0;
  return {
    lights,
    lightCircuits,
    receptacles,
    receptacleCircuits,
    switches,
    switchCircuits,
    dedicatedHookups,
    total: lightCircuits + receptacleCircuits + switchCircuits + dedicatedHookups,
  };
}

/** Planning circuit count rolled into Rough electrical — not separate device line items. */
export function estimateExistingShellConversionRoughCircuits(
  input: Record<string, unknown>
): number | null {
  const breakdown = existingShellConversionElectricalBreakdown(input);
  return breakdown.total > 0 ? breakdown.total : null;
}

/** True when drywall SF looks like a whole-home multiplier, not conversion shell surface. */
export function isMistakenConversionWholeHomeDrywall(
  floorSqft: number | null | undefined,
  drywallSqft: number | null | undefined
): boolean {
  const floor = Number(floorSqft);
  const drywall = Number(drywallSqft);
  if (!(Number.isFinite(floor) && floor > 0 && Number.isFinite(drywall) && drywall > 0)) {
    return false;
  }
  const shell = conversionDrywallSurfaceSqft(floor);
  const wholeHome = Math.round(floor * 3.5);
  if (Math.abs(drywall - shell) < 1) return false;
  return Math.abs(drywall - wholeHome) < 1 || drywall / floor >= 3.2;
}

type MeasurementSeedInput = Record<string, unknown> & {
  itemQuantities?: Record<string, { quantity?: unknown; unit?: unknown; quantitySource?: string }>;
  quickMeasurementUserOverrides?: Record<string, boolean>;
  quickMeasurementSources?: Record<string, string>;
};

function measurementFieldUserLocked(
  input: MeasurementSeedInput,
  key: string
): boolean {
  return Boolean(input.quickMeasurementUserOverrides?.[key]);
}

/** One paint card, package electrical, and shell-surface drywall for existing-shell conversions. */
export function consolidateExistingShellConversionMeasurements<
  T extends MeasurementSeedInput,
>(
  input: T,
  options: {
    templateKey?: string | null;
    projectType?: string | null;
    notes?: string | null;
  } = {}
): T {
  if (
    !existingShellConversionUsesPackageElectrical(
      options.templateKey,
      options.projectType,
      options.notes
    )
  ) {
    return input;
  }

  let next: MeasurementSeedInput = { ...input };
  const itemQuantities = { ...(next.itemQuantities || {}) };
  const notes = String(options.notes || '');

  const roughStored = itemQuantities.electrical_rough;
  const roughUserLocked =
    roughStored?.quantitySource === 'user_entered' ||
    roughStored?.quantitySource === 'manual_override' ||
    measurementFieldUserLocked(next, 'electrical_rough');
  const inferredCircuits = roughUserLocked
    ? null
    : estimateExistingShellConversionRoughCircuits(input);

  for (const id of EXISTING_SHELL_PACKAGE_ELECTRICAL_ITEM_IDS) {
    delete itemQuantities[id];
    delete itemQuantities[`${id}__material`];
    delete itemQuantities[`${id}__labor`];
    delete itemQuantities[`${id}__allowance`];
  }
  for (const key of EXISTING_SHELL_ELECTRICAL_MEASUREMENT_KEYS) {
    if (!measurementFieldUserLocked(next, key)) {
      next = { ...next, [key]: '' };
    }
  }
  delete itemQuantities.electrical_trim;
  delete itemQuantities.electrical_trim__material;
  delete itemQuantities.electrical_trim__labor;
  delete itemQuantities.electrical_trim__allowance;

  if (!roughUserLocked && inferredCircuits != null) {
    itemQuantities.electrical_rough = {
      quantity: inferredCircuits,
      unit: 'each',
      quantitySource: 'inferred',
    };
  }

  for (const id of EXISTING_SHELL_SINGLE_PAINT_ITEM_IDS) {
    delete itemQuantities[id];
    delete itemQuantities[`${id}__material`];
    delete itemQuantities[`${id}__labor`];
    delete itemQuantities[`${id}__allowance`];
  }

  const primarySf = conversionPrimaryFloorSqft(next);
  if (
    primarySf != null &&
    !measurementFieldUserLocked(next, 'drywallSqft') &&
    isMistakenConversionWholeHomeDrywall(primarySf, Number(next.drywallSqft))
  ) {
    next = { ...next, drywallSqft: '' };
    delete itemQuantities.drywall;
    delete itemQuantities.drywall__material;
    delete itemQuantities.drywall__labor;
  }

  if (
    primarySf != null &&
    !measurementFieldUserLocked(next, 'wallPaintSqft') &&
    isMistakenConversionWholeHomeDrywall(primarySf, Number(next.wallPaintSqft))
  ) {
    next = { ...next, wallPaintSqft: '' };
    delete itemQuantities.paint;
    delete itemQuantities.interior_paint;
  }

  if (
    !notesExplicitlyAddOpenings(notes) &&
    !measurementFieldUserLocked(next, 'windowCount') &&
    !measurementFieldUserLocked(next, 'exteriorDoorCount') &&
    !measurementFieldUserLocked(next, 'slidingDoorCount')
  ) {
    next = {
      ...next,
      windowCount: '',
      exteriorDoorCount: '',
      slidingDoorCount: '',
    };
    delete itemQuantities.windows_doors;
    delete itemQuantities.windows;
  }

  next.itemQuantities = itemQuantities;
  return next as T;
}

type FloorAreaInput = {
  floorAreaSqft?: string | number | null;
  garageSqft?: string | number | null;
};

/** Primary conditioned SF for a conversion/addition — never double-count garage + living. */
export function conversionPrimaryFloorSqft(input: FloorAreaInput): number | null {
  const living = Number(input.floorAreaSqft);
  const garage = Number(input.garageSqft);
  if (Number.isFinite(living) && living > 0) return living;
  if (Number.isFinite(garage) && garage > 0) return garage;
  return null;
}

/** Approximate net wall insulation SF for a single-room conversion shell. */
export function conversionWallInsulationSqft(floorSqft: number): number {
  const side = Math.sqrt(Math.max(floorSqft, 1));
  const perimeter = side * 4;
  const grossWalls = perimeter * CONVERSION_WALL_HEIGHT_FT;
  return Math.round(grossWalls * 0.85);
}

/** Interior partition / fur-out stud runs for a single-box conversion shell. */
export function conversionWallFramingLf(floorSqft: number): number {
  const side = Math.sqrt(Math.max(floorSqft, 1));
  const perimeter = side * 4;
  return Math.round(perimeter * 0.85);
}

export function notesExplicitlyRequestInteriorWallFraming(
  notes?: string | null
): boolean {
  return /\b(?:frame|framing|studs?|partition(?:s)?|fur[-\s]?out)\b/i.test(
    String(notes || '')
  );
}

/**
 * Drywall / interior paint surface for a single-box conversion (garage, studio, ADU shell).
 * Ceiling SF + interior wall faces from footprint perimeter — not the 3.5× whole-home multiplier.
 */
export function conversionDrywallSurfaceSqft(floorSqft: number): number {
  const side = Math.sqrt(Math.max(floorSqft, 1));
  const perimeter = side * 4;
  const ceiling = floorSqft;
  const wallFaces = perimeter * CONVERSION_WALL_HEIGHT_FT * 0.85;
  return Math.round(ceiling + wallFaces);
}

/** True when parsed drywall SF is just the conditioned floor area, not a surface takeoff. */
export function isMistakenConversionFloorAreaDrywall(
  floorSqft: number | null | undefined,
  drywallSqft: number | null | undefined
): boolean {
  const floor = Number(floorSqft);
  const drywall = Number(drywallSqft);
  if (!(Number.isFinite(floor) && floor > 0 && Number.isFinite(drywall) && drywall > 0)) {
    return false;
  }
  return Math.abs(drywall - floor) < 0.51;
}

/** Avoid duplicate phase paint when prep + walls cards already carry pricing. */
export function suppressAdditionConversionPhasePaintDuplicate(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'addition') return items;
  const prepIncluded = items.some(
    row => row.id === 'prep' && row.state === 'included'
  );
  const wallsIncluded = items.some(
    row =>
      (row.id === 'interior_paint' || row.id === 'paint_trim') &&
      row.state === 'included'
  );
  if (!prepIncluded || !wallsIncluded) return items;
  let changed = false;
  const next = items.map(row => {
    if (row.id !== 'paint' || row.state === 'excluded') return row;
    changed = true;
    return { ...row, state: 'excluded' as const };
  });
  return changed ? next : items;
}
