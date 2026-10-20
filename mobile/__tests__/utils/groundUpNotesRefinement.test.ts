import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { inferDefaultGarageDoorCounts } from '@/utils/exteriorOpeningsPricing';
import {
  drywallPackageSurfacePlanningQuantity,
  resolveDrywallProductionAssemblyBaseline,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import {
  getQuickMeasurementEstimate,
  syncMeasurementsWithSouthernUtahPlanFacts,
} from '@/utils/quickMeasurementEstimates';
import {
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
} from '@/utils/insulationEnvelopeQuantity';
import {
  resolveChecklistItemQuantity,
  resolveGroundUpHvacPlanningFill,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { prepareScopeMeasurementsInputForUi } from '@/utils/scopeItemQuantities';
import { quickMeasurementRowsForInput, quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';
import { confirmScopeDrywallSqftLabel } from '@/utils/drywallNoteScope';
import {
  applyGroundUpNamedWallFinish,
  applyScopeInferencesFromNotes,
  restoreConfirmedChecklistItemStates,
} from '@/utils/estimateScopeChecklistUi';
import { sumConfirmScopeAppliedPricingBreakdown } from '@/utils/benchmarkReasonablenessContext';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
  understoodRepeatsScopePreview,
} from '@/utils/estimateInitialRevealUi';
import { reconcileScopePackagesForReview } from '@/utils/scopePackagesForReview';

const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

const TWO_STORY_STUCCO_NOTES =
  'New 2,450 sqft two-story home with an attached 520 sqft 2-car garage. Stucco exterior. Owner is taking care of landscaping separate from us.';

const ONE_STORY_PATIO_NOTES =
  'New 1,840 sqft one-story home with an attached 440 sqft 2-car garage and a 12 by 16 covered patio. Brick exterior. Owner is taking care of sitework and utilities separate from us.';

const VINYL_SIDING_NOTES =
  'New 1,960 sqft one-story home with an attached 400 sqft 2-car garage and a 14 by 16 covered patio. Vinyl siding. Owner is taking care of landscaping separate from us.';

describe('ground-up notes refinement', () => {
  it('infers garage door counts from 2-car garage language', () => {
    expect(inferDefaultGarageDoorCounts(500)).toEqual({
      single: 0,
      double: 1,
      rv: 0,
    });
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
    });
    expect(parsed.garageDoorDoubleCount).toBe(1);
  });

  it('prices complete drywall at production baseline when living SF has no barometer match', () => {
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
    });
    const packageSf = drywallPackageSurfacePlanningQuantity(
      parsed.floorAreaSqft,
      parsed.garageSqft
    );
    expect(packageSf).toBeGreaterThan(9000);
    const baseline = resolveDrywallProductionAssemblyBaseline({
      livingSf: parsed.floorAreaSqft,
      packageSurfaceSqft: packageSf,
    });
    expect(baseline.material + baseline.labor).toBeGreaterThanOrEqual(1.5);
    expect(baseline.barometerTotal).toBeUndefined();
    expect(packageSf! * (baseline.material + baseline.labor)).toBeGreaterThan(
      15000
    );
  });

  it('keeps the home living area and leaves owner site trades off', () => {
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
      projectType: 'new_build',
    });
    expect(parsed.floorAreaSqft).toBe(2800);
    expect(parsed.landscapeSqft).not.toBe(2800);
    const flooring = getQuickMeasurementEstimate(
      'flooringSqft',
      { floorAreaSqft: parsed.floorAreaSqft, garageSqft: parsed.garageSqft },
      undefined,
      'ground_up'
    );
    expect(flooring?.value).toBe(2800);
    const rows = quickMeasurementRowsForTemplate(
      'ground_up',
      'new_build',
      GROUND_UP_HOME_NOTES
    );
    expect(rows.flat().some(field => field.key === 'excavationCy')).toBe(false);
    expect(confirmScopeDrywallSqftLabel(GROUND_UP_HOME_NOTES, {
      installNamed: false,
      repairNamed: false,
    })).toBeNull();
    const items = applyScopeInferencesFromNotes(
      [
        { id: 'landscaping', label: 'Landscaping', inputType: 'yes_no', state: 'included' },
        { id: 'sitework', label: 'Sitework', inputType: 'yes_no', state: 'included' },
        { id: 'grading', label: 'Grading', inputType: 'yes_no', state: 'included' },
        { id: 'excavation', label: 'Excavation', inputType: 'yes_no', state: 'included' },
        { id: 'utility_taps', label: 'Utilities', inputType: 'yes_no', state: 'included' },
        { id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'unsure' },
      ] as any,
      GROUND_UP_HOME_NOTES,
      'ground_up'
    );
    for (const id of ['landscaping', 'sitework', 'grading', 'excavation', 'utility_taps']) {
      expect(items.find(item => item.id === id)?.state).toBe('excluded');
    }
    expect(items.find(item => item.id === 'framing')?.state).toBe('included');
    const restored = restoreConfirmedChecklistItemStates(
      items,
      items.map(item =>
        item.id === 'landscaping' ? { ...item, state: 'included' as const } : item
      ),
      GROUND_UP_HOME_NOTES
    );
    expect(restored.find(item => item.id === 'landscaping')?.state).toBe('excluded');
    const draft = {
      estimateTier: 'ground_up',
      projectType: 'new_build',
      requiresScopeConfirmation: true,
      originalNotes: GROUND_UP_HOME_NOTES,
      stillNeededReview: [
        'Pricing for Sitework',
        'Pricing for Landscaping',
        'Pricing for Excavation',
        'Pricing for Drywall finish',
        'Pricing for Plans / engineering',
      ],
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'sitework', label: 'Sitework', state: 'included', inputType: 'yes_no' },
          {
            id: 'landscaping',
            label: 'Landscaping / site walls & gates',
            state: 'included',
            inputType: 'yes_no',
          },
          { id: 'grading', label: 'Grading', state: 'included', inputType: 'yes_no' },
        ],
      },
    } as any;
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual([
      '2,800 sqft two-story home',
      'Attached 2-car garage',
    ]);
    expect(
      getInitialRevealDisplayTitle({
        ...draft,
        projectTitle:
          'New 2,800 Sq Ft Two-Story Home with Attached 2-Car Garage',
      })
    ).toBe('New 2,800 Sq Ft Two-Story Home');
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      '2,800 sqft two-story home',
      'Attached 2-car garage',
      'Plans / engineering',
    ]);
    const attention = getInitialRevealConfirmItems(draft).pricingScope.join(' ');
    expect(attention).not.toMatch(/sitework|landscaping|excavation/i);
    expect(attention).not.toMatch(/drywall finish/i);
    expect(attention).toMatch(/plans/i);
  });

  it('keeps derived wall area blank and uses two stories for slab and paint', () => {
    const prepared = prepareScopeMeasurementsInputForUi(
      {
        floorAreaSqft: '2800',
        garageSqft: '500',
        framedAreaSqft: '3300',
        storyCount: '2',
        itemQuantities: {},
      } as any,
      {
        notes: GROUND_UP_HOME_NOTES,
        templateKey: 'ground_up',
        projectType: 'new_build',
      }
    );
    expect(String(prepared.framedAreaSqft || '')).toBe('');
    const measurements = {
      floorAreaSqft: 2800,
      garageSqft: 500,
      storyCount: 2,
    };
    expect(
      getQuickMeasurementEstimate(
        'concreteCy',
        measurements,
        undefined,
        'ground_up',
        { notes: GROUND_UP_HOME_NOTES, projectType: 'new_build' }
      )?.value
    ).toBe(50);
    expect(
      getQuickMeasurementEstimate(
        'exteriorPaintSqft',
        measurements,
        undefined,
        'ground_up',
        { notes: GROUND_UP_HOME_NOTES, projectType: 'new_build' }
      )?.value
    ).toBe(2668);
  });

  it('prices a two-story stucco home from the first floor and the wall area', () => {
    const measurements = {
      floorAreaSqft: 2450,
      garageSqft: 520,
      scopeNotes: TWO_STORY_STUCCO_NOTES,
    };
    const options = {
      notes: TWO_STORY_STUCCO_NOTES,
      projectType: 'new_build' as const,
    };
    const excavation = getQuickMeasurementEstimate(
      'excavationCy',
      measurements,
      undefined,
      'ground_up',
      options
    );
    const roof = getQuickMeasurementEstimate(
      'roofSquares',
      measurements,
      undefined,
      'ground_up',
      options
    );
    const walls = getQuickMeasurementEstimate(
      'exteriorPaintSqft',
      measurements,
      undefined,
      'ground_up',
      options
    );
    expect(excavation?.value).toBeGreaterThan(80);
    expect(excavation?.value).toBeLessThan(100);
    expect(roof?.value).toBeCloseTo(20.8, 1);
    expect(walls?.value).toBe(2557);

    const envelope = resolveInsulationEnvelopePlanningQuantity(
      insulationEnvelopeInputsFromPlanFacts(undefined, 2450, {
        garageSqft: 520,
        scopeNotes: TWO_STORY_STUCCO_NOTES,
      })
    );
    expect(envelope?.totalInsulationEnvelopeSqft).toBeGreaterThan(3400);
    expect(envelope?.totalInsulationEnvelopeSqft).toBeLessThan(4200);

    const drywallMeasurements = {
      ...measurements,
      drywallSqft: '10007',
      itemQuantities: {},
    } as any;
    const drywallResolved = resolveChecklistItemQuantity(
      'drywall',
      drywallMeasurements,
      {
        templateKey: 'ground_up',
        notes: TWO_STORY_STUCCO_NOTES,
      }
    );
    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      drywallMeasurements,
      'ground_up',
      drywallResolved,
      null,
      null,
      TWO_STORY_STUCCO_NOTES
    );
    expect(drywallResolved.quantity).toBe(8575);
    expect(drywall.fill?.basis?.quantity).toBe(8575);

    const paint = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      { ...measurements, exteriorPaintSqft: '2557', itemQuantities: {} } as any,
      'ground_up',
      resolveChecklistItemQuantity('exterior_paint', {
        ...measurements,
        exteriorPaintSqft: '2557',
      } as any, {
        templateKey: 'ground_up',
        notes: TWO_STORY_STUCCO_NOTES,
      }),
      null,
      null,
      TWO_STORY_STUCCO_NOTES
    );
    expect(paint.fill?.basis?.quantity).toBe(2557);
    expect(paint.fill?.total).toBeCloseTo(2557 * 3.15, 0);

    const refreshed = syncMeasurementsWithSouthernUtahPlanFacts(
      {
        floorAreaSqft: 2450,
        garageSqft: 520,
        roofSquares: 24.5,
        excavationCy: 135,
        scopeNotes: TWO_STORY_STUCCO_NOTES,
      },
      { templateKey: 'ground_up', notes: TWO_STORY_STUCCO_NOTES }
    );
    expect(Number(refreshed.roofSquares)).toBeCloseTo(20.8, 1);
    expect(Number(refreshed.excavationCy)).toBeGreaterThan(80);
    expect(Number(refreshed.excavationCy)).toBeLessThan(100);
  });

  it('prices the named patio, the roof squares, and the drywall on the form', () => {
    const parsed = parseScopeMeasurementsFromNotes(ONE_STORY_PATIO_NOTES, {
      templateKey: 'ground_up',
      projectType: 'new_build',
    });
    expect(parsed.floorAreaSqft).toBe(1840);
    expect(parsed.garageSqft).toBe(440);
    expect(parsed.deckSqft).toBe(192);

    const revealDraft = {
      projectType: 'new_build',
      estimateTier: 'ground_up',
      originalNotes: ONE_STORY_PATIO_NOTES,
      scopeChecklist: { templateKey: 'ground_up', items: [] },
      scopePackages: [
        { checklistItemId: 'permits', name: 'Permits / fees (incl. impact)' },
      ],
    } as any;
    expect(getInitialRevealUnderstoodBullets(revealDraft)).toEqual([
      '1,840 sqft home',
      '440 sqft 2-car garage',
      '192 sqft covered patio',
      'Brick exterior',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(revealDraft).map(row => row.name)
    ).toEqual([
      '1,840 sqft home',
      '440 sqft 2-car garage',
      '192 sqft covered patio',
      'Brick exterior',
    ]);
    expect(getInitialRevealTotals(revealDraft).scopeItemCount).toBe(4);
    const preview = getInitialRevealChecklistScopePreview(revealDraft);
    expect(
      understoodRepeatsScopePreview(
        getInitialRevealUnderstoodBullets(revealDraft),
        preview
      )
    ).toBe(true);

    const measurements = {
      floorAreaSqft: 1840,
      garageSqft: 440,
      deckSqft: 192,
      scopeNotes: ONE_STORY_PATIO_NOTES,
      itemQuantities: {},
    };
    const options = {
      notes: ONE_STORY_PATIO_NOTES,
      projectType: 'new_build' as const,
    };
    const roof = getQuickMeasurementEstimate(
      'roofSquares',
      measurements,
      undefined,
      'ground_up',
      options
    );
    expect(roof?.value).toBeCloseTo(29.4, 1);

    const roofResolved = resolveChecklistItemQuantity(
      'roofing',
      measurements as any,
      { templateKey: 'ground_up', notes: ONE_STORY_PATIO_NOTES }
    );
    const roofPrice = resolveScopeItemSuggestedPricing(
      'roofing',
      measurements as any,
      'ground_up',
      roofResolved,
      null,
      null,
      ONE_STORY_PATIO_NOTES
    );
    expect(roofPrice.fill?.basis?.quantity).toBeCloseTo(29.4, 1);
    expect(roofPrice.fill?.total).toBeCloseTo(
      Number(roofPrice.fill?.basis?.quantity) * 575,
      0
    );

    const deckResolved = resolveChecklistItemQuantity(
      'decking',
      measurements as any,
      { templateKey: 'ground_up', notes: ONE_STORY_PATIO_NOTES }
    );
    const deck = resolveScopeItemSuggestedPricing(
      'decking',
      measurements as any,
      'ground_up',
      deckResolved,
      null,
      null,
      ONE_STORY_PATIO_NOTES
    );
    expect(deckResolved.quantity).toBe(192);
    expect(deck.fill?.basis?.quantity).toBe(192);
    expect(deck.fill?.total).toBe(3840);

    const drywallResolved = resolveChecklistItemQuantity(
      'drywall',
      measurements as any,
      { templateKey: 'ground_up', notes: ONE_STORY_PATIO_NOTES }
    );
    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements as any,
      'ground_up',
      drywallResolved,
      null,
      null,
      ONE_STORY_PATIO_NOTES
    );
    expect(drywallResolved.quantity).toBe(6440);
    expect(drywall.fill?.basis?.quantity).toBe(6440);
    expect(drywall.fill?.total).toBeCloseTo(6440 * 1.66, 0);
  });

  it('prices an entered flatwork area and leaves a named finish without an open paint line', () => {
    const entered = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      {
        floorAreaSqft: 1840,
        garageSqft: 440,
        concreteSqft: 1000,
        quickMeasurementSources: { concreteSqft: 'user_entered' },
        quickMeasurementUserOverrides: { concreteSqft: true },
        itemQuantities: {
          pour_flatwork: {
            quantity: 1000,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      } as any,
      'ground_up',
      { quantity: 1000, unit: 'sqft', quantitySource: 'user_entered' },
      null,
      null,
      ONE_STORY_PATIO_NOTES
    );
    expect(entered.fill?.basis?.quantity).toBe(1000);
    expect(entered.fill?.total).toBeGreaterThan(9000);
    expect(entered.fill?.total).toBeLessThan(10500);

    const planning = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      {
        floorAreaSqft: 1840,
        garageSqft: 440,
        concreteSqft: 1000,
        itemQuantities: {},
      } as any,
      'ground_up',
      { quantity: 1000, unit: 'sqft', quantitySource: 'inferred' },
      null,
      null,
      ONE_STORY_PATIO_NOTES
    );
    expect(planning.fill?.total).toBeGreaterThan(entered.fill?.total ?? 0);

    const selected = sumConfirmScopeAppliedPricingBreakdown({
      items: [
        {
          id: 'pour_flatwork',
          label: 'Flatwork',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      templateKey: 'ground_up',
      notes: ONE_STORY_PATIO_NOTES,
      measurements: {
        floorAreaSqft: 1840,
        concreteSqft: 1000,
        quickMeasurementSources: { concreteSqft: 'user_entered' },
        quickMeasurementUserOverrides: { concreteSqft: true },
        itemQuantities: {
          pour_flatwork: {
            quantity: 1000,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
          pour_flatwork__material: {
            quantity: 4300,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
          pour_flatwork__labor: {
            quantity: 6454,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
        },
        pricingAcceptance: {
          pour_flatwork: {
            selectionStatus: 'accepted',
            totalAmount: 10754,
            materialAmount: 4300,
            laborAmount: 6454,
          },
        },
      } as any,
    });
    expect(selected.total).toBeGreaterThan(9000);
    expect(selected.total).toBeLessThan(10500);
    expect(selected.total).toBeLessThan(10754);

    const brickItems = applyScopeInferencesFromNotes(
      [
        {
          id: 'exterior_paint',
          label: 'Exterior painting',
          inputType: 'yes_no',
          state: 'included',
        },
        { id: 'brick', label: 'Brick', inputType: 'yes_no', state: 'included' },
      ] as any,
      ONE_STORY_PATIO_NOTES,
      'ground_up'
    );
    expect(brickItems.find(item => item.id === 'exterior_paint')?.state).toBe(
      'excluded'
    );
    expect(brickItems.find(item => item.id === 'brick')?.state).toBe('included');

    const stuccoItems = applyScopeInferencesFromNotes(
      [
        {
          id: 'exterior_paint',
          label: 'Exterior painting',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      TWO_STORY_STUCCO_NOTES,
      'ground_up'
    );
    expect(stuccoItems.find(item => item.id === 'exterior_paint')?.state).toBe(
      'excluded'
    );

    const painted = applyScopeInferencesFromNotes(
      [
        {
          id: 'exterior_paint',
          label: 'Exterior painting',
          inputType: 'yes_no',
          state: 'unsure',
        },
      ] as any,
      `${ONE_STORY_PATIO_NOTES} Exterior paint on the brick.`,
      'ground_up'
    );
    expect(painted.find(item => item.id === 'exterior_paint')?.state).toBe(
      'included'
    );

    const packages = reconcileScopePackagesForReview({
      originalNotes: ONE_STORY_PATIO_NOTES,
      projectType: 'new_build',
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          {
            id: 'exterior_paint',
            label: 'Exterior painting',
            inputType: 'yes_no',
            state: 'included',
          },
          { id: 'brick', label: 'Brick', inputType: 'yes_no', state: 'included' },
        ],
      },
      confirmedAssumptions: [
        {
          id: 'exterior_paint',
          label: 'Exterior painting',
          inputType: 'yes_no',
          state: 'included',
        },
        { id: 'brick', label: 'Brick', inputType: 'yes_no', state: 'included' },
      ],
      scopePackages: [
        {
          checklistItemId: 'exterior_paint',
          name: 'Exterior painting',
          status: 'missing_price',
          price: 0,
        },
        {
          checklistItemId: 'brick',
          name: 'Brick',
          status: 'confirmed',
          price: 26298,
        },
      ],
      scopeMeasurements: {},
    } as any);
    expect(packages.some(pkg => pkg.checklistItemId === 'exterior_paint')).toBe(
      false
    );
    expect(packages.some(pkg => pkg.checklistItemId === 'brick')).toBe(true);

    const draft = {
      projectType: 'new_build',
      originalNotes: ONE_STORY_PATIO_NOTES,
      scopeChecklist: { templateKey: 'ground_up', items: [] },
      scopeMeasurements: {},
    } as any;
    expect(
      formatScopeQuantity(
        {
          name: 'Shower wall tile',
          checklistItemId: 'shower_tile',
          scopeQuantities: [{ quantity: 1, unit: 'sqft' }],
        } as any,
        draft
      )
    ).toBe('Allowance');
    expect(
      formatScopeQuantity(
        {
          name: 'Shower doors',
          checklistItemId: 'glass_door',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
        } as any,
        draft
      )
    ).toBe('Allowance');
    expect(
      formatScopeQuantity(
        {
          name: 'Shower wall tile',
          checklistItemId: 'shower_tile',
          scopeQuantities: [{ quantity: 1, unit: 'sqft' }],
        } as any,
        { ...draft, scopeMeasurements: { showerWallTileSqft: 86 } }
      )
    ).toBe('86 sqft');
    expect(
      formatScopeQuantity(
        {
          name: 'Shower doors',
          checklistItemId: 'glass_door',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
        } as any,
        { ...draft, scopeMeasurements: { showerDoorCount: 2 } }
      )
    ).toBe('2 each');
  });

  it('prices vinyl siding on the wall card and leaves the exterior paint box off', () => {
    const wall = applyGroundUpNamedWallFinish(
      [
        {
          id: 'stucco',
          label: 'Stucco / exterior wall finish',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      VINYL_SIDING_NOTES
    );
    expect(wall[0].label).toBe('Vinyl siding');

    const brick = applyGroundUpNamedWallFinish(
      [
        {
          id: 'stucco',
          label: 'Stucco / exterior wall finish',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      ONE_STORY_PATIO_NOTES
    );
    expect(brick[0].label).toBe('Brick');

    const stucco = applyGroundUpNamedWallFinish(
      [
        {
          id: 'stucco',
          label: 'Stucco / exterior wall finish',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      TWO_STORY_STUCCO_NOTES
    );
    expect(stucco[0].label).toBe('Stucco / exterior wall finish');

    const vinylRows = quickMeasurementRowsForInput(
      'ground_up',
      'new_build',
      { floorAreaSqft: 1960 },
      undefined,
      { scopeNotes: VINYL_SIDING_NOTES }
    );
    expect(vinylRows.flat().some(field => field.key === 'exteriorPaintSqft')).toBe(
      false
    );
    const openRows = quickMeasurementRowsForInput(
      'ground_up',
      'new_build',
      { floorAreaSqft: 2800 },
      undefined,
      { scopeNotes: GROUND_UP_HOME_NOTES }
    );
    expect(openRows.flat().some(field => field.key === 'exteriorPaintSqft')).toBe(
      true
    );

    const priced = resolveScopeItemSuggestedPricing(
      'stucco',
      {
        floorAreaSqft: 1960,
        garageSqft: 400,
        exteriorPaintSqft: 1487,
        exteriorFinish: 'siding',
        exteriorFinishes: ['siding'],
        itemQuantities: {},
      } as any,
      'ground_up',
      { quantity: 1487, unit: 'sqft', quantitySource: 'inferred' },
      null,
      null,
      VINYL_SIDING_NOTES
    );
    expect(priced.fill?.basis?.quantity).toBe(1487);
    expect(priced.fill?.total).toBeCloseTo(1487 * 8, 0);
  });

  it('steps the HVAC package with living area and prices stated shower takeoff', () => {
    const FIBER =
      'New 2,280 sqft one-story home with an attached 460 sqft 2-car garage and a 10 by 20 covered patio. Fiber cement siding. Owner is taking care of sitework separate from us.';
    const price = (itemId: string, notes: string) => {
      const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'ground_up' });
      const input = {
        ...parsed,
        scopeNotes: notes,
        originalNotes: notes,
        itemQuantities: {},
      };
      const resolved = resolveChecklistItemQuantity(itemId, input, {
        templateKey: 'ground_up',
        notes,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        input as any,
        'ground_up',
        resolved,
        { state: 'UT' },
        null,
        notes
      );
    };

    const hvac1840 = price('hvac', ONE_STORY_PATIO_NOTES);
    const hvac2280 = price('hvac', FIBER);
    expect(hvac1840.fill?.total).toBe(15300);
    expect(hvac2280.fill?.total).toBe(16830);
    expect(hvac2280.fill?.basis).toMatchObject({ quantity: 1, unit: 'each' });

    const tile = price('shower_tile', FIBER);
    const doors = price('glass_door', FIBER);
    expect(tile.fill?.total).toBeCloseTo(11262.8, 0);
    expect(doors.fill?.total).toBeCloseTo(5684.4, 0);

    const tileNote = `${FIBER} Shower wall tile 180 sqft.`;
    const tiled = price('shower_tile', tileNote);
    expect(tiled.fill?.basis).toMatchObject({ quantity: 180, unit: 'sqft' });
    expect(tiled.fill?.total).toBeCloseTo(4680, 0);
    expect(tiled.fill?.total).not.toBeCloseTo(11262.8, 0);

    const doorNote = `${FIBER} Two shower doors.`;
    const doored = price('glass_door', doorNote);
    expect(doored.fill?.basis).toMatchObject({ quantity: 2, unit: 'each' });
    expect(doored.fill?.total).toBe(2900);

    const placeholder = resolveScopeItemSuggestedPricing(
      'shower_tile',
      {
        floorAreaSqft: 2280,
        showerWallTileSqft: '1',
        itemQuantities: {},
      } as any,
      'ground_up',
      { quantity: 1, unit: 'sqft', quantitySource: 'assumption' },
      { state: 'UT' },
      null,
      FIBER
    );
    expect(placeholder.fill?.total).toBeCloseTo(11262.8, 0);

    const selected = sumConfirmScopeAppliedPricingBreakdown({
      items: [
        { id: 'hvac', label: 'HVAC', inputType: 'yes_no', state: 'included' },
      ] as any,
      templateKey: 'ground_up',
      notes: FIBER,
      measurements: {
        floorAreaSqft: 2280,
        garageSqft: 460,
        scopeNotes: FIBER,
        itemQuantities: {
          hvac__material: {
            quantity: 9034,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
          hvac__labor: {
            quantity: 6266,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
        },
        pricingAcceptance: {
          hvac: {
            selectionStatus: 'accepted',
            totalAmount: 15300,
            materialAmount: 9034,
            laborAmount: 6266,
          },
        },
      } as any,
    });
    expect(
      resolveGroundUpHvacPlanningFill(
        'hvac',
        {
          floorAreaSqft: 2280,
          garageSqft: 460,
          scopeNotes: FIBER,
          itemQuantities: {
            hvac__material: {
              quantity: 9034,
              unit: 'allowance',
              quantitySource: 'calculated',
            },
            hvac__labor: {
              quantity: 6266,
              unit: 'allowance',
              quantitySource: 'calculated',
            },
          },
        } as any,
        'ground_up'
      )
    ).toMatchObject({ total: 16830 });
    expect(selected.total).toBe(16830);

    const typed = sumConfirmScopeAppliedPricingBreakdown({
      items: [
        { id: 'hvac', label: 'HVAC', inputType: 'yes_no', state: 'included' },
      ] as any,
      templateKey: 'ground_up',
      notes: FIBER,
      measurements: {
        floorAreaSqft: 2280,
        garageSqft: 460,
        scopeNotes: FIBER,
        itemQuantities: {
          hvac__material: {
            quantity: 9034,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
          hvac__labor: {
            quantity: 6266,
            unit: 'allowance',
            quantitySource: 'calculated',
          },
        },
        pricingAcceptance: {
          hvac: {
            selectionStatus: 'manual_adjusted',
            totalAmount: 15300,
            materialAmount: 9034,
            laborAmount: 6266,
          },
        },
      } as any,
    });
    expect(typed.total).toBe(15300);
  });
});
