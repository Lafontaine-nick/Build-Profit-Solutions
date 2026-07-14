import type { MeasurementConfidence, MeasurementStatus, UnifiedConfidence } from './types';

function lower(a: MeasurementConfidence, b: MeasurementConfidence): MeasurementConfidence {
  const rank: Record<MeasurementConfidence, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  return rank[a] <= rank[b] ? a : b;
}

export function buildUnifiedConfidence(input: {
  hasPrimaryTakeoff?: boolean;
  measurementStatus?: MeasurementStatus | null;
  selectedSource?: string | null;
  localSampleCount?: number | null;
  similarityConfidence?: MeasurementConfidence | null;
  scopeGapsUnresolved?: boolean;
  livingSfOnlyFromPlan?: boolean;
}): UnifiedConfidence {
  const source = String(input.selectedSource || '').toLowerCase();

  let sourceConfidence: MeasurementConfidence = 'unknown';
  let priceConfidence: MeasurementConfidence = 'unknown';

  if (/saved|contractor|user_entered|project_quote/.test(source)) {
    sourceConfidence = 'high';
    priceConfidence = input.hasPrimaryTakeoff ? 'high' : 'medium';
  } else if (/local_benchmark|blended/.test(source)) {
    sourceConfidence = 'medium';
    const samples = Number(input.localSampleCount) || 0;
    priceConfidence = samples >= 4 ? 'medium' : 'low';
  } else if (/national/.test(source)) {
    sourceConfidence = 'low';
    priceConfidence = 'low';
  } else if (/template|saved_rate/.test(source)) {
    sourceConfidence = 'high';
    priceConfidence = 'medium';
  }

  // Accurate living-SF extraction alone cannot create High price confidence.
  if (input.livingSfOnlyFromPlan && !/saved|contractor|user_entered/.test(source)) {
    priceConfidence = lower(priceConfidence, 'medium');
    if (priceConfidence === 'high') priceConfidence = 'medium';
  }

  let quantityConfidence: MeasurementConfidence = input.hasPrimaryTakeoff ? 'medium' : 'low';
  if (
    input.measurementStatus === 'needs_takeoff' ||
    input.measurementStatus === 'needs_structural_takeoff' ||
    input.measurementStatus === 'benchmark_only' ||
    input.measurementStatus === 'needs_count'
  ) {
    quantityConfidence = 'low';
  }
  if (input.measurementStatus === 'measured' && input.hasPrimaryTakeoff) {
    quantityConfidence = 'high';
  }

  let scopeConfidence: MeasurementConfidence = input.scopeGapsUnresolved ? 'low' : 'medium';
  if (input.measurementStatus === 'measured' && !input.scopeGapsUnresolved) {
    scopeConfidence = 'high';
  }

  return {
    scopeConfidence,
    quantityConfidence,
    priceConfidence,
    sourceConfidence,
    similarityConfidence: input.similarityConfidence || undefined,
  };
}
