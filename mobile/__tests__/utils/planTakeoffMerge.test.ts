import { mergePlanMeasurementsIntoInput } from '@/utils/planTakeoffMerge';

describe('planTakeoffMerge', () => {
  it('fills empty fields only by default', () => {
    const { next, filled, filledKeys } = mergePlanMeasurementsIntoInput(
      { floorAreaSqft: '1000', kitchenFloorSqft: '', bathroomFloorSqft: '' },
      { floorAreaSqft: 900, kitchenFloorSqft: 120, bathroomFloorSqft: 40 }
    );
    expect(next.floorAreaSqft).toBe('1000');
    expect(next.kitchenFloorSqft).toBe('120');
    expect(next.bathroomFloorSqft).toBe('40');
    expect(filled).toBe(2);
    expect(filledKeys).toEqual(expect.arrayContaining(['kitchenFloorSqft', 'bathroomFloorSqft']));
  });

  it('overwrite replaces existing values', () => {
    const { next, filled } = mergePlanMeasurementsIntoInput(
      { floorAreaSqft: '1000' },
      { floorAreaSqft: 900 },
      { overwrite: true }
    );
    expect(next.floorAreaSqft).toBe('900');
    expect(filled).toBe(1);
  });
});
