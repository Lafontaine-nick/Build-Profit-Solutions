export type MeasurementRole = 'primary_takeoff' | 'pricing' | 'benchmark';

export type MeasurementUnit =
  | 'living_sqft'
  | 'surface_sqft'
  | 'floor_sqft'
  | 'roof_sqft'
  | 'roof_square'
  | 'lf'
  | 'cy'
  | 'cf'
  | 'ea'
  | 'fixture'
  | 'opening'
  | 'ton'
  | 'lb'
  | 'package'
  | 'ls'
  | 'percent'
  | 'sqft'
  | 'unknown';

export type MeasurementSource =
  | 'plan_explicit'
  | 'plan_derived'
  | 'user_entered'
  | 'saved_pricing'
  | 'saved_template'
  | 'local_benchmark'
  | 'national_benchmark'
  | 'standard_assumption'
  | 'manual_allowance'
  | 'unknown';

export type MeasurementConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type MeasurementStatus =
  | 'measured'
  | 'partially_measured'
  | 'needs_takeoff'
  | 'needs_structural_takeoff'
  | 'needs_count'
  | 'needs_allowance'
  | 'benchmark_only'
  | 'not_applicable'
  | 'manual_review';

export type ScopeMeasurementRecord = {
  role: MeasurementRole;
  quantity: number | null;
  unit: MeasurementUnit;
  sourceType: MeasurementSource;
  sourceLabel?: string | null;
  sourcePage?: number | null;
  sourceSheet?: string | null;
  derivationFormula?: string | null;
  derivationInputs?: Record<string, string | number | null>;
  confidence: MeasurementConfidence;
  requiresReview: boolean;
  isUserConfirmed: boolean;
};

export type ScopeMeasurementState = {
  primaryTakeoff?: ScopeMeasurementRecord | null;
  pricing?: ScopeMeasurementRecord | null;
  benchmark?: ScopeMeasurementRecord | null;
  status?: MeasurementStatus;
};

export type AreaReconciliationStatus = 'reconciled' | 'review' | 'material_variance';

export type AreaReconciliation = {
  declaredLivingSf: number | null;
  detectedLivingRoomSf: number | null;
  unassignedLivingSf: number | null;
  livingVariancePercent: number | null;
  declaredGarageSf: number | null;
  detectedGarageRoomSf: number | null;
  unassignedGarageSf: number | null;
  garageVariancePercent: number | null;
  patioDeckSf: number | null;
  otherAreaSf?: number | null;
  status: AreaReconciliationStatus;
  /** Rooms found is not full reconciliation. */
  roomCount?: number | null;
  notes?: string[];
};

export type UnifiedConfidence = {
  scopeConfidence: MeasurementConfidence;
  quantityConfidence: MeasurementConfidence;
  priceConfidence: MeasurementConfidence;
  sourceConfidence: MeasurementConfidence;
  similarityConfidence?: MeasurementConfidence;
};

export type PricingOverrideLog = {
  itemId: string;
  reason: string;
  confirmedAt: string;
  pricingUnit: string;
  rateUnit: string;
  pricingQuantity: number | null;
  rate: number | null;
  calculatedTotal: number | null;
};
