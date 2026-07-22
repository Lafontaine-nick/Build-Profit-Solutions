import {
  buildAreaReconciliation,
  formatPlanSourceLabel,
  measurementSemanticsV1Enabled,
  measurementStatusLabel,
  missingStatusForScope,
  type AreaReconciliation,
} from '@/utils/measurementSemantics';

export type PlanReviewSpaceKind = 'living' | 'garage' | 'other';

export function classifyPlanSpaceName(name: string): PlanReviewSpaceKind {
  const n = String(name || '');
  if (/\bgarage\b|\brv\s*garage\b|\bcarport\b/i.test(n)) return 'garage';
  if (/\bpatio\b|\bporch\b|\bdeck\b|\bbreezeway\b/i.test(n)) return 'other';
  return 'living';
}

export function spacesDetectedTitle(spaceCount: number): string {
  return `${spaceCount} spaces detected`;
}

export function readyStateSummary(input: {
  measurementCount: number;
  spaceCount: number;
  scopeCount: number;
}): string {
  const bits: string[] = [];
  if (input.measurementCount) {
    bits.push(
      `${input.measurementCount} project measurement${input.measurementCount === 1 ? '' : 's'}`
    );
  }
  if (input.spaceCount) {
    bits.push(`${input.spaceCount} detected space${input.spaceCount === 1 ? '' : 's'}`);
  }
  if (input.scopeCount) {
    bits.push(`${input.scopeCount} scope item${input.scopeCount === 1 ? '' : 's'}`);
  }
  return bits.length ? `Ready · ${bits.join(' · ')}` : 'Ready · Plan reviewed';
}

export function measurementDisplayLabel(
  key: string,
  value: number | null | undefined,
  livingSf?: number | null
): {
  label: string;
  subtext?: string | null;
} {
  if (!measurementSemanticsV1Enabled()) {
    if (key === 'floorAreaSqft') return { label: 'Living area' };
    return { label: key };
  }
  if (key === 'floorAreaSqft') return { label: 'Living area' };
  if (key === 'flooringSqft') {
    return {
      label: 'Gross interior floor area',
      // Single concise explanation — no second source/explanation line in the UI.
      subtext: 'Derived from declared living area — finish allocation required',
    };
  }
  if (key === 'garageSqft') return { label: 'Garage' };
  if (key === 'deckSqft') return { label: 'Deck / patio' };
  if (key === 'kitchenFloorSqft') return { label: 'Kitchen floor' };
  return { label: key };
}

function pageFromAssumptions(assumptions: string[] | null | undefined, patterns: RegExp[]): number | null {
  for (const line of assumptions || []) {
    const text = String(line || '');
    if (!patterns.some((p) => p.test(text))) continue;
    const match = text.match(/pages?\s*(\d+)(?:\s*[–-]\s*(\d+))?/i) || text.match(/sheet\s*(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function pageEndFromAssumptions(
  assumptions: string[] | null | undefined,
  patterns: RegExp[]
): number | null {
  for (const line of assumptions || []) {
    const text = String(line || '');
    if (!patterns.some((p) => p.test(text))) continue;
    const match = text.match(/pages?\s*(\d+)\s*[–-]\s*(\d+)/i);
    if (match) return Number(match[2]);
  }
  return null;
}

export function measurementSourceLabel(input: {
  key: string;
  value?: number | null;
  livingSf?: number | null;
  assumptions?: string[] | null;
  sourceLabel?: string | null;
  sourcePage?: number | null;
  sourceType?: string | null;
}): string | null {
  if (!measurementSemanticsV1Enabled()) return null;
  if (input.sourceLabel) return input.sourceLabel;

  if (input.key === 'flooringSqft') {
    // Display label already carries the one explanation line for gross floor area.
    return null;
  }

  const page = input.sourcePage ?? null;

  if (input.key === 'floorAreaSqft' || input.key === 'garageSqft' || input.key === 'deckSqft') {
    const resolvedPage =
      page ??
      pageFromAssumptions(input.assumptions, [
        /building\s*areas?/i,
        /cover\s*sheet/i,
        /schedule/i,
        /living/i,
        /garage/i,
        /patio|porch|deck/i,
      ]);
    return formatPlanSourceLabel({ kind: 'cover_sheet', page: resolvedPage });
  }

  if (input.key === 'kitchenFloorSqft' || input.key === 'bathroomFloorSqft') {
    const resolvedPage =
      page ?? pageFromAssumptions(input.assumptions, [/kitchen|bath|room|dimension|floor\s*plan/i]);
    return resolvedPage != null
      ? `Derived from room dimensions — page ${resolvedPage}`
      : 'Derived from room dimensions';
  }

  return formatPlanSourceLabel({ kind: 'plan_generic', page: page ?? undefined });
}

export function roomSourceLabel(input: {
  name: string;
  lengthFt?: number | null;
  widthFt?: number | null;
  assumptions?: string[] | null;
  sourceLabel?: string | null;
  sourcePage?: number | null;
}): string | null {
  if (!measurementSemanticsV1Enabled()) return null;
  if (input.sourceLabel) return input.sourceLabel;
  if (input.lengthFt != null && input.widthFt != null) {
    const page =
      input.sourcePage ??
      pageFromAssumptions(input.assumptions, [/room|dimension|floor\s*plan|pdf text/i]);
    return page != null
      ? `Derived from room dimensions — page ${page}`
      : 'Derived from room dimensions';
  }
  return formatPlanSourceLabel({ kind: 'plan_generic' });
}

function pageFromText(text: string | null | undefined): number | null {
  const match = String(text || '').match(/pages?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isGenericGroundUpEvidence(evidence: string): boolean {
  return /standard\s+for\s+ground-?up|standard\s+ground-?up\s+scope/i.test(evidence || '');
}

export function scopeTakeoffStatusLines(input: {
  itemId: string;
  evidence?: string | null;
  hasRoofQuantity?: boolean;
  assumptions?: string[] | null;
  /** True when plan-derived room/floor SF exists (e.g. kitchen floor, rooms from page 4). */
  hasPlanFloorAreas?: boolean;
}): string[] {
  if (!measurementSemanticsV1Enabled()) {
    return input.evidence ? [String(input.evidence)] : [];
  }

  const id = input.itemId;
  const evidence = String(input.evidence || '').trim();
  const lines: string[] = [];
  const status = missingStatusForScope(id);
  const isTileFlooring = id === 'tile_flooring' || id === 'flooring' || id === 'tile';

  if (id === 'mep_rough') {
    const page =
      pageFromText(evidence) ??
      pageFromAssumptions(input.assumptions, [/electrical|mep|plumbing|hvac/i]);
    lines.push(
      page != null
        ? `Electrical detected on page ${page}; plumbing and HVAC require trade review`
        : 'Electrical detected; plumbing and HVAC require trade review'
    );
  } else if (isTileFlooring && (input.hasPlanFloorAreas || !isGenericGroundUpEvidence(evidence))) {
    const page =
      pageFromText(evidence) ??
      pageFromAssumptions(input.assumptions, [/floor\s*plan|room|dimension|tile|flooring/i]);
    if (page != null || input.hasPlanFloorAreas) {
      lines.push(
        page != null ? `Floor areas detected from page ${page}` : 'Floor areas detected from plan'
      );
    } else if (evidence && !isGenericGroundUpEvidence(evidence)) {
      lines.push(evidence);
    } else {
      lines.push('Standard ground-up scope');
    }
  } else if (evidence) {
    lines.push(evidence);
  } else if (id === 'sitework' || id === 'excavation') {
    lines.push('Standard ground-up scope — needs site takeoff');
  } else if (id === 'foundation') {
    const page = pageFromAssumptions(input.assumptions, [/foundation/i]);
    lines.push(formatPlanSourceLabel({ kind: 'foundation_plan', page }));
  } else if (id === 'framing') {
    const page = pageFromAssumptions(input.assumptions, [/framing/i]);
    lines.push(formatPlanSourceLabel({ kind: 'framing_plan', page }));
  } else if (id === 'roofing') {
    const page = pageFromAssumptions(input.assumptions, [/roof/i]);
    lines.push(formatPlanSourceLabel({ kind: 'roof_geometry', page }));
  } else if (id === 'exterior' || id === 'exterior_finishes') {
    const page = pageFromAssumptions(input.assumptions, [/elevation/i]);
    const pageEnd = pageEndFromAssumptions(input.assumptions, [/elevation/i]);
    lines.push(formatPlanSourceLabel({ kind: 'elevations', page, pageEnd }));
  } else {
    lines.push('Standard ground-up scope');
  }

  let statusLine: string | null = null;
  if (id === 'sitework' || id === 'excavation') {
    statusLine = evidence || lines.length ? 'Needs site takeoff' : null;
    if (!evidence && lines[0]?.includes('needs site takeoff')) statusLine = null;
  } else if (id === 'foundation') {
    statusLine = 'Needs structural takeoff';
  } else if (id === 'framing') {
    statusLine = 'Benchmark pricing available — detailed takeoff still required';
  } else if (id === 'roofing') {
    statusLine = input.hasRoofQuantity ? null : 'Needs roof geometry takeoff';
  } else if (id === 'mep_rough') {
    statusLine = 'Needs trade counts / installed-package pricing';
  } else if (isTileFlooring) {
    statusLine = 'Needs finish allocation and material-specific takeoff';
  } else if (id === 'exterior' || id === 'exterior_finishes') {
    statusLine = 'Needs exterior wall and opening takeoff';
  } else if (id === 'insulation') {
    statusLine = 'Needs envelope surface takeoff';
  } else if (id === 'drywall') {
    statusLine = 'Needs wall and ceiling takeoff';
  } else if (id === 'cabinets_counters' || id === 'cabinets' || id === 'countertops') {
    statusLine = 'Needs cabinet LF/count and countertop SF';
  } else if (id === 'appliances') {
    statusLine = 'Needs appliance count';
  } else if (status === 'needs_takeoff' || status === 'needs_structural_takeoff' || status === 'needs_count') {
    statusLine = measurementStatusLabel(status);
  }

  const joinedLower = lines.join(' ').toLowerCase();
  if (statusLine && !joinedLower.includes(statusLine.toLowerCase().slice(0, 18))) {
    lines.push(statusLine);
  }
  return lines.filter(Boolean);
}

export function resolvePlanAreaReconciliation(input: {
  areaReconciliation?: AreaReconciliation | null;
  measurements?: Record<string, number | string | null> | null;
  rooms?: Array<{ name?: string | null; areaSqft?: number | null }> | null;
}): AreaReconciliation {
  if (input.areaReconciliation) return input.areaReconciliation;
  return buildAreaReconciliation({
    declaredLivingSf: Number(input.measurements?.floorAreaSqft) || null,
    declaredGarageSf: Number(input.measurements?.garageSqft) || null,
    patioDeckSf: Number(input.measurements?.deckSqft) || null,
    rooms: input.rooms || [],
  });
}

/**
 * Display-only living status. Net detected rooms ≠ gross declared living SF is
 * incomplete room coverage — not a "material variance" between authoritative totals.
 */
export function livingReconciliationStatusLabel(recon: AreaReconciliation): string {
  const unassigned = recon.unassignedLivingSf;
  if (unassigned != null && unassigned > 0.05) {
    return `Room detection incomplete — ${formatSf(unassigned)} SF not assigned`;
  }
  if (recon.status === 'reconciled') return 'Reconciled';
  if (recon.livingVariancePercent != null && Math.abs(recon.livingVariancePercent) <= 3) {
    return 'Reconciled';
  }
  return 'Partial room coverage — review missing spaces';
}

/**
 * Display-only garage status. Thresholds unchanged (≤3 reconciled, ≤10 review band).
 */
export function garageReconciliationStatusLabel(recon: AreaReconciliation): string {
  const pct = recon.garageVariancePercent;
  if (pct == null) return 'Needs review';
  const abs = Math.abs(pct);
  if (abs <= 3) return 'Reconciled';
  if (abs <= 10) return 'Minor unreconciled area';
  return 'Needs review';
}

/** @deprecated Prefer living/garage-specific helpers — kept for call-site migration. */
export function varianceStatusLabel(
  status: AreaReconciliation['status'],
  kind: 'living' | 'garage'
): string {
  if (kind === 'living') {
    return status === 'reconciled'
      ? 'Reconciled'
      : 'Partial room coverage — review missing spaces';
  }
  if (status === 'reconciled') return 'Reconciled';
  if (status === 'review') return 'Minor unreconciled area';
  return 'Needs review';
}

export function applyPlanTakeoffButtonLabel(input: {
  includedMeasurementCount: number;
  checkedScopeCount: number;
  semanticsEnabled?: boolean;
}): string {
  const { includedMeasurementCount, checkedScopeCount } = input;
  const semantics =
    input.semanticsEnabled != null ? input.semanticsEnabled : measurementSemanticsV1Enabled();
  if (includedMeasurementCount > 0 && checkedScopeCount > 0) {
    return semantics ? 'Apply plan takeoff' : 'Apply to bid';
  }
  if (includedMeasurementCount > 0) {
    return `Apply ${includedMeasurementCount} measurement${includedMeasurementCount === 1 ? '' : 's'}`;
  }
  if (checkedScopeCount > 0) {
    return `Add ${checkedScopeCount} scope item${checkedScopeCount === 1 ? '' : 's'}`;
  }
  return 'Nothing selected';
}

/** Short Job notes prefill after plan import when the user has not typed notes yet. */
export function buildPlanReadyJobNotesPrompt(input: {
  livingSf?: number | null;
  measurementCount?: number;
  spaceCount?: number;
  scopeCount?: number;
}): string {
  const stats = importedPlanSummaryCollapsedSubtitle({
    livingSf: input.livingSf,
    spaceCount: input.spaceCount,
    scopeCount: input.scopeCount,
  });
  const meas = Number(input.measurementCount) || 0;
  const measBit =
    meas > 0 ? `${meas} project measurement${meas === 1 ? '' : 's'}` : null;
  const detail = stats || measBit;
  const detailSentence = detail ? ` ${detail}.` : '';
  // "Ground-up new construction" must stay in this string — draft classification
  // uses it to pick the ground_up checklist (excavation, flatwork, framing, MEP…).
  return (
    `Ground-up new construction plan imported and ready to generate.${detailSentence} ` +
    'Tap "Generate Estimate Draft" below to build your scope draft. ' +
    'Add any extra job details here (allowances, finishes, client notes).'
  );
}

/** True when Step 1 plan takeoff looks like a whole-home / new-build set. */
export function planImportLooksLikeGroundUp(planImport: {
  measurements?: Record<string, string | number | null | undefined> | null;
  rooms?: Array<{ name?: string; areaSqft?: number | null }> | null;
  buildingAreas?: { mainFloorLivingSqft?: number | null; garageSqft?: number | null } | null;
  planFacts?: { buildingAreas?: { mainFloorLivingSqft?: number | null; garageSqft?: number | null } } | null;
  scopeDetections?: Array<{ itemId?: string }> | null;
} | null | undefined): boolean {
  if (!planImport) return false;
  const rooms = planImport.rooms?.length || 0;
  const living =
    Number(planImport.measurements?.floorAreaSqft) ||
    Number(planImport.buildingAreas?.mainFloorLivingSqft) ||
    Number(planImport.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
    0;
  const garage =
    Number(planImport.measurements?.garageSqft) ||
    Number(planImport.buildingAreas?.garageSqft) ||
    Number(planImport.planFacts?.buildingAreas?.garageSqft) ||
    0;
  const structuralHits = (planImport.scopeDetections || []).filter((d) =>
    /^(foundation|framing|roofing|sitework|excavation|exterior|mep_rough|pour_flatwork|utility_taps)$/i.test(
      String(d.itemId || '')
    )
  ).length;
  return (
    rooms >= 4 ||
    structuralHits >= 2 ||
    (living >= 800 && rooms >= 2) ||
    (living >= 800 && garage > 0)
  );
}

/**
 * Ensure Generate uses ground-up classification when a whole-home plan is attached.
 * Does not replace user-authored remodel language.
 */
export function ensureGroundUpPlanNotes(notes: string, planImportLooksGroundUp: boolean): string {
  const text = String(notes || '').trim();
  if (!planImportLooksGroundUp) return text;
  if (/\b(ground[\s-]?up|new\s+construction|new\s+build|new\s+home|custom\s+home)\b/i.test(text)) {
    return text;
  }
  if (/\b(remodel|renovation|renovate|selective\s+demo|tear[\s-]?out)\b/i.test(text)) {
    return text;
  }
  const prefix = 'Ground-up new construction from imported architectural plans.';
  return text ? `${prefix}\n${text}` : prefix;
}

export function importedPlanSummaryCollapsedSubtitle(input: {
  livingSf?: number | null;
  spaceCount?: number;
  scopeCount?: number;
}): string {
  const bits: string[] = [];
  const living = Number(input.livingSf);
  if (Number.isFinite(living) && living > 0) {
    bits.push(`${formatSfWithCommas(living)} SF`);
  }
  if (input.spaceCount) {
    bits.push(`${input.spaceCount} detected space${input.spaceCount === 1 ? '' : 's'}`);
  }
  if (input.scopeCount) {
    bits.push(`${input.scopeCount} scope item${input.scopeCount === 1 ? '' : 's'}`);
  }
  return bits.join(' · ');
}

/** Strip generated plan-takeoff blobs so Job notes stay user-editable. */
export function stripPlanTakeoffFromNotes(notes: string): string {
  const text = String(notes || '');
  if (!text.trim()) return '';
  const stripped = text
    .replace(/\n*---\s*Plan takeoff\s*---[\s\S]*?(?=\n---\s|\s*$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripped;
}

export function buildImportedPlanSummaryText(input: {
  notesBlock?: string | null;
  measurements?: Record<string, string | number | null> | null;
  rooms?: Array<{ name: string; areaSqft: number | null }> | null;
  scopeLabels?: string[] | null;
}): string {
  if (input.notesBlock?.trim()) return input.notesBlock.trim();
  const lines: string[] = ['--- Plan takeoff ---'];
  const living = Number(input.measurements?.floorAreaSqft);
  const garage = Number(input.measurements?.garageSqft);
  const deck = Number(input.measurements?.deckSqft);
  if (Number.isFinite(living) && living > 0) {
    lines.push(
      `Total living area is ${living} sqft` +
        (Number.isFinite(garage) && garage > 0 ? ` with a garage area of ${garage} sqft` : '') +
        (Number.isFinite(deck) && deck > 0 ? ` and a covered patio of ${deck} sqft` : '') +
        '.'
    );
  }
  if (input.rooms?.length) {
    lines.push('Room measurements:');
    for (const room of input.rooms) {
      if (room.areaSqft != null) lines.push(`- ${room.name}: ${room.areaSqft} sqft`);
    }
  }
  if (input.scopeLabels?.length) {
    lines.push('Suggested scope from plans:');
    lines.push(input.scopeLabels.join(', '));
  }
  return lines.join('\n');
}

export function formatSf(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

export function formatSfWithCommas(n: number | null | undefined): string {
  const raw = formatSf(n);
  if (raw === '—') return raw;
  const [whole, frac] = raw.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac != null ? `${withCommas}.${frac}` : withCommas;
}
