/**
 * Plan 58 HVAC regression — architectural-only plan set with vision-only HVAC
 * reads must not present as verified plan takeoff or auto-price.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import { applyPlanImportToDraft, type ScopeMeasurements } from '@/utils/estimateAiDraft';
import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';
import {
  applyHvacProvenanceGuardToScopeMeasurements,
  HVAC_PLAN_QUICK_MEASUREMENT_KEYS,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import {
  groupQuickMeasurementFields,
  resolveQuickMeasurementFields,
} from '@/utils/quickMeasurementProvenance';
import {
  initialScopeMeasurementInputExtended,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
} from '@/utils/scopeItemQuantities';
import { quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';

const PLAN_58_VISION_HVAC_MEASUREMENTS = {
  floorAreaSqft: 3660,
  hvacSystemCount: 2,
  hvacSystemTons: 5,
  hvacDuctworkLf: 150,
  hvacSupplyRegisterCount: 10,
  hvacReturnGrilleCount: 8,
  hvacThermostatCount: 2,
} as const;

const PLAN_58_VISION_HVAC_KEYS = HVAC_PLAN_QUICK_MEASUREMENT_KEYS.filter(
  key => PLAN_58_VISION_HVAC_MEASUREMENTS[key as keyof typeof PLAN_58_VISION_HVAC_MEASUREMENTS] != null
);

function plan58VisionOnlyHvacProvenance() {
  return Object.fromEntries(
    PLAN_58_VISION_HVAC_KEYS.map(key => [
      key,
      {
        value: PLAN_58_VISION_HVAC_MEASUREMENTS[
          key as keyof typeof PLAN_58_VISION_HVAC_MEASUREMENTS
        ],
        source: 'vision_takeoff',
        normalizedSource: 'NEEDS_REVIEW',
        status: 'needs_review',
        pricingEligible: false,
        reason:
          'No mechanical sheets or HVAC schedules in this plan set; confirm this quantity before pricing.',
      },
    ])
  );
}

function buildPlan58HvacDraft() {
  return applyPlanImportToDraft(
    {
      projectTitle: 'SHV Lot 58 HVAC',
      scopeChecklist: {
        templateKey: 'hvac',
        title: 'HVAC — confirm project scope',
        intro: 'Confirm HVAC scope before pricing.',
        items: [
          { id: 'hvac', label: 'HVAC system', state: 'included' },
          { id: 'ductwork', label: 'Ductwork', state: 'included' },
          { id: 'supply_registers', label: 'Supply registers', state: 'included' },
          { id: 'return_grilles', label: 'Return grilles', state: 'included' },
          { id: 'thermostat', label: 'Thermostat', state: 'included' },
        ],
      },
    } as any,
    {
      estimatingMode: 'selected_trade',
      selectedTrade: 'hvac',
      planImportFingerprint: 'shv-lot-58-architectural-only',
      measurements: { ...PLAN_58_VISION_HVAC_MEASUREMENTS },
      planFacts: PLAN_MEASUREMENT_LOTS['58'].facts,
      measurementProvenance: plan58VisionOnlyHvacProvenance(),
      quickMeasurementSources: Object.fromEntries(
        PLAN_58_VISION_HVAC_KEYS.map(key => [key, 'needs_confirmation'])
      ),
    }
  );
}

function hydratePlan58HvacStep2Input() {
  const draft = buildPlan58HvacDraft();
  expect(draft.scopeMeasurements?.hvacSystemCount).toBe(2);
  const guarded = applyHvacProvenanceGuardToScopeMeasurements({
    ...(draft.scopeMeasurements || {}),
  });
  return prepareScopeMeasurementsInputForUi(
    scopeMeasurementsInputFromPayload({
      ...(draft.scopeMeasurements || {}),
      ...guarded,
      quickMeasurementSources: guarded.quickMeasurementSources as
        | ScopeMeasurements['quickMeasurementSources']
        | undefined,
      measurementProvenance: guarded.measurementProvenance as
        | ScopeMeasurements['measurementProvenance']
        | undefined,
    }),
    { templateKey: 'hvac' }
  );
}

describe('SHV Lot 58 HVAC plan import provenance (architectural-only regression)', () => {
  it('keeps vision-only HVAC quantities out of From plan after import → hydration → Step 2', () => {
    const input = hydratePlan58HvacStep2Input();
    const rows = quickMeasurementRowsForTemplate('hvac');
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: [
        'hvac',
        'ductwork',
        'supply_registers',
        'return_grilles',
        'thermostat',
      ],
      templateKey: 'hvac',
    });
    const grouped = groupQuickMeasurementFields(results);

    expect(grouped.fromPlan).toHaveLength(0);
    for (const key of PLAN_58_VISION_HVAC_KEYS) {
      const row = results.find(result => result.key === key);
      expect(row?.filled).toBe(true);
      expect(row?.state).toBe('needs_confirmation');
      expect(grouped.needsConfirmation.some(result => result.key === key)).toBe(
        true
      );
      expect(input.quickMeasurementSources?.[key]).toBe('needs_confirmation');
      expect(
        (input.measurementProvenance as Record<string, unknown> | undefined)?.[
          key
        ]
      ).toMatchObject({
        normalizedSource: 'NEEDS_REVIEW',
        pricingEligible: false,
      });
    }
  });

  it('does not auto-price HVAC cards from unconfirmed Plan 58 vision quantities', () => {
    const input = hydratePlan58HvacStep2Input();
    const pricedItems = [
      'hvac',
      'ductwork',
      'supply_registers',
      'return_grilles',
      'thermostat',
    ] as const;

    for (const itemId of pricedItems) {
      const resolved = resolveChecklistItemQuantity(itemId, input, {
        templateKey: 'hvac',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        itemId,
        input,
        'hvac',
        resolved
      );
      expect(pricing.fill).toBeNull();
    }
  });

  it('still preserves the vision quantities for contractor review in Step 2', () => {
    const input = hydratePlan58HvacStep2Input();
    expect(input).toMatchObject({
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
      hvacReturnGrilleCount: '8',
      hvacThermostatCount: '2',
    });
  });
});
