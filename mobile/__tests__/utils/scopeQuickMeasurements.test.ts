import { quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';

describe('scopeQuickMeasurements', () => {
  it('labels addition floor area as ADU/casita sqft for ADU projects', () => {
    const rows = quickMeasurementRowsForTemplate('addition', 'adu');
    const floorArea = rows.flat().find((field) => field.key === 'floorAreaSqft');

    expect(floorArea?.label).toBe('ADU / casita sqft');
    expect(floorArea?.placeholder).toBe('e.g. 650');
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
});
