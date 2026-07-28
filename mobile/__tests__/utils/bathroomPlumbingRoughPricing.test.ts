import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  buildShowerRoughPricingContext,
  detectShowerRoughAccessOverlap,
  detectShowerRoughScopeOverlap,
  formatShowerRoughQuantityLabel,
  inferPlumbingExposedFromDemoScope,
  resolveBathroomPlumbingRoughSuggestedPricing,
  showerRoughContextFromPricingRecord,
} from '@/utils/bathroomPlumbingRoughPricing';

function item(id: string, state: ScopeChecklistItem['state'] = 'included') {
  return { id, state };
}

describe('resolveBathroomPlumbingRoughSuggestedPricing', () => {
  const wetArea = [item('shower_tile'), item('waterproofing')];

  it('defaults to relocated exposed + wood floor ($1,750)', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({ checklistItems: wetArea });
    expect(result?.fill?.total).toBe(1750);
    expect(result?.fill?.basis).toEqual({ quantity: 1, unit: 'each' });
  });

  it('uses same-location exposed + wood ($1,150)', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'in_place',
      plumbingExposed: 'exposed_by_demo',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(1150);
    expect(result?.fill?.helper).toMatch(/demolition exposes|same location|concrete cutting/i);
  });

  it('uses same-location separate access + wood ($1,650)', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'in_place',
      plumbingExposed: 'separate_access_required',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(1650);
  });

  it('uses base pricing when same-location slab has no cutting required', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'in_place',
      plumbingExposed: 'exposed_by_demo',
      floorConstruction: 'concrete_slab',
      slabWorkRequired: 'no',
    });
    expect(result?.fill?.total).toBe(1150);
  });

  it('uses slab-work price ($2,250) when same-location slab cutting is required', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'in_place',
      plumbingExposed: 'separate_access_required',
      floorConstruction: 'concrete_slab',
      slabWorkRequired: 'yes',
    });
    expect(result?.fill?.total).toBe(2250);
  });

  it('uses slab-work price when same-location slab cutting is unsure', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'in_place',
      floorConstruction: 'concrete_slab',
      slabWorkRequired: 'unsure',
    });
    expect(result?.fill?.total).toBe(2250);
    expect(result?.fill?.helper).toMatch(/concrete cutting/i);
  });

  it('uses relocated separate access + wood ($2,500)', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'relocation',
      plumbingExposed: 'separate_access_required',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(2500);
  });

  it('uses relocated slab price ($3,500) without asking for slab cutting', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      workType: 'relocation',
      plumbingExposed: 'exposed_by_demo',
      floorConstruction: 'concrete_slab',
    });
    expect(result?.fill?.total).toBe(3500);
  });

  it('applies bathtub-only pricing ($1,050 same-location exposed)', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      fixtureType: 'bathtub',
      workType: 'in_place',
      plumbingExposed: 'exposed_by_demo',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(1050);
  });

  it('keeps full price for tub/shower combination', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: wetArea,
      fixtureType: 'tub_shower_combo',
      workType: 'in_place',
      plumbingExposed: 'exposed_by_demo',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(1150);
  });

  it('labels quantity as shower rough-in when fixture type is shower', () => {
    const ctx = buildShowerRoughPricingContext({ fixtureType: 'shower' });
    expect(formatShowerRoughQuantityLabel(ctx.fixtureType)).toBe('1 shower rough-in');
  });

  it('parses pricing record id for details display', () => {
    const ctx = showerRoughContextFromPricingRecord(
      'bps_national:plumbing_rough:bathroom:shower:relocation:separate_access_required:concrete_slab:na'
    );
    expect(ctx?.fixtureType).toBe('shower');
    expect(ctx?.workType).toBe('relocation');
    expect(ctx?.plumbingExposed).toBe('separate_access_required');
    expect(ctx?.floorConstruction).toBe('concrete_slab');
  });

  it('migrates legacy wall access in pricing record id', () => {
    const ctx = showerRoughContextFromPricingRecord(
      'bps_national:plumbing_rough:bathroom:shower:relocation:finished_wall:wood_framed:na'
    );
    expect(ctx?.plumbingExposed).toBe('separate_access_required');
  });

  it('auto-detects plumbing exposure from shower wall demo', () => {
    const inferred = inferPlumbingExposedFromDemoScope([
      item('demo'),
      item('shower_tile'),
    ]);
    expect(inferred).toEqual({ plumbingExposed: 'exposed_by_demo', source: 'demo_detected' });
  });

  it('does not auto-detect from floor-only demo', () => {
    const inferred = inferPlumbingExposedFromDemoScope([item('floor_demo')]);
    expect(inferred).toBeNull();
  });

  it('infers exposed pricing when demo is in scope and no user selection', () => {
    const result = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems: [item('demo'), ...wetArea],
      workType: 'in_place',
      floorConstruction: 'wood_framed',
    });
    expect(result?.fill?.total).toBe(1150);
    expect(result?.fill?.rateSourceLabel).toMatch(/demolition scope/i);
  });

  it('does not flag vanity overlap when only shower rough-in is relocated', () => {
    const overlap = detectShowerRoughScopeOverlap({
      checklistItems: [
        item('plumbing_rough'),
        { id: 'vanity', state: 'included', choiceId: 'replacing' },
      ],
      workType: 'relocation',
    });
    expect(overlap.overlap).toBe(false);
  });

  it('flags overlap when toilet is also relocating', () => {
    const overlap = detectShowerRoughScopeOverlap({
      checklistItems: [
        item('plumbing_rough'),
        { id: 'toilet', state: 'included', choiceId: 'relocating' },
      ],
      workType: 'relocation',
    });
    expect(overlap.overlap).toBe(true);
    expect(overlap.relatedItemIds).toContain('toilet');
  });

  it('flags access overlap when separate access is selected with demo in scope', () => {
    const overlap = detectShowerRoughAccessOverlap({
      checklistItems: [item('demo'), item('plumbing_rough')],
      plumbingExposed: 'separate_access_required',
    });
    expect(overlap).toBe(true);
  });

  describe('full pricing matrix (shower/tub combo)', () => {
    const wetArea = [item('shower_tile'), item('waterproofing')];
    const price = (params: Record<string, string | null | undefined>) =>
      resolveBathroomPlumbingRoughSuggestedPricing({ checklistItems: wetArea, ...params })?.fill
        ?.total;

    it('covers every wood-floor band', () => {
      expect(price({ workType: 'in_place', plumbingExposed: 'exposed_by_demo', floorConstruction: 'wood_framed' })).toBe(1150);
      expect(price({ workType: 'in_place', plumbingExposed: 'separate_access_required', floorConstruction: 'wood_framed' })).toBe(1650);
      expect(price({ workType: 'in_place', plumbingExposed: 'unsure', floorConstruction: 'wood_framed' })).toBe(1150);
      expect(price({ workType: 'relocation', plumbingExposed: 'exposed_by_demo', floorConstruction: 'wood_framed' })).toBe(1750);
      expect(price({ workType: 'relocation', plumbingExposed: 'separate_access_required', floorConstruction: 'wood_framed' })).toBe(2500);
      expect(price({ workType: 'relocation', plumbingExposed: 'unsure', floorConstruction: 'wood_framed' })).toBe(1750);
    });

    it('covers same-location slab bands', () => {
      expect(price({ workType: 'in_place', plumbingExposed: 'exposed_by_demo', floorConstruction: 'concrete_slab', slabWorkRequired: 'no' })).toBe(1150);
      expect(price({ workType: 'in_place', plumbingExposed: 'separate_access_required', floorConstruction: 'concrete_slab', slabWorkRequired: 'no' })).toBe(1650);
      expect(price({ workType: 'in_place', plumbingExposed: 'exposed_by_demo', floorConstruction: 'concrete_slab', slabWorkRequired: 'yes' })).toBe(2250);
      expect(price({ workType: 'in_place', plumbingExposed: 'separate_access_required', floorConstruction: 'concrete_slab', slabWorkRequired: 'yes' })).toBe(2250);
      expect(price({ workType: 'in_place', plumbingExposed: 'unsure', floorConstruction: 'concrete_slab', slabWorkRequired: 'unsure' })).toBe(2250);
    });

    it('covers relocated slab (access answer does not change price)', () => {
      expect(price({ workType: 'relocation', plumbingExposed: 'exposed_by_demo', floorConstruction: 'concrete_slab' })).toBe(3500);
      expect(price({ workType: 'relocation', plumbingExposed: 'separate_access_required', floorConstruction: 'concrete_slab' })).toBe(3500);
    });

    it('covers bathtub-only discounts', () => {
      const tub = { fixtureType: 'bathtub', floorConstruction: 'wood_framed' };
      expect(price({ ...tub, workType: 'in_place', plumbingExposed: 'exposed_by_demo' })).toBe(1050);
      expect(price({ ...tub, workType: 'in_place', plumbingExposed: 'separate_access_required' })).toBe(1500);
      expect(price({ ...tub, workType: 'relocation', plumbingExposed: 'exposed_by_demo' })).toBe(1600);
      expect(price({ ...tub, workType: 'relocation', plumbingExposed: 'separate_access_required' })).toBe(2250);
      expect(price({ ...tub, workType: 'in_place', plumbingExposed: 'exposed_by_demo', floorConstruction: 'concrete_slab', slabWorkRequired: 'yes' })).toBe(2050);
      expect(price({ ...tub, workType: 'relocation', plumbingExposed: 'exposed_by_demo', floorConstruction: 'concrete_slab' })).toBe(3250);
    });
  });
});
