import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { normalizeScopeMeasurements } from '@/utils/scopeItemQuantities';
import {
  scopeCardAccentForItem,
  scopeCardOpacityForItem,
  scopeItemHasMeasuredSelection,
  scopeItemNoteBadge,
  SCOPE_ITEM_TIER_OPACITY,
  SCOPE_ITEM_UNSURE_OPACITY,
} from '@/utils/scopeItemVisualTier';

describe('scopeCardAccentForItem', () => {
  const unsureYesNo: Pick<ScopeChecklistItem, 'state' | 'choiceId' | 'inputType' | 'choiceIds'> = {
    state: 'unsure',
    inputType: 'yes_no',
  };

  test('Not sure uses shared subdued opacity for primary and secondary tiers', () => {
    expect(scopeCardAccentForItem('primary', unsureYesNo, true).opacity).toBe(
      SCOPE_ITEM_UNSURE_OPACITY
    );
    expect(scopeCardAccentForItem('secondary', unsureYesNo, true).opacity).toBe(
      SCOPE_ITEM_UNSURE_OPACITY
    );
    expect(scopeCardAccentForItem('primary', { state: 'included', inputType: 'yes_no' }, true).opacity).toBe(
      SCOPE_ITEM_TIER_OPACITY.primary
    );
  });

  test('Not sure adds softer card surface in dark mode', () => {
    const accent = scopeCardAccentForItem('secondary', unsureYesNo, true);
    expect(accent.backgroundColor).toBe('#202022');
    expect(accent.borderColor).toBeTruthy();
  });

  test('QM-backed included cards keep full-opacity standard surface', () => {
    const accent = scopeCardAccentForItem(
      'primary',
      {
        state: 'included',
        inputType: 'choice',
        choiceId: 'unsure',
        noteBacked: true,
      },
      true
    );
    expect(accent.opacity).toBe(1);
    expect(accent.backgroundColor).toBe('#202022');
  });

  test('excluded cards stay muted', () => {
    expect(scopeCardOpacityForItem('muted', unsureYesNo)).toBe(SCOPE_ITEM_TIER_OPACITY.muted);
  });

  test('Roofing cards highlight when QM selection has a measured quantity', () => {
    const item = {
      id: 'tear_off',
      state: 'unsure',
      inputType: 'choice',
      choiceId: 'unsure',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofSquares: 30,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['tear_off'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
    expect(
      scopeCardAccentForItem('primary', item, true, true)
    ).toMatchObject({
      opacity: 1,
      borderColor: '#fbbf24',
    });
  });

  test('Roofing system card highlights when shingles are measured in QM', () => {
    const item = {
      id: 'roofing_system',
      state: 'unsure',
      inputType: 'choice',
      choiceId: 'unsure',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofSquares: 30,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['shingles'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
  });

  test('Roof repairs card highlights when repair area is measured in QM', () => {
    const item = {
      id: 'roof_repairs',
      state: 'excluded',
      inputType: 'choice',
      choiceId: 'not_in_scope',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofRepairAffectedSqft: 50,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['roof_repairs'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
  });
});

describe('scopeItemNoteBadge', () => {
  test('plan-verified recessed lights are detected from the plan', () => {
    const item = {
      id: 'electrical_recessed_light',
      label: 'Recessed / canless / wafer light',
      state: 'included',
      inputType: 'yes_no',
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'electrical',
        notes: 'Detected electrical.',
        measurements: {
          recessedLightCount: 31,
          itemQuantities: {},
          quickMeasurementSources: {
            recessedLightCount: 'detected_from_plan',
          },
          measurementProvenance: {
            recessedLightCount: {
              status: 'plan_verified',
              evidenceKind: 'instance_tags',
              pricingEligible: true,
            },
          },
        },
      })
    ).toBe('from_plan');
  });

  test('a new roof plan does not badge typed quantities as mentioned in notes', () => {
    const item = {
      id: 'shingles_roofing',
      label: 'Shingles',
      state: 'included',
      inputType: 'yes_no',
      noteBacked: false,
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'roofing',
        notes: 'Detected roofing. Shingles, ridge vent, and gutters.',
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'roofing',
          planImportFingerprint: 'plan-1',
          roofSquares: 22,
          itemQuantities: {},
          quickMeasurementSources: {
            roofSquares: 'user_entered',
          },
        },
      })
    ).toBeNull();
  });

  test('a windows plan does not badge counted openings as mentioned in notes', () => {
    const item = {
      id: 'windows',
      label: 'Windows',
      state: 'included',
      inputType: 'yes_no',
      noteBacked: true,
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'windows_doors',
        notes: 'Detected windows doors.',
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'windows_doors',
          planImportFingerprint: 'lot-49',
          windowCount: 33,
          itemQuantities: {},
        },
      })
    ).toBeNull();
  });

  test('a cover-sheet framing package does not wear a notes badge', () => {
    const item = {
      id: 'framing',
      label: 'Framing (lumber + labor)',
      state: 'included',
      noteBacked: true,
    } as ScopeChecklistItem;
    const measurements = normalizeScopeMeasurements({
      planImportTradeKey: 'framing',
      planImportMode: 'selected_trade',
      floorAreaSqft: 2571,
      garageSqft: 1427,
      framedAreaSqft: 3998,
      quickMeasurementSources: {
        framedAreaSqft: 'plan_suggested',
      },
    } as never);
    expect(measurements.planImportMode).toBe('selected_trade');
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'framing',
        notes: 'Detected framing. Frame the walls.',
        measurements,
      })
    ).toBeNull();
  });

  test('a flooring plan does not badge contractor-typed products as mentioned in notes', () => {
    const carpet = {
      id: 'flooring_carpet',
      label: 'Carpet installation',
      state: 'included',
      noteBacked: true,
    } as ScopeChecklistItem;
    const tile = {
      id: 'tile_flooring',
      label: 'Tile installation',
      state: 'included',
      noteBacked: true,
    } as ScopeChecklistItem;
    const measurements = {
      planImportMode: 'selected_trade',
      planImportTradeKey: 'flooring',
      planImportFingerprint: 'lot-49',
      floorAreaSqft: 2571,
      flooringCarpetSqft: 571,
      flooringTileSqft: 2000,
      flooringProductScope: ['carpet', 'tile'],
      itemQuantities: {},
    };
    const ctx = {
      templateKey: 'flooring',
      notes: 'Detected flooring job.',
      measurements,
    };
    expect(scopeItemNoteBadge(carpet, ctx)).toBeNull();
    expect(scopeItemNoteBadge(tile, ctx)).toBeNull();
  });

  test('a notes-only flooring product can still say it was mentioned', () => {
    const item = {
      id: 'flooring_carpet',
      label: 'Carpet installation',
      state: 'included',
      noteBacked: true,
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'flooring',
        notes: 'Install 571 sqft of carpet.',
        measurements: normalizeScopeMeasurements({
          flooringCarpetSqft: 571,
        } as never),
      })
    ).toBe('mentioned');
  });

  test('a notes-only framing card can still say it was mentioned', () => {
    const item = {
      id: 'framing',
      label: 'Framing (lumber + labor)',
      state: 'included',
      noteBacked: true,
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'framing',
        notes: 'Detected framing.',
        measurements: normalizeScopeMeasurements({
          framedAreaSqft: 300,
        } as never),
      })
    ).toBe('mentioned');
  });

  test('an electrical plan symbol count badges detected from the plan', () => {
    const item = {
      id: 'electrical_standard_receptacle',
      label: 'Standard receptacles',
      state: 'included',
      inputType: 'yes_no',
    } as ScopeChecklistItem;
    expect(
      scopeItemNoteBadge(item, {
        templateKey: 'electrical',
        notes: '',
        measurements: {
          planImportTradeKey: 'electrical',
          standardReceptacleCount: 98,
          itemQuantities: {},
          quickMeasurementSources: {
            standardReceptacleCount: 'needs_confirmation',
          },
          measurementProvenance: {
            standardReceptacleCount: {
              status: 'needs_review',
              evidenceKind: 'symbols',
              pricingEligible: false,
            },
          },
        },
      })
    ).toBe('from_plan');
  });
});
