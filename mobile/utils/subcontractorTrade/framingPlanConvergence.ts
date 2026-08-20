/**
 * Canonical Framing architecture — plan export, notes, and manual entry converge here.
 */

import type { ScopePricingBehavior } from './scopePricingBehavior';

export type FramingQuantityKey =
  | 'framedAreaSqft'
  | 'wallFramingLf'
  | 'sheathingSqft'
  | 'framingOpeningCount'
  | 'framingCleanupCount';

export type FramingWorkflowMode =
  'new_construction' | 'remodel' | 'repair_service';

export type FramingCardGroupId = 'shell' | 'sheathing' | 'closeout';

export type FramingCardDefinition = {
  itemId: string;
  measurementKey: FramingQuantityKey;
  label: string;
  helper: string;
  unit: 'sqft' | 'lf' | 'each' | 'allowance';
  groupId: FramingCardGroupId;
  groupTitle: string;
  pricingBehavior: ScopePricingBehavior;
};

const G = (
  groupId: FramingCardGroupId
): Record<FramingCardGroupId, string>[FramingCardGroupId] =>
  ({
    shell: 'Shell framing',
    sheathing: 'Sheathing',
    closeout: 'Closeout',
  })[groupId];

const F = (
  itemId: string,
  measurementKey: FramingQuantityKey,
  label: string,
  helper: string,
  groupId: FramingCardGroupId,
  pricingBehavior: ScopePricingBehavior,
  unit: FramingCardDefinition['unit'] = 'sqft'
): FramingCardDefinition => ({
  itemId,
  measurementKey,
  label,
  helper,
  unit,
  groupId,
  groupTitle: G(groupId),
  pricingBehavior,
});

/** Same cards for Plan Export and standalone Framing notes flow. */
export const FRAMING_CARDS: FramingCardDefinition[] = [
  F(
    'framing',
    'framedAreaSqft',
    'Framing (lumber + labor)',
    'Covered framed floor area — living plus garage when documented. Full-shell plan pricing includes lumber, sheathing, trusses, decking, and framing labor in one package.',
    'shell',
    'CUSTOM_PRICE',
    'sqft'
  ),
  F(
    'wall_framing',
    'wallFramingLf',
    'Wall framing',
    'New or reworked stud walls priced by linear feet when documented. Full-shell SF framing is separate.',
    'shell',
    'CUSTOM_PRICE',
    'lf'
  ),
  F(
    'openings',
    'framingOpeningCount',
    'Door / window openings',
    'Rough openings, headers, and framing for doors or windows — count each documented opening.',
    'shell',
    'CUSTOM_PRICE',
    'each'
  ),
  F(
    'shear_sheathing',
    'sheathingSqft',
    'Sheathing / shear',
    'Structural wall or roof sheathing (OSB/plywood) when documented. Full-shell plan packages include it in framing material; partial/remodel work may price it separately.',
    'sheathing',
    'CUSTOM_PRICE',
    'sqft'
  ),
  F(
    'cleanup',
    'framingCleanupCount',
    'Cleanup & disposal',
    'Framing scrap, cutoff haul-off, and job-site cleanup only when explicitly in scope.',
    'closeout',
    'ALLOWANCE',
    'allowance'
  ),
];

export const FRAMING_ITEM_IDS = FRAMING_CARDS.map(card => card.itemId);
export const FRAMING_QUANTITY_KEYS = FRAMING_CARDS.map(
  card => card.measurementKey
);

export const FRAMING_REVIEW_MEASUREMENT_KEYS = [
  'framedAreaSqft',
  'wallFramingLf',
  'sheathingSqft',
  'framingOpeningCount',
  'framingCleanupCount',
  'floorAreaSqft',
  'garageSqft',
  'stuccoGrossWallSqft',
] as const;

export const FRAMING_PLAN_QUICK_MEASUREMENT_KEYS = [
  'framedAreaSqft',
  'sheathingSqft',
  'floorAreaSqft',
  'garageSqft',
  'wallFramingLf',
  'framingOpeningCount',
] as const;

/** LF/count lines that duplicate the covered-SF shell package on ground-up bids. */
export const FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS = [
  'wallFramingLf',
  'framingOpeningCount',
] as const;

export const FRAMING_SHELL_COMPONENT_ITEM_IDS = [
  'wall_framing',
  'openings',
] as const;

const PLAN_SHELL_FRAMING_COMPONENT_SOURCES = new Set([
  'plan_detected',
  'plan_verified',
  'ai_verified',
  'detected_from_plan',
  'contractor_confirmed_from_plan_review',
]);

/** Ground-up shell bids price studs and rough openings inside covered SF framing. */
export function isShellFramingPackageBid(
  input: Record<string, unknown>
): boolean {
  return positiveNumber(input.floorAreaSqft) != null;
}

/**
 * A full selected-trade ground-up framing import uses the shell package as the
 * pricing owner. Its material package already covers sheathing, so the plan
 * sheathing measurement remains visible but must not become a second charge.
 */
export function shellPackageIncludesSheathing(
  input: Record<string, unknown>
): boolean {
  const trade = String(
    input.planImportTradeKey || input.selectedTrade || ''
  ).toLowerCase();
  const sources = input.quickMeasurementSources as
    Record<string, string> | undefined;
  const planFramingMeasurement =
    sources?.framedAreaSqft &&
    PLAN_SHELL_FRAMING_COMPONENT_SOURCES.has(sources.framedAreaSqft);
  const planSheathingMeasurement =
    sources?.sheathingSqft &&
    PLAN_SHELL_FRAMING_COMPONENT_SOURCES.has(sources.sheathingSqft);
  return (
    isShellFramingPackageBid(input) &&
    (input.planImportMode === 'selected_trade' ||
      trade === 'framing' ||
      (planFramingMeasurement && planSheathingMeasurement))
  );
}

/** Keep contractor-entered LF/count on shell bids — only plan imports are stripped. */
export function shouldPreserveShellFramingComponentMeasurement(
  input: Record<string, unknown>,
  key: (typeof FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS)[number]
): boolean {
  const overrides = input.quickMeasurementUserOverrides as
    Record<string, boolean> | undefined;
  if (overrides?.[key]) return true;
  const sources = input.quickMeasurementSources as
    Record<string, string> | undefined;
  const source = sources?.[key];
  if (source === 'user_entered' || source === 'manual_override') return true;
  if (String(input[key] ?? '').trim() && !source) return true;
  if (source && !PLAN_SHELL_FRAMING_COMPONENT_SOURCES.has(source)) return true;
  return false;
}

export function shouldStripShellFramingComponentMeasurement(
  input: Record<string, unknown>,
  key: (typeof FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS)[number]
): boolean {
  if (!isShellFramingPackageBid(input)) return false;
  if (shouldPreserveShellFramingComponentMeasurement(input, key)) return false;
  const sources = input.quickMeasurementSources as
    Record<string, string> | undefined;
  const source = sources?.[key];
  return Boolean(source && PLAN_SHELL_FRAMING_COMPONENT_SOURCES.has(source));
}

export function stripShellFramingComponentMeasurements<
  T extends Record<string, unknown>,
>(input: T): T {
  if (!isShellFramingPackageBid(input)) return input;
  const next = { ...input } as T & Record<string, unknown>;
  for (const key of FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS) {
    if (!shouldStripShellFramingComponentMeasurement(input, key)) continue;
    delete next[key];
  }
  return next as T;
}

export function framingScopeItemIdsForInput(
  input: Record<string, unknown>
): string[] {
  const shellBid = isShellFramingPackageBid(input);
  const scope: string[] = [];
  if (resolveCoveredFramedAreaSqft(input) != null) scope.push('framing');
  if (
    resolveFramingSheathingSqft(input) != null &&
    !shellPackageIncludesSheathing(input)
  ) {
    scope.push('shear_sheathing');
  }
  if (
    positiveNumber(input.wallFramingLf) != null &&
    (!shellBid ||
      shouldPreserveShellFramingComponentMeasurement(input, 'wallFramingLf'))
  ) {
    scope.push('wall_framing');
  }
  if (
    positiveNumber(input.framingOpeningCount) != null &&
    (!shellBid ||
      shouldPreserveShellFramingComponentMeasurement(
        input,
        'framingOpeningCount'
      ))
  ) {
    scope.push('openings');
  }
  if (positiveNumber(input.framingCleanupCount) != null) scope.push('cleanup');
  return scope;
}

export const FRAMING_PLAN_SCOPE_ALLOWLIST = [...FRAMING_ITEM_IDS];

export const FRAMING_PLAN_ALIASES: Record<string, FramingQuantityKey> = {
  framingSqft: 'framedAreaSqft',
  framedSqft: 'framedAreaSqft',
  coveredFramedSqft: 'framedAreaSqft',
  framingAreaSqft: 'framedAreaSqft',
  wallFramingLinearFeet: 'wallFramingLf',
  framingWallLf: 'wallFramingLf',
  shearSheathingSqft: 'sheathingSqft',
  sheathingAreaSqft: 'sheathingSqft',
  framingOpenings: 'framingOpeningCount',
  openingCount: 'framingOpeningCount',
};

export const FRAMING_PLAN_EXPORT_CHECKLIST_GROUPS: Array<{
  title: string;
  itemIds: string[];
}> = [
  {
    title: 'Shell framing',
    itemIds: ['framing', 'wall_framing', 'openings'],
  },
  {
    title: 'Sheathing',
    itemIds: ['shear_sheathing'],
  },
  {
    title: 'Closeout',
    itemIds: ['cleanup'],
  },
];

export type FramingStructuredMeasurements = {
  framingScope?: string[] | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeAliasedInput(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...input };
  for (const [alias, canonical] of Object.entries(FRAMING_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) != null) continue;
    const value = positiveNumber(out[alias]);
    if (value != null) out[canonical] = value;
  }
  return out;
}

/** Covered framed SF = explicit framed area or living + garage. */
export function resolveCoveredFramedAreaSqft(
  input: Record<string, unknown>
): number | null {
  const aliased = normalizeAliasedInput(input);
  const direct = positiveNumber(aliased.framedAreaSqft);
  if (direct != null) return Math.round(direct);
  const living = positiveNumber(aliased.floorAreaSqft);
  if (living == null) return null;
  const garage = positiveNumber(aliased.garageSqft) ?? 0;
  return Math.round(living + Math.max(0, garage));
}

export function resolveFramingSheathingSqft(
  input: Record<string, unknown>
): number | null {
  const aliased = normalizeAliasedInput(input);
  const direct = positiveNumber(aliased.sheathingSqft);
  if (direct != null) return Math.round(direct);
  const grossWall = positiveNumber(aliased.stuccoGrossWallSqft);
  if (grossWall != null) return Math.round(grossWall);
  return null;
}

export function parseFramingMeasurementsFromNotes(
  notes: string
): Record<string, number> {
  const text = String(notes || '').trim();
  if (!text) return {};
  const out: Record<string, number> = {};
  const assign = (key: FramingQuantityKey, value: number | null) => {
    if (value != null && Number.isFinite(value) && value > 0) out[key] = value;
  };
  const count = (pattern: RegExp): number | null => {
    const match = text.match(pattern);
    if (!match?.[1]) return null;
    const n = Number(String(match[1]).replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  assign(
    'wallFramingLf',
    count(
      /(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:ft|feet)|ft)\s*(?:of\s*)?(?:stud\s*)?wall\s*fram/i
    ) ??
      count(
        /(?:frame|framing)\s*(?:a\s*)?(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:ft|feet)|ft)/i
      ) ??
      count(
        /(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:ft|feet)|ft)\s*(?:stud\s*)?wall/i
      )
  );
  assign(
    'sheathingSqft',
    count(
      /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?(?:sheath|shear|osb|plywood)/i
    ) ??
      count(
        /(?:sheath|shear)\s*(?:panel|wall)?\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i
      )
  );
  assign(
    'framedAreaSqft',
    count(
      /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?(?:framed|framing)/i
    ) ??
      count(
        /(?:framed|framing)\s*(?:area|shell)?\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i
      )
  );
  assign(
    'framingOpeningCount',
    count(/(\d+)\s*(?:door|window|opening|header)s?\b/i) ??
      (/\b(one|1)\s+(?:door|window|opening|header)\b/i.test(text) ? 1 : null)
  );

  return out;
}

function explicitQuantity(
  input: Record<string, unknown>,
  key: FramingQuantityKey
): number | null {
  const direct = positiveNumber(input[key]);
  if (direct != null) return direct;
  const alias = Object.entries(FRAMING_PLAN_ALIASES).find(
    ([, canonical]) => canonical === key
  );
  return alias ? positiveNumber(input[alias[0]]) : null;
}

function buildItemQuantities(
  input: Record<string, unknown>,
  source: string
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const shellBid = isShellFramingPackageBid(input);
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  for (const card of FRAMING_CARDS) {
    if (
      shellBid &&
      ((card.itemId === 'shear_sheathing' &&
        shellPackageIncludesSheathing(input)) ||
        ((card.itemId === 'wall_framing' || card.itemId === 'openings') &&
          !shouldPreserveShellFramingComponentMeasurement(
            input,
            card.measurementKey
          )))
    ) {
      continue;
    }
    let quantity = explicitQuantity(input, card.measurementKey);
    if (card.measurementKey === 'framedAreaSqft') {
      quantity = resolveCoveredFramedAreaSqft(input);
    }
    if (card.measurementKey === 'sheathingSqft') {
      quantity = resolveFramingSheathingSqft(input);
    }
    if (quantity == null) continue;
    out[card.itemId] = {
      quantity,
      unit: card.unit,
      quantitySource: source,
    };
  }
  return out;
}

export function normalizeFramingPlanMeasurements(
  input: Record<string, unknown>
): Record<string, unknown> {
  const aliased = normalizeAliasedInput(input);
  const out: Record<string, unknown> = {};
  for (const key of FRAMING_REVIEW_MEASUREMENT_KEYS) {
    const quantity = positiveNumber(aliased[key]);
    if (quantity != null) out[key] = quantity;
  }
  const framed = resolveCoveredFramedAreaSqft(aliased);
  if (framed != null) out.framedAreaSqft = framed;
  const sheathing = resolveFramingSheathingSqft(aliased);
  if (sheathing != null) out.sheathingSqft = sheathing;
  return stripShellFramingComponentMeasurements(out);
}

export function normalizeFramingScalarMeasurements(
  input: Record<string, unknown>
): Record<string, number> {
  return normalizeFramingPlanMeasurements(input) as Record<string, number>;
}

export function buildFramingStructuredMeasurements(
  input: Record<string, unknown>,
  quantitySource = 'user_entered'
): FramingStructuredMeasurements {
  const normalized = normalizeAliasedInput(input);
  const enriched = {
    ...normalized,
    ...(resolveCoveredFramedAreaSqft(normalized) != null
      ? { framedAreaSqft: resolveCoveredFramedAreaSqft(normalized) }
      : {}),
    ...(resolveFramingSheathingSqft(normalized) != null
      ? { sheathingSqft: resolveFramingSheathingSqft(normalized) }
      : {}),
  };
  const scoped = stripShellFramingComponentMeasurements(enriched);
  const framingScope = framingScopeItemIdsForInput(scoped);
  const itemQuantities = buildItemQuantities(scoped, quantitySource);
  return {
    framingScope: framingScope.length ? framingScope : null,
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : null,
  };
}

export function framingCardForMeasurementKey(
  key: string
): FramingCardDefinition | null {
  return FRAMING_CARDS.find(card => card.measurementKey === key) || null;
}

export function framingCardForItemId(
  itemId: string
): FramingCardDefinition | null {
  return FRAMING_CARDS.find(card => card.itemId === itemId) || null;
}

/** Persist framing quick-measurement fields through Confirm Scope payload round-trips. */
export function copyFramingQuantityFields(
  source: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null = positiveNumber
): Partial<Record<FramingQuantityKey, number | null>> {
  const out: Partial<Record<FramingQuantityKey, number | null>> = {};
  if (!source) return out;
  for (const key of FRAMING_QUANTITY_KEYS) {
    const parsed = parse(source[key]);
    if (parsed != null) out[key] = parsed;
  }
  const framed = resolveCoveredFramedAreaSqft(source);
  if (framed != null && out.framedAreaSqft == null) {
    out.framedAreaSqft = framed;
  }
  const sheathing = resolveFramingSheathingSqft(source);
  if (sheathing != null && out.sheathingSqft == null) {
    out.sheathingSqft = sheathing;
  }
  return out;
}

export function syncFramingScopeItems<T extends { id: string; state?: string }>(
  items: T[],
  params: {
    framingScope?: string[] | null;
    quantities?: Partial<Record<FramingQuantityKey, unknown>> & {
      itemQuantities?: Record<string, { quantity?: unknown }>;
    };
  }
): T[] {
  const shellIncludesSheathing = shellPackageIncludesSheathing(
    (params.quantities || {}) as Record<string, unknown>
  );
  const included = new Set(
    (params.framingScope || []).filter(
      itemId => !(shellIncludesSheathing && itemId === 'shear_sheathing')
    )
  );
  const fromQuantity = new Set<string>();
  for (const card of FRAMING_CARDS) {
    const raw = params.quantities?.[card.measurementKey];
    const fromItem = params.quantities?.itemQuantities?.[card.itemId]?.quantity;
    const qty = Number(String(raw ?? fromItem ?? '').replace(/,/g, ''));
    if (
      Number.isFinite(qty) &&
      qty > 0 &&
      !(shellIncludesSheathing && card.itemId === 'shear_sheathing')
    ) {
      fromQuantity.add(card.itemId);
    }
    if (card.measurementKey === 'framedAreaSqft' && params.quantities) {
      const framed = resolveCoveredFramedAreaSqft(
        params.quantities as Record<string, unknown>
      );
      if (framed != null && framed > 0) fromQuantity.add(card.itemId);
    }
    if (
      card.measurementKey === 'sheathingSqft' &&
      params.quantities &&
      !shellPackageIncludesSheathing(
        params.quantities as Record<string, unknown>
      )
    ) {
      const sheathing = resolveFramingSheathingSqft(
        params.quantities as Record<string, unknown>
      );
      if (sheathing != null && sheathing > 0) fromQuantity.add(card.itemId);
    }
  }
  const active = new Set([...included, ...fromQuantity]);
  const hiddenOnShell = new Set<string>();
  const quantities = (params.quantities || {}) as Record<string, unknown>;
  if (isShellFramingPackageBid(quantities)) {
    if (shellIncludesSheathing) hiddenOnShell.add('shear_sheathing');
    for (const key of FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS) {
      const itemId = key === 'wallFramingLf' ? 'wall_framing' : 'openings';
      if (!shouldPreserveShellFramingComponentMeasurement(quantities, key)) {
        hiddenOnShell.add(itemId);
      }
    }
  }
  return items
    .filter(item => !hiddenOnShell.has(item.id))
    .map(item => {
      if (!FRAMING_ITEM_IDS.includes(item.id)) return item;
      if (!active.has(item.id)) {
        if (item.state === 'included') return { ...item, state: 'review' };
        return item;
      }
      if (item.state === 'included' || item.state === 'excluded') return item;
      return { ...item, state: 'included' };
    });
}
