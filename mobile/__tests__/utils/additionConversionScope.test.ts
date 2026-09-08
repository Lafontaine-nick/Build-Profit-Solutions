import {
  applyAdditionConversionScopeDefaults,
  applyScopeInferencesFromNotes,
  filterExistingShellConversionConfirmScopeItems,
  filterGarageConversionConfirmScopeItems,
  groupScopeChecklistItems,
  hydrateScopeChecklistFromNotes,
  repairMisroutedConversionScopeChecklist,
  syncAdditionConversionScopeFromMeasurements,
} from '@/utils/estimateScopeChecklistUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';

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
    'wall_framing',
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
  it('includes interior wall framing — not shell framing — for garage conversion office notes', () => {
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
        'wall_framing',
        'insulation',
        'drywall',
        'paint',
        'flooring',
        'interior_trim',
        'electrical_rough',
        'hvac',
        'hvac_startup',
        'cleanup',
      ])
    );
    expect(included).not.toContain('electrical_trim');
    expect(excluded).toEqual(
      expect.arrayContaining([
        'framing',
        'exterior_finishes',
        'foundation',
        'roof_tie_in',
        'plans_engineering',
        'permits',
        'sitework',
      ])
    );
    expect(included).not.toContain('windows_doors');
  });

  it('excludes garage doors when notes say to keep the existing door', () => {
    expect(inferItemStateFromNotes('garage_doors', GARAGE_OFFICE_NOTES)).toBe(
      'excluded'
    );
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

  it('syncs windows_doors and interior_trim when opening counts are entered', () => {
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      GARAGE_OFFICE_NOTES,
      'addition',
      undefined,
      'garage_conversion'
    );
    const synced = syncAdditionConversionScopeFromMeasurements(
      items,
      {
        windowCount: '2',
        exteriorDoorCount: '1',
        interiorDoorCount: '2',
      },
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );
    const included = synced.filter(i => i.state === 'included').map(i => i.id);
    expect(included).not.toContain('windows_doors');
    expect(included).toEqual(expect.arrayContaining(['interior_trim']));
  });

  it('syncs windows_doors when notes explicitly add openings', () => {
    const notes =
      'Convert bonus room to office. Install 2 new windows and replace the exterior door.';
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      notes,
      'addition',
      undefined,
      undefined
    );
    const synced = syncAdditionConversionScopeFromMeasurements(
      items,
      { windowCount: '2', exteriorDoorCount: '1' },
      { templateKey: 'addition', notes }
    );
    const included = synced.filter(i => i.state === 'included').map(i => i.id);
    expect(included).toEqual(expect.arrayContaining(['windows_doors']));
  });

  it('hides excluded precon and site cards from garage conversion Confirm Scope', () => {
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      GARAGE_OFFICE_NOTES,
      'addition',
      undefined,
      'garage_conversion'
    );
    const visible = filterExistingShellConversionConfirmScopeItems(items, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });
    expect(visible.map(i => i.id)).not.toContain('plans_engineering');
    expect(visible.map(i => i.id)).not.toContain('excavation');
    expect(visible.map(i => i.id)).toContain('insulation');
    expect(visible.map(i => i.id)).toContain('drywall');
  });

  it('groups garage conversion cards in finish-out workflow sections', () => {
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      GARAGE_OFFICE_NOTES,
      'addition',
      undefined,
      'garage_conversion'
    );
    const visible = filterExistingShellConversionConfirmScopeItems(items, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });
    const grouped = groupScopeChecklistItems(visible, 'addition', {
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });

    expect(grouped.map(group => group.title)).toEqual([
      'Prep & structure',
      'MEP',
      'Finishes',
      'Trim-out',
      'Closeout',
    ]);
    expect(grouped.find(group => group.title === 'Prep & structure')?.items.map(i => i.id)).toEqual(
      expect.arrayContaining(['wall_framing', 'insulation'])
    );
    expect(grouped.find(group => group.title === 'MEP')?.items.map(i => i.id)).toEqual(
      expect.arrayContaining(['electrical_rough', 'hvac'])
    );
    expect(grouped.map(group => group.title)).not.toContain('Shell');
    expect(grouped.map(group => group.title)).not.toContain('Preconstruction');
  });

  it('uses new-structure addition groups for room additions', () => {
    const notes = '400 sqft room addition off the back of the house.';
    const items = hydrateScopeChecklistFromNotes(
      additionChecklistItems(),
      'addition',
      notes,
      undefined,
      'room_addition'
    );
    const grouped = groupScopeChecklistItems(items, 'addition', {
      projectType: 'room_addition',
      notes,
    });
    expect(grouped.map(group => group.title)).toEqual(
      expect.arrayContaining(['Shell', 'MEP Rough-ins', 'Interior'])
    );
    expect(grouped.map(group => group.title)).not.toContain('Prep & structure');
  });

  it('lets existing-shell notes override a broad room-addition or ADU project type', () => {
    for (const projectType of ['room_addition', 'adu']) {
      const notes =
        projectType === 'adu'
          ? 'Convert existing detached garage to ADU with insulation, drywall, and paint.'
          : 'Convert existing bonus room to bedroom with insulation, drywall, and paint.';
      const items = hydrateScopeChecklistFromNotes(
        additionChecklistItems(),
        'addition',
        notes,
        undefined,
        projectType
      );
      const visible = filterExistingShellConversionConfirmScopeItems(items, {
        templateKey: 'addition',
        projectType,
        notes,
      });
      expect(visible.map(item => item.id)).not.toContain('foundation');
      expect(visible.map(item => item.id)).not.toContain('framing');
      expect(visible.map(item => item.id)).toContain('wall_framing');
    }
  });

  it('treats a generic addition as new structure instead of silently making it a conversion', () => {
    const notes = 'Build an 800 sqft addition off the back of the house.';
    const items = hydrateScopeChecklistFromNotes(
      additionChecklistItems(),
      'addition',
      notes,
      undefined,
      'addition'
    );
    expect(items.find(item => item.id === 'foundation')?.state).toBe('included');
    expect(items.find(item => item.id === 'framing')?.state).toBe('included');
  });

  it('restores the canonical paint owner when granular paint was inferred first', () => {
    const notes = 'Convert existing bonus room to office. Drywall and paint.';
    const items = hydrateScopeChecklistFromNotes(
      additionChecklistItems(),
      'addition',
      notes,
      undefined,
      undefined
    );
    const paintItems = items.filter(item =>
      ['paint', 'interior_paint', 'prep', 'paint_trim'].includes(item.id) &&
      item.state === 'included'
    );
    expect(paintItems.map(item => item.id)).toEqual(['paint']);
  });

  it('hides excluded precon cards for basement conversion notes', () => {
    const notes =
      'Basement conversion to bedroom, about 350 sqft. Insulate walls, drywall, paint, add outlets.';
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      notes,
      'addition',
      undefined,
      undefined
    );
    const visible = filterExistingShellConversionConfirmScopeItems(items, {
      templateKey: 'addition',
      notes,
    });
    expect(visible.map(i => i.id)).not.toContain('foundation');
    expect(visible.map(i => i.id)).toContain('wall_framing');
    expect(visible.map(i => i.id)).toContain('insulation');
  });

  it('groups room conversion notes with finish-out sections', () => {
    const notes =
      'Convert existing bonus room to home office, about 300 sqft. Drywall, paint, recessed lights.';
    const items = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      notes,
      'addition',
      undefined,
      undefined
    );
    const visible = filterExistingShellConversionConfirmScopeItems(items, {
      templateKey: 'addition',
      notes,
    });
    const grouped = groupScopeChecklistItems(visible, 'addition', { notes });
    expect(grouped.map(group => group.title)).toEqual(
      expect.arrayContaining(['Prep & structure', 'MEP', 'Finishes'])
    );
    expect(visible.map(i => i.id)).not.toContain('framing');
    expect(visible.map(i => i.id)).toContain('wall_framing');
  });

  it('repairs windows_doors template to addition for convert-garage notes', () => {
    const draft = {
      projectType: 'other',
      originalNotes: GARAGE_OFFICE_NOTES,
      scopeChecklist: {
        templateKey: 'windows_doors',
        items: [
          {
            id: 'windows',
            label: 'Windows',
            inputType: 'yes_no' as const,
            state: 'included' as const,
          },
          {
            id: 'garage_doors',
            label: 'Garage doors',
            inputType: 'yes_no' as const,
            state: 'included' as const,
          },
        ],
      },
    } as EstimateAiDraft;

    const next = repairMisroutedConversionScopeChecklist(draft, GARAGE_OFFICE_NOTES);
    expect(next.scopeChecklist?.templateKey).toBe('addition');
    expect(next.estimateTier).toBe('addition');
    const included = (next.scopeChecklist?.items || [])
      .filter(i => i.state === 'included')
      .map(i => i.id);
    expect(included).toEqual(
      expect.arrayContaining(['wall_framing', 'insulation', 'drywall', 'paint'])
    );
  });
});
