import type { ScopePricingBehavior } from './scopePricingBehavior';

/** Supported subcontractor trades for plan export and future standalone convergence. */
export type SubcontractorTradeKey =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'roofing'
  | 'concrete'
  | 'framing'
  | 'drywall'
  | 'stucco'
  | 'insulation'
  | 'flooring'
  | 'painting'
  | 'windows_doors';

/** Legacy plan-import keys retained for persisted drafts — not shown in Plan Export menu. */
export type LegacyPlanTradeKey =
  | 'cabinets'
  | 'landscaping'
  | 'other';

export type PlanTradeKey = SubcontractorTradeKey | LegacyPlanTradeKey;

export type SubcontractorTradeStatus =
  | 'reference'
  | 'complete'
  | 'scaffolded';

export type NormalizedMeasurementProvenance =
  | 'FROM_PLAN'
  | 'FROM_NOTES'
  | 'USER_ENTERED'
  | 'PLANNING_ESTIMATE'
  | 'NEEDS_CONFIRMATION';

export type TradeMeasurementTier = 'primary' | 'more' | 'calculated';

/**
 * Declarative measurement contract only — not authoritative for extraction,
 * calculations, pricing, or Confirm Scope behavior in Phase 0.
 */
export type TradeMeasurementDefinition = {
  key: string;
  label: string;
  unit: string;
  tier: TradeMeasurementTier;
  quickMeasurementKey?: string;
  calculatedFrom?: string[];
};

/**
 * Declarative scope metadata only — not wired into pricing in Phase 0.
 */
export type TradeScopeItemDefinition = {
  scopeItemId: string;
  pricingBehavior?: ScopePricingBehavior;
  measurementKeys?: string[];
  includedWhenSystem?: string;
};

export type SubcontractorTradeDefinition = {
  key: SubcontractorTradeKey;
  label: string;
  status: SubcontractorTradeStatus;
  standaloneTemplateKey?: string;
  scopeHint: string;
  missingInfo: string[];
  measurements: TradeMeasurementDefinition[];
  scopeItems: TradeScopeItemDefinition[];
  allowedScopeItemIds: string[];
  reviewMeasurementKeys: string[];
  reviewScopeKeywords: string[];
  quickMeasurementFieldKeys: string[];
};

export type TradeMeasurementInputSource = 'plan' | 'notes' | 'manual';

export type NormalizedTradeMeasurements = {
  measurements: Record<string, number | string | null | undefined>;
  quickMeasurementSources?: Record<string, string>;
  measurementProvenance?: Record<string, unknown>;
  measurementConflicts?: unknown[];
  /** Nested measurement fields that do not fit the flat scalar map. */
  structuredMeasurements?: Record<string, unknown>;
};
