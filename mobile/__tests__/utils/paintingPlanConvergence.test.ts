import {
  applyPaintPricingMethodChoice,
  buildPaintingPdfMeasurementLines,
  buildPaintingStructuredMeasurements,
  ensurePaintingPlanChecklistItems,
  paintingPlanAssumesNewConstruction,
  paintingPlanSurfaceSettled,
  keepPaintingBidOnPaintOnly,
  exteriorPaintSqftFromElevationFaces,
  normalizePaintingScalarMeasurements,
  paintingPlanNeedsAreaConfirmation,
  restorePaintingPlanSurfaceFields,
  stripConfirmedMeasurementsFromScopeDescription,
} from '@/utils/subcontractorTrade/paintingPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  filterChecklistItemsForTrade,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} from '@/utils/planImportTradeConfig';
import {
  lookupRuleKeyForPackage,
  countScopePricingReadiness,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import {
  confirmScopeGroupPricingTemplateKey,
  confirmScopeUsesGroundUpHousePricing,
  listConfirmScopeAppliedPricingLines,
  paintingConfirmScopePriceIsCommitted,
  wholeProjectGroupDisplayTotal,
} from '@/utils/benchmarkReasonablenessContext';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  scopePackagePricedAmount,
  scopePackageReviewUnpricedLabel,
} from '@/utils/estimateDraftReviewUi';
import { blendBarometerLump } from '@/utils/builderBudgetLumpBlend';
import {
  INTERIOR_PAINT_INSTALLED_BY_PROJECT,
  INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL,
} from '@/utils/southernUtahPaintTrimComparables';
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
  it('keeps wall and ceiling paint and drops door installation on a painting plan bid', () => {
    const filtered = filterChecklistItemsForTrade(
      [
        { id: 'interior_door_install', noteBacked: true },
        { id: 'baseboard_install', noteBacked: true },
        { id: 'door_paint' },
        { id: 'trim_paint' },
        { id: 'ceiling_paint' },
        { id: 'prep' },
      ],
      'selected_trade',
      'painting'
    );
    const items = ensurePaintingPlanChecklistItems(filtered, {
      wallPaintSqft: '3734',
      ceilingPaintSqft: '2571',
    });
    expect(items.map(item => item.id)).toEqual([
      'interior_paint',
      'ceiling_paint',
      'prep',
      'exterior_paint',
      'exterior_prep',
      'trim_paint',
      'door_paint',
      'exterior_door_paint',
    ]);
  });

  it('puts stucco elevation area on the exterior paint card and deducts openings', () => {
    expect(
      exteriorPaintSqftFromElevationFaces([
        {
          finish: 'stucco',
          widthFt: 40,
          heightFt: 10,
          windowDoorOpeningsSqft: 80,
          garageOpeningsSqft: 120,
        },
        { finish: 'brick', widthFt: 20, heightFt: 10 },
        { finish: 'siding', paintAreaSqft: 320 },
      ])
    ).toBe(520);

    const restored = restorePaintingPlanSurfaceFields({
      planImportTradeKey: 'painting',
      wallPaintSqft: '3734',
      ceilingPaintSqft: '2571',
      planFacts: {
        elevationFaces: [
          {
            finish: 'stucco',
            stuccoAreaSqft: 1800,
            windowDoorOpeningsSqft: 200,
          },
        ],
      },
    });
    expect(restored.exteriorPaintSqft).toBe('1600');
    expect(restored.quickMeasurementSources?.exteriorPaintSqft).toBe(
      'needs_confirmation'
    );
    expect(restored.itemQuantities?.exterior_paint).toMatchObject({
      quantity: '1600',
      unit: 'sqft',
      quantitySource: 'plan_vision',
    });
    const items = ensurePaintingPlanChecklistItems(
      [{ id: 'exterior_paint', state: 'unsure' }, { id: 'interior_paint' }],
      restored
    );
    expect(items.find(item => item.id === 'exterior_paint')).toMatchObject({
      state: 'included',
    });
  });

  it('keeps a painting bid on door paint and leaves door installation off', () => {
    const source = [
      { id: 'exterior_doors', state: 'included' },
      { id: 'interior_door_install', state: 'included' },
      { id: 'exterior_paint', state: 'unsure' },
      { id: 'exterior_door_paint', state: 'included' },
      { id: 'door_paint', state: 'included' },
      { id: 'trim_paint', state: 'included' },
    ];
    const items = keepPaintingBidOnPaintOnly(source);
    expect(items.map(item => item.id)).toEqual([
      'exterior_paint',
      'exterior_door_paint',
      'door_paint',
      'trim_paint',
    ]);
    expect(items.find(item => item.id === 'exterior_paint')).toMatchObject({
      state: 'included',
      label: 'Exterior house paint',
    });
    const replacedDoors = keepPaintingBidOnPaintOnly(
      source,
      'Replace 3 interior doors and paint the ceilings.'
    );
    expect(replacedDoors.map(item => item.id)).toContain(
      'interior_door_install'
    );
    expect(replacedDoors.map(item => item.id)).not.toContain('exterior_doors');
    const paintedOnly = keepPaintingBidOnPaintOnly(
      source,
      'Paint the doors and walls.'
    );
    expect(paintedOnly.map(item => item.id)).not.toContain(
      'interior_door_install'
    );
  });

  it('restores plan wall and ceiling areas and prices interior masking from those surfaces', () => {
    const restored = restorePaintingPlanSurfaceFields({
      planImportTradeKey: 'painting',
      wallPaintSqft: '',
      ceilingPaintSqft: '',
      itemQuantities: {
        ceiling_paint: { quantity: '2571' },
        prep: { quantity: '6305' },
      },
    });
    expect(restored.wallPaintSqft).toBe('3734');
    expect(restored.ceilingPaintSqft).toBe('2571');

    const fromReview = restorePaintingPlanSurfaceFields({
      planImportTradeKey: 'painting',
      wallPaintSqft: '',
      ceilingPaintSqft: '2571',
      baseboardLf: '410.3',
      interiorDoorCount: '17',
      planFacts: { plateHeightFt: 9.1 },
      measurementProvenance: {
        interiorDoorCount: {
          value: 18,
          source: 'contractor_confirmed_from_plan_review',
          normalizedSource: 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
        },
      },
    });
    expect(fromReview.wallPaintSqft).toBe('3734');
    expect(fromReview.quickMeasurementSources?.wallPaintSqft).toBe(
      'contractor_confirmed_from_plan_review'
    );
    expect(fromReview.interiorDoorCount).toBe('18');

    const withoutPlateHeight = restorePaintingPlanSurfaceFields({
      planImportTradeKey: 'painting',
      wallPaintSqft: '',
      ceilingPaintSqft: '2571',
      baseboardLf: '410.3',
      interiorDoorCount: '17',
    });
    expect(withoutPlateHeight.wallPaintSqft).toBe('3734');
    expect(withoutPlateHeight.quickMeasurementSources?.wallPaintSqft).toBe(
      'contractor_confirmed_from_plan_review'
    );
    expect(withoutPlateHeight.quickMeasurementSources?.ceilingPaintSqft).toBe(
      'needs_confirmation'
    );
    expect(withoutPlateHeight.itemQuantities?.interior_paint).toMatchObject({
      quantity: '3734',
      quantitySource: 'plan_vision',
    });
    const exteriorDoors = restorePaintingPlanSurfaceFields({
      planImportTradeKey: 'painting',
      ceilingPaintSqft: '2571',
      baseboardLf: '410.3',
      exteriorDoorCount: '5',
    });
    expect(exteriorDoors.exteriorDoorCount).toBe('4');
    expect(exteriorDoors.quickMeasurementSources?.exteriorDoorCount).toBe(
      'contractor_confirmed_from_plan_review'
    );

    const persisted = scopeMeasurementsPayloadForPersist(
      inputWith({
        planImportTradeKey: 'painting',
        paintPricingMethod: 'separate',
        wallPaintSqft: '3734',
        ceilingPaintSqft: '2571',
        itemQuantities: {
          prep: { quantity: '6305', unit: 'sqft', quantitySource: 'user_entered' },
        },
      }),
      { templateKey: 'painting' }
    );
    expect(persisted.itemQuantities?.interior_paint).toMatchObject({
      quantity: 3734,
      quantitySource: 'plan_vision',
    });
    expect(persisted.itemQuantities?.ceiling_paint).toMatchObject({
      quantity: 2571,
      quantitySource: 'plan_vision',
    });
    expect(persisted.itemQuantities?.prep).toBeUndefined();

    const prep = resolveScopeItemSuggestedPricing(
      'prep',
      inputWith({
        planImportTradeKey: 'painting',
        wallPaintSqft: '3734',
        ceilingPaintSqft: '2571',
      }),
      'painting',
      {
        quantity: 6305,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(prep.fill?.total).toBe(1576.25);
    expect(prep.fill?.basis).toMatchObject({ quantity: 6305, unit: 'sqft' });
    const exteriorMasking = resolveScopeItemSuggestedPricing(
      'exterior_prep',
      inputWith({
        planImportTradeKey: 'painting',
        exteriorPaintSqft: '3000',
      }),
      'painting',
      {
        quantity: 3000,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(exteriorMasking.fill?.total).toBe(600);
  });

  it('prices a matched painting plan as one installed package', () => {
    const measurements = inputWith({
      planImportTradeKey: 'painting',
      ceilingPaintSqft: '2571',
      wallPaintSqft: '3734',
      baseboardLf: '410.3',
      interiorDoorCount: '17',
    });
    const expected = blendBarometerLump(
      INTERIOR_PAINT_INSTALLED_BY_PROJECT.lot49,
      INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL
    );
    const priced = ['interior_paint', 'ceiling_paint', 'trim_paint', 'door_paint'].map(
      itemId =>
        resolveScopeItemSuggestedPricing(itemId, measurements, 'painting', {
          quantity: 3734,
          unit: 'sqft',
          quantitySource: 'plan_vision',
        }).fill?.total || 0
    );
    expect(priced.reduce((sum, amount) => sum + amount, 0)).toBe(expected);
    expect(priced.every(amount => amount > 0)).toBe(true);
    const walls = resolveScopeItemSuggestedPricing(
      'interior_paint',
      measurements,
      'painting',
      { quantity: 3734, unit: 'sqft', quantitySource: 'plan_vision' }
    );
    expect(walls.fill?.helper).toMatch(/installed paint package/i);
    expect(walls.fill?.displayUnitRateLabel).toMatch(/installed paint package/i);
    expect(
      Math.round(((walls.fill?.material || 0) + (walls.fill?.labor || 0)) * 100) / 100
    ).toBe(Math.round((walls.fill?.total || 0) * 100) / 100);
    expect(walls.fill?.material || 0).toBeGreaterThan(0);
    expect(walls.fill?.labor || 0).toBeGreaterThan(0);
    expect(walls.fill?.costBuckets?.some(bucket => bucket.key === 'allowance')).toBe(false);
  });

  it('keeps a painting plan on the painting card when the house is large enough for a whole-house bid', () => {
    expect(
      confirmScopeGroupPricingTemplateKey({
        singleTradePlanImport: true,
        scopePricingTemplateKey: 'painting',
        wholeHouseLivingSqft: 2571,
        wholeHouseGarageSqft: 400,
      })
    ).toBe('painting');
    expect(
      confirmScopeUsesGroundUpHousePricing({
        singleTradePlanImport: true,
        scopePricingTemplateKey: 'painting',
        wholeHouseLivingSqft: 2571,
        wholeHouseGarageSqft: 400,
      })
    ).toBe(false);
    expect(
      confirmScopeGroupPricingTemplateKey({
        scopePricingTemplateKey: 'ground_up',
        wholeHouseLivingSqft: 2571,
        wholeHouseGarageSqft: 400,
      })
    ).toBe('ground_up');

    const measurements = inputWith({
      planImportTradeKey: 'painting',
      ceilingPaintSqft: '2571',
      wallPaintSqft: '3734',
      baseboardLf: '410.3',
      interiorDoorCount: '18',
      floorAreaSqft: '2571',
      garageSqft: '400',
      itemQuantities: {
        interior_paint__material: {
          quantity: '3257',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        interior_paint__labor: {
          quantity: '9252',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        interior_paint: {
          selectionStatus: 'accepted',
          totalAmount: 12509,
          materialAmount: 3257,
          laborAmount: 9252,
          pricingSourceKind: 'national_average',
          pricingSourceLabel: 'Selected',
          pricingTypeLabel: 'Material + labor',
        },
      },
    });
    const card = resolveScopeItemSuggestedPricing('interior_paint', measurements, 'painting', {
      quantity: 3734,
      unit: 'sqft',
      quantitySource: 'plan_vision',
    });
    const cardTotal = Number(card.fill?.total || 0);
    expect(cardTotal).toBeGreaterThan(0);
    expect(cardTotal).not.toBe(Math.round(3734 * 3.35));
    const items = [
      {
        id: 'interior_paint',
        label: 'Interior paint — walls',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
    ];
    expect(
      listConfirmScopeAppliedPricingLines({
        items,
        measurements,
        templateKey: 'painting',
      }).some(line => line.itemId === 'interior_paint')
    ).toBe(false);
    expect(
      paintingConfirmScopePriceIsCommitted({
        itemId: 'interior_paint',
        measurements,
        templateKey: 'painting',
      })
    ).toBe(false);
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements,
        templateKey: 'painting',
      })
    ).toBe(Math.round(cardTotal * 100) / 100);

    const committed = inputWith({
      ...measurements,
      itemQuantities: {
        interior_paint__material: {
          quantity: String(card.fill?.material || 0),
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        interior_paint__labor: {
          quantity: String(card.fill?.labor || 0),
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        interior_paint: {
          selectionStatus: 'accepted',
          totalAmount: cardTotal,
          materialAmount: Number(card.fill?.material || 0),
          laborAmount: Number(card.fill?.labor || 0),
          pricingSourceKind: 'national_average',
          pricingSourceLabel: 'Selected',
          pricingTypeLabel: 'Material + labor',
        },
      },
    });
    const committedLines = listConfirmScopeAppliedPricingLines({
      items,
      measurements: committed,
      templateKey: 'painting',
    });
    expect(committedLines.map(line => line.total)).toEqual([
      Math.round(cardTotal * 100) / 100,
    ]);
    expect(
      paintingConfirmScopePriceIsCommitted({
        itemId: 'interior_paint',
        measurements: committed,
        templateKey: 'painting',
      })
    ).toBe(true);
  });

  it('treats a new-build painting plan as new construction and keeps prep in the package', () => {
    const plan = {
      planImportMode: 'selected_trade',
      planImportTradeKey: 'painting',
      planImportFingerprint: 'painting-plan',
      wallPaintSqft: '5000',
      ceilingPaintSqft: '2600',
      paintScope: ['walls', 'ceilings', 'trim', 'doors', 'exterior'],
      exteriorDoorCount: '7',
    };
    expect(paintingPlanAssumesNewConstruction(plan)).toBe(true);
    expect(
      paintingPlanAssumesNewConstruction(plan, 'repaint the occupied house')
    ).toBe(false);
    expect(
      paintingPlanAssumesNewConstruction({
        ...plan,
        paintOccupancy: 'occupied',
        paintOccupancyConfirmed: true,
      })
    ).toBe(false);
    expect(paintingPlanSurfaceSettled('interior_paint', plan)).toBe(true);
    expect(paintingPlanSurfaceSettled('exterior_door_paint', plan)).toBe(true);
    expect(paintingPlanSurfaceSettled('prep', plan)).toBe(false);
    const masked = resolveScopeItemSuggestedPricing(
      'prep',
      inputWith(plan),
      'painting',
      { quantity: 7600.3, unit: 'sqft', quantitySource: 'plan_detected' }
    );
    expect(masked.fill).toBeNull();
    const occupied = resolveScopeItemSuggestedPricing(
      'prep',
      inputWith({
        ...plan,
        paintOccupancy: 'occupied',
        paintOccupancyConfirmed: true,
      }),
      'painting',
      { quantity: 7600.3, unit: 'sqft', quantitySource: 'plan_detected' }
    );
    expect(occupied.fill?.total).toBe(1900);
    const readiness = countScopePricingReadiness(
      [
        { id: 'interior_paint', state: 'included' },
        { id: 'exterior_paint', state: 'included' },
        { id: 'exterior_prep', state: 'included' },
      ],
      inputWith({ ...plan, wallPaintSqft: '5029.3', exteriorPaintSqft: '' }),
      'painting'
    );
    expect(readiness.needsMeasurement).toBe(1);
  });

  it('lists the paint bid on scope found and only asks for the missing elevation', () => {
    const draft = {
      originalNotes: '',
      scopeAssumptionsConfirmed: false,
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'painting',
        planImportFingerprint: 'painting-plan',
        floorAreaSqft: '2571',
        storyCount: '2',
        wallPaintSqft: '3734',
        ceilingPaintSqft: '2571',
        baseboardLf: '410.3',
        interiorDoorCount: '18',
        exteriorDoorCount: '7',
        quickMeasurementSources: {
          wallPaintSqft: 'detected_from_plan',
          ceilingPaintSqft: 'planning_estimate',
          interiorDoorCount: 'contractor_confirmed_from_plan_review',
          exteriorDoorCount: 'contractor_confirmed_from_plan_review',
          floorAreaSqft: 'plan_detected',
        },
      },
    } as unknown as EstimateAiDraft;
    expect(getInitialRevealChecklistScopePreview(draft).map(row => row.name)).toEqual([
      'Interior walls · 3,734 SF',
      'Ceilings · 2,571 SF',
      'Trim paint · 410.3 LF',
      'Interior door paint · 18',
      'Exterior paint · Needs SF',
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Exterior paint: needs SF',
    ]);
  });

  it('drops generic ground-up cleanup and keeps an explicit painting cleanup line', () => {
    const filtered = filterPlanScopesForTrade(
      [
        { itemId: 'interior_paint', label: 'Interior paint', state: 'included' },
        {
          itemId: 'cleanup',
          label: 'Cleanup & disposal',
          evidence:
            'Standard final cleanup for a complete ground-up new construction package.',
        },
        {
          itemId: 'cleanup',
          label: 'Paint cleanup',
          evidence: 'Bag and haul masking and paint waste for this scope',
        },
      ],
      'selected_trade',
      'painting'
    );
    expect(filtered.map(row => row.label)).toEqual([
      'Interior paint',
      'Paint cleanup',
    ]);
  });

  it('keeps exterior paint on a painting plan bid when elevation SF is blank', () => {
    const structured = buildPaintingStructuredMeasurements({
      planImportTradeKey: 'painting',
      planImportMode: 'selected_trade',
      wallPaintSqft: 3734,
      ceilingPaintSqft: 2571,
      baseboardLf: 410.3,
      paintScope: ['walls', 'ceilings', 'trim', 'doors'],
    });
    expect(structured.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'trim', 'doors', 'exterior'])
    );
    expect(structured.itemQuantities?.exterior_paint).toBeUndefined();

    const declined = buildPaintingStructuredMeasurements({
      planImportTradeKey: 'painting',
      planImportMode: 'selected_trade',
      wallPaintSqft: 3734,
      ceilingPaintSqft: 2571,
      paintScope: ['walls', 'ceilings'],
      quickMeasurementUserOverrides: { paintScopeExterior: true },
    });
    expect(declined.paintScope).not.toEqual(
      expect.arrayContaining(['exterior'])
    );

    const suggestion = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      inputWith({
        planImportTradeKey: 'painting',
        floorAreaSqft: '2571',
        wallPaintSqft: '3734',
        ceilingPaintSqft: '2571',
      }),
      'painting',
      { quantity: 0, unit: 'sqft', quantitySource: 'missing' }
    );
    expect(suggestion.fill).toBeNull();

    const windowTrim = resolveScopeItemSuggestedPricing(
      'exterior_trim_paint',
      inputWith({
        planImportTradeKey: 'painting',
        exteriorDoorCount: '7',
        windowCount: '0',
      }),
      'painting',
      { quantity: 7, unit: 'each', quantitySource: 'inferred' }
    );
    expect(windowTrim.fill).toBeNull();
  });

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

  it('does not turn a notes door count into door paint', () => {
    const structured = buildPaintingStructuredMeasurements(
      {
        paintScope: ['ceilings'],
        interiorDoorCount: 3,
      },
      'notes'
    );
    expect(structured.paintScope).toEqual(['ceilings']);
    const fromPlan = buildPaintingStructuredMeasurements({
      ceilingPaintSqft: 2000,
      interiorDoorCount: 3,
    });
    expect(fromPlan.paintScope).toEqual(
      expect.arrayContaining(['ceilings', 'doors'])
    );
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

  it('splits a combined total evenly when no real separate takeoff exists', () => {
    const separate = applyPaintPricingMethodChoice(
      {
        wallPaintSqft: '0',
        ceilingPaintSqft: '2000',
        combinedPaintableAreaSqft: '2000',
        paintPricingMethod: 'combined' as const,
      },
      'separate'
    );

    expect(separate.wallPaintSqft).toBe('1000');
    expect(separate.ceilingPaintSqft).toBe('1000');
    expect(Number(separate.wallPaintSqft) + Number(separate.ceilingPaintSqft)).toBe(
      2000
    );
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

  it('adds the floor-area ceiling basis when combined mode lost the ceiling field', () => {
    const combined = applyPaintPricingMethodChoice(
      {
        wallPaintSqft: '5280',
        ceilingPaintSqft: '',
        combinedPaintableAreaSqft: '5280',
        originalPaintAreaReferenceSqft: '2400',
        paintAreaBasis: 'floor_area',
        paintPricingMethod: 'separate',
      },
      'combined'
    );
    expect(combined.combinedPaintableAreaSqft).toBe('7680');
    expect(combined.paintAreaSqft).toBe('7680');
  });
});

describe('painting plan confirm scope on the initial estimate and review', () => {
  const applied = {
    selectionStatus: 'accepted' as const,
    pricingSourceKind: 'national_average' as const,
    pricingSourceLabel: 'Selected',
    pricingTypeLabel: 'Material + labor',
  };

  function paintingBid(): EstimateAiDraft {
    return {
      scopeAssumptionsConfirmed: true,
      originalNotes:
        'Architectural plans with exterior doors, interior doors, and interior paint.',
      scopeChecklist: {
        templateKey: 'painting',
        items: [
          { id: 'door_paint', label: 'Interior door paint', state: 'included' },
          { id: 'interior_paint', label: 'Interior paint — walls', state: 'included' },
          { id: 'ceiling_paint', label: 'Ceilings', state: 'included' },
          { id: 'trim_paint', label: 'Trim paint', state: 'included' },
          { id: 'prep', label: 'Paint prep & masking', state: 'included' },
          {
            id: 'exterior_door_install',
            label: 'Exterior door installation',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'painting',
        planImportFingerprint: 'painting-plan',
        wallPaintSqft: '1200',
        ceilingPaintSqft: '800',
        baseboardLf: '90',
        interiorDoorCount: '4',
        exteriorDoorCount: '2',
        itemQuantities: {
          door_paint__material: { quantity: '100', unit: 'allowance', quantitySource: 'user_entered' },
          door_paint__labor: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint: { quantity: '1200', unit: 'sqft', quantitySource: 'user_entered' },
          interior_paint__material: { quantity: '200', unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint__labor: { quantity: '800', unit: 'allowance', quantitySource: 'user_entered' },
          ceiling_paint__material: { quantity: '100', unit: 'allowance', quantitySource: 'user_entered' },
          ceiling_paint__labor: { quantity: '300', unit: 'allowance', quantitySource: 'user_entered' },
          trim_paint__material: { quantity: '50', unit: 'allowance', quantitySource: 'user_entered' },
          trim_paint__labor: { quantity: '150', unit: 'allowance', quantitySource: 'user_entered' },
          prep: { quantity: '2000', unit: 'sqft', quantitySource: 'plan_vision' },
        },
        pricingAcceptance: {
          door_paint: { ...applied, totalAmount: 500, materialAmount: 100, laborAmount: 400 },
          interior_paint: { ...applied, totalAmount: 1000, materialAmount: 200, laborAmount: 800 },
          ceiling_paint: { ...applied, totalAmount: 400, materialAmount: 100, laborAmount: 300 },
          trim_paint: { ...applied, totalAmount: 200, materialAmount: 50, laborAmount: 150 },
        },
      },
    } as unknown as EstimateAiDraft;
  }

  it('lists the applied paint lines and leaves door installation off the initial estimate', () => {
    const draft = paintingBid();
    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview.map(row => row.name)).toEqual([
      'Interior door paint',
      'Interior paint',
      'Ceilings',
      'Trim paint',
    ]);
    expect(preview.map(row => row.amount)).toEqual([500, 1000, 400, 200]);
    expect(preview.some(row => /door installation/i.test(row.name))).toBe(false);
    expect(preview.some(row => /prep|masking/i.test(row.name))).toBe(false);
    const appliedSum = preview.reduce((sum, row) => sum + row.amount, 0);
    const packageSum = getScopePackagesForReview(draft).reduce(
      (sum, pkg) => sum + scopePackagePricedAmount(pkg, draft),
      0
    );
    expect(appliedSum).toBe(packageSum);
  });

  it('asks for the masking price until that card is applied', () => {
    expect(lookupRuleKeyForPackage('Paint prep & masking')).toBe('prep');
    const draft = paintingBid();
    const prep = getScopePackagesForReview(draft).find(
      pkg => pkg.checklistItemId === 'prep'
    );
    expect(prep).toBeTruthy();
    expect(scopePackagePricedAmount(prep!, draft)).toBe(0);
    expect(scopePackageReviewUnpricedLabel(prep!, draft)).toBe('Add price');

    const acceptanceOnly = paintingBid();
    acceptanceOnly.scopeMeasurements = {
      ...acceptanceOnly.scopeMeasurements,
      itemQuantities: {
        interior_paint: { quantity: '1200', unit: 'sqft', quantitySource: 'plan_vision' },
        prep: { quantity: '2000', unit: 'sqft', quantitySource: 'plan_vision' },
      },
      pricingAcceptance: {
        interior_paint: { ...applied, totalAmount: 1000, materialAmount: 0, laborAmount: 0 },
      },
    } as EstimateAiDraft['scopeMeasurements'];
    const covered = getScopePackagesForReview(acceptanceOnly).find(
      pkg => pkg.checklistItemId === 'prep'
    );
    expect(scopePackageReviewUnpricedLabel(covered!, acceptanceOnly)).toBe('Add price');
  });
});
