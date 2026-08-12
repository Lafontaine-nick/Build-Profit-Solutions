import {
  buildConcreteStructuredMeasurements,
  inferConcreteScopeFromMeasurements,
  normalizeConcreteScalarMeasurements,
} from '@/utils/subcontractorTrade/concretePlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  buildNormalizedScopeMeasurementsFromInput,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('concrete plan convergence', () => {
  it('maps labeled plan flatwork areas into concreteAreaByType', () => {
    const structured = buildConcreteStructuredMeasurements({
      concreteDrivewaySqft: 800,
      concretePatioSqft: 250,
      concreteWalkwaySqft: 140,
    });
    expect(structured.concreteAreaByType).toEqual({
      driveways: 800,
      patios: 250,
      walkways: 140,
    });
    expect(structured.concreteScope).toEqual(
      expect.arrayContaining(['driveways', 'patios', 'walkways', 'pour_flatwork'])
    );
  });

  it('does not infer demo/removal from flatwork alone', () => {
    const scope = inferConcreteScopeFromMeasurements(
      { concreteSqft: 500 },
      { driveways: 500 }
    );
    expect(scope).toEqual(['driveways', 'pour_flatwork']);
    expect(scope).not.toContain('demo_removal');
  });

  it('keeps footing CY separate from flatwork', () => {
    const input = {
      concreteDrivewaySqft: 500,
      concreteCy: 32,
    };
    const structured = buildConcreteStructuredMeasurements(input);
    const scalar = normalizeConcreteScalarMeasurements(input, structured);
    expect(scalar.concreteSqft).toBe(500);
    expect(scalar.concreteCy).toBe(32);
    expect(structured.concreteScope).toEqual(
      expect.arrayContaining(['pour_foundation', 'pour_flatwork', 'driveways'])
    );
  });

  it('only prefills thickness when explicitly supplied', () => {
    const structured = buildConcreteStructuredMeasurements({
      concreteDrivewaySqft: 500,
      concreteDrivewayThicknessInches: 4,
    });
    expect(structured.concreteThicknessByType).toEqual({ driveways: 4 });
  });

  it('matches manual and plan-export pricing for a 500 sqft driveway at 4 in', () => {
    const manualInput = inputWith({
      concreteScope: ['driveways'],
      concreteAreaByType: { driveways: 500 },
      concreteThicknessByType: { driveways: 4 },
      concreteSqft: '500',
    });
    const manualNorm = buildNormalizedScopeMeasurementsFromInput(manualInput, {
      templateKey: 'concrete',
    });
    const planNormalized = normalizeTradeMeasurements(
      'concrete',
      {
        concreteDrivewaySqft: 500,
        concreteDrivewayThicknessInches: 4,
      },
      'plan'
    );
    const planNorm = buildNormalizedScopeMeasurementsFromInput(
      inputWith({
        concreteAreaByType: planNormalized.structuredMeasurements
          ?.concreteAreaByType as ScopeMeasurementsInputExtended['concreteAreaByType'],
        concreteThicknessByType: planNormalized.structuredMeasurements
          ?.concreteThicknessByType as ScopeMeasurementsInputExtended['concreteThicknessByType'],
        concreteScope: planNormalized.structuredMeasurements
          ?.concreteScope as string[],
        concreteSqft: String(planNormalized.measurements.concreteSqft || ''),
      }),
      { templateKey: 'concrete' }
    );

    const manualResolved = resolveChecklistItemQuantity(
      'pour_flatwork',
      manualNorm,
      { templateKey: 'concrete' }
    );
    const planResolved = resolveChecklistItemQuantity('pour_flatwork', planNorm, {
      templateKey: 'concrete',
    });
    const manualPricing = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      manualInput,
      'concrete',
      manualResolved
    );
    const planPricing = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      inputWith({
        concreteDrivewaySqft: 500,
        concreteDrivewayThicknessInches: 4,
        concreteAreaByType: { driveways: 500 },
        concreteThicknessByType: { driveways: 4 },
        concreteSqft: '500',
        concreteScope: ['driveways', 'pour_flatwork'],
      }),
      'concrete',
      planResolved
    );

    expect(manualResolved).toMatchObject({
      quantity: 500,
      unit: 'sqft',
    });
    expect(planResolved).toMatchObject({
      quantity: 500,
      unit: 'sqft',
    });
    expect(planPricing.fill).toMatchObject({
      material: manualPricing.fill?.material,
      labor: manualPricing.fill?.labor,
      total: manualPricing.fill?.total,
      basis: { quantity: 500, unit: 'sqft' },
    });
    expect(planPricing.fill?.total).toBe(5000);
  });

  it('keeps multi-type flatwork, footing, excavation, and rebar independent with parity and persistence', () => {
    const planInput = {
      concreteDrivewaySqft: 800,
      concretePatioSqft: 250,
      concreteWalkwaySqft: 140,
      concreteDrivewayThicknessInches: 4,
      concretePatioThicknessInches: 4,
      concreteWalkwayThicknessInches: 4,
      concreteCy: 32,
      excavationCy: 100,
      concreteReinforcementSqft: 1190,
    };
    const normalized = normalizeTradeMeasurements('concrete', planInput, 'plan');
    expect(normalized.structuredMeasurements?.concreteAreaByType).toEqual({
      driveways: 800,
      patios: 250,
      walkways: 140,
    });
    expect(normalized.structuredMeasurements?.concreteThicknessByType).toEqual({
      driveways: 4,
      patios: 4,
      walkways: 4,
    });
    expect(normalized.measurements.concreteSqft).toBe(1190);
    expect(normalized.measurements.concreteCy).toBe(32);
    expect(normalized.measurements.excavationCy).toBe(100);
    expect(normalized.structuredMeasurements?.concreteScope).toEqual(
      expect.arrayContaining([
        'driveways',
        'patios',
        'walkways',
        'pour_flatwork',
        'pour_foundation',
        'excavation',
        'reinforcement',
      ])
    );
    expect(normalized.structuredMeasurements?.concreteScope).not.toContain(
      'demo_removal'
    );

    const manualInput = inputWith({
      concreteScope: [
        'driveways',
        'patios',
        'walkways',
        'pour_flatwork',
        'pour_foundation',
        'excavation',
        'reinforcement',
      ],
      concreteAreaByType: { driveways: 800, patios: 250, walkways: 140 },
      concreteThicknessByType: { driveways: 4, patios: 4, walkways: 4 },
      concreteSqft: '1190',
      concreteCy: '32',
      excavationCy: '100',
      concreteReinforcementSqft: '1190',
    });
    const manualNorm = buildNormalizedScopeMeasurementsFromInput(manualInput, {
      templateKey: 'concrete',
    });
    const planNorm = buildNormalizedScopeMeasurementsFromInput(
      inputWith({
        concreteAreaByType: normalized.structuredMeasurements
          ?.concreteAreaByType as ScopeMeasurementsInputExtended['concreteAreaByType'],
        concreteThicknessByType: normalized.structuredMeasurements
          ?.concreteThicknessByType as ScopeMeasurementsInputExtended['concreteThicknessByType'],
        concreteScope: normalized.structuredMeasurements?.concreteScope as string[],
        concreteSqft: '1190',
        concreteCy: '32',
        excavationCy: '100',
        concreteReinforcementSqft: '1190',
      }),
      { templateKey: 'concrete' }
    );

    const pricingPairs = [
      ['pour_flatwork', undefined],
      ['pour_foundation', undefined],
      ['excavation', undefined],
      ['reinforcement', undefined],
    ] as const;
    for (const [itemId, choiceId] of pricingPairs) {
      const manualResolved = resolveChecklistItemQuantity(itemId, manualNorm, {
        templateKey: 'concrete',
        choiceId,
      });
      const planResolved = resolveChecklistItemQuantity(itemId, planNorm, {
        templateKey: 'concrete',
        choiceId,
      });
      const manualPricing = resolveScopeItemSuggestedPricing(
        itemId,
        manualInput,
        'concrete',
        manualResolved
      );
      const planPricing = resolveScopeItemSuggestedPricing(
        itemId,
        inputWith({
          concreteAreaByType: { driveways: 800, patios: 250, walkways: 140 },
          concreteThicknessByType: { driveways: 4, patios: 4, walkways: 4 },
          concreteSqft: '1190',
          concreteCy: '32',
          excavationCy: '100',
          concreteReinforcementSqft: '1190',
        }),
        'concrete',
        planResolved
      );
      expect(planResolved).toMatchObject({
        quantity: manualResolved.quantity,
        unit: manualResolved.unit,
      });
      expect(planPricing.fill?.total).toBe(manualPricing.fill?.total);
    }

    const persisted = scopeMeasurementsPayloadForPersist({
      concreteAreaByType: { driveways: 800, patios: 250, walkways: 140 },
      concreteThicknessByType: { driveways: 4, patios: 5, walkways: 6 },
      concreteScope: ['driveways', 'patios', 'walkways', 'pour_flatwork'],
      concreteSqft: 1190,
      concreteCy: 32,
      excavationCy: 100,
      concreteReinforcementSqft: 1190,
    });
    const restored = scopeMeasurementsInputFromPayload(persisted);
    expect(restored.concreteAreaByType).toEqual({
      driveways: 800,
      patios: 250,
      walkways: 140,
    });
    expect(restored.concreteThicknessByType).toEqual({
      driveways: 4,
      patios: 5,
      walkways: 6,
    });
    expect(restored.concreteSqft).toBe('1190');
    expect(restored.concreteCy).toBe('32');
    expect(restored.excavationCy).toBe('100');
    expect(restored.concreteReinforcementSqft).toBe('1190');
  });
});
