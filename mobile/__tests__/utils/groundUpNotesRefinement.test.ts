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
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { prepareScopeMeasurementsInputForUi } from '@/utils/scopeItemQuantities';
import { quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';
import { confirmScopeDrywallSqftLabel } from '@/utils/drywallNoteScope';
import {
  applyScopeInferencesFromNotes,
  restoreConfirmedChecklistItemStates,
} from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';

const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

const TWO_STORY_STUCCO_NOTES =
  'New 2,450 sqft two-story home with an attached 520 sqft 2-car garage. Stucco exterior. Owner is taking care of landscaping separate from us.';

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
    ).toEqual(['2,800 sqft two-story home', 'Plans / engineering']);
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
});
