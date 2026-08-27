/**
 * Opening-specific trim & finish — casing, jamb extensions, stool/apron around
 * windows and doors included in the Windows & doors scope. Not whole-house trim.
 */

export type TrimFinishCoverage = 'interior' | 'exterior' | 'both';
export type TrimFinishGrade = 'paint_grade' | 'stain_grade' | 'unfinished';

export const TRIM_FINISH_LOCATION_OPTIONS = [
  { id: 'interior', label: 'Interior only' },
  { id: 'exterior', label: 'Exterior only' },
  { id: 'both', label: 'Interior + exterior' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
] as const;

export const TRIM_FINISH_GRADE_OPTIONS = [
  { id: 'paint_grade', label: 'Paint-grade' },
  { id: 'stain_grade', label: 'Stain-grade' },
  { id: 'unfinished', label: 'Unfinished' },
] as const;

/** Valid persisted composite ids — location × material grade. */
export const TRIM_FINISH_CHOICE_OPTIONS = [
  { id: 'interior_paint_grade', label: 'Interior · paint-grade' },
  { id: 'interior_stain_grade', label: 'Interior · stain-grade' },
  { id: 'interior_unfinished', label: 'Interior · unfinished' },
  { id: 'exterior_paint_grade', label: 'Exterior · paint-grade' },
  { id: 'exterior_stain_grade', label: 'Exterior · stain-grade' },
  { id: 'exterior_unfinished', label: 'Exterior · unfinished' },
  { id: 'both_paint_grade', label: 'Interior + exterior · paint-grade' },
  { id: 'both_stain_grade', label: 'Interior + exterior · stain-grade' },
  {
    id: 'both_unfinished',
    label: 'Interior + exterior · unfinished',
  },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
] as const;

export type TrimFinishChoiceId = (typeof TRIM_FINISH_CHOICE_OPTIONS)[number]['id'];

export const OPENING_TRIM_FINISH_SCOPE_HELPER =
  'Opening-specific casing and trim. Jamb extensions, stools, and aprons included where applicable. Whole-house trim and wall painting excluded.';

export const OPENING_TRIM_FINISH_PLANNING_LF_LABEL = 'Estimated opening trim';

export type TrimFinishLfDerivation = {
  totalLf: number;
  planningNote: string;
  breakdownLine: string;
  openingSummary: string;
};

function openingPhrase(count: number, singular: string, plural?: string): string {
  if (!(count > 0)) return '';
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function describeTrimFinishLfDerivation(
  measurements: Record<string, unknown> | null | undefined,
  choiceId: string | null | undefined
): TrimFinishLfDerivation | null {
  const parsed = parseTrimFinishChoice(choiceId);
  if (!parsed) return null;

  const windowCount = positiveCount(measurements?.windowCount);
  const exteriorDoorCount = positiveCount(measurements?.exteriorDoorCount);
  const slidingDoorCount = positiveCount(measurements?.slidingDoorCount);
  const interiorDoorCount = positiveCount(measurements?.interiorDoorCount);

  const breakdownParts: string[] = [];
  const openingParts: string[] = [];

  const includeInterior =
    parsed.coverage === 'interior' || parsed.coverage === 'both';
  const includeExterior =
    parsed.coverage === 'exterior' || parsed.coverage === 'both';

  if (includeInterior && windowCount > 0) {
    breakdownParts.push(
      `${windowCount} window${windowCount === 1 ? '' : 's'} × ${TRIM_FINISH_LF_PER_OPENING.windowInterior} LF`
    );
    openingParts.push(openingPhrase(windowCount, 'window'));
  }
  if (includeInterior && interiorDoorCount > 0) {
    breakdownParts.push(
      `${interiorDoorCount} interior door${interiorDoorCount === 1 ? '' : 's'} × ${TRIM_FINISH_LF_PER_OPENING.interiorDoorInterior} LF`
    );
    openingParts.push(openingPhrase(interiorDoorCount, 'interior door'));
  }
  if (includeExterior && windowCount > 0) {
    breakdownParts.push(
      `${windowCount} window${windowCount === 1 ? '' : 's'} × ${TRIM_FINISH_LF_PER_OPENING.windowExterior} LF (exterior)`
    );
    if (!includeInterior) {
      openingParts.push(openingPhrase(windowCount, 'window'));
    }
  }
  if (includeExterior && exteriorDoorCount > 0) {
    breakdownParts.push(
      `${exteriorDoorCount} exterior door${exteriorDoorCount === 1 ? '' : 's'} × ${TRIM_FINISH_LF_PER_OPENING.exteriorDoorExterior} LF`
    );
    openingParts.push(
      openingPhrase(exteriorDoorCount, 'exterior door', 'exterior doors')
    );
  }
  if (includeExterior && slidingDoorCount > 0) {
    breakdownParts.push(
      `${slidingDoorCount} sliding door${slidingDoorCount === 1 ? '' : 's'} × ${TRIM_FINISH_LF_PER_OPENING.slidingDoorExterior} LF`
    );
    openingParts.push(
      openingPhrase(slidingDoorCount, 'sliding door', 'sliding doors')
    );
  }

  const totalLf = deriveTrimFinishLfFromMeasurements(measurements, choiceId);
  if (totalLf == null || totalLf <= 0 || !breakdownParts.length) return null;

  return {
    totalLf,
    planningNote: 'Planning quantity from opening counts — not measured from plan dimensions.',
    breakdownLine: breakdownParts.join(' + '),
    openingSummary: `Calculated from ${openingParts.join(' + ')}`,
  };
}

/** Planning LF per opening for casing / stool / apron takeoff. */
export const TRIM_FINISH_LF_PER_OPENING = {
  windowInterior: 16,
  windowExterior: 20,
  interiorDoorInterior: 17,
  exteriorDoorExterior: 17,
  slidingDoorExterior: 22,
} as const;

const GRADE_RATES: Record<
  TrimFinishGrade,
  {
    material: number;
    installLabor: number;
    fieldFinishLabor: number;
    label: string;
  }
> = {
  paint_grade: {
    material: 2.75,
    installLabor: 3.5,
    fieldFinishLabor: 2.25,
    label: 'paint-grade material',
  },
  stain_grade: {
    material: 4,
    installLabor: 4.5,
    fieldFinishLabor: 3.5,
    label: 'stain-grade material',
  },
  unfinished: {
    material: 2.25,
    installLabor: 3.5,
    fieldFinishLabor: 0,
    label: 'unfinished material',
  },
};

/** National planning $/LF totals — install-only vs field-finished. */
export const TRIM_FINISH_NATIONAL_RATES = {
  paint_grade: { installOnly: 6.25, withFieldFinish: 8.5 },
  stain_grade: { installOnly: 8.5, withFieldFinish: 12 },
  unfinished: { installOnly: 5.75, withFieldFinish: 5.75 },
} as const;

const COVERAGE_LABEL: Record<TrimFinishCoverage, string> = {
  interior: 'interior opening trim',
  exterior: 'exterior opening trim',
  both: 'interior + exterior opening trim',
};

export function composeTrimFinishChoiceId(
  coverage: TrimFinishCoverage,
  grade: TrimFinishGrade
): TrimFinishChoiceId {
  return `${coverage}_${grade}` as TrimFinishChoiceId;
}

export function splitTrimFinishChoice(choiceId: string | null | undefined): {
  coverage: TrimFinishCoverage | 'not_in_scope' | 'unsure' | null;
  grade: TrimFinishGrade | null;
} {
  const id = String(choiceId || '').trim();
  if (!id) return { coverage: null, grade: null };
  if (id === 'not_in_scope') return { coverage: 'not_in_scope', grade: null };
  if (id === 'unsure') return { coverage: 'unsure', grade: null };
  const parsed = parseTrimFinishChoice(id);
  if (!parsed) return { coverage: null, grade: null };
  return parsed;
}

export function parseTrimFinishChoice(
  choiceId: string | null | undefined
): { coverage: TrimFinishCoverage; grade: TrimFinishGrade } | null {
  const id = String(choiceId || '').trim();
  if (!id || id === 'not_in_scope' || id === 'unsure') return null;
  const match = id.match(/^(interior|exterior|both)_(paint_grade|stain_grade|unfinished)$/);
  if (!match) return null;
  return {
    coverage: match[1] as TrimFinishCoverage,
    grade: match[2] as TrimFinishGrade,
  };
}

export function isActiveTrimFinishChoice(
  choiceId: string | null | undefined
): boolean {
  return parseTrimFinishChoice(choiceId) != null;
}

/** Legacy drafts priced field finish inside paint/stain labor when unset. */
export function resolveTrimFinishFieldPaintIncluded(input: {
  choiceId: string | null | undefined;
  stored?: boolean | null;
}): boolean {
  const parsed = parseTrimFinishChoice(input.choiceId);
  if (!parsed) return false;
  if (parsed.grade === 'unfinished') return false;
  if (input.stored === true || input.stored === false) return input.stored;
  return false;
}

function positiveCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

export function deriveTrimFinishLfFromMeasurements(
  measurements: Record<string, unknown> | null | undefined,
  choiceId: string | null | undefined
): number | null {
  const parsed = parseTrimFinishChoice(choiceId);
  if (!parsed) return null;

  const windowCount = positiveCount(measurements?.windowCount);
  const exteriorDoorCount = positiveCount(measurements?.exteriorDoorCount);
  const slidingDoorCount = positiveCount(measurements?.slidingDoorCount);
  const interiorDoorCount = positiveCount(measurements?.interiorDoorCount);

  const interiorLf =
    windowCount * TRIM_FINISH_LF_PER_OPENING.windowInterior +
    interiorDoorCount * TRIM_FINISH_LF_PER_OPENING.interiorDoorInterior;
  const exteriorLf =
    windowCount * TRIM_FINISH_LF_PER_OPENING.windowExterior +
    exteriorDoorCount * TRIM_FINISH_LF_PER_OPENING.exteriorDoorExterior +
    slidingDoorCount * TRIM_FINISH_LF_PER_OPENING.slidingDoorExterior;

  let total = 0;
  if (parsed.coverage === 'interior' || parsed.coverage === 'both') {
    total += interiorLf;
  }
  if (parsed.coverage === 'exterior' || parsed.coverage === 'both') {
    total += exteriorLf;
  }
  return total > 0 ? total : null;
}

export function resolveTrimFinishSuggestedPricing(input: {
  choiceId: string | null | undefined;
  linearFeet: number;
  fieldFinishIncluded?: boolean | null;
}): {
  material: number;
  labor: number;
  total: number;
  unit: 'lf';
  sourceLabel: string;
  helper: string;
} | null {
  const parsed = parseTrimFinishChoice(input.choiceId);
  const lf = Number(input.linearFeet);
  if (!parsed || !(lf > 0)) return null;

  const rate = GRADE_RATES[parsed.grade];
  const fieldFinishIncluded = resolveTrimFinishFieldPaintIncluded({
    choiceId: input.choiceId,
    stored: input.fieldFinishIncluded,
  });
  const fieldLabor =
    fieldFinishIncluded && parsed.grade !== 'unfinished'
      ? rate.fieldFinishLabor
      : 0;
  const laborPerLf = rate.installLabor + fieldLabor;
  const material = Math.round(rate.material * lf);
  const labor = Math.round(laborPerLf * lf);
  const finishNote =
    parsed.grade === 'unfinished'
      ? 'install only'
      : fieldFinishIncluded
        ? 'install + field paint/stain'
        : 'install only — field paint/stain excluded';
  return {
    material,
    labor,
    total: material + labor,
    unit: 'lf',
    sourceLabel: `Suggested budget split · National Average · ${COVERAGE_LABEL[parsed.coverage]} · ${rate.label} · ${finishNote}`,
    helper: `${Math.round(lf)} LF estimated opening trim — planning quantity from opening counts, not plan dimensions.`,
  };
}
