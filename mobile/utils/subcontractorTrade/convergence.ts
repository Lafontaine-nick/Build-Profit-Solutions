import type { QuickMeasurementSourceTag } from '@/utils/quickMeasurementProvenance';
import type { PlanMeasurementSourceType } from '@/utils/planMeasurementFacts';
import type { SubcontractorTradeKey } from './types';
import type {
  NormalizedMeasurementProvenance,
  NormalizedTradeMeasurements,
  TradeMeasurementInputSource,
} from './types';
import { getTradeMeasurementSchema } from './measurementSchemas';
import {
  buildConcreteStructuredMeasurements,
  CONCRETE_REVIEW_MEASUREMENT_KEYS,
  normalizeConcreteScalarMeasurements,
} from './concretePlanConvergence';
import {
  buildFlooringStructuredMeasurements,
  FLOORING_REVIEW_MEASUREMENT_KEYS,
  normalizeFlooringScalarMeasurements,
} from './flooringPlanConvergence';
import {
  buildPaintingStructuredMeasurements,
  PAINTING_REVIEW_MEASUREMENT_KEYS,
  normalizePaintingScalarMeasurements,
} from './paintingPlanConvergence';
import {
  buildElectricalStructuredMeasurements,
  ELECTRICAL_REVIEW_MEASUREMENT_KEYS,
  normalizeElectricalPlanMeasurements,
  normalizeElectricalScalarMeasurements,
} from './electricalPlanConvergence';
import {
  buildFramingStructuredMeasurements,
  FRAMING_PLAN_ALIASES,
  FRAMING_REVIEW_MEASUREMENT_KEYS,
  FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS,
  isShellFramingPackageBid,
  normalizeFramingPlanMeasurements,
  normalizeFramingScalarMeasurements,
  parseFramingMeasurementsFromNotes,
  shouldStripShellFramingComponentMeasurement,
} from './framingPlanConvergence';
import {
  buildDrywallStructuredMeasurements,
  DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS,
  normalizeDrywallPlanMeasurements,
  parseDrywallMeasurementsFromNotes,
} from './drywallPlanConvergence';
import {
  buildWindowsDoorsStructuredMeasurements,
  normalizeWindowsDoorsPlanMeasurements,
  WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
} from './windowsDoorsPlanConvergence';
import {
  buildGarageDoorsStructuredMeasurements,
  GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS,
  normalizeGarageDoorsPlanMeasurements,
} from './garageDoorsPlanConvergence';
import {
  buildHvacStructuredMeasurements,
  HVAC_PLAN_ALIASES,
  HVAC_PLAN_REVIEW_MEASUREMENT_KEYS,
  hvacQuickMeasurementSourcesFromProvenance,
  normalizeHvacPlanMeasurements,
} from './hvacPlanConvergence';
import {
  buildPlumbingStructuredMeasurements,
  PLUMBING_PLAN_ALIASES,
  PLUMBING_REVIEW_MEASUREMENT_KEYS,
  normalizePlumbingPlanMeasurements,
  normalizePlumbingScalarMeasurements,
  parsePlumbingMeasurementsFromNotes,
} from './plumbingPlanConvergence';
import { tagFramingDerivedQuickMeasurementSources } from '@/utils/planTakeoffReviewUi';

const PROVENANCE_TO_STORAGE: Record<
  NormalizedMeasurementProvenance,
  QuickMeasurementSourceTag | PlanMeasurementSourceType
> = {
  FROM_PLAN: 'plan_detected',
  FROM_NOTES: 'user_entered',
  USER_ENTERED: 'user_entered',
  PLANNING_ESTIMATE: 'estimated_from_formula',
  NEEDS_CONFIRMATION: 'needs_confirmation',
};

const STORAGE_TO_PROVENANCE: Record<string, NormalizedMeasurementProvenance> = {
  plan_detected: 'FROM_PLAN',
  detected_from_plan: 'FROM_PLAN',
  measured_from_geometry: 'FROM_PLAN',
  calculated_from_components: 'PLANNING_ESTIMATE',
  calculated_from_deductions: 'PLANNING_ESTIMATE',
  estimated_from_formula: 'PLANNING_ESTIMATE',
  fallback_multiplier: 'PLANNING_ESTIMATE',
  user_entered: 'USER_ENTERED',
  user_confirmed_suggestion: 'USER_ENTERED',
  needs_confirmation: 'NEEDS_CONFIRMATION',
};

/** Map stored provenance tags to normalized contract labels for display/debug only. */
export function toNormalizedProvenance(
  storageTag: string | null | undefined
): NormalizedMeasurementProvenance | null {
  if (!storageTag) return null;
  return STORAGE_TO_PROVENANCE[storageTag] || null;
}

/** Map normalized provenance to existing quick-measurement source tags. */
export function provenanceToStorageTag(
  provenance: NormalizedMeasurementProvenance
): QuickMeasurementSourceTag | PlanMeasurementSourceType {
  return PROVENANCE_TO_STORAGE[provenance];
}

function inputSourceToProvenance(
  source: TradeMeasurementInputSource
): NormalizedMeasurementProvenance {
  switch (source) {
    case 'plan':
      return 'FROM_PLAN';
    case 'notes':
      return 'FROM_NOTES';
    case 'manual':
    default:
      return 'USER_ENTERED';
  }
}

type RawMeasurementInput = Record<string, unknown>;

function positiveNumber(value: unknown): number | null {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Plan-derived and notes-derived measurements converge through this adapter.
 * Phase 0: passthrough only — does not recalculate derived fields or invoke pricing.
 */
export function normalizeTradeMeasurements(
  tradeKey: SubcontractorTradeKey,
  input: RawMeasurementInput,
  source: TradeMeasurementInputSource = 'plan'
): NormalizedTradeMeasurements {
  const schema = getTradeMeasurementSchema(tradeKey);
  const schemaKeys = new Set(schema.map(def => def.key));
  const measurements: Record<string, number | string | null | undefined> = {};
  const quickMeasurementSources: Record<string, string> = {};
  const existingSources =
    input.quickMeasurementSources &&
    typeof input.quickMeasurementSources === 'object' &&
    !Array.isArray(input.quickMeasurementSources)
      ? (input.quickMeasurementSources as Record<string, string>)
      : {};
  const existingProvenance =
    input.measurementProvenance &&
    typeof input.measurementProvenance === 'object' &&
    !Array.isArray(input.measurementProvenance)
      ? (input.measurementProvenance as Record<string, unknown>)
      : undefined;
  const normalizedProvenance: Record<string, unknown> = {
    ...(existingProvenance || {}),
  };
  const normalizedSource = inputSourceToProvenance(source);

  const defaultProvenanceTag = provenanceToStorageTag(
    inputSourceToProvenance(source)
  );

  for (const [key, value] of Object.entries(input)) {
    if (
      key === 'quickMeasurementSources' ||
      key === 'measurementProvenance' ||
      key === 'measurementConflicts' ||
      key === 'itemQuantities'
    ) {
      continue;
    }
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number' || typeof value === 'string') {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
  }

  for (const [key, tag] of Object.entries(existingSources)) {
    quickMeasurementSources[key] = tag;
  }

  // Roofing keeps one canonical pricing quantity. Only derive squares when
  // an explicit roof surface area was supplied; never use living/floor area.
  if (
    tradeKey === 'roofing' &&
    measurements.roofSquares == null &&
    Number(measurements.roofAreaSqft) > 0
  ) {
    measurements.roofSquares =
      Math.round((Number(measurements.roofAreaSqft) / 100) * 100) / 100;
    quickMeasurementSources.roofSquares = 'calculated_from_components';
    normalizedProvenance.roofSquares = {
      source: 'PLANNING_ESTIMATE',
      derivedFrom: ['roofAreaSqft'],
    };
  }

  let structuredMeasurements: Record<string, unknown> | undefined;
  if (tradeKey === 'concrete') {
    const structured = buildConcreteStructuredMeasurements(input);
    const scalar = normalizeConcreteScalarMeasurements(input, structured);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of CONCRETE_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = input[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.concreteAreaByType
        ? { concreteAreaByType: structured.concreteAreaByType }
        : {}),
      ...(structured.concreteThicknessByType
        ? { concreteThicknessByType: structured.concreteThicknessByType }
        : {}),
      ...(structured.concreteScope
        ? { concreteScope: structured.concreteScope }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'flooring') {
    const structured = buildFlooringStructuredMeasurements(input);
    const scalar = normalizeFlooringScalarMeasurements(input, structured);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of FLOORING_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = input[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.flooringAreaByProduct
        ? { flooringAreaByProduct: structured.flooringAreaByProduct }
        : {}),
      ...(structured.flooringProductScope
        ? { flooringProductScope: structured.flooringProductScope }
        : {}),
      ...(structured.flooringExistingTypes
        ? { flooringExistingTypes: structured.flooringExistingTypes }
        : {}),
      ...(structured.flooringInstallScopeCount != null
        ? { flooringInstallScopeCount: structured.flooringInstallScopeCount }
        : {}),
      ...(structured.flooringDemoScopeCount != null
        ? { flooringDemoScopeCount: structured.flooringDemoScopeCount }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
      ...(input.floorPrepByProduct &&
      typeof input.floorPrepByProduct === 'object' &&
      !Array.isArray(input.floorPrepByProduct)
        ? { floorPrepByProduct: input.floorPrepByProduct }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'painting') {
    const structured = buildPaintingStructuredMeasurements(input);
    const scalar = normalizePaintingScalarMeasurements(input, structured);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of PAINTING_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = input[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.paintScope ? { paintScope: structured.paintScope } : {}),
      ...(structured.paintPricingMethod
        ? { paintPricingMethod: structured.paintPricingMethod }
        : {}),
      ...(structured.paintOccupancy
        ? { paintOccupancy: structured.paintOccupancy }
        : {}),
      ...(structured.paintApplicationMethod
        ? { paintApplicationMethod: structured.paintApplicationMethod }
        : {}),
      ...(structured.paintOccupancyConfirmed != null
        ? { paintOccupancyConfirmed: structured.paintOccupancyConfirmed }
        : {}),
      ...(structured.paintApplicationMethodConfirmed != null
        ? {
            paintApplicationMethodConfirmed:
              structured.paintApplicationMethodConfirmed,
          }
        : {}),
      ...(structured.paintAreaNeedsConfirmation != null
        ? { paintAreaNeedsConfirmation: structured.paintAreaNeedsConfirmation }
        : {}),
      ...(structured.paintAreaBasis
        ? { paintAreaBasis: structured.paintAreaBasis }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'electrical') {
    const electricalInput =
      source === 'plan' ? normalizeElectricalPlanMeasurements(input) : input;
    const quantitySource = source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildElectricalStructuredMeasurements(
      electricalInput,
      quantitySource
    );
    const scalar = normalizeElectricalScalarMeasurements(
      electricalInput,
      structured
    );
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of ELECTRICAL_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = electricalInput[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.electricalScope
        ? { electricalScope: structured.electricalScope }
        : {}),
      ...(structured.electricalProjectCondition
        ? { electricalProjectCondition: structured.electricalProjectCondition }
        : {}),
      ...(structured.electricalIncludeRough != null
        ? { electricalIncludeRough: structured.electricalIncludeRough }
        : {}),
      ...(structured.electricalIncludeTrim != null
        ? { electricalIncludeTrim: structured.electricalIncludeTrim }
        : {}),
      ...(structured.electricalConduit != null
        ? { electricalConduit: structured.electricalConduit }
        : {}),
      ...(structured.electricalTrenching != null
        ? { electricalTrenching: structured.electricalTrenching }
        : {}),
      ...(structured.electricalConduitSpecialty != null
        ? { electricalConduitSpecialty: structured.electricalConduitSpecialty }
        : {}),
      ...(structured.electricalTrenchCondition
        ? { electricalTrenchCondition: structured.electricalTrenchCondition }
        : {}),
      ...(structured.existingServiceAmperage != null
        ? { existingServiceAmperage: structured.existingServiceAmperage }
        : {}),
      ...(structured.electricalPanelLocation
        ? { electricalPanelLocation: structured.electricalPanelLocation }
        : {}),
      ...(structured.electricalMeterMainCombo != null
        ? { electricalMeterMainCombo: structured.electricalMeterMainCombo }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'plumbing') {
    const plumbingInput =
      source === 'plan'
        ? normalizePlumbingPlanMeasurements(input)
        : source === 'notes'
          ? {
              ...parsePlumbingMeasurementsFromNotes(String(input.notes || '')),
              ...input,
            }
          : input;
    const quantitySource = source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildPlumbingStructuredMeasurements(
      plumbingInput,
      quantitySource
    );
    const scalar = normalizePlumbingScalarMeasurements(plumbingInput);
    for (const [alias, canonical] of Object.entries(PLUMBING_PLAN_ALIASES)) {
      if (alias !== canonical) delete measurements[alias];
    }
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of PLUMBING_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = plumbingInput[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.plumbingScope
        ? { plumbingScope: structured.plumbingScope }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'framing') {
    const framingInput =
      source === 'plan'
        ? normalizeFramingPlanMeasurements(input)
        : source === 'notes'
          ? {
              ...parseFramingMeasurementsFromNotes(String(input.notes || '')),
              ...input,
            }
          : input;
    const quantitySource = source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildFramingStructuredMeasurements(
      framingInput,
      quantitySource
    );
    const scalar = normalizeFramingScalarMeasurements(framingInput);
    for (const [alias, canonical] of Object.entries(FRAMING_PLAN_ALIASES)) {
      if (alias !== canonical) delete measurements[alias];
    }
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of FRAMING_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = framingInput[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.framingScope
        ? { framingScope: structured.framingScope }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
    Object.assign(
      quickMeasurementSources,
      tagFramingDerivedQuickMeasurementSources({
        ...measurements,
        quickMeasurementSources,
      })
    );
    if (isShellFramingPackageBid(framingInput)) {
      for (const key of FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS) {
        if (!shouldStripShellFramingComponentMeasurement(framingInput, key)) {
          continue;
        }
        delete measurements[key];
        delete quickMeasurementSources[key];
        delete normalizedProvenance[key];
      }
    }
  }

  if (tradeKey === 'drywall') {
    const drywallInput =
      source === 'plan'
        ? normalizeDrywallPlanMeasurements(input)
        : source === 'notes'
          ? {
              ...parseDrywallMeasurementsFromNotes(String(input.notes || '')),
              ...input,
            }
          : input;
    const quantitySource = source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildDrywallStructuredMeasurements(
      drywallInput,
      quantitySource
    );
    const scalar = normalizeDrywallPlanMeasurements(drywallInput);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value as number | string;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    for (const key of DRYWALL_PLAN_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = drywallInput[key];
      if (typeof value === 'number' || typeof value === 'string') {
        if (positiveNumber(value) != null) measurements[key] = value;
      }
    }
    structuredMeasurements = {
      ...(structured.drywallScope
        ? { drywallScope: structured.drywallScope }
        : {}),
      ...(structured.itemQuantities
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  if (tradeKey === 'windows_doors') {
    const windowsDoorsInput =
      source === 'plan'
        ? normalizeWindowsDoorsPlanMeasurements(input)
        : input;
    const quantitySource =
      source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildWindowsDoorsStructuredMeasurements(
      windowsDoorsInput,
      quantitySource
    );
    const scalar = normalizeWindowsDoorsPlanMeasurements(windowsDoorsInput);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    structuredMeasurements = {
      ...(Object.keys(structured.itemQuantities).length
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
    for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = windowsDoorsInput[key];
      if (positiveNumber(value) != null) measurements[key] = value as number;
    }
  }

  if (tradeKey === 'garage_doors') {
    const garageInput =
      source === 'plan'
        ? normalizeGarageDoorsPlanMeasurements(input)
        : input;
    const quantitySource =
      source === 'plan' ? 'plan_detected' : 'user_entered';
    const structured = buildGarageDoorsStructuredMeasurements(
      garageInput,
      quantitySource
    );
    const scalar = normalizeGarageDoorsPlanMeasurements(garageInput);
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        normalizedProvenance[key] = normalizedSource;
      }
    }
    structuredMeasurements = {
      ...(Object.keys(structured.itemQuantities).length
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
    for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = garageInput[key];
      if (positiveNumber(value) != null) measurements[key] = value as number;
    }
  }

  if (tradeKey === 'hvac') {
    const hvacInput =
      source === 'plan'
        ? normalizeHvacPlanMeasurements(input)
        : source === 'notes'
          ? { ...normalizeHvacPlanMeasurements(input), ...input }
          : input;
    const provenanceSources = hvacQuickMeasurementSourcesFromProvenance(
      hvacInput,
      existingProvenance
    );
    for (const [key, tag] of Object.entries(provenanceSources)) {
      if (schemaKeys.has(key)) {
        quickMeasurementSources[key] = tag;
      }
    }
    const quantitySourceMap = {
      ...Object.fromEntries(
        HVAC_PLAN_REVIEW_MEASUREMENT_KEYS.map(key => [
          key,
          quickMeasurementSources[key] || defaultProvenanceTag,
        ])
      ),
    };
    const structured = buildHvacStructuredMeasurements(
      hvacInput,
      quantitySourceMap
    );
    const scalar = normalizeHvacPlanMeasurements(hvacInput);
    for (const [alias, canonical] of Object.entries(HVAC_PLAN_ALIASES)) {
      if (alias !== canonical) delete measurements[alias];
    }
    for (const [key, value] of Object.entries(scalar)) {
      measurements[key] = value;
      if (schemaKeys.has(key) && !existingSources[key] && !provenanceSources[key]) {
        quickMeasurementSources[key] = defaultProvenanceTag;
      }
      if (schemaKeys.has(key) && normalizedProvenance[key] == null) {
        const provEntry = existingProvenance?.[key];
        if (provEntry && typeof provEntry === 'object') {
          normalizedProvenance[key] = provEntry;
        } else if (provenanceSources[key] === 'needs_confirmation') {
          normalizedProvenance[key] = {
            normalizedSource: 'NEEDS_REVIEW',
            status: 'needs_review',
            pricingEligible: false,
          };
        } else {
          normalizedProvenance[key] = normalizedSource;
        }
      }
    }
    for (const key of HVAC_PLAN_REVIEW_MEASUREMENT_KEYS) {
      if (measurements[key] != null) continue;
      const value = hvacInput[key];
      if (positiveNumber(value) != null) measurements[key] = value as number;
    }
    structuredMeasurements = {
      ...(Object.keys(structured.itemQuantities).length
        ? { itemQuantities: structured.itemQuantities }
        : {}),
    };
    if (!Object.keys(structuredMeasurements).length) {
      structuredMeasurements = undefined;
    }
  }

  for (const conflict of Array.isArray(input.measurementConflicts)
    ? input.measurementConflicts
    : []) {
    const field = String(conflict?.field || '');
    if (!field || !conflict?.requiresConfirmation) continue;
    if (source !== 'manual') {
      normalizedProvenance[field] = 'NEEDS_CONFIRMATION';
      quickMeasurementSources[field] = 'needs_confirmation';
    }
  }

  return {
    measurements,
    quickMeasurementSources: Object.keys(quickMeasurementSources).length
      ? quickMeasurementSources
      : undefined,
    measurementProvenance: Object.keys(normalizedProvenance).length
      ? normalizedProvenance
      : undefined,
    measurementConflicts: Array.isArray(input.measurementConflicts)
      ? input.measurementConflicts
      : undefined,
    structuredMeasurements,
  };
}
