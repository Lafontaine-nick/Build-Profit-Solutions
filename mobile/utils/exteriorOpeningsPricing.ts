/**
 * Exterior openings — windows, swing doors, sliding doors, garage doors.
 *
 * Garage doors are priced by type (single / double / RV), not a flat each:
 * - Double ~$2,400 matches Silver Leaf + national mid steel insulated
 * - Double + RV ~$10,700 matches SHV Lots 41/49
 */

export type GarageDoorType = 'single' | 'double' | 'rv';

export type GarageDoorCounts = {
  single: number;
  double: number;
  rv: number;
};

/** National mid-market installed (mat + labor), new-construction builder grade. */
export const EXTERIOR_OPENING_NATIONAL_RATES = {
  windows: {
    unit: 'each' as const,
    material: 450,
    labor: 275,
    sourceLabel: 'Suggested budget split · National Average · per window (mid-market vinyl/low-E)',
  },
  /** Living-SF planning when window count is missing (legacy windows_doors $/SF). */
  windows_sqft: {
    unit: 'sqft' as const,
    material: 2.55,
    labor: 1.55,
    sourceLabel: 'Suggested budget split · National Average · windows per living SF',
  },
  exterior_doors: {
    unit: 'each' as const,
    material: 1100,
    labor: 700,
    sourceLabel: 'Suggested budget split · National Average · exterior swing door (mid-market)',
  },
  sliding_doors: {
    unit: 'each' as const,
    material: 1900,
    labor: 900,
    sourceLabel: 'Suggested budget split · National Average · sliding patio door (mid-market)',
  },
} as const;

/**
 * Garage door installed packages.
 * Single/double: national mid steel insulated + opener-ready.
 * RV: local SHV schedule (above national $3k–$7k) so double+RV ≈ $10,700.
 */
export const GARAGE_DOOR_TYPE_RATES: Record<
  GarageDoorType,
  { material: number; labor: number; total: number; label: string; nationalNote: string }
> = {
  single: {
    material: 1200,
    labor: 600,
    total: 1800,
    label: 'Single garage door',
    nationalNote: 'National mid ~$800–$2,500 installed (8–9′ steel)',
  },
  double: {
    material: 1700,
    labor: 700,
    total: 2400,
    label: 'Double garage door',
    nationalNote: 'National mid ~$1,500–$4,500; Silver Leaf double $2,364',
  },
  rv: {
    material: 5800,
    labor: 2500,
    total: 8300,
    label: 'RV / oversized garage door',
    nationalNote: 'National RV ~$3,000–$7,000; local SHV with double ≈ $10,700',
  },
};

export function normalizeGarageDoorCounts(raw?: {
  garageDoorSingleCount?: number | null;
  garageDoorDoubleCount?: number | null;
  garageDoorRvCount?: number | null;
} | null): GarageDoorCounts {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
  };
  return {
    single: n(raw?.garageDoorSingleCount),
    double: n(raw?.garageDoorDoubleCount),
    rv: n(raw?.garageDoorRvCount),
  };
}

export function totalGarageDoorCount(counts: GarageDoorCounts): number {
  return counts.single + counts.double + counts.rv;
}

export function resolveGarageDoorSuggestedPricing(counts: GarageDoorCounts): {
  material: number;
  labor: number;
  total: number;
  quantity: number;
  unit: 'each';
  breakdown: Array<{ type: GarageDoorType; count: number; unitTotal: number; lineTotal: number }>;
  sourceLabel: string;
  helper: string;
} | null {
  const quantity = totalGarageDoorCount(counts);
  if (quantity <= 0) return null;

  let material = 0;
  let labor = 0;
  const breakdown: Array<{
    type: GarageDoorType;
    count: number;
    unitTotal: number;
    lineTotal: number;
  }> = [];

  (['single', 'double', 'rv'] as GarageDoorType[]).forEach((type) => {
    const count = counts[type];
    if (count <= 0) return;
    const rate = GARAGE_DOOR_TYPE_RATES[type];
    material += rate.material * count;
    labor += rate.labor * count;
    breakdown.push({
      type,
      count,
      unitTotal: rate.total,
      lineTotal: rate.total * count,
    });
  });

  const parts = breakdown.map(
    (b) => `${b.count}× ${GARAGE_DOOR_TYPE_RATES[b.type].label.replace(/ garage door$/i, '')} @ $${b.unitTotal.toLocaleString()}`
  );

  return {
    material,
    labor,
    total: material + labor,
    quantity,
    unit: 'each',
    breakdown,
    sourceLabel:
      'Suggested budget split · National Average + local garage schedule (Silver Leaf double / SHV RV)',
    helper: parts.join(' · '),
  };
}

/**
 * When garage SF is known but door types are unset, assume one double
 * (Silver Leaf / typical 2-car). RV must be chosen explicitly — SF alone
 * cannot tell a tall bay from a wide two-car.
 */
export function inferDefaultGarageDoorCounts(garageSqft?: number | null): GarageDoorCounts | null {
  const sf = Number(garageSqft);
  if (!(Number.isFinite(sf) && sf >= 200)) return null;
  return { single: 0, double: 1, rv: 0 };
}
