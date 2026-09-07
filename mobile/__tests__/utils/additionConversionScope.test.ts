import {
  applyAdditionConversionScopeDefaults,
  applyScopeInferencesFromNotes,
  hydrateScopeChecklistFromNotes,
} from '@/utils/estimateScopeChecklistUi';

const GARAGE_OFFICE_NOTES =
  'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint, add 4 recessed lights and a few outlets, mini split HVAC. Keep existing garage door for now.';

function additionChecklistItems() {
  return [
    'plans_engineering',
    'permits',
    'utility_coordination',
    'sitework',
    'excavation',
    'grading',
    'utility_trenching',
    'foundation',
    'concrete',
    'framing',
    'roof_tie_in',
    'windows_doors',
    'exterior_finishes',
    'plumbing_rough',
    'electrical_rough',
    'hvac',
    'insulation',
    'drywall',
    'paint',
    'flooring',
    'cabinets_counters',
    'tile',
    'interior_trim',
    'plumbing_trim',
    'electrical_trim',
    'hvac_startup',
    'appliances',
    'final_inspections',
    'cleanup',
    'contingency',
  ].map(id => ({
    id,
    label: id,
    inputType: 'yes_no' as const,
    state: 'unsure' as const,
  }));
}

describe('addition / conversion scope defaults', () => {
  it('includes core shell and interior phases for garage conversion office notes', () => {
    const items = additionChecklistItems();
    const next = applyScopeInferencesFromNotes(
      items,
      GARAGE_OFFICE_NOTES,
      'addition',
      undefined,
      'garage_conversion'
    );

    const included = next.filter(i => i.state === 'included').map(i => i.id);
    const excluded = next.filter(i => i.state === 'excluded').map(i => i.id);

    expect(included).toEqual(
      expect.arrayContaining([
        'framing',
        'exterior_finishes',
        'insulation',
        'drywall',
        'paint',
        'flooring',
        'interior_trim',
        'electrical_rough',
        'electrical_trim',
        'hvac',
        'hvac_startup',
        'cleanup',
      ])
    );
    expect(excluded).toEqual(
      expect.arrayContaining(['foundation', 'roof_tie_in'])
    );
    expect(included).not.toContain('windows_doors');
  });

  it('adds bathroom plumbing and tile when a suite bathroom is mentioned', () => {
    const notes =
      'Garage conversion to in-law suite with full bathroom, tile shower, tub, toilet, and vanity.';
    const next = applyAdditionConversionScopeDefaults(additionChecklistItems(), {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes,
    });

    const included = next.filter(i => i.state === 'included').map(i => i.id);
    expect(included).toEqual(
      expect.arrayContaining(['plumbing_rough', 'plumbing_trim', 'tile'])
    );
  });

  it('defaults room addition shell phases closer to ground-up construction', () => {
    const notes = '400 sqft room addition off the back of the house.';
    const next = hydrateScopeChecklistFromNotes(
      additionChecklistItems(),
      'addition',
      notes,
      undefined,
      'room_addition'
    );

    const included = next.filter(i => i.state === 'included').map(i => i.id);
    expect(included).toEqual(
      expect.arrayContaining([
        'framing',
        'exterior_finishes',
        'foundation',
        'concrete',
        'roof_tie_in',
        'windows_doors',
        'final_inspections',
      ])
    );
  });
});
