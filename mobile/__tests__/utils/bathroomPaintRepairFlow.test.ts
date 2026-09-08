import {
  BATHROOM_FULL_ROOM_PAINT_SQFT_THRESHOLD,
  bathroomPaintRepairSeverityMultiplier,
  formatPaintRepairAutoFlowSummary,
  inferBathroomPaintRepairScopeFromMeasurements,
  paintRepairScopeSelectionComplete,
} from '@/utils/bathroomPaintRepairFlow';

describe('bathroomPaintRepairFlow', () => {
  it('infers affected area below full-room threshold', () => {
    expect(
      inferBathroomPaintRepairScopeFromMeasurements({ wallPaintSqft: '176' })
    ).toBe('affected_area');
    expect(
      inferBathroomPaintRepairScopeFromMeasurements({ wallPaintSqft: '120' })
    ).toBe('affected_area');
  });

  it('infers full room at or above threshold', () => {
    expect(
      inferBathroomPaintRepairScopeFromMeasurements({
        wallPaintSqft: String(BATHROOM_FULL_ROOM_PAINT_SQFT_THRESHOLD),
      })
    ).toBe('full_room');
  });

  it('treats Paint SF as scope-complete for pricing', () => {
    expect(
      paintRepairScopeSelectionComplete({
        localizedScope: null,
        wallPaintSqft: '100',
      })
    ).toBe(true);
  });

  it('formats auto-flow summary for combined affected area', () => {
    expect(
      formatPaintRepairAutoFlowSummary({
        wallPaintSqft: '100',
        paintRepairScope: 'affected_area',
        severity: 'moderate',
      })
    ).toMatch(/100 SF/);
    expect(
      formatPaintRepairAutoFlowSummary({
        wallPaintSqft: '100',
        paintRepairScope: 'affected_area',
        severity: 'moderate',
      })
    ).toMatch(/combined patch/i);
  });

  it('applies severity multipliers', () => {
    expect(bathroomPaintRepairSeverityMultiplier('minor')).toBe(0.88);
    expect(bathroomPaintRepairSeverityMultiplier('heavy')).toBe(1.22);
  });
});
