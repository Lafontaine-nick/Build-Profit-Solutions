import {
  getScopePackagesForReview,
  flattenChecklistDisplayOrder,
  flattenConfirmScopeVisibleRows,
  buildConfirmScopeDisplayItems,
  reconcileScopePackagesForReview,
  hydrateChecklistItemsForScopeReview,
  confirmScopeReviewRowsFromDraft,
} from '@/utils/scopePackagesForReview';
import { SCOPE_CHECKLIST_GROUPS } from '@/utils/estimateScopeChecklistUi';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';
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

  it('keeps a direct notes-inferred mud pan card without a wet-area parent', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'shower_pan',
        label: 'Shower mud pan build',
        state: 'included',
        inputType: 'yes_no',
      },
    ];

    expect(buildConfirmScopeDisplayItems(items, {}, 'bathroom').map((item) => item.id)).toContain(
      'shower_pan'
    );
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

  it('Step 3 package rows match Step 2 selected scope order (excluding wet-area picker)', () => {
    const checklistItems = bathroomChecklistFromGroups().map((item) =>
      item.id === 'wet_area_install'
        ? {
            ...item,
            inputType: 'choice' as const,
            choiceId: 'tile_pan',
            state: 'included' as const,
          }
        : item
    );
    const measurements = { tilePanBathCount: 1, bathCount: 1 };
    const displayItems = buildConfirmScopeDisplayItems(checklistItems, measurements, 'bathroom');
    const step2Rows = flattenConfirmScopeVisibleRows(displayItems, {
      templateKey: 'bathroom',
      measurements,
      forStep3Review: false,
    });
    const step3Rows = flattenConfirmScopeVisibleRows(displayItems, {
      templateKey: 'bathroom',
      measurements,
      forStep3Review: true,
    });

    const step2Ids = step2Rows.map((row) => row.id).filter((id) => id !== 'wet_area_install');
    const step3Ids = step3Rows.map((row) => row.id);
    const expectedStep3Ids = flattenChecklistDisplayOrder(displayItems, 'bathroom')
      .filter((row) => row.id !== 'wet_area_install')
      .filter((row) => checklistItemInScope(row))
      .filter((row) => {
        if (row.derivedFrom !== 'wet_area_install') return true;
        const parent = displayItems.find((candidate) => candidate.id === 'wet_area_install');
        return Boolean(parent && checklistItemInScope(parent));
      })
      .map((row) => row.id);
    expect(step3Ids).toEqual(expectedStep3Ids);
    expect(step3Ids.length).toBeGreaterThanOrEqual(step2Ids.length);

    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: checklistItems,
      scopeMeasurements: measurements,
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;
    const packages = getScopePackagesForReview(draft);
    expect(packages.map((p) => p.checklistItemId)).toEqual(step3Ids);
    expect(confirmScopeReviewRowsFromDraft(draft).map((row) => row.id)).toEqual(step3Ids);
  });

  it('Step 3 excludes unselected scope items while preserving top-to-bottom order', () => {
    const checklistItems = bathroomChecklistFromGroups().map((item) => {
      if (item.id === 'demo' || item.id === 'cleanup') {
        return { ...item, state: 'excluded' as const };
      }
      if (item.id === 'wet_area_install') {
        return {
          ...item,
          inputType: 'choice' as const,
          choiceId: 'tile_pan',
          state: 'included' as const,
        };
      }
      return item;
    });
    const measurements = { tilePanBathCount: 1, bathCount: 1 };
    const displayItems = buildConfirmScopeDisplayItems(checklistItems, measurements, 'bathroom');
    const step3Rows = flattenConfirmScopeVisibleRows(displayItems, {
      templateKey: 'bathroom',
      measurements,
      forStep3Review: true,
    });
    const step3Ids = step3Rows.map((row) => row.id);

    expect(step3Ids).not.toContain('demo');
    expect(step3Ids).not.toContain('cleanup');
    expect(step3Ids).not.toContain('wet_area_install');

    const includedOrder = flattenChecklistDisplayOrder(displayItems, 'bathroom')
      .filter((row) => row.id !== 'wet_area_install')
      .filter((row) => checklistItemInScope(row))
      .map((row) => row.id);
    let matched = 0;
    for (let i = 0; i < includedOrder.length && matched < step3Ids.length; i++) {
      if (step3Ids[matched] === includedOrder[i]) matched++;
    }
    expect(matched).toBe(step3Ids.length);
  });

  it('does not ask for separate HVAC component prices when the package is applied', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'hvac', label: 'HVAC system', state: 'included', inputType: 'yes_no' },
      { id: 'ductwork', label: 'Ductwork', state: 'included', inputType: 'yes_no' },
      { id: 'supply_registers', label: 'Supply registers', state: 'included', inputType: 'yes_no' },
      { id: 'return_grilles', label: 'Return grilles', state: 'included', inputType: 'yes_no' },
      { id: 'thermostat', label: 'Thermostat', state: 'included', inputType: 'yes_no' },
      { id: 'condenser', label: 'Condenser', state: 'included', inputType: 'yes_no' },
    ];
    const measurements = {
      itemQuantities: {
        hvac: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
        hvac__material: { quantity: 11000, unit: 'allowance', quantitySource: 'user_entered' },
        hvac__labor: { quantity: 8000, unit: 'allowance', quantitySource: 'user_entered' },
      },
    };

    const rows = flattenConfirmScopeVisibleRows(items, {
      templateKey: 'hvac',
      measurements,
      forStep3Review: true,
    });

    expect(rows.map((row) => row.id)).toEqual(['hvac', 'condenser']);
  });

  it('applyDraftToEstimate scope text matches Step 3 selected rows (PDF export source)', () => {
    const checklistItems = bathroomChecklistFromGroups().map((item) => {
      if (item.id === 'demo' || item.id === 'cleanup') {
        return { ...item, state: 'excluded' as const };
      }
      if (item.id === 'wet_area_install') {
        return {
          ...item,
          inputType: 'choice' as const,
          choiceId: 'tile_pan',
          state: 'included' as const,
        };
      }
      return item;
    });
    const measurements = { tilePanBathCount: 1, bathCount: 1 };
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: checklistItems,
      scopeMeasurements: measurements,
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const step3Packages = getScopePackagesForReview(draft);
    const step3Ids = step3Packages.map((p) => p.checklistItemId).filter(Boolean);
    expect(step3Ids).not.toContain('demo');
    expect(step3Ids).not.toContain('cleanup');

    const { bid } = applyDraftToEstimate({}, draft);
    const scopeDesc = String(bid.scopeDescription || '');
    for (const pkg of step3Packages) {
      expect(scopeDesc).toContain(String(pkg.name || '').trim());
    }
    expect(scopeDesc).not.toMatch(/^Demo$/m);
    expect(scopeDesc.toLowerCase()).not.toContain('cleanup, haul-off');
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
    expect(packages[0].price).toBeNull();
    expect(packages[1].name).toBe('Bathroom floor demo / removal');
    expect(packages[1].price).toBeNull();
    expect(packages[2].name).toBe('Shower waterproofing & backer board');
    expect(packages[2].price).toBeNull();
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
    expect(packages.find((p) => p.name === 'Cleanup, haul-off & disposal')?.price).toBeNull();
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

  it('Step 3 lists QM-embedded roofing scopes that Step 2 Applied pricing includes', () => {
    const checklistItems: ScopeChecklistItem[] = [
      {
        id: 'roofing_system',
        label: 'Roofing system',
        state: 'included',
        inputType: 'choice',
        choiceId: 'three_tab_shingles',
      },
      { id: 'tear_off', label: 'Existing roof / tear-off', state: 'included', inputType: 'yes_no' },
      { id: 'underlayment', label: 'Premium / synthetic underlayment upgrade', state: 'included', inputType: 'yes_no' },
      { id: 'roof_vents', label: 'Standard roof vents', state: 'included', inputType: 'yes_no' },
      { id: 'pipe_boots', label: 'Pipe boots', state: 'included', inputType: 'yes_no' },
      { id: 'chimney_flashing', label: 'Chimney flashing', state: 'included', inputType: 'yes_no' },
      { id: 'roof_repairs', label: 'Roof repairs', state: 'included', inputType: 'yes_no' },
      { id: 'gutters', label: 'Gutters', state: 'included', inputType: 'yes_no' },
      { id: 'downspouts', label: 'Downspouts', state: 'included', inputType: 'yes_no' },
      { id: 'cleanup', label: 'Cleanup, haul-off & disposal', state: 'included', inputType: 'yes_no' },
    ];
    const measurements = {
      roofSquares: '30',
      tradeScopeSelections: {
        roofing: [
          'tear_off',
          'underlayment',
          'roof_vents',
          'pipe_boots',
          'chimney_flashing',
          'roof_repairs',
          'gutters',
          'downspouts',
          'cleanup',
        ],
      },
      itemQuantities: {
        roofing_system__material: { quantity: '6600', quantitySource: 'user_entered' },
        roofing_system__labor: { quantity: '8400', quantitySource: 'user_entered' },
        tear_off__material: { quantity: '2250', quantitySource: 'user_entered' },
        tear_off__labor: { quantity: '3000', quantitySource: 'user_entered' },
        cleanup__material: { quantity: '450', quantitySource: 'user_entered' },
        cleanup__labor: { quantity: '550', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        roofing_system: { totalAmount: 15000 },
        tear_off: { totalAmount: 5250 },
        cleanup: { totalAmount: 1000 },
      },
    };
    const displayItems = buildConfirmScopeDisplayItems(
      checklistItems,
      measurements,
      'roofing'
    );
    const step3Rows = flattenConfirmScopeVisibleRows(displayItems, {
      templateKey: 'roofing',
      measurements,
      forStep3Review: true,
    });

    expect(step3Rows.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        'roofing_system',
        'tear_off',
        'underlayment',
        'roof_vents',
        'pipe_boots',
        'chimney_flashing',
        'roof_repairs',
        'gutters',
        'downspouts',
        'cleanup',
      ])
    );

    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'roofing' },
      confirmedAssumptions: checklistItems,
      scopeMeasurements: measurements,
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;

    expect(getScopePackagesForReview(draft).map((pkg) => pkg.checklistItemId)).toEqual(
      step3Rows.map((row) => row.id)
    );
    expect(step3Rows.map((row) => row.id)).not.toContain('shingles_roofing');
  });

  it('hides shingles_roofing on Step 3 when roofing_system choice owns install pricing', () => {
    const checklistItems: ScopeChecklistItem[] = [
      {
        id: 'roofing_system',
        label: 'Roofing system',
        state: 'included',
        inputType: 'choice',
        choiceId: 'architectural_shingles',
      },
      {
        id: 'shingles_roofing',
        label: 'Shingles / roofing install',
        state: 'included',
        inputType: 'yes_no',
      },
      { id: 'tear_off', label: 'Existing roof / tear-off', state: 'included', inputType: 'yes_no' },
    ];
    const measurements = {
      roofSquares: '45',
      tradeScopeSelections: { roofing: ['shingles', 'tear_off'] },
      itemQuantities: {
        roofing_system__material: { quantity: '30000', quantitySource: 'user_entered' },
        roofing_system__labor: { quantity: '37500', quantitySource: 'user_entered' },
      },
      pricingAcceptance: { roofing_system: { totalAmount: 67500 } },
    };
    const displayItems = buildConfirmScopeDisplayItems(
      checklistItems,
      measurements,
      'roofing'
    );
    const step3Rows = flattenConfirmScopeVisibleRows(displayItems, {
      templateKey: 'roofing',
      measurements,
      forStep3Review: true,
    });

    expect(step3Rows.map((row) => row.id)).toEqual(
      expect.arrayContaining(['roofing_system', 'tear_off'])
    );
    expect(step3Rows.map((row) => row.id)).not.toContain('shingles_roofing');
  });
});
