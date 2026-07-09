/**
 * Quick measurement fields shown per scope checklist template.
 * All fields render for the job type; values prefill from notes when parsed.
 */

export type QuickMeasurementFieldKey =
  | 'bathroomFloorSqft'
  | 'kitchenFloorSqft'
  | 'floorAreaSqft'
  | 'backsplashSqft'
  | 'countertopSqft'
  | 'cabinetLf'
  | 'showerWallTileSqft'
  | 'showerFloorTileSqft'
  | 'wallPaintSqft'
  | 'exteriorPaintSqft'
  | 'baseboardLf'
  | 'railingLf'
  | 'landscapeSqft'
  | 'sodSqft'
  | 'paverSqft'
  | 'rockMulchSqft'
  | 'landscapeTons'
  | 'roofSquares'
  | 'drywallSqft'
  | 'flooringSqft'
  | 'concreteSqft'
  | 'concreteCy'
  | 'excavationCy'
  | 'deckSqft';

export type QuickMeasurementGroupId = 'site' | 'structure' | 'interior' | 'exterior' | 'other';

export type QuickMeasurementFieldDef = {
  key: QuickMeasurementFieldKey;
  label: string;
  placeholder: string;
  unit: string;
  group: QuickMeasurementGroupId;
  /** Emphasize as the main driver field (full-width, first). */
  primary?: boolean;
};

/** Two fields per row when consecutive defs share a row group. */
export type QuickMeasurementRow = QuickMeasurementFieldDef[];

export type QuickMeasurementSection = {
  id: QuickMeasurementGroupId;
  title: string;
  rows: QuickMeasurementRow[];
};

const GROUP_TITLES: Record<QuickMeasurementGroupId, string> = {
  site: 'Site',
  structure: 'Structure',
  interior: 'Interior',
  exterior: 'Exterior',
  other: 'Other',
};

const GROUP_ORDER: QuickMeasurementGroupId[] = ['site', 'structure', 'interior', 'exterior', 'other'];

const row = (...fields: QuickMeasurementFieldDef[]): QuickMeasurementRow => fields;

const F = (
  key: QuickMeasurementFieldKey,
  label: string,
  placeholder: string,
  unit: string,
  group: QuickMeasurementGroupId,
  primary?: boolean
): QuickMeasurementFieldDef => ({ key, label, placeholder, unit, group, primary });

const QUICK_MEASUREMENT_FIELD_DEFS: Record<QuickMeasurementFieldKey, QuickMeasurementFieldDef> = {
  bathroomFloorSqft: F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior'),
  kitchenFloorSqft: F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior'),
  floorAreaSqft: F('floorAreaSqft', 'Floor area', '1200', 'sqft', 'structure', true),
  backsplashSqft: F('backsplashSqft', 'Backsplash', '40', 'sqft', 'interior'),
  countertopSqft: F('countertopSqft', 'Counters', '55', 'sqft', 'interior'),
  cabinetLf: F('cabinetLf', 'Cabinets', '24', 'LF', 'interior'),
  showerWallTileSqft: F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior'),
  showerFloorTileSqft: F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior'),
  wallPaintSqft: F('wallPaintSqft', 'Interior paint', '320', 'sqft', 'interior'),
  exteriorPaintSqft: F('exteriorPaintSqft', 'Exterior paint', '2200', 'sqft', 'exterior'),
  baseboardLf: F('baseboardLf', 'Baseboard', '48', 'LF', 'interior'),
  railingLf: F('railingLf', 'Railing', '48', 'LF', 'exterior'),
  landscapeSqft: F('landscapeSqft', 'Coverage', '1200', 'sqft', 'site'),
  sodSqft: F('sodSqft', 'Sod / turf', '900', 'sqft', 'site'),
  paverSqft: F('paverSqft', 'Pavers', '180', 'sqft', 'site'),
  rockMulchSqft: F('rockMulchSqft', 'Rock / mulch', '600', 'sqft', 'site'),
  landscapeTons: F('landscapeTons', 'Rock / mulch', '12', 'tons', 'site'),
  roofSquares: F('roofSquares', 'Roof', '28', 'sq', 'structure'),
  drywallSqft: F('drywallSqft', 'Drywall', '800', 'sqft', 'interior'),
  flooringSqft: F('flooringSqft', 'Flooring', '600', 'sqft', 'interior'),
  concreteSqft: F('concreteSqft', 'Flatwork', '400', 'sqft', 'structure'),
  concreteCy: F('concreteCy', 'Concrete', '12', 'CY', 'structure'),
  excavationCy: F('excavationCy', 'Excavation', '45', 'CY', 'site'),
  deckSqft: F('deckSqft', 'Deck', '320', 'sqft', 'exterior'),
};

const NOTE_BACKED_QUICK_FIELD_ORDER: QuickMeasurementFieldKey[] = [
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'railingLf',
  'landscapeTons',
  'rockMulchSqft',
  'deckSqft',
  'roofSquares',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'sodSqft',
  'paverSqft',
  'floorAreaSqft',
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'backsplashSqft',
  'countertopSqft',
  'cabinetLf',
  'wallPaintSqft',
  'exteriorPaintSqft',
  'drywallSqft',
  'flooringSqft',
  'baseboardLf',
  'landscapeSqft',
];

export const SCOPE_QUICK_MEASUREMENT_ROWS: Record<string, QuickMeasurementRow[]> = {
  bathroom: [
    row(
      F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior', true),
      F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior')
    ),
    row(
      F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior'),
      F('wallPaintSqft', 'Paint', '175', 'sqft', 'interior')
    ),
    row(F('baseboardLf', 'Baseboard', '24', 'LF', 'interior')),
  ],
  kitchen: [
    row(
      F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior', true),
      F('backsplashSqft', 'Backsplash', '40', 'sqft', 'interior')
    ),
    row(
      F('countertopSqft', 'Counters', '55', 'sqft', 'interior'),
      F('cabinetLf', 'Cabinets', '24', 'LF', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Paint', '320', 'sqft', 'interior'),
      F('baseboardLf', 'Trim', '48', 'LF', 'interior')
    ),
  ],
  flooring: [
    row(
      F('bathroomFloorSqft', 'Bath floor', '850', 'sqft', 'interior'),
      F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior')
    ),
    row(
      F('floorAreaSqft', 'Total floor', '1030', 'sqft', 'structure', true),
      F('baseboardLf', 'Baseboard', '220', 'LF', 'interior')
    ),
  ],
  landscaping: [
    row(
      F('sodSqft', 'Sod / turf', '900', 'sqft', 'site', true),
      F('rockMulchSqft', 'Rock / mulch', '600', 'sqft', 'site')
    ),
    row(
      F('paverSqft', 'Pavers', '180', 'sqft', 'site'),
      F('landscapeTons', 'Rock / mulch', '12', 'tons', 'site')
    ),
    row(F('landscapeSqft', 'Coverage', '1200', 'sqft', 'site')),
  ],
  roofing: [row(F('roofSquares', 'Roof', '28', 'sq', 'structure', true))],
  drywall: [row(F('drywallSqft', 'Drywall', '800', 'sqft', 'interior', true))],
  painting: [
    row(
      F('wallPaintSqft', 'Interior paint', '1500', 'sqft', 'interior', true),
      F('exteriorPaintSqft', 'Exterior paint', '2200', 'sqft', 'exterior')
    ),
  ],
  concrete: [
    row(
      F('concreteSqft', 'Flatwork', '400', 'sqft', 'structure', true),
      F('concreteCy', 'Concrete', '12', 'CY', 'structure')
    ),
  ],
  deck_patio: [
    row(
      F('deckSqft', 'Deck', '320', 'sqft', 'exterior', true),
      F('concreteSqft', 'Patio', '180', 'sqft', 'structure')
    ),
    row(F('railingLf', 'Railing', '48', 'LF', 'exterior')),
  ],
  excavation: [
    row(
      F('excavationCy', 'Excavation', '45', 'CY', 'site', true),
      F('concreteCy', 'Concrete', '12', 'CY', 'structure')
    ),
  ],
  room_remodel: [
    row(
      F('bathroomFloorSqft', 'Room floor', '150', 'sqft', 'interior', true),
      F('wallPaintSqft', 'Paint', '320', 'sqft', 'interior')
    ),
    row(
      F('drywallSqft', 'Drywall', '200', 'sqft', 'interior'),
      F('baseboardLf', 'Trim', '48', 'LF', 'interior')
    ),
  ],
  addition: [
    row(F('floorAreaSqft', 'Building', '650', 'sqft', 'structure', true)),
    row(
      F('excavationCy', 'Excavation', '45', 'CY', 'site'),
      F('concreteCy', 'Foundation', '18', 'CY', 'structure')
    ),
    row(
      F('concreteSqft', 'Flatwork', '400', 'sqft', 'structure'),
      F('drywallSqft', 'Drywall', '1200', 'sqft', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Paint', '1500', 'sqft', 'interior'),
      F('flooringSqft', 'Flooring', '600', 'sqft', 'interior')
    ),
  ],
};

export function resolveQuickMeasurementTemplateKey(
  templateKey?: string | null,
  projectType?: string | null
): string {
  const tk = String(templateKey || '').toLowerCase();
  const pt = String(projectType || '').toLowerCase();
  if (pt === 'flooring') return 'flooring';
  if (SCOPE_QUICK_MEASUREMENT_ROWS[tk]) return tk;
  if (pt === 'kitchen') return 'kitchen';
  if (pt === 'bathroom') return 'bathroom';
  if (pt === 'landscaping') return 'landscaping';
  if (pt === 'roofing') return 'roofing';
  if (pt === 'drywall') return 'drywall';
  if (pt === 'painting') return 'painting';
  if (pt === 'concrete') return 'concrete';
  if (pt === 'deck_patio') return 'deck_patio';
  if (pt === 'excavation') return 'excavation';
  return tk || 'room_remodel';
}

export function quickMeasurementRowsForTemplate(
  templateKey?: string | null,
  projectType?: string | null
): QuickMeasurementRow[] {
  const key = resolveQuickMeasurementTemplateKey(templateKey, projectType);
  return applyProjectSpecificQuickMeasurementLabels(
    SCOPE_QUICK_MEASUREMENT_ROWS[key] || SCOPE_QUICK_MEASUREMENT_ROWS.room_remodel,
    key,
    projectType
  );
}

function projectAreaFieldLabel(projectType?: string | null): string | null {
  switch (String(projectType || '').toLowerCase()) {
    case 'adu':
      return 'ADU';
    case 'room_addition':
      return 'Room addition';
    case 'home_addition':
      return 'Addition';
    case 'garage_conversion':
      return 'Garage conversion';
    case 'new_build':
      return 'Building';
    default:
      return null;
  }
}

function applyProjectSpecificQuickMeasurementLabels(
  rows: QuickMeasurementRow[],
  templateKey: string,
  projectType?: string | null
): QuickMeasurementRow[] {
  if (templateKey !== 'addition' && templateKey !== 'ground_up') return rows;
  const floorAreaLabel = projectAreaFieldLabel(projectType);
  if (!floorAreaLabel) return rows;

  return rows.map((measurementRow) =>
    measurementRow.map((field) =>
      field.key === 'floorAreaSqft'
        ? {
            ...field,
            label: floorAreaLabel,
            placeholder: projectType === 'adu' ? '650' : field.placeholder,
            primary: true,
          }
        : field
    )
  );
}

function hasQuickMeasurementValue(value: unknown): boolean {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0;
}

/** Live form value for a quick measurement field (note prefill until the user types). */
export function resolveQuickMeasurementDisplayValue(
  key: QuickMeasurementFieldKey,
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>>,
  noteValues: Partial<Record<QuickMeasurementFieldKey, string>> = {}
): string {
  const raw = measurements[key];
  if (raw != null && String(raw).trim() !== '') {
    return String(raw);
  }
  return noteValues[key] || String(raw ?? '');
}

function chunkRows(fields: QuickMeasurementFieldDef[]): QuickMeasurementRow[] {
  const rows: QuickMeasurementRow[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(fields.slice(i, i + 2));
  }
  return rows;
}

export function quickMeasurementRowsForInput(
  templateKey: string | null | undefined,
  projectType: string | null | undefined,
  measurements: Partial<Record<QuickMeasurementFieldKey, string | number | null | undefined>>,
  noteBackedKeys?: Iterable<QuickMeasurementFieldKey>
): QuickMeasurementRow[] {
  const resolvedKey = resolveQuickMeasurementTemplateKey(templateKey, projectType);
  const noteKeySet = noteBackedKeys ? new Set(noteBackedKeys) : null;
  const baseRows = quickMeasurementRowsForTemplate(templateKey, projectType);
  const baseKeys = new Set(baseRows.flatMap((r) => r.map((f) => f.key)));
  const extraFields = NOTE_BACKED_QUICK_FIELD_ORDER
    .filter((key) => !baseKeys.has(key) && (!noteKeySet || noteKeySet.has(key)) && hasQuickMeasurementValue(measurements[key]))
    .map((key) => QUICK_MEASUREMENT_FIELD_DEFS[key]);

  // Keep row order stable while typing — dynamic note-only rows caused TextInput focus to jump.
  if (resolvedKey === 'room_remodel') {
    return baseRows;
  }

  if (!extraFields.length) return baseRows;

  return [...baseRows, ...chunkRows(extraFields)];
}

/** Group flat rows into Site / Structure / Interior sections; primary fields lead. */
export function quickMeasurementSectionsForRows(rows: QuickMeasurementRow[]): QuickMeasurementSection[] {
  const fields = rows.flat();
  if (!fields.length) return [];

  const byGroup = new Map<QuickMeasurementGroupId, QuickMeasurementFieldDef[]>();
  for (const field of fields) {
    const list = byGroup.get(field.group) || [];
    list.push(field);
    byGroup.set(field.group, list);
  }

  const primaryGroup = fields.find((f) => f.primary)?.group;
  const orderedGroups = primaryGroup
    ? [primaryGroup, ...GROUP_ORDER.filter((id) => id !== primaryGroup)]
    : GROUP_ORDER;

  const sections: QuickMeasurementSection[] = [];
  for (const groupId of orderedGroups) {
    const groupFields = byGroup.get(groupId);
    if (!groupFields?.length) continue;
    const primary = groupFields.filter((f) => f.primary);
    const rest = groupFields.filter((f) => !f.primary);
    const sectionRows: QuickMeasurementRow[] = [];
    for (const field of primary) {
      sectionRows.push([field]);
    }
    sectionRows.push(...chunkRows(rest));
    sections.push({
      id: groupId,
      title: GROUP_TITLES[groupId],
      rows: sectionRows,
    });
  }
  return sections;
}

export function countFilledQuickMeasurements(
  rows: QuickMeasurementRow[],
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>>,
  noteValues: Partial<Record<QuickMeasurementFieldKey, string>> = {}
): { filled: number; total: number } {
  const fields = rows.flat();
  let filled = 0;
  for (const field of fields) {
    const value = resolveQuickMeasurementDisplayValue(field.key, measurements, noteValues);
    if (hasQuickMeasurementValue(value)) filled += 1;
  }
  return { filled, total: fields.length };
}

export function emptyQuickMeasurementInput(): Record<QuickMeasurementFieldKey, string> {
  return {
    bathroomFloorSqft: '',
    kitchenFloorSqft: '',
    floorAreaSqft: '',
    backsplashSqft: '',
    countertopSqft: '',
    cabinetLf: '',
    showerWallTileSqft: '',
    showerFloorTileSqft: '',
    wallPaintSqft: '',
    exteriorPaintSqft: '',
    baseboardLf: '',
    railingLf: '',
    landscapeSqft: '',
    sodSqft: '',
    paverSqft: '',
    rockMulchSqft: '',
    landscapeTons: '',
    roofSquares: '',
    drywallSqft: '',
    flooringSqft: '',
    concreteSqft: '',
    concreteCy: '',
    excavationCy: '',
    deckSqft: '',
  };
}
