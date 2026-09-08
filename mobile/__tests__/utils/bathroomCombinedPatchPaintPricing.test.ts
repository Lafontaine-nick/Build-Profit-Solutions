import {
  resolveBathroomCombinedPatchPaintScaledTotal,
} from '@/utils/bathroomDrywallPaintScope';

describe('resolveBathroomCombinedPatchPaintScaledTotal', () => {
  it('keeps $700 @ 36 SF reference for localized openings', () => {
    expect(resolveBathroomCombinedPatchPaintScaledTotal(36, 1)).toBe(700);
  });

  it('prices Johnson 176 SF moderate in planning range without linear cliff', () => {
    const total = resolveBathroomCombinedPatchPaintScaledTotal(176, 1);
    expect(total).toBe(1760);
    expect(total).toBeGreaterThan(1500);
    expect(total).toBeLessThan(2400);
  });

  it('stays smooth across the old 180 SF scope cliff', () => {
    const at176 = resolveBathroomCombinedPatchPaintScaledTotal(176, 1);
    const at180 = resolveBathroomCombinedPatchPaintScaledTotal(180, 1);
    expect(Math.abs(at180 - at176)).toBeLessThan(50);
  });

  it('applies severity multipliers on large areas', () => {
    expect(resolveBathroomCombinedPatchPaintScaledTotal(176, 1.22)).toBe(2147);
    expect(resolveBathroomCombinedPatchPaintScaledTotal(176, 0.88)).toBe(1549);
  });
});
