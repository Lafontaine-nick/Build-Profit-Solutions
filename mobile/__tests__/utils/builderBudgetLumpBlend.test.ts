import {
  blendBarometerLump,
  resolveBlendedLump,
  scaleLumpForState,
} from '@/utils/builderBudgetLumpBlend';

describe('builderBudgetLumpBlend', () => {
  test('blends 60% local + 40% national', () => {
    expect(blendBarometerLump(9800, 9269)).toBe(9587.6);
  });

  test('scales CA at 1.38 and leaves UT/FL at 1.0', () => {
    const base = 9587.6;
    expect(scaleLumpForState(base, { state: 'UT' }).total).toBe(9587.6);
    expect(scaleLumpForState(base, { state: 'FL' }).total).toBe(9587.6);
    expect(scaleLumpForState(base, { state: 'CA' }).total).toBe(13230.89);
    expect(scaleLumpForState(base, { state: 'CA' }).stateCode).toBe('CA');
  });

  test('resolveBlendedLump labels Plan 41 + CA', () => {
    const result = resolveBlendedLump({
      local: 9800,
      national: 9269,
      barometerLabel: 'Plan 41',
      state: 'CA',
      scopeNoun: 'landscaping',
    });
    expect(result.blendedBase).toBe(9587.6);
    expect(result.total).toBe(13230.89);
    expect(result.rateSourceLabel).toBe('Blended national + barometer · Plan 41 · CA');
    expect(result.blendHelper).toMatch(/CA regional 1\.38/);
  });
});
