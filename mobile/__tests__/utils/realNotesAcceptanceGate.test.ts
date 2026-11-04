import {
  acceptanceFailureMessage,
  evaluateRealNotesAcceptance,
  evaluateRealNotesCase,
} from '@/utils/realNotesAcceptanceGate';
import {
  REAL_NOTES_ACCEPTANCE_CORPUS,
  REAL_NOTES_ACCEPTANCE_CORPUS_VERSION,
  REAL_NOTES_ACCEPTANCE_RELEASE,
} from '@/utils/realNotesAcceptanceCorpus';
import { evaluateEstimateReliabilityContract } from '@/utils/estimateReliabilityContract';

describe('real-notes acceptance gate', () => {
  it('scores the versioned corpus through scope, price, and the confirmed snapshot', () => {
    const report = evaluateRealNotesAcceptance();
    expect(report.version).toBe(REAL_NOTES_ACCEPTANCE_CORPUS_VERSION);
    expect(report.caseCount).toBeGreaterThanOrEqual(30);
    expect(report.duplicateLines).toBe(
      REAL_NOTES_ACCEPTANCE_RELEASE.maxDuplicateLines
    );
    expect(report.inventedExclusions).toBe(
      REAL_NOTES_ACCEPTANCE_RELEASE.maxInventedExclusions
    );
    expect({
      passRate: report.passRate,
      passed: report.passed,
      failures: acceptanceFailureMessage(report),
    }).toEqual({
      passRate: expect.any(Number),
      passed: true,
      failures: '',
    });
    expect(report.passRate).toBeGreaterThanOrEqual(
      REAL_NOTES_ACCEPTANCE_RELEASE.minPassRate
    );
    expect(report.scorecard.scopeIntelligence.score).not.toBeNull();
    expect(report.scorecard.pricingIntegrity.score).not.toBeNull();
    expect(report.scorecard.pipelineConsistency.score).not.toBeNull();
    expect(report.scorecard.aiGeneralization.score).not.toBeNull();
    expect(report.scorecard.releaseConfidence).toBeGreaterThan(0);
  });

  it('names the case and category when a priced card is removed on the way back', () => {
    const flooring = REAL_NOTES_ACCEPTANCE_CORPUS.find(
      fixture => fixture.id === 'contractor_replace_carpet_lvp'
    )!;
    expect(evaluateRealNotesCase(flooring)).toEqual([]);
    const confirmed = {
      name: 'Confirm Scope',
      lines: [
        { itemId: 'flooring_lvp', total: 560 },
        { itemId: 'interior_paint', total: 400 },
      ],
      total: 960,
    };
    const kept = evaluateEstimateReliabilityContract({
      confirmed,
      stages: [
        { name: 'Initial Estimate', lines: confirmed.lines, total: 960 },
        { name: 'Step 3', lines: confirmed.lines, total: 960 },
        {
          name: 'PDF',
          lines: confirmed.lines.map(line => ({
            sourceItemId: line.itemId,
            total: line.total,
          })),
          total: 960,
        },
        { name: 'Back', lines: confirmed.lines, total: 960 },
      ],
      excludedKeys: ['floor_demo'],
    });
    expect(kept.passed).toBe(true);
    const removed = evaluateEstimateReliabilityContract({
      confirmed,
      stages: [
        {
          name: 'Back',
          lines: [{ itemId: 'interior_paint', total: 400 }],
          total: 400,
        },
      ],
    });
    expect(removed.passed).toBe(false);
    expect(removed.checks.some(check => check.id === 'Back-keys' && !check.passed)).toBe(
      true
    );
  });
});
