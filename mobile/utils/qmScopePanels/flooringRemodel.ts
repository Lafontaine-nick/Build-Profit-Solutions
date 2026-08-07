import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type FlooringExistingCounts = {
  flooringExistingCount: number | null;
  flooringExistingTypes?: Array<
    'carpet' | 'tile' | 'solid_hardwood' | 'engineered_hardwood' | 'laminate' | 'lvp' | 'sheet_vinyl_vct' | 'unknown'
  > | null;
};

export type FlooringInstallCounts = {
  flooringInstallScopeCount: number | null;
};

export type FlooringDemoCounts = {
  flooringDemoScopeCount: number | null;
};

export const FLOORING_QM_EMBEDDED_IDS = new Set<string>();

/** Confirm Scope cards that use the included-line layout (no Yes/No row). */
export const FLOORING_CONFIRM_SCOPE_LINE_CARD_IDS = new Set([
  'floor_demo',
  'floor_prep',
  'flooring',
  'flooring_lvp',
  'flooring_laminate',
  'flooring_engineered_hardwood',
  'flooring_solid_hardwood',
  'tile_flooring',
  'flooring_carpet',
  'flooring_sheet_vinyl',
  'underlayment',
  'moisture_barrier',
  'quarter_round',
  'trim',
  'cleanup',
]);

export function shouldUseFlooringConfirmScopeLineCard(
  templateKey: string | null | undefined,
  item: Pick<ScopeChecklistItem, 'id' | 'state' | 'noteBacked'>
): boolean {
  return (
    String(templateKey || '').toLowerCase() === 'flooring' &&
    FLOORING_CONFIRM_SCOPE_LINE_CARD_IDS.has(item.id) &&
    item.state === 'included' &&
    item.noteBacked === true
  );
}

export function isFlooringConfirmScopePricingCard(itemId: string | null | undefined): boolean {
  return FLOORING_CONFIRM_SCOPE_LINE_CARD_IDS.has(String(itemId || ''));
}

const FLOORING_INSTALL_INCLUDED_LINES: Record<string, string[]> = {
  flooring: ['Flooring material', 'Standard layout, cutting, and installation'],
  flooring_lvp: ['Luxury vinyl plank material', 'Standard layout, cutting, and installation'],
  flooring_laminate: ['Laminate flooring material', 'Standard layout, cutting, and installation'],
  flooring_engineered_hardwood: ['Engineered hardwood material', 'Standard layout, cutting, and installation'],
  flooring_solid_hardwood: ['Solid hardwood material', 'Standard layout, cutting, and installation'],
  tile_flooring: ['Floor tile material', 'Standard layout, cutting, and installation'],
  flooring_carpet: ['Carpet material and pad', 'Seams and standard installation'],
  flooring_sheet_vinyl: ['Sheet vinyl / VCT material', 'Standard layout and installation'],
  underlayment: ['Standard underlayment material', 'Layout and installation', 'Standard seams/taping as required'],
  moisture_barrier: ['Standard vapor-barrier material', 'Layout', 'Seams and taping', 'Standard installation'],
  transitions: ['Transition strips, reducers, thresholds, end caps, and related installation'],
  quarter_round: ['Standard quarter-round material', 'Cutting and fitting', 'Fastening', 'Standard installation'],
  trim: [
    'Standard paint-grade baseboard material',
    'Cut, fit & installation',
    'Nail-hole filling, caulk & light prep',
    'Standard finish painting',
  ],
  cleanup: ['Final cleaning', 'Debris haul-off from non-flooring scopes'],
};

export function flooringConfirmScopeSummaryLabel(itemId: string): string {
  if (itemId === 'floor_demo') return 'Included removal:';
  if (itemId === 'floor_prep') return 'Included prep:';
  return 'Included:';
}

export function flooringConfirmScopeIncludedLines(
  itemId: string,
  pricingDetail?: string | null,
  measurements?: Record<string, unknown>
): string[] {
  if (itemId === 'floor_demo') {
    const lines = String(pricingDetail || '')
      .split('\n')
      .filter((line) => /^\d[\d,]*\s+SF\s+/.test(line))
      .map((line) => line.replace(/\s+removal\s+@\s+\$[\d.]+\/SF\s+=\s+\$[\d,]+$/, ''));
    return [...lines, 'Protection, cleaning, haul-off, and disposal'];
  }
  if (itemId === 'floor_prep') {
    return String(pricingDetail || '')
      .split('\n')
      .filter((line) => /^(Affected prep area|Prep level|Includes):/.test(line));
  }
  if (itemId === 'flooring_lvp' && measurements) {
    let method = measurements.flooringNewLvpInstallMethod;
    if (!method) {
      const source = String(measurements.rateSourceLabel || '');
      if (/floating\/click-lock/i.test(source)) method = 'floating';
      else if (/glue-down/i.test(source)) method = 'glue_down';
    }
    if (method === 'floating') {
      return ['Floating / click-lock LVP material', 'Standard layout, cutting, and installation'];
    }
    if (method === 'glue_down') {
      return ['Glue-down LVP material', 'Standard layout, cutting, and installation'];
    }
    if (method === 'unknown') {
      return ['Luxury vinyl plank material', 'Install method not confirmed — verify floating vs glue-down'];
    }
  }
  if (itemId === 'flooring_sheet_vinyl' && measurements) {
    const type = measurements.flooringNewSheetVinylType;
    if (type === 'sheet_vinyl') {
      return ['Sheet vinyl material', 'Standard layout, welding/seaming, and installation'];
    }
    if (type === 'vct') {
      return ['VCT tile material', 'Standard layout, adhesive set, and installation'];
    }
    if (type === 'unknown') {
      return ['Sheet vinyl or VCT material', 'Product type not confirmed — verify before bidding'];
    }
  }
  return FLOORING_INSTALL_INCLUDED_LINES[itemId] || [];
}

export function flooringConfirmScopeMaterialBucketLabel(itemId: string): string {
  if (itemId === 'floor_prep') return 'Equipment/material';
  if (itemId === 'floor_demo') {
    return 'Equipment, protection, cleaning, haul-off & disposal';
  }
  return 'Material';
}

function flooringNewLvpInstallMethodLabel(
  method: string | null | undefined
): string | null {
  if (method === 'floating') return 'Floating / click-lock LVP';
  if (method === 'glue_down') return 'Glue-down LVP';
  if (method === 'unknown') return 'LVP — install method not confirmed';
  return null;
}

function flooringNewSheetVinylTypeLabel(type: string | null | undefined): string | null {
  if (type === 'sheet_vinyl') return 'Sheet vinyl installation';
  if (type === 'vct') return 'VCT installation';
  if (type === 'unknown') return 'Sheet vinyl / VCT — type not confirmed';
  return null;
}

/** Confirm Scope card title for flooring install rows with subtype selections. */
export function flooringScopeCardLabel(
  itemId: string,
  measurements: Record<string, unknown>
): string | null {
  if (itemId === 'flooring_lvp') {
    return flooringNewLvpInstallMethodLabel(measurements.flooringNewLvpInstallMethod as string) || 'LVP installation';
  }
  if (itemId === 'flooring_sheet_vinyl') {
    return flooringNewSheetVinylTypeLabel(measurements.flooringNewSheetVinylType as string) || 'Sheet vinyl / VCT installation';
  }
  return null;
}

/** Confirm Scope helper copy for flooring install rows with subtype selections. */
export function flooringScopeCardHelper(
  itemId: string,
  measurements: Record<string, unknown>
): string | null {
  if (itemId === 'flooring_lvp') {
    const method = measurements.flooringNewLvpInstallMethod;
    if (method === 'floating') {
      return 'Floating / click-lock luxury vinyl plank material and standard installation.';
    }
    if (method === 'glue_down') {
      return 'Glue-down luxury vinyl plank material and standard installation.';
    }
    if (method === 'unknown') {
      return 'Luxury vinyl plank material and standard installation. Confirm floating vs glue-down before bidding.';
    }
    return 'Luxury vinyl plank material and standard installation. Select install method in measurements.';
  }
  if (itemId === 'flooring_sheet_vinyl') {
    const type = measurements.flooringNewSheetVinylType;
    if (type === 'sheet_vinyl') {
      return 'Sheet vinyl material and standard installation.';
    }
    if (type === 'vct') {
      return 'VCT (vinyl composition tile) material and standard installation.';
    }
    if (type === 'unknown') {
      return 'Sheet vinyl or VCT material and standard installation. Confirm product type before bidding.';
    }
    return 'Sheet vinyl or VCT material and standard installation. Select product type in measurements.';
  }
  return null;
}
const FLOORING_MEASUREMENT_SCOPE_MAP: Array<[string, string]> = [
  ['flooring_lvp', 'flooringLvpSqft'],
  ['flooring_laminate', 'flooringLaminateSqft'],
  ['flooring_engineered_hardwood', 'flooringEngineeredHardwoodSqft'],
  ['flooring_solid_hardwood', 'flooringSolidHardwoodSqft'],
  ['tile_flooring', 'flooringTileSqft'],
  ['flooring_carpet', 'flooringCarpetSqft'],
  ['flooring_sheet_vinyl', 'floor_install__sheet_vinyl_vct'],
  ['floor_demo', 'floorDemoSqft'],
  ['underlayment', 'underlaymentSqft'],
  ['moisture_barrier', 'moistureBarrierSqft'],
  ['quarter_round', 'quarterRoundLf'],
];
const FLOORING_PRODUCT_SCOPE_MAP: Array<[string, string]> = [
  ['flooring_lvp', 'lvp'],
  ['flooring_laminate', 'laminate'],
  ['flooring_engineered_hardwood', 'engineered_hardwood'],
  ['flooring_solid_hardwood', 'solid_hardwood'],
  ['tile_flooring', 'tile'],
  ['flooring_carpet', 'carpet'],
  ['flooring_sheet_vinyl', 'sheet_vinyl_vct'],
];

function flooringMeasurementValue(
  measurements: Record<string, unknown>,
  key: string
): number | null {
  const direct = positiveCount(measurements[key]);
  if (direct) return direct;
  if (key.startsWith('floor_install__')) {
    const entry = measurements.itemQuantities as Record<string, { quantity?: unknown }> | undefined;
    return positiveCount(entry?.[key]?.quantity);
  }
  return null;
}

/** Product types with measured install SF or explicit QM selection. */
export function readFlooringProductScope(m: Record<string, unknown>): string[] {
  // An array is an explicit QM selection, including [] after a product is
  // deselected. Do not re-infer removed products from preserved measurements.
  if (Array.isArray(m.flooringProductScope)) {
    return [...new Set(m.flooringProductScope.map(String).filter(Boolean))];
  }
  const fromSqft = FLOORING_MEASUREMENT_SCOPE_MAP.slice(0, 7)
    .map(([itemId, key]) => {
      if (!flooringMeasurementValue(m, key)) return null;
      return FLOORING_PRODUCT_SCOPE_MAP.find(([id]) => id === itemId)?.[1] ?? null;
    })
    .filter((product): product is string => Boolean(product));
  return [...new Set(fromSqft)];
}

export function readFlooringExisting(m: Record<string, unknown>): FlooringExistingCounts {
  return {
    flooringExistingCount: positiveCount(m.flooringExistingCount),
    flooringExistingTypes: Array.isArray(m.flooringExistingTypes)
      ? (m.flooringExistingTypes as FlooringExistingCounts['flooringExistingTypes'])
      : null,
  };
}

export function readFlooringInstall(m: Record<string, unknown>): FlooringInstallCounts {
  return { flooringInstallScopeCount: positiveCount(m.flooringInstallScopeCount) };
}

export function readFlooringDemo(m: Record<string, unknown>): FlooringDemoCounts {
  return { flooringDemoScopeCount: positiveCount(m.flooringDemoScopeCount) };
}

export function emptyFlooringExisting(): FlooringExistingCounts {
  return { flooringExistingCount: null, flooringExistingTypes: null };
}

function notesMentionExistingFloor(n: string): boolean {
  return /\b(existing|current|old)\s+(?:floor|flooring|tile|lvp|vinyl|carpet)\b/.test(n);
}

export function inferExistingFlooringFromNotes(notes: string | null | undefined): FlooringExistingCounts {
  const n = String(notes || '').toLowerCase();
  const types: NonNullable<FlooringExistingCounts['flooringExistingTypes']> = [];
  const existingClauses = n.split(/[.;\n]+/);
  const hasExistingType = (pattern: RegExp) =>
    existingClauses.some((clause) => /\b(?:existing|current|old)\b/.test(clause) && pattern.test(clause));
  if (hasExistingType(/\bcarpet\b/)) types.push('carpet');
  if (hasExistingType(/\btile\b/)) types.push('tile');
  if (hasExistingType(/\b(?:solid\s+)?hardwood\b/) && !hasExistingType(/\bengineered\s+hardwood\b/)) types.push('solid_hardwood');
  if (hasExistingType(/\bengineered\s+hardwood\b/)) types.push('engineered_hardwood');
  if (hasExistingType(/\blaminate\b/)) types.push('laminate');
  if (hasExistingType(/\blvp\b/)) types.push('lvp');
  if (hasExistingType(/\b(?:sheet\s+vinyl|sheet\s+vct|vct|vinyl\s+tile|vinyl)\b/)) types.push('sheet_vinyl_vct');
  return notesMentionExistingFloor(n) ? { flooringExistingCount: 1, flooringExistingTypes: types.length ? types : ['unknown'] } : emptyFlooringExisting();
}

export function inferFlooringInstallFromIntent(params: {
  notes?: string | null;
  checklistItems?: ScopeChecklistItem[];
}): FlooringInstallCounts {
  const n = String(params.notes || '').toLowerCase();
  const included =
    params.checklistItems?.find((r) => r.id === 'flooring')?.state === 'included' ||
    inferItemStateFromNotes('flooring', n) === 'included' ||
    /\b(install|new)\s+(?:lvp|laminate|vinyl|flooring|carpet|tile\s+floor)\b/.test(n);
  return { flooringInstallScopeCount: included ? 1 : null };
}

export function resolveFlooringDemoFromIntent(params: {
  notes?: string | null;
  existing: FlooringExistingCounts;
  install: FlooringInstallCounts;
  checklistItems?: ScopeChecklistItem[];
}): FlooringDemoCounts {
  const n = String(params.notes || '').toLowerCase();
  const ex = params.existing;
  const ins = params.install;
  const floorDemoIncluded =
    params.checklistItems?.find((r) => r.id === 'floor_demo')?.state === 'included' ||
    inferItemStateFromNotes('floor_demo', n) === 'included' ||
    /\b(demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(floor|flooring|tile|lvp|vinyl|carpet)\b/.test(n);

  if (
    floorDemoIncluded &&
    ((positiveCount(ex.flooringExistingCount) || (ex.flooringExistingTypes?.length ?? 0) > 0) ||
      positiveCount(ins.flooringInstallScopeCount))
  ) {
    return { flooringDemoScopeCount: 1 };
  }
  if ((positiveCount(ex.flooringExistingCount) || (ex.flooringExistingTypes?.length ?? 0) > 0) && positiveCount(ins.flooringInstallScopeCount)) {
    return { flooringDemoScopeCount: 1 };
  }
  return { flooringDemoScopeCount: null };
}

export function syncFlooringQmScopeItems(
  items: ScopeChecklistItem[],
  m: Record<string, unknown>
): ScopeChecklistItem[] {
  const install = readFlooringInstall(m);
  const demo = readFlooringDemo(m);
  const existing = readFlooringExisting(m);
  const hasExistingFlooring =
    positiveCount(existing.flooringExistingCount) ||
    (existing.flooringExistingTypes?.length ?? 0) > 0;
  const explicitProductSelection = Array.isArray(m.flooringProductScope);
  const selectedProducts = new Set(readFlooringProductScope(m));
  const hasSpecificProduct = selectedProducts.size > 0;
  let changed = false;
  let next = items.map((row) => {
    const measurementKey = FLOORING_MEASUREMENT_SCOPE_MAP.find(([id]) => id === row.id)?.[1];
    const productScope = FLOORING_PRODUCT_SCOPE_MAP.find(([id]) => id === row.id)?.[1];
    if (productScope) {
      if (selectedProducts.has(productScope)) {
        if (row.state !== 'included') {
          changed = true;
          return { ...row, state: 'included' as const, noteBacked: true };
        }
      } else if (row.state === 'included') {
        changed = true;
        return { ...row, state: 'excluded' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'underlayment' && m.flooringAttachedPad === 'yes') {
      if (row.state !== 'excluded' || row.noteBacked) {
        changed = true;
        return { ...row, state: 'excluded' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'underlayment' && m.flooringAttachedPad === 'unknown') {
      if (row.state !== 'unsure' || row.noteBacked) {
        changed = true;
        return { ...row, state: 'unsure' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'moisture_barrier' && m.flooringMoistureMembraneIncluded === 'yes') {
      if (row.state !== 'excluded' || row.noteBacked) {
        changed = true;
        return { ...row, state: 'excluded' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'moisture_barrier' && m.flooringMoistureMembraneIncluded === 'unknown') {
      if (row.state !== 'unsure' || row.noteBacked) {
        changed = true;
        return { ...row, state: 'unsure' as const, noteBacked: false };
      }
      return row;
    }
    if (measurementKey && flooringMeasurementValue(m, measurementKey) && !explicitProductSelection) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    if (row.id === 'flooring' && positiveCount(install.flooringInstallScopeCount)) {
      if (hasSpecificProduct) {
        if (row.state !== 'excluded') {
          changed = true;
          return { ...row, state: 'excluded' as const, noteBacked: false };
        }
        return row;
      }
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    if (
      row.id === 'floor_demo' &&
      (positiveCount(demo.flooringDemoScopeCount) ||
        (hasExistingFlooring && positiveCount(install.flooringInstallScopeCount)))
    ) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    return row;
  });
  const productCardDefinitions: Record<string, { id: string; label: string; helperText: string }> = {
    lvp: {
      id: 'flooring_lvp',
      label: 'LVP installation',
      helperText: 'Luxury vinyl plank material and standard installation.',
    },
    laminate: {
      id: 'flooring_laminate',
      label: 'Laminate installation',
      helperText: 'Laminate flooring material and standard installation.',
    },
    engineered_hardwood: {
      id: 'flooring_engineered_hardwood',
      label: 'Engineered hardwood installation',
      helperText: 'Engineered hardwood material and standard installation.',
    },
    solid_hardwood: {
      id: 'flooring_solid_hardwood',
      label: 'Solid hardwood installation',
      helperText: 'Solid hardwood material and standard installation. Refinishing is separate.',
    },
    tile: {
      id: 'tile_flooring',
      label: 'Tile installation',
      helperText: 'Floor tile material and standard installation. Specialty patterns and stone upgrades are separate.',
    },
    carpet: {
      id: 'flooring_carpet',
      label: 'Carpet installation',
      helperText: 'Carpet material, pad, seams, and standard installation.',
    },
    sheet_vinyl_vct: {
      id: 'flooring_sheet_vinyl',
      label: 'Sheet vinyl / VCT installation',
      helperText: 'Sheet vinyl or VCT material and standard installation.',
    },
  };
  const missingProductCards = [...selectedProducts]
    .map((product) => productCardDefinitions[product])
    .filter((definition): definition is { id: string; label: string; helperText: string } =>
      Boolean(definition) && !next.some((row) => row.id === definition.id)
    )
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      helperText: definition.helperText,
      inputType: 'yes_no' as const,
      state: 'included' as const,
      category: 'flooring',
      noteBacked: true,
    }));
  if (missingProductCards.length > 0) {
    changed = true;
    const insertAt = next.findIndex((row) => row.id === 'floor_demo');
    if (insertAt >= 0) {
      next = [...next.slice(0, insertAt), ...missingProductCards, ...next.slice(insertAt)];
    } else {
      next = [...next, ...missingProductCards];
    }
  }
  return changed ? next : items;
}

function hydrateFlooring(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const notes = String(ctx.notes || '').toLowerCase();
  const inferredProductScope = [
    /\b(?:lvp|luxury\s+vinyl)\b/.test(notes) ? 'lvp' : null,
    /\blaminate\b/.test(notes) ? 'laminate' : null,
    /\bengineered\s+hardwood\b/.test(notes) ? 'engineered_hardwood' : null,
    /\bsolid\s+hardwood\b/.test(notes) ? 'solid_hardwood' : null,
    /\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b|\btile\b/.test(notes) ? 'tile' : null,
    /\bcarpet\b/.test(notes) ? 'carpet' : null,
  ].filter(Boolean);
  const hasSaved = positiveCount(saved.flooringInstallScopeCount) || positiveCount(saved.flooringDemoScopeCount);

  let existing = readFlooringExisting(saved);
  const inferredExisting = inferExistingFlooringFromNotes(ctx.notes);
  existing = {
    flooringExistingCount:
      positiveCount(saved.flooringExistingCount) || inferredExisting.flooringExistingCount,
    flooringExistingTypes:
      (Array.isArray(saved.flooringExistingTypes) && saved.flooringExistingTypes.length
        ? saved.flooringExistingTypes
        : inferredExisting.flooringExistingTypes) || null,
  };

  const install = positiveCount(saved.flooringInstallScopeCount)
    ? readFlooringInstall(saved)
    : inferFlooringInstallFromIntent({ notes: ctx.notes, checklistItems: ctx.checklistItems });

  const demo = positiveCount(saved.flooringDemoScopeCount)
    ? readFlooringDemo(saved)
    : resolveFlooringDemoFromIntent({
        notes: ctx.notes,
        existing,
        install,
        checklistItems: ctx.checklistItems,
      });

  return {
    ...saved,
    flooringSqft:
      positiveCount(saved.flooringSqft) ||
      positiveCount(saved.floorAreaSqft) ||
      null,
    ...existing,
    ...install,
    ...demo,
    flooringProductScope: (() => {
      const merged = readFlooringProductScope({
        ...saved,
        flooringProductScope:
          Array.isArray(saved.flooringProductScope) && saved.flooringProductScope.length
            ? saved.flooringProductScope
            : inferredProductScope,
      });
      return merged.length ? merged : null;
    })(),
  };
}

export const flooringQmPanel: QmPanelDefinition = {
  id: 'flooring_remodel',
  templateKeys: ['flooring'],
  embeddedScopeItemIds: [...FLOORING_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'flooring',
  hydrateMeasurements: hydrateFlooring,
  syncScopeItems: syncFlooringQmScopeItems,
};
