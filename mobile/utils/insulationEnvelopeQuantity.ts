/**
 * Thermal-envelope insulation quantity (not drywall wall+ceiling surface).
 *
 * Primary planning model:
 *   exterior walls (perimeter × height × stories)
 *   + conditioned attic/ceiling footprint (explicit or clearly labeled suggestion)
 *   − opening deduction on exterior walls only
 *
 * Interior partitions are excluded. Garage insulation is excluded unless
 * explicitly provided. Attic floor and roof-deck are not both added.
 */

import type { PlanFacts } from '@/utils/planMeasurementFacts';
import type { InsulationAssembly } from '@/utils/estimateAiDraft';

export const INSULATION_DEFAULT_WALL_HEIGHT_FT = 9;
export const INSULATION_DEFAULT_OPENINGS_PERCENT = 15;
/** Fallback when perimeter is unknown — square living footprint only (not drywall 3.5×). */
export const INSULATION_PERIMETER_FROM_LIVING_FACTOR = 4;

export type InsulationEnvelopeComponentKey =
  | 'exteriorWallInsulationSqft'
  | 'atticInsulationSqft'
  | 'insulatedRoofDeckSqft'
  | 'floorInsulationSqft'
  | 'garageSeparationInsulationSqft'
  | 'insulatedGarageWallSqft'
  | 'insulatedGarageCeilingSqft'
  | 'openingDeductionSqft';

export type InsulationEnvelopeComponent = {
  key: InsulationEnvelopeComponentKey;
  label: string;
  quantity: number;
  unit: 'sqft';
  source: InsulationEnvelopeSource;
  confidence: 'low' | 'medium' | 'high';
  included: boolean;
  formula?: string;
  contractorConfirmationRequired?: boolean;
};

export type InsulationEnvelopeSource =
  | 'detected_from_plan'
  | 'parsed_from_notes'
  | 'calculated_from_plan'
  | 'contractor_entered'
  | 'planning_assumption';

export type InsulationEnvelopePlanningResult = {
  totalInsulationEnvelopeSqft: number;
  components: InsulationEnvelopeComponent[];
  confidence: 'low' | 'medium';
  isPlanningEstimate: true;
  label: 'Planning estimate';
  helper: string;
  basisLine: string;
  /** True when quantity came from exterior walls + attic, not living×3.5. */
  usesThermalEnvelopeModel: true;
};

export type InsulationEnvelopeInputs = {
  floorAreaSqft?: number | null;
  mainFloorLivingSqft?: number | null;
  exteriorPerimeterLf?: number | null;
  foundationPerimeterLf?: number | null;
  wallHeightFt?: number | null;
  plateHeightFt?: number | null;
  storyCount?: number | null;
  openingsPercent?: number | null;
  /** Explicit overrides (contractor / takeoff). */
  exteriorWallGrossSqft?: number | null;
  exteriorWallInsulationSqft?: number | null;
  atticInsulationSqft?: number | null;
  insulatedRoofDeckSqft?: number | null;
  floorInsulationSqft?: number | null;
  garageSeparationInsulationSqft?: number | null;
  insulatedGarageWallSqft?: number | null;
  insulatedGarageCeilingSqft?: number | null;
  openingDeductionSqft?: number | null;
  /** Include garage assemblies only when confirmed/detected. */
  includeGarageInsulation?: boolean;
  garageInsulationIncluded?: string | null;
  preferRoofDeckOverAttic?: boolean;
  /** Do not use living SF as an attic proxy when a wall takeoff is explicit. */
  suppressAtticPlanningFallback?: boolean;
  /** Ground-up plan takeoff: never derive surfaces from living SF alone. */
  requireExplicitSurfaceTakeoff?: boolean;
  /** Allow a clearly labeled conditioned-ceiling suggestion for review. */
  allowConditionedAreaCeilingSuggestion?: boolean;
  conditionedCeilingAreaSqft?: number | null;
  vaultedCeilingDetected?: boolean | null;
  insulationAssemblies?: InsulationAssembly[] | null;
};

function n(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function estimatedPerimeterFromLiving(livingSf: number): number {
  return Math.round(
    INSULATION_PERIMETER_FROM_LIVING_FACTOR * Math.sqrt(livingSf)
  );
}

export function insulationEnvelopeInputsFromPlanFacts(
  facts: PlanFacts | null | undefined,
  floorAreaSqft?: number | null,
  overrides?: Partial<InsulationEnvelopeInputs>
): InsulationEnvelopeInputs {
  const living =
    n(floorAreaSqft) ||
    n(facts?.buildingAreas?.totalLivingSqft) ||
    n(facts?.buildingAreas?.mainFloorLivingSqft);
  const conditionedCeilingArea =
    n(facts?.buildingAreas?.totalLivingSqft) ||
    (n(facts?.buildingAreas?.mainFloorLivingSqft) || 0) +
      (n(facts?.buildingAreas?.upstairsLivingSqft) || 0) ||
    null;
  const garageChoice = String(overrides?.garageInsulationIncluded || '')
    .trim()
    .toLowerCase();
  return {
    floorAreaSqft: living,
    mainFloorLivingSqft: n(facts?.buildingAreas?.mainFloorLivingSqft) || living,
    exteriorPerimeterLf: n(facts?.exteriorPerimeterLf),
    foundationPerimeterLf: n(facts?.foundationPerimeterLf),
    wallHeightFt: n(facts?.wallHeightFt),
    plateHeightFt: n(facts?.plateHeightFt),
    storyCount: n(facts?.storyCount) || 1,
    openingsPercent: n(facts?.openingsPercent),
    conditionedCeilingAreaSqft: conditionedCeilingArea,
    vaultedCeilingDetected: facts?.vaultedCeilingDetected === true,
    includeGarageInsulation:
      overrides?.includeGarageInsulation ??
      (garageChoice === 'yes' || garageChoice === 'separation only'
        ? true
        : garageChoice === 'no'
          ? false
          : undefined),
    ...overrides,
  };
}

/**
 * Resolve thermal-envelope insulation SF for Confirm Scope / planning.
 * Never uses living×3.5 or drywall surface area.
 */
export function resolveInsulationEnvelopePlanningQuantity(
  raw: InsulationEnvelopeInputs
): InsulationEnvelopePlanningResult | null {
  const living = n(raw.floorAreaSqft) || n(raw.mainFloorLivingSqft);
  const hasAssemblyModel = Array.isArray(raw.insulationAssemblies);
  const assemblyInputRows = (raw.insulationAssemblies || []).filter(row => {
    const sqft = n(row.sqft);
    return Boolean(sqft && sqft > 0);
  });
  const isConfirmedAssemblyRow = (row: InsulationAssembly) =>
    row.confirmed !== false && row.source !== 'calculated_from_plan';
  const explicitNetWalls = hasAssemblyModel
    ? assemblyInputRows
        .filter(row => row.location === 'exterior_wall')
        .filter(isConfirmedAssemblyRow)
        .reduce((sum, row) => sum + (n(row.sqft) || 0), 0) || null
    : n(raw.exteriorWallInsulationSqft);
  const explicitGrossWalls = n(raw.exteriorWallGrossSqft);
  const explicitOpeningDeduction = n(raw.openingDeductionSqft);
  const explicitWalls =
    explicitNetWalls ??
    (explicitGrossWalls != null
      ? Math.max(0, explicitGrossWalls - (explicitOpeningDeduction || 0))
      : null);
  const explicitAttic = hasAssemblyModel
    ? assemblyInputRows
        .filter(row => row.location === 'attic_ceiling')
        .filter(isConfirmedAssemblyRow)
        .reduce((sum, row) => sum + (n(row.sqft) || 0), 0) || null
    : n(raw.atticInsulationSqft);
  const explicitDeck = hasAssemblyModel
    ? assemblyInputRows
        .filter(row => row.location === 'roof_deck')
        .filter(isConfirmedAssemblyRow)
        .reduce((sum, row) => sum + (n(row.sqft) || 0), 0) || null
    : n(raw.insulatedRoofDeckSqft);
  const assemblyRows = assemblyInputRows.filter(row => {
    const sqft = n(row.sqft);
    return Boolean(sqft && sqft > 0) && isConfirmedAssemblyRow(row);
  });
  const assemblySqft = assemblyRows.reduce(
    (sum, row) => sum + (n(row.sqft) || 0),
    0
  );
  const hasUnconfirmedAtticAssembly =
    hasAssemblyModel &&
    assemblyInputRows.some(
      row =>
        row.location === 'attic_ceiling' &&
        (row.confirmed === false || row.source === 'calculated_from_plan')
    );
  const hasUnconfirmedRoofDeckAssembly =
    hasAssemblyModel &&
    assemblyInputRows.some(
      row =>
        row.location === 'roof_deck' &&
        (row.confirmed === false || row.source === 'calculated_from_plan')
    );
  const unconfirmedAtticSqft = assemblyInputRows
    .filter(
      row =>
        row.location === 'attic_ceiling' &&
        (row.confirmed === false || row.source === 'calculated_from_plan')
    )
    .reduce((sum, row) => sum + (n(row.sqft) || 0), 0) || null;
  const unconfirmedRoofDeckSqft = assemblyInputRows
    .filter(
      row =>
        row.location === 'roof_deck' &&
        (row.confirmed === false || row.source === 'calculated_from_plan')
    )
    .reduce((sum, row) => sum + (n(row.sqft) || 0), 0) || null;
  const suggestedAttic =
    explicitAttic ??
    unconfirmedAtticSqft ??
    (raw.allowConditionedAreaCeilingSuggestion &&
    !raw.vaultedCeilingDetected &&
    explicitDeck == null
      ? n(raw.conditionedCeilingAreaSqft)
      : null);
  // Allow fully explicit component takeoffs without living SF.
  if (
    !living &&
    explicitWalls == null &&
    explicitAttic == null &&
    explicitDeck == null &&
    assemblySqft <= 0
  ) {
    return null;
  }

  const stories = Math.max(1, Math.round(n(raw.storyCount) || 1));
  const atticFootprint = n(raw.mainFloorLivingSqft) || living;
  const openingsPct = Math.max(
    0,
    Math.min(
      0.5,
      (n(raw.openingsPercent) ?? INSULATION_DEFAULT_OPENINGS_PERCENT) / 100
    )
  );

  const components: InsulationEnvelopeComponent[] = [];

  // --- Exterior walls ---
  let exteriorWalls = explicitWalls;
  let wallSource: InsulationEnvelopeSource = 'contractor_entered';
  let wallConfidence: 'low' | 'medium' | 'high' = 'high';
  let wallFormula: string | undefined;

  if (exteriorWalls == null) {
    const perimeter =
      n(raw.exteriorPerimeterLf) || n(raw.foundationPerimeterLf);
    const height =
      n(raw.wallHeightFt) ||
      n(raw.plateHeightFt) ||
      INSULATION_DEFAULT_WALL_HEIGHT_FT;
    const heightLabeled =
      n(raw.wallHeightFt) != null || n(raw.plateHeightFt) != null;
    if (perimeter != null) {
      exteriorWalls = Math.round(perimeter * height * stories);
      wallSource = heightLabeled
        ? 'calculated_from_plan'
        : 'planning_assumption';
      wallConfidence = heightLabeled ? 'medium' : 'low';
      wallFormula = `${perimeter} LF × ${height} ft × ${stories} stor${stories === 1 ? 'y' : 'ies'}`;
    } else if (living && !raw.requireExplicitSurfaceTakeoff) {
      const estPerimeter = estimatedPerimeterFromLiving(living);
      exteriorWalls = Math.round(estPerimeter * height * stories);
      wallSource = 'planning_assumption';
      wallConfidence = 'low';
      wallFormula = `≈${estPerimeter} LF (from √living) × ${height} ft × ${stories}`;
    } else {
      exteriorWalls = 0;
    }
  }

  components.push({
    key: 'exteriorWallInsulationSqft',
    label: 'Exterior wall insulation',
    quantity: exteriorWalls,
    unit: 'sqft',
    source: wallSource,
    confidence: wallConfidence,
    included: true,
    formula: wallFormula,
    contractorConfirmationRequired: wallConfidence !== 'high',
  });

  // --- Opening deduction (walls only) ---
  let openingDeduction = n(raw.openingDeductionSqft);
  if (openingDeduction == null) {
    openingDeduction = raw.requireExplicitSurfaceTakeoff
      ? 0
      : Math.round(exteriorWalls * openingsPct);
  }
  components.push({
    key: 'openingDeductionSqft',
    label: 'Window / exterior-door openings',
    quantity: openingDeduction,
    unit: 'sqft',
    source:
      n(raw.openingDeductionSqft) != null
        ? 'contractor_entered'
        : 'planning_assumption',
    confidence: n(raw.openingDeductionSqft) != null ? 'high' : 'low',
    included: true,
    formula:
      n(raw.openingDeductionSqft) != null
        ? undefined
        : `${Math.round(openingsPct * 100)}% of exterior walls`,
    contractorConfirmationRequired: true,
  });

  // --- Attic vs roof deck (mutually exclusive by default) ---
  const roofDeck = explicitDeck ?? unconfirmedRoofDeckSqft;
  const preferRoofDeck = Boolean(
    roofDeck && raw.preferRoofDeckOverAttic !== false
  );
  let attic = explicitAttic ?? suggestedAttic;
  if (!preferRoofDeck && attic == null && atticFootprint &&
      !raw.requireExplicitSurfaceTakeoff &&
      !raw.suppressAtticPlanningFallback) {
    attic = Math.round(atticFootprint);
  }
  if (!preferRoofDeck && attic != null) {
    components.push({
      key: 'atticInsulationSqft',
      label: 'Attic / insulated ceiling',
      quantity: attic,
      unit: 'sqft',
      source:
        !hasUnconfirmedAtticAssembly && n(raw.atticInsulationSqft) != null
          ? 'contractor_entered'
          : 'calculated_from_plan',
      confidence:
        !hasUnconfirmedAtticAssembly && n(raw.atticInsulationSqft) != null
          ? 'high'
          : 'medium',
      included: !hasUnconfirmedAtticAssembly,
      formula:
        n(raw.atticInsulationSqft) != null
          ? undefined
          : 'Conditioned main + upper floor areas; garage and covered patio excluded',
      contractorConfirmationRequired:
        hasUnconfirmedAtticAssembly || n(raw.atticInsulationSqft) == null,
    });
  }
  if (preferRoofDeck && roofDeck != null) {
    components.push({
      key: 'insulatedRoofDeckSqft',
      label: 'Insulated roof deck',
      quantity: roofDeck,
      unit: 'sqft',
      source: 'contractor_entered',
      confidence: 'high',
      included: !hasUnconfirmedRoofDeckAssembly,
      contractorConfirmationRequired: false,
    });
  } else if (roofDeck != null && !preferRoofDeck) {
    // Detected but not selected — keep out of total to avoid double-count with attic.
    components.push({
      key: 'insulatedRoofDeckSqft',
      label: 'Insulated roof deck',
      quantity: roofDeck,
      unit: 'sqft',
      source: 'detected_from_plan',
      confidence: 'medium',
      included: false,
      contractorConfirmationRequired: true,
      formula:
        'Excluded while attic-floor insulation is used (confirm thermal boundary)',
    });
  }

  // --- Optional assemblies (excluded unless provided / garage confirmed) ---
  const garageChoice = String(raw.garageInsulationIncluded || '')
    .trim()
    .toLowerCase();
  const optional: Array<{
    key: InsulationEnvelopeComponentKey;
    label: string;
    value: number | null | undefined;
    garage?: boolean;
  }> = [
    {
      key: 'floorInsulationSqft',
      label: 'Floor over unconditioned space',
      value: raw.floorInsulationSqft,
    },
    {
      key: 'garageSeparationInsulationSqft',
      label: 'Garage-to-house separation',
      value: raw.garageSeparationInsulationSqft,
      garage: true,
    },
    {
      key: 'insulatedGarageWallSqft',
      label: 'Insulated garage walls',
      value: raw.insulatedGarageWallSqft,
      garage: true,
    },
    {
      key: 'insulatedGarageCeilingSqft',
      label: 'Insulated garage ceiling',
      value: raw.insulatedGarageCeilingSqft,
      garage: true,
    },
  ];

  for (const row of optional) {
    const qty = n(row.value);
    if (qty == null) continue;
    const include = row.garage
      ? garageChoice === 'yes' ||
        (garageChoice === 'separation only' &&
          row.key === 'garageSeparationInsulationSqft') ||
        (!garageChoice && Boolean(raw.includeGarageInsulation))
      : true;
    components.push({
      key: row.key,
      label: row.label,
      quantity: qty,
      unit: 'sqft',
      source: 'contractor_entered',
      confidence: 'high',
      included: include,
      contractorConfirmationRequired: row.garage,
      formula: include
        ? undefined
        : 'Excluded until garage insulation is confirmed',
    });
  }

  // The canonical exteriorWallInsulationSqft field is already net. Opening
  // deductions remain a separate audit component and are only subtracted from
  // gross wall takeoffs.
  const netWalls =
    explicitNetWalls != null
      ? Math.max(0, explicitNetWalls)
      : Math.max(0, exteriorWalls - openingDeduction);
  const additions = components
    .filter(
      c =>
        c.included &&
        c.key !== 'exteriorWallInsulationSqft' &&
        c.key !== 'openingDeductionSqft' &&
        ((!hasAssemblyModel && assemblySqft <= 0) ||
          !['atticInsulationSqft', 'insulatedRoofDeckSqft'].includes(c.key))
    )
    .reduce((sum, c) => sum + c.quantity, 0);
  const total = Math.max(
    0,
    Math.round((hasAssemblyModel ? assemblySqft : netWalls) + additions)
  );

  if (!(total > 0)) return null;

  const measuredWalls =
    wallSource === 'calculated_from_plan' ||
    wallSource === 'contractor_entered';
  const confidence: 'low' | 'medium' = measuredWalls ? 'medium' : 'low';

  return {
    totalInsulationEnvelopeSqft: total,
    components,
    confidence,
    isPlanningEstimate: true,
    label: 'Planning estimate',
    helper:
      'Estimated thermal-envelope area based on exterior walls and conditioned ceiling area. Verify openings, garage insulation, assembly type, and required R-values.',
    basisLine:
      assemblySqft > 0
        ? `Insulation assemblies ${Math.round(assemblySqft).toLocaleString()} SF + optional floor/garage areas`
        : `Exterior walls ${netWalls.toLocaleString()} SF (after openings) + attic/ceiling ${Math.round(attic || roofDeck || 0).toLocaleString()} SF`,
    usesThermalEnvelopeModel: true,
  };
}

/** True when a quantity is clearly the drywall living×3.5 surface proxy. */
export function isDrywallSurfaceProxyQuantity(
  quantity: number | null | undefined,
  livingSf: number | null | undefined
): boolean {
  const qty = Number(quantity);
  const living = Number(livingSf);
  if (!(qty > 0) || !(living > 0)) return false;
  const surfaceProxy = Math.round(living * 3.5);
  return Math.abs(qty - surfaceProxy) < 1 || Math.abs(qty - living) < 0.51;
}
