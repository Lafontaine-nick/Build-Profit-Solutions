import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  resolveRoughNationalTradeBandForTests,
  sourceDisplayLabel,
  sourceVisual,
} from '@/utils/estimateAiDraftPricing';
import { getNationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';

function pkg(name: string, scope = ''): EstimateDraftScopePackage {
  return {
    name,
    scope,
    scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
    price: null,
    laborPrice: null,
    materialPrice: null,
    pricingType: 'unknown',
    includesLabor: null,
    includesMaterials: null,
    priceSource: 'missing',
    status: 'missing_price',
    knownSubtotal: null,
    formula: null,
    missingInfo: [],
    missingPriceItems: [],
    pricingItems: [],
  } as EstimateDraftScopePackage;
}

function draft(overrides: Partial<EstimateAiDraft> = {}): EstimateAiDraft {
  return {
    projectType: 'other',
    estimateTier: 'simple_unit',
    originalNotes: '2000 sqft remodel',
    scopePackages: [],
    rooms: [],
    ...overrides,
  } as EstimateAiDraft;
}

describe('rough national pricing refine labels', () => {
  it('labels high-side ADU planning distinctly from national average', () => {
    expect(sourceDisplayLabel('national_high_side_planning')).toBe('High-side / ADU-small');
    expect(sourceDisplayLabel('national_trade_average')).toBe('National Average');

    const high = sourceVisual('national_high_side_planning', 'suggest');
    expect(high.shortLabel).toBe('High-side');
    expect(high.label).toMatch(/ADU-small/i);

    const nat = sourceVisual('national_trade_average', 'suggest');
    expect(nat.shortLabel).toBe('National');
  });
});

describe('resolveRoughNationalTradeBandForTests', () => {
  it('uses $17.50/framed sqft framing as standard national average', () => {
    const resolved = resolveRoughNationalTradeBandForTests('framing', pkg('Framing / shell'), draft());
    expect(resolved?.priceSource).toBe('national_trade_average');
    expect(resolved?.band.labor).toBe(7.5);
    expect((resolved?.band.material || 0) + (resolved?.band.labor || 0)).toBe(17.5);
  });

  it('uses high-side $21/framed sqft framing for ADU / small projects', () => {
    const resolved = resolveRoughNationalTradeBandForTests(
      'framing',
      pkg('Framing / shell'),
      draft({ projectType: 'adu', originalNotes: '800 sqft ADU' })
    );
    expect(resolved?.priceSource).toBe('national_high_side_planning');
    expect(resolved?.sourceLabel).toMatch(/High-side/i);
    expect(resolved?.band.labor).toBe(10);
    expect((resolved?.band.material || 0) + (resolved?.band.labor || 0)).toBe(21);
  });

  it('uses high-side framing when scope includes roof framing / sheathing / trusses', () => {
    const resolved = resolveRoughNationalTradeBandForTests(
      'framing',
      pkg('Framing / shell', 'Includes roof framing, sheathing, and trusses'),
      draft({ projectType: 'other', originalNotes: '2500 sqft custom home' })
    );
    expect(resolved?.priceSource).toBe('national_high_side_planning');
    expect((resolved?.band.material || 0) + (resolved?.band.labor || 0)).toBe(21);
  });

  it('uses ~$10.50 HVAC nationally and $12.50 high-side for ADU', () => {
    const standard = resolveRoughNationalTradeBandForTests('hvac', pkg('HVAC'), draft());
    expect((standard?.band.material || 0) + (standard?.band.labor || 0)).toBeCloseTo(10.5, 5);
    expect(standard?.priceSource).toBe('national_trade_average');

    const high = resolveRoughNationalTradeBandForTests(
      'hvac',
      pkg('HVAC'),
      draft({ projectType: 'adu', originalNotes: '800 sqft ADU' })
    );
    expect((high?.band.material || 0) + (high?.band.labor || 0)).toBeCloseTo(12.5, 5);
    expect(high?.priceSource).toBe('national_high_side_planning');
  });

  it('prefers per-point MEP when each count is available', () => {
    const plumbing = resolveRoughNationalTradeBandForTests(
      'plumbing_rough',
      pkg('Rough plumbing'),
      draft({ projectType: 'adu' }),
      { quantity: 8, unit: 'each' }
    );
    expect(plumbing?.band.unit).toBe('each');
    expect(plumbing?.mepMode).toBe('point');
    expect((plumbing?.band.material || 0) + (plumbing?.band.labor || 0)).toBe(500);

    const electrical = resolveRoughNationalTradeBandForTests(
      'electrical_rough',
      pkg('Rough electrical'),
      draft(),
      { quantity: 24, unit: 'each' }
    );
    expect(electrical?.band.unit).toBe('each');
    expect(electrical?.mepMode).toBe('point');
    expect((electrical?.band.material || 0) + (electrical?.band.labor || 0)).toBe(175);
  });

  it('falls back to mid-band sqft MEP when point counts are missing', () => {
    const plumbing = resolveRoughNationalTradeBandForTests(
      'plumbing_rough',
      pkg('Rough plumbing'),
      draft(),
      { quantity: 800, unit: 'sqft' }
    );
    expect(plumbing?.band.unit).toBe('sqft');
    expect(plumbing?.mepMode).toBe('sqft_fallback');
    expect((plumbing?.band.material || 0) + (plumbing?.band.labor || 0)).toBeCloseTo(6.5, 5);

    const electrical = resolveRoughNationalTradeBandForTests(
      'electrical_rough',
      pkg('Rough electrical'),
      draft(),
      null
    );
    expect(electrical?.band.unit).toBe('sqft');
    expect(electrical?.mepMode).toBe('sqft_fallback');
    expect((electrical?.band.material || 0) + (electrical?.band.labor || 0)).toBeCloseTo(5.5, 5);
  });
});

describe('confirm-scope national average refinements', () => {
  it('prices floor prep as basic prep (~$2.50/sqft), not flooring', () => {
    const prep = getNationalAverageBudgetSplit('floor_prep');
    expect(prep?.material).toBe(0.75);
    expect(prep?.labor).toBe(1.75);
    expect((prep?.material || 0) + (prep?.labor || 0)).toBe(2.5);
    expect(prep?.sourceLabel).toMatch(/basic floor prep/i);
  });

  it('labels paint and drywall as wall/ceiling surface rates', () => {
    expect(getNationalAverageBudgetSplit('paint')?.sourceLabel).toMatch(/wall\/ceiling surface/i);
    expect(getNationalAverageBudgetSplit('drywall')?.sourceLabel).toMatch(/wall\/ceiling surface/i);
  });

  it('keeps plumbing rough per point and raises electrical rough toward mid market', () => {
    const plumbing = getNationalAverageBudgetSplit('plumbing_rough');
    expect(plumbing?.unit).toBe('each');
    expect((plumbing?.material || 0) + (plumbing?.labor || 0)).toBe(500);

    const electrical = getNationalAverageBudgetSplit('electrical_rough');
    expect(electrical?.unit).toBe('each');
    expect((electrical?.material || 0) + (electrical?.labor || 0)).toBe(175);
  });
});
