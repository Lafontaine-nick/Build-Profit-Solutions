/** Confirm Scope roofing-system picker. Residential coverings stay on the card.
 * Flat-roof systems appear only when the notes or the current choice need them.
 */

export const RESIDENTIAL_ROOF_SYSTEM_IDS = [
  'architectural_shingles',
  'three_tab_shingles',
  'standing_seam_metal',
  'exposed_fastener_metal',
  'concrete_clay_tile',
] as const;

export const FLAT_ROOF_SYSTEM_IDS = [
  'tpo',
  'epdm',
  'modified_bitumen',
] as const;

export const CUSTOM_ROOF_SYSTEM_ID = 'custom_other';

const RESIDENTIAL_SET = new Set<string>(RESIDENTIAL_ROOF_SYSTEM_IDS);
const FLAT_SET = new Set<string>(FLAT_ROOF_SYSTEM_IDS);

const SHORT_LABEL: Record<string, string> = {
  architectural_shingles: 'Architectural',
  three_tab_shingles: '3-tab',
  standing_seam_metal: 'Standing seam',
  exposed_fastener_metal: 'Metal panel',
  concrete_clay_tile: 'Tile',
  tpo: 'TPO',
  epdm: 'EPDM',
  modified_bitumen: 'Modified bitumen',
  custom_other: 'Custom roof',
};

const COLLAPSED_LABEL: Record<string, string> = {
  architectural_shingles: 'Architectural asphalt shingles',
  three_tab_shingles: '3-tab asphalt shingles',
  standing_seam_metal: 'Standing-seam metal',
  exposed_fastener_metal: 'Metal panel',
  concrete_clay_tile: 'Concrete / clay tile',
  tpo: 'TPO',
  epdm: 'EPDM',
  modified_bitumen: 'Modified bitumen',
  custom_other: 'Custom roof',
};

export function isResidentialRoofSystem(
  choiceId: string | null | undefined
): choiceId is (typeof RESIDENTIAL_ROOF_SYSTEM_IDS)[number] {
  return RESIDENTIAL_SET.has(String(choiceId || ''));
}

/** Flat, membrane, or commercial notes unlock TPO, EPDM, and modified bitumen. */
export function notesIncludeFlatRoofSystems(
  notes: string | null | undefined
): boolean {
  return /\b(?:flat\s+roofs?|low[\s-]?slope|membranes?|tpo|epdm|modified\s+bitumen|mod[\s-]?bit|torch[\s-]?down|commercial)\b/i.test(
    String(notes || '')
  );
}

/** Priced systems for the open picker. Custom is never a peer chip. */
export function roofingSystemChoicesForConfirm(input: {
  notes?: string | null;
  selectedId?: string | null;
}): string[] {
  const ids: string[] = [...RESIDENTIAL_ROOF_SYSTEM_IDS];
  const selected = String(input.selectedId || '');
  if (notesIncludeFlatRoofSystems(input.notes) || FLAT_SET.has(selected)) {
    ids.push(...FLAT_ROOF_SYSTEM_IDS);
  }
  return ids;
}

export function roofingSystemChipLabel(
  choiceId: string,
  collapsed: boolean
): string {
  const map = collapsed ? COLLAPSED_LABEL : SHORT_LABEL;
  return map[choiceId] || choiceId;
}
