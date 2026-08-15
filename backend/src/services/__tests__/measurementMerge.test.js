/* eslint-env jest */

const {
  mergeMeasurementCandidates,
  mergeMeasurementCandidateSets,
  materiallyConflicts,
} = require('../measurementMerge');

describe('measurement merge conflict handling', () => {
  test('uses the stronger candidate within tolerance without surfacing a conflict', () => {
    const result = mergeMeasurementCandidates({
      baseMeasurements: { stuccoGrossWallSqft: 3450 },
      overlayMeasurements: { stuccoGrossWallSqft: 3470 },
      baseConfidence: { stuccoGrossWallSqft: 0.8 },
      overlayConfidence: { stuccoGrossWallSqft: 0.6 },
    });

    expect(result.measurements.stuccoGrossWallSqft).toBe(3450);
    expect(result.conflicts).toHaveLength(0);
    expect(
      result.provenance.stuccoGrossWallSqft.alternatives[0].value
    ).toBe(3470);
  });

  test('retains both materially different candidates and selects stronger evidence', () => {
    const result = mergeMeasurementCandidates({
      baseMeasurements: { stuccoWindowDoorOpeningSqft: 289.6 },
      overlayMeasurements: { stuccoWindowDoorOpeningSqft: 582 },
      baseConfidence: { stuccoWindowDoorOpeningSqft: 0.7 },
      overlayConfidence: { stuccoWindowDoorOpeningSqft: 0.8 },
      overlayEvidence: { stuccoWindowDoorOpeningSqft: true },
    });

    expect(result.measurements.stuccoWindowDoorOpeningSqft).toBe(582);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].candidates).toHaveLength(2);
    expect(result.conflicts[0].requiresConfirmation).toBe(true);
  });

  test('direct dimensional evidence beats a higher-confidence inferred value', () => {
    const result = mergeMeasurementCandidates({
      baseMeasurements: { stuccoGrossWallSqft: 3300 },
      overlayMeasurements: { stuccoGrossWallSqft: 3450 },
      baseConfidence: { stuccoGrossWallSqft: 0.95 },
      overlayConfidence: { stuccoGrossWallSqft: 0.75 },
      overlayEvidence: { stuccoGrossWallSqft: true },
    });

    expect(result.measurements.stuccoGrossWallSqft).toBe(3450);
  });

  test('manual confirmation remains authoritative over a later AI candidate', () => {
    const result = mergeMeasurementCandidates({
      baseMeasurements: { stuccoWindowDoorOpeningSqft: 289.6 },
      overlayMeasurements: { stuccoWindowDoorOpeningSqft: 582 },
      baseSource: 'manual_user_confirmation',
      baseConfidence: { stuccoWindowDoorOpeningSqft: 1 },
      baseEvidence: { stuccoWindowDoorOpeningSqft: true },
      overlayConfidence: { stuccoWindowDoorOpeningSqft: 1 },
    });

    expect(result.measurements.stuccoWindowDoorOpeningSqft).toBe(289.6);
    expect(result.provenance.stuccoWindowDoorOpeningSqft.source).toBe(
      'manual_user_confirmation'
    );
  });

  test('does not treat small LF differences as conflicts', () => {
    expect(materiallyConflicts('stuccoFoamTrimLf', 150, 165)).toBe(false);
    expect(materiallyConflicts('stuccoFoamTrimLf', 150, 171)).toBe(true);
  });

  test('instance-tag counts conflict with vision instead of silently keeping vision', () => {
    const result = mergeMeasurementCandidateSets([
      {
        measurements: { recessedLightCount: 20, ceilingFanCount: 8 },
        confidence: { recessedLightCount: 0.8, ceilingFanCount: 0.75 },
        source: 'general_plan_takeoff',
      },
      {
        measurements: { recessedLightCount: 40, ceilingFanCount: 8 },
        confidence: { recessedLightCount: 0.85, ceilingFanCount: 0.8 },
        source: 'focused_trade_takeoff',
      },
      {
        measurements: { recessedLightCount: 48 },
        confidence: { recessedLightCount: 1 },
        source: 'pdf_text_instance_tags',
        evidence: { recessedLightCount: true },
        defaultConfidence: 1,
      },
    ]);
    expect(result.measurements.recessedLightCount).toBe(48);
    expect(result.provenance.recessedLightCount.source).toBe('pdf_text_instance_tags');
    const recessed = result.conflicts.find((row) => row.field === 'recessedLightCount');
    expect(recessed.requiresConfirmation).toBe(true);
    expect(recessed.candidates.map((row) => row.value).sort((a, b) => b - a)).toEqual([
      48, 40, 20,
    ]);
    expect(result.conflicts.find((row) => row.field === 'ceilingFanCount')).toBeUndefined();
    expect(result.measurements.ceilingFanCount).toBe(8);
    expect(result.provenance.ceilingFanCount.methodsAgree).toBe(true);
    expect(result.provenance.ceilingFanCount.independentVisionAgreement).toBe(true);
    expect(result.provenance.ceilingFanCount.candidateSources).toEqual(
      expect.arrayContaining(['general_plan_takeoff', 'focused_trade_takeoff'])
    );
  });
});
