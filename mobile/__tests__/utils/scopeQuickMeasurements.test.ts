import {
  countFilledQuickMeasurements,
  quickMeasurementDisplayLabel,
  quickMeasurementHelperText,
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  quickMeasurementSectionsForRows,
  resolveQuickMeasurementDisplayValue,
  resolveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';

describe('scopeQuickMeasurements', () => {
  it('labels addition floor area as ADU for ADU projects and marks it primary', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const floorArea = rows.flat().find((field) => field.key === 'floorAreaSqft');
    const flooring = rows.flat().find((field) => field.key === 'flooringSqft');

    expect(floorArea?.label).toBe('ADU');
    expect(floorArea?.unit).toBe('sqft');
    expect(floorArea?.placeholder).toBe('650');
    expect(floorArea?.primary).toBe(true);
    expect(flooring?.label).toBe('Flooring');
  });

  it('labels addition floor area by project type', () => {
    const roomAddition = quickMeasurementRowsForTemplate('addition', 'room_addition')
      .flat()
      .find((field) => field.key === 'floorAreaSqft');
    const garageConversion = quickMeasurementRowsForTemplate('addition', 'garage_conversion')
      .flat()
      .find((field) => field.key === 'floorAreaSqft');

    expect(roomAddition?.label).toBe('Room addition');
    expect(garageConversion?.label).toBe('Garage conversion');
  });

  it('uses living-first ground_up layout for new builds', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'new_build')).toBe('ground_up');
    const keys = quickMeasurementRowsForTemplate('ground_up', 'new_build')
      .flat()
      .map((field) => field.key);
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
      .find((field) => field.key === 'floorAreaSqft');
    expect(living?.label).toBe('Living area');
    expect(living?.primary).toBe(true);
  });

  it('maps home_addition project type to addition living-first fields', () => {
    expect(resolveQuickMeasurementTemplateKey(null, 'home_addition')).toBe('addition');
    const keys = quickMeasurementRowsForTemplate('addition', 'home_addition')
      .flat()
      .map((field) => field.key);
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
      resolveQuickMeasurementDisplayValue('drywallSqft', { drywallSqft: '1205' }, { drywallSqft: '1000' })
    ).toBe('1205');
    expect(
      resolveQuickMeasurementDisplayValue('drywallSqft', { drywallSqft: '' }, { drywallSqft: '1000' })
    ).toBe('1000');
  });

  it('keeps addition quick measurement rows stable while typing', () => {
    const before = quickMeasurementRowsForInput('addition', 'adu', { excavationCy: '50' }, ['excavationCy']);
    const after = quickMeasurementRowsForInput('addition', 'adu', { excavationCy: '51' }, ['excavationCy']);
    expect(before.map((row) => row.map((field) => field.key).join('-'))).toEqual(
      after.map((row) => row.map((field) => field.key).join('-'))
    );
  });

  it('groups addition fields with primary Structure section first', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const sections = quickMeasurementSectionsForRows(rows);
    expect(sections[0]?.id).toBe('structure');
    expect(sections[0]?.rows[0]?.[0]?.key).toBe('floorAreaSqft');
    expect(sections[0]?.rows[0]?.[0]?.primary).toBe(true);
    expect(sections.map((s) => s.id)).toEqual(
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

  it('keeps kitchen quick fields when checklist is kitchen even if projectType is flooring', () => {
    const rows = quickMeasurementRowsForTemplate('kitchen', 'flooring');
    const keys = rows.flat().map((field) => field.key);
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
    const flatwork = rows.flat().find((field) => field.key === 'concreteSqft');
    expect(flatwork?.label).toBe('Exterior concrete flatwork');
    expect(flatwork?.helperText).toMatch(/driveway/i);
    expect(flatwork?.helperText).toMatch(/not the house or garage slab/i);
  });

  it('labels foundation quantity to match included building slabs', () => {
    const rows = quickMeasurementRowsForTemplate('ground_up', 'new_build');
    const foundation = rows.flat().find((field) => field.key === 'concreteCy');
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
    expect(labeled === 'Gross interior floor area' || labeled === 'Flooring').toBe(true);
  });
});
