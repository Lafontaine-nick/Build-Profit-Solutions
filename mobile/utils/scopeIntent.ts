export type ScopeIntentItem = {
  id: string;
  state: 'included' | 'excluded' | 'uncertain' | string;
  quantity?: number | null;
  unit?: string | null;
  evidence?: string;
};

export type ScopeIntent = {
  items?: ScopeIntentItem[] | null;
};

const DOOR_IDS = new Set([
  'interior_door_install',
  'interior_door',
  'interior_doors',
  'doors',
  'door_install',
]);

const WINDOW_IDS = new Set(['windows', 'window', 'window_install']);

const FLOOR_IDS = new Set(['flooring', 'lvp', 'flooring_lvp']);

const APPLIANCE_IDS = new Set(['appliances', 'appliance', 'appliance_install']);

const PAINT_IDS = new Set([
  'paint',
  'interior_paint',
  'painting',
  'interior_painting',
]);

function sameScope(itemId: string, intentId: string): boolean {
  if (itemId === intentId) return true;
  if (DOOR_IDS.has(itemId) && DOOR_IDS.has(intentId)) return true;
  if (WINDOW_IDS.has(itemId) && WINDOW_IDS.has(intentId)) return true;
  if (FLOOR_IDS.has(itemId) && FLOOR_IDS.has(intentId)) return true;
  if (APPLIANCE_IDS.has(itemId) && APPLIANCE_IDS.has(intentId)) return true;
  if (PAINT_IDS.has(itemId) && PAINT_IDS.has(intentId)) return true;
  return false;
}

function evidenceDemotesDoors(itemId: string, evidence: string): boolean {
  if (!DOOR_IDS.has(itemId)) return false;
  const paintOrKeep =
    /\b(?:paint|painting|repaint|keep|keeping|leave|leaving|exclude|excluding)\b/i.test(
      evidence
    );
  const install = /\b(?:install|replace|replacing|hang|swap)\b/i.test(evidence);
  return paintOrKeep && !install;
}

function statedExclusion(itemId: string, evidence: string): boolean {
  const ownerSuppliedAppliance =
    APPLIANCE_IDS.has(itemId) &&
    /\b(?:owner|customer)[-\s]?(?:supplied|provided|provides|providing)\b/i.test(
      evidence
    );
  return (
    evidenceDemotesDoors(itemId, evidence) ||
    ownerSuppliedAppliance ||
    /\b(?:keep|keeping|leave|leaving|exclude|excluding|not included|without)\b/i.test(
      evidence
    )
  );
}

type IntentChecklistItem = {
  id: string;
  label?: string;
  inputType?: string;
  state?: string;
  noteBacked?: boolean;
  catalogConfidence?: string;
};

/** Confirm Scope keeps a model read that is actually written in the note. */
export function applyStructuredScopeIntentToItems<T extends IntentChecklistItem>(
  items: T[],
  scopeIntent: ScopeIntent | null | undefined
): T[] {
  const intentItems = scopeIntent?.items || [];
  if (!intentItems.length) return items;
  return items.map(item => {
    const match = intentItems.find(row => sameScope(item.id, row.id));
    if (!match) return item;
    if (item.inputType === 'choice' || item.inputType === 'multi_choice') return item;
    const evidence = String(match.evidence || '');
    if (item.state === 'included' && statedExclusion(item.id, evidence)) {
      return {
        ...item,
        state: match.state === 'excluded' ? 'excluded' : 'unsure',
        noteBacked: false,
        catalogConfidence: 'needs_review',
      };
    }
    return item;
  });
}

/** A quantity stays blank when the model says the area was not a stated takeoff. */
export function applyStructuredScopeIntentToMeasurements<
  T extends Record<string, unknown>,
>(measurements: T, scopeIntent: ScopeIntent | null | undefined): T {
  const intentItems = scopeIntent?.items || [];
  const flooring = intentItems.find(
    row => FLOOR_IDS.has(row.id) && row.state !== 'included' && row.quantity == null
  );
  const paint = intentItems.find(
    row => PAINT_IDS.has(row.id) && row.state === 'uncertain' && row.quantity == null
  );
  if (!paint && !flooring) return measurements;
  const next = { ...measurements };
  if (flooring) {
    delete next.flooringSqft;
    delete next.flooringLvpSqft;
  }
  if (!paint) return next;
  const basisUnknown =
    measurements.paintAreaBasis === 'unknown' ||
    measurements.paintAreaNeedsConfirmation === true;
  if (!basisUnknown) return next;
  delete next.paintAreaSqft;
  delete next.combinedPaintableAreaSqft;
  delete next.wallPaintSqft;
  delete next.ceilingPaintSqft;
  delete next.originalPaintAreaReferenceSqft;
  delete next.paintPricingMethod;
  return next;
}
