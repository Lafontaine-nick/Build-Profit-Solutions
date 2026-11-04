/**
 * Messy copies of the twelve simulator notes.
 * The checker scores these with an empty checklist, so a pass means the
 * wording itself produced the cards. A miss is a reader gap. This list does
 * not change the locked acceptance gate.
 */
export type RealNotesParaphrase = {
  id: string;
  notes: string;
  includedIds: string[];
  absentIds: string[];
};

export const REAL_NOTES_PARAPHRASES: RealNotesParaphrase[] = [
  {
    id: 'shower_clean',
    notes: 'Replace the shower tile and install 80 sqft of LVP in the bathroom.',
    includedIds: ['demo', 'shower_tile', 'flooring_lvp'],
    absentIds: ['floor_demo', 'waterproofing'],
  },
  {
    id: 'shower_messy',
    notes:
      "Customer wants the shower retiled. Pull the old tile. Throw down about 80 square feet of vinyl plank in that bath. Don't demo the floor. No waterproofing unless I say so.",
    includedIds: ['demo', 'shower_tile', 'flooring_lvp'],
    absentIds: ['floor_demo', 'waterproofing'],
  },
  {
    id: 'shower_with_tub',
    notes:
      'Replace the shower tile and demo tub, and install 80 sqft of LVP in the bathroom.',
    includedIds: ['tub_demo', 'demo', 'shower_tile', 'flooring_lvp'],
    absentIds: ['floor_demo', 'waterproofing'],
  },
  {
    id: 'shower_all_named',
    notes:
      'Replace the shower tile. Demo the tub, the prefab pan, the enclosure, and the shower door. Install 80 sqft of LVP.',
    includedIds: ['tub_demo', 'demo', 'shower_tile', 'flooring_lvp'],
    absentIds: ['floor_demo', 'waterproofing'],
  },
  {
    id: 'kitchen_exclusion',
    notes:
      'Kitchen remodel with 18 LF cabinets, 55 sqft counters, and 28 sqft backsplash. Flooring by others. Labor $8,500, material $12,000.',
    includedIds: ['cabinets'],
    absentIds: ['flooring', 'flooring_lvp'],
  },
  {
    id: 'carpet_replace',
    notes: 'Replace 900 sqft of carpet with LVP.',
    includedIds: ['flooring_lvp'],
    absentIds: [],
  },
  {
    id: 'owner_removes_carpet',
    notes: 'Install 1,200 sqft of LVP. Homeowner is removing the carpet.',
    includedIds: ['flooring_lvp'],
    absentIds: ['floor_demo'],
  },
  {
    id: 'drywall_denial',
    notes:
      "Hang and finish the drywall in the living room, about 600 sqft of walls. No new insulation. Don't paint.",
    includedIds: ['drywall'],
    absentIds: ['insulation', 'interior_paint', 'paint'],
  },
  {
    id: 'addition_no_roof',
    notes: 'Build a 320 sqft bedroom addition. Frame the walls. No roofing in this bid.',
    includedIds: ['wall_framing'],
    absentIds: ['roofing'],
  },
  {
    id: 'garage_no_hvac',
    notes:
      'Convert the 400 sqft garage. Hang 800 sqft of drywall and install 400 sqft of LVP. No new HVAC.',
    includedIds: ['drywall', 'flooring_lvp'],
    absentIds: ['hvac'],
  },
  {
    id: 'stucco_replace',
    notes: 'Replace the stucco, 1,800 sqft.',
    includedIds: ['stucco'],
    absentIds: [],
  },
  {
    id: 'whole_house_names',
    notes:
      'Whole house remodel. Kitchen, two baths, flooring, interior paint, and a new roof. No HVAC.',
    includedIds: ['interior_paint', 'roofing'],
    absentIds: ['hvac'],
  },
];
