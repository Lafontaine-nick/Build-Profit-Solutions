import {
  ELECTRICAL_CARD_GROUPS,
  ELECTRICAL_CARDS,
  electricalCardForMeasurementKey,
  type ElectricalCardGroupId,
  type ElectricalPanelLocation,
  type ElectricalProjectCondition,
  type ElectricalQuantityKey,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { quantityProvenanceLabel } from '@/utils/suggestedPricingCardUi';

export type ElectricalQmField = {
  key: ElectricalQuantityKey;
  itemId: string;
  label: string;
  unit: 'EA' | 'LF';
  value: number | null;
  selected: boolean;
  conflicted: boolean;
  provenanceLabel: string | null;
};

export type ElectricalQmGroup = {
  id: ElectricalCardGroupId;
  title: string;
  fields: ElectricalQmField[];
  selectedCount: number;
};

const QM_GROUP_TITLES: Record<ElectricalCardGroupId, string> = {
  service_panels: 'Project / service',
  circuits: 'Circuits',
  receptacles: 'Receptacles',
  switches: 'Switches / controls',
  lighting: 'Lighting / fans',
  fans: 'Lighting / fans',
  appliances: 'Appliance circuit + hookup',
  life_safety: 'Life safety / low voltage',
  rough_modifications: 'Modifications',
};

export const ELECTRICAL_ATTRIBUTE_CARD_TITLES = [
  'Job condition',
  'Service amperage',
  'Panel location',
  'Packages',
  'Conduit / trenching',
] as const;

export function electricalConfirmScopeCardTitles(
  groups = buildElectricalQuickMeasurementGroups({})
): string[] {
  return [
    ELECTRICAL_ATTRIBUTE_CARD_TITLES[0],
    ELECTRICAL_ATTRIBUTE_CARD_TITLES[1],
    ELECTRICAL_ATTRIBUTE_CARD_TITLES[2],
    ...groups.map(group => group.title),
    ELECTRICAL_ATTRIBUTE_CARD_TITLES[3],
    ELECTRICAL_ATTRIBUTE_CARD_TITLES[4],
  ];
}

const QM_GROUP_CAPTIONS: Record<ElectricalCardGroupId, string> = {
  service_panels: 'Select every service component included in this bid. Measurements feed the corresponding pricing cards.',
  circuits: 'Homeruns and dedicated circuits are explicit-only. Leave blank unless printed or you enter them.',
  receptacles: 'Select every receptacle type included in this bid. Measurements feed the corresponding pricing cards.',
  switches: 'Switch devices own the location. Do not also count a dimmer, occupancy, or smart switch as a single-pole.',
  lighting: 'Fixtures and fans. Recessed lights use R4 instance tags when those tags represent one fixture.',
  fans: 'Fixtures and fans. Recessed lights use R4 instance tags when those tags represent one fixture.',
  appliances: 'Each card is the dedicated circuit plus the connection — not a plug-in only. Counts feed the corresponding pricing cards.',
  life_safety: 'Smoke, CO, and low-voltage devices included in this bid.',
  rough_modifications: 'Relocate, extend, and extra devices beyond the counted layout.',
};

export function electricalQmGroupCaption(groupId: ElectricalCardGroupId): string {
  return QM_GROUP_CAPTIONS[groupId];
}

/** Parent Confirm Scope pricing must not commit in the same frame as a chip tap. */
export const CONFIRM_SCOPE_CHIP_COMMIT_MS = 180;

/** Ignore a second press that would toggle the chip back off before it can paint. */
export const CONFIRM_SCOPE_CHIP_PRESS_LOCK_MS = 120;

/** Finger travel, in points, that turns a chip press into a scroll. */
export const CONFIRM_SCOPE_CHIP_SCROLL_SLOP = 20;

export function confirmScopeChipIsTap(
  dx: number,
  dy: number,
  slop = CONFIRM_SCOPE_CHIP_SCROLL_SLOP
): boolean {
  return dx * dx + dy * dy <= slop * slop;
}

export function confirmScopeChipPainted(
  selected: boolean,
  optimistic: boolean | null,
  _allowOptimisticDeselect = false
): boolean {
  if (optimistic != null) return optimistic;
  return selected;
}

export function electricalScopeGroupDefaultCollapsed(
  _templateKey?: string | null,
  _quickMeasurementsOpen?: boolean,
  _groupTitle?: string
): boolean {
  return false;
}

export function electricalQmOptionActive(field: Pick<ElectricalQmField, 'selected' | 'conflicted'>): boolean {
  return Boolean(field.selected) && !field.conflicted;
}

export function electricalQmChipSelected(
  field: Pick<ElectricalQmField, 'selected' | 'conflicted'>,
  _expanded: boolean
): boolean {
  if (field.conflicted) return false;
  // Opening a quantity editor is not the same as including the scope item.
  // Keep the chip gray until an EA/LF quantity is actually selected.
  return electricalQmOptionActive(field);
}

/** Quantity to write on a scope-chip tap. `null` means expand/collapse only (LF or conflicted). */
export function electricalQmTapQuantity(
  field: Pick<ElectricalQmField, 'unit' | 'selected' | 'conflicted'>
): string | null {
  if (field.conflicted) return null;
  if (field.selected) return '';
  if (field.unit === 'EA') return '1';
  return null;
}

/** Controlled input value. A local draft must win so conflicted rows can be typed. */
export function electricalQmQuantityInputValue(
  field: Pick<ElectricalQmField, 'value' | 'conflicted'>,
  draftValue?: string
): string {
  if (draftValue != null) return draftValue;
  if (field.conflicted) return '';
  return field.value != null ? String(field.value) : '';
}

export function electricalQmShowsQuantity(
  field: Pick<ElectricalQmField, 'selected' | 'conflicted'>,
  expanded: boolean
): boolean {
  return electricalQmOptionActive(field) || expanded;
}

export function electricalQmGroupDefaultCollapsed(): boolean {
  // Rendering every quantity row at once blocks the JS thread while the
  // attribute cards above are receiving taps. Keep headers mounted and let the
  // contractor expand only the quantity groups they need.
  return true;
}

const QM_GROUP_ORDER: ElectricalCardGroupId[] = [
  'service_panels',
  'circuits',
  'receptacles',
  'switches',
  'lighting',
  'appliances',
  'life_safety',
  'rough_modifications',
];

function positiveQuantity(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value && 'quantity' in (value as object)) {
    return positiveQuantity((value as { quantity?: unknown }).quantity);
  }
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function electricalQmUnit(unit: 'each' | 'amp' | 'lf' | string): 'EA' | 'LF' {
  return unit === 'lf' ? 'LF' : 'EA';
}

export function unresolvedElectricalConflictFields(
  conflicts: Array<{ field?: string | null; requiresConfirmation?: boolean } | null | undefined>
): Set<string> {
  const out = new Set<string>();
  for (const conflict of conflicts) {
    const field = String(conflict?.field || '').trim();
    if (!field || conflict?.requiresConfirmation === false) continue;
    out.add(field);
  }
  return out;
}

export function buildElectricalQuickMeasurementGroups(input: {
  measurements?: Record<string, unknown> | null;
  conflictFields?: Iterable<string>;
  sources?: Record<string, string | undefined> | null;
  userOverrides?: Record<string, boolean | undefined> | null;
}): ElectricalQmGroup[] {
  const measurements = input.measurements || {};
  const conflicted = new Set(
    [...(input.conflictFields || [])].map(key => String(key))
  );
  const byGroup = new Map<ElectricalCardGroupId, ElectricalQmField[]>();

  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    const userResolved = Boolean(input.userOverrides?.[card.measurementKey]);
    const conflictedField =
      conflicted.has(card.measurementKey) && !userResolved;
    const value = conflictedField
      ? null
      : positiveQuantity(measurements[card.measurementKey]);
    const selected = value != null;
    const source = input.userOverrides?.[card.measurementKey]
      ? 'user'
      : input.sources?.[card.measurementKey] || null;
    const field: ElectricalQmField = {
      key: card.measurementKey,
      itemId: card.itemId,
      label: card.label,
      unit: electricalQmUnit(card.unit),
      value,
      selected,
      conflicted: conflictedField,
      provenanceLabel: selected
        ? quantityProvenanceLabel(source || 'plan')
        : conflictedField
          ? 'Needs confirmation'
          : null,
    };
    const list = byGroup.get(card.groupId) || [];
    list.push(field);
    byGroup.set(card.groupId, list);
  }

  const merged = new Map<string, ElectricalQmGroup>();
  for (const groupId of QM_GROUP_ORDER) {
    const title = QM_GROUP_TITLES[groupId];
    const extra =
      groupId === 'lighting' ? byGroup.get('fans') || [] : [];
    const fields = [...(byGroup.get(groupId) || []), ...extra];
    if (!fields.length) continue;
    const existing = merged.get(title);
    if (existing) {
      existing.fields.push(...fields);
      existing.selectedCount += fields.filter(field => field.selected).length;
      continue;
    }
    merged.set(title, {
      id: groupId,
      title,
      fields,
      selectedCount: fields.filter(field => field.selected).length,
    });
  }

  return [...merged.values()];
}

export function applyElectricalQuickMeasurementPatch<
  T extends {
    itemQuantities?: Record<
      string,
      { quantity?: string | number; unit?: string; quantitySource?: string }
    >;
    quickMeasurementUserOverrides?: Record<string, boolean>;
    quickMeasurementSources?: Record<string, string>;
    electricalScope?: string[] | null;
    pricingAcceptance?: Record<string, unknown>;
  },
>(prev: T, field: string, rawValue: string | number | null): T {
  const card = electricalCardForMeasurementKey(field);
  const parsed = positiveQuantity(rawValue);
  const itemQuantities = { ...(prev.itemQuantities || {}) };
  const next: T = {
    ...prev,
    [field]: parsed == null ? '' : String(parsed),
    quickMeasurementUserOverrides: {
      ...(prev.quickMeasurementUserOverrides || {}),
      [field]: true,
    },
    itemQuantities,
  };
  if (!card) return next;
  if (parsed == null) {
    delete itemQuantities[card.itemId];
    const pricingAcceptance = { ...(prev.pricingAcceptance || {}) };
    delete pricingAcceptance[card.itemId];
    return {
      ...next,
      itemQuantities,
      electricalScope: Array.isArray(prev.electricalScope)
        ? prev.electricalScope.filter(id => id !== card.itemId)
        : prev.electricalScope,
      pricingAcceptance,
    };
  }
  itemQuantities[card.itemId] = {
    quantity: String(parsed),
    unit: card.unit,
    quantitySource: 'user_entered',
  };
  return next;
}

export function restorePlanMeasurementConflict<
  T extends {
    itemQuantities?: Record<
      string,
      { quantity?: string | number; unit?: string; quantitySource?: string }
    >;
    quickMeasurementUserOverrides?: Record<string, boolean>;
    electricalScope?: string[] | null;
    pricingAcceptance?: Record<string, unknown>;
    measurementConflicts?: Array<{ field?: string }>;
  },
>(
  prev: T,
  field: string,
  originalConflict?: { field?: string } | null
): T {
  const next = applyElectricalQuickMeasurementPatch(prev, field, '');
  const overrides = { ...(next.quickMeasurementUserOverrides || {}) };
  delete overrides[field];
  const conflicts = (next.measurementConflicts || []).filter(
    row => String(row?.field || '') !== field
  );
  if (originalConflict && originalConflict.field) {
    conflicts.push(originalConflict);
  }
  return {
    ...next,
    quickMeasurementUserOverrides: overrides,
    measurementConflicts: conflicts,
  };
}

export type ElectricalConfirmScopeAttributes = {
  electricalProjectCondition: ElectricalProjectCondition | null;
  serviceAmperage: number | null;
  existingServiceAmperage: number | null;
  electricalPanelLocation: ElectricalPanelLocation | null;
  electricalMeterMainCombo: boolean;
  electricalIncludeRough: boolean;
  electricalIncludeTrim: boolean;
  electricalConduit: boolean;
  electricalTrenching: boolean;
};

function positiveAmp(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function electricalServiceAmperageTap(
  current: number | null | undefined,
  tapped: number
): number | null {
  return Number(current) === tapped ? null : tapped;
}

export function electricalConfirmScopeAttributesFromMeasurements(
  measurements: Record<string, unknown>
): ElectricalConfirmScopeAttributes {
  const location = measurements.electricalPanelLocation;
  return {
    electricalProjectCondition:
      measurements.electricalProjectCondition === 'new_construction' ||
      measurements.electricalProjectCondition === 'remodel_open_wall' ||
      measurements.electricalProjectCondition === 'finished_wall_service'
        ? measurements.electricalProjectCondition
        : null,
    serviceAmperage: positiveAmp(measurements.serviceAmperage),
    existingServiceAmperage: positiveAmp(measurements.existingServiceAmperage),
    electricalPanelLocation:
      location === 'indoor' || location === 'outdoor' ? location : null,
    electricalMeterMainCombo: Boolean(measurements.electricalMeterMainCombo),
    electricalIncludeRough: Boolean(measurements.electricalIncludeRough),
    electricalIncludeTrim: Boolean(measurements.electricalIncludeTrim),
    electricalConduit: Boolean(measurements.electricalConduit),
    electricalTrenching: Boolean(measurements.electricalTrenching),
  };
}

export function electricalConfirmScopeAttributesEqual(
  a: ElectricalConfirmScopeAttributes,
  b: ElectricalConfirmScopeAttributes
): boolean {
  return (
    a.electricalProjectCondition === b.electricalProjectCondition &&
    a.serviceAmperage === b.serviceAmperage &&
    a.existingServiceAmperage === b.existingServiceAmperage &&
    a.electricalPanelLocation === b.electricalPanelLocation &&
    a.electricalMeterMainCombo === b.electricalMeterMainCombo &&
    a.electricalIncludeRough === b.electricalIncludeRough &&
    a.electricalIncludeTrim === b.electricalIncludeTrim &&
    a.electricalConduit === b.electricalConduit &&
    a.electricalTrenching === b.electricalTrenching
  );
}

/**
 * Attribute chips price cards below Quick Measurements (panel amperage,
 * location, condition, packages, raceway). Those writes must reach React
 * state immediately. Quantity EA/LF taps can stay staged.
 */
export const ELECTRICAL_LIVE_PRICING_ATTRIBUTE_KEYS = [
  'electricalProjectCondition',
  'serviceAmperage',
  'existingServiceAmperage',
  'electricalPanelLocation',
  'electricalMeterMainCombo',
  'electricalIncludeRough',
  'electricalIncludeTrim',
  'electricalConduit',
  'electricalTrenching',
] as const;

export function electricalLivePricingAttributesChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  return ELECTRICAL_LIVE_PRICING_ATTRIBUTE_KEYS.some(
    key => previous[key] !== next[key]
  );
}

/** EA/LF quantity keys — used to distinguish quantity edits from attributes. */
export function electricalQuantityFieldsChanged(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): boolean {
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    if (previous[card.measurementKey] !== next[card.measurementKey]) {
      return true;
    }
  }
  return false;
}

export function electricalMeasurementsShouldFlushImmediately(
  _previous: Record<string, unknown>,
  _next: Record<string, unknown>
): boolean {
  // All Confirm Scope electrical writes are staged. The local chip state and
  // measurements ref update immediately; the expensive parent pricing tree is
  // flushed when the panel closes or the scope is confirmed.
  return false;
}

/**
 * Quantity / package fields that can change Yes/No scope cards.
 * Amperage, panel location, and job condition are excluded — those are
 * pricing attributes and must not resync the whole checklist on every tap.
 */
export function electricalScopeSyncSignature(
  measurements: Record<string, unknown>
): string {
  const parts: string[] = [];
  for (const card of ELECTRICAL_CARDS) {
    if (card.measurementKey === 'serviceAmperage') continue;
    parts.push(
      `${card.measurementKey}:${String(measurements[card.measurementKey] ?? '')}`
    );
  }
  const scope = Array.isArray(measurements.electricalScope)
    ? (measurements.electricalScope as string[]).join(',')
    : '';
  parts.push(`scope:${scope}`);
  parts.push(`rough:${measurements.electricalIncludeRough ? 1 : 0}`);
  parts.push(`trim:${measurements.electricalIncludeTrim ? 1 : 0}`);
  return parts.join('|');
}

export { ELECTRICAL_CARD_GROUPS };
