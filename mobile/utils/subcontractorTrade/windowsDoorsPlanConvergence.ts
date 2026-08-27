/**
 * Canonical Windows & doors (fenestration) plan-import contract.
 *
 * Garage doors are a separate trade. This package is windows, exterior swing
 * doors (including hinged French/patio units), explicit sliding/multi-slide
 * doors, and interior door openings. Counts are opening units, not leaves.
 */

export type WindowsDoorsQuantityKey =
  | 'windowCount'
  | 'exteriorDoorCount'
  | 'slidingDoorCount'
  | 'interiorDoorCount';

export const WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS: WindowsDoorsQuantityKey[] =
  ['windowCount', 'exteriorDoorCount', 'slidingDoorCount', 'interiorDoorCount'];

export const WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_KEYS: WindowsDoorsQuantityKey[] =
  [...WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS];

export const WINDOWS_DOORS_PLAN_SCOPE_ALLOWLIST = [
  'windows_doors',
  'windows',
  'exterior_doors',
  'sliding_doors',
  'interior_doors',
  'trim_finish',
] as const;

export const WINDOWS_DOORS_COUNT_SCOPE_ITEM_IDS = [
  'windows',
  'exterior_doors',
  'sliding_doors',
  'interior_doors',
  'windows_doors',
  'openings',
] as const;

export function isWindowsDoorsCountScopeItemId(
  itemId: string | null | undefined
): boolean {
  return WINDOWS_DOORS_COUNT_SCOPE_ITEM_IDS.includes(
    String(itemId || '') as (typeof WINDOWS_DOORS_COUNT_SCOPE_ITEM_IDS)[number]
  );
}

export const WINDOWS_DOORS_PLAN_ALIASES: Record<
  string,
  WindowsDoorsQuantityKey
> = {
  windowsCount: 'windowCount',
  exteriorDoorsCount: 'exteriorDoorCount',
  slidingDoorsCount: 'slidingDoorCount',
  interiorDoorsCount: 'interiorDoorCount',
};

const ITEM_BY_MEASUREMENT: Record<
  WindowsDoorsQuantityKey,
  { id: string; unit: 'each' }
> = {
  windowCount: { id: 'windows', unit: 'each' },
  exteriorDoorCount: { id: 'exterior_doors', unit: 'each' },
  slidingDoorCount: { id: 'sliding_doors', unit: 'each' },
  interiorDoorCount: { id: 'interior_doors', unit: 'each' },
};

function positiveCount(value: unknown): number | null {
  const count = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(count) && count > 0 ? Math.round(count) : null;
}

/** Normalize common model aliases and keep counts bounded to a practical plan range. */
export function normalizeWindowsDoorsPlanMeasurements(
  input: Record<string, unknown> = {}
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveCount(input[key]);
    const max = key === 'interiorDoorCount' ? 80 : 200;
    if (value != null && value <= max) out[key] = value;
  }
  for (const [alias, canonical] of Object.entries(WINDOWS_DOORS_PLAN_ALIASES)) {
    if (out[canonical] != null) continue;
    const value = positiveCount(input[alias]);
    const max = canonical === 'interiorDoorCount' ? 80 : 200;
    if (value != null && value <= max) out[canonical] = value;
  }
  return out;
}

/** Convert fenestration counts into Confirm Scope item quantities. */
export function buildWindowsDoorsStructuredMeasurements(
  input: Record<string, unknown> = {},
  quantitySource: 'plan_detected' | 'user_entered' = 'plan_detected'
): {
  itemQuantities: Record<
    string,
    { quantity: number; unit: 'each'; quantitySource: string }
  >;
} {
  const measurements = normalizeWindowsDoorsPlanMeasurements(input);
  const itemQuantities: Record<
    string,
    { quantity: number; unit: 'each'; quantitySource: string }
  > = {};

  for (const [key, mapping] of Object.entries(ITEM_BY_MEASUREMENT) as Array<
    [WindowsDoorsQuantityKey, { id: string; unit: 'each' }]
  >) {
    const count = measurements[key];
    if (count == null) continue;
    itemQuantities[mapping.id] = {
      quantity: count,
      unit: mapping.unit,
      quantitySource,
    };
  }

  return { itemQuantities };
}

const WINDOWS_DOORS_SCOPE_CARDS: Array<{
  itemId: (typeof WINDOWS_DOORS_COUNT_SCOPE_ITEM_IDS)[number];
  measurementKey: WindowsDoorsQuantityKey;
  label: string;
}> = [
  { itemId: 'windows', measurementKey: 'windowCount', label: 'Windows' },
  {
    itemId: 'exterior_doors',
    measurementKey: 'exteriorDoorCount',
    label: 'Exterior swing doors',
  },
  {
    itemId: 'sliding_doors',
    measurementKey: 'slidingDoorCount',
    label: 'Sliding / patio doors',
  },
  {
    itemId: 'interior_doors',
    measurementKey: 'interiorDoorCount',
    label: 'Interior doors',
  },
];

export function windowsDoorsMeasurementKeyForScopeItem(
  itemId: string | null | undefined
): WindowsDoorsQuantityKey | null {
  const id = String(itemId || '').trim();
  const card = WINDOWS_DOORS_SCOPE_CARDS.find(row => row.itemId === id);
  return card?.measurementKey ?? null;
}

function positiveOpeningCount(value: unknown): number | null {
  return positiveCount(value);
}

/** Include Windows & doors cards that already have a plan/user count. */
export function syncWindowsDoorsScopeItems<
  T extends { id: string; state?: string },
>(
  items: T[],
  quantities?: Partial<Record<WindowsDoorsQuantityKey, unknown>> & {
    itemQuantities?: Record<string, { quantity?: unknown }>;
  }
): T[] {
  const active = new Set<string>();
  for (const card of WINDOWS_DOORS_SCOPE_CARDS) {
    const fromField = positiveOpeningCount(quantities?.[card.measurementKey]);
    const fromItem = positiveOpeningCount(
      quantities?.itemQuantities?.[card.itemId]?.quantity
    );
    if ((fromField ?? fromItem) != null) active.add(card.itemId);
  }
  return items.map(item => {
    if (!active.has(item.id)) return item;
    if (item.state === 'included' || item.state === 'excluded') return item;
    return { ...item, state: 'included' };
  });
}

export function augmentWindowsDoorsScopeDetections<
  T extends {
    itemId?: string | null;
    label?: string | null;
    evidence?: string | null;
    state?: string | null;
    confidence?: number | null;
  },
>(
  detections: T[],
  measurements: Record<string, number | string | null | undefined>
): T[] {
  const counts = normalizeWindowsDoorsPlanMeasurements(measurements);
  const existing = new Set(
    detections.map(row => String(row.itemId || '').trim()).filter(Boolean)
  );
  const additions: T[] = [];
  for (const card of WINDOWS_DOORS_SCOPE_CARDS) {
    const count = counts[card.measurementKey];
    if (count == null || existing.has(card.itemId)) continue;
    additions.push({
      itemId: card.itemId,
      label: card.label,
      evidence: `${count} ${card.label.toLowerCase()} from plan`,
      state: 'included',
      confidence: 0.92,
    } as T);
    existing.add(card.itemId);
  }
  return [...detections, ...additions];
}

const WINDOWS_DOORS_REVIEW_LABELS: Record<WindowsDoorsQuantityKey, string> = {
  windowCount: 'Windows',
  exteriorDoorCount: 'Exterior swing doors',
  slidingDoorCount: 'Sliding / patio doors',
  interiorDoorCount: 'Interior doors',
};

export function windowsDoorsReviewMeasurementLabel(key: string): string | null {
  return WINDOWS_DOORS_REVIEW_LABELS[key as WindowsDoorsQuantityKey] ?? null;
}

/**
 * Always expose the fenestration count rows in Plan Review, even when vision
 * could not verify a number. Empty rows stay editable so the contractor can
 * confirm counts the same way notes / Quick measurements do.
 */
export function seedWindowsDoorsReviewMeasurements(
  measurements: Record<string, unknown> = {},
  takeoff?: {
    lowConfidence?: Array<{ field?: string | null; value?: unknown }> | null;
    measurementProvenance?: Record<
      string,
      { value?: unknown } | unknown
    > | null;
    itemQuantities?: Record<string, { quantity?: unknown } | undefined> | null;
  } | null
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...measurements };
  const itemByKey: Record<WindowsDoorsQuantityKey, string> = {
    windowCount: 'windows',
    exteriorDoorCount: 'exterior_doors',
    slidingDoorCount: 'sliding_doors',
    interiorDoorCount: 'interior_doors',
  };
  for (const reading of takeoff?.lowConfidence || []) {
    const key = String(reading?.field || '') as WindowsDoorsQuantityKey;
    if (!WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.includes(key)) continue;
    if (positiveCount(next[key]) != null) continue;
    const value = positiveCount(reading?.value);
    if (value != null) next[key] = value;
  }
  for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    if (positiveCount(next[key]) != null) continue;
    const provenance = takeoff?.measurementProvenance?.[key];
    const provenanceValue =
      provenance && typeof provenance === 'object'
        ? positiveCount((provenance as { value?: unknown }).value)
        : null;
    if (provenanceValue != null) {
      next[key] = provenanceValue;
      continue;
    }
    const itemValue = positiveCount(
      takeoff?.itemQuantities?.[itemByKey[key]]?.quantity
    );
    if (itemValue != null) next[key] = itemValue;
  }
  return next;
}

export function hydrateWindowsDoorsPlanReviewMeasurements(
  measurements: Record<string, unknown> = {},
  schedules?: OpeningSchedules | null
): Record<string, number | string> {
  const classified = classifyWindowsDoorsPlanMeasurements(
    measurements,
    schedules
  );
  const out: Record<string, number | string> = {};
  for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const fromSchedule = openingScheduleQuantityTotal(
      key,
      classified.schedules
    );
    out[key] =
      classified.measurements[key] != null
        ? classified.measurements[key]
        : fromSchedule != null
          ? fromSchedule
          : '';
  }
  return out;
}

export function isWindowsDoorsPlanReviewKey(key: string): boolean {
  return WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.includes(
    key as WindowsDoorsQuantityKey
  );
}

/** Unconfirmed takeoff counts stay pending in Step 2 even if suggested scope stays checked. */
export function windowsDoorsTakeoffQuickMeasurementSources(input: {
  values?: Record<string, unknown> | null;
  confirmedKeys?: Iterable<string> | null;
}): Partial<
  Record<
    WindowsDoorsQuantityKey,
    'needs_confirmation' | 'contractor_confirmed_from_plan_review'
  >
> {
  const confirmed = new Set(
    [...(input.confirmedKeys || [])]
      .map(key => String(key || '').trim())
      .filter(Boolean)
  );
  const out: Partial<
    Record<
      WindowsDoorsQuantityKey,
      'needs_confirmation' | 'contractor_confirmed_from_plan_review'
    >
  > = {};
  for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    if (positiveCount(input.values?.[key]) == null) continue;
    out[key] = confirmed.has(key)
      ? 'contractor_confirmed_from_plan_review'
      : 'needs_confirmation';
  }
  return out;
}

export type WindowsDoorsReviewTier = 'verified' | 'plan_derived' | 'not_found';

function provenanceBlob(entry: unknown): string {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry.toLowerCase();
  if (typeof entry !== 'object') return '';
  const record = entry as {
    source?: unknown;
    normalizedSource?: unknown;
    evidenceKind?: unknown;
    status?: unknown;
  };
  return `${record.source || ''} ${record.normalizedSource || ''} ${
    record.evidenceKind || ''
  } ${record.status || ''}`.toLowerCase();
}

export function resolveWindowsDoorsReviewTier(input: {
  value: unknown;
  provenanceEntry?: unknown;
  scheduleDocumented?: boolean;
}): WindowsDoorsReviewTier {
  const count = positiveCount(input.value);
  if (count == null) return 'not_found';
  const blob = provenanceBlob(input.provenanceEntry);
  const planDerived =
    blob.includes('calculated_from_symbols') ||
    blob.includes('elevation') ||
    blob.includes('needs_confirmation') ||
    blob.includes('geometry') ||
    blob.includes('from_plan_symbols');
  if (planDerived) return 'plan_derived';
  const verified =
    Boolean(input.scheduleDocumented) &&
    (blob.includes('schedule') || blob.includes('explicit_label'));
  if (verified) return 'verified';
  return 'plan_derived';
}

export function windowsDoorsReviewProvenanceLabel(
  tier: WindowsDoorsReviewTier
): string {
  if (tier === 'verified') return 'From schedule';
  if (tier === 'plan_derived') return 'From plans · Confirm';
  return 'Not found · Enter manually';
}

export function windowsDoorsReviewSelectionAppearance(input: {
  include: boolean;
  tier: WindowsDoorsReviewTier;
  colors: { sub: string };
}): { icon: 'checkbox' | 'square-outline'; color: string } {
  if (input.tier === 'not_found' || !input.include) {
    return { icon: 'square-outline', color: input.colors.sub };
  }
  if (input.tier === 'plan_derived') {
    return { icon: 'checkbox', color: '#fbbf24' };
  }
  return { icon: 'checkbox', color: '#22c55e' };
}

export type OpeningSizeTier = 'standard' | 'medium' | 'large' | 'oversized';

export type OpeningScheduleRow = {
  mark?: string;
  quantity?: number;
  type?: string;
  sizeCode?: string;
  callout?: string;
  size?: string;
  widthIn?: number;
  heightIn?: number;
  widthFt?: number;
  heightFt?: number;
  configuration?: string;
  notes?: string;
};

export type OpeningSchedules = {
  windows?: OpeningScheduleRow[];
  exteriorDoors?: OpeningScheduleRow[];
  slidingDoors?: OpeningScheduleRow[];
  interiorDoors?: OpeningScheduleRow[];
  garageDoors?: OpeningScheduleRow[];
};

export type OpeningEvidenceCategory =
  'window' | 'exterior_swing' | 'sliding' | 'interior';

export type OpeningEvidenceSource =
  'schedule' | 'floor_plan' | 'elevation' | 'section';

export type InteriorOpeningSubtype =
  'room' | 'bath' | 'closet' | 'laundry' | 'pantry' | 'other';

export type OpeningEvidenceEntry = {
  id?: string;
  category: OpeningEvidenceCategory;
  source: OpeningEvidenceSource;
  mark?: string;
  level?: string;
  location?: string;
  type?: string;
  interiorSubtype?: InteriorOpeningSubtype;
  sheet?: string;
  page?: number;
  sourceText?: string;
  sizeCode?: string;
  widthIn?: number;
  heightIn?: number;
  widthFt?: number;
  heightFt?: number;
  confidence?: number;
};

export type OpeningEvidenceReconciliation = {
  duplicates?: Array<{
    duplicateId?: string;
    canonicalId?: string;
    reason?: string;
  }>;
  sourceCounts?: Record<string, Record<string, number>>;
  uniqueCounts?: Partial<Record<OpeningEvidenceCategory, number>>;
  interiorBreakdown?: Partial<Record<InteriorOpeningSubtype, number>>;
  variance?: Record<string, Record<string, number>>;
};

const OPENING_EVIDENCE_CATEGORIES = new Set<OpeningEvidenceCategory>([
  'window',
  'exterior_swing',
  'sliding',
  'interior',
]);
const OPENING_EVIDENCE_SOURCES = new Set<OpeningEvidenceSource>([
  'schedule',
  'floor_plan',
  'elevation',
  'section',
]);

const OPENING_EVIDENCE_KEY_BY_MEASUREMENT: Record<
  WindowsDoorsQuantityKey,
  OpeningEvidenceCategory
> = {
  windowCount: 'window',
  exteriorDoorCount: 'exterior_swing',
  slidingDoorCount: 'sliding',
  interiorDoorCount: 'interior',
};

export function openingEvidenceFromPlanFacts(planFacts?: unknown): {
  entries: OpeningEvidenceEntry[];
  reconciliation: OpeningEvidenceReconciliation | null;
} {
  if (!planFacts || typeof planFacts !== 'object') {
    return { entries: [], reconciliation: null };
  }
  const facts = planFacts as {
    openingEvidence?: unknown;
    openingReconciliation?: unknown;
  };
  const entries = Array.isArray(facts.openingEvidence)
    ? (facts.openingEvidence as OpeningEvidenceEntry[]).filter(
        entry =>
          entry &&
          typeof entry === 'object' &&
          OPENING_EVIDENCE_CATEGORIES.has(
            String(entry.category) as OpeningEvidenceCategory
          ) &&
          OPENING_EVIDENCE_SOURCES.has(
            String(entry.source) as OpeningEvidenceSource
          )
      )
    : [];
  const reconciliation =
    facts.openingReconciliation &&
    typeof facts.openingReconciliation === 'object'
      ? (facts.openingReconciliation as OpeningEvidenceReconciliation)
      : null;
  return { entries, reconciliation };
}

export function openingEvidenceRowsForMeasurementKey(
  key: string,
  planFacts?: unknown
): OpeningEvidenceEntry[] {
  const category =
    OPENING_EVIDENCE_KEY_BY_MEASUREMENT[key as WindowsDoorsQuantityKey];
  if (!category) return [];
  return openingEvidenceFromPlanFacts(planFacts).entries.filter(
    entry => entry.category === category
  );
}

function titleCaseEvidenceToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function openingEvidenceSummaryLines(
  key: string,
  planFacts?: unknown
): { lines: string[]; warning?: string } {
  const category =
    OPENING_EVIDENCE_KEY_BY_MEASUREMENT[key as WindowsDoorsQuantityKey];
  if (!category) return { lines: [] };
  const { entries, reconciliation } = openingEvidenceFromPlanFacts(planFacts);
  const rows = entries.filter(entry => entry.category === category);
  if (!rows.length) return { lines: [] };
  const uniqueCount = reconciliation?.uniqueCounts?.[category] ?? rows.length;
  const lines = [
    `${uniqueCount} unique opening${uniqueCount === 1 ? '' : 's'} evidenced`,
  ];
  const sheets = [...new Set(rows.map(row => row.sheet).filter(Boolean))];
  if (sheets.length) lines.push(`Sheets: ${sheets.join(', ')}`);
  if (category === 'interior') {
    const breakdown = reconciliation?.interiorBreakdown || {};
    const parts = Object.entries(breakdown)
      .filter(([, count]) => Number(count) > 0)
      .map(([subtype, count]) => `${titleCaseEvidenceToken(subtype)} ${count}`);
    if (parts.length) lines.push(`Interior mix: ${parts.join(' · ')}`);
  }
  const variance = reconciliation?.variance?.[category];
  if (variance && Object.keys(variance).length > 1) {
    const sourceValues = Object.entries(variance)
      .map(([source, count]) => `${titleCaseEvidenceToken(source)} ${count}`)
      .join(' vs ');
    return {
      lines,
      warning: `Source counts disagree: ${sourceValues}. Confirm before pricing.`,
    };
  }
  return { lines };
}

export function openingEvidenceDetailLines(
  key: string,
  planFacts?: unknown
): string[] {
  return openingEvidenceRowsForMeasurementKey(key, planFacts)
    .slice(0, 60)
    .map(entry => {
      const identity =
        entry.location ||
        entry.mark ||
        entry.sizeCode ||
        entry.type ||
        'Opening';
      const level = entry.level ? `${entry.level} · ` : '';
      const type = entry.interiorSubtype
        ? titleCaseEvidenceToken(entry.interiorSubtype)
        : entry.type;
      const descriptor = type && type !== identity ? ` · ${type}` : '';
      const size = entry.sizeCode ? ` · ${entry.sizeCode}` : '';
      const source = entry.sheet
        ? ` · ${entry.sheet}${entry.page ? ` p.${entry.page}` : ''}`
        : entry.page
          ? ` · p.${entry.page}`
          : '';
      return `${level}${identity}${descriptor}${size}${source}`;
    });
}

function openingScheduleText(
  row: OpeningScheduleRow | null | undefined
): string {
  return `${row?.type || ''} ${row?.notes || ''} ${row?.configuration || ''} ${
    row?.mark || ''
  } ${row?.callout || ''} ${row?.size || ''}`.toLowerCase();
}

export function isExplicitSlidingDoor(text: string): boolean {
  const blob = String(text || '').toLowerCase();
  const hasSlideLanguage =
    hasSliderMechanics(blob) ||
    /\b(slid(?:e|er|ing)s?|pocket\s+door)\b/.test(blob);
  if (!hasSlideLanguage) return false;
  if (hasHingedSwingLanguage(blob) && !hasSliderMechanics(blob)) return false;
  return true;
}

function hasSliderMechanics(text: string): boolean {
  return /\b(multi[-\s]?slide|bypass|track|nana\s*wall|folding[-\s]?slide)\b/.test(
    String(text || '')
  );
}

function hasHingedSwingLanguage(text: string): boolean {
  return /\b(french|hinged|hinge|inswing|outswing|swing|pivot|active leaf|inactive leaf)\b/.test(
    String(text || '')
  );
}

function slidingRowWidthFt(row: OpeningScheduleRow | null | undefined): number {
  const widthFt = Number(row?.widthFt);
  if (Number.isFinite(widthFt) && widthFt > 0) return widthFt;
  const widthIn = Number(row?.widthIn);
  if (Number.isFinite(widthIn) && widthIn >= 10) return widthIn / 12;
  return 0;
}

export function looksLikeMisclassifiedSlidingRow(
  row: OpeningScheduleRow | null | undefined
): boolean {
  const text = openingScheduleText(row);
  if (hasSliderMechanics(text) || isExplicitSlidingDoor(text)) return false;
  if (hasHingedSwingLanguage(text) || /\b(patio|garden)\b/.test(text)) {
    return true;
  }
  if (/\b(double|pair|leaf|leaves)\b/.test(text) && !/\bslid/.test(text)) {
    return true;
  }
  const qty = positiveCount(row?.quantity) || 1;
  const unlabeled =
    !String(row?.mark || '').trim() &&
    !row?.sizeCode &&
    !(slidingRowWidthFt(row) > 0);
  return (
    unlabeled && qty === 2 && slidingRowWidthFt(row) < 5 && /\bslid/.test(text)
  );
}

function openingUnitQuantity(row: OpeningScheduleRow): number {
  const qty = positiveCount(row.quantity) || 1;
  const text = openingScheduleText(row);
  if (hasSliderMechanics(text) || isExplicitSlidingDoor(text)) return qty;
  if (
    /\b(french|double|pair|two[-\s]?leaf|2[-\s]?leaf|leaves|patio)\b/.test(
      text
    ) &&
    qty === 2
  ) {
    return 1;
  }
  if (
    looksLikeMisclassifiedSlidingRow(row) &&
    qty === 2 &&
    /\bslid/.test(text)
  ) {
    return 1;
  }
  return qty;
}

function openingMarkKey(
  row: OpeningScheduleRow | null | undefined
): string | null {
  const mark = String(row?.mark || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return mark || null;
}

function openingSizeKey(
  row: OpeningScheduleRow | null | undefined
): string | null {
  const code = String(row?.sizeCode || '')
    .replace(/\D/g, '')
    .slice(0, 4);
  if (code.length === 4) return `code:${code}`;
  const widthFt =
    Number(row?.widthFt) ||
    (Number(row?.widthIn) > 0 ? Number(row?.widthIn) / 12 : 0);
  const heightFt =
    Number(row?.heightFt) ||
    (Number(row?.heightIn) > 0 ? Number(row?.heightIn) / 12 : 0);
  if (widthFt > 0 && heightFt > 0) {
    return `dim:${Math.round(widthFt * 4) / 4}x${Math.round(heightFt * 4) / 4}`;
  }
  return null;
}

function swingOpeningFamily(
  row: OpeningScheduleRow | null | undefined
): 'slider' | 'french_patio' | 'personnel' | 'swing' {
  const text = openingScheduleText(row);
  if (isExplicitSlidingDoor(text)) return 'slider';
  if (/\b(french|patio|garden)\b/.test(text)) return 'french_patio';
  if (/\b(personnel|service|man[- ]?door)\b/.test(text)) return 'personnel';
  return 'swing';
}

function isUnlabeledOpening(
  row: OpeningScheduleRow | null | undefined
): boolean {
  return !openingMarkKey(row) && !openingSizeKey(row);
}

export function samePhysicalSwingOpening(
  a: OpeningScheduleRow,
  b: OpeningScheduleRow
): boolean {
  const markA = openingMarkKey(a);
  const markB = openingMarkKey(b);
  if (markA && markB) return markA === markB;
  const sizeA = openingSizeKey(a);
  const sizeB = openingSizeKey(b);
  if (sizeA && sizeB && sizeA === sizeB) {
    const familyA = swingOpeningFamily(a);
    const familyB = swingOpeningFamily(b);
    return familyA === familyB || familyA === 'swing' || familyB === 'swing';
  }
  return false;
}

function alreadyCountedSwingOpening(
  moved: OpeningScheduleRow,
  existingRows: OpeningScheduleRow[]
): boolean {
  if (!existingRows.length) return false;
  if (existingRows.some(row => samePhysicalSwingOpening(row, moved))) {
    return true;
  }
  if (
    isUnlabeledOpening(moved) &&
    swingOpeningFamily(moved) === 'french_patio' &&
    existingRows.some(row => swingOpeningFamily(row) === 'french_patio')
  ) {
    return true;
  }
  return false;
}

export function reclassifyFenestrationOpeningSchedules(
  schedules?: OpeningSchedules | null
): OpeningSchedules | null {
  if (!schedules || typeof schedules !== 'object') return null;
  const slidingSource = schedules.slidingDoors || [];
  const slidingKeep: OpeningScheduleRow[] = [];
  const moved: OpeningScheduleRow[] = [];
  for (const row of slidingSource) {
    if (looksLikeMisclassifiedSlidingRow(row)) {
      moved.push({ ...row, quantity: openingUnitQuantity(row) });
    } else {
      slidingKeep.push({ ...row, quantity: openingUnitQuantity(row) });
    }
  }
  const exteriorExisting = (schedules.exteriorDoors || []).map(row => ({
    ...row,
    quantity: openingUnitQuantity(row),
  }));
  const exterior = [...exteriorExisting];
  for (const row of moved) {
    if (alreadyCountedSwingOpening(row, exteriorExisting)) continue;
    exterior.push(row);
  }
  return {
    ...schedules,
    ...(exterior.length
      ? { exteriorDoors: exterior }
      : { exteriorDoors: undefined }),
    ...(slidingKeep.length
      ? { slidingDoors: slidingKeep }
      : { slidingDoors: undefined }),
  };
}

export function classifyWindowsDoorsPlanMeasurements(
  measurements: Record<string, unknown> = {},
  schedules?: OpeningSchedules | null
): {
  measurements: Record<string, number>;
  schedules: OpeningSchedules | null;
} {
  const originalSliding = schedules?.slidingDoors || [];
  const classifiedSchedules = reclassifyFenestrationOpeningSchedules(schedules);
  const next = { ...normalizeWindowsDoorsPlanMeasurements(measurements) };
  const shouldReclass = originalSliding.some(row =>
    looksLikeMisclassifiedSlidingRow(row)
  );
  if (shouldReclass) {
    const sliding = openingScheduleQuantityTotal(
      'slidingDoorCount',
      classifiedSchedules
    );
    if (sliding == null) delete next.slidingDoorCount;
    else next.slidingDoorCount = sliding;
    const exterior = openingScheduleQuantityTotal(
      'exteriorDoorCount',
      classifiedSchedules
    );
    if (
      exterior != null &&
      (next.exteriorDoorCount == null || exterior > next.exteriorDoorCount)
    ) {
      next.exteriorDoorCount = exterior;
    }
  }
  return { measurements: next, schedules: classifiedSchedules };
}

export type OpeningSizeMix = Record<OpeningSizeTier, number>;

const EMPTY_SIZE_MIX: OpeningSizeMix = {
  standard: 0,
  medium: 0,
  large: 0,
  oversized: 0,
};

function positiveFt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Industry WWHH callout: 3050 = 3'-0" × 5'-0", 3068 = 3'-0" × 6'-8". */
export function parseOpeningSizeCode(
  raw: unknown
): { widthIn: number; heightIn: number; sizeCode: string } | null {
  const code = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 4);
  if (code.length !== 4) return null;
  const widthCode = Number(code.slice(0, 2));
  const heightCode = Number(code.slice(2));
  const widthIn = Math.floor(widthCode / 10) * 12 + (widthCode % 10);
  const heightIn = Math.floor(heightCode / 10) * 12 + (heightCode % 10);
  if (widthIn < 12 || heightIn < 12 || widthIn > 240 || heightIn > 240) {
    return null;
  }
  return { widthIn, heightIn, sizeCode: code };
}

function parseFeetInchesPair(
  text: string
): { widthFt: number; heightFt: number } | null {
  const match = String(text || '').match(
    /(\d+)\s*(?:['′]\s*(\d+)?(?:\s*["″])?)?\s*[x×by]\s*(\d+)\s*(?:['′]\s*(\d+)?(?:\s*["″])?)?/i
  );
  if (!match) return null;
  const widthFt = Number(match[1]) + Number(match[2] || 0) / 12;
  const heightFt = Number(match[3]) + Number(match[4] || 0) / 12;
  if (!(widthFt > 0) || !(heightFt > 0)) return null;
  return { widthFt, heightFt };
}

export function resolveOpeningDimensions(row: OpeningScheduleRow): {
  widthFt: number;
  heightFt: number;
  sizeCode?: string;
} | null {
  const fromCode = parseOpeningSizeCode(
    row.sizeCode || row.callout || row.size || row.mark
  );
  if (fromCode) {
    return {
      widthFt: fromCode.widthIn / 12,
      heightFt: fromCode.heightIn / 12,
      sizeCode: fromCode.sizeCode,
    };
  }
  const widthIn = positiveFt(row.widthIn);
  const heightIn = positiveFt(row.heightIn);
  if (widthIn != null && heightIn != null && widthIn >= 10 && heightIn >= 10) {
    return { widthFt: widthIn / 12, heightFt: heightIn / 12 };
  }
  const widthFt = positiveFt(row.widthFt);
  const heightFt = positiveFt(row.heightFt);
  if (widthFt != null && heightFt != null) {
    return { widthFt, heightFt };
  }
  return parseFeetInchesPair(`${row.notes || ''} ${row.size || ''}`);
}

export function classifyOpeningSizeTier(
  kind: 'windows' | 'exterior_doors' | 'sliding_doors',
  dims: { widthFt: number; heightFt: number } | null
): OpeningSizeTier {
  if (!dims) return 'standard';
  const area = dims.widthFt * dims.heightFt;
  if (kind === 'sliding_doors') {
    if (dims.widthFt >= 12) return 'oversized';
    if (dims.widthFt >= 8) return 'large';
    if (dims.widthFt >= 6.5) return 'medium';
    return 'standard';
  }
  if (kind === 'exterior_doors') {
    if (dims.widthFt >= 6 || area >= 28) return 'oversized';
    if (dims.widthFt >= 4.5 || dims.heightFt >= 8) return 'large';
    if (dims.heightFt >= 7.5) return 'medium';
    return 'standard';
  }
  if (area >= 40 || (dims.widthFt >= 6 && dims.heightFt >= 6))
    return 'oversized';
  if (area >= 25 || dims.widthFt >= 5) return 'large';
  if (area >= 16 || dims.widthFt >= 4 || dims.heightFt >= 6) return 'medium';
  return 'standard';
}

export function formatOpeningSizeLabel(row: OpeningScheduleRow): string {
  const dims = resolveOpeningDimensions(row);
  const type = String(row.type || row.configuration || '').trim();
  if (dims?.sizeCode) {
    return type ? `${dims.sizeCode} ${type}` : dims.sizeCode;
  }
  if (dims) {
    const w = Number.isInteger(dims.widthFt)
      ? `${dims.widthFt}'`
      : `${Math.round(dims.widthFt * 10) / 10}'`;
    const h = Number.isInteger(dims.heightFt)
      ? `${dims.heightFt}'`
      : `${Math.round(dims.heightFt * 10) / 10}'`;
    const size = `${w} × ${h}`;
    return type ? `${size} ${type}` : size;
  }
  if (row.mark && type) return `${row.mark} ${type}`;
  return row.mark || type || 'Size unknown';
}

function rowQuantity(row: OpeningScheduleRow): number {
  return positiveCount(row.quantity) || 1;
}

export function openingScheduleRowsForMeasurementKey(
  key: string,
  schedules?: OpeningSchedules | null
): OpeningScheduleRow[] {
  const classified =
    reclassifyFenestrationOpeningSchedules(schedules) || schedules;
  if (!classified) return [];
  if (key === 'windowCount') return classified.windows || [];
  if (key === 'exteriorDoorCount') return classified.exteriorDoors || [];
  if (key === 'slidingDoorCount') return classified.slidingDoors || [];
  if (key === 'interiorDoorCount') return classified.interiorDoors || [];
  const garage = classified.garageDoors || [];
  if (!garage.length) return [];
  const matching = garage.filter(row => {
    const blob =
      `${row.type || ''} ${row.notes || ''} ${row.mark || ''}`.toLowerCase();
    const dims = resolveOpeningDimensions(row);
    const widthFt = dims?.widthFt ?? 0;
    const heightFt = dims?.heightFt ?? 0;
    if (key === 'garageDoorRvCount') {
      return /rv|oversize|tall/.test(blob) || heightFt >= 10;
    }
    if (key === 'garageDoorDoubleCount') {
      return /double/.test(blob) || (widthFt >= 14 && widthFt < 20);
    }
    if (key === 'garageDoorSingleCount') {
      return /single/.test(blob) || (widthFt > 0 && widthFt < 12);
    }
    return false;
  });
  if (matching.length) return matching;
  if (key === 'garageDoorDoubleCount') return garage;
  return [];
}

export function openingScheduleIsDocumented(
  rows?: OpeningScheduleRow[] | null
): boolean {
  if (!Array.isArray(rows) || !rows.length) return false;
  const tagged = rows.filter(
    row =>
      Boolean(String(row.mark || '').trim()) ||
      Boolean(row.sizeCode) ||
      row.widthIn != null ||
      row.widthFt != null
  );
  if (!tagged.length) return false;
  if (tagged.some(row => String(row.mark || '').trim())) return true;
  const sizeCodes = new Set(
    tagged.map(row => String(row.sizeCode || '').trim()).filter(Boolean)
  );
  return tagged.length >= 2 || sizeCodes.size >= 2;
}

export function openingScheduleQuantityTotal(
  key: string,
  schedules?: OpeningSchedules | null
): number | null {
  const rows = openingScheduleRowsForMeasurementKey(key, schedules);
  const total = rows.reduce((sum, row) => sum + rowQuantity(row), 0);
  return total > 0 ? total : null;
}

export function formatOpeningDetailLines(rows: OpeningScheduleRow[]): string[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = formatOpeningSizeLabel(row);
    grouped.set(label, (grouped.get(label) || 0) + rowQuantity(row));
  }
  return [...grouped.entries()].map(
    ([label, quantity]) => `${quantity} × ${label}`
  );
}

export function emptyOpeningSizeMix(): OpeningSizeMix {
  return { ...EMPTY_SIZE_MIX };
}

export function openingSizeMixFromRows(
  kind: 'windows' | 'exterior_doors' | 'sliding_doors',
  rows: OpeningScheduleRow[],
  totalCount?: number | null
): OpeningSizeMix {
  const mix = emptyOpeningSizeMix();
  let sized = 0;
  for (const row of rows) {
    const qty = rowQuantity(row);
    const dims = resolveOpeningDimensions(row);
    const tier = classifyOpeningSizeTier(kind, dims);
    mix[tier] += qty;
    sized += qty;
  }
  const total = positiveCount(totalCount);
  if (total != null && total > sized) {
    mix.standard += total - sized;
  }
  if (sized === 0 && total != null) {
    mix.standard = total;
  }
  return mix;
}

export function openingSizeMixSummary(mix: OpeningSizeMix): string | null {
  const parts = (
    ['standard', 'medium', 'large', 'oversized'] as OpeningSizeTier[]
  )
    .filter(tier => mix[tier] > 0)
    .map(tier => `${mix[tier]} ${tier}`);
  return parts.length ? `Pricing mix · ${parts.join(' · ')}` : null;
}

export function openingSchedulesFromPlanFacts(
  planFacts?: { openingSchedules?: OpeningSchedules | null } | null
): OpeningSchedules | null {
  const schedules = planFacts?.openingSchedules;
  if (!schedules || typeof schedules !== 'object') return null;
  return schedules;
}
