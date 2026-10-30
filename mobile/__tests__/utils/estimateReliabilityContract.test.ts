import {
  evaluateEstimateReliabilityContract,
  reliabilityLineKey,
} from '@/utils/estimateReliabilityContract';

describe('estimate reliability contract', () => {
  it('passes when every downstream stage preserves the confirmed snapshot', () => {
    const report = evaluateEstimateReliabilityContract({
      confirmed: {
        name: 'Confirm Scope',
        lines: [
          { itemId: 'flooring', label: 'Flooring', total: 8000 },
          { itemId: 'paint', label: 'Paint', total: 4000 },
          { itemId: 'baseboard', label: 'Baseboard', total: 2000 },
        ],
        total: 14000,
      },
      stages: [
        {
          name: 'Initial Estimate',
          lines: [
            { itemId: 'flooring', label: 'Flooring', total: 8000 },
            { itemId: 'paint', label: 'Paint', total: 4000 },
            { itemId: 'baseboard', label: 'Baseboard', total: 2000 },
          ],
          total: 14000,
        },
        {
          name: 'Review',
          lines: [
            { checklistItemId: 'flooring', label: 'Flooring', total: 8000 },
            { checklistItemId: 'paint', label: 'Paint', total: 4000 },
            { checklistItemId: 'baseboard', label: 'Baseboard', total: 2000 },
          ],
          total: 14000,
        },
        {
          name: 'PDF',
          lines: [
            { sourceItemId: 'flooring', label: 'Flooring', total: 8000 },
            { sourceItemId: 'paint', label: 'Paint', total: 4000 },
            { sourceItemId: 'baseboard', label: 'Baseboard', total: 2000 },
          ],
          total: 14000,
        },
      ],
    });

    expect(report.passed).toBe(true);
    expect(report.score).toBe(10);
    expect(report.scorecard.pipelineConsistency.score).toBe(10);
    expect(report.scorecard.releaseConfidence).toBe(10);
  });

  it('detects a missing price, duplicate, disappearing line, and returned exclusion', () => {
    const report = evaluateEstimateReliabilityContract({
      confirmed: {
        name: 'Confirm Scope',
        lines: [
          { itemId: 'flooring', label: 'Flooring', total: 8000 },
          { itemId: 'paint', label: 'Paint', total: 4000 },
        ],
        total: 12000,
      },
      stages: [
        {
          name: 'Review',
          lines: [
            { itemId: 'flooring', label: 'Flooring', total: 0 },
            { itemId: 'flooring', label: 'Flooring duplicate', total: 8000 },
            { itemId: 'demo', label: 'Demo', total: 300 },
          ],
          total: 8300,
        },
      ],
      excludedKeys: ['demo'],
    });

    expect(report.passed).toBe(false);
    expect(report.checks.find(check => check.id === 'Review-keys')?.passed).toBe(false);
    expect(report.checks.find(check => check.id === 'Review-no-duplicates')?.passed).toBe(false);
    expect(report.checks.find(check => check.id === 'Review-priced')?.passed).toBe(false);
    expect(report.checks.find(check => check.id === 'explicit-exclusions-stay-out')?.passed).toBe(false);
  });

  it('uses canonical identifiers before display labels', () => {
    expect(
      reliabilityLineKey({
        itemId: 'flooring_install',
        label: 'LVP installation',
      })
    ).toBe('flooring_install');
  });

  it('reports separate reliability dimensions and gates release confidence', () => {
    const report = evaluateEstimateReliabilityContract({
      confirmed: {
        name: 'Confirm Scope',
        lines: [{ itemId: 'flooring', total: 100 }],
        total: 100,
      },
      stages: [
        {
          name: 'Review',
          lines: [{ itemId: 'flooring', total: 100 }],
          total: 100,
        },
      ],
      generalization: { passed: 8, total: 10 },
    });

    expect(report.scorecard.scopeIntelligence.score).toBe(10);
    expect(report.scorecard.pricingIntegrity.score).toBe(10);
    expect(report.scorecard.pipelineConsistency.score).toBe(10);
    expect(report.scorecard.aiGeneralization.score).toBe(8);
    expect(report.scorecard.releaseConfidence).toBe(8);
  });
});
