import {
  countFilledQuickMeasurements,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  quickMeasurementSectionsForRows,
  resolveEffectiveQuickMeasurementTemplateKey,
  resolveQuickMeasurementDisplayValue,
  resolveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';
import { tradeQuickMeasurementFieldKeys } from '@/utils/planImportTradeConfig';

describe('scopeQuickMeasurements', () => {
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
  });

  it('upgrades room_remodel to ground_up when plan takeoff looks like a whole home', () => {
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'room_remodel',
        planRoomCount: 11,
        livingSf: 3098,
        garageSf: 900,
      })
    ).toBe('ground_up');
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'kitchen',
        planRoomCount: 1,
        livingSf: 180,
      })
    ).toBe('kitchen');
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
