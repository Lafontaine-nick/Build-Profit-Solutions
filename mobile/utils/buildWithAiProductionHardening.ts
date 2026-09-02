import type { EstimateFeedbackResult, RateVersion } from '@/utils/estimateFeedback';
import type { EstimateReadinessSnapshot } from '@/utils/estimateReadiness';
import type { UnitCode } from '@/utils/scopeIntelligence';

export const BUILD_WITH_AI_PRODUCTION_HARDENING_VERSION = '1.0.0';

export type BuildWithAiErrorCode =
  | 'AI_PARSE_TIMEOUT'
  | 'AI_PARSE_FAILED'
  | 'AI_INVALID_RESPONSE'
  | 'UNSUPPORTED_UNIT'
  | 'FORMULA_FAILED'
  | 'PRICING_SOURCE_UNAVAILABLE'
  | 'SAVED_RATE_LOOKUP_FAILED'
  | 'DATABASE_FAILURE'
  | 'MIGRATION_FAILURE'
  | 'PERMISSION_DENIED'
  | 'NETWORK_FAILURE'
  | 'OFFLINE'
  | 'INVALID_TOTAL'
  | 'SNAPSHOT_FAILURE'
  | 'CALIBRATION_FAILURE'
  | 'FILE_IMPORT_FAILURE'
  | 'UNKNOWN';

export type RetryGuidance = 'retry_now' | 'retry_later' | 'continue_manually' | 'contact_support' | 'do_not_retry';

export type BuildWithAiSafeError = {
  code: BuildWithAiErrorCode;
  userMessage: string;
  retryGuidance: RetryGuidance;
  partialWorkSaved: boolean;
  correlationId: string;
  diagnosticContext?: Record<string, string | number | boolean | null>;
};

export type BuildWithAiFeatureFlagKey =
  | 'formulaSuggestions'
  | 'assemblyNotices'
  | 'pricingIntelligence'
  | 'readinessScoring'
  | 'actualVsEstimatedFeedback'
  | 'calibrationApproval'
  | 'advancedScopeGapDetection'
  | 'benchmarkEngine'
  | 'measurementSemantics';

export type BuildWithAiFeatureFlags = Record<BuildWithAiFeatureFlagKey, boolean>;

export type BuildWithAiRole = 'field' | 'foreman' | 'manager' | 'admin' | 'owner' | 'view_only';
export type BuildWithAiAction =
  | 'view_estimate_totals'
  | 'view_markup'
  | 'view_margin'
  | 'view_saved_rates'
  | 'edit_pricing'
  | 'edit_scope'
  | 'accept_formula'
  | 'resolve_risk'
  | 'mark_bid_ready'
  | 'view_actual_costs'
  | 'view_profit'
  | 'approve_calibration'
  | 'update_company_rates'
  | 'export_estimate'
  | 'delete_estimate'
  | 'restore_estimate';

export type BuildWithAiPerformanceBudgetKey =
  | 'confirmScopeInitialRenderMs'
  | 'scopeIntelligenceEvaluationMs'
  | 'readinessEvaluationMs'
  | 'formulaEvaluationPerItemMs'
  | 'feedbackEvaluationMs'
  | 'largeEstimateReviewRenderMs'
  | 'autosaveAcknowledgementMs';

export type BuildWithAiPerformanceBudgets = Record<BuildWithAiPerformanceBudgetKey, number>;

export type BuildWithAiSupportDiagnostics = {
  estimateId?: string;
  projectId?: string;
  appVersion?: string;
  schemaVersion?: string;
  aiParseVersion?: string;
  formulaRegistryVersion?: string;
  readinessVersion?: string;
  feedbackVersion?: string;
  pricingIntelligenceVersion?: string;
  lastSaveTimestamp?: string;
  lastErrorCode?: BuildWithAiErrorCode;
  featureFlags: Partial<BuildWithAiFeatureFlags>;
  userRole?: BuildWithAiRole;
  device?: {
    os?: string;
    appBuild?: string;
    screenClass?: 'small_phone' | 'large_phone' | 'tablet' | 'web' | 'unknown';
  };
  network?: {
    state?: 'online' | 'offline' | 'degraded' | 'unknown';
  };
  correlationIds: string[];
};

export type BuildWithAiAuditAction =
  | 'estimate_created'
  | 'notes_parsed'
  | 'quantity_changed'
  | 'formula_accepted'
  | 'pricing_changed'
  | 'saved_rate_selected'
  | 'national_average_selected'
  | 'scope_added'
  | 'scope_removed'
  | 'risk_resolved'
  | 'estimate_marked_bid_ready'
  | 'readiness_snapshot_created'
  | 'actual_mapping_confirmed'
  | 'calibration_accepted'
  | 'rate_version_created'
  | 'estimate_exported'
  | 'estimate_deleted'
  | 'estimate_restored';

export type BuildWithAiAuditEntry = {
  id: string;
  action: BuildWithAiAuditAction;
  entityType: 'estimate' | 'scope_item' | 'rate' | 'snapshot' | 'feedback' | 'file' | 'project';
  entityId: string;
  userId?: string;
  createdAt: string;
  correlationId: string;
  source: 'mobile' | 'backend' | 'system';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type BuildWithAiIntegrityIssue = {
  code:
    | 'NEGATIVE_QUANTITY'
    | 'NEGATIVE_RATE'
    | 'INVALID_PERCENTAGE'
    | 'FRACTIONAL_EACH_COUNT'
    | 'UNSUPPORTED_UNIT'
    | 'INVALID_TOTAL'
    | 'MISSING_RULE_VERSION'
    | 'MISSING_ALGORITHM_VERSION'
    | 'MISSING_RATE_PARENT'
    | 'MISSING_RATE_EVIDENCE'
    | 'MUTABLE_HISTORICAL_SNAPSHOT';
  severity: 'warning' | 'blocking';
  path: string;
  message: string;
};

export type BuildWithAiFileValidationInput = {
  filename: string;
  mimeType?: string | null;
  sizeBytes: number;
  imageWidth?: number;
  imageHeight?: number;
  pdfPageCount?: number;
};

export type BuildWithAiFileValidationResult = {
  allowed: boolean;
  issues: string[];
  sanitizedFilename: string;
};

export type BuildWithAiOperationRecord = {
  operation: string;
  idempotencyKey: string;
  fingerprint: string;
  entityId?: string;
  createdAt: string;
};

export const DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS: BuildWithAiFeatureFlags = {
  formulaSuggestions: true,
  assemblyNotices: true,
  pricingIntelligence: true,
  readinessScoring: true,
  actualVsEstimatedFeedback: true,
  calibrationApproval: false,
  advancedScopeGapDetection: true,
  benchmarkEngine: false,
  measurementSemantics: false,
};

/** Benchmark rollout is explicitly opt-in and independent of existing production flags. */
export function isBuildWithAiBenchmarkEngineEnabled(
  flags?: Partial<BuildWithAiFeatureFlags> | null
): boolean {
  if (typeof flags?.benchmarkEngine === 'boolean') return flags.benchmarkEngine;
  return String(process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 || '').toLowerCase() === 'true';
}

/** Measurement-semantics foundation is opt-in and independent of the benchmark engine flag. */
export function isBuildWithAiMeasurementSemanticsEnabled(
  flags?: Partial<BuildWithAiFeatureFlags> | null
): boolean {
  if (typeof flags?.measurementSemantics === 'boolean') return flags.measurementSemantics;
  return String(process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 || '').toLowerCase() === 'true';
}

export const BUILD_WITH_AI_PERFORMANCE_BUDGETS: BuildWithAiPerformanceBudgets = {
  confirmScopeInitialRenderMs: 1000,
  scopeIntelligenceEvaluationMs: 100,
  readinessEvaluationMs: 100,
  formulaEvaluationPerItemMs: 50,
  feedbackEvaluationMs: 150,
  largeEstimateReviewRenderMs: 1500,
  autosaveAcknowledgementMs: 1000,
};

export const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/csv',
]);

export const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf', 'csv']);

export const SUPPORTED_NORMALIZED_UNITS = new Set<string>([
  'sqft',
  'sf',
  'lf',
  'ft',
  'cy',
  'ton',
  'each',
  'ea',
  'hour',
  'hr',
  'day',
  'lump_sum',
  'allowance',
  'percent',
  '%',
]);

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createCorrelationId(prefix = 'bwai'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createIdempotencyKey(operation: string, payload: unknown, actorId?: string | null): string {
  return `${operation}:${actorId || 'anonymous'}:${simpleHash(stableStringify(payload))}`;
}

export function isDuplicateOperation(record: BuildWithAiOperationRecord, operation: string, payload: unknown, actorId?: string | null): boolean {
  return record.idempotencyKey === createIdempotencyKey(operation, payload, actorId);
}

export function createSafeError(params: {
  code: BuildWithAiErrorCode;
  cause?: unknown;
  partialWorkSaved?: boolean;
  correlationId?: string;
  diagnosticContext?: Record<string, string | number | boolean | null | undefined>;
}): BuildWithAiSafeError {
  const messageByCode: Record<BuildWithAiErrorCode, string> = {
    AI_PARSE_TIMEOUT: 'AI parsing took too long. You can retry or continue manually.',
    AI_PARSE_FAILED: 'AI could not parse these notes. You can retry or continue manually.',
    AI_INVALID_RESPONSE: 'AI returned a response that could not be safely used.',
    UNSUPPORTED_UNIT: 'A unit needs review before this estimate can be finalized.',
    FORMULA_FAILED: 'A quantity calculation failed. Existing quantities were preserved.',
    PRICING_SOURCE_UNAVAILABLE: 'Pricing is temporarily unavailable. Existing values were preserved.',
    SAVED_RATE_LOOKUP_FAILED: 'Saved pricing could not be loaded. You can retry or enter pricing manually.',
    DATABASE_FAILURE: 'The estimate could not be saved. Please retry.',
    MIGRATION_FAILURE: 'A data upgrade could not complete safely. Please retry or contact support.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    NETWORK_FAILURE: 'Network connection failed. Check your connection and retry.',
    OFFLINE: 'You appear to be offline. Work may need to be saved locally until reconnecting.',
    INVALID_TOTAL: 'An estimate total is invalid and needs review.',
    SNAPSHOT_FAILURE: 'The estimate snapshot could not be saved.',
    CALIBRATION_FAILURE: 'Calibration could not be applied. Existing rates were preserved.',
    FILE_IMPORT_FAILURE: 'The file could not be imported safely.',
    UNKNOWN: 'Something went wrong. Please retry or contact support.',
  };
  const retryByCode: Record<BuildWithAiErrorCode, RetryGuidance> = {
    AI_PARSE_TIMEOUT: 'retry_later',
    AI_PARSE_FAILED: 'retry_now',
    AI_INVALID_RESPONSE: 'continue_manually',
    UNSUPPORTED_UNIT: 'continue_manually',
    FORMULA_FAILED: 'continue_manually',
    PRICING_SOURCE_UNAVAILABLE: 'retry_later',
    SAVED_RATE_LOOKUP_FAILED: 'retry_later',
    DATABASE_FAILURE: 'retry_now',
    MIGRATION_FAILURE: 'contact_support',
    PERMISSION_DENIED: 'do_not_retry',
    NETWORK_FAILURE: 'retry_later',
    OFFLINE: 'retry_later',
    INVALID_TOTAL: 'continue_manually',
    SNAPSHOT_FAILURE: 'retry_now',
    CALIBRATION_FAILURE: 'retry_now',
    FILE_IMPORT_FAILURE: 'retry_now',
    UNKNOWN: 'retry_now',
  };
  const diagnosticContext = Object.fromEntries(
    Object.entries(params.diagnosticContext || {}).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean | null>;
  return {
    code: params.code,
    userMessage: messageByCode[params.code],
    retryGuidance: retryByCode[params.code],
    partialWorkSaved: params.partialWorkSaved ?? false,
    correlationId: params.correlationId || createCorrelationId(),
    diagnosticContext,
  };
}

export function canPerformBuildWithAiAction(role: BuildWithAiRole, action: BuildWithAiAction): boolean {
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'view_only') {
    return ['view_estimate_totals', 'export_estimate'].includes(action);
  }
  if (role === 'field') {
    return ['edit_scope', 'accept_formula', 'view_actual_costs'].includes(action);
  }
  if (role === 'foreman') {
    return [
      'view_estimate_totals',
      'view_saved_rates',
      'edit_scope',
      'accept_formula',
      'resolve_risk',
      'view_actual_costs',
      'export_estimate',
    ].includes(action);
  }
  if (role === 'manager') {
    return !['update_company_rates', 'delete_estimate', 'restore_estimate'].includes(action);
  }
  return false;
}

export function evaluatePerformanceBudget(metric: BuildWithAiPerformanceBudgetKey, durationMs: number) {
  const budgetMs = BUILD_WITH_AI_PERFORMANCE_BUDGETS[metric];
  return {
    metric,
    durationMs,
    budgetMs,
    withinBudget: durationMs <= budgetMs,
    overByMs: Math.max(0, durationMs - budgetMs),
  };
}

function isFiniteMoney(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && !Number.isNaN(n);
}

function pushIssue(issues: BuildWithAiIntegrityIssue[], issue: BuildWithAiIntegrityIssue) {
  issues.push(issue);
}

export function validateEstimateIntegrity(input: {
  quantities?: Array<{ path: string; value: number | null | undefined; unit?: UnitCode | string | null }>;
  rates?: Array<{ path: string; value: number | null | undefined }>;
  percentages?: Array<{ path: string; value: number | null | undefined; min?: number; max?: number }>;
  totals?: Array<{ path: string; value: number | null | undefined }>;
  readinessSnapshot?: Partial<EstimateReadinessSnapshot> | null;
  feedbackResult?: Partial<EstimateFeedbackResult> | null;
  rateVersion?: Partial<RateVersion> | null;
  historicalSnapshotMutationAttempt?: boolean;
}): BuildWithAiIntegrityIssue[] {
  const issues: BuildWithAiIntegrityIssue[] = [];
  for (const quantity of input.quantities || []) {
    if (quantity.value != null && quantity.value < 0) {
      pushIssue(issues, {
        code: 'NEGATIVE_QUANTITY',
        severity: 'blocking',
        path: quantity.path,
        message: 'Quantity cannot be negative.',
      });
    }
    if (quantity.unit && !SUPPORTED_NORMALIZED_UNITS.has(String(quantity.unit).toLowerCase())) {
      pushIssue(issues, {
        code: 'UNSUPPORTED_UNIT',
        severity: 'warning',
        path: `${quantity.path}.unit`,
        message: 'Unit is not in the supported normalized unit set.',
      });
    }
    if (
      quantity.value != null &&
      String(quantity.unit || '').toLowerCase().match(/^(each|ea)$/) &&
      !Number.isInteger(quantity.value)
    ) {
      pushIssue(issues, {
        code: 'FRACTIONAL_EACH_COUNT',
        severity: 'warning',
        path: quantity.path,
        message: 'Each-based counts should be whole numbers.',
      });
    }
  }
  for (const rate of input.rates || []) {
    if (rate.value != null && rate.value < 0) {
      pushIssue(issues, {
        code: 'NEGATIVE_RATE',
        severity: 'blocking',
        path: rate.path,
        message: 'Rate cannot be negative.',
      });
    }
  }
  for (const percentage of input.percentages || []) {
    const min = percentage.min ?? 0;
    const max = percentage.max ?? 100;
    if (percentage.value != null && (percentage.value < min || percentage.value > max)) {
      pushIssue(issues, {
        code: 'INVALID_PERCENTAGE',
        severity: 'blocking',
        path: percentage.path,
        message: `Percentage must be between ${min} and ${max}.`,
      });
    }
  }
  for (const total of input.totals || []) {
    if (total.value != null && !isFiniteMoney(total.value)) {
      pushIssue(issues, {
        code: 'INVALID_TOTAL',
        severity: 'blocking',
        path: total.path,
        message: 'Total must be a finite number.',
      });
    }
  }
  if (input.readinessSnapshot && !input.readinessSnapshot.version) {
    pushIssue(issues, {
      code: 'MISSING_RULE_VERSION',
      severity: 'blocking',
      path: 'readinessSnapshot.version',
      message: 'Readiness snapshot must include a rule version.',
    });
  }
  if (input.feedbackResult && !input.feedbackResult.algorithmVersion) {
    pushIssue(issues, {
      code: 'MISSING_ALGORITHM_VERSION',
      severity: 'blocking',
      path: 'feedbackResult.algorithmVersion',
      message: 'Feedback result must include an algorithm version.',
    });
  }
  if (input.rateVersion) {
    if (!input.rateVersion.parentRateId) {
      pushIssue(issues, {
        code: 'MISSING_RATE_PARENT',
        severity: 'blocking',
        path: 'rateVersion.parentRateId',
        message: 'Rate version must reference a parent rate.',
      });
    }
    if (!input.rateVersion.evidenceReferences?.length) {
      pushIssue(issues, {
        code: 'MISSING_RATE_EVIDENCE',
        severity: 'blocking',
        path: 'rateVersion.evidenceReferences',
        message: 'Calibration-created rate version must reference evidence.',
      });
    }
  }
  if (input.historicalSnapshotMutationAttempt) {
    pushIssue(issues, {
      code: 'MUTABLE_HISTORICAL_SNAPSHOT',
      severity: 'blocking',
      path: 'snapshot',
      message: 'Historical snapshots must not be edited in place.',
    });
  }
  return issues;
}

export function validateUploadForBuildWithAi(input: BuildWithAiFileValidationInput): BuildWithAiFileValidationResult {
  const sanitizedFilename = input.filename
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const extension = sanitizedFilename.split('.').pop()?.toLowerCase() || '';
  const issues: string[] = [];
  if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
    issues.push('Unsupported file extension.');
  }
  if (!input.mimeType || !SUPPORTED_UPLOAD_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    issues.push('Unsupported or missing MIME type.');
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > 20 * 1024 * 1024) {
    issues.push('File size must be greater than 0 and no more than 20 MB.');
  }
  if ((input.imageWidth && input.imageWidth > 12000) || (input.imageHeight && input.imageHeight > 12000)) {
    issues.push('Image dimensions are too large.');
  }
  if (input.pdfPageCount && input.pdfPageCount > 50) {
    issues.push('PDF page count exceeds the supported limit.');
  }
  return {
    allowed: issues.length === 0,
    issues,
    sanitizedFilename: sanitizedFilename || 'upload',
  };
}

export function buildSupportDiagnostics(input: Partial<BuildWithAiSupportDiagnostics>): BuildWithAiSupportDiagnostics {
  return {
    featureFlags: input.featureFlags || {},
    correlationIds: input.correlationIds || [],
    estimateId: input.estimateId,
    projectId: input.projectId,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    aiParseVersion: input.aiParseVersion,
    formulaRegistryVersion: input.formulaRegistryVersion,
    readinessVersion: input.readinessVersion,
    feedbackVersion: input.feedbackVersion,
    pricingIntelligenceVersion: input.pricingIntelligenceVersion,
    lastSaveTimestamp: input.lastSaveTimestamp,
    lastErrorCode: input.lastErrorCode,
    userRole: input.userRole,
    device: input.device,
    network: input.network,
  };
}

export function createAuditEntry(input: Omit<BuildWithAiAuditEntry, 'id' | 'createdAt' | 'correlationId'> & {
  createdAt?: string;
  correlationId?: string;
}): BuildWithAiAuditEntry {
  const correlationId = input.correlationId || createCorrelationId('audit');
  return {
    ...input,
    id: `${input.action}:${input.entityType}:${input.entityId}:${simpleHash(correlationId)}`,
    createdAt: input.createdAt || new Date().toISOString(),
    correlationId,
  };
}
