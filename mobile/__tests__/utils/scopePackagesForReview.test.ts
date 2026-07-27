import {
  getScopePackagesForReview,
  flattenChecklistDisplayOrder,
  reconcileScopePackagesForReview,
  hydrateChecklistItemsForScopeReview,
} from '@/utils/scopePackagesForReview';
import { SCOPE_CHECKLIST_GROUPS } from '@/utils/estimateScopeChecklistUi';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  lookupRuleKeyForPackage,
  ruleKeysToTryForPackage,
} from '@/utils/scopeItemQuantities';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyDraftToEstimate } from '@/utils/estimateAiDraft';

function bathroomChecklistFromGroups(): ScopeChecklistItem[] {
  return SCOPE_CHECKLIST_GROUPS.bathroom!.flatMap((group) =>
    group.itemIds.map((id) => ({
      id,
      label: id,
      state: 'included' as const,
      inputType: 'yes_no' as const,
    }))
  );
}

function packageRuleKey(
  pkg: { name?: string; scope?: string; checklistItemId?: string | null }
): string | null {
  return (
    pkg.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    ruleKeysToTryForPackage(pkg.name || '', pkg.scope || '')[0] ||
    null
  );
}

describe('scopePackagesForReview', () => {
  it('flattenChecklistDisplayOrder matches bathroom Demo before Wet area finish', () => {
    const items = bathroomChecklistFromGroups();
    const flat = flattenChecklistDisplayOrder(items, 'bathroom');
    const demoIdx = flat.findIndex((i) => i.id === 'demo');
    const waterproofIdx = flat.findIndex((i) => i.id === 'waterproofing');
    expect(demoIdx).toBeGreaterThanOrEqual(0);
    expect(waterproofIdx).toBeGreaterThan(demoIdx);
  });

  it('orders Step 3 rows top-to-bottom like Step 2 checklist groups', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: bathroomChecklistFromGroups(),
      scopePackages: [
        { name: 'Cleanup, Haul-off & Disposal', scope: 'Final clean', status: 'missing_price' },
        { name: 'Shower Tile Installation', scope: 'Shower wall tile', status: 'missing_price' },
        { name: 'Bathroom Demo', scope: 'Shower demo', status: 'missing_price' },
        { name: 'Tile Removal', scope: 'Floor demo', status: 'missing_price' },
        { name: 'Glass Shower Door Install', scope: '1 each', status: 'missing_price' },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const packages = reconcileScopePackagesForReview(draft);
    const demoIdx = packages.findIndex((p) => packageRuleKey(p) === 'demo');
    const floorDemoIdx = packages.findIndex((p) => packageRuleKey(p) === 'floor_demo');
    const waterproofIdx = packages.findIndex((p) => packageRuleKey(p) === 'waterproofing');
    const showerTileIdx = packages.findIndex((p) => packageRuleKey(p) === 'shower_tile');
    const cleanupIdx = packages.findIndex((p) => packageRuleKey(p) === 'cleanup');

    expect(demoIdx).toBeLessThan(floorDemoIdx);
    expect(floorDemoIdx).toBeLessThan(waterproofIdx);
    expect(waterproofIdx).toBeLessThan(showerTileIdx);
    expect(showerTileIdx).toBeLessThan(cleanupIdx);
  });

  it('uses Confirm Scope checklist labels on matched AI packages', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        {
          id: 'demo',
          label: 'Shower tile demo / tear-out',
          helperText: 'Remove shower wall and shower floor tile.',
          state: 'included',
          inputType: 'yes_no',
        },
        {
          id: 'floor_demo',
          label: 'Bathroom floor demo / removal',
          helperText: 'Remove bathroom floor tile.',
          state: 'included',
          inputType: 'yes_no',
        },
        {
          id: 'waterproofing',
          label: 'Shower waterproofing & backer board',
          state: 'included',
          inputType: 'yes_no',
        },
      ],
      scopePackages: [
        { name: 'Tile Removal', scope: 'Floor demo', status: 'missing_price', price: 660 },
        { name: 'Bathroom Demo', scope: 'Shower demo', status: 'missing_price', price: 522.5 },
        {
          name: 'Shower Waterproofing & Backer Board',
          scope: 'Membrane',
          status: 'missing_price',
          price: 960,
        },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const packages = reconcileScopePackagesForReview(draft);
    expect(packages[0].name).toBe('Shower tile demo / tear-out');
    expect(packages[0].price).toBe(522.5);
    expect(packages[1].name).toBe('Bathroom floor demo / removal');
    expect(packages[1].price).toBe(660);
    expect(packages[2].name).toBe('Shower waterproofing & backer board');
  });

  it('does not append orphan AI packages after checklist rows (no duplicates)', () => {
    const checklistItems: ScopeChecklistItem[] = [
      { id: 'drywall', label: 'Drywall repair / patching', state: 'included', inputType: 'yes_no' },
      { id: 'paint', label: 'Interior painting (prep + labor + paint)', state: 'included', inputType: 'yes_no' },
      {
        id: 'plumbing_trim',
        label: 'Plumbing fixtures (faucets, toilet, hookups)',
        state: 'included',
        inputType: 'yes_no',
      },
      { id: 'cleanup', label: 'Cleanup, haul-off & disposal', state: 'included', inputType: 'yes_no' },
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        choiceId: 'tile_pan',
        inputType: 'choice',
        state: 'included',
      },
      { id: 'countertops', label: 'Prefabricated quartz or stone top', state: 'included', inputType: 'yes_no' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: checklistItems,
      scopeMeasurements: { tilePanBathCount: 1 },
      scopePackages: [
        { name: 'Drywall Repair / Patching', scope: 'Patch shower openings', status: 'missing_price' },
        { name: 'Interior Painting', scope: '80 sqft', status: 'missing_price', price: 268 },
        { name: 'Plumbing (Bathroom)', scope: 'Trim-out', status: 'missing_price' },
        { name: 'Cleanup, Haul-off & Disposal', scope: 'Final clean', status: 'missing_price', price: 1000 },
        { name: 'Wet Area Install', scope: 'Tile shower pan job', status: 'missing_price' },
        { name: 'Tile Shower Pan (Mud Pan)', scope: 'Build mud pan', status: 'missing_price' },
        { name: 'Prefabricated Quartz Countertop', scope: 'Vanity top', status: 'missing_price', price: 800 },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const packages = reconcileScopePackagesForReview(draft, checklistItems);
    const names = packages.map((p) => p.name);
    expect(names.filter((n) => /drywall repair/i.test(n))).toHaveLength(1);
    expect(names.filter((n) => /wet area install/i.test(n))).toHaveLength(0);
    expect(names.filter((n) => /tile shower pan|mud pan build/i.test(n))).toHaveLength(1);
    expect(names.filter((n) => /prefabricated quartz/i.test(n))).toHaveLength(1);
    expect(packages.length).toBeLessThanOrEqual(8);
    expect(packages.find((p) => p.name === 'Cleanup, haul-off & disposal')?.price).toBe(1000);
    expect(packages[packages.length - 1].name).toBe('Cleanup, haul-off & disposal');
  });

  it('omits wet area install lines when install steppers are cleared', () => {
    const checklistItems: ScopeChecklistItem[] = [
      { id: 'drywall', label: 'Drywall repair / patching', state: 'included', inputType: 'yes_no' },
      { id: 'paint', label: 'Interior painting (prep + labor + paint)', state: 'included', inputType: 'yes_no' },
      {
        id: 'plumbing_trim',
        label: 'Plumbing fixtures (faucets, toilet, hookups)',
        state: 'included',
        inputType: 'yes_no',
      },
      { id: 'cleanup', label: 'Cleanup, haul-off & disposal', state: 'included', inputType: 'yes_no' },
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        choiceId: 'not_in_scope',
        inputType: 'choice',
        state: 'excluded',
      },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: checklistItems,
      scopeMeasurements: {
        tilePanBathCount: null,
        bathCount: null,
      },
      scopePackages: [
        { name: 'Drywall Repair / Patching', scope: 'Patch shower openings', status: 'missing_price' },
        { name: 'Interior Painting', scope: '80 sqft', status: 'missing_price', price: 268 },
        { name: 'Plumbing (Bathroom)', scope: 'Trim-out', status: 'missing_price' },
        { name: 'Cleanup, Haul-off & Disposal', scope: 'Final clean', status: 'missing_price', price: 1000 },
        { name: 'Wet Area Install', scope: 'Tile shower pan job', status: 'missing_price' },
        { name: 'Tile Shower Pan (Mud Pan)', scope: 'Build mud pan', status: 'missing_price' },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const hydrated = hydrateChecklistItemsForScopeReview(draft, checklistItems);
    const packages = reconcileScopePackagesForReview(draft, hydrated);
    const names = packages.map((p) => p.name);

    expect(names.filter((n) => /wet area install/i.test(n))).toHaveLength(0);
    expect(names.filter((n) => /tile shower pan|mud pan build/i.test(n))).toHaveLength(0);
    expect(names[names.length - 1]).toBe('Cleanup, haul-off & disposal');
  });

  it('adds stub rows for included checklist items missing from AI packages', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        { id: 'shower_niche', label: 'Shower niche', state: 'included', inputType: 'yes_no' },
        { id: 'mirror_accessories', label: 'Mirror & bath accessories', state: 'included', inputType: 'yes_no' },
      ],
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const packages = getScopePackagesForReview(draft);
    expect(packages).toHaveLength(2);
    expect(packages[0].checklistItemId).toBe('shower_niche');
    expect(packages[1].checklistItemId).toBe('mirror_accessories');
    expect(packages[0].status).toBe('missing_price');
  });

  it('applyDraftToEstimate labor lines follow Step 2 checklist order', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        { id: 'demo', label: 'Demo', state: 'included', inputType: 'yes_no' },
        { id: 'waterproofing', label: 'Waterproofing', state: 'included', inputType: 'yes_no' },
        { id: 'shower_tile', label: 'Shower tile', state: 'included', inputType: 'yes_no' },
      ],
      scopePackages: [
        {
          name: 'Shower Tile Installation',
          scope: 'Wall tile',
          status: 'confirmed',
          price: 2500,
          laborPrice: 2500,
          applyEligible: true,
          checklistItemId: 'shower_tile',
        },
        {
          name: 'Bathroom Demo',
          scope: 'Shower demo',
          status: 'confirmed',
          price: 1200,
          laborPrice: 1200,
          applyEligible: true,
          checklistItemId: 'demo',
        },
        {
          name: 'Waterproofing',
          scope: 'Shower pan',
          status: 'confirmed',
          price: 800,
          laborPrice: 800,
          applyEligible: true,
          checklistItemId: 'waterproofing',
        },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft);
    const laborKeys = (bid.laborLineItems as { sourceItemId?: string }[]).map(
      (line) => line.sourceItemId
    );
    expect(laborKeys).toEqual(['demo', 'waterproofing', 'shower_tile']);
  });

  it('includes vanity/countertop install and demo rows from QM steppers', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        { id: 'demo', label: 'Shower demo', state: 'included', inputType: 'yes_no' },
        { id: 'vanity', label: 'Vanity & countertop', state: 'unsure', inputType: 'choice', choiceId: 'unsure' },
        { id: 'vanity_demo', label: 'Remove existing vanity cabinet', state: 'unsure', inputType: 'yes_no' },
        { id: 'countertop_demo', label: 'Remove existing countertop', state: 'unsure', inputType: 'yes_no' },
        { id: 'paint', label: 'Paint', state: 'included', inputType: 'yes_no' },
      ],
      scopeMeasurements: {
        bathroomInstallVanityCount: 1,
        bathroomInstallCounterCount: 1,
        bathroomDemoVanityCount: 1,
        bathroomDemoCounterCount: 1,
      },
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const hydrated = hydrateChecklistItemsForScopeReview(draft);
    expect(hydrated.find((row) => row.id === 'countertops')?.state).toBe('included');
    expect(hydrated.find((row) => row.id === 'vanity')).toMatchObject({
      label: 'New vanity',
      inputType: 'yes_no',
      state: 'included',
    });

    const packages = reconcileScopePackagesForReview(draft, hydrated);
    const keys = packages.map((p) => packageRuleKey(p));
    expect(keys).toContain('vanity');
    expect(keys).toContain('countertops');
    expect(keys).toContain('vanity_demo');
    expect(keys).toContain('countertop_demo');
  });
});
