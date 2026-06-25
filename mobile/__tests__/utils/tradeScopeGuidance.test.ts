import { getTradeScopeGuidance, recommendedActionLabel } from '@/utils/tradeScopeGuidance';

describe('tradeScopeGuidance', () => {
  it('provides excavation guidance without encoding it as benchmark fact', () => {
    const haulOff = getTradeScopeGuidance('excavation', 'haul_off');
    expect(haulOff?.guidanceText).toMatch(/leaves the site/i);
    expect(recommendedActionLabel(haulOff?.recommendedAction)).toBe('Recommended: Add as separate item');

    const backfill = getTradeScopeGuidance('excavation', 'backfill');
    expect(backfill?.guidanceText).toMatch(/onsite material/i);
    expect(recommendedActionLabel(backfill?.recommendedAction)).toBe('Recommended: Confirm project conditions');
  });

  it('covers additional trades with shared configuration', () => {
    expect(getTradeScopeGuidance('concrete', 'pumping')?.guidanceText).toMatch(/site access/i);
    expect(getTradeScopeGuidance('flooring', 'floor_demo')?.guidanceText).toMatch(/separate line item/i);
    expect(getTradeScopeGuidance('paint', 'prep')?.guidanceText).toMatch(/Surface prep/i);
  });
});
