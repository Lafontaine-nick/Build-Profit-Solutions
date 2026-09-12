import {
  countFilledQuickMeasurements,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  quickMeasurementSectionsForRows,
  notesRequireInteriorPaintMeasurements,
  resolveEffectiveQuickMeasurementTemplateKey,
  resolveQuickMeasurementDisplayValue,
  resolveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';
import { tradeQuickMeasurementFieldKeys } from '@/utils/planImportTradeConfig';

describe('scopeQuickMeasurements', () => {
  it('hides the generic room-floor field for mixed interior refreshes', () => {
    const notes =
      'Full interior refresh on a 1,900 sqft house. Paint all walls and ceilings, new LVP throughout main floor about 1,100 sqft, update 6 interior doors and trim, patch drywall where needed. No exterior work on this one.';
    const keys = quickMeasurementRowsForTemplate('room_remodel', 'other', notes)
      .flat()
      .map(field => field.key);

    expect(keys).not.toContain('bathroomFloorSqft');
    expect(keys).toContain('wallPaintSqft');
    expect(keys).toContain('baseboardLf');
  });

  it('keeps wall and ceiling paint measurements visible for remodel notes', () => {
    const notes =
      'Remodel an existing 1,400 sqft home interior. Repaint interior walls and ceilings, and install 180 linear feet of baseboard.';
    expect(notesRequireInteriorPaintMeasurements(notes)).toBe(true);
    const keys = quickMeasurementRowsForTemplate('room_remodel', 'other', notes)
      .flat()
      .map(field => field.key);
    expect(keys).toContain('wallPaintSqft');
    expect(keys).toContain('ceilingPaintSqft');
  });

  it('filters stale room-remodel measurements for kitchen notes', () => {
    const notes =
      'Remodel an existing kitchen without changing the footprint. Install 42 linear feet of new cabinets, 55 sqft of quartz countertops, and 35 sqft of backsplash tile. Include flooring protection, demolition, disposal, and cleanup. No wall removal or structural framing.';
    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);

    expect(keys).toContain('cabinetLf');
    expect(keys).toContain('countertopSqft');
    expect(keys).not.toContain('floorAreaSqft');
    expect(keys).not.toContain('flooringSqft');
    expect(keys).not.toContain('drywallSqft');
    expect(keys).not.toContain('baseboardLf');
    expect(keys).not.toContain('wallPaintSqft');
    expect(keys).not.toContain('ceilingPaintSqft');
  });

  it('keeps unrelated paint measurements out of insulation quick measurements', () => {
    const keys = quickMeasurementRowsForInput(
      'insulation',
      'insulation',
      { wallPaintSqft: '2200' },
      ['wallPaintSqft']
    )
      .flat()
      .map(field => field.key);

    expect(keys).not.toContain('wallPaintSqft');
    expect(keys).not.toContain('ceilingPaintSqft');
    expect(keys).toContain('exteriorWallInsulationSqft');
  });

  it('labels addition floor area as ADU for ADU projects and marks it primary', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const floorArea = rows.flat().find(field => field.key === 'floorAreaSqft');
    const flooring = rows.flat().find(field => field.key === 'flooringSqft');

    expect(floorArea?.label).toBe('ADU');
    expect(floorArea?.unit).toBe('sqft');
    expect(floorArea?.placeholder).toBe('650');
    expect(floorArea?.primary).toBe(true);
    expect(flooring?.label).toBe('Flooring');
  });

  it('labels addition floor area by project type', () => {
    const roomAddition = quickMeasurementRowsForTemplate(
      'addition',
      'room_addition'
    )
      .flat()
      .find(field => field.key === 'floorAreaSqft');
    const garageConversion = quickMeasurementRowsForTemplate(
      'addition',
      'garage_conversion'
    )
      .flat()
      .find(field => field.key === 'floorAreaSqft');

    expect(roomAddition?.label).toBe('Room addition');
    expect(garageConversion?.label).toBe('Garage conversion');
    expect(garageConversion?.placeholder).toBe('400');
  });

  it('hides new-build structure fields for garage conversion quick measurements', () => {
    const notes =
      'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint.';
    const keys = quickMeasurementRowsForTemplate(
      'addition',
      'garage_conversion',
      notes
    )
      .flat()
      .map(field => field.key);
    expect(keys).toContain('floorAreaSqft');
    expect(keys).not.toContain('garageSqft');
    expect(keys).not.toContain('excavationCy');
    expect(keys).not.toContain('concreteCy');
    expect(keys).not.toContain('roofSquares');
    expect(keys).not.toContain('concreteSqft');
    expect(keys).not.toContain('showerWallTileSqft');
    expect(keys).toContain('windowCount');
    expect(keys).toContain('exteriorDoorCount');
    expect(keys).toContain('interiorDoorCount');
  });

  it('keeps an interior room remodel on the remodel measurement layout', () => {
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_remodel',
        planRoomCount: 11,
        livingSf: 3098,
        garageSf: 900,
      })
    ).toBe('room_remodel');
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'kitchen',
        planRoomCount: 1,
        livingSf: 180,
      })
    ).toBe('kitchen');
  });

  it('keeps a standalone bathroom remodel on the bathroom measurement layout', () => {
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'bathroom',
        projectType: 'bathroom',
        notes:
          'Remodel bathroom with shower tile, shower pan, vanity, toilet, drywall, insulation, and paint.',
      })
    ).toBe('bathroom');
  });

  it('keeps cross-trade measurement fields on bathroom remodels', () => {
    const keys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom with windows, an exterior door, insulation, and paint.'
    )
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'windowCount',
        'exteriorDoorCount',
        'exteriorWallInsulationSqft',
      ])
    );
  });

  it('shows only note-backed window and exterior-door measurements', () => {
    const bathroomNotes =
      'Remodel bathroom with two interior doors, insulation, and paint.';
    const bathroomKeys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      bathroomNotes
    )
      .flat()
      .map(field => field.key);
    expect(bathroomKeys).not.toContain('windowCount');
    expect(bathroomKeys).not.toContain('exteriorDoorCount');

    const crossTradeKeys = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom and replace 2 windows and 1 exterior door.'
    )
      .flat()
      .map(field => field.key);
    expect(crossTradeKeys).toEqual(
      expect.arrayContaining(['windowCount', 'exteriorDoorCount'])
    );
  });

  it('routes insulation-only notes to the insulation measurement layout', () => {
    const notes =
      'Insulate an existing 1,800 sqft two-story home. Install R-21 fiberglass batt insulation in 2,000 sqft of exterior walls, R-38 blown insulation in 1,200 sqft of attic area, and R-30 batt insulation in 900 sqft of floor area. Include air sealing and normal installation. No drywall removal.';

    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_remodel',
        projectType: 'other',
        notes,
      })
    ).toBe('insulation');
  });

  it('routes framing-focused room-addition notes to framing measurements', () => {
    const notes =
      'Frame a new 600 sqft room addition with 8-foot walls. Include exterior wall framing and interior partitions totaling 120 linear feet, roof tie-in framing, headers for 4 windows and 1 exterior door, sheathing, and blocking.';
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_addition',
        projectType: 'room_addition',
        notes,
      })
    ).toBe('framing');

    const keys = quickMeasurementRowsForTemplate(
      'room_addition',
      'room_addition',
      notes
    )
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'framedAreaSqft',
        'wallFramingLf',
        'sheathingSqft',
        'framingOpeningCount',
      ])
    );
    expect(keys).not.toContain('kitchenFloorSqft');
    expect(keys).not.toContain('cabinetLf');
  });

  it('uses only remodel measurements supported by the notes', () => {
    const rows = quickMeasurementRowsForTemplate(
      'room_remodel',
      'room_remodel',
      'Remodel an existing 1,400 sqft home interior. Install 900 sqft of LVP, replace 12 linear feet of kitchen countertops, install 42 linear feet of cabinets, repair 300 sqft of drywall, and install 180 linear feet of baseboard.'
    );
    const fields = rows.flat();
    expect(fields.map(field => field.key)).toEqual([
      'floorAreaSqft',
      'flooringSqft',
      'cabinetLf',
      'countertopLf',
      'drywallSqft',
      'baseboardLf',
    ]);
    expect(fields.find(field => field.key === 'countertopLf')?.unit).toBe('LF');
    expect(fields.map(field => field.key)).not.toContain('bathroomFloorSqft');
  });

  it('uses living-first ground_up layout for new builds', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'new_build')).toBe(
      'ground_up'
    );
    const keys = quickMeasurementRowsForTemplate('ground_up', 'new_build')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'floorAreaSqft',
        'garageSqft',
        'deckSqft',
        'kitchenFloorSqft',
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
        'concreteSqft',
        'roofSquares',
        'drywallSqft',
        'cabinetLf',
        'countertopSqft',
        'wallPaintSqft',
        'exteriorPaintSqft',
      ])
    );
    const living = quickMeasurementRowsForTemplate('ground_up', 'new_build')
      .flat()
      .find(field => field.key === 'floorAreaSqft');
    expect(living?.label).toBe('Living area');
    expect(living?.primary).toBe(true);
  });

  it('maps home_addition project type to addition living-first fields', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'home_addition')).toBe(
      'addition'
    );
    const keys = quickMeasurementRowsForTemplate('addition', 'home_addition')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'floorAreaSqft',
        'garageSqft',
        'deckSqft',
        'kitchenFloorSqft',
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
      ])
    );
  });

  it('prefers live form state over note prefill for note-backed quick fields', () => {
    expect(
      resolveQuickMeasurementDisplayValue(
        'drywallSqft',
        { drywallSqft: '1205' },
        { drywallSqft: '1000' }
      )
    ).toBe('1205');
    expect(
      resolveQuickMeasurementDisplayValue(
        'drywallSqft',
        { drywallSqft: '' },
        { drywallSqft: '1000' }
      )
    ).toBe('1000');
    expect(
      resolveQuickMeasurementDisplayValue(
        'cabinetPaintSqft',
        { cabinetPaintSqft: '' },
        { cabinetPaintSqft: '200' },
        { cabinetPaintSqft: true }
      )
    ).toBe('');
  });

  it('keeps addition quick measurement rows stable while typing', () => {
    const before = quickMeasurementRowsForInput(
      'addition',
      'adu',
      { excavationCy: '50' },
      ['excavationCy']
    );
    const after = quickMeasurementRowsForInput(
      'addition',
      'adu',
      { excavationCy: '51' },
      ['excavationCy']
    );
    expect(before.map(row => row.map(field => field.key).join('-'))).toEqual(
      after.map(row => row.map(field => field.key).join('-'))
    );
  });

  it('groups addition fields with primary Structure section first', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const sections = quickMeasurementSectionsForRows(rows);
    expect(sections[0]?.id).toBe('structure');
    expect(sections[0]?.rows[0]?.[0]?.key).toBe('floorAreaSqft');
    expect(sections[0]?.rows[0]?.[0]?.primary).toBe(true);
    expect(sections.map(s => s.id)).toEqual(
      expect.arrayContaining(['structure', 'exterior', 'interior', 'site'])
    );
  });

  it('counts filled quick measurements including note prefill', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const counts = countFilledQuickMeasurements(
      rows,
      { excavationCy: '50' },
      { flooringSqft: '1000' }
    );
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.filled).toBe(2);
  });

  it('bathroom quick measurements omit baseboard unless notes include LF', () => {
    const keys = quickMeasurementRowsForTemplate('bathroom', 'bathroom')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'bathroomFloorSqft',
        'showerWallTileSqft',
        'showerFloorTileSqft',
        'wallPaintSqft',
      ])
    );
    expect(keys).not.toContain('baseboardLf');
  });

  it('labels generic LF trim as Trim and explicit baseboard as Baseboard', () => {
    const trimField = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Remodel bathroom with 65 LF trim.'
    )
      .flat()
      .find(field => field.key === 'baseboardLf');
    const baseboardField = quickMeasurementRowsForTemplate(
      'bathroom',
      'bathroom',
      'Install 65 LF baseboard.'
    )
      .flat()
      .find(field => field.key === 'baseboardLf');

    expect(trimField?.label).toBe('Trim');
    expect(baseboardField?.label).toBe('Baseboard');
  });

  it('exposes plumbing quick measurements for plumbing and plumbing_service templates', () => {
    expect(
      resolveQuickMeasurementTemplateKey('plumbing_service', 'plumbing')
    ).toBe('plumbing');
    const keys = quickMeasurementRowsForTemplate('plumbing_service', 'plumbing')
      .flat()
      .map(field => field.key);
    expect(keys).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'fixtureReplacementCount',
      'fixtureRepairCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingFixturesHardwareCount',
      'waterHeaterCount',
      'gasLineLf',
      'gasApplianceConnectionCount',
    ]);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        'drainCleaningCount',
        'serviceCallCount',
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
    expect(keys).not.toContain('floorAreaSqft');
  });

  it('keeps standalone plumbing measurements explicit instead of inferring living area', () => {
    const fields = quickMeasurementRowsForTemplate(
      'plumbing',
      'plumbing'
    ).flat();
    expect(
      quickMeasurementHelperText(
        fields.find(field => field.key === 'plumbingRoughPointCount')!
      )
    ).toMatch(/not living sf/i);
    expect(fields.find(field => field.key === 'waterLineLf')?.unit).toBe('LF');
  });

  it('keeps Plumbing fields visible in selected-trade Quick Measurements', () => {
    const allowed = new Set(tradeQuickMeasurementFieldKeys('plumbing'));
    const fields = quickMeasurementRowsForTemplate(
      'plumbing_service',
      'plumbing'
    )
      .flat()
      .filter(field => allowed.has(field.key));
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.map(field => field.key)).toEqual(
      expect.arrayContaining(['plumbingRoughPointCount', 'waterLineLf'])
    );
  });

  it('uses a physical-only Plumbing projection for Plan Export', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'ground_up',
      {
        serviceCallCount: '1',
        fixtureRepairCount: '2',
        partsMaterialsCount: '1',
      },
      [],
      { plumbingPlanImport: true }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'waterLineLf',
      'sewerLineLf',
      'gasLineLf',
    ]);
    expect(rows.flat().find(field => field.key === 'waterLineLf')?.label).toBe(
      'Underground water service / under-slab piping'
    );
    expect(rows.flat().find(field => field.key === 'sewerLineLf')?.label).toBe(
      'Underground sewer / drain / under-slab DWV'
    );
    expect(rows.flat().map(field => field.key)).not.toEqual(
      expect.arrayContaining([
        'fixtureRepairCount',
        'serviceCallCount',
        'drainCleaningCount',
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
  });

  it('keeps explicit service rows for Notes/manual Plumbing flows', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'room_remodel',
      {
        emergencyFeeCount: '1',
        plumbingCleanupCount: '1',
      },
      [],
      { plumbingNotesFlow: true }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'fixtureReplacementCount',
      'fixtureRepairCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingFixturesHardwareCount',
      'waterHeaterCount',
      'gasLineLf',
      'gasApplianceConnectionCount',
      'serviceCallCount',
      'drainCleaningCount',
    ]);
    expect(rows.flat().map(field => field.key)).not.toEqual(
      expect.arrayContaining([
        'partsMaterialsCount',
        'emergencyFeeCount',
        'plumbingCleanupCount',
      ])
    );
  });

  it('uses service-only rows for standalone Plumbing Service mode', () => {
    const rows = quickMeasurementRowsForInput(
      'plumbing_service',
      'simple_unit',
      {},
      [],
      {
        plumbingNotesFlow: true,
        plumbingWorkflowMode: 'service',
      }
    );
    expect(rows.flat().map(field => field.key)).toEqual([
      'serviceCallCount',
      'fixtureRepairCount',
      'fixtureReplacementCount',
      'drainCleaningCount',
    ]);
  });

  it('keeps kitchen quick fields when checklist is kitchen even if projectType is flooring', () => {
    const rows = quickMeasurementRowsForTemplate('kitchen', 'flooring');
    const keys = rows.flat().map(field => field.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'kitchenFloorSqft',
        'backsplashSqft',
        'countertopSqft',
        'cabinetLf',
        'wallPaintSqft',
        'baseboardLf',
      ])
    );
    expect(keys).not.toContain('floorAreaSqft');
    expect(keys).not.toContain('bathroomFloorSqft');
  });

  it('keeps the kitchen floor field for a quantified cross-trade LVP note', () => {
    const notes =
      'Remodel kitchen with 38 LF cabinets, 48 sqft quartz counters, 220 sqft drywall repair, 700 sqft LVP, two new windows, and interior paint.';
    const rows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      ['kitchenFloorSqft'],
      { scopeNotes: notes }
    );
    expect(rows.flat().map(field => field.key)).toContain('kitchenFloorSqft');
  });

  it('relabels concrete flatwork as exterior-only with a clarifying helper (excludes house/garage slab)', () => {
    const rows = quickMeasurementRowsForTemplate('ground_up', 'new_build');
    const flatwork = rows.flat().find(field => field.key === 'concreteSqft');
    expect(flatwork?.label).toBe('Exterior concrete flatwork');
    expect(flatwork?.helperText).toMatch(/driveway/i);
    expect(flatwork?.helperText).toMatch(/not the house or garage slab/i);
  });

  it('labels foundation quantity to match included building slabs', () => {
    const rows = quickMeasurementRowsForTemplate('ground_up', 'new_build');
    const foundation = rows.flat().find(field => field.key === 'concreteCy');
    expect(foundation?.label).toMatch(/Foundation and building slabs/i);
  });

  it('clarifies Living vs Gross interior floor area', () => {
    const living = {
      key: 'floorAreaSqft' as const,
      label: 'Living area',
      placeholder: '',
      unit: 'sqft',
      group: 'structure' as const,
    };
    const gross = {
      key: 'flooringSqft' as const,
      label: 'Flooring',
      placeholder: '',
      unit: 'sqft',
      group: 'interior' as const,
    };
    expect(quickMeasurementHelperText(living)).toMatch(/living area/i);
    expect(quickMeasurementHelperText(gross)).toMatch(/matches living area/i);
    // Display label rename is behind measurement-semantics flag; helper always applies.
    const labeled = quickMeasurementDisplayLabel(gross);
    expect(
      labeled === 'Gross interior floor area' || labeled === 'Flooring'
    ).toBe(true);
  });
});
