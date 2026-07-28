import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';
import {
  compactPackageAmount,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
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
    scopeChecklist: { templateKey: 'bathroom' },
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
    glass_door: { quantity: '3250', unit: 'allowance', quantitySource: 'user_entered' },
    interior_paint: { quantity: '50', unit: 'sqft', quantitySource: 'user_entered' },
    interior_paint__material: { quantity: '75', unit: 'allowance', quantitySource: 'user_entered' },
    interior_paint__labor: { quantity: '92.5', unit: 'allowance', quantitySource: 'user_entered' },
    cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
  };
  input.pricingAcceptance = {
    demo: acceptanceBlock(522.5, 209, 313.5),
    floor_demo: acceptanceBlock(660, 330, 330),
    shower_tile: acceptanceBlock(2080, 960, 1120),
    floor_tile: acceptanceBlock(2520, 960, 1560),
    waterproofing: acceptanceBlock(960, 400, 560),
    glass_door: acceptanceBlock(3250, 0, 0),
    interior_paint: acceptanceBlock(167.5, 75, 92.5),
    cleanup: acceptanceBlock(1000, 0, 0),
  };

  const payload = scopeMeasurementsPayloadForPersist(input, { templateKey: 'bathroom' });
  const merged = mergeScopeProgressIntoDraft(draft0, bathroomChecklistItems(), payload);
  return syncSelectedScopePricing(merged);
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
    expect(compactPackageAmount(demo, draft)).toBe('$522.50');

    expect(scopePackagePricedAmount(showerTile, draft)).toBe(2080);
    expect(scopePackageNeedsManualPrice(showerTile, draft)).toBe(false);

    expect(scopePackagePricedAmount(floorTile, draft)).toBe(2520);
    expect(scopePackageNeedsManualPrice(floorTile, draft)).toBe(false);

    expect(scopePackagePricedAmount(waterproofing, draft)).toBe(960);
    expect(scopePackagePricedAmount(glass, draft)).toBe(3250);
    expect(scopePackagePricedAmount(paint, draft)).toBe(167.5);
    expect(scopePackagePricedAmount(cleanup, draft)).toBe(1000);

    const tileRemoval = byChecklistId(packages, 'floor_demo');
    expect(scopePackagePricedAmount(tileRemoval, draft)).toBe(660);
    expect(scopePackageNeedsManualPrice(tileRemoval, draft)).toBe(false);
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
      (sum, pkg) => sum + scopePackagePricedAmount(pkg, draft),
      0
    );
    expect(rowSum).toBeCloseTo(applied!.total, 2);
  });
});
