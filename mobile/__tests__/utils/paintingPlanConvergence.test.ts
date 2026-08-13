import {
  applyPaintPricingMethodChoice,
  buildPaintingPdfMeasurementLines,
  buildPaintingStructuredMeasurements,
  normalizePaintingScalarMeasurements,
  paintingPlanNeedsAreaConfirmation,
  stripConfirmedMeasurementsFromScopeDescription,
} from '@/utils/subcontractorTrade/paintingPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import { filterPlanMeasurementsForTrade } from '@/utils/planImportTradeConfig';
import {
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('painting plan convergence', () => {
  it('maps labeled plan quantities into paintScope without combining walls and ceilings', () => {
    const structured = buildPaintingStructuredMeasurements({
      wallPaintSqft: 5000,
      ceilingPaintSqft: 2000,
      baseboardLf: 800,
      interiorDoorCount: 12,
    });
    expect(structured.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'trim', 'doors'])
    );
    expect(structured.paintPricingMethod).toBe('separate');
    expect(structured.itemQuantities?.interior_paint).toMatchObject({
      quantity: 5000,
      unit: 'sqft',
    });
    expect(structured.itemQuantities?.ceiling_paint).toMatchObject({
      quantity: 2000,
      unit: 'sqft',
    });
    expect(structured.itemQuantities?.prep).toBeUndefined();
  });

  it('does not manufacture occupancy, application method, or prep', () => {
    const structured = buildPaintingStructuredMeasurements({
      wallPaintSqft: 5000,
      ceilingPaintSqft: 2000,
    });
    expect(structured.paintOccupancy).toBeNull();
    expect(structured.paintApplicationMethod).toBeNull();
    expect(structured.paintOccupancyConfirmed).toBeNull();
    expect(structured.paintApplicationMethodConfirmed).toBeNull();
    expect(structured.itemQuantities?.prep).toBeUndefined();
    expect(structured.itemQuantities?.exterior_prep).toBeUndefined();
  });

  it('does not force combined mode from an ambiguous combined area', () => {
    expect(paintingPlanNeedsAreaConfirmation({ paintAreaSqft: 1500 })).toBe(
      true
    );
    const structured = buildPaintingStructuredMeasurements({
      paintAreaSqft: 1500,
    });
    expect(structured.paintPricingMethod).toBeNull();
    expect(structured.paintScope).toBeNull();
    expect(structured.paintAreaNeedsConfirmation).toBe(true);
    const scalar = normalizePaintingScalarMeasurements(
      { paintAreaSqft: 1500 },
      structured
    );
    expect(scalar.paintAreaSqft).toBe(1500);
    expect(scalar.wallPaintSqft).toBeUndefined();
    expect(scalar.ceilingPaintSqft).toBeUndefined();
  });

  it('does not convert floor area into wall paint area', () => {
    const normalized = normalizeTradeMeasurements(
      'painting',
      { floorAreaSqft: 2400, wallPaintSqft: 5000 },
      'plan'
    );
    expect(normalized.measurements.wallPaintSqft).toBe(5000);
    expect(normalized.measurements.floorAreaSqft).toBe(2400);
    expect(normalized.structuredMeasurements?.paintScope).toEqual(['walls']);
  });

  it('matches manual and plan-export pricing for separate walls and ceilings', () => {
    const shared = {
      paintScope: ['walls', 'ceilings'] as const,
      wallPaintSqft: '5000',
      ceilingPaintSqft: '2000',
      paintPricingMethod: 'separate' as const,
      paintOccupancy: 'occupied' as const,
      paintApplicationMethod: 'brush_roll' as const,
    };
    const manualInput = inputWith(shared);
    const planNormalized = normalizeTradeMeasurements(
      'painting',
      {
        wallPaintSqft: 5000,
        ceilingPaintSqft: 2000,
        paintOccupancy: 'occupied',
        paintApplicationMethod: 'brush_roll',
      },
      'plan'
    );
    const planInput = inputWith({
      paintScope: planNormalized.structuredMeasurements
        ?.paintScope as ScopeMeasurementsInputExtended['paintScope'],
      wallPaintSqft: '5000',
      ceilingPaintSqft: '2000',
      paintPricingMethod: 'separate',
      paintOccupancy: 'occupied',
      paintApplicationMethod: 'brush_roll',
    });

    const wallResolved = {
      quantity: 5000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const ceilingResolved = {
      quantity: 2000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const manualWall = resolveScopeItemSuggestedPricing(
      'interior_paint',
      manualInput,
      'painting',
      wallResolved
    );
    const planWall = resolveScopeItemSuggestedPricing(
      'interior_paint',
      planInput,
      'painting',
      wallResolved
    );
    expect(planWall.fill?.total).toBe(manualWall.fill?.total);
    expect(planWall.fill?.material).toBe(manualWall.fill?.material);
    expect(planWall.fill?.labor).toBe(manualWall.fill?.labor);

    const manualCeiling = resolveScopeItemSuggestedPricing(
      'ceiling_paint',
      manualInput,
      'painting',
      ceilingResolved
    );
    const planCeiling = resolveScopeItemSuggestedPricing(
      'ceiling_paint',
      planInput,
      'painting',
      ceilingResolved
    );
    expect(planCeiling.fill?.total).toBe(manualCeiling.fill?.total);
    expect(planCeiling.fill?.material).toBe(manualCeiling.fill?.material);
    expect(planCeiling.fill?.labor).toBe(manualCeiling.fill?.labor);
  });

  it('matches manual and plan-export pricing for doors and trim', () => {
    const shared = {
      paintScope: ['doors', 'trim'] as const,
      interiorDoorCount: '12',
      baseboardLf: '800',
    };
    const manualInput = inputWith(shared);
    const planNormalized = normalizeTradeMeasurements(
      'painting',
      { interiorDoorCount: 12, baseboardLf: 800 },
      'plan'
    );
    const planInput = inputWith({
      paintScope: ['doors', 'trim'],
      interiorDoorCount: '12',
      baseboardLf: '800',
      itemQuantities: planNormalized.structuredMeasurements
        ?.itemQuantities as ScopeMeasurementsInputExtended['itemQuantities'],
    });

    const doorResolved = {
      quantity: 12,
      unit: 'each' as const,
      quantitySource: 'user_entered' as const,
    };
    const trimResolved = {
      quantity: 800,
      unit: 'lf' as const,
      quantitySource: 'user_entered' as const,
    };
    const manualDoors = resolveScopeItemSuggestedPricing(
      'door_paint',
      manualInput,
      'painting',
      doorResolved
    );
    const planDoors = resolveScopeItemSuggestedPricing(
      'door_paint',
      planInput,
      'painting',
      doorResolved
    );
    expect(planDoors.fill?.total).toBe(manualDoors.fill?.total);
    expect(planDoors.fill?.total).toBe(1500);

    const manualTrim = resolveScopeItemSuggestedPricing(
      'trim_paint',
      manualInput,
      'painting',
      trimResolved
    );
    const planTrim = resolveScopeItemSuggestedPricing(
      'trim_paint',
      planInput,
      'painting',
      trimResolved
    );
    expect(planTrim.fill?.total).toBe(manualTrim.fill?.total);
    expect(planTrim.fill?.total).toBe(5600);
  });

  it('matches manual and plan-export pricing for cabinet painting', () => {
    const manualInput = inputWith({
      paintScope: ['cabinets'],
      cabinetRunLf: '50',
    });
    const planInput = inputWith({
      paintScope: ['cabinets'],
      cabinetRunLf: '50',
    });
    const resolved = {
      quantity: 50,
      unit: 'lf' as const,
      quantitySource: 'user_entered' as const,
    };
    const manual = resolveScopeItemSuggestedPricing(
      'cabinet_paint',
      manualInput,
      'painting',
      resolved
    );
    const plan = resolveScopeItemSuggestedPricing(
      'cabinet_paint',
      planInput,
      'painting',
      resolved
    );
    expect(plan.fill?.total).toBe(manual.fill?.total);
    expect(plan.fill?.total).toBeGreaterThan(0);
    expect(plan.fill?.material).toBe(manual.fill?.material);
    expect(plan.fill?.labor).toBe(manual.fill?.labor);
  });

  it('matches manual and plan-export pricing for exterior paint', () => {
    const manualInput = inputWith({
      paintScope: ['exterior'],
      exteriorPaintSqft: '2000',
    });
    const planInput = inputWith({
      paintScope: ['exterior'],
      exteriorPaintSqft: '2000',
    });
    const resolved = {
      quantity: 2000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const manual = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      manualInput,
      'painting',
      resolved
    );
    const plan = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      planInput,
      'painting',
      resolved
    );
    expect(plan.fill?.total).toBe(manual.fill?.total);
    expect(plan.fill?.total).toBe(6300);
    expect(plan.fill?.material).toBe(manual.fill?.material);
    expect(plan.fill?.labor).toBe(manual.fill?.labor);
  });

  it('keeps interior and exterior quantities independent', () => {
    const normalized = normalizeTradeMeasurements(
      'painting',
      {
        wallPaintSqft: 5000,
        ceilingPaintSqft: 2000,
        exteriorPaintSqft: 3800,
        cabinetRunLf: 50,
      },
      'plan'
    );
    expect(normalized.measurements.wallPaintSqft).toBe(5000);
    expect(normalized.measurements.ceilingPaintSqft).toBe(2000);
    expect(normalized.measurements.exteriorPaintSqft).toBe(3800);
    expect(normalized.measurements.cabinetRunLf).toBe(50);
    expect(normalized.structuredMeasurements?.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'cabinets', 'exterior'])
    );
    expect(normalized.structuredMeasurements?.paintScope).not.toContain('trim');
  });

  it('persists and reloads painting convergence fields', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      inputWith({
        paintScope: ['walls', 'ceilings', 'trim', 'doors', 'cabinets', 'exterior'],
        wallPaintSqft: '5000',
        ceilingPaintSqft: '2000',
        baseboardLf: '800',
        interiorDoorCount: '12',
        cabinetRunLf: '50',
        exteriorPaintSqft: '2000',
        paintPricingMethod: 'separate',
        paintOccupancy: 'occupied',
        paintApplicationMethod: 'brush_roll',
        itemQuantities: {
          interior_paint: { quantity: '5000', unit: 'sqft' },
          ceiling_paint: { quantity: '2000', unit: 'sqft' },
        },
      })
    );
    expect(persisted.wallPaintSqft).toBe(5000);
    expect(persisted.ceilingPaintSqft).toBe(2000);
    expect(persisted.baseboardLf).toBe(800);
    expect(persisted.interiorDoorCount).toBe(12);
    expect(persisted.cabinetRunLf).toBe(50);
    expect(persisted.exteriorPaintSqft).toBe(2000);
    expect(persisted.paintPricingMethod).toBe('separate');
    const restored = scopeMeasurementsInputFromPayload(persisted);
    expect(restored.wallPaintSqft).toBe('5000');
    expect(restored.ceilingPaintSqft).toBe('2000');
    expect(restored.interiorDoorCount).toBe('12');
    expect(restored.cabinetRunLf).toBe('50');
    expect(restored.exteriorPaintSqft).toBe('2000');
    expect(restored.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'exterior'])
    );
    expect(restored.itemQuantities?.interior_paint?.quantity).toBe('5000');
  });

  it('persists combined paintable area and trim/door/cabinet quantities for PDF export', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      inputWith({
        paintScope: ['walls', 'ceilings', 'trim', 'doors', 'cabinets', 'exterior'],
        combinedPaintableAreaSqft: '1500',
        paintAreaSqft: '1500',
        paintPricingMethod: 'combined',
        baseboardLf: '200',
        interiorDoorCount: '6',
        cabinetRunLf: '25',
        exteriorPaintSqft: '2000',
      }),
      { templateKey: 'painting' }
    );
    expect(persisted.combinedPaintableAreaSqft).toBe(1500);
    expect(persisted.baseboardLf).toBe(200);
    expect(persisted.interiorDoorCount).toBe(6);
    expect(persisted.cabinetRunLf).toBe(25);
    expect(persisted.exteriorPaintSqft).toBe(2000);
    expect(persisted.itemQuantities?.interior_paint).toMatchObject({
      quantity: 1500,
      unit: 'sqft',
    });
    expect(persisted.itemQuantities?.trim_paint).toMatchObject({
      quantity: 200,
      unit: 'lf',
    });
    expect(persisted.itemQuantities?.door_paint).toMatchObject({
      quantity: 6,
      unit: 'each',
    });
    expect(persisted.itemQuantities?.cabinet_paint).toMatchObject({
      quantity: 25,
      unit: 'lf',
    });
    expect(persisted.itemQuantities?.exterior_paint).toMatchObject({
      quantity: 2000,
      unit: 'sqft',
    });
  });

  it('applies painting job notes without throwing on mergedScopeMeasurements', () => {
    const notes =
      'Interior repaint of approximately 1,500 square feet. Paint all interior walls and ceilings with two coats. Paint 200 linear feet of baseboards and trim, plus 6 interior doors and frames. Paint 200 square feet of existing kitchen cabinets. Include final touch-ups, cleanup, and disposal. No exterior painting.';
    const next = repairDraftRatePricingFromNotes(
      {
        projectType: 'painting',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'painting', items: [] },
        rooms: [],
        inclusions: [],
        exclusions: [],
        missingInfo: [],
        pricingWarnings: [],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(next.scopeMeasurements?.baseboardLf).toBe(200);
    expect(next.scopeMeasurements?.interiorDoorCount).toBe(6);
    expect(next.scopeMeasurements?.cabinetPaintSqft).toBe(200);
  });

  it('builds PDF measurement card rows from confirmed painting takeoff', () => {
    const lines = buildPaintingPdfMeasurementLines({
      combinedPaintableAreaSqft: '1500',
      paintPricingMethod: 'combined',
      baseboardLf: 200,
      interiorDoorCount: 6,
      cabinetPaintSqft: 200,
      exteriorPaintSqft: 2000,
    });
    expect(lines).toEqual([
      { label: 'Combined paintable area', quantity: '1,500 sqft' },
      { label: 'Baseboard / trim', quantity: '200 LF' },
      { label: 'Interior doors', quantity: '6 each' },
      { label: 'Cabinet paint area', quantity: '200 sqft' },
      { label: 'Exterior paint', quantity: '2,000 sqft' },
    ]);
  });

  it('strips confirmed measurements from scope text for the PDF card', () => {
    const stripped = stripConfirmedMeasurementsFromScopeDescription(
      [
        'Interior and exterior paint',
        'Confirmed measurements\n• Combined paintable area: 1,500 sqft\n• Baseboard / trim: 200 LF',
      ].join('\n\n')
    );
    expect(stripped.description).toBe('Interior and exterior paint');
    expect(stripped.measurementLines).toEqual([
      { label: 'Combined paintable area', quantity: '1,500 sqft' },
      { label: 'Baseboard / trim', quantity: '200 LF' },
    ]);
  });

  it('keeps geometry-derived Painting keys through filter → convergence → Confirm Scope', () => {
    const backendAfterSanitize = {
      wallPaintSqft: 1998,
      ceilingPaintSqft: 650,
      interiorDoorCount: 12,
      baseboardLf: 222,
      floorAreaSqft: 2000,
    };
    const filtered = filterPlanMeasurementsForTrade(
      backendAfterSanitize,
      'selected_trade',
      'painting'
    );
    expect(filtered).toEqual({
      wallPaintSqft: 1998,
      ceilingPaintSqft: 650,
      interiorDoorCount: 12,
      baseboardLf: 222,
    });
    const normalized = normalizeTradeMeasurements('painting', filtered, 'plan');
    expect(normalized.measurements.wallPaintSqft).toBe(1998);
    expect(normalized.measurements.ceilingPaintSqft).toBe(650);
    expect(normalized.measurements.interiorDoorCount).toBe(12);
    expect(normalized.measurements.baseboardLf).toBe(222);
    expect(normalized.structuredMeasurements?.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'trim', 'doors'])
    );
    expect(normalized.structuredMeasurements?.paintOccupancy).toBeUndefined();
    expect(normalized.measurementProvenance?.wallPaintSqft).toBe('FROM_PLAN');
  });

  it('keeps wall and ceiling quantities when toggling combined then separate', () => {
    const separate = {
      wallPaintSqft: '4918.2',
      ceilingPaintSqft: '1345.2',
      paintPricingMethod: 'separate' as const,
    };
    const combined = applyPaintPricingMethodChoice(separate, 'combined');
    expect(combined.paintPricingMethod).toBe('combined');
    expect(combined.combinedPaintableAreaSqft).toBe('6263.4');
    expect(combined.wallPaintSqft).toBe('4918.2');
    expect(combined.ceilingPaintSqft).toBe('1345.2');

    const backToSeparate = applyPaintPricingMethodChoice(combined, 'separate');
    expect(backToSeparate.paintPricingMethod).toBe('separate');
    expect(backToSeparate.wallPaintSqft).toBe('4918.2');
    expect(backToSeparate.ceilingPaintSqft).toBe('1345.2');
    expect(backToSeparate.paintAreaBasis).toBeNull();
  });

  it('restores a stashed wall/ceiling split if combined had already cleared them', () => {
    const restored = applyPaintPricingMethodChoice(
      {
        wallPaintSqft: '',
        ceilingPaintSqft: '',
        combinedPaintableAreaSqft: '6263.4',
        paintPricingMethod: 'combined',
        paintAreaBasis: 'combined',
      },
      'separate',
      { wall: '4918.2', ceiling: '1345.2' }
    );
    expect(restored.wallPaintSqft).toBe('4918.2');
    expect(restored.ceilingPaintSqft).toBe('1345.2');
    expect(restored.paintPricingMethod).toBe('separate');
  });
});
