import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { inferDefaultGarageDoorCounts } from '@/utils/exteriorOpeningsPricing';
import {
  drywallPackageSurfacePlanningQuantity,
  resolveDrywallProductionAssemblyBaseline,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import { getQuickMeasurementEstimate } from '@/utils/quickMeasurementEstimates';
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
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';

const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

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
});
