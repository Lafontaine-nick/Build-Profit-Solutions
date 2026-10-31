import {
  syncSelectedScopePricing,
  getScopePackages,
  applyDraftToEstimate,
  sumEstimateLineTotals,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import {
  applyStep2NoteScopeFilters,
  buildConfirmScopeDisplayItems,
  confirmScopeDisplayItemsFromDraft,
} from '@/utils/scopePackagesForReview';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';
import {
  compactPackageAmount,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';
import {
  sumAppliedScopePricingFromDraft,
  sumStep3ReviewBudgetTotals,
} from '@/utils/benchmarkReasonablenessContext';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import { resolveAppliedConfirmScopePackageAmount } from '@/utils/appliedScopePackagePricing';

/** AI draft package labels from bathroom remodel Step 3 review. */
const BATHROOM_PACKAGES = [
  { name: 'Tile Removal', scope: 'Remove existing floor tile', status: 'missing_price' },
  { name: 'Tile Installation', scope: '120 sqft bath floor tile', status: 'missing_price' },
  { name: 'Bathroom Demo', scope: 'Shower wall and floor demo', status: 'missing_price' },
  { name: 'Shower Tile Installation', scope: 'Shower wall tile', status: 'missing_price' },
  { name: 'Toilet Installation', scope: '1 each', status: 'missing_price' },
  { name: 'Plumbing (Bathroom)', scope: 'Rough-in plumbing', status: 'missing_price' },
  { name: 'Vanity Installation', scope: '1 each', status: 'missing_price' },
  {
    name: 'Shower Waterproofing & Backer Board',
    scope: '80 sqft waterproofing',
    status: 'missing_price',
  },
  { name: 'Glass Shower Door Install', scope: '1 each', status: 'missing_price' },
  { name: 'Interior Painting', scope: '50 sqft', status: 'missing_price' },
  { name: 'Cleanup, Haul-off & Disposal', scope: 'Final cleanup', status: 'missing_price' },
  { name: 'Drywall Repair / Patching', scope: 'Patch shower openings', status: 'missing_price' },
  { name: 'Remove existing vanity cabinet', scope: 'Vanity demo', status: 'missing_price' },
] as const;

const APPLIED_SCOPE_IDS = [
  'demo',
  'floor_demo',
  'shower_tile',
  'floor_tile',
  'waterproofing',
  'glass_door',
  'interior_paint',
  'cleanup',
] as const;

const BATHROOM_CONFIRMED_SNAPSHOT = {
  total: 9743,
  material: 3884,
  labor: 4859,
  allowance: 1000,
  lines: [
    { itemId: 'demo', label: 'Bathroom Demo', total: 523, material: 209, labor: 314, allowance: 0 },
    { itemId: 'floor_demo', label: 'Tile Removal', total: 660, material: 330, labor: 330, allowance: 0 },
    { itemId: 'shower_tile', label: 'Shower Tile Installation', total: 2080, material: 960, labor: 1120, allowance: 0 },
    { itemId: 'floor_tile', label: 'Tile Installation', total: 2520, material: 960, labor: 1560, allowance: 0 },
    { itemId: 'waterproofing', label: 'Shower Waterproofing & Backer Board', total: 960, material: 400, labor: 560, allowance: 0 },
    { itemId: 'glass_door', label: 'Glass Shower Door Install', total: 1650, material: 950, labor: 700, allowance: 0 },
    { itemId: 'interior_paint', label: 'Interior Painting', total: 350, material: 75, labor: 275, allowance: 0 },
    { itemId: 'cleanup', label: 'Cleanup, Haul-off & Disposal', total: 1000, material: 0, labor: 0, allowance: 1000 },
  ],
};

function acceptanceBlock(total: number, material: number, labor: number) {
  return buildAcceptanceFromSuggestedBlock({
    total,
    material,
    labor,
    lumpSumOnly: !(material > 0 && labor > 0),
    rateSourceLabel: 'National Average',
    materialSource: 'national_average',
    laborSource: 'national_average',
  });
}

function bathroomChecklistItems(): ScopeChecklistItem[] {
  return APPLIED_SCOPE_IDS.map((id) => ({
    id,
    label: id,
    state: 'included' as const,
    inputType: 'yes_no' as const,
  }));
}

function bathroomDraftWithAppliedPricing(): EstimateAiDraft {
  const draft0 = {
    scopeChecklist: { templateKey: 'bathroom', items: bathroomChecklistItems() },
    projectType: 'bathroom',
    estimateTier: 'room_remodel',
    scopeAssumptionsConfirmed: true,
    scopePackages: BATHROOM_PACKAGES.map((p) => ({
      ...p,
      price: null,
      knownSubtotal: null,
      priceSource: 'missing',
    })),
    rooms: [],
    scopeMeasurements: {
      bathroomFloorSqft: 120,
      showerWallTileSqft: 80,
      showerFloorTileSqft: 15,
      itemQuantities: {},
    },
  } as unknown as EstimateAiDraft;

  const input = initialScopeMeasurementInputExtended(draft0);
  input.itemQuantities = {
    ...input.itemQuantities,
    demo: { quantity: '95', unit: 'sqft', quantitySource: 'user_entered' },
    demo__material: { quantity: '209', unit: 'allowance', quantitySource: 'user_entered' },
    demo__labor: { quantity: '313.5', unit: 'allowance', quantitySource: 'user_entered' },
    floor_demo: { quantity: '120', unit: 'sqft', quantitySource: 'user_entered' },
    floor_demo__material: { quantity: '330', unit: 'allowance', quantitySource: 'user_entered' },
    floor_demo__labor: { quantity: '330', unit: 'allowance', quantitySource: 'user_entered' },
    shower_tile: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
    shower_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
    shower_tile__labor: { quantity: '1120', unit: 'allowance', quantitySource: 'user_entered' },
    floor_tile: { quantity: '120', unit: 'sqft', quantitySource: 'user_entered' },
    floor_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
    floor_tile__labor: { quantity: '1560', unit: 'allowance', quantitySource: 'user_entered' },
    waterproofing: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
    waterproofing__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
    waterproofing__labor: { quantity: '560', unit: 'allowance', quantitySource: 'user_entered' },
    glass_door: { quantity: '1650', unit: 'allowance', quantitySource: 'user_entered' },
    glass_door__material: { quantity: '950', unit: 'allowance', quantitySource: 'user_entered' },
    glass_door__labor: { quantity: '700', unit: 'allowance', quantitySource: 'user_entered' },
    interior_paint: { quantity: '50', unit: 'sqft', quantitySource: 'user_entered' },
    interior_paint__material: { quantity: '75', unit: 'allowance', quantitySource: 'user_entered' },
    interior_paint__labor: { quantity: '275', unit: 'allowance', quantitySource: 'user_entered' },
    cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
  };
  input.pricingAcceptance = {
    demo: acceptanceBlock(522.5, 209, 313.5),
    floor_demo: acceptanceBlock(660, 330, 330),
    shower_tile: acceptanceBlock(2080, 960, 1120),
    floor_tile: acceptanceBlock(2520, 960, 1560),
    waterproofing: acceptanceBlock(960, 400, 560),
    glass_door: acceptanceBlock(1650, 950, 700),
    interior_paint: acceptanceBlock(350, 75, 275),
    cleanup: acceptanceBlock(1000, 0, 0),
  };

  const payload = scopeMeasurementsPayloadForPersist(input, { templateKey: 'bathroom' });
  const merged = mergeScopeProgressIntoDraft(draft0, bathroomChecklistItems(), payload);
  const synced = syncSelectedScopePricing(merged);
  return {
    ...synced,
    scopeMeasurements: {
      ...synced.scopeMeasurements,
      confirmedScopePricingSnapshot: BATHROOM_CONFIRMED_SNAPSHOT,
    },
  };
}

describe('bathroom Step 2 → Step 3 package label mapping', () => {
  it('maps AI bathroom package names to Confirm Scope checklist keys', () => {
    expect(lookupRuleKeyForPackage('Shower Tile Installation')).toBe('shower_tile');
    expect(lookupRuleKeyForPackage('Tile Installation')).toBe('floor_tile');
    expect(lookupRuleKeyForPackage('Tile Removal')).toBe('floor_demo');
    expect(lookupRuleKeyForPackage('Bathroom Demo')).toBe('demo');
    expect(lookupRuleKeyForPackage('Drywall Repair / Patching')).toBe('patch_repair');
    expect(lookupRuleKeyForPackage('Remove existing vanity cabinet')).toBe('vanity_demo');
    expect(lookupRuleKeyForPackage('Plumbing (Bathroom)')).toBe('plumbing_rough');
    expect(lookupRuleKeyForPackage('Shower Waterproofing & Backer Board')).toBe('waterproofing');
    expect(lookupRuleKeyForPackage('Plumbing fixtures (faucets, toilet, hookups)')).toBe(
      'plumbing_trim'
    );
  });

  it('plumbing_trim Step 3 row does not inherit toilet Applied pricing', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        {
          id: 'toilet',
          label: 'Toilet',
          inputType: 'choice',
          state: 'included',
          choiceId: 'replacing',
        },
        {
          id: 'plumbing_trim',
          label: 'Plumbing fixtures (faucets, toilet, hookups)',
          inputType: 'yes_no',
          state: 'included',
        },
      ],
      scopePackages: [
        {
          name: 'Plumbing fixtures (faucets, toilet, hookups)',
          scope: 'Trim-out',
          checklistItemId: 'plumbing_trim',
          price: 900,
          knownSubtotal: 900,
          status: 'missing_price',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          toilet: { quantity: '1', unit: 'each', quantitySource: 'user_entered' },
          toilet__material: { quantity: '200', unit: 'allowance', quantitySource: 'user_entered' },
          toilet__labor: { quantity: '700', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          toilet: { status: 'accepted', totalAmount: 900, materialAmount: 200, laborAmount: 700 },
        },
      },
    } as unknown as EstimateAiDraft;

    const pkg = draft.scopePackages![0];
    expect(resolveAppliedConfirmScopePackageAmount(pkg, draft)).toBe(0);
    expect(scopePackagePricedAmount(pkg, draft)).toBe(0);
    expect(scopePackageNeedsManualPrice(pkg, draft)).toBe(true);
  });
});

describe('bathroom Step 2 → Step 3 pricing sync (review rows)', () => {
  const byChecklistId = (
    packages: ReturnType<typeof getScopePackages>,
    id: string
  ) => packages.find((p) => p.checklistItemId === id || p.costCode === id)!;

  it('shows applied Confirm Scope prices on Step 3 rows, not Add price', () => {
    const draft = bathroomDraftWithAppliedPricing();
    const packages = getScopePackages(draft);

    const demo = byChecklistId(packages, 'demo');
    const showerTile = byChecklistId(packages, 'shower_tile');
    const floorTile = byChecklistId(packages, 'floor_tile');
    const waterproofing = byChecklistId(packages, 'waterproofing');
    const glass = byChecklistId(packages, 'glass_door');
    const paint = byChecklistId(packages, 'interior_paint');
    const cleanup = byChecklistId(packages, 'cleanup');

    expect(scopePackagePricedAmount(demo, draft)).toBe(522.5);
    expect(scopePackageNeedsManualPrice(demo, draft)).toBe(false);
    expect(compactPackageAmount(demo, draft)).toBe('$523');

    expect(scopePackagePricedAmount(showerTile, draft)).toBe(2080);
    expect(scopePackageNeedsManualPrice(showerTile, draft)).toBe(false);

    expect(scopePackagePricedAmount(floorTile, draft)).toBe(2520);
    expect(scopePackageNeedsManualPrice(floorTile, draft)).toBe(false);

    expect(scopePackagePricedAmount(waterproofing, draft)).toBe(960);
    expect(scopePackagePricedAmount(glass, draft)).toBe(1650);
    expect(scopePackagePricedAmount(paint, draft)).toBe(350);
    expect(scopePackagePricedAmount(cleanup, draft)).toBe(1000);

    const tileRemoval = byChecklistId(packages, 'floor_demo');
    expect(scopePackagePricedAmount(tileRemoval, draft)).toBe(660);
    expect(scopePackageNeedsManualPrice(tileRemoval, draft)).toBe(false);
  });

  it('keeps the Confirm Scope list, its labels, and the applied total on the bid', () => {
    const notes =
      'Bathroom remodel. Tear out the shower wall tile, install shower floor tile on a new mud pan, and paint the walls.';
    const items: ScopeChecklistItem[] = [
      { id: 'demo', label: 'Demolition', state: 'included', inputType: 'yes_no' },
      { id: 'paint', label: 'Paint', state: 'included', inputType: 'yes_no' },
      {
        id: 'interior_door_install',
        label: 'Interior door installation',
        state: 'included',
        inputType: 'yes_no',
      },
    ];
    const draft = {
      originalNotes: notes,
      projectType: 'bathroom',
      scopeMode: 'dedicated',
      scopeChecklist: { templateKey: 'bathroom', items },
      scopeMeasurements: {},
    } as unknown as EstimateAiDraft;
    const display = buildConfirmScopeDisplayItems(items, {}, 'bathroom', notes);
    const screen = applyStep2NoteScopeFilters(display, draft, {}, 'bathroom');
    const later = confirmScopeDisplayItemsFromDraft(draft);
    const identity = (rows: ScopeChecklistItem[]) =>
      rows.map(row => `${row.id}|${row.label}|${row.state}`);

    expect(identity(later)).toEqual(identity(screen));
    expect(screen.find(row => row.id === 'interior_door_install')).toBeUndefined();
    expect(screen.find(row => row.id === 'demo')?.label).toBe(
      'Shower tile demo / tear-out'
    );
    expect(screen.some(row => row.id === 'shower_floor_tile')).toBe(true);
    expect(screen.some(row => row.id === 'shower_pan')).toBe(true);
  });

  it('writes the applied bathroom total onto the bid the summary and PDF read', () => {
    const draft = bathroomDraftWithAppliedPricing();
    const applied = sumAppliedScopePricingFromDraft(draft);
    const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly: true });
    const lines = sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems);
    const allowances = (
      (bid.allowanceLineItems as Array<{ amount?: number; total?: number }>) || []
    ).reduce((sum, row) => sum + (Number(row.amount ?? row.total) || 0), 0);

    expect(applied?.total).toBeGreaterThan(0);
    expect(lines.material + lines.labor + allowances).toBeCloseTo(applied!.total, 2);
    expect(sumStep3ReviewBudgetTotals(draft)?.total).toBeCloseTo(applied!.total, 2);
  });

  it('hero total matches Confirm Scope applied pricing (Step 2 footer)', () => {
    const draft = bathroomDraftWithAppliedPricing();
    const hero = sumStep3ReviewBudgetTotals(draft);
    const applied = sumAppliedScopePricingFromDraft(draft);
    expect(hero?.total).toBe(applied?.total);
    expect(hero?.total).toBeGreaterThan(0);
  });

  it('Step 3 row amounts sum to the same total as Step 2 Applied pricing', () => {
    const draft = bathroomDraftWithAppliedPricing();
    const applied = sumAppliedScopePricingFromDraft(draft);
    const rowSum = getScopePackages(draft).reduce(
      (sum, pkg) => sum + Math.round(scopePackagePricedAmount(pkg, draft)),
      0
    );
    expect(rowSum).toBeCloseTo(applied!.total, 2);
  });

  it('keeps Step 3 row totals aligned with applied-only hero after Confirm Scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom' },
      confirmedAssumptions: [
        { id: 'vanity_demo', label: 'Remove vanity', state: 'included', inputType: 'yes_no' },
        { id: 'countertop_demo', label: 'Remove countertop', state: 'included', inputType: 'yes_no' },
        {
          id: 'vanity',
          label: 'New vanity',
          state: 'included',
          inputType: 'choice',
          choiceId: 'replacing',
        },
        { id: 'mirror_accessories', label: 'Bath accessories', state: 'included', inputType: 'yes_no' },
        { id: 'plumbing_trim', label: 'Plumbing fixtures', state: 'included', inputType: 'yes_no' },
        { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included', inputType: 'yes_no' },
        { id: 'shower_tile', label: 'Shower tile', state: 'included', inputType: 'yes_no' },
        { id: 'drywall', label: 'Drywall repair', state: 'included', inputType: 'yes_no' },
      ],
      scopeMeasurements: {
        showerWallTileSqft: 80,
        bathroomDemoVanityCount: 1,
        bathroomDemoCounterCount: 1,
        bathroomInstallVanityCount: 1,
      },
      scopePackages: [],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const packages = getScopePackages(draft);
    const vanityDemo = packages.find((p) => p.checklistItemId === 'vanity_demo')!;
    const countertopDemo = packages.find((p) => p.checklistItemId === 'countertop_demo')!;
    const vanity = packages.find((p) => p.checklistItemId === 'vanity')!;
    const plumbingTrim = packages.find((p) => p.checklistItemId === 'plumbing_trim')!;
    const plumbingRough = packages.find((p) => p.checklistItemId === 'plumbing_rough')!;
    const drywall = packages.find((p) => p.checklistItemId === 'drywall')!;

    expect(scopePackagePricedAmount(vanityDemo, draft)).toBe(0);
    expect(scopePackagePricedAmount(countertopDemo, draft)).toBe(0);
    expect(scopePackagePricedAmount(vanity, draft)).toBe(0);
    expect(scopePackagePricedAmount(plumbingTrim, draft)).toBe(0);
    expect(scopePackagePricedAmount(plumbingRough, draft)).toBe(0);
    expect(scopePackagePricedAmount(drywall, draft)).toBe(0);
    expect(scopePackageNeedsManualPrice(vanityDemo, draft)).toBe(true);
    expect(scopePackageNeedsManualPrice(plumbingTrim, draft)).toBe(true);
    expect(scopePackageNeedsManualPrice(plumbingRough, draft)).toBe(true);
    expect(scopePackageNeedsManualPrice(drywall, draft)).toBe(true);
    expect(sumLiveScopePackageTotals(draft)).toBe(0);
    expect(sumAppliedScopePricingFromDraft(draft)?.total ?? 0).toBe(0);
  });

  it('Step 2 suggested pricing includes labor-only countertop demo national average', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: { bathroomDemoCounterCount: 1 },
    } as never);
    const resolved = resolveChecklistItemQuantity('countertop_demo', input, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'countertop_demo',
      input,
      'bathroom',
      resolved
    );
    expect(fill?.total).toBe(175);
    expect(fill?.material).toBe(0);
    expect(fill?.labor).toBe(175);
  });
});
