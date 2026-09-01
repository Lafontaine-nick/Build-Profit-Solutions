import {
  hydrateLaborForEdit,
  hydrateMaterialForEdit,
  resolveMaterialCartUnitPrice,
} from '@/utils/estimateLineItemHydration';

describe('estimateLineItemHydration', () => {
  it('hydrates lf materials for dimensional edit instead of flat per-unit amount', () => {
    const item = {
      name: 'Baseboards, trim & molding — materials',
      quantity: 200,
      unit: 'lf',
      unitPrice: 2,
      total: 400,
    };

    const hydrated = hydrateMaterialForEdit(item);
    expect(hydrated.mode).toBe('sqft');
    expect(hydrated.quantity).toBe(200);
    expect(hydrated.unitPrice).toBe(2);
  });

  it('hydrates flat lot materials with total amount', () => {
    const item = {
      quantity: 1,
      unit: 'lot',
      unitPrice: 87,
      total: 87,
    };

    const hydrated = hydrateMaterialForEdit(item);
    expect(hydrated.mode).toBe('flat');
    expect(hydrated.unitPrice).toBe(87);
  });

  it('derives per-unit material rate when stored unit price is actually the total', () => {
    const unitPrice = resolveMaterialCartUnitPrice({
      quantity: 200,
      unit: 'lf',
      unitPrice: 400,
      total: 400,
    });
    expect(unitPrice).toBe(2);
  });

  it('hydrates labor from notes when rate was saved as the lump total', () => {
    const hydrated = hydrateLaborForEdit(
      {
        name: 'Walls',
        hours: 1500,
        unit: 'sq ft',
        mode: 'sqft',
        rate: 3718.5,
        total: 3718.5,
      },
      1500
    );

    expect(hydrated.mode).toBe('sqft');
    expect(Number(hydrated.hours)).toBe(1500);
    expect(hydrated.rate).toBeCloseTo(2.479, 3);
  });

  it('hydrates hourly labor when rate was saved as the lump total', () => {
    const hydrated = hydrateLaborForEdit({
      name: 'Baseboards, trim & molding',
      hours: 200,
      rate: 1000,
      total: 1000,
    });

    expect(hydrated.mode).toBe('hourly');
    expect(Number(hydrated.hours)).toBe(200);
    expect(hydrated.rate).toBe(5);
  });
});
