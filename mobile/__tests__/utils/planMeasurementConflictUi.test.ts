import {
  applyPlanConflictChoices,
  availablePlanConflictChoice,
  applyRepeatedPlumbingImportConflicts,
  shouldConfirmScopeShowPlanConflict,
  buildConflictResolution,
  conflictCandidateSourceLabel,
  conflictEvidenceSubtitle,
  conflictFieldLabel,
  conflictedSuggestedItemIds,
  filterLowConfidenceForReview,
  filterUnreadableForReview,
  planTakeoffConflictFieldSet,
  shortPlanTakeoffHelper,
  conflictResolutionProvenanceEntry,
  formatConflictCandidateChip,
  formatPlanTakeoffQuantity,
  labeledConflictCandidates,
  normalizePlanEvidenceSource,
  parseManualConflictValue,
  pendingManualConflictFields,
  planTakeoffUnit,
  togglePlanConflictChoice,
  uniqueConflictCandidateValues,
  retainPlanTakeoffConflicts,
  reviewablePlanMeasurementConflicts,
  uniqueUnreadablePlanFields,
  planConflictChooserRowsKey,
  conflictChooserConfirmedLine,
  conflictChooserLowConfidenceAcceptedLine,
  pendingPlanConfirmationReads,
  confirmPendingPlanConfirmationRead,
  isPendingPlanReadConfirmed,
} from '@/utils/planMeasurementConflictUi';
import type { PlanMeasurementConflict } from '@/utils/estimateAiDraft';

function conflict(
  field: string,
  values: number[],
  extras: Partial<PlanMeasurementConflict> = {}
): PlanMeasurementConflict {
  return {
    field,
    selectedValue: values[0],
    selectedSource: 'focused_trade',
    threshold: 0.15,
    requiresConfirmation: true,
    candidates: values.map((value, index) => ({
      value,
      source: index === 0 ? 'focused_trade' : 'general_pass',
      confidence: 0.7,
      directEvidence: true,
    })),
    ...extras,
  };
}

describe('planMeasurementConflictUi', () => {
  it('uses EA / LF / A for takeoff counts instead of sqft', () => {
    expect(planTakeoffUnit('recessedLightCount')).toBe('EA');
    expect(planTakeoffUnit('standardReceptacleCount')).toBe('EA');
    expect(planTakeoffUnit('conduitLf')).toBe('LF');
    expect(planTakeoffUnit('serviceAmperage')).toBe('A');
    expect(planTakeoffUnit('floorAreaSqft')).toBe('sqft');
    expect(planTakeoffUnit('hvacSystemTons')).toBe('ton');
    expect(formatPlanTakeoffQuantity('hvacSystemTons', 5)).toBe('5 tons');
    expect(formatPlanTakeoffQuantity('recessedLightCount', 40)).toBe('40 EA');
    expect(formatPlanTakeoffQuantity('recessedLightCount', 20)).toBe('20 EA');
    expect(formatPlanTakeoffQuantity('serviceAmperage', 200)).toBe('200A');
    expect(conflictFieldLabel('recessedLightCount')).toBe(
      'Recessed / canless / wafer light'
    );
    expect(conflictFieldLabel('singlePoleSwitchCount')).toBe(
      'Single-pole switch'
    );
    expect(conflictFieldLabel('sewerLineLf')).toBe('Sewer / drain piping');
    expect(conflictFieldLabel('waterLineLf')).toBe('Water line piping');
    expect(conflictFieldLabel('gasLineLf')).toBe('Gas piping');
    expect(conflictFieldLabel('hvacSupplyRegisterCount')).toBe('Supply registers');
    expect(conflictFieldLabel('hvacReturnGrilleCount')).toBe('Return grilles');
    expect(conflictFieldLabel('hvacSystemCount')).toBe('HVAC system');
  });

  it('drops low-confidence rows that already have a conflict card', () => {
    const excluded = planTakeoffConflictFieldSet([
      { field: 'hvacSupplyRegisterCount' },
      { field: 'hvacReturnGrilleCount' },
    ]);
    expect(
      filterLowConfidenceForReview(
        [
          { field: 'hvacSupplyRegisterCount', value: 12, confidence: 0.4 },
          { field: 'hvacSystemCount', value: 2, confidence: 0.4 },
        ],
        excluded
      ).map(row => row.field)
    ).toEqual(['hvacSystemCount']);
    expect(
      filterUnreadableForReview(
        [
          { field: 'hvacReturnGrilleCount', reason: 'Unreadable schedule' },
          { field: 'hvacDuctworkLf', reason: 'Missing dimensions' },
        ],
        excluded
      ).map(row => row.field)
    ).toEqual(['hvacDuctworkLf']);
  });

  it('shortens long helper copy for takeoff cards', () => {
    expect(
      shortPlanTakeoffHelper(
        'Count supply air registers or diffusers when documented on plans or schedules. Do not infer from living area.'
      )
    ).toBe(
      'Count supply air registers or diffusers when documented on plans or schedules.'
    );
  });

  it('dedupes candidate chips and keeps distinct pass values', () => {
    expect(
      uniqueConflictCandidateValues(
        conflict('recessedLightCount', [40, 20, 40])
      )
    ).toEqual([20, 40]);
  });

  it('keeps internal provenance tokens while rendering contractor-facing labels', () => {
    expect(normalizePlanEvidenceSource('general_plan_takeoff')).toBe(
      'VISION_GENERAL'
    );
    expect(normalizePlanEvidenceSource('focused_trade_takeoff')).toBe(
      'VISION_FOCUSED'
    );
    expect(normalizePlanEvidenceSource('pdf_text_instance_tags')).toBe(
      'PLAN_TAGS'
    );
    expect(conflictCandidateSourceLabel('general_plan_takeoff')).toBe(
      'AI symbol count (first review)'
    );
    expect(conflictCandidateSourceLabel('focused_trade_takeoff')).toBe(
      'AI symbol count (second review)'
    );
    expect(conflictCandidateSourceLabel('pdf_text_instance_tags')).toBe(
      'Counted from fixture tags on plan'
    );
    expect(
      formatConflictCandidateChip(
        'singlePoleSwitchCount',
        25,
        'general_plan_takeoff'
      )
    ).toBe('25 EA · AI symbol count (first review)');
    expect(
      formatConflictCandidateChip(
        'singlePoleSwitchCount',
        15,
        'focused_trade_takeoff'
      )
    ).toBe('15 EA · AI symbol count (second review)');
    expect(
      formatConflictCandidateChip(
        'recessedLightCount',
        46,
        'pdf_text_instance_tags'
      )
    ).toBe('46 EA · Counted from fixture tags on plan');
    const labeled = labeledConflictCandidates(
      conflict('singlePoleSwitchCount', [25, 15], {
        candidates: [
          {
            value: 25,
            source: 'general_plan_takeoff',
            confidence: 0.7,
            directEvidence: false,
          },
          {
            value: 15,
            source: 'focused_trade_takeoff',
            confidence: 0.7,
            directEvidence: false,
          },
        ],
      })
    );
    expect(labeled.map(item => [item.sourceToken, item.sourceLabel])).toEqual([
      ['VISION_GENERAL', 'AI symbol count (first review)'],
      ['VISION_FOCUSED', 'AI symbol count (second review)'],
    ]);
  });

  it('does not apply a conflicted winner until the contractor chooses', () => {
    const conflicts = [
      conflict('recessedLightCount', [40, 20]),
      conflict('singlePoleSwitchCount', [15, 20]),
    ];
    expect(applyPlanConflictChoices(conflicts, {}, {})).toMatchObject({
      resolved: {},
      unresolved: conflicts,
      resolutions: {},
    });
    expect(
      applyPlanConflictChoices(
        conflicts,
        { recessedLightCount: 20, singlePoleSwitchCount: 'manual' },
        { singlePoleSwitchCount: '18' }
      )
    ).toMatchObject({
      resolved: { recessedLightCount: 20, singlePoleSwitchCount: 18 },
      unresolved: [],
    });
  });

  it('maps unresolved electrical conflicts onto suggested-pricing cards', () => {
    expect([
      ...conflictedSuggestedItemIds([conflict('recessedLightCount', [40, 20])]),
    ]).toEqual(['electrical_recessed_light']);
  });

  it('keeps tag + vision candidates and does not auto-resolve', () => {
    const recessed = {
      field: 'recessedLightCount',
      selectedValue: 46,
      selectedSource: 'pdf_text_instance_tags',
      threshold: 1,
      requiresConfirmation: true,
      candidates: [
        {
          value: 46,
          source: 'pdf_text_instance_tags',
          confidence: 1,
          directEvidence: true,
        },
        {
          value: 32,
          source: 'general_plan_takeoff',
          confidence: 0.8,
          directEvidence: false,
        },
        {
          value: 20,
          source: 'focused_trade_takeoff',
          confidence: 0.85,
          directEvidence: false,
        },
      ],
    };
    const labeled = labeledConflictCandidates(recessed);
    expect(
      labeled.map(item => [item.value, item.sourceToken, item.sourceLabel])
    ).toEqual([
      [46, 'PLAN_TAGS', 'Counted from fixture tags on plan'],
      [32, 'VISION_GENERAL', 'AI symbol count (first review)'],
      [20, 'VISION_FOCUSED', 'AI symbol count (second review)'],
    ]);
    expect(conflictEvidenceSubtitle(recessed)).toBe(
      'Plan tag and AI readings disagree — choose one'
    );
    expect(applyPlanConflictChoices([recessed], {}, {}).resolved).toEqual({});
    expect(normalizePlanEvidenceSource('pdf_text_instance_tags')).toBe(
      'PLAN_TAGS'
    );
  });

  it('explains vision-vs-vision conflicts in contractor language', () => {
    const receptacles = conflict('standardReceptacleCount', [50, 40], {
      candidates: [
        {
          value: 50,
          source: 'general_plan_takeoff',
          confidence: 0.9,
          directEvidence: false,
        },
        {
          value: 40,
          source: 'focused_trade_takeoff',
          confidence: 0.85,
          directEvidence: false,
        },
      ],
    });
    expect(conflictEvidenceSubtitle(receptacles)).toBe(
      'Two AI counts disagree — choose one'
    );
    expect(
      applyPlanConflictChoices([receptacles], {}, {}).unresolved
    ).toHaveLength(1);
  });

  it('stores USER_CONFIRMED provenance when a candidate chip is chosen', () => {
    const recessed = {
      field: 'recessedLightCount',
      selectedValue: 46,
      selectedSource: 'pdf_text_instance_tags',
      threshold: 1,
      requiresConfirmation: true,
      candidates: [
        {
          value: 46,
          source: 'pdf_text_instance_tags',
          confidence: 1,
          directEvidence: true,
        },
        {
          value: 32,
          source: 'general_plan_takeoff',
          confidence: 0.8,
          directEvidence: false,
        },
        {
          value: 20,
          source: 'focused_trade_takeoff',
          confidence: 0.85,
          directEvidence: false,
        },
      ],
    };
    const chosen = applyPlanConflictChoices(
      [recessed],
      { recessedLightCount: 46 },
      {}
    );
    expect(chosen.resolved.recessedLightCount).toBe(46);
    expect(chosen.resolutions.recessedLightCount).toMatchObject({
      value: 46,
      provenance: 'USER_CONFIRMED',
      confirmedFrom: 'PLAN_TAGS',
    });
    expect(
      conflictResolutionProvenanceEntry(chosen.resolutions.recessedLightCount)
    ).toMatchObject({
      normalizedSource: 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
      confirmedFrom: 'PLAN_REVIEW',
      note: 'Contractor confirmed from plan review',
    });
    const typed = buildConflictResolution(recessed, 'manual', '44');
    expect(typed).toMatchObject({
      value: 44,
      provenance: 'USER_ENTERED',
      confirmedFrom: 'MANUAL',
    });
  });

  it('toggles a selected conflict choice back to unresolved', () => {
    expect(togglePlanConflictChoice(32, 32)).toBeUndefined();
    expect(togglePlanConflictChoice(32, 46)).toBe(46);
    expect(togglePlanConflictChoice('manual', 'manual')).toBeUndefined();
    expect(togglePlanConflictChoice(undefined, 'manual')).toBe('manual');
    expect(togglePlanConflictChoice(8, 8, { allowClear: false })).toBe(8);
  });

  it('keeps resolved conflict cards in place so Confirm Scope does not jump', () => {
    const fans = conflict('ceilingFanCount', [8, 6]);
    const lights = conflict('recessedLightCount', [40, 20]);
    expect(retainPlanTakeoffConflicts([], [fans])).toEqual([fans]);
    expect(retainPlanTakeoffConflicts([lights], [fans])).toEqual([
      fans,
      lights,
    ]);
    expect(retainPlanTakeoffConflicts([fans], [fans])).toEqual([fans]);
    expect(conflictChooserConfirmedLine('ceilingFanCount', 8)).toBe(
      'Confirmed · 8 EA'
    );
    expect(
      conflictChooserLowConfidenceAcceptedLine('hvacSystemTons', 5)
    ).toBe('AI read — confirm · 5 tons');
  });

  it('keeps Enter manually pending until a custom count is entered', () => {
    const recessed = {
      field: 'recessedLightCount',
      selectedValue: 46,
      selectedSource: 'pdf_text_instance_tags',
      threshold: 1,
      requiresConfirmation: true,
      candidates: [
        {
          value: 46,
          source: 'pdf_text_instance_tags',
          confidence: 1,
          directEvidence: true,
        },
        {
          value: 32,
          source: 'general_plan_takeoff',
          confidence: 0.8,
          directEvidence: false,
        },
      ],
    };
    expect(
      pendingManualConflictFields({ recessedLightCount: 'manual' }, {})
    ).toEqual(['recessedLightCount']);
    expect(
      pendingManualConflictFields(
        { recessedLightCount: 'manual' },
        { recessedLightCount: '44' }
      )
    ).toEqual(['recessedLightCount']);
    expect(
      pendingManualConflictFields(
        { recessedLightCount: 'manual' },
        { recessedLightCount: '44' },
        { recessedLightCount: true }
      )
    ).toEqual([]);
    expect(parseManualConflictValue('')).toBeNull();
    expect(parseManualConflictValue('44')).toBe(44);
    expect(
      applyPlanConflictChoices([recessed], { recessedLightCount: 'manual' }, {})
        .resolved
    ).toEqual({});
    expect(
      applyPlanConflictChoices(
        [recessed],
        { recessedLightCount: 'manual' },
        { recessedLightCount: '44' }
      ).resolved
    ).toEqual({ recessedLightCount: 44 });
  });

  it('does not treat a new conflicts array as a chooser identity change', () => {
    const first = [conflict('threeWaySwitchCount', [4, 5])];
    const copy = [conflict('threeWaySwitchCount', [4, 5])];
    expect(planConflictChooserRowsKey(first)).toBe(
      planConflictChooserRowsKey(copy)
    );
    expect(
      planConflictChooserRowsKey([
        ...first,
        conflict('smokeDetectorCount', [7, 10]),
      ])
    ).not.toBe(planConflictChooserRowsKey(first));
  });

  it('restores narrowed Electrical conflicts from provenance alternatives', () => {
    const gfci = conflict('gfciReceptacleCount', [8, 5]);
    const recovered = reviewablePlanMeasurementConflicts({
      conflicts: [gfci, conflict('standardReceptacleCount', [40])],
      provenance: {
        threeWaySwitchCount: {
          value: 6,
          source: 'general_plan_takeoff',
          alternatives: [{ value: 3, source: 'focused_trade_takeoff' }],
        },
        mainPanelCount: {
          value: 1,
          source: 'detected_from_plan',
          alternatives: [{ value: 1, source: 'focused_trade_takeoff' }],
        },
      },
    });
    expect(recovered.map(row => row.field)).toEqual([
      'gfciReceptacleCount',
      'threeWaySwitchCount',
    ]);
    expect(
      uniqueUnreadablePlanFields([
        { field: 'serviceAmperage', reason: 'No printed amperage callout' },
        { field: 'serviceAmperage', reason: 'No printed amperage callout' },
      ])
    ).toEqual([
      { field: 'serviceAmperage', reason: 'No printed amperage callout' },
    ]);
  });

  it('does not confirm a retained choice missing from the displayed candidates', () => {
    expect(availablePlanConflictChoice(20, [32, 46])).toBeUndefined();
    expect(availablePlanConflictChoice(46, [32, 46])).toBe(46);
    expect(availablePlanConflictChoice('manual', [32, 46])).toBe('manual');
  });

  it('puts same-plan sewer LF disagreements on the takeoff, not Confirm Scope', () => {
    const takeoff = applyRepeatedPlumbingImportConflicts(
      {
        measurements: { sewerLineLf: 25, waterLineLf: 50 },
        measurementConflicts: [],
        measurementProvenance: {
          sewerLineLf: { source: 'plan_import', value: 25 },
        },
      },
      {
        fingerprint: 'same-plan',
        measurements: { sewerLineLf: 30, waterLineLf: 50 },
      },
      'same-plan'
    );
    expect(takeoff.measurementConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'sewerLineLf',
          requiresConfirmation: true,
          candidates: expect.arrayContaining([
            expect.objectContaining({ value: 30 }),
            expect.objectContaining({ value: 25 }),
          ]),
        }),
      ])
    );
    expect(
      shouldConfirmScopeShowPlanConflict('sewerLineLf', {
        tradeKey: 'plumbing',
        templateKey: 'plumbing_service',
      })
    ).toBe(false);
    expect(
      shouldConfirmScopeShowPlanConflict('singlePoleSwitchCount', {
        tradeKey: 'electrical',
      })
    ).toBe(true);
  });

  it('lists skipped low-confidence HVAC reads for the pending confirmation strip', () => {
    const pending = pendingPlanConfirmationReads(
      {
        hvacSystemCount: 2,
        hvacSupplyRegisterCount: 10,
        quickMeasurementSources: {
          hvacSystemCount: 'needs_confirmation',
          hvacSupplyRegisterCount: 'needs_confirmation',
          hvacThermostatCount: 'plan_detected',
        },
      },
      new Set(['hvacSystemCount', 'hvacSupplyRegisterCount', 'hvacThermostatCount'])
    );
    expect(pending.map(row => row.field)).toEqual([
      'hvacSystemCount',
      'hvacSupplyRegisterCount',
    ]);
    const confirmed = confirmPendingPlanConfirmationRead(
      {
        hvacSystemCount: 2,
        quickMeasurementSources: { hvacSystemCount: 'needs_confirmation' },
      },
      'hvacSystemCount',
      2
    );
    expect(confirmed.quickMeasurementSources?.hvacSystemCount).toBe(
      'contractor_confirmed_from_plan_review'
    );
    expect(isPendingPlanReadConfirmed(confirmed, 'hvacSystemCount')).toBe(true);
    expect(
      pendingPlanConfirmationReads(confirmed, new Set(['hvacSystemCount']))
    ).toEqual([]);
  });
});
