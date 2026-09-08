import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  BATHROOM_DRYWALL_PATCH_REF_SQFT,
  defaultBathroomEntireRoomPaintSqft,
  hasPaintRepairScopeSelection,
  resolveBathroomPaintRepairScope,
  type BathroomPaintRepairScope,
} from '@/utils/bathroomDrywallPaintScope';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';

export type BathroomPaintRepairSeverity = 'minor' | 'moderate' | 'heavy';

export const BATHROOM_PAINT_REPAIR_SEVERITY_OPTIONS: Array<{
  id: BathroomPaintRepairSeverity;
  label: string;
  helper: string;
}> = [
  {
    id: 'minor',
    label: 'Minor patchwork',
    helper: 'Small cuts, nail holes, or a single opening — lighter repair allowance.',
  },
  {
    id: 'moderate',
    label: 'Moderate patchwork',
    helper: 'Typical wet-area adjacent repair — standard combined patch and paint.',
  },
  {
    id: 'heavy',
    label: 'Heavy patchwork',
    helper: 'Larger patches or multiple areas — more skim, texture, and paint labor.',
  },
];

/** Wall/ceiling SF above this reads as full-room paint (patch included). */
export const BATHROOM_FULL_ROOM_PAINT_SQFT_THRESHOLD = 220;

export function parseBathroomWallPaintSqft(
  value: string | number | null | undefined
): number | null {
  const parsed = parseScopeMeasurementInput(String(value ?? ''));
  if (parsed == null || !(parsed > 0)) return null;
  return Math.round(parsed);
}

export function resolveBathroomPaintRepairSeverity(
  value: string | null | undefined
): BathroomPaintRepairSeverity {
  if (value === 'minor' || value === 'heavy') return value;
  return 'moderate';
}

export function bathroomPaintRepairSeverityMultiplier(
  severity: BathroomPaintRepairSeverity
): number {
  switch (severity) {
    case 'minor':
      return 0.88;
    case 'heavy':
      return 1.22;
    default:
      return 1;
  }
}

export function inferBathroomPaintRepairScopeFromMeasurements(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
  notes?: string | null;
}): BathroomPaintRepairScope | null {
  const wallSf = parseBathroomWallPaintSqft(params.wallPaintSqft);
  if (wallSf == null) {
    const fallback = defaultBathroomEntireRoomPaintSqft({
      wallPaintSqft: params.wallPaintSqft,
      bathroomFloorSqft: params.bathroomFloorSqft,
    });
    if (fallback != null && fallback >= BATHROOM_FULL_ROOM_PAINT_SQFT_THRESHOLD) {
      return 'full_room';
    }
    return null;
  }
  if (wallSf >= BATHROOM_FULL_ROOM_PAINT_SQFT_THRESHOLD) return 'full_room';
  return 'affected_area';
}

export function paintRepairScopeSelectionComplete(params: {
  localizedScope?: string | null;
  entireRoom?: boolean | null;
  legacyScope?: string | null;
  scopeSource?: 'user_selected' | 'ai_inferred' | null;
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
  enteredTakeoffSqft?: number | null;
}): boolean {
  if (
    hasPaintRepairScopeSelection({
      localizedScope: params.localizedScope,
      entireRoom: params.entireRoom,
      legacyScope: params.legacyScope,
      scopeSource: params.scopeSource,
    })
  ) {
    return true;
  }
  const inferred = inferBathroomPaintRepairScopeFromMeasurements({
    wallPaintSqft: params.wallPaintSqft,
    bathroomFloorSqft: params.bathroomFloorSqft,
  });
  if (!inferred) return false;
  const entered = params.enteredTakeoffSqft;
  const wallSf = parseBathroomWallPaintSqft(params.wallPaintSqft);
  return (wallSf != null && wallSf > 0) || (entered != null && entered > 0);
}

export function bathroomPaintRepairUsesAutoFlow(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
  enteredTakeoffSqft?: number | null;
  scopeSource?: 'user_selected' | 'ai_inferred' | null;
}): boolean {
  const wallSf = parseBathroomWallPaintSqft(params.wallPaintSqft);
  if (wallSf != null && wallSf > 0) return true;
  if (params.enteredTakeoffSqft != null && params.enteredTakeoffSqft > 0) {
    return params.scopeSource !== 'user_selected';
  }
  return false;
}

export function shouldShowPaintRepairAdvancedQuestions(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
  enteredTakeoffSqft?: number | null;
  scopeSource?: 'user_selected' | 'ai_inferred' | null;
  promptExpanded?: boolean;
}): boolean {
  if (params.promptExpanded) return true;
  return !bathroomPaintRepairUsesAutoFlow(params);
}

export function formatPaintRepairAutoFlowSummary(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
  enteredTakeoffSqft?: number | null;
  paintRepairScope?: string | null;
  severity?: string | null;
}): string {
  const scope =
    resolveBathroomPaintRepairScope(params.paintRepairScope) ??
    inferBathroomPaintRepairScopeFromMeasurements(params);
  const sqft =
    params.enteredTakeoffSqft ??
    parseBathroomWallPaintSqft(params.wallPaintSqft) ??
    defaultBathroomEntireRoomPaintSqft({
      wallPaintSqft: params.wallPaintSqft,
      bathroomFloorSqft: params.bathroomFloorSqft,
    });
  const severityLabel = BATHROOM_PAINT_REPAIR_SEVERITY_OPTIONS.find(
    opt => opt.id === resolveBathroomPaintRepairSeverity(params.severity)
  )?.label;
  if (scope === 'full_room') {
    return sqft != null && sqft > 0
      ? `Full-room paint on ${sqft.toLocaleString()} SF — patch, texture, primer, and paint included.`
      : 'Full-room paint — patch, texture, primer, and paint included.';
  }
  const sfLine =
    sqft != null && sqft > 0
      ? `${sqft.toLocaleString()} SF`
      : `${BATHROOM_DRYWALL_PATCH_REF_SQFT} SF planning basis`;
  return `${severityLabel ?? 'Moderate patchwork'} · ${sfLine} · combined patch, texture, primer, and paint.`;
}

/** Infer scope/combined/severity from Quick measurements, then mirror Paint SF into paint_repair. */
export function syncBathroomPaintRepairFlow(
  input: ScopeMeasurementsInputExtended,
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): ScopeMeasurementsInputExtended {
  void checklistItems;
  let next: ScopeMeasurementsInputExtended = { ...input };

  const wallSf = parseBathroomWallPaintSqft(next.wallPaintSqft);
  const inferredScope =
    next.bathroomPaintRepairScopeSource !== 'user_selected'
      ? inferBathroomPaintRepairScopeFromMeasurements({
          wallPaintSqft: next.wallPaintSqft,
          bathroomFloorSqft: next.bathroomFloorSqft,
        })
      : null;

  if (inferredScope && next.bathroomPaintRepairScopeSource !== 'user_selected') {
    next = {
      ...next,
      bathroomPaintRepairScope: inferredScope,
      bathroomPaintRepairScopeSource: 'ai_inferred',
      bathroomPaintRepairEntireRoom: inferredScope === 'full_room',
      bathroomPaintRepairEntireRoomSource: 'ai_inferred',
    };
  }

  const scope = resolveBathroomPaintRepairScope(next.bathroomPaintRepairScope);
  if (
    scope === 'affected_area' &&
    next.bathroomDrywallPaintUseCombinedAssemblySource !== 'user_selected'
  ) {
    next = {
      ...next,
      bathroomDrywallPaintUseCombinedAssembly: true,
      bathroomDrywallPaintUseCombinedAssemblySource: 'ai_inferred',
    };
  }

  if (!next.bathroomPaintRepairSeverity) {
    next = {
      ...next,
      bathroomPaintRepairSeverity: 'moderate',
      bathroomPaintRepairSeveritySource: 'ai_inferred',
    };
  }

  const existing = next.itemQuantities?.paint_repair;
  const locked =
    existing?.quantitySource === 'user_entered' ||
    existing?.quantitySource === 'manual_override' ||
    existing?.quantitySource === 'calculated_confirmed' ||
    existing?.quantitySource === 'notes' ||
    existing?.quantitySource === 'plan_vision';

  if (!locked && scope) {
    const bathFloor = parseBathroomWallPaintSqft(next.bathroomFloorSqft);
    const resolvedWall =
      wallSf != null &&
      bathFloor != null &&
      wallSf === bathFloor
        ? defaultBathroomEntireRoomPaintSqft({
            wallPaintSqft: null,
            bathroomFloorSqft: next.bathroomFloorSqft,
          })
        : wallSf;
    const qty =
      resolvedWall ??
      defaultBathroomEntireRoomPaintSqft({
        wallPaintSqft: next.wallPaintSqft,
        bathroomFloorSqft: next.bathroomFloorSqft,
      });
    if (qty != null && qty > 0) {
      const currentQty = parseScopeMeasurementInput(String(existing?.quantity ?? ''));
      if (currentQty !== qty || existing?.quantitySource !== 'inferred') {
        next = {
          ...next,
          itemQuantities: {
            ...(next.itemQuantities || {}),
            paint_repair: {
              quantity: String(qty),
              unit: 'sqft',
              quantitySource: 'inferred',
            },
          },
        };
      }
    }
  } else if (
    !locked &&
    existing?.quantitySource === 'inferred' &&
    !(wallSf != null && wallSf > 0)
  ) {
    const itemQuantities = { ...(next.itemQuantities || {}) };
    delete itemQuantities.paint_repair;
    next = { ...next, itemQuantities };
  }

  return next;
}
