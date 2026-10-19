export type AreaOnlyExteriorFinish = 'stucco' | 'siding' | 'brick';

export type AreaOnlyStuccoSystem = 'three_coat' | 'one_coat' | 'eifs';

export const AREA_ONLY_EXTERIOR_FINISHES: Array<{
  id: AreaOnlyExteriorFinish;
  label: string;
}> = [
  { id: 'stucco', label: 'Stucco' },
  { id: 'siding', label: 'Siding' },
  { id: 'brick', label: 'Brick' },
];

export const AREA_ONLY_STUCCO_SYSTEMS: Array<{
  id: AreaOnlyStuccoSystem;
  label: string;
}> = [
  { id: 'three_coat', label: '3-coat' },
  { id: 'one_coat', label: '1-coat' },
  { id: 'eifs', label: 'Synthetic' },
];

const STUCCO_SYSTEM_RATES: Record<
  AreaOnlyStuccoSystem,
  { material: number; labor: number; label: string }
> = {
  three_coat: {
    material: 3.75,
    labor: 5.25,
    label: '3-coat traditional stucco',
  },
  one_coat: {
    material: 3,
    labor: 4,
    label: '1-coat stucco',
  },
  eifs: {
    material: 4.75,
    labor: 5.75,
    label: 'Synthetic stucco',
  },
};

/** Standard modular brick veneer, installed. Not stone and not thin brick. */
export const AREA_ONLY_BRICK_RATE = {
  material: 8,
  labor: 10,
  label: 'Standard brick veneer',
};

export function areaOnlyExteriorFinishFromNotes(
  notes?: string | null
): AreaOnlyExteriorFinish | null {
  const text = String(notes || '');
  if (/\bstucco\b|\beifs\b|\bsynthetic\s+stucco\b/i.test(text)) return 'stucco';
  if (/\bbrick\b/i.test(text)) return 'brick';
  if (/\bsiding\b/i.test(text)) return 'siding';
  return null;
}

export function areaOnlyStuccoSystemFromNotes(
  notes?: string | null
): AreaOnlyStuccoSystem | null {
  const text = String(notes || '');
  if (/\beifs\b|\bsynthetic(?:\s+stucco)?\b/i.test(text)) return 'eifs';
  if (/\b(?:1|one)[\s-]?coat\b/i.test(text)) return 'one_coat';
  if (/\b(?:3|three)[\s-]?coat\b|\btraditional\s+stucco\b/i.test(text)) {
    return 'three_coat';
  }
  return null;
}

export function asAreaOnlyExteriorFinish(
  value?: string | null
): AreaOnlyExteriorFinish | null {
  if (value === 'stucco' || value === 'siding' || value === 'brick') return value;
  return null;
}

export function asAreaOnlyStuccoSystem(
  value?: string | null
): AreaOnlyStuccoSystem | null {
  if (
    value === 'three_coat' ||
    value === 'one_coat' ||
    value === 'eifs' ||
    value === 'synthetic'
  ) {
    return value === 'synthetic' ? 'eifs' : value;
  }
  return null;
}

export function normalizeAreaOnlyExteriorFinishes(
  values: readonly (string | null | undefined)[]
): AreaOnlyExteriorFinish[] {
  const parsed = values
    .map(value => asAreaOnlyExteriorFinish(value))
    .filter((value): value is AreaOnlyExteriorFinish => Boolean(value));
  if (parsed.includes('stucco')) return ['stucco'];
  if (parsed.includes('brick')) return ['brick'];
  if (parsed.includes('siding')) return ['siding'];
  return [];
}

export function resolveAreaOnlyExteriorFinishes(input: {
  stored?: string | null;
  storedMany?: readonly (string | null)[] | null;
  choiceId?: string | null;
  choiceIds?: readonly (string | null)[] | null;
  notes?: string | null;
}): AreaOnlyExteriorFinish[] {
  if (Array.isArray(input.storedMany)) {
    return normalizeAreaOnlyExteriorFinishes(input.storedMany);
  }
  if (input.stored === '') return [];
  if (Array.isArray(input.choiceIds) && input.choiceIds.length > 0) {
    const fromChoices = normalizeAreaOnlyExteriorFinishes(input.choiceIds);
    if (fromChoices.length) return fromChoices;
  }
  const single = resolveAreaOnlyExteriorFinish(input);
  return single ? [single] : [];
}

export function toggleAreaOnlyExteriorFinish(
  current: readonly AreaOnlyExteriorFinish[],
  next: AreaOnlyExteriorFinish
): AreaOnlyExteriorFinish[] {
  if (current.includes(next)) return [];
  return [next];
}

/** The wall material. Exterior paint stays its own measurement. */
export function areaOnlyExteriorCladding(
  finishes: readonly AreaOnlyExteriorFinish[]
): AreaOnlyExteriorFinish | null {
  return finishes[0] || null;
}

export function resolveAreaOnlyExteriorFinish(input: {
  stored?: string | null;
  choiceId?: string | null;
  notes?: string | null;
}): AreaOnlyExteriorFinish | null {
  if (input.stored === '') return null;
  return (
    asAreaOnlyExteriorFinish(input.stored) ||
    asAreaOnlyExteriorFinish(input.choiceId) ||
    areaOnlyExteriorFinishFromNotes(input.notes)
  );
}

export function resolveAreaOnlyStuccoSystem(input: {
  finish?: AreaOnlyExteriorFinish | null;
  stored?: string | null;
  notes?: string | null;
}): AreaOnlyStuccoSystem | null {
  if (input.finish !== 'stucco') return null;
  if (input.stored === '') return null;
  return (
    asAreaOnlyStuccoSystem(input.stored) ||
    areaOnlyStuccoSystemFromNotes(input.notes)
  );
}

export function areaOnlyExteriorFinishLabel(
  finish?: AreaOnlyExteriorFinish | null
): string {
  if (finish === 'stucco') return 'Stucco';
  if (finish === 'siding') return 'Exterior siding';
  if (finish === 'brick') return 'Brick';
  return 'Exterior finish';
}

export function areaOnlyExteriorFinishHelper(
  finish?: AreaOnlyExteriorFinish | null,
  system?: AreaOnlyStuccoSystem | null,
  _paintOnTop = false
): string {
  if (finish === 'stucco') {
    const rate = areaOnlyStuccoSystemRate(system);
    return rate
      ? `${rate.label} on the wall area. Exterior paint stays its own line.`
      : 'Pick 3-coat, 1-coat, or synthetic. The finish coat is included.';
  }
  if (finish === 'siding') {
    return 'Siding on the wall area. Enter the siding price. Exterior paint stays its own line.';
  }
  if (finish === 'brick') {
    return 'Standard brick veneer on the wall area. Exterior paint stays its own line.';
  }
  return 'Pick stucco, siding, or brick.';
}

export function areaOnlyStuccoSystemRate(system?: AreaOnlyStuccoSystem | null): {
  material: number;
  labor: number;
  label: string;
} | null {
  if (!system) return null;
  return STUCCO_SYSTEM_RATES[system] || null;
}
