import { BUILD_WITH_AI_GOLDEN_FIXTURES } from '@/__tests__/fixtures/buildWithAiGoldenFixtures';
import {
  buildAcceptanceFromSuggestedBlock,
  getPricingSecondaryAction,
  getPricingSourceMessage,
  hasAcceptedScopePricing,
  resolveAcceptedPricingDisplay,
  shouldHideSuggestedPanel,
} from '@/utils/acceptedPricingSummaryUi';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildNormalizedScopeMeasurementsFromInput,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';

function inputWith(fields: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  };
}

function simulateAcceptSuggestedPricing(itemId: string, block: NonNullable<ReturnType<typeof resolveScopeItemSuggestedPricing>['fill']>) {
  const acceptance = buildAcceptanceFromSuggestedBlock(block);
  const allowanceKey = `${itemId}__allowance`;
  return {
    acceptance,
    itemQuantities: {
      [allowanceKey]: {
        quantity: String(block.total),
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
      [itemId]: {
        quantity: String(block.basis?.quantity ?? block.total),
        unit: block.basis?.unit || 'allowance',
        quantitySource: 'user_entered' as const,
      },
    },
    pricingAcceptance: { [itemId]: acceptance },
  };
}

describe('Build with AI scenario pricing', () => {
  describe('flat allowance — permits / fees', () => {
    it('suggests $3,500 national-average permit allowance before acceptance', () => {
      const input = inputWith({});
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'addition' });
      const resolved = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'addition' });

      expect(resolved.pricingReady).toBe(false);

      const { fill } = resolveScopeItemSuggestedPricing('permits', input, 'addition', resolved);
      expect(fill).toMatchObject({
        lumpSumOnly: true,
        material: 0,
        labor: 3500,
        total: 3500,
        materialSource: 'national_average',
        laborSource: 'national_average',
      });
    });

    it('marks permits priced and preserves national-average metadata after acceptance', () => {
      const input = inputWith({});
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'addition' });
      const resolvedBefore = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'addition' });
      const { fill } = resolveScopeItemSuggestedPricing('permits', input, 'addition', resolvedBefore);
      expect(fill).not.toBeNull();

      const accepted = simulateAcceptSuggestedPricing('permits', fill!);
      const inputAfter = inputWith({
        itemQuantities: accepted.itemQuantities,
        pricingAcceptance: accepted.pricingAcceptance,
      });
      const measurementsAfter = buildNormalizedScopeMeasurementsFromInput(inputAfter, { templateKey: 'addition' });
      const resolvedAfter = resolveChecklistItemQuantity('permits', measurementsAfter, { templateKey: 'addition' });

      expect(resolvedAfter).toMatchObject({
        pricingReady: true,
        quantity: 3500,
        unit: 'allowance',
      });

      const display = resolveAcceptedPricingDisplay({
        itemId: 'permits',
        resolved: resolvedAfter,
        acceptance: accepted.pricingAcceptance.permits,
        suggestedBlock: fill,
        intelligence: {
          scopeItemKey: 'permits',
          pricing: { source: 'national_average', confidence: 'low', confidenceLabel: 'Low confidence', reason: '' },
          quantity: { source: 'user_entered', sourceLabel: 'User entered', confidence: 'high', confidenceLabel: 'High confidence', reason: '' },
          validation: { status: 'ready', issues: [] },
        } as any,
      });

      expect(display.selectionStatusLabel).toBe('Applied');
      expect(display.pricingSourceLabel).toBe('BPS national benchmark');
      expect(display.totalLabel).toBe('$3,500');
      expect(display.warningMessage).toBe(
        'Based on national average pricing. Review before sending the estimate.'
      );
      expect(getPricingSecondaryAction({
        display,
        intelligence: {
          scopeItemKey: 'permits',
          pricing: { source: 'national_average', confidence: 'low', confidenceLabel: 'Low confidence', reason: '' },
          quantity: { source: 'user_entered', sourceLabel: 'User entered', confidence: 'high', confidenceLabel: 'High confidence', reason: '' },
          validation: { status: 'ready', issues: [] },
        } as any,
        resolved: resolvedAfter,
        suggestedBlock: fill,
        scopeKey: 'permits',
      })).toBeNull();
      expect(
        shouldHideSuggestedPanel({
          itemId: 'permits',
          itemQuantities: accepted.itemQuantities,
          pricingAcceptance: accepted.pricingAcceptance,
        })
      ).toBe(true);
    });
  });

  describe('unit pricing — flooring', () => {
    it('prices 1,000 sqft LVP at national average ($4 material + $5 labor = $9,000)', () => {
      const input = inputWith({ floorAreaSqft: '1000' });
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'flooring' });
      const resolved = resolveChecklistItemQuantity('flooring', measurements, { templateKey: 'flooring' });

      const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
      expect(fill).toMatchObject({
        mode: 'suggested_price',
        material: 4000,
        labor: 5000,
        total: 9000,
        basis: { quantity: 1000, unit: 'sqft' },
      });
    });

    it('uses saved template rates when available instead of national average', () => {
      const input = inputWith({ floorAreaSqft: '1000' });
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'flooring' });
      const resolved = resolveChecklistItemQuantity('flooring', measurements, { templateKey: 'flooring' });
      const pricingContext: ScopePricingContext = {
        templates: [
          {
            name: 'LVP Floors',
            materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 6 }],
            laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
          },
        ],
      };

      const { fill } = resolveScopeItemSuggestedPricing(
        'flooring',
        input,
        'flooring',
        resolved,
        pricingContext
      );
      expect(fill).toMatchObject({ material: 6000, labor: 4000, total: 10000 });
      expect(fill?.materialSource).toBe('template');
    });
  });

  describe('notes-priced lump sums', () => {
    it('splits a $5,000 flooring note total using national material/labor ratio', () => {
      const input = inputWith({ floorAreaSqft: '1000' });
      const resolved = {
        quantity: 5000,
        unit: 'allowance',
        quantitySource: 'notes' as const,
        dualAllowance: { quantity: 5000, unit: 'allowance' },
      };
      const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
      expect(fill).toMatchObject({ mode: 'note_total_split', material: 4000, labor: 1000, total: 5000 });
    });
  });

  describe('kitchen remodel pricing basis', () => {
    it('prefers kitchen floor sqft over whole-home floor area for kitchen template flooring', () => {
      const input = inputWith({
        floorAreaSqft: '800',
        kitchenFloorSqft: '220',
      });
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'kitchen' });
      const resolved = resolveChecklistItemQuantity('flooring', measurements, { templateKey: 'kitchen' });

      expect(resolved.quantity).toBe(220);
      expect(resolved.unit).toBe('sqft');
    });
  });

  describe('golden fixture totals', () => {
    it.each([
      ['kitchen_remodel', 20500],
      ['electrical_service', 3600],
      ['hvac_replacement', 9800],
    ] as const)('documents expected total for %s scenario', (key, expectedTotal) => {
      const fixture = BUILD_WITH_AI_GOLDEN_FIXTURES.find((entry) => entry.key === key);
      expect(fixture?.expectedTotalRange).toEqual({ low: expectedTotal, high: expectedTotal });
    });
  });

  describe('cleanup flat allowance', () => {
    it('suggests $1,000 cleanup allowance as lump-sum only', () => {
      const input = inputWith({});
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'addition' });
      const resolved = resolveChecklistItemQuantity('cleanup', measurements, { templateKey: 'addition' });
      const { fill } = resolveScopeItemSuggestedPricing('cleanup', input, 'addition', resolved);

      expect(fill).toMatchObject({
        lumpSumOnly: true,
        total: 1000,
        material: 0,
        labor: 1000,
      });
    });
  });

  describe('concrete CY pricing', () => {
    it('prices 18 CY concrete at national CY rates ($330/CY total split)', () => {
      const input = inputWith({ concreteCy: '18' });
      const measurements = buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'addition' });
      const resolved = resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'addition' });

      expect(resolved.unit).toBe('cy');

      const { fill } = resolveScopeItemSuggestedPricing('concrete', input, 'addition', resolved);
      expect(fill).toMatchObject({
        material: 2970,
        labor: 3330,
        total: 6300,
        basis: { quantity: 18, unit: 'cy' },
      });
    });
  });

  describe('user-entered pricing', () => {
    it('does not show a source warning for purely user-entered lump sums', () => {
      const acceptance = {
        selectionStatus: 'user_entered' as const,
        pricingSourceLabel: 'User entered',
        pricingSourceKind: 'user_entered' as const,
        pricingTypeLabel: 'Lump sum',
        totalAmount: 12000,
      };
      expect(
        getPricingSourceMessage(
          { validation: { status: 'ready', issues: [] } } as any,
          acceptance
        )
      ).toBeNull();
    });
  });

  describe('accepted pricing detection', () => {
    it('detects complete user-selected pricing across allowance subkeys', () => {
      const itemQuantities = {
        permits__allowance: { quantity: '3500', unit: 'allowance', quantitySource: 'user_entered' as const },
      };
      expect(hasAcceptedScopePricing('permits', itemQuantities)).toBe(true);
    });
  });
});
