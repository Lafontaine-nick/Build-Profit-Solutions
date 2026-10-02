import {
  COMPLETE_DRYWALL_ASSEMBLY_LABEL,
  DRYWALL_PRODUCTION_ASSEMBLY_BASELINE,
  drywallFinishLaborMultiplier,
  DRYWALL_PLAN_EXPORT_CREW_SPLITS,
  isDrywallCompletePackageScope,
  isDrywallPlanExportCrewSplit,
  resolveDrywallCrewSplitBaseline,
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
  it('keeps explicit baseboard installation from duplicating generic trim', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'baseboard_install', label: 'Baseboard installation', state: 'included' },
        { id: 'trim', label: 'Trim & baseboard', state: 'included' },
      ] as any,
      'kitchen'
    );

    const ids = items.map(item => item.id);
    expect(ids).toContain('baseboard_install');
    expect(ids).not.toContain('trim');
  });

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

  it('splits plan export into install, mud, and texture cards', () => {
    expect(
      shouldEmbedDrywallFinishTexturePicker('finish_tape', 'drywall', {
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
    expect(items.map(i => i.id)).toEqual(['hang', 'finish_tape', 'texture']);
    expect(items.find(i => i.id === 'hang')?.label).toBe('Drywall install');
    expect(items.find(i => i.id === 'finish_tape')?.label).toBe('Tape and mud');
    expect(items.find(i => i.id === 'texture')?.label).toBe('Texture');
  });

  it('keeps the three crews when plan import metadata lives on normalized measurements', () => {
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
    expect(items.map(i => i.id)).toEqual([
      'hang',
      'finish_tape',
      'texture',
      'patch_repair',
    ]);
    expect(items.find(i => i.id === 'drywall')).toBeUndefined();
  });

  it('includes hang on plan export and leaves mud and texture off until Drywall finish is selected', () => {
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
    expect(items.find(i => i.id === 'hang')?.state).toBe('included');
    expect(items.find(i => i.id === 'finish_tape')?.state).toBe('excluded');
    expect(items.find(i => i.id === 'texture')?.state).toBe('excluded');

    const withFinish = finalizeDrywallScopeChecklistLayout(
      items as any,
      'drywall',
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'drywall',
          drywallSqft: 14731,
          drywallFinishIncluded: true,
        } as any,
      }
    );
    expect(withFinish.find(i => i.id === 'finish_tape')?.state).toBe('included');
    expect(withFinish.find(i => i.id === 'texture')?.state).toBe('included');

    const tapeOnly = finalizeDrywallScopeChecklistLayout(items as any, 'drywall', {
      measurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
        drywallSqft: 14731,
        drywallTapeIncluded: true,
        drywallTextureIncluded: false,
      } as any,
    });
    expect(tapeOnly.find(i => i.id === 'finish_tape')?.state).toBe('included');
    expect(tapeOnly.find(i => i.id === 'texture')?.state).toBe('excluded');
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

  it('keeps texture in the pricing list on plan export instead of pinning it', () => {
    expect(
      shouldPinDrywallFinishCardAfterQuickMeasurements(
        'drywall',
        {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'drywall',
        },
        [{ id: 'texture' }, { id: 'hang' }, { id: 'finish_tape' }]
      )
    ).toBe(false);
    expect(
      shouldPinDrywallFinishCardAfterQuickMeasurements(
        'drywall',
        {},
        [{ id: 'hang' }, { id: 'finish_tape' }]
      )
    ).toBe(false);
  });

  it('isDrywallCompletePackageScope distinguishes ground-up from plan export', () => {
    expect(
      isDrywallCompletePackageScope({ templateKey: 'ground_up' })
    ).toBe(true);
    expect(
      isDrywallCompletePackageScope({
        templateKey: 'drywall',
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
      })
    ).toBe(false);
    expect(
      isDrywallPlanExportCrewSplit({
        templateKey: 'drywall',
        planImportMode: 'selected_trade',
        planImportTradeKey: 'drywall',
      })
    ).toBe(true);
    expect(isDrywallCompletePackageScope({ templateKey: 'drywall' })).toBe(
      false
    );
  });

  it('plan export crew rates sum to the production assembly baseline', () => {
    const hang = resolveDrywallCrewSplitBaseline('hang');
    const mud = resolveDrywallCrewSplitBaseline('finish_tape');
    const texture = resolveDrywallCrewSplitBaseline('texture');
    const total =
      DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.material +
      DRYWALL_PRODUCTION_ASSEMBLY_BASELINE.labor;
    expect(
      hang.material +
        hang.labor +
        mud.material +
        mud.labor +
        texture.material +
        texture.labor
    ).toBe(total);
    expect(
      DRYWALL_PLAN_EXPORT_CREW_SPLITS.hang.totalShare +
        DRYWALL_PLAN_EXPORT_CREW_SPLITS.finish_tape.totalShare +
        DRYWALL_PLAN_EXPORT_CREW_SPLITS.texture.totalShare
    ).toBe(1);
  });

  it('prices plan-export install, mud, and texture separately and puts finish premium on texture', () => {
    const measurements = {
      drywallSqft: 12073,
      floorAreaSqft: 2571,
      drywallFinishLevel: 'orange_peel',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'drywall',
      itemQuantities: {},
    } as any;
    const checklistItems = [
      { id: 'hang', state: 'included' },
      { id: 'finish_tape', state: 'included' },
      { id: 'texture', state: 'included', choiceId: 'orange_peel' },
    ] as any;
    const price = (itemId: string, finishLevel: string) => {
      const resolved = resolveChecklistItemQuantity(itemId, measurements, {
        templateKey: 'drywall',
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        { ...measurements, drywallFinishLevel: finishLevel },
        'drywall',
        resolved,
        { checklistItems }
      );
    };
    const hang = price('hang', 'orange_peel');
    const mud = price('finish_tape', 'orange_peel');
    const texture = price('texture', 'orange_peel');
    const knockdownTexture = price('texture', 'knockdown');
    const knockdownMud = price('finish_tape', 'knockdown');
    expect(hang.fill?.total).toBeGreaterThan(0);
    expect(mud.fill?.total).toBeGreaterThan(0);
    expect(texture.fill?.total).toBeGreaterThan(0);
    expect(knockdownMud.fill?.total).toBeCloseTo(mud.fill!.total, 0);
    expect(knockdownTexture.fill!.total).toBeGreaterThan(texture.fill!.total);
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
