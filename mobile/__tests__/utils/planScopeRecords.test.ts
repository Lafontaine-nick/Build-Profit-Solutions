import {
  buildPlanScopeRecords,
  formatPlanScopeFinding,
  planScopeRecordSummaryLines,
} from '@/utils/planScopeRecords';
import { wholeProjectDrawingCountApply } from '@/utils/planTakeoffReviewUi';

describe('planScopeRecords', () => {
  test('joins a labeled bath opening onto that room and keeps unread trades as allowances', () => {
    const records = buildPlanScopeRecords({
      buildingAreas: {
        totalLivingSqft: 2571,
        garageSqft: 1427,
        coveredPatioSqft: 322,
      },
      rooms: [
        { name: 'Garage', lengthFt: 21.5, widthFt: 23.5, areaSqft: 505.3, sourceSheet: 'A-1' },
        { name: 'Toy Garage', lengthFt: 24.75, widthFt: 20.75, areaSqft: 513.6, sourceSheet: 'A-1' },
        { name: 'Primary Bath', areaSqft: 65.5, sourceSheet: 'A-1' },
      ],
      measurements: { windowCount: 12 },
      openingEvidence: [
        {
          category: 'window',
          location: 'Primary Bath',
          mark: 'W-4',
          sheet: 'A-5',
          page: 7,
        },
      ],
      fixtureInventory: { toilets: 3 },
    });

    const bath = records.find(record => record.title === 'Primary Bath');
    expect(bath?.findings.map(item => item.label)).toEqual([
      'Primary Bath',
      'Window · W-4',
    ]);
    expect(bath?.findings[1]).toMatchObject({
      status: 'read_from_plan',
      sheet: 'A-5',
      quantity: 1,
    });

    const openings = records.find(record => record.id === 'openings');
    expect(openings?.findings.map(item => item.label)).toEqual(
      expect.arrayContaining([
        'Windows',
        'Double garage doors',
        'RV / oversized garage doors',
      ])
    );
    expect(openings?.findings.some(item => item.id === 'opening-0')).toBe(false);

    const uncounted = records.find(record => record.id === 'uncounted');
    expect(uncounted?.findings.map(item => item.label)).toEqual(
      expect.arrayContaining(['Exterior doors', 'Sliding doors', 'Switches', 'Exhaust fans'])
    );
    expect(uncounted?.findings.find(item => item.label === 'Windows')).toBeUndefined();
    const allowances = records.find(record => record.id === 'allowances');
    expect(allowances?.title).toBe('Not printed on these sheets');
    expect(allowances?.findings.map(item => item.label)).toEqual(
      expect.arrayContaining(['Drywall', 'Foundation', 'Excavation'])
    );
    expect(formatPlanScopeFinding(allowances!.findings[0])).toMatch(/Planning allowance/);
    expect(planScopeRecordSummaryLines(records).join('\n')).toMatch(
      /2,571 sqft · Living area · Read from the plan/
    );
    expect(planScopeRecordSummaryLines(records).join('\n')).toMatch(
      /Drywall · Planning allowance/
    );
    expect(planScopeRecordSummaryLines(records).join('\n')).toMatch(
      /3 spaces detected on the plan/
    );
    expect(planScopeRecordSummaryLines(records).join('\n')).not.toMatch(/513\.6 sqft · Toy Garage/);
  });

  test('keeps unchecked drawing counts so Confirm Scope can ask for them', () => {
    const applied = wholeProjectDrawingCountApply([
      { key: 'floorAreaSqft', value: '2571', include: true, pricingEligible: true },
      { key: 'windowCount', value: '31', include: false, pricingEligible: false },
      { key: 'exteriorDoorCount', value: '4', include: false, pricingEligible: false },
      { key: 'interiorDoorCount', value: '19', include: false, pricingEligible: false },
      { key: 'singlePoleSwitchCount', value: '46', include: false, pricingEligible: false },
      { key: 'recessedLightCount', value: '31', include: true, pricingEligible: true },
    ]);
    expect(applied.values).toEqual({
      windowCount: '31',
      exteriorDoorCount: '4',
      interiorDoorCount: '19',
      singlePoleSwitchCount: '46',
    });
    expect(applied.sources.windowCount).toBe('needs_confirmation');
    expect(applied.values.recessedLightCount).toBeUndefined();
  });
});
