import type { MeasurementSource } from './types';

export function formatPlanSourceLabel(input: {
  kind:
    | 'cover_sheet'
    | 'foundation_plan'
    | 'dimensions'
    | 'framing_plan'
    | 'elevations'
    | 'electrical_plan'
    | 'roof_geometry'
    | 'user_entered'
    | 'standard_assumption'
    | 'needs_takeoff'
    | 'needs_allowance'
    | 'plan_generic';
  page?: number | null;
  pageEnd?: number | null;
}): string {
  const page =
    input.page != null && Number.isFinite(input.page)
      ? input.pageEnd != null && input.pageEnd !== input.page
        ? `pages ${input.page}–${input.pageEnd}`
        : `page ${input.page}`
      : null;

  switch (input.kind) {
    case 'cover_sheet':
      return page
        ? `Explicitly stated on cover sheet — ${page}`
        : 'Explicitly stated on cover sheet';
    case 'foundation_plan':
      return page ? `Detected from foundation plan — ${page}` : 'Detected from foundation plan';
    case 'dimensions':
      return page ? `Derived from dimensions — ${page}` : 'Derived from dimensions';
    case 'framing_plan':
      return page ? `Detected from framing plan — ${page}` : 'Detected from framing plan';
    case 'elevations':
      return page ? `Detected from elevations — ${page}` : 'Detected from elevations';
    case 'electrical_plan':
      return page ? `Detected from electrical plan — ${page}` : 'Detected from electrical plan';
    case 'roof_geometry':
      return page ? `Derived from roof geometry — ${page}` : 'Derived from roof geometry';
    case 'user_entered':
      return 'User entered';
    case 'standard_assumption':
      return 'Standard assumption';
    case 'needs_takeoff':
      return 'Needs takeoff';
    case 'needs_allowance':
      return 'Needs allowance';
    default:
      return page ? `Detected from plan — ${page}` : 'Detected from plan';
  }
}

export function sourceTypeFromQuantitySource(
  quantitySource?: string | null
): MeasurementSource {
  switch (quantitySource) {
    case 'plan_vision':
    case 'plan_explicit':
      return 'plan_explicit';
    case 'plan_derived':
    case 'inferred':
    case 'calculated_confirmed':
      return 'plan_derived';
    case 'user_entered':
    case 'manual_override':
      return 'user_entered';
    case 'default_assumption':
      return 'standard_assumption';
    case 'notes':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/** Never label plan-sheet values as "Mentioned in notes". */
export function isPlanSheetSource(sourceType: MeasurementSource): boolean {
  return sourceType === 'plan_explicit' || sourceType === 'plan_derived';
}
