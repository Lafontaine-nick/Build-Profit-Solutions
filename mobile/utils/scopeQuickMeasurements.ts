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

export type QuickMeasurementFieldDef = {
  key: QuickMeasurementFieldKey;
  label: string;
  placeholder: string;
};

/** Two fields per row when consecutive defs share a row group. */
export type QuickMeasurementRow = QuickMeasurementFieldDef[];

const row = (...fields: QuickMeasurementFieldDef[]): QuickMeasurementRow => fields;

const F = (
  key: QuickMeasurementFieldKey,
  label: string,
  placeholder: string
): QuickMeasurementFieldDef => ({ key, label, placeholder });

const QUICK_MEASUREMENT_FIELD_DEFS: Record<QuickMeasurementFieldKey, QuickMeasurementFieldDef> = {
  bathroomFloorSqft: F('bathroomFloorSqft', 'Bathroom floor sqft', 'e.g. 90'),
  kitchenFloorSqft: F('kitchenFloorSqft', 'Kitchen floor sqft', 'e.g. 180'),
  floorAreaSqft: F('floorAreaSqft', 'Floor area sqft', 'e.g. 1200'),
  backsplashSqft: F('backsplashSqft', 'Backsplash sqft', 'e.g. 40'),
  countertopSqft: F('countertopSqft', 'Countertop sqft', 'e.g. 55'),
  cabinetLf: F('cabinetLf', 'Cabinet run LF', 'e.g. 24'),
  showerWallTileSqft: F('showerWallTileSqft', 'Shower wall sqft', 'e.g. 90'),
  showerFloorTileSqft: F('showerFloorTileSqft', 'Shower floor sqft', 'e.g. 15'),
  wallPaintSqft: F('wallPaintSqft', 'Wall/ceiling paint sqft', 'e.g. 320'),
  exteriorPaintSqft: F('exteriorPaintSqft', 'Exterior paint sqft', 'e.g. 2200'),
  baseboardLf: F('baseboardLf', 'Baseboard linear feet', 'e.g. 48'),
  railingLf: F('railingLf', 'Railing linear feet', 'e.g. 48'),
  landscapeSqft: F('landscapeSqft', 'General coverage sqft', 'e.g. 1200'),
  sodSqft: F('sodSqft', 'Sod / turf sqft', 'e.g. 900'),
  paverSqft: F('paverSqft', 'Paver sqft', 'e.g. 180'),
  rockMulchSqft: F('rockMulchSqft', 'Rock / mulch sqft', 'e.g. 600'),
  landscapeTons: F('landscapeTons', 'Rock / mulch tons', 'e.g. 12'),
  roofSquares: F('roofSquares', 'Roof squares', 'e.g. 28'),
  drywallSqft: F('drywallSqft', 'Drywall sqft', 'e.g. 800'),
  flooringSqft: F('flooringSqft', 'Flooring sqft', 'e.g. 600'),
  concreteSqft: F('concreteSqft', 'Concrete sqft', 'e.g. 400'),
  concreteCy: F('concreteCy', 'Concrete CY', 'e.g. 12'),
  excavationCy: F('excavationCy', 'Excavation CY', 'e.g. 45'),
  deckSqft: F('deckSqft', 'Deck surface sqft', 'e.g. 320'),
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
      F('bathroomFloorSqft', 'Bathroom floor sqft', 'e.g. 90'),
      F('showerWallTileSqft', 'Shower wall sqft', 'e.g. 90')
    ),
    row(
      F('showerFloorTileSqft', 'Shower floor sqft', 'e.g. 15'),
      F('wallPaintSqft', 'Wall/ceiling paint sqft', 'e.g. 175')
    ),
    row(F('baseboardLf', 'Baseboard linear feet', 'e.g. 24')),
  ],
  kitchen: [
    row(
      F('kitchenFloorSqft', 'Kitchen floor sqft', 'e.g. 180'),
      F('backsplashSqft', 'Backsplash sqft', 'e.g. 40')
    ),
    row(
      F('countertopSqft', 'Countertop sqft', 'e.g. 55'),
      F('cabinetLf', 'Cabinet run LF', 'e.g. 24')
    ),
    row(
      F('wallPaintSqft', 'Wall/ceiling paint sqft', 'e.g. 320'),
      F('baseboardLf', 'Trim / baseboard LF', 'e.g. 48')
    ),
  ],
  flooring: [
    row(
      F('bathroomFloorSqft', 'Main bath floor sqft', 'e.g. 850'),
      F('kitchenFloorSqft', 'Kitchen floor sqft', 'e.g. 180')
    ),
    row(
      F('floorAreaSqft', 'Total floor area sqft', 'e.g. 1030'),
      F('baseboardLf', 'Baseboard linear feet', 'e.g. 220')
    ),
  ],
  landscaping: [
    row(
      F('sodSqft', 'Sod / turf sqft', 'e.g. 900'),
      F('rockMulchSqft', 'Rock / mulch sqft', 'e.g. 600')
    ),
    row(
      F('paverSqft', 'Paver sqft', 'e.g. 180'),
      F('landscapeTons', 'Rock / mulch tons', 'e.g. 12')
    ),
    row(F('landscapeSqft', 'General coverage sqft', 'e.g. 1200')),
  ],
  roofing: [row(F('roofSquares', 'Roof squares', 'e.g. 28'))],
  drywall: [row(F('drywallSqft', 'Drywall sqft', 'e.g. 800'))],
  painting: [
    row(
      F('wallPaintSqft', 'Interior paint sqft', 'e.g. 1500'),
      F('exteriorPaintSqft', 'Exterior paint sqft', 'e.g. 2200')
    ),
  ],
  concrete: [
    row(
      F('concreteSqft', 'Concrete sqft', 'e.g. 400'),
      F('concreteCy', 'Concrete CY', 'e.g. 12')
    ),
  ],
  deck_patio: [
    row(
      F('deckSqft', 'Deck surface sqft', 'e.g. 320'),
      F('concreteSqft', 'Concrete patio sqft', 'e.g. 180')
    ),
    row(F('railingLf', 'Railing linear feet', 'e.g. 48')),
  ],
  excavation: [
    row(
      F('excavationCy', 'Excavation CY', 'e.g. 45'),
      F('concreteCy', 'Concrete CY', 'e.g. 12')
    ),
  ],
  room_remodel: [
    row(
      F('bathroomFloorSqft', 'Room floor sqft', 'e.g. 150'),
      F('wallPaintSqft', 'Wall/ceiling paint sqft', 'e.g. 320')
    ),
    row(
      F('drywallSqft', 'Drywall sqft', 'e.g. 200'),
      F('baseboardLf', 'Trim / baseboard LF', 'e.g. 48')
    ),
  ],
  addition: [
    row(
      F('excavationCy', 'Excavation CY', 'e.g. 45'),
      F('concreteCy', 'Foundation concrete CY', 'e.g. 18')
    ),
    row(
      F('concreteSqft', 'Concrete flatwork sqft', 'e.g. 400'),
      F('drywallSqft', 'Drywall sqft', 'e.g. 1200')
    ),
    row(
      F('wallPaintSqft', 'Interior paint sqft', 'e.g. 1500'),
      F('floorAreaSqft', 'Building sqft', 'e.g. 650')
    ),
    row(F('flooringSqft', 'Flooring sqft', 'e.g. 600')),
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
      return 'ADU / casita sqft';
    case 'room_addition':
      return 'Room addition sqft';
    case 'home_addition':
      return 'Addition sqft';
    case 'garage_conversion':
      return 'Garage conversion sqft';
    case 'new_build':
      return 'Building sqft';
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
            placeholder: projectType === 'adu' ? 'e.g. 650' : field.placeholder,
          }
        : field
    )
  );
}

function hasQuickMeasurementValue(value: unknown): boolean {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0;
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

  if (resolvedKey === 'room_remodel') {
    const valuedBaseFields = baseRows
      .flatMap((r) => r)
      .filter((field) => (!noteKeySet || noteKeySet.has(field.key)) && hasQuickMeasurementValue(measurements[field.key]));
    const noteRows = chunkRows([...valuedBaseFields, ...extraFields]);
    return noteRows.length ? noteRows : baseRows;
  }

  if (!extraFields.length) return baseRows;

  return [...baseRows, ...chunkRows(extraFields)];
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
