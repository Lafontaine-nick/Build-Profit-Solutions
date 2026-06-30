import {
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
  resolveQuickMeasurementDisplayValue,
} from '@/utils/scopeQuickMeasurements';

describe('scopeQuickMeasurements', () => {
  it('labels addition floor area as ADU/casita sqft for ADU projects', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const floorArea = rows.flat().find((field) => field.key === 'floorAreaSqft');
    const flooring = rows.flat().find((field) => field.key === 'flooringSqft');

    expect(floorArea?.label).toBe('ADU / casita sqft');
    expect(floorArea?.placeholder).toBe('e.g. 650');
    expect(flooring?.label).toBe('Flooring sqft');
  });

  it('labels addition floor area by project type', () => {
    const roomAddition = quickMeasurementRowsForTemplate('addition', 'room_addition')
      .flat()
      .find((field) => field.key === 'floorAreaSqft');
    const garageConversion = quickMeasurementRowsForTemplate('addition', 'garage_conversion')
      .flat()
      .find((field) => field.key === 'floorAreaSqft');

    expect(roomAddition?.label).toBe('Room addition sqft');
    expect(garageConversion?.label).toBe('Garage conversion sqft');
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
});
