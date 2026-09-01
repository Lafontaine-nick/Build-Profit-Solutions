import {
  estimateCartLaborQuantityLine,
  estimateCartLaborTitle,
  estimateCartMaterialQuantityLine,
  estimateCartMaterialTitle,
  estimateCartSourceLabel,
  stripEstimateImportAuditSuffix,
} from '../../utils/estimateCartLineItemDisplay';

const money = (n: number) => `$${n.toFixed(2)}`;

describe('stripEstimateImportAuditSuffix', () => {
  it('removes labor review parentheticals', () => {
    const input =
      'Ceilings paint\n(Material/labor split from notes — review on Labor step.)';
    expect(stripEstimateImportAuditSuffix(input)).toBe('Ceilings paint');
  });

  it('removes national average audit suffix', () => {
    const input =
      'Walls — labor (National Average budget split applied — review on Labor step.)';
    expect(stripEstimateImportAuditSuffix(input)).toBe('Walls — labor');
  });
});

describe('estimateCartLaborTitle', () => {
  it('uses short name with labor suffix', () => {
    expect(estimateCartLaborTitle({ name: 'Ceilings' })).toBe('Ceilings — labor');
  });

  it('does not double-append labor suffix', () => {
    expect(estimateCartLaborTitle({ name: 'Ceilings — labor' })).toBe(
      'Ceilings — labor'
    );
  });
});

describe('estimateCartMaterialTitle', () => {
  it('prefers item name', () => {
    expect(estimateCartMaterialTitle({ name: 'Walls — materials' })).toBe(
      'Walls — materials'
    );
  });
});

describe('estimateCart quantity lines', () => {
  it('formats labor sqft math', () => {
    const line = estimateCartLaborQuantityLine(
      {
        mode: 'sqft',
        quantity: 1000,
        rate: 0.5,
        total: 500,
        unit: 'sq ft',
      },
      0,
      money
    );
    expect(line).toBe('1000 sq ft × $0.50/sq ft');
  });

  it('formats material sqft math', () => {
    const line = estimateCartMaterialQuantityLine(
      {
        mode: 'sqft',
        quantity: 1500,
        unitPrice: 0.18,
        total: 270,
        unit: 'sq ft',
      },
      money
    );
    expect(line).toBe('1500 sq ft × $0.18/sq ft');
  });
});

describe('estimateCartSourceLabel', () => {
  it('returns trimmed display subtitle', () => {
    expect(estimateCartSourceLabel('Labor from notes')).toBe('Labor from notes');
  });

  it('returns null for empty subtitle', () => {
    expect(estimateCartSourceLabel('')).toBeNull();
  });
});
