import {
  COMPLETE_DRYWALL_ASSEMBLY_LABEL,
  DRYWALL_PRODUCTION_ASSEMBLY_BASELINE,
  drywallFinishLaborMultiplier,
  isDrywallCompletePackageScope,
  resolveDrywallFinishChoiceId,
  resolveRemodelDrywallAssemblyBaseline,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  applyDrywallScopeCardLayout,
  finalizeDrywallScopeChecklistLayout,
  normalizeScopeChecklistItems,
  shouldEmbedDrywallFinishTexturePicker,
  shouldPinDrywallFinishCardAfterQuickMeasurements,
  stripStandaloneDrywallTextureItem,
} from '@/utils/estimateScopeChecklistUi';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

describe('drywall scope card layout', () => {
  it('uses one complete package card plus standalone finish card for ground_up', () => {
    const items = normalizeScopeChecklistItems(
      [{ id: 'drywall', label: 'Drywall', state: 'included' }] as any,
      'ground_up'
    );
    const ids = items.map(i => i.id);
    expect(ids).toContain('drywall');
    expect(ids).toContain('texture');
    expect(ids).not.toContain('hang');
    expect(ids).not.toContain('finish_tape');
    expect(items.find(i => i.id === 'drywall')?.label).toBe(
      COMPLETE_DRYWALL_ASSEMBLY_LABEL
    );
    expect(items.find(i => i.id === 'texture')?.label).toBe('Drywall finish');
  });

  it('uses standalone finish card for plan export (not embedded on drywall)', () => {
    expect(
      shouldEmbedDrywallFinishTexturePicker('drywall', 'drywall', {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
      })
    ).toBe(false);
    const items = applyDrywallScopeCardLayout([], 'drywall', {
      measurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
      },
    } as any);
    expect(items.map(i => i.id)).toEqual(['drywall', 'texture']);
  });

  it('keeps complete package when plan import metadata lives on normalized measurements', () => {
    const items = finalizeDrywallScopeChecklistLayout(
      [
        { id: 'hang', label: 'Hang', state: 'unsure' },
        { id: 'finish_tape', label: 'Finish', state: 'unsure' },
        { id: 'patch_repair', label: 'Patch', state: 'unsure' },
      ] as any,
      'drywall',
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'drywall',
        } as any,
      }
    );
    expect(items.map(i => i.id)).toContain('drywall');
    expect(items.map(i => i.id)).toContain('texture');
    expect(items.map(i => i.id)).toContain('patch_repair');
    expect(items.map(i => i.id)).not.toContain('hang');
    expect(items.map(i => i.id)).not.toContain('finish_tape');
    expect(items.find(i => i.id === 'drywall')?.label).toBe(
      COMPLETE_DRYWALL_ASSEMBLY_LABEL
    );
  });

  it('auto-includes complete drywall on plan export when takeoff is present', () => {
    const items = finalizeDrywallScopeChecklistLayout(
      [{ id: 'patch_repair', label: 'Patch', state: 'unsure' }] as any,
      'drywall',
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'drywall',
          drywallSqft: 14731,
        } as any,
      }
    );
    expect(items.find(i => i.id === 'drywall')?.state).toBe('included');
  });

  it('uses separate hang and finish cards for notes/photos remodel', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'drywall', label: 'Drywall', state: 'unsure' },
        { id: 'hang', label: 'Hang', state: 'unsure' },
      ] as any,
      'drywall'
    );
    const ids = items.map(i => i.id);
    expect(ids).toContain('hang');
    expect(ids).toContain('finish_tape');
    expect(ids).not.toContain('drywall');
    expect(ids).not.toContain('texture');
    expect(
      shouldEmbedDrywallFinishTexturePicker('finish_tape', 'drywall', {})
    ).toBe(true);
  });

  it('migrates legacy standalone texture choice when stripping items', () => {
    const { items, finishLevel } = stripStandaloneDrywallTextureItem([
      { id: 'drywall', label: 'Drywall', state: 'included' },
      {
        id: 'texture',
        label: 'Texture',
        choiceId: 'knockdown',
        state: 'included',
      },
    ] as any);
    expect(items.map(i => i.id)).toEqual(['drywall']);
    expect(finishLevel).toBe('knockdown');
    expect(
      resolveDrywallFinishChoiceId(
        { drywallFinishLevel: 'smooth_level_5' },
        items
      )
    ).toBe('smooth_level_5');
  });

  it('pins standalone finish card under quick measurements on plan export', () => {
    expect(
      shouldPinDrywallFinishCardAfterQuickMeasurements(
        'drywall',
        {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'drywall',
        },
        [{ id: 'texture' }, { id: 'drywall' }]
      )
    ).toBe(true);
    expect(
      shouldPinDrywallFinishCardAfterQuickMeasurements(
        'drywall',
        {},
        [{ id: 'hang' }, { id: 'finish_tape' }]
      )
    ).toBe(false);
  });

  it('isDrywallCompletePackageScope distinguishes plan export from remodel', () => {
    expect(
      isDrywallCompletePackageScope({ templateKey: 'ground_up' })
    ).toBe(true);
    expect(
      isDrywallCompletePackageScope({
        templateKey: 'drywall',
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
      })
    ).toBe(true);
    expect(isDrywallCompletePackageScope({ templateKey: 'drywall' })).toBe(
      false
    );
  });

  it('remodel hang + finish split rates sum to the production assembly baseline', () => {
    const hang = resolveRemodelDrywallAssemblyBaseline('hang');
    const finish = resolveRemodelDrywallAssemblyBaseline('finish_tape');
    const total =
      DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.material +
      DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.labor;
    expect(hang.material + hang.labor + finish.material + finish.labor).toBe(
      total
    );
  });

  it('finish texture multiplier adjusts finishing labor only', () => {
    expect(drywallFinishLaborMultiplier('orange_peel')).toBe(1);
    expect(drywallFinishLaborMultiplier('knockdown')).toBe(1.1);
    expect(drywallFinishLaborMultiplier('skip_trowel')).toBe(1.23);
    expect(drywallFinishLaborMultiplier('smooth_level_4')).toBe(1.17);
    expect(drywallFinishLaborMultiplier('smooth_level_5')).toBe(1.52);
    expect(drywallFinishLaborMultiplier('skip_trowel')).toBeGreaterThan(
      drywallFinishLaborMultiplier('smooth_level_4')
    );
  });

  it('prices remodel hang and finish separately without suppressing when both included', () => {
    const measurements = {
      drywallSqft: 1200,
      floorAreaSqft: 343,
      itemQuantities: {},
    } as any;
    const checklistItems = [
      { id: 'hang', state: 'included' },
      { id: 'finish_tape', state: 'included' },
    ] as any;
    const hangResolved = resolveChecklistItemQuantity('hang', measurements, {
      templateKey: 'drywall',
    });
    const finishResolved = resolveChecklistItemQuantity('finish_tape', measurements, {
      templateKey: 'drywall',
    });
    const hangPricing = resolveScopeItemSuggestedPricing(
      'hang',
      measurements,
      'drywall',
      hangResolved,
      { checklistItems }
    );
    const finishPricing = resolveScopeItemSuggestedPricing(
      'finish_tape',
      measurements,
      'drywall',
      finishResolved,
      { checklistItems }
    );
    expect(hangPricing.fill?.total).toBeGreaterThan(0);
    expect(finishPricing.fill?.total).toBeGreaterThan(0);
  });

  it('applies knockdown premium to finish_tape remodel pricing', () => {
    const measurements = {
      drywallSqft: 1000,
      floorAreaSqft: 286,
      drywallFinishLevel: 'orange_peel',
      itemQuantities: {},
    } as any;
    const checklistItems = [{ id: 'finish_tape', state: 'included' }] as any;
    const resolved = resolveChecklistItemQuantity('finish_tape', measurements, {
      templateKey: 'drywall',
    });
    const base = resolveScopeItemSuggestedPricing(
      'finish_tape',
      measurements,
      'drywall',
      resolved,
      { checklistItems }
    );
    const knockdown = resolveScopeItemSuggestedPricing(
      'finish_tape',
      { ...measurements, drywallFinishLevel: 'knockdown' },
      'drywall',
      resolved,
      { checklistItems }
    );
    expect(knockdown.fill!.total).toBeGreaterThan(base.fill!.total);
  });

  it('suppresses hang/finish suggested pricing when complete package drywall is included', () => {
    const measurements = { drywallSqft: 1200, itemQuantities: {} } as any;
    const checklistItems = [
      { id: 'drywall', state: 'included' },
      { id: 'hang', state: 'included' },
    ] as any;
    const hangResolved = resolveChecklistItemQuantity('hang', measurements, {
      templateKey: 'ground_up',
    });
    const hangPricing = resolveScopeItemSuggestedPricing(
      'hang',
      measurements,
      'ground_up',
      hangResolved,
      { checklistItems }
    );
    expect(hangPricing.fill).toBeNull();
  });
});
