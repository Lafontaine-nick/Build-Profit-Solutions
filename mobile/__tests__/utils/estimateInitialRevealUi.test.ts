import {
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
} from '@/utils/estimateDraftReviewUi';
import {
  countInitialRevealAttentionItems,
  filterRoofingRevealAttentionItems,
  filterPlumbingRevealAttentionItems,
  getInitialRevealAttentionTitle,
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPlanningDisclaimer,
  draftNeedsScopeConfirmation,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealPriorityItems,
  getInitialRevealScopeMetaLabel,
  getInitialRevealStatusLabel,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
  getScopeTotalCoverageLine,
  planRevealOmitsWhatWeFound,
  initialRevealPricingVisible,
  plainLanguageReviewItem,
  shouldDefaultExpandInitialRevealScope,
  shouldShowInitialRevealWhatWeFound,
  splitInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import {
  aiFlowStepTotal,
  repairDraftRatePricingFromNotes,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import {
  inferItemStateFromNotes,
  notesDescribeGroundUpHome,
} from '@/utils/scopeItemNoteHints';
import {
  countScopePricingReadiness,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import {
  primaryIntelligenceNotice,
  resolveScopeItemIntelligence,
} from '@/utils/scopeIntelligence';
import {
  bucketWholeProjectScopeGroups,
  checklistDisplayHelper,
  groupScopeChecklistItems,
  scopeChecklistUnsurePhrase,
} from '@/utils/estimateScopeChecklistUi';
import { applyAtticInsulationWithDrywallCards } from '@/utils/insulationNoteScope';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import { buildPlanScopeRecords } from '@/utils/planScopeRecords';
import {
  applyConcretePatioWithSodCards,
  notesImplyExteriorFlatwork,
  notesImplyStructuralFoundation,
} from '@/utils/foundationPlanningMeasurements';

const classificationFixtures =
  require('../../../test-fixtures/scopeClassificationFixtures.json') as {
    id: string;
    notes: string;
    expected: {
      scopeMode: string;
      projectType: string;
      detectedTrades: string[];
    };
  }[];

describe('estimateInitialRevealUi', () => {
  it('lists the kitchen and hall bath on an interior ranch remodel', () => {
    const notes =
      'Interior remodel of an existing 1,800 sqft ranch. Kitchen: demo to the studs, 16 LF cabinets, 48 sqft quartz counters, 22 sqft backsplash, new sink and faucet. Hall bath: 40 sqft floor tile, tub surround, 36-inch vanity, toilet, and paint. Flooring in the rest of the house stays. Owner supplies appliances. We pull the remodel permit.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'bathroom',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      whatAiDid: ['Detected bathroom remodel.'],
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'toilet', label: 'Toilet', state: 'included' },
          { id: 'vanity', label: 'Vanity', state: 'included' },
          { id: 'faucet', label: 'Faucet', state: 'included' },
          { id: 'paint', label: 'Paint', state: 'included' },
          { id: 'paint_repair', label: 'Paint', state: 'included' },
        ],
      },
    } as EstimateAiDraft;
    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview.map(row => row.name)).toEqual([
      'Demo to the studs',
      'Cabinets',
      'Counters',
      'Backsplash',
      'Sink and faucet',
      'Bathroom floor tile',
      'Tub surround',
      'Vanity',
      'Toilet',
      'Paint',
    ]);
    expect(preview.find(row => row.name === 'Cabinets')?.quantity).toBe('16 LF');
    expect(preview.find(row => row.name === 'Counters')?.quantity).toBe('48 sqft');
    expect(preview.find(row => row.name === 'Backsplash')?.quantity).toBe(
      '22 sqft'
    );
    expect(preview.find(row => row.name === 'Bathroom floor tile')?.quantity).toBe(
      '40 sqft'
    );
    expect(preview.find(row => row.name === 'Vanity')?.quantity).toBe('36 in');
    expect(preview.filter(row => row.name === 'Paint')).toHaveLength(1);
    expect(preview.some(row => /cabinet removal/i.test(row.name))).toBe(false);
    expect(preview.some(row => /^flooring\b/i.test(row.name))).toBe(false);
    expect(getInitialRevealTagline(draft)).toBe('Kitchen and hall bath.');
    expect(getInitialRevealConfirmItems(draft).pricingScope[0]).toBe(
      'Appliances are not in this bid'
    );
  });

  it('names counted return grilles on Scope found', () => {
    const notes = 'Install 3 return grilles. Leave the heat pump in place.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'other',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      stillNeededReview: ['Pricing for Return grilles'],
      scopeChecklist: {
        templateKey: 'hvac',
        items: [
          {
            id: 'return_grilles',
            label: 'Return grilles',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealDisplayTitle(draft)).toBe('3 return grilles');
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual([
      '3 return grilles',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      expect.objectContaining({ name: '3 return grilles' }),
    ]);
  });

  it('names counted supply registers on Scope found', () => {
    const notes = 'Install 4 supply registers. Leave the furnace in place.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'other',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      stillNeededReview: ['Pricing for Supply registers'],
      scopeChecklist: {
        templateKey: 'hvac',
        items: [
          {
            id: 'supply_registers',
            label: 'Supply registers',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealDisplayTitle(draft)).toBe('4 supply registers');
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual([
      '4 supply registers',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      expect.objectContaining({ name: '4 supply registers' }),
    ]);
  });

  it('does not ask for a ductwork price the card already has', () => {
    const notes =
      'Install 60 linear feet of ductwork. Leave the furnace in place.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'other',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      stillNeededReview: ['Pricing for HVAC Ductwork'],
      scopeChecklist: {
        templateKey: 'hvac',
        items: [
          {
            id: 'ductwork',
            label: 'Ductwork (new / modify / seal)',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealDisplayTitle(draft)).toBe('60 LF ductwork');
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual(['60 LF ductwork']);
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      expect.objectContaining({ name: '60 LF ductwork' }),
    ]);
  });

  it('does not ask for a thermostat price the card already has', () => {
    const notes =
      'Install two thermostats. Leave the furnace and the ductwork in place.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'hvac',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      stillNeededReview: ['Pricing for HVAC Controls'],
      scopeChecklist: {
        templateKey: 'hvac',
        items: [
          {
            id: 'thermostat',
            label: 'Thermostat / controls',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual(['2 thermostats']);
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      expect.objectContaining({ name: '2 thermostats' }),
    ]);
  });

  it('names a condenser replacement on Scope found', () => {
    const notes = 'Replace one condenser. Leave the air handler in place.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'hvac',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'hvac',
        items: [
          {
            id: 'equipment_replace',
            label: 'Equipment replacement (furnace / AC / heat pump)',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft)).toEqual(['Condenser']);
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      expect.objectContaining({ name: 'Condenser' }),
    ]);
  });

  it('separates mixed stucco, openings, roofing, and gutters from stale defaults', () => {
    const notes =
      'Repair and install stucco. Gross exterior wall area is 1,800 sqft. Deduct 240 sqft for window and door openings, 120 sqft for garage openings, and 90 sqft for brick and stone, for a net stucco area of 1,350 sqft. Include 80 sqft soffits, 40 sqft parapets, 35 LF foam trim, and 30 LF control joints. Building is 2 stories with 9 ft wall height per story. Allow 400 sqft access-affected area and 150 sqft localized repair. Replace 6 windows and 1 exterior door. Replace 28 roofing squares and 120 LF gutters. Excludes exterior painting and structural framing.';
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'other',
      scopeMode: 'mixed',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['stucco', 'roofing', 'windows_doors', 'trim', 'hvac'],
      },
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'stucco', label: 'Stucco / exterior wall finish', state: 'included' },
          { id: 'interior_door_install', label: 'Interior door installation', state: 'included' },
          { id: 'trim', label: 'Trim', state: 'included' },
          { id: 'windows', label: 'Windows', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', state: 'included' },
        ],
      },
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Stucco / exterior wall finish',
          quantity: '1350 sqft',
        }),
        expect.objectContaining({
          name: 'Roofing replacement',
          quantity: '28 squares',
        }),
        expect.objectContaining({ name: 'Gutters', quantity: '120 LF' }),
      ])
    );
    expect(preview.map(row => row.name)).not.toEqual(
      expect.arrayContaining(['Interior door installation', 'Trim'])
    );
    expect(getInitialRevealTagline(draft)).not.toContain('Trim');
    expect(getInitialRevealTagline(draft)).not.toContain('HVAC');
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual(
      expect.arrayContaining([
        'Price needed for Stucco / exterior wall finish',
        'Price needed for Windows',
        'Price needed for Exterior doors',
        'Price needed for Roofing replacement',
        'Price needed for Gutters',
      ])
    );
  });

  it('uses net stucco area for mixed drafts outside the room-remodel template', () => {
    const notes =
      'Repair and install stucco. Gross exterior wall area is 1,800 sqft. Deduct 240 sqft for window and door openings, 120 sqft for garage openings, and 90 sqft for brick and stone, for a net stucco area of 1,350 sqft. Include 80 sqft soffits, 40 sqft parapets, 35 LF foam trim, and 30 LF control joints. Replace 6 windows and 1 exterior door. Replace 28 roofing squares and 120 LF gutters.';
    const draft = {
      projectType: 'other',
      scopeMode: 'mixed',
      originalNotes: notes,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['stucco', 'roofing', 'windows_doors', 'trim'],
      },
      scopeChecklist: {
        templateKey: 'other',
        items: [
          { id: 'stucco', label: 'Stucco / exterior wall finish', state: 'included' },
          { id: 'windows', label: 'Window install', state: 'included' },
          {
            id: 'exterior_doors',
            label: 'Exterior door installation',
            state: 'included',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Stucco / exterior wall finish',
          quantity: '1350 sqft',
        }),
      ])
    );
    expect(getInitialRevealTagline(draft)).not.toContain('Trim');
  });

  it('keeps measured stucco notes on a dedicated reveal instead of mixed remodel', () => {
    const draft = {
      projectType: 'stucco',
      scopeMode: 'mixed',
      originalNotes:
        'Repair and install stucco. Gross exterior wall area is 2,400 sqft. Deduct 320 sqft for window and door openings, 0 sqft for garage door openings, and 180 sqft for other finish deductions. Include 60 LF of foam trim. Excludes structural framing, extensive sheathing, and painting beyond the stucco finish.',
      classification: {
        scopeMode: 'mixed',
        primaryTrade: 'stucco',
        detectedTrades: ['stucco', 'painting', 'trim'],
        scopeSummary: 'Mixed-scope remodel',
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Stucco');
    expect(getInitialRevealTagline(draft)).not.toContain('Mixed-scope remodel');
  });

  it('does not preview duplicate electrical packages or excluded light fixtures', () => {
    const notes =
      'Electrical rough-in for a 2,400 sqft new construction home: install 18 recessed lights, 12 standard receptacles, 4 GFCI receptacles, 10 switches, two dedicated 20A circuits, one 200A main panel, and 150 LF conduit. Excludes light fixtures, fans, low-voltage, EV charging, utility work, and final trim.';
    const draft = {
      projectType: 'new_build',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'electrical',
        items: [
          { id: 'electrical_main_panel', label: 'Main panel', state: 'included' },
          { id: 'electrical_rough', label: 'Electrical rough-in', state: 'included' },
          { id: 'electrical', label: 'Electrical outlets, GFCI & circuits', state: 'included' },
          { id: 'electrical_standard_receptacle', label: 'Standard receptacles', state: 'included' },
          { id: 'electrical_gfci_receptacle', label: 'GFCI receptacles', state: 'included' },
          { id: 'electrical_single_pole_switch', label: 'Single-pole switch', state: 'included' },
          { id: 'electrical_conduit', label: 'Conduit / raceway only', state: 'included' },
          { id: 'electrical_recessed_light', label: 'Recessed / canless / wafer light', state: 'included' },
        ],
      },
      scopeMeasurements: {
        floorAreaSqft: 2400,
        mainPanelCount: 1,
        recessedLightCount: 18,
        standardReceptacleCount: 12,
        gfciReceptacleCount: 4,
        singlePoleSwitchCount: 10,
        dedicated20aCircuitCount: 2,
        conduitLf: 150,
      },
      scopePackages: [
        {
          name: 'Electrical work (new circuits / boxes)',
          scope: 'Electrical rough-in',
          scopeQuantities: [{ quantity: 2400, unit: 'sqft' }],
        },
        {
          name: 'Electrical outlets, GFCI & circuits',
          scope: 'Electrical device package',
        },
        {
          name: 'Recessed / canless / wafer light',
          scope: 'Light fixture install',
        },
      ],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(row => row.name);

    expect(names).not.toEqual(
      expect.arrayContaining([
        'Electrical rough-in',
        'Electrical outlets, GFCI & circuits',
        'Recessed / canless / wafer light',
      ])
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'Main panel',
        'Standard receptacles',
        'GFCI receptacles',
        'Single-pole switch',
        'Conduit / raceway only',
      ])
    );
    expect(names.join('\n')).not.toMatch(/vanity fixture/i);
    expect(getInitialRevealConfirmItems(draft).pricingScope.slice(0, 2)).toEqual([
      'Fixtures are not in this bid',
      'Fans are not in this bid',
    ]);
  });

  it('collapses a stated drywall repair beside flooring to one line', () => {
    const notes =
      'Remodel a 2,000 sqft home. Remove 800 sqft of existing flooring and install 800 sqft of new flooring. Repair 300 sqft of drywall.';
    const draft = {
      projectType: 'other',
      scopeMode: 'mixed',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'floor_demo', label: 'Flooring demo / removal', state: 'included' },
          { id: 'drywall', label: 'Drywall / patching', state: 'included' },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          { id: 'patch_repair', label: 'Drywall patch / repair', state: 'included' },
        ],
      },
      scopeMeasurements: {
        floorDemoSqft: 800,
        flooringSqft: 800,
        drywallSqft: 300,
        patchRepairSqft: 300,
      },
    } as EstimateAiDraft;

    const drywall = getInitialRevealChecklistScopePreview(draft).filter(row =>
      /drywall/i.test(row.name)
    );

    expect(drywall.map(row => row.name)).toEqual([
      'Drywall repair · 300 sqft',
    ]);
  });

  it('limits a mixed addition reveal to note-backed scope rows', () => {
    const notes =
      'Remodel an existing 2,000 sqft home and build a 350 sqft addition. Electrical scope includes a 200A main panel, wiring and boxes for 30 standard receptacle locations, 6 GFCI receptacle locations, 20 switch locations, 26 recessed-light rough-in locations, four dedicated 20A circuits, and 240 LF of conduit. Repair 420 sqft of drywall, install six windows and two exterior doors, add R-21 wall insulation, install 1,100 sqft flooring, replace 160 LF baseboard, and paint the interior. Owner supplies light fixtures and final devices/plates. Excludes fans, low-voltage, EV charging, utility work, and final electrical trim-out.';
    const draft = {
      projectType: 'addition',
      scopeMode: 'mixed',
      originalNotes: notes,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['addition', 'electrical', 'drywall', 'flooring'],
      },
      scopeChecklist: {
        templateKey: 'addition',
        items: [
          { id: 'foundation', label: 'Foundation', state: 'included' },
          { id: 'roofing', label: 'Roofing', state: 'included' },
          { id: 'electrical', label: 'Electrical', state: 'included' },
          { id: 'electrical_main_panel', label: 'Main panel', state: 'included' },
          { id: 'electrical_dedicated_20a', label: 'Dedicated 20A circuits', state: 'included' },
          { id: 'drywall', label: 'Drywall', state: 'included' },
          { id: 'flooring', label: 'Flooring', state: 'included' },
          { id: 'windows', label: 'Windows', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', state: 'included' },
          { id: 'insulation', label: 'Insulation', state: 'included' },
          { id: 'baseboard_install', label: 'Baseboard installation', state: 'included' },
          { id: 'interior_paint', label: 'Interior paint', state: 'included' },
          { id: 'garage_doors', label: 'Garage doors', state: 'included' },
          { id: 'cabinets', label: 'Cabinets', state: 'included' },
        ],
      },
      scopeMeasurements: {},
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(row => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'Drywall repair · 420 sqft',
        'Flooring installation',
        'Window install',
        'Exterior doors',
        'Interior paint',
        'Electrical',
        'Main panel',
        'Dedicated 20A circuits',
      ])
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        'Foundation',
        'Roofing',
        'Garage doors',
        'Cabinets',
        'Interior doors / trim',
      ])
    );
    expect(
      names.some(name => /interior\s+(?:doors?|door\s+trim).*trim/i.test(name))
    ).toBe(false);
  });

  it('maps technical review copy to plain language', () => {
    expect(
      plainLanguageReviewItem('Low-confidence quantity for wall tile')
    ).toContain('Please check quantity');
    expect(plainLanguageReviewItem('Pricing gap on plumbing')).toBe(
      'Price needed on plumbing'
    );
    expect(
      plainLanguageReviewItem(
        'Overall bid total or room lump sums (e.g. bathroom $8,500), or $/sqft rates with square footage'
      )
    ).toBe('Pricing total not found in notes');
    expect(plainLanguageReviewItem('Pricing for tile demo')).toBe(
      'Price needed for tile demo'
    );
  });

  it('labels status from attention count and confidence', () => {
    const draft = {
      estimateConfidence: { level: 'high' },
    } as EstimateAiDraft;
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Ready to send');
    expect(getInitialRevealStatusLabel(draft, 2).label).toBe(
      'Mostly ready · 2 to check'
    );
    expect(scopeChecklistUnsurePhrase(6)).toBe('6 cards not sure');
    expect(scopeChecklistUnsurePhrase(1)).toBe('1 card not sure');
    expect(scopeChecklistUnsurePhrase(0)).toBeNull();
  });

  it('shows confirmed plan quantities on Scope found instead of inferred soft costs', () => {
    const draft = {
      scopeAssumptionsConfirmed: false,
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'permits', label: 'Permits / fees (incl. impact)', state: 'included' },
        ],
      },
      stillNeededReview: [
        'Pricing for Plans / engineering',
        'Pricing for Permits / fees (incl. impact)',
        'Pricing for Complete drywall assembly',
      ],
      scopeMeasurements: {
        planImportFingerprint: 'lot-49',
        planImportMode: 'whole_project',
        floorAreaSqft: 2571,
        garageSqft: 1427,
        deckSqft: 322,
        flooringSqft: 2571,
        planRooms: [
          { name: 'Primary Suite', areaSqft: 209 },
          { name: 'Bed 2', areaSqft: 138 },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealStatusLabel(draft, 4).label).toBe(
      'Mostly ready · 4 to check'
    );
    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual([
      'Living area · 2,571 SF',
      'Garage · 1,427 SF',
      'Deck / patio · 322 SF',
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Price needed for Living area · 2,571 SF',
      'Price needed for Garage · 1,427 SF',
      'Price needed for Deck / patio · 322 SF',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft).map(row => row.name)).toEqual(
      [
        'Living area · 2,571 SF',
        'Garage · 1,427 SF',
        'Deck / patio · 322 SF',
      ]
    );
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(3);
    expect(planRevealOmitsWhatWeFound(draft)).toBe(true);
  });

  it('lists a general contractor plan with every allowance trade and no rooms counted', () => {
    const measurements = {
      floorAreaSqft: '2571',
      garageSqft: '1427',
      windowCount: '35',
      garageDoorDoubleCount: '1',
      garageDoorRvCount: '1',
      recessedLightCount: '31',
      ceilingFanCount: '5',
      threeWaySwitchCount: '8',
      bathExhaustFanCount: '4',
    };
    const draft = {
      projectTitle: 'Ground-Up New Construction Estimate Draft',
      projectType: 'new_build',
      originalNotes: 'New construction single family home from plans.',
      estimateTier: 'complex_project',
      requiresScopeConfirmation: true,
      scopeAssumptionsConfirmed: false,
      scopeChecklist: { templateKey: 'ground_up', items: [] },
      scopeMeasurements: {
        ...measurements,
        quickMeasurementSources: {
          windowCount: 'needs_confirmation',
          garageDoorDoubleCount: 'plan_suggested',
          garageDoorRvCount: 'detected_from_plan',
          recessedLightCount: 'detected_from_plan',
          ceilingFanCount: 'contractor_confirmed_from_plan_review',
          threeWaySwitchCount: 'needs_confirmation',
          bathExhaustFanCount: 'needs_confirmation',
        },
        measurementProvenance: {
          garageDoorRvCount: { normalizedSource: 'NEEDS_CONFIRMATION', pricingEligible: false },
          recessedLightCount: { status: 'plan_verified', pricingEligible: true },
        },
        planImportFingerprint: 'lot-49',
        planImportMode: 'whole_project',
        planScopeRecords: buildPlanScopeRecords({
          measurements,
          sources: {},
          rooms: [
            { name: 'Primary Suite', areaSqft: 209 },
            { name: 'Bed 2', areaSqft: 138 },
          ],
          wholeProject: true,
        }),
      },
    } as unknown as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('New home · 2,571 sqft');
    expect(getInitialRevealTagline(draft)).toBe(
      'Read from the plan. Unprinted trades are planning allowances.'
    );
    const rows = getInitialRevealChecklistScopePreview(draft).map(row => row.name);
    expect(rows).toEqual(
      expect.arrayContaining([
        'Living area · 2,571 sqft',
        'Windows · 35 · confirm count',
        'Double garage doors · 1 · planning estimate',
        'RV / oversized garage doors · 1 · planning estimate',
        'Recessed lights · 31',
        'Ceiling fans · 5',
        '3-way switches · 8 · confirm count',
        'Framing · planning allowance',
        'Plumbing · planning allowance',
        'HVAC · planning allowance',
        'Electrical · planning allowance',
        'Flooring · planning allowance',
      ])
    );
    expect(rows.join('\n')).not.toMatch(/spaces detected/);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(rows.length);
    expect(getInitialRevealChecklistScopePreview(draft).every(row => !row.amount)).toBe(
      true
    );
    expect(getInitialRevealAttentionTitle(draft, true)).toBe('Counts to confirm');
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Windows · 35',
      'Exhaust fans · 4',
      '3-way switches · 8',
    ]);
    expect(getInitialRevealScopeMetaLabel(rows.length, { planLines: true })).toBe(
      `${rows.length} plan lines`
    );
    expect(
      getInitialRevealStatusLabel(draft, countInitialRevealAttentionItems(draft))
        .label
    ).toBe('Mostly ready · 3 plan counts');
  });

  it('after confirm, a whole-house plan lists accepted allowances with the counted scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      projectType: 'new_build',
      originalNotes: 'Ground-up new construction plan imported.',
      scopeChecklist: {
        templateKey: 'ground_up',
        scopeFacts: [{ scopeId: 'windows', status: 'included' }],
        items: [
          { id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'included' },
          { id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'unsure' },
          { id: 'lighting', label: 'Lighting', inputType: 'yes_no', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportFingerprint: 'lot-49',
        planImportMode: 'whole_project',
        floorAreaSqft: '2571',
        recessedLightCount: '31',
        planScopeRecords: [
          {
            id: 'allowances',
            findings: [{ id: 'allowance-framing', status: 'planning_allowance' }],
          },
        ],
        itemQuantities: {
          lighting: { quantity: 31, unit: 'each', quantitySource: 'notes' },
          framing__allowance: {
            quantity: 1000,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          framing: { status: 'accepted', totalAmount: 1000 },
          lighting: { status: 'accepted', totalAmount: 14725 },
        },
      },
    } as unknown as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(row => row.name);
    expect(names).toEqual(expect.arrayContaining(['Windows', 'Framing']));
    expect(names).not.toContain('Lighting');
    expect(getInitialRevealTotals(draft).scopeItemCount).toBeGreaterThan(1);
  });

  it('lists the framing package on Scope found instead of living area and garage', () => {
    const draft = {
      scopeAssumptionsConfirmed: false,
      scopeChecklist: {
        templateKey: 'framing',
        items: [
          {
            id: 'framing',
            label: 'Framing (lumber + labor)',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportFingerprint: 'lot-49',
        planImportMode: 'selected_trade',
        planImportTradeKey: 'framing',
        floorAreaSqft: 2571,
        garageSqft: 1427,
        framedAreaSqft: 3998,
        quickMeasurementSources: {
          floorAreaSqft: 'plan_verified',
          garageSqft: 'plan_verified',
          framedAreaSqft: 'plan_detected',
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Price needed for Framing (lumber + labor) · 3,998 SF',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft).map(row => row.name)).toEqual([
      'Framing (lumber + labor) · 3,998 SF',
    ]);
  });

  it('keeps Scope found to wall framing, sheathing, and openings', () => {
    const notes =
      'Frame 840 sqft of walls with structural sheathing, including three rough openings.';
    const draft = {
      originalNotes: notes,
      projectType: 'framing',
      projectTitle: 'Wall Framing and Structural Sheathing',
      scopeMode: 'dedicated',
      missingInfo: [
        'Wall dimensions, heights, layout, and framing details',
        'Permit, engineering, and inspection requirements',
      ],
      stillNeededReview: [
        'Wall framing labor',
        'Framing lumber and structural sheathing material',
      ],
      scopeChecklist: {
        templateKey: 'framing',
        items: [
          {
            id: 'review-dimensions',
            label: 'Wall dimensions, heights, layout, and framing details',
            state: 'included',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '840 sqft' },
      { name: 'Structural sheathing' },
      { name: 'Door / window openings', quantity: '3 each' },
    ]);
  });

  it('keeps Scope found to a linear-foot stud wall and its openings', () => {
    const notes = 'Frame 36 LF of stud wall and two rough openings.';
    const draft = {
      originalNotes: notes,
      projectType: 'other',
      projectTitle: 'Stud Wall Framing and Rough Openings',
      whatAiDid: ['Detected existing home interior remodel'],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'framing',
            label: 'Framing or layout changes',
            state: 'included',
          },
          { id: 'drywall', label: 'Drywall hang / finish', state: 'unsure' },
          { id: 'flooring', label: 'Flooring installation', state: 'unsure' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '36 LF' },
      { name: 'Door / window openings', quantity: '2 each' },
    ]);
  });

  it('repairs a linear-foot stud wall draft onto the framing checklist', () => {
    const notes = 'Frame 36 LF of stud wall and two rough openings.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: notes,
        projectType: 'other',
        customerName: null,
        projectTitle: 'Stud Wall Framing and Rough Openings',
        whatAiDid: ['Detected existing home interior remodel'],
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            {
              id: 'framing',
              label: 'Framing or layout changes',
              state: 'included',
            },
            { id: 'drywall', label: 'Drywall', state: 'unsure' },
          ],
        },
        scopeMeasurements: { framedAreaSqft: 300 },
      } as EstimateAiDraft,
      notes
    );

    expect(repaired.scopeChecklist?.templateKey).toBe('framing');
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'wall_framing',
      'openings',
    ]);
    expect(repaired.whatAiDid).toEqual(['Detected framing.']);
    expect(repaired.scopeMeasurements?.framedAreaSqft).toBeUndefined();
    expect(getInitialRevealTagline(repaired)).toBe('Detected framing.');
  });

  it('keeps a split wall sentence on the linear-foot cards', () => {
    const notes = 'Frame the wall. 36 linear feet and two rough openings.';
    const draft = {
      originalNotes: notes,
      projectType: 'framing',
      projectTitle: 'Wall Framing',
      missingInfo: ['Permit responsibility', 'Wall height and framing specifications'],
      stillNeededReview: ['Whether materials are included'],
      scopeChecklist: {
        templateKey: 'framing',
        items: [
          { id: 'framing', label: 'Wall Framing', state: 'included' },
          { id: 'permits', label: 'Permit responsibility', state: 'unsure' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '36 LF' },
      { name: 'Door / window openings', quantity: '2 each' },
    ]);
  });

  it('keeps a partition-and-header note on the framing cards', () => {
    const notes = 'Build 24 feet of interior partition and one header.';
    const draft = {
      originalNotes: notes,
      projectType: 'other',
      projectTitle: 'Interior Partition and Header',
      whatAiDid: ['Detected existing home interior remodel'],
      missingInfo: ['Permit responsibility'],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'framing',
            label: 'Interior Partition Framing',
            state: 'included',
          },
          { id: 'drywall', label: 'Drywall', state: 'unsure' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '24 LF' },
      { name: 'Door / window openings', quantity: '1 each' },
    ]);
  });

  it('keeps a feet-long wall note on the framing cards', () => {
    const notes =
      'Frame a new interior wall. It is 18 feet long and needs one rough opening.';
    const draft = {
      originalNotes: notes,
      projectType: 'other',
      projectTitle: 'New Interior Wall Framing',
      whatAiDid: ['Detected existing home interior remodel'],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'framing',
            label: 'Framing or layout changes',
            state: 'included',
          },
          { id: 'drywall', label: 'Drywall', state: 'unsure' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '18 LF' },
      { name: 'Door / window openings', quantity: '1 each' },
    ]);
  });

  it('shows the stated wall demolition quantity on Scope found', () => {
    const notes =
      'Demolish 120 sqft of nonstructural walls. Frame 960 sqft of walls and 200 sqft of sheathing, including one rough opening.';
    const draft = {
      originalNotes: notes,
      projectType: 'framing',
      projectTitle: 'Framing',
      scopeChecklist: {
        templateKey: 'framing',
        items: [
          { id: 'wall_demo', label: 'Wall Demo', state: 'included' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall demolition', quantity: '120 sqft' },
      { name: 'Wall framing', quantity: '960 sqft' },
      { name: 'Structural sheathing', quantity: '200 sqft' },
      { name: 'Door / window openings', quantity: '1 each' },
    ]);
  });

  it('prices wall framing and LVP from their own areas', () => {
    const notes =
      'Framing and flooring Frame 1,600 sqft of walls and install 180 sqft of LVP.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: notes,
        projectType: 'flooring',
        projectTitle: 'Flooring',
        scopeMode: 'dedicated',
        scopeChecklist: {
          templateKey: 'flooring',
          items: [
            { id: 'flooring', label: 'Flooring installation', state: 'included' },
          ],
        },
        scopeMeasurements: {
          floorAreaSqft: 1600,
          flooringSqft: 1600,
        },
      } as EstimateAiDraft,
      notes
    );

    expect(repaired.projectTitle).toBe('Wall framing and LVP');
    expect(getInitialRevealDisplayTitle(repaired)).toBe('Wall framing and LVP');
    expect(getInitialRevealTagline(repaired)).toBe('Framing · Flooring');
    expect(repaired.scopeMeasurements?.wallFramingSqft).toBe(1600);
    expect(repaired.scopeMeasurements?.flooringSqft).toBe(180);
    expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(180);
    expect(repaired.scopeMeasurements?.floorAreaSqft).toBeUndefined();
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '1600 sqft' },
      { name: 'LVP flooring', quantity: '180 sqft' },
    ]);

    const measurements = repaired.scopeMeasurements || {};
    const framingQuantity = resolveChecklistItemQuantity(
      'wall_framing',
      measurements,
      { templateKey: 'room_remodel', notes }
    );
    const flooringQuantity = resolveChecklistItemQuantity(
      'flooring',
      measurements,
      { templateKey: 'room_remodel', notes }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'wall_framing',
        measurements,
        'room_remodel',
        framingQuantity,
        null,
        null,
        notes
      ).fill?.total
    ).toBe(2400);
    expect(
      resolveScopeItemSuggestedPricing(
        'flooring',
        measurements,
        'room_remodel',
        flooringQuantity,
        null,
        null,
        notes
      ).fill?.total
    ).toBe(1260);
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'wall_framing',
      templateKey: 'room_remodel',
      notes,
      measurements: measurements as never,
      resolved: framingQuantity,
    });
    expect(primaryIntelligenceNotice(intelligence) || '').not.toMatch(
      /building floor area/i
    );
  });

  it('keeps Scope found to wall framing and LVP for a mixed note', () => {
    const notes = 'Frame 400 sqft of walls and install 180 sqft of LVP.';
    const draft = {
      originalNotes: notes,
      projectType: 'flooring',
      projectTitle: 'Flooring',
      scopeMode: 'dedicated',
      scopeChecklist: {
        templateKey: 'flooring',
        items: [
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          { id: 'permits', label: 'Permit responsibility', state: 'unsure' },
        ],
      },
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(
      preview.map(row => ({
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
      }))
    ).toEqual([
      { name: 'Wall framing', quantity: '400 sqft', amount: 0 },
      { name: 'LVP flooring', quantity: '180 sqft', amount: 0 },
    ]);
    expect(getInitialRevealHeroDisplay(getInitialRevealTotals(draft), true).hasAmount).toBe(
      false
    );
    const mixedDraft = {
      ...draft,
      projectTitle: 'Mixed-scope construction',
      estimateTier: 'room_remodel',
      scopeMode: 'mixed',
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'wall_framing', label: 'Wall framing', state: 'included' },
          { id: 'flooring', label: 'LVP flooring', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;
    expect(getInitialRevealConfirmItems(mixedDraft).pricingScope).toEqual([]);
    expect(getInitialRevealStatusLabel(mixedDraft, 0).label).toBe('Mostly ready');
    const groups = groupScopeChecklistItems(
      mixedDraft.scopeChecklist?.items || [],
      'room_remodel',
      { notes }
    );
    expect(groups.map(group => group.title)).toEqual([
      'Wall framing',
      'LVP flooring',
    ]);
    expect(
      bucketWholeProjectScopeGroups(groups, { notes }).map(group => group.title)
    ).toEqual(['Wall framing', 'LVP flooring']);
  });

  it('does not call cabinet and LVP suggestions missing prices on Scope found', () => {
    const notes = 'Install 12 LF of base cabinets and 40 sqft of LVP.';
    const draft = {
      originalNotes: notes,
      projectType: 'kitchen',
      projectTitle: 'Kitchen and Flooring Installation',
      estimateTier: 'room_remodel',
      scopeMode: 'dedicated',
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          { id: 'cabinets', label: 'Stock cabinet supply & installation', state: 'included' },
          { id: 'countertops', label: 'Countertop fabrication & install', state: 'unsure' },
          { id: 'backsplash', label: 'Backsplash tile install', state: 'unsure' },
          { id: 'flooring', label: 'Kitchen flooring install', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview.map(row => row.name)).toEqual([
      '12 LF cabinets',
      'Kitchen flooring install',
    ]);
    expect(preview.every(row => row.amount === 0)).toBe(true);
    expect(getInitialRevealHeroDisplay(getInitialRevealTotals(draft), true).hasAmount).toBe(
      false
    );
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(
      getInitialRevealStatusLabel(
        draft,
        getInitialRevealConfirmItems(draft).pricingScope.length
      ).label
    ).toBe('Mostly ready');
  });

  it('prices attic insulation and drywall hang from the named areas', () => {
    const notes =
      'Insulation and drywall Install R-38 insulation in 1,000 sqft of attic and hang 800 sqft of drywall.';
    const draft = {
      originalNotes: notes,
      projectType: 'other',
      projectTitle: 'Mixed-scope remodel',
      estimateTier: 'room_remodel',
      scopeMode: 'mixed',
      requiresScopeConfirmation: true,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['drywall', 'insulation'],
        scopeSummary: null,
      },
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'drywall',
            label: 'Drywall hang / finish',
            state: 'included',
            helperText:
              'Wall/ceiling surface sqft (not floor area). Patch or replace after layout changes.',
          },
          {
            id: 'insulation',
            label: 'Insulation',
            state: 'included',
            helperText:
              'Insulation surface area from notes; enter the missing sqft.',
          },
          { id: 'hang', label: 'Hang drywall', state: 'included' },
        ],
        scopeFacts: [
          {
            scopeId: 'hang',
            status: 'included',
            catalogEntry: { displayName: 'Hang drywall' },
          },
        ],
      },
      scopeMeasurements: {
        drywallSqft: 800,
        atticInsulationSqft: 1000,
      },
      scopePackages: [],
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Attic insulation', quantity: '1000 sqft' },
      { name: 'Drywall hang / finish', quantity: '800 sqft' },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealDisplayTitle(draft)).toBe(
      'Attic insulation and drywall'
    );
    expect(getInitialRevealTagline(draft)).toBe('Drywall · Insulation');
    expect(
      getInitialRevealStatusLabel(
        draft,
        getInitialRevealConfirmItems(draft).pricingScope.length
      ).label
    ).toBe('Mostly ready');
    expect(getInitialRevealScopeMetaLabel(2)).toBe('2 scope items');

    const cards = applyAtticInsulationWithDrywallCards(
      draft.scopeChecklist?.items || [],
      notes
    );
    expect(cards.map(item => item.id)).toEqual(['drywall', 'insulation']);
    expect(
      checklistDisplayHelper(
        cards.find(item => item.id === 'insulation')!,
        'room_remodel'
      )
    ).toBe('R-38 attic insulation. Uses the attic area from the notes.');
    expect(
      checklistDisplayHelper(
        cards.find(item => item.id === 'drywall')!,
        'room_remodel'
      )
    ).toBe('Hang and finish the drywall named in the notes.');
    expect(cards.find(item => item.id === 'insulation')?.label).toBe(
      'Attic insulation'
    );
    expect(
      groupScopeChecklistItems(cards, 'room_remodel', { notes }).map(
        group => group.title
      )
    ).toEqual(['Attic insulation', 'Drywall hang / finish']);
    const drywallQuantity = resolveChecklistItemQuantity(
      'drywall',
      draft.scopeMeasurements || {},
      { templateKey: 'room_remodel', notes }
    );
    const drywallPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      draft.scopeMeasurements || {},
      'room_remodel',
      drywallQuantity,
      null,
      null,
      notes
    );
    expect(drywallPrice.fill).toMatchObject({
      material: 680,
      labor: 1000,
      total: 1680,
    });
  });

  it('prices a concrete patio and sod without a second blank flatwork line', () => {
    const notes =
      'Concrete and landscaping Pour a 400 sqft concrete patio and install 600 sqft of sod.';
    expect(notesImplyExteriorFlatwork(notes)).toBe(true);
    expect(notesImplyStructuralFoundation(notes)).toBe(false);
    expect(
      notesImplyExteriorFlatwork(
        'New 1,960 sqft single-story home with an attached 720 sqft 3-car garage and a 240 sqft covered patio.'
      )
    ).toBe(false);

    const draft = {
      originalNotes: notes,
      projectType: 'other',
      projectTitle: 'Mixed exterior hardscape',
      estimateTier: 'room_remodel',
      scopeMode: 'mixed',
      requiresScopeConfirmation: true,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['concrete', 'landscaping'],
        scopeSummary: 'Mixed exterior hardscape',
      },
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          {
            id: 'pour_flatwork',
            label: 'Concrete patio installation',
            state: 'included',
            helperText:
              'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab.',
          },
          {
            id: 'concrete_patio',
            label: 'Concrete patio / flatwork',
            state: 'included',
            helperText:
              'Work detected in notes and mapped to the existing pricing catalog.',
          },
          { id: 'sod_turf', label: 'Sod', state: 'included' },
        ],
      },
      scopeMeasurements: {
        concretePatioSqft: 400,
        concreteSqft: 400,
        sodSqft: 600,
        concreteAreaByType: { patios: 400 },
        concreteThicknessByType: { patios: 4 },
      },
      scopePackages: [],
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Concrete patio', quantity: '400 sqft' },
      { name: 'Sod', quantity: '600 sqft' },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealDisplayTitle(draft)).toBe('Concrete patio and sod');
    expect(getInitialRevealTagline(draft)).toBe('Concrete · Landscaping');

    const cards = applyConcretePatioWithSodCards(
      draft.scopeChecklist?.items || [],
      notes
    );
    expect(cards.map(item => item.id)).toEqual(['pour_flatwork', 'sod_turf']);
    expect(
      checklistDisplayHelper(
        cards.find(item => item.id === 'pour_flatwork')!,
        'concrete'
      )
    ).toBe('Concrete patio slab. Uses the patio area from the notes.');
    expect(
      checklistDisplayHelper(
        cards.find(item => item.id === 'sod_turf')!,
        'concrete'
      )
    ).toBe('Sod install. Uses the sod area from the notes.');
    expect(
      groupScopeChecklistItems(cards, 'concrete', { notes }).map(
        group => group.title
      )
    ).toEqual(['Concrete patio', 'Sod']);
    expect(
      quickMeasurementRowsForInput('concrete', 'other', {}, [], {
        scopeNotes: notes,
      })
        .flat()
        .map(field => field.label)
    ).toEqual(['Concrete patio', 'Sod']);
  });

  it('keeps shower tile and 80 sqft of LVP as two jobs', () => {
    const notes =
      'Bathroom and flooring Replace the shower tile and install 80 sqft of LVP in the bathroom.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: notes,
        projectType: 'bathroom',
        projectTitle: 'Bathroom Tile and LVP Flooring',
        scopeMode: 'dedicated',
        whatAiDid: ['Detected bathroom remodel.'],
        classification: {
          scopeMode: 'dedicated',
          detectedTrades: ['bathroom'],
        },
        scopeChecklist: {
          templateKey: 'bathroom',
          items: [
            { id: 'wet_area_install', label: 'Wet area install', state: 'included' },
            { id: 'shower_tile', label: 'Shower wall tile', state: 'included' },
          ],
        },
        scopeMeasurements: { showerWallTileSqft: 80 },
      } as EstimateAiDraft,
      notes
    );

    expect(repaired.scopeMode).toBe('mixed');
    expect(repaired.scopeChecklist?.templateKey).toBe('room_remodel');
    expect(repaired.scopeChecklist?.items.map(item => item.id)).toEqual([
      'demo',
      'shower_tile',
      'waterproofing',
      'flooring_lvp',
    ]);
    expect(repaired.scopeMeasurements?.showerWallTileSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(80);
    expect(repaired.scopeMeasurements?.floorDemoSqft).toBeUndefined();
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Shower tile demo', quantity: undefined },
      { name: 'Shower wall tile', quantity: undefined },
      { name: 'Shower waterproofing', quantity: undefined },
      { name: 'LVP flooring', quantity: '80 sqft' },
    ]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([
      'Price needed for Shower wall tile',
    ]);
    expect(getInitialRevealDisplayTitle(repaired)).toBe('Bathroom tile and LVP');
    expect(getInitialRevealTagline(repaired)).toBe('Bathroom · Flooring');
    expect(
      getInitialRevealStatusLabel(
        repaired,
        getInitialRevealConfirmItems(repaired).pricingScope.length
      ).label
    ).toBe('Mostly ready · 1 to check');

    const lvpQuantity = resolveChecklistItemQuantity(
      'flooring_lvp',
      repaired.scopeMeasurements || {},
      { templateKey: 'room_remodel', notes }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'flooring_lvp',
        repaired.scopeMeasurements || {},
        'room_remodel',
        lvpQuantity,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 280,
      labor: 280,
      total: 560,
    });
    const floorDemoQuantity = resolveChecklistItemQuantity(
      'floor_demo',
      repaired.scopeMeasurements || {},
      { templateKey: 'room_remodel', notes }
    );
    expect(floorDemoQuantity.pricingReady).toBe(false);
    expect(
      resolveScopeItemSuggestedPricing(
        'floor_demo',
        repaired.scopeMeasurements || {},
        'room_remodel',
        floorDemoQuantity,
        null,
        null,
        notes
      ).fill
    ).toBeNull();
    const showerQuantity = resolveChecklistItemQuantity(
      'shower_tile',
      repaired.scopeMeasurements || {},
      { templateKey: 'room_remodel', notes }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'shower_tile',
        repaired.scopeMeasurements || {},
        'room_remodel',
        showerQuantity,
        null,
        null,
        notes
      ).fill
    ).toBeNull();
    // Confirm scope fills the typical one-bath wall allowance (80 sqft).
    // That figure matches the LVP area and still prices on the shower rate.
    expect(
      resolveScopeItemSuggestedPricing(
        'shower_tile',
        {
          ...(repaired.scopeMeasurements || {}),
          showerWallTileSqft: 80,
        },
        'room_remodel',
        { quantity: 80, unit: 'sqft', quantitySource: 'inferred' },
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 640,
      labor: 1440,
      total: 2080,
    });
    expect(
      resolveScopeItemSuggestedPricing(
        'demo',
        {
          ...(repaired.scopeMeasurements || {}),
          showerWallTileSqft: 90,
        },
        'room_remodel',
        { quantity: 90, unit: 'sqft', quantitySource: 'user_entered' },
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 45,
      labor: 450,
      total: 495,
    });
    expect(
      resolveScopeItemSuggestedPricing(
        'waterproofing',
        {
          ...(repaired.scopeMeasurements || {}),
          showerWallTileSqft: 90,
        },
        'room_remodel',
        { quantity: 90, unit: 'sqft', quantitySource: 'user_entered' },
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 450,
      labor: 630,
      total: 1080,
    });
  });

  it('prices stated shower walls and LVP without a floor tear-out', () => {
    const notes =
      'Replace the shower tile, 80 sqft of shower walls, and install 80 sqft of LVP in the bathroom.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: notes,
        projectType: 'bathroom',
        scopeMode: 'dedicated',
        scopeChecklist: {
          templateKey: 'bathroom',
          items: [{ id: 'shower_tile', label: 'Shower wall tile', state: 'included' }],
        },
      } as EstimateAiDraft,
      notes
    );
    const measurements = repaired.scopeMeasurements || {};
    expect(repaired.scopeChecklist?.items.map(item => item.id)).toEqual([
      'demo',
      'shower_tile',
      'waterproofing',
      'flooring_lvp',
    ]);
    expect(measurements.showerWallTileSqft).toBe(80);
    expect(measurements.flooringLvpSqft).toBe(80);
    expect(measurements.floorDemoSqft).toBeUndefined();
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row => ({
        name: row.name,
        quantity: row.quantity,
      }))
    ).toEqual([
      { name: 'Shower tile demo', quantity: '80 sqft' },
      { name: 'Shower wall tile', quantity: '80 sqft' },
      { name: 'Shower waterproofing', quantity: '80 sqft' },
      { name: 'LVP flooring', quantity: '80 sqft' },
    ]);
    expect(
      groupScopeChecklistItems(
        repaired.scopeChecklist?.items || [],
        'room_remodel',
        { notes }
      ).map(group => group.title)
    ).toEqual([
      'Shower tile demo',
      'Shower wall tile',
      'Shower waterproofing',
      'LVP flooring',
    ]);
    const price = (id: string) => {
      const quantity = resolveChecklistItemQuantity(id, measurements, {
        templateKey: 'room_remodel',
        notes,
      });
      expect(quantity.quantitySource).toBe('notes');
      return resolveScopeItemSuggestedPricing(
        id,
        measurements,
        'room_remodel',
        quantity,
        null,
        null,
        notes
      ).fill;
    };
    expect(price('demo')).toMatchObject({ material: 40, labor: 400, total: 440 });
    expect(price('shower_tile')).toMatchObject({
      material: 640,
      labor: 1440,
      total: 2080,
    });
    expect(price('waterproofing')).toMatchObject({
      material: 400,
      labor: 560,
      total: 960,
    });
    expect(price('flooring_lvp')).toMatchObject({
      material: 280,
      labor: 280,
      total: 560,
    });
  });

  it('keeps Scope found to the framing shell for a framing-only addition', () => {
    const notes = 'Frame a 600 sqft addition';
    const draft = {
      originalNotes: notes,
      projectType: 'room_addition',
      scopeChecklist: {
        templateKey: 'addition',
        items: [
          { id: 'foundation', label: 'Footings / slab / foundation', state: 'included' },
          { id: 'concrete', label: 'Concrete', state: 'included' },
          { id: 'framing', label: 'Framing / shell', state: 'included' },
          { id: 'drywall', label: 'Drywall', state: 'included' },
          { id: 'paint', label: 'Interior paint', state: 'included' },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(['Framing / shell']);
  });

  it('keeps Scope found to rough openings when new walls are denied', () => {
    const notes = 'Do not frame any new walls. Frame four rough openings.';
    const draft = {
      originalNotes: notes,
      projectType: 'room_remodel',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'openings',
            label: 'Door / window openings',
            state: 'included',
          },
          {
            id: 'paint',
            label: 'Interior painting',
            state: 'included',
          },
          {
            id: 'framing',
            label: 'Framing or layout changes',
            state: 'included',
          },
        ],
        scopeFacts: [
          {
            scopeId: 'interior_paint',
            status: 'included',
            catalogEntry: { displayName: 'Interior paint' },
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(['Door / window openings']);
  });

  it('sends a bare plumbing note to confirm scope', () => {
    const draft = {
      projectType: 'plumbing',
      projectTitle: 'Plumbing',
      estimateTier: 'simple_unit',
      originalNotes: 'Plumbing.',
      scopePackages: [{ name: 'Plumbing', status: 'missing_price' }],
    } as EstimateAiDraft;
    expect(draftNeedsScopeConfirmation(draft)).toBe(true);
    expect(aiFlowStepTotal(draft)).toBe(3);
    expect(
      getInitialRevealPrimaryCtaLabel(
        1,
        draftNeedsScopeConfirmation(draft)
      )
    ).toBe('Confirm scope');
  });

  it('builds primary CTA from attention count', () => {
    expect(getInitialRevealPrimaryCtaLabel(0)).toBe('Review & apply estimate');
    expect(getInitialRevealPrimaryCtaLabel(3)).toBe(
      'Continue to review · 3 to check'
    );
    expect(getInitialRevealPrimaryCtaLabel(0, true)).toBe('Confirm scope');
  });

  it('prefers scope items over admin fields on reveal', () => {
    const draft = {
      stillNeededReview: [
        'Customer name',
        'Pricing for tile demo',
        'Project address',
      ],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const { items } = getInitialRevealPriorityItems(draft, 2);
    expect(items[0]).toContain('tile demo');
  });

  it('splits pricing gaps from bid admin details', () => {
    const buckets = splitInitialRevealConfirmItems([
      'Pricing for tile demo',
      'Customer name',
      'Start date',
    ]);
    expect(buckets.pricingScope).toEqual(['Price needed for tile demo']);
    expect(buckets.bidDetails).toEqual(['Customer name', 'Start date']);
  });

  it('highlights unpriced bath fan and vanity lights on Scope found', () => {
    const draft = {
      estimateTier: 'room_remodel',
      requiresScopeConfirmation: true,
      scopeMode: 'dedicated',
      projectType: 'bathroom',
      originalNotes:
        'Replace the exhaust fan with a new bath fan and run the duct to the existing roof cap. Install new vanity lighting over the mirror, two fixtures. The tub, shower, floor tile, and vanity cabinet all stay. Do not demo any tile, do not replace the toilet, and do not paint the walls.',
      scopeChecklist: { templateKey: 'bathroom', items: [] },
      scopePackages: [{ name: 'Vanity', status: 'missing_price' }],
    } as EstimateAiDraft;
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Price needed for Vanity lighting · 2 fixtures',
      'Price needed for Bath exhaust fan',
    ]);
  });

  it('builds confirm buckets from draft — scope/pricing only', () => {
    const draft = {
      stillNeededReview: [
        'Customer name',
        'Pricing for tile demo',
        'Project address',
      ],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope.some(item => /tile demo/i.test(item))).toBe(
      true
    );
    expect(buckets.bidDetails).toEqual([]);
  });

  it('does not show explicitly excluded electrical service pricing', () => {
    const draft = {
      originalNotes:
        'Replace the existing HVAC system and ductwork, then install a new HVAC system with thermostat, supply registers, return grilles, startup, and testing. Excludes plumbing, electrical service upgrades, and building repairs.',
      stillNeededReview: ['Pricing for Service upgrade'],
      needsReviewItems: [],
      scopePackages: [],
      scopeMeasurements: {},
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).not.toContain(
      'Price needed for Service upgrade'
    );
  });

  it('labels scope meta separately from checklist gaps', () => {
    expect(getInitialRevealScopeMetaLabel(7)).toBe('7 scope items');
    expect(getInitialRevealScopeMetaLabel(1)).toBe('1 scope item');
  });

  it('expands scope by default when scope items exist', () => {
    expect(shouldDefaultExpandInitialRevealScope(7)).toBe(true);
    expect(shouldDefaultExpandInitialRevealScope(9)).toBe(true);
    expect(shouldDefaultExpandInitialRevealScope(0)).toBe(false);
  });

  it('shows planning disclaimer when total exists and gaps remain', () => {
    expect(
      getInitialRevealPlanningDisclaimer(
        {
          heroTotal: 8976,
          heroTotalLabel: 'Initial estimate (incl. markup)',
          markupPct: 20,
          material: 2530,
          labor: 4950,
          allowance: null,
          estimatedWithMarkup: 8976,
          scopeItemCount: 7,
        },
        10
      )
    ).toBe('Planning estimate — review before sending');
  });

  it('hides what we found when it duplicates the tagline', () => {
    expect(
      shouldShowInitialRevealWhatWeFound(
        ['Detected bathroom remodel job.'],
        'Detected bathroom remodel job.'
      )
    ).toBe(false);
    expect(
      shouldShowInitialRevealWhatWeFound(
        ['Organized Tub Removal / Demo: 1 each — pricing needed.'],
        'Detected bathroom remodel job.'
      )
    ).toBe(true);
  });

  it('drops stale pre-confirm pricing gaps after Confirm Scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      confirmedAssumptions: [{ id: 'baseboard', state: 'included' }],
      stillNeededReview: [
        'Material rate per LF',
        'Labor install rate per LF',
        'Caulk & paint',
        'Material and labor pricing',
      ],
      needsReviewItems: ['Pricing total not found in notes'],
      scopePackages: [
        { name: 'Baseboard Installation', status: 'confirmed', price: 1500 },
        { name: 'Interior Paint', status: 'confirmed', price: 8000 },
      ],
      scopeMeasurements: {
        itemQuantities: {
          trim_paint: {
            quantity: '200',
            unit: 'lf',
            quantitySource: 'user_entered',
          },
          trim_paint__material: {
            quantity: '400',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          trim_paint__labor: {
            quantity: '1100',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          trim_paint: { selectionStatus: 'accepted', totalAmount: 1500 },
        },
      },
    } as EstimateAiDraft;
    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope).not.toContain('Material rate per LF');
    expect(buckets.pricingScope).not.toContain('Labor install rate per LF');
    expect(buckets.pricingScope).not.toContain('Caulk & paint');
    expect(buckets.pricingScope).not.toContain(
      'Pricing total not found in notes'
    );
  });

  it('drops price-needed lines after the selected cards are the bid', () => {
    const draft = {
      projectType: 'new_build',
      estimateTier: 'ground_up',
      originalNotes:
        'New 1,840 sqft one-story home with an attached 440 sqft 2-car garage and a 12 by 16 covered patio. Brick exterior. Owner is taking care of sitework and utilities separate from us.',
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'ground_up', items: [] },
      scopePackages: [
        {
          checklistItemId: 'exterior_paint',
          name: 'Exterior paint',
          status: 'missing_price',
          price: 0,
        },
        {
          checklistItemId: 'permits',
          name: 'Permits / fees (incl. impact)',
          status: 'confirmed',
          price: 32000,
        },
      ],
      scopeMeasurements: {
        pricingAcceptance: {
          permits: { selectionStatus: 'accepted', totalAmount: 32000 },
          brick: { selectionStatus: 'accepted', totalAmount: 26298 },
        },
      },
      stillNeededReview: ['Pricing for Exterior paint'],
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/price needed|pricing for/i)])
    );
    expect(
      getScopeTotalCoverageLine(draft, {
        missingPriceCount: 1,
        scopeItemCount: 29,
      })
    ).toBeNull();
  });

  it('shows placeholder hero when no total yet', () => {
    const display = getInitialRevealHeroDisplay(
      {
        heroTotal: null,
        heroTotalLabel: 'Initial estimate',
        markupPct: null,
        material: null,
        labor: null,
        allowance: null,
        estimatedWithMarkup: null,
        scopeItemCount: 6,
      },
      true
    );
    expect(display.amountText).toBe('—');
    expect(display.hint).toContain('Confirm scope');
  });

  it('shows markup subline under hero hint when markup is applied', () => {
    const display = getInitialRevealHeroDisplay(
      {
        heroTotal: 32111.2,
        heroTotalLabel: 'Initial estimate (incl. markup)',
        markupPct: 15,
        material: 7312.5,
        labor: 19446.83,
        allowance: null,
        estimatedWithMarkup: 32111.2,
        scopeItemCount: 9,
      },
      false
    );
    expect(display.markupSubline).toBe('15% markup');
  });

  it('uses project title for display heading', () => {
    const draft = { projectTitle: 'Master bath remodel' } as EstimateAiDraft;
    expect(getInitialRevealDisplayTitle(draft)).toBe('Master bath remodel');
  });

  it('uses the canonical mixed classification for the Scope found hero', () => {
    const fixture = classificationFixtures.find(
      item => item.id === 'framing_plus_flooring'
    )!;
    const draft = {
      projectTitle: 'Flooring',
      projectType: fixture.expected.projectType,
      classification: {
        scopeMode: fixture.expected.scopeMode,
        primaryTrade: null,
        detectedTrades: fixture.expected.detectedTrades,
        scopeSummary: 'Mixed-scope construction',
        evidence: [],
        exclusions: [],
        confidence: 'high',
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe(
      'Mixed-scope construction'
    );
    expect(getInitialRevealTagline(draft)).toBe('Framing · Flooring');
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual([
      'Framing',
      'Flooring',
    ]);
  });

  it('keeps a new home with a driveway from the mixed exterior title', () => {
    const notes =
      'New 1,960 sqft single-story home with an attached 3-car garage. Brick veneer, concrete driveway and front walks, builder-grade interior. Owner is handling landscaping only.';
    const draft = {
      projectTitle: 'Concrete',
      projectType: 'concrete',
      originalNotes: notes,
      classification: {
        scopeMode: 'dedicated',
        detectedTrades: ['concrete', 'landscaping'],
        scopeSummary: null,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe(
      'New 1,960 Sq Ft Single-Story Home'
    );
    expect(getInitialRevealTagline(draft) || '').not.toContain(
      'Mixed exterior hardscape'
    );
    expect(
      getInitialRevealChecklistScopePreview({
        ...draft,
        scopeChecklist: {
          templateKey: 'concrete',
          items: [
            {
              id: 'pour_flatwork',
              label: 'Exterior concrete flatwork',
              state: 'included',
            },
          ],
        },
      } as EstimateAiDraft).map(row => row.name)
    ).toEqual([
      '1,960 sqft single-story home',
      'Attached 3-car garage',
      'Brick exterior',
      'Exterior concrete flatwork',
    ]);
  });

  it('reads a new house as a new house, and leaves a denied deck off the scope list', () => {
    const notes =
      'New 1,960 sqft single-story home with an attached 3-car garage. Slab foundation, frame, roof, windows and exterior doors, insulation, drywall, builder-grade flooring, paint, plumbing, electrical, and HVAC. Concrete driveway and front walks. Brick veneer. Owner is handling landscaping only. No deck.';
    const draft = {
      projectTitle: 'Mixed-scope remodel',
      projectType: 'new_build',
      originalNotes: notes,
      classification: {
        scopeMode: 'mixed',
        detectedTrades: ['framing', 'plumbing', 'electrical'],
        scopeSummary: 'Mixed-scope remodel',
      },
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'windows', label: 'Windows', state: 'included' },
          { id: 'window_install', label: 'Window install', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', state: 'included' },
          { id: 'plumbing', label: 'Plumbing connections', state: 'included' },
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
          { id: 'decking', label: 'Deck', state: 'included' },
          { id: 'cabinets', label: 'Cabinets', state: 'included' },
          { id: 'interior_trim', label: 'Finish carpentry', state: 'included' },
          { id: 'framing', label: 'Framing', state: 'included' },
          { id: 'tile_flooring', label: 'Tile & flooring', state: 'included' },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe(
      'New 1,960 Sq Ft Single-Story Home'
    );
    expect(getInitialRevealTagline(draft)).toBe('Detected new build.');
    const names = getInitialRevealChecklistScopePreview(draft).map(row => row.name);
    expect(names).toContain('1,960 sqft single-story home');
    expect(names).toContain('Attached 3-car garage');
    expect(names).toContain('Brick exterior');
    expect(names).toContain('Windows');
    expect(names).toContain('Cabinets');
    expect(names).toContain('Finish carpentry');
    expect(names).toContain('Counters');
    expect(names).toContain('Garage doors');
    expect(names).toContain('Exterior concrete flatwork');
    expect(names).toContain('Tile & flooring');
    expect(names).not.toContain('Flooring installation');
    expect(names).not.toContain('Deck');
    expect(names).not.toContain('Plumbing connections');
    expect(names).not.toContain('Window install');
    expect(names).toContain('Plumbing rough-in');
    const attention = getInitialRevealConfirmItems(draft).pricingScope;
    expect(attention[0]).toBe('Deck is not in this bid');
    expect(attention[1]).toBe('Landscaping is not in this bid');
  });

  it('drops grading that only came from builder-grade finishes', () => {
    const notes =
      'New 1,960 sqft single-story home with an attached 720 sqft 3-car garage and a 240 sqft covered patio. Brick exterior. Standard builder-grade finishes.';
    const draft = {
      originalNotes: notes,
      projectType: 'ground_up',
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          {
            id: 'grading',
            label: 'Grading',
            state: 'included',
            noteBacked: true,
          },
        ],
        scopeFacts: [{ scopeId: 'grading', status: 'included' }],
      },
    } as EstimateAiDraft;

    expect(inferItemStateFromNotes('grading', notes)).toBe('unsure');
    expect(notesDescribeGroundUpHome(notes)).toBe(true);
    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).toEqual([
      '1,960 sqft single-story home',
      '720 sqft 3-car garage',
      '240 sqft covered patio',
      'Brick exterior',
    ]);
  });

  it('labels mixed exterior hardscape instead of the concrete trade title', () => {
    const notes =
      'Remove existing landscaping, pavers, and concrete as needed, then install 1,000 sqft sod, 400 sqft pavers, 12 shrubs, 30 tons decorative rock, irrigation adjustments, edging, a retaining wall, a 500 sqft concrete patio, and two exterior doors.';
    const draft = {
      projectTitle: 'Concrete',
      projectType: 'concrete',
      originalNotes: notes,
      classification: {
        scopeMode: 'dedicated',
        detectedTrades: [
          'windows_doors',
          'concrete',
          'landscaping',
          'deck_patio',
        ],
        scopeSummary: null,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe(
      'Mixed exterior hardscape'
    );
    expect(getInitialRevealTagline(draft)).toContain(
      'Mixed exterior hardscape · Concrete · Landscaping · Exterior doors'
    );
  });

  it('does not call a paver walkway mixed exterior hardscape', () => {
    const notes =
      'Clear and grade 1,200 sqft. Install irrigation, 800 sqft of sod, mulch, plants, and a paver walkway.';
    const draft = {
      projectTitle: 'Landscaping',
      projectType: 'landscaping',
      originalNotes: notes,
      classification: {
        scopeMode: 'dedicated',
        detectedTrades: ['landscaping'],
        scopeSummary: null,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Landscaping');
    expect(getInitialRevealTagline(draft) || '').not.toContain(
      'Mixed exterior hardscape'
    );
  });

  it('keeps a painting plan export as one painting scope', () => {
    const draft = {
      projectTitle: 'Concrete',
      projectType: 'concrete',
      originalNotes:
        'Covered Patio 322 sqft, concrete flatwork, and exterior doors from the architectural set. --- Plan takeoff ---',
      scopeChecklist: { templateKey: 'painting', items: [] },
      scopeMeasurements: { planImportTradeKey: 'painting', planImportMode: 'selected_trade' },
      classification: {
        scopeMode: 'dedicated',
        detectedTrades: [
          'concrete',
          'windows_doors',
          'painting',
          'trim',
          'bathroom',
        ],
        scopeSummary: null,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Painting');
    expect(getInitialRevealTagline(draft)).toBeNull();
  });

  it('does not let a flooring project title hide mixed insulation work', () => {
    const notes =
      'Remove existing insulation where necessary, then install R-21 batt insulation in 2,000 sqft walls, R-38 blown insulation in 1,200 sqft attic, R-30 floor insulation in 900 sqft, include gap sealing, repair drywall, install flooring, replace four windows, and paint.';
    const draft = {
      projectTitle: 'Flooring',
      projectType: 'flooring',
      originalNotes: notes,
      scopeMode: 'dedicated',
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Mixed-scope remodel');
  });

  it('keeps mixed framing scope rows specific to the notes', () => {
    const notes =
      'Demolish existing nonstructural walls, then frame 1,600 sqft of walls with headers, blocking, two door openings, structural sheathing, six windows, two exterior doors, R-21 insulation, 1,600 sqft drywall, flooring, and paint.';
    const draft = {
      projectType: 'other',
      scopeMode: 'mixed',
      originalNotes: notes,
      requiresScopeConfirmation: true,
      classification: {
        scopeMode: 'mixed',
        primaryTrade: null,
        detectedTrades: [
          'framing',
          'flooring',
          'drywall',
          'painting',
          'windows_doors',
          'insulation',
        ],
        scopeSummary: 'Mixed-scope construction',
        evidence: [],
        exclusions: [],
        confidence: 'high',
      },
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'demo',
            label: 'Nonstructural wall demolition',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'framing',
            label: 'Wall framing, headers & blocking',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'drywall',
            label: 'Drywall hang / finish',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'flooring',
            label: 'Flooring installation',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'paint',
            label: 'Interior wall and ceiling painting',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'insulation',
            label: 'Insulation',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'openings',
            label: 'Door / window openings',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'window_install',
            label: 'Window installation',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'exterior_doors',
            label: 'Exterior swing doors',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'shear_sheathing',
            label: 'Structural sheathing',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'trim',
            label: 'Baseboards, trim & molding',
            state: 'unsure',
            noteBacked: false,
          },
        ],
      },
    } as EstimateAiDraft;

    const labels = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(labels).toEqual([
      'Nonstructural wall demolition',
      'Wall framing, headers & blocking',
      'Drywall hang / finish',
      'Flooring installation',
      'Interior paint',
      'Insulation',
      'Door / window openings',
      'Window install',
      'Exterior swing doors',
      'Structural sheathing',
    ]);
  });

  it('fills Scope found with plumbing note bullets and checklist preview', () => {
    const draft = {
      projectTitle: 'Plumbing bid',
      projectType: 'plumbing',
      originalNotes:
        '12 plumbing rough-in points. 150 LF of water line. 80 LF sewer line. 2 water heaters.',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
          { id: 'water_line', label: 'Water line', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;
    expect(getInitialRevealTagline(draft)).toContain('2 scope lines');
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual(
      expect.arrayContaining(['12 rough-in points', '150 LF water line'])
    );
    expect(getInitialRevealChecklistScopePreview(draft)).toHaveLength(2);
  });

  it('shows ground-up plumbing scope and missing line quantities as attention', () => {
    const draft = {
      projectType: 'plumbing',
      projectTitle: 'Kitchen plumbing',
      originalNotes:
        'Plumbing rough-in for ground-up construction: Install underground and above-slab DWV piping, domestic hot and cold water lines, vent piping, hose-bib lines, and connections for all fixtures shown on plans. Set fixture stub-outs at kitchen, bathrooms, laundry, and utility areas. Pressure-test water lines and inspect/test drain and vent systems before concealment. Excludes fixtures, trim, excavation beyond plumbing trenches, utility tap fees, and final connections.',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'new_construction',
        plumbingRoomContext: 'whole_house',
      },
      scopePackages: [],
      stillNeededReview: [],
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Whole-house plumbing');
    expect(getInitialRevealTagline(draft)).toBe(
      'Whole-house plumbing · 3 scope lines'
    );
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual([
      'Plumbing rough-in',
      'Water line piping',
      'Sewer / DWV piping',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(
      expect.arrayContaining([
        'Plumbing rough-in',
        'Water line piping',
        'Sewer / DWV piping',
      ])
    );
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual(
      expect.arrayContaining([
        'Measurement needed for Water line piping',
        'Measurement needed for Sewer / DWV piping',
      ])
    );
  });

  it('keeps mixed bathroom scope rows aligned with explicit note language', () => {
    const draft = {
      projectType: 'bathroom',
      originalNotes:
        'Remove existing bathroom fixtures, then reroute 25 LF bathroom plumbing and install a toilet, vanity, faucet, shower valve, 90 sqft flooring, 120 sqft drywall repair, 40 LF cabinets, two windows, insulation, and paint.',
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          {
            id: 'demo',
            label: 'Shower tile demo / tear-out',
            state: 'included',
          },
          {
            id: 'fixture_demo',
            label: 'Remove existing toilet & plumbing fixtures',
            state: 'included',
          },
          {
            id: 'vanity',
            label: 'Vanity & countertop',
            state: 'included',
          },
          {
            id: 'cabinets',
            label: 'Stock cabinet supply & installation',
            state: 'included',
          },
          {
            id: 'plumbing',
            label: 'Plumbing connections',
            state: 'included',
          },
          {
            id: 'paint_repair',
            label: 'Interior painting/patch and repair',
            state: 'included',
          },
          { id: 'interior_paint', label: 'Interior paint', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).not.toContain('Shower tile demo / tear-out');
    expect(names).toContain('Remove existing toilet & plumbing fixtures');
    expect(names).toContain('Vanity installation');
    expect(names).toContain('40 LF cabinets');
    expect(names).toContain('Plumbing reroute · 25 LF');
    expect(names).toContain('Interior painting/patch and repair');
    expect(names).toContain('Drywall repair · 120 sqft');
    expect(names).toContain('Insulation');
    expect(names).toContain('Faucet & shower valve');
    expect(names).not.toContain('Flooring demo / removal');
    expect(names).not.toContain('Bathroom floor demo / removal');
    expect(names).not.toContain('Kitchen remodel measurements');
    expect(names).not.toContain('Interior paint');

    const attention = getInitialRevealConfirmItems({
      ...draft,
      stillNeededReview: [
        'Pricing for Shower tile demo / tear-out',
        'Pricing for Interior paint',
      ],
    }).pricingScope;
    expect(attention).not.toContain(
      'Price needed for Shower tile demo / tear-out'
    );
    expect(attention).not.toContain('Price needed for Interior paint');
  });

  it('does not let a stale standalone plumbing template hide mixed bathroom scope', () => {
    const notes =
      'Remove existing bathroom fixtures, then reroute 25 LF bathroom plumbing and install a toilet, vanity, faucet, shower valve, 90 sqft flooring, 120 sqft drywall repair, 40 LF cabinets, two windows, insulation, and paint.';
    const draft = {
      projectType: 'plumbing',
      projectTitle: 'Bathroom plumbing',
      originalNotes: notes,
      classification: {
        scopeMode: 'mixed',
        primaryTrade: 'bathroom',
        detectedTrades: ['plumbing', 'drywall', 'flooring', 'painting'],
        scopeSummary: 'Mixed-scope remodel',
        evidence: [],
        exclusions: [],
        confidence: 'high',
      },
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          { id: 'drywall', label: 'Drywall', state: 'included' },
          { id: 'insulation', label: 'Insulation', state: 'included' },
          {
            id: 'plumbing',
            label: 'Faucet & shower valve',
            state: 'included',
          },
          {
            id: 'plumbing_rough',
            label: 'Plumbing reroute',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: { tradeWorkflowSource: 'standalone_trade' },
      scopePackages: [],
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Mixed-scope remodel');
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(
      expect.arrayContaining([
        'Drywall',
        'Insulation',
        'Faucet & shower valve',
        'Plumbing reroute · 25 LF',
        'Remove existing toilet & plumbing fixtures',
        'Vanity installation',
        'Toilet installation',
        'Flooring installation',
        '40 LF cabinets',
        'Window install',
        'Interior painting/patch and repair',
      ])
    );
  });

  it('keeps detected bathroom scope visible when pricing packages are partial', () => {
    const draft = {
      projectType: 'bathroom',
      originalNotes: 'Install shower wall tile, lighting, and a new toilet.',
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'shower_tile', label: 'Shower wall tile', state: 'included' },
          {
            id: 'lighting',
            label: 'New lighting fixtures & install',
            state: 'included',
          },
          { id: 'toilet', label: 'Toilet', state: 'included' },
        ],
      },
      scopePackages: [
        {
          checklistItemId: 'toilet',
          name: 'Toilet installation',
          total: 400,
        },
      ],
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(
      expect.arrayContaining([
        'Shower wall tile',
        'New lighting fixtures & install',
        'Toilet',
      ])
    );
  });

  it('surfaces bare doors as interior door installation on Scope found', () => {
    const draft = {
      projectType: 'bathroom',
      originalNotes:
        'Remodel the bathroom with drywall, doors, insulation, trim, electrical, and paint.',
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'drywall', label: 'Drywall', state: 'included' },
          { id: 'insulation', label: 'Insulation', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(expect.arrayContaining(['Interior door installation']));
  });

  it('does not turn insulation removal into flooring demo scope', () => {
    const notes =
      'Remove existing insulation where necessary, then install R-21 batt insulation in 2,000 sqft walls, R-38 blown insulation in 1,200 sqft attic, R-30 floor insulation in 900 sqft, include gap sealing, repair drywall, install flooring, replace four windows, and paint.';
    const draft = {
      projectType: 'other',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'demo', label: 'Existing flooring removal', state: 'included' },
          { id: 'drywall', label: 'Drywall patch / repair', state: 'included' },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          {
            id: 'paint',
            label: 'Interior wall and ceiling painting',
            state: 'included',
          },
          {
            id: 'window_install',
            label: 'Window installation',
            state: 'included',
          },
          { id: 'insulation', label: 'Insulation', state: 'included' },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).toEqual(
      expect.arrayContaining(['Flooring installation', 'Insulation'])
    );
    expect(names).not.toContain('Existing flooring removal');
  });

  it('extracts mixed whole-home remodel scope without stale trade defaults', () => {
    const draft = {
      projectType: 'other',
      scopeMode: 'mixed',
      originalNotes:
        'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'demo',
            label: 'Nonstructural wall demolition',
            state: 'included',
          },
          { id: 'cabinet_demo', label: 'Cabinet removal', state: 'included' },
          { id: 'fixture_demo', label: 'Fixture removal', state: 'included' },
          {
            id: 'floor_demo',
            label: 'Existing flooring removal',
            state: 'included',
          },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          { id: 'drywall', label: 'Drywall patch / repair', state: 'included' },
          {
            id: 'window_install',
            label: 'Window installation',
            state: 'included',
          },
          {
            id: 'exterior_doors',
            label: 'Exterior door installation',
            state: 'included',
          },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
          { id: 'insulation', label: 'Attic insulation', state: 'included' },
          { id: 'air_sealing', label: 'Air sealing', state: 'included' },
          {
            id: 'trim',
            label: 'Trim & baseboard installation',
            state: 'included',
          },
          { id: 'plumbing', label: 'Plumbing', state: 'included' },
          { id: 'electrical', label: 'Electrical', state: 'included' },
          { id: 'interior_paint', label: 'Interior paint', state: 'included' },
          {
            id: 'door_paint',
            label: 'Interior door painting',
            state: 'included',
          },
          {
            id: 'door_casing_paint',
            label: 'Door casing / trim painting',
            state: 'included',
          },
          {
            id: 'exterior_trim_paint',
            label: 'Exterior trim, windows & doors',
            state: 'included',
          },
          {
            id: 'trim_paint',
            label: 'Baseboard and trim painting',
            state: 'included',
          },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);
    const names = preview.map(row => row.name);

    expect(preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Flooring installation',
          quantity: '1800 sqft',
        }),
        expect.objectContaining({
          name: 'Drywall repair · 500 sqft',
        }),
        expect.objectContaining({ name: 'Window install', quantity: '6 each' }),
        expect.objectContaining({
          name: 'Exterior door installation',
          quantity: '2 each',
        }),
        expect.objectContaining({
          name: 'Interior door installation',
          quantity: '4 each',
        }),
        expect.objectContaining({ name: 'Wall & attic insulation' }),
      ])
    );
    expect(
      preview.find(row => row.name === 'Wall & attic insulation')
    ).not.toHaveProperty('quantity');
    expect(names).toEqual(
      expect.arrayContaining([
        'Cabinet removal',
        'Fixture removal',
        'Flooring demo / removal',
        'Trim & baseboard installation',
        'Plumbing',
        'Electrical',
        'Interior paint',
      ])
    );
    expect(names).not.toContain('Kitchen flooring demo / removal');
    expect(names).not.toContain('Attic insulation');
    expect(names).not.toContain('Insulation');
    expect(names).not.toContain('Interior door painting');
    expect(names).not.toContain('Door casing / trim painting');
    expect(names).not.toContain('Exterior trim, windows & doors');
    expect(names).not.toContain('Baseboard and trim painting');
    expect(names).not.toContain('Air sealing');
    expect(names).not.toContain('Standard air sealing');
  });

  it('shows the applied window price on the initial estimate, not a price that was never applied', () => {
    const notes =
      'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.';
    const applied = {
      projectType: 'other',
      scopeAssumptionsConfirmed: true,
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'windows', label: 'Window install', state: 'excluded' },
          { id: 'window_install', label: 'Window install', state: 'included' },
        ],
      },
      scopeMeasurements: {
        windowCount: 6,
        itemQuantities: {
          windows__material: {
            quantity: '2790',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          windows__labor: {
            quantity: '1650',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          windows: {
            selectionStatus: 'accepted',
            totalAmount: 4440,
            materialAmount: 2790,
            laborAmount: 1650,
          },
        },
      },
      scopePackages: [
        {
          name: 'Window install',
          checklistItemId: 'window_install',
          status: 'missing_price',
          price: null,
        },
      ],
    } as EstimateAiDraft;
    const appliedRow = getInitialRevealChecklistScopePreview(applied).find(
      item => item.name === 'Window install'
    );
    expect(appliedRow?.quantity).toBe('6 each');
    expect(appliedRow?.amount).toBe(4440);
    const windowPkg = {
      name: 'Window install',
      checklistItemId: 'window_install',
      status: 'missing_price' as const,
      price: null,
    };
    expect(scopePackagePricedAmount(windowPkg, applied)).toBe(4440);
    expect(scopePackageNeedsManualPrice(windowPkg, applied)).toBe(false);

    const unapplied = {
      ...applied,
      scopeMeasurements: { windowCount: 6 },
    } as EstimateAiDraft;
    const unappliedRow = getInitialRevealChecklistScopePreview(unapplied).find(
      item => item.name === 'Window install'
    );
    expect(unappliedRow?.amount).toBe(0);
    expect(scopePackageNeedsManualPrice(windowPkg, unapplied)).toBe(true);
  });

  it('keeps door and trim painting when the note names them', () => {
    const notes =
      'Remodel a 2,000 sqft home. Paint the interior doors and paint the trim.';
    const draft = {
      projectType: 'other',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'door_paint',
            label: 'Interior door painting',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'trim_paint',
            label: 'Baseboard and trim painting',
            state: 'included',
            noteBacked: true,
          },
        ],
        scopeFacts: [
          {
            scopeId: 'door_paint',
            status: 'included',
            catalogEntry: { displayName: 'Interior door painting' },
          },
          {
            scopeId: 'trim_paint',
            status: 'included',
            catalogEntry: { displayName: 'Baseboard and trim painting' },
          },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).toContain('Interior door painting');
    expect(names).toContain('Baseboard and trim painting');
  });

  it('normalizes mixed flooring scope rows from explicit flooring notes', () => {
    const notes =
      'Remove and dispose of 1,200 sqft existing flooring, then install LVP with underlayment, transitions, 120 LF baseboard, two interior doors, 150 sqft drywall repair, four windows, R-21 wall insulation, and interior paint.';
    const draft = {
      projectType: 'flooring',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'demo',
            label: 'Nonstructural wall demolition',
            state: 'included',
          },
          { id: 'drywall', label: 'Drywall patch / repair', state: 'included' },
          { id: 'flooring', label: 'LVP flooring install', state: 'included' },
          {
            id: 'paint',
            label: 'Interior wall and ceiling painting',
            state: 'included',
          },
          { id: 'trim', label: 'Baseboard installation', state: 'included' },
          {
            id: 'baseboard_install',
            label: 'Baseboard installation',
            state: 'included',
          },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
          { id: 'insulation', label: 'Insulation', state: 'included' },
          {
            id: 'window_install',
            label: 'Window installation',
            state: 'included',
          },
          { id: 'underlayment', label: 'Underlayment', state: 'included' },
          {
            id: 'transitions',
            label: 'Transitions & reducers',
            state: 'included',
          },
        ],
      },
      scopePackages: [],
      stillNeededReview: ['Pricing for Nonstructural wall demolition'],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).toHaveLength(10);
    expect(names).toEqual(
      expect.arrayContaining([
        'Flooring demo / removal',
        'LVP flooring install',
        'Interior paint',
        'Baseboard installation',
        'Underlayment',
        'Transitions & reducers',
      ])
    );
    expect(names).not.toContain('Nonstructural wall demolition');
    expect(
      names.filter(name => name === 'Baseboard installation')
    ).toHaveLength(1);
    expect(names).not.toContain('Interior wall and ceiling painting');
    expect(getInitialRevealConfirmItems(draft).pricingScope).not.toContain(
      'Price needed for Nonstructural wall demolition'
    );
  });

  it('keeps mixed painting Scope found rows specific to the notes', () => {
    const notes =
      'Paint 2,000 sqft walls and ceilings with prep, demolition and removal of damaged drywall, six interior doors, 180 LF baseboard, 300 sqft drywall repair, 900 sqft flooring, three replacement windows, and R-30 attic insulation.';
    const draft = {
      projectType: 'painting',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'demo', label: 'Existing flooring removal', state: 'included' },
          { id: 'drywall', label: 'Drywall patch / repair', state: 'included' },
          { id: 'flooring', label: 'LVP flooring install', state: 'included' },
          {
            id: 'paint',
            label: 'Interior wall and ceiling painting',
            state: 'included',
          },
          { id: 'trim', label: 'Trim & doors', state: 'included' },
          { id: 'prep', label: 'Prep & Masking', state: 'included' },
          { id: 'interior_paint', label: 'Walls', state: 'included' },
          { id: 'ceiling_paint', label: 'Ceilings', state: 'included' },
          { id: 'wall_demo', label: 'Wall Demo', state: 'included' },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
          {
            id: 'window_install',
            label: 'Window & trim installation',
            state: 'included',
          },
          { id: 'insulation', label: 'Insulation', state: 'included' },
        ],
      },
      scopePackages: [],
      stillNeededReview: [
        'Pricing for Interior Painting',
        'Pricing for tile demo',
        'Pricing for Interior Doors',
        'Pricing for HVAC',
      ],
    } as EstimateAiDraft;

    const names = getInitialRevealChecklistScopePreview(draft).map(
      row => row.name
    );
    expect(names).toHaveLength(9);
    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual([
      'Drywall demo / removal',
      'Drywall patch / repair',
    ]);
    expect(names).toEqual(
      expect.arrayContaining([
        'Drywall demo / removal',
        'Drywall patch / repair',
        'Flooring installation',
        'Interior wall and ceiling painting',
        'Baseboard installation',
        'Interior door installation',
        'Window install',
        'Insulation',
      ])
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        'Existing flooring removal',
        'LVP flooring install',
        'Trim & doors',
        'Walls',
        'Ceilings',
        'Wall Demo',
      ])
    );
    const attention = getInitialRevealConfirmItems(draft).pricingScope;
    expect(attention).toEqual([
      'Price needed for Interior wall and ceiling painting',
      'Price needed for Interior door installation',
    ]);
  });

  it('derives Scope found attention items from unpriced checklist cards', () => {
    const draft = {
      projectType: 'painting',
      originalNotes:
        'Paint walls and ceilings, install six interior doors, and install flooring.',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'paint',
            label: 'Interior wall and ceiling painting',
            state: 'included',
          },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
        ],
      },
      stillNeededReview: [],
      needsReviewItems: [],
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual(
      expect.arrayContaining([
        'Price needed for Interior door installation',
        'Price needed for Flooring installation',
      ])
    );
  });

  it('shows parsed cross-trade quantities and keeps pre-confirm attention scoped', () => {
    const draft = {
      estimateTier: 'room_remodel',
      projectType: 'other',
      requiresScopeConfirmation: true,
      originalNotes:
        'Tear off and remove the existing roof, then replace 28 roofing squares, repair 180 sqft decking, install gutters and downspouts, replace four windows, repair siding, install R-38 attic insulation, repair drywall, and paint ceilings.',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'decking_repair',
            label: 'Roof decking repair',
            state: 'included',
          },
          { id: 'roofing', label: 'Roofing replacement', state: 'included' },
          {
            id: 'window_install',
            label: 'Window replacement',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        roofSquares: 28,
        roofDeckingReplacementSqft: 180,
        windowCount: 4,
      },
      scopePackages: [
        {
          name: 'Roof decking repair',
          scope: 'Roof decking repair',
          checklistItemId: 'decking_repair',
          status: 'missing_price',
        },
        {
          name: 'Roofing replacement',
          scope: 'Roofing replacement',
          checklistItemId: 'roofing',
          status: 'missing_price',
        },
        {
          name: 'Window replacement',
          scope: 'Window replacement',
          checklistItemId: 'window_install',
          status: 'missing_price',
        },
      ],
      stillNeededReview: [
        'Pricing for Roof decking repair',
        'Pricing for Roofing replacement',
        'Pricing for Materials / supplies',
        'Pricing for Install labor',
      ],
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Roof decking repair',
          quantity: '180 sqft',
        }),
        expect.objectContaining({
          name: 'Roofing replacement',
          quantity: '28 squares',
        }),
        expect.objectContaining({
          name: 'Window replacement',
          quantity: '4 each',
        }),
      ])
    );
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Price needed for Roof decking repair',
      'Price needed for Roofing replacement',
    ]);
  });

  it('shows specific mixed-landscape quantities without duplicate buckets', () => {
    const draft = {
      projectType: 'other',
      originalNotes:
        'Install 1,000 sqft sod, 400 sqft pavers, 12 shrubs, 30 tons decorative rock, irrigation adjustments, edging, and a 500 sqft concrete patio with two exterior doors.',
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          {
            id: 'pour_flatwork',
            label: 'Concrete patio installation',
            state: 'included',
          },
          { id: 'concrete', label: 'Concrete flatwork', state: 'included' },
          { id: 'landscaping', label: 'Landscaping', state: 'included' },
          { id: 'sod_turf', label: 'Sod', state: 'included' },
          { id: 'pavers', label: 'Pavers', state: 'included' },
          { id: 'plants', label: 'Plants / shrubs', state: 'included' },
          { id: 'rock', label: 'Decorative rock', state: 'included' },
          { id: 'irrigation', label: 'Irrigation', state: 'included' },
          { id: 'concrete_edging', label: 'Edging', state: 'included' },
          {
            id: 'exterior_doors',
            label: 'Exterior door installation',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        concreteSqft: 500,
        sodSqft: 1000,
        paverSqft: 400,
        plantCount: 12,
        landscapeTons: 30,
        exteriorDoorCount: 2,
      },
      scopePackages: [
        {
          checklistItemId: 'pour_flatwork',
          name: 'Concrete patio installation',
        },
        { checklistItemId: 'concrete', name: 'Concrete flatwork' },
        { checklistItemId: 'landscaping', name: 'Landscaping' },
        { checklistItemId: 'sod_turf', name: 'Sod' },
        { checklistItemId: 'pavers', name: 'Pavers' },
        { checklistItemId: 'plants', name: 'Plants / shrubs' },
        { checklistItemId: 'rock', name: 'Decorative rock' },
        { checklistItemId: 'irrigation', name: 'Irrigation' },
        { checklistItemId: 'concrete_edging', name: 'Edging' },
        {
          checklistItemId: 'exterior_doors',
          name: 'Exterior door installation',
        },
      ],
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(
      getInitialRevealChecklistScopePreview({
        ...draft,
        scopePackages: [],
      }).some(row => /insulation/i.test(row.name))
    ).toBe(false);
    expect(preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Sod', quantity: '1,000 sqft' }),
        expect.objectContaining({ name: 'Pavers', quantity: '400 sqft' }),
        expect.objectContaining({ name: 'Shrubs', quantity: '12 each' }),
        expect.objectContaining({
          name: 'Decorative rock',
          quantity: '30 ton',
        }),
        expect.objectContaining({ name: 'Irrigation' }),
        expect.objectContaining({ name: 'Edging' }),
        expect.objectContaining({
          name: 'Exterior door installation',
          quantity: '2 each',
        }),
      ])
    );
    expect(preview.some(row => row.name === 'Landscaping')).toBe(false);
    expect(
      preview.filter(row => row.name === 'Concrete flatwork')
    ).toHaveLength(0);
  });

  it('keeps built addition reveal scope canonical and note-local', () => {
    const notes =
      'Clear and demolish the existing area as needed, then build a 700 sqft addition with foundation, framing, roofing, six windows, exterior doors, R-21 wall insulation, R-38 attic insulation, air sealing, drywall, flooring, cabinets, plumbing, electrical, trim, and paint.';
    const ids = [
      'sitework',
      'foundation',
      'framing',
      'roof_tie_in',
      'windows_doors',
      'insulation',
      'drywall',
      'paint',
      'flooring',
      'cabinets_counters',
      'cabinets',
      'plumbing_rough',
      'electrical_rough',
      'exterior_door_install',
      'air_sealing',
      'roofing',
      'trim_paint',
      'exterior_finishes',
      'interior_trim',
      'window_install',
      'door_casing_paint',
    ];
    const draft = {
      projectType: 'other',
      originalNotes: notes,
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'addition',
        items: ids.map(id => ({
          id,
          label:
            id === 'insulation'
              ? 'Attic insulation'
              : id === 'exterior_door_install'
                ? 'Exterior door installation'
                : id === 'window_install'
                  ? 'Window install'
                  : id,
          state: 'included' as const,
        })),
      },
      scopePackages: [
        {
          name: 'Windows & exterior doors',
          scope: 'Windows & exterior doors',
          checklistItemId: 'windows_doors',
          status: 'missing_price',
        },
        {
          name: 'Window install',
          scope: 'Window install',
          checklistItemId: 'window_install',
          status: 'missing_price',
        },
        {
          name: 'Exterior door installation',
          scope: 'Exterior door installation',
          checklistItemId: 'exterior_door_install',
          status: 'missing_price',
        },
        {
          name: 'Roofing / tie-in',
          scope: 'Roofing / tie-in',
          checklistItemId: 'roof_tie_in',
          status: 'missing_price',
        },
        {
          name: 'Roofing',
          scope: 'Roofing',
          checklistItemId: 'roofing',
          status: 'missing_price',
        },
      ],
    } as EstimateAiDraft;

    const noPackagePreview = getInitialRevealChecklistScopePreview({
      ...draft,
      scopePackages: [],
    });
    expect(
      noPackagePreview.find(row => /insulation/i.test(row.name))?.name
    ).toBe('Wall insulation · R-21 · Attic insulation · R-38');
    const preview = getInitialRevealChecklistScopePreview(draft);
    const names = preview.map(row => row.name);

    expect(preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Windows',
          quantity: '6 each',
        }),
        expect.objectContaining({
          name: 'Wall insulation · R-21 · Attic insulation · R-38',
        }),
      ])
    );
    expect(names).not.toEqual(
      expect.arrayContaining([
        'Window install',
        'Exterior door installation',
        'Roofing',
        'Stock cabinet supply & installation',
        'exterior_finishes',
        'trim_paint',
        'door_casing_paint',
      ])
    );
    expect(getInitialRevealConfirmItems(draft).pricingScope).not.toEqual(
      expect.arrayContaining([
        'Price needed for Window install',
        'Price needed for Exterior door installation',
        'Price needed for Roofing',
      ])
    );
  });

  it('recovers missing shrubs and edging from notes on a stale checklist', () => {
    const notes =
      'Remove existing landscaping, pavers, and concrete as needed, then install 1,000 sqft sod, 400 sqft pavers, 12 shrubs, 30 tons decorative rock, irrigation adjustments, edging, a retaining wall, a 500 sqft concrete patio, and two exterior doors.';
    const draft = {
      projectType: 'concrete',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          {
            id: 'pour_flatwork',
            label: 'Concrete patio installation',
            state: 'included',
          },
          { id: 'landscaping', label: 'Landscaping', state: 'included' },
          { id: 'sod_turf', label: 'Sod', state: 'included' },
          { id: 'pavers', label: 'Pavers', state: 'included' },
          { id: 'rock', label: 'Decorative rock', state: 'included' },
          {
            id: 'exterior_doors',
            label: 'Exterior door installation',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        concreteSqft: 500,
        sodSqft: 1000,
        paverSqft: 400,
        plantCount: 12,
        landscapeTons: 30,
        exteriorDoorCount: 2,
      },
      scopePackages: [],
    } as EstimateAiDraft;

    const preview = getInitialRevealChecklistScopePreview(draft);

    expect(preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Shrubs', quantity: '12 each' }),
        expect.objectContaining({ name: 'Edging' }),
      ])
    );
    expect(preview.some(row => row.name === 'Landscaping')).toBe(false);
  });

  it('hides excluded plumbing cards and fixture allowance on Scope found', () => {
    const notes =
      'Kitchen plumbing only. Customer supplies fixtures. 3 rough-in points. 4 trim hookups. 25 LF water line. 1 gas appliance hookup.';
    const draft = {
      projectType: 'plumbing',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
          {
            id: 'plumbing_trim',
            label: 'Plumbing trim / hookups',
            state: 'included',
          },
          { id: 'water_line', label: 'Water line piping', state: 'included' },
          {
            id: 'gas_appliance_connections',
            label: 'Gas appliance connections',
            state: 'included',
          },
          {
            id: 'plumbing_fixtures_hardware',
            label: 'Plumbing fixture allowance',
            state: 'excluded',
          },
          {
            id: 'sewer_line',
            label: 'Sewer / drain piping',
            state: 'excluded',
          },
        ],
      },
      scopePackages: [],
      scopeMeasurements: { tradeWorkflowSource: 'standalone_trade' },
    } as EstimateAiDraft;
    expect(getInitialRevealTagline(draft)).toContain(
      'Kitchen plumbing · 4 scope lines'
    );
    expect(getInitialRevealUnderstoodBullets(draft, 4)).toEqual([
      '3 rough-in points',
      '4 trim hookups',
      '25 LF water line',
      '1 gas appliance hookup',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      'Plumbing rough-in',
      'Plumbing trim / hookups',
      'Water line piping',
      'Gas appliance connections',
    ]);
  });

  it('shows master bath plumbing scope without water heater or fixture allowance', () => {
    const notes = `Master bath plumbing — shower valve relocate and new toilet location.

4 plumbing rough-in points (shower valve/head, tub drain, toilet, lav).
4 trim hookups.
30 LF of drain line for relocated toilet (slab on grade — core drill, not included unless noted).
1 water heater tie-in not included.`;
    const draft = {
      projectTitle: 'Master bath plumbing',
      projectType: 'plumbing',
      originalNotes: notes,
      scopeMeasurements: { tradeWorkflowSource: 'standalone_trade' },
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
          {
            id: 'plumbing_trim',
            label: 'Plumbing trim / hookups',
            state: 'included',
          },
          {
            id: 'sewer_line',
            label: 'Sewer / drain piping',
            state: 'included',
          },
          { id: 'water_heater', label: 'Water heater', state: 'excluded' },
          {
            id: 'plumbing_fixtures_hardware',
            label: 'Plumbing fixture allowance',
            state: 'excluded',
          },
        ],
      },
      scopePackages: [],
    } as EstimateAiDraft;
    expect(getInitialRevealDisplayTitle(draft)).toBe('Master bath plumbing');
    expect(getInitialRevealTagline(draft)).toContain(
      'Bathroom plumbing · 3 scope lines'
    );
    expect(getInitialRevealUnderstoodBullets(draft, 4)).toEqual([
      '4 rough-in points',
      '4 trim hookups',
      '30 LF sewer line',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft)).toHaveLength(3);
  });

  it('adds ice and water and pipe boots to a named re-roof scope', () => {
    const draft = {
      projectType: 'roofing',
      originalNotes:
        'Tear off one layer of asphalt shingles and install architectural shingles on 28 squares. Include synthetic underlayment, ice and water shield, drip edge, ridge cap, valley flashing, and pipe boots.',
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          {
            id: 'roofing_system',
            label: 'Roofing system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
          {
            id: 'tear_off',
            label: 'Existing roof / tear-off',
            state: 'included',
            choiceId: 'one_layer',
          },
          { id: 'underlayment', label: 'Underlayment', state: 'included' },
          { id: 'drip_edge', label: 'Drip edge', state: 'included' },
          { id: 'ridge_cap', label: 'Ridge cap', state: 'included' },
          { id: 'valley_flashing', label: 'Valley flashing', state: 'included' },
        ],
      },
    } as EstimateAiDraft;
    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview.map(row => row.name)).toEqual(
      expect.arrayContaining([
        'Ice & water shield',
        'Pipe boots',
      ])
    );
    expect(preview.find(row => row.name === 'Underlayment')?.quantity).toBe(
      '2800 sqft'
    );
    expect(preview.find(row => row.name === 'Ice & water shield')?.quantity).toBe(
      '318 sqft'
    );
    expect(preview.find(row => row.name === 'Pipe boots')?.quantity).toBe(
      '1 each'
    );
    expect(
      preview.find(row => row.name === 'Valley flashing')?.quantity
    ).toBeUndefined();
  });

  it('filters roofing pricing noise before Confirm Scope', () => {
    const draft = {
      projectType: 'roofing',
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          {
            id: 'roofing_system',
            label: 'Roofing system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
          {
            id: 'tear_off',
            label: 'Tear-off',
            state: 'included',
            choiceId: 'one_layer',
          },
        ],
      },
      originalNotes:
        '22-square re-roof with architectural shingles, tear-off 1 layer, ice & water at eaves, drip edge',
      stillNeededReview: [
        'Pricing for Roofing',
        'Full reroof contract price',
        'Shingle color',
        'Customer name',
      ],
      needsReviewItems: [],
    } as EstimateAiDraft;

    expect(
      filterRoofingRevealAttentionItems(draft, [
        'Pricing for Roofing',
        'Shingle color',
        'Customer name',
      ])
    ).toEqual(['Customer name']);

    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope.some(item => /roofing/i.test(item))).toBe(
      false
    );
    expect(buckets.pricingScope.some(item => /shingle color/i.test(item))).toBe(
      false
    );
    expect(buckets.pricingScope).toHaveLength(0);
  });

  it('shows note exclusions in yellow review and keeps negated gutters off the roof', () => {
    const notes =
      'Remove and replace 22 squares of architectural shingles on a single-story house. Include underlayment, drip edge, and dumpster. Deck repair allowance $1,000. No gutters, no siding, no interior work.';
    const draft = {
      projectType: 'roofing',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      whatAiDid: ['Detected roofing job.'],
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          {
            id: 'roofing_system',
            label: 'Roofing system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
          { id: 'gutters', label: 'Gutters', state: 'included' },
          {
            id: 'cleanup',
            label: 'Cleanup, haul-off & disposal',
            state: 'included',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : row.name
      )
    ).toEqual([
      'Roofing system · 22 squares',
      'Cleanup, haul-off & disposal',
      'Existing roof / tear-off · 1 layer',
      'Drip edge',
      'Deck repair allowance · $1,000',
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Gutters are not in this bid',
      'Siding is not in this bid',
      'Interior work is not in this bid',
    ]);
    expect(getInitialRevealAttentionTitle(draft, true)).toBe(
      'Needs your attention'
    );
    expect(
      getInitialRevealStatusLabel(draft, countInitialRevealAttentionItems(draft))
        .tone
    ).toBe('review');
    expect(getInitialRevealTagline(draft)).toBe(
      'Architectural shingles · 22 squares.'
    );
  });

  it('uses the yellow check list for exclusions on any note', () => {
    const flooring = {
      projectType: 'flooring',
      requiresScopeConfirmation: true,
      originalNotes:
        'Install 1,150 sqft LVP in the main level. Pull the existing carpet and haul it off. Reinstall 280 LF of existing baseboard. No paint, no trim replacement, no subfloor repair.',
      scopeChecklist: { templateKey: 'flooring', items: [] },
    } as EstimateAiDraft;
    const drywall = {
      projectType: 'drywall',
      requiresScopeConfirmation: true,
      originalNotes: 'Hang 1,200 sqft of drywall. No texture, no paint.',
      scopeChecklist: { templateKey: 'drywall', items: [] },
    } as EstimateAiDraft;

    for (const draft of [flooring, drywall]) {
      expect(getInitialRevealConfirmItems(draft).pricingScope.length).toBeGreaterThan(
        0
      );
      expect(getInitialRevealAttentionTitle(draft, true)).toBe(
        'Needs your attention'
      );
      expect(
        getInitialRevealStatusLabel(
          draft,
          countInitialRevealAttentionItems(draft)
        ).tone
      ).toBe('review');
    }
    expect(getInitialRevealConfirmItems(drywall).pricingScope).toEqual([
      'Texture is not in this bid',
      'Paint is not in this bid',
    ]);
  });

  it('hides pre-confirm pricing on Scope found until Confirm scope', () => {
    const draft = {
      projectType: 'roofing',
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          {
            id: 'roofing_system',
            label: 'Roofing system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
          {
            id: 'tear_off',
            label: 'Tear-off',
            state: 'included',
            choiceId: 'one_layer',
          },
          { id: 'drip_edge', label: 'Drip edge', state: 'included' },
        ],
      },
      originalNotes:
        '22-square re-roof with architectural shingles, tear-off 1 layer, ice & water at eaves, drip edge',
      stillNeededReview: [],
      needsReviewItems: [],
    } as EstimateAiDraft;

    const totals = getInitialRevealTotals(draft);
    const hero = getInitialRevealHeroDisplay(totals, true);
    expect(hero.hasAmount).toBe(false);
    expect(hero.hint).toContain('Confirm scope');
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual(
      expect.arrayContaining(['Roofing system', 'Tear-off'])
    );
    expect(getInitialRevealUnderstoodBullets(draft, 3).join(' ')).not.toMatch(
      /\$/
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).every(
        row => row.amount === 0
      )
    ).toBe(true);
  });

  it('keeps roofing plan export scope to verified facts and roof-area confirmation', () => {
    const draft = {
      projectType: 'roofing',
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          { id: 'roofing_system', label: 'Roofing system', state: 'included' },
          { id: 'tear_off', label: 'Existing roof / tear-off', state: 'included' },
          { id: 'cleanup', label: 'Cleanup, haul-off & disposal', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'roofing',
        planImportFingerprint: 'shv-lot-49',
        planFacts: { roofPitch: '2:12', storyCount: 2 },
      },
      scopePackages: [
        { name: 'Existing roof condition and number of tear-off layers' },
        { name: 'Material pricing' },
      ],
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Roof pitch', amount: 0, quantity: '2:12' },
      {
        name: 'Roof surface area / squares',
        amount: 0,
        quantity: 'Needs measurement',
      },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Roof surface area / squares: needs measurement',
    ]);
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual([
      'Roof pitch · 2:12',
      'Roof surface area / squares · Needs measurement',
    ]);
    expect(getInitialRevealUnderstoodBullets(draft, 3).join(' ')).not.toMatch(
      /Stories|Price needed/
    );
    expect(planRevealOmitsWhatWeFound(draft)).toBe(true);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(2);
  });

  it('keeps a measured roofing plan on the roof, not a story price', () => {
    const draft = {
      projectType: 'roofing',
      requiresScopeConfirmation: true,
      whatAiDid: ['Detected roofing.'],
      scopeChecklist: { templateKey: 'roofing', items: [] },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'roofing',
        planImportFingerprint: 'shv-lot-49',
        roofPitch: '2:12',
        storyCount: 2,
        roofSquares: 22,
        roofingSystemChoice: 'concrete_clay_tile',
        quickMeasurementSources: {
          storyCount: 'plan_detected',
          roofSquares: 'user_entered',
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Roof pitch', amount: 0, quantity: '2:12' },
      { name: 'Clay tile', amount: 0, quantity: '22 squares' },
    ]);
    expect(getInitialRevealUnderstoodBullets(draft, 3).join(' ')).not.toMatch(
      /Stories|Price needed/
    );
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(countInitialRevealAttentionItems(draft)).toBe(0);
    expect(getInitialRevealTagline(draft)).toBe('Clay tile · 22 squares.');
    expect(
      getInitialRevealStatusLabel(draft, countInitialRevealAttentionItems(draft))
        .label
    ).toBe('Mostly ready');
  });

  it('keeps a clay tile price labeled clay tile when the choice field was dropped', () => {
    const draft = {
      projectType: 'roofing',
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          { id: 'shingles_roofing', label: 'Clay tile', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'roofing',
        planImportFingerprint: 'shv-lot-49',
        roofPitch: '2:12',
        roofSquares: 22,
        storyCount: 2,
        pricingAcceptance: {
          shingles_roofing: { totalAmount: 33000 },
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe('Clay tile · 22 squares.');
    expect(getInitialRevealChecklistScopePreview(draft)[0]).toEqual({
      name: 'Clay tile',
      amount: 33000,
      quantity: '22 squares',
    });
    expect(getInitialRevealUnderstoodBullets(draft, 3).join(' ')).not.toMatch(
      /Stories|Shingles/
    );
  });

  it('lists the priced roofing lines on the initial estimate', () => {
    const draft = {
      projectType: 'roofing',
      projectTitle: 'Roofing Estimate Draft',
      whatAiDid: ['Detected roofing job.'],
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          { id: 'permits', label: 'Permit responsibility', state: 'unsure' },
          {
            id: 'roofing',
            label: 'Detailed roofing plan takeoff quantities',
            state: 'included',
          },
          {
            id: 'tear_off',
            label: 'Tear-off and disposal requirements',
            state: 'unsure',
          },
          {
            id: 'overlay',
            label: 'Tear-off or overlay requirements',
            state: 'unsure',
          },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'roofing',
        planImportFingerprint: 'roof-plan',
        roofSquares: 22,
        roofRidgeVentLf: 2,
        roofPipeBootCount: 2,
        roofGutterLf: 5,
        roofDownspoutCount: 2,
        pricingAcceptance: {
          shingles_roofing: { totalAmount: 12650 },
          ridge_vent: { totalAmount: 250 },
          pipe_boots: { totalAmount: 350 },
          gutters: { totalAmount: 400 },
          downspouts: { totalAmount: 250 },
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Shingles', amount: 12650, quantity: '22 squares' },
      { name: 'Ridge vent', amount: 250, quantity: '2 each' },
      { name: 'Pipe boots', amount: 350, quantity: '2 each' },
      { name: 'Gutters', amount: 400, quantity: '5 LF' },
      { name: 'Downspouts', amount: 250, quantity: '2 each' },
    ]);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(5);
    expect(getInitialRevealTagline(draft)).toBe('Shingles · 22 squares.');
  });

  it('keeps stucco plan export scope to plan facts and wall-area confirmation', () => {
    const draft = {
      projectType: 'stucco',
      projectTitle: 'Stucco / Exterior Finish Estimate Draft',
      whatAiDid: ['Detected stucco.'],
      requiresScopeConfirmation: true,
      originalNotes:
        'Planning estimate from plans:\nPermit responsibility\nExisting substrate condition and required repairs\nSurface preparation and repair scope\nColors, texture, and coating requirements',
      scopeChecklist: {
        templateKey: 'stucco',
        items: [
          {
            id: 'stucco_surface_prep',
            label: 'Remove damaged stucco & prepare substrate',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'stucco',
        planImportFingerprint: 'shv-lot-49',
        stuccoStories: 2,
        stuccoWallHeightFt: 9.1,
        planFacts: { storyCount: 2, plateHeightFt: 9.1 },
      },
      scopePackages: [
        { name: 'Permit responsibility' },
        { name: 'Existing substrate condition and required repairs' },
      ],
    } as EstimateAiDraft;

    expect(getInitialRevealDisplayTitle(draft)).toBe('Stucco');
    expect(getInitialRevealTagline(draft)).toBeNull();
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      {
        name: 'Stucco / exterior wall finish',
        amount: 0,
        quantity: 'Needs measurement',
      },
    ]);
    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual([
      'Stucco / exterior wall finish · Needs measurement',
    ]);
    expect(planRevealOmitsWhatWeFound(draft)).toBe(true);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(1);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([
      'Exterior wall area — gross: needs measurement',
    ]);
  });

  it('prices one stucco wall after the contractor enters gross area', () => {
    const draft = {
      projectType: 'stucco',
      requiresScopeConfirmation: true,
      scopeChecklist: { templateKey: 'stucco', items: [] },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'stucco',
        planImportFingerprint: 'shv-lot-49',
        stuccoGrossWallSqft: 22,
        stuccoNetWallSqft: 22,
        stuccoStories: 2,
        stuccoWallHeightFt: 9.1,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      {
        name: 'Stucco / exterior wall finish',
        amount: 0,
        quantity: '22 sqft',
      },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(1);
  });

  it('names a flooring plan from the cover-sheet living area', () => {
    const draft = {
      projectType: 'flooring',
      projectTitle: 'Flooring Estimate Draft',
      requiresScopeConfirmation: true,
      whatAiDid: ['Detected flooring job.'],
      scopeChecklist: {
        templateKey: 'flooring',
        items: [
          { id: 'floor_demo', label: 'Demo Existing Flooring', state: 'included' },
          { id: 'flooring', label: 'New flooring', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'flooring',
        planImportFingerprint: 'shv-lot-49',
        floorAreaSqft: 2571,
        flooringSqft: 2571,
        garageSqft: 1427,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Living area from the cover sheet.'
    );
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Flooring', amount: 0, quantity: '2,571 SF' },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(planRevealOmitsWhatWeFound(draft)).toBe(true);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(1);
  });

  it('keeps a notes-only flooring job on the detected-job line', () => {
    const draft = {
      projectType: 'flooring',
      whatAiDid: ['Detected flooring job.'],
      scopeChecklist: { templateKey: 'flooring', items: [] },
      scopeMeasurements: {},
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe('Detected flooring job.');
  });

  it('does not ask for a recessed-light price after the lighting card is applied', () => {
    const measurements = {
      planImportMode: 'selected_trade',
      planImportTradeKey: 'electrical',
      planImportFingerprint: 'shv-lot-49',
      recessedLightCount: 31,
      quickMeasurementSources: { recessedLightCount: 'detected_from_plan' },
    };
    const unpriced = {
      projectType: 'electrical',
      requiresScopeConfirmation: true,
      scopeChecklist: { templateKey: 'electrical', items: [] },
      scopeMeasurements: measurements,
    } as EstimateAiDraft;
    const priced = {
      ...unpriced,
      scopeAssumptionsConfirmed: true,
      scopeMeasurements: {
        ...measurements,
        itemQuantities: {
          electrical_recessed_light: {
            quantity: 31,
            unit: 'each',
            quantitySource: 'user_entered',
          },
          electrical_recessed_light__material: {
            quantity: 1395,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical_recessed_light__labor: {
            quantity: 3255,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          electrical_recessed_light: {
            selectionStatus: 'accepted',
            pricingSourceLabel: 'National average',
            pricingSourceKind: 'national_average',
            pricingTypeLabel: 'Material + labor',
            materialAmount: 1395,
            laborAmount: 3255,
            totalAmount: 4650,
          },
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(unpriced).pricingScope).toEqual([
      'Price needed for Recessed / canless / wafer light · 31',
    ]);
    expect(getInitialRevealChecklistScopePreview(unpriced)).toEqual([
      { name: 'Recessed / canless / wafer light · 31', amount: 0 },
    ]);
    expect(getInitialRevealConfirmItems(priced).pricingScope).toEqual([]);
    const confirmedScope = {
      ...priced,
      scopeChecklist: {
        templateKey: 'electrical',
        items: [
          {
            id: 'electrical_main_panel',
            label: 'Main panel',
            state: 'included',
          },
          {
            id: 'electrical_recessed_light',
            label: 'Recessed / canless / wafer light',
            state: 'included',
          },
        ],
      },
      scopePackages: [
        {
          checklistItemId: 'electrical_main_panel',
          name: 'Main panel',
          price: 2050,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
        {
          checklistItemId: 'electrical_recessed_light',
          name: 'Recessed / canless / wafer light',
          price: 4650,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
      ],
    } as EstimateAiDraft;
    const confirmedWithSymbols = {
      ...confirmedScope,
      scopeMeasurements: {
        ...confirmedScope.scopeMeasurements,
        gfciReceptacleCount: 10,
        singlePoleSwitchCount: 48,
        ceilingFanCount: 4,
        bathExhaustFanCount: 2,
        quickMeasurementSources: {
          recessedLightCount: 'detected_from_plan',
          gfciReceptacleCount: 'needs_confirmation',
          singlePoleSwitchCount: 'needs_confirmation',
          ceilingFanCount: 'needs_confirmation',
          bathExhaustFanCount: 'user_entered',
        },
        itemQuantities: {
          ...confirmedScope.scopeMeasurements?.itemQuantities,
          electrical_bath_exhaust_fan: {
            quantity: 2,
            unit: 'each',
            quantitySource: 'user_entered',
          },
          electrical_bath_exhaust_fan__material: {
            quantity: 200,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical_bath_exhaust_fan__labor: {
            quantity: 300,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          ...confirmedScope.scopeMeasurements?.pricingAcceptance,
          electrical_bath_exhaust_fan: {
            selectionStatus: 'accepted',
            pricingSourceLabel: 'National average',
            pricingSourceKind: 'national_average',
            pricingTypeLabel: 'Material + labor',
            materialAmount: 200,
            laborAmount: 300,
            totalAmount: 500,
          },
        },
      },
    } as EstimateAiDraft;
    expect(getInitialRevealChecklistScopePreview(confirmedScope)).toEqual([
      { name: 'Service / panels', amount: 2050 },
      { name: 'Lighting', amount: 4650, quantity: '31 each' },
    ]);
    expect(getInitialRevealChecklistScopePreview(confirmedWithSymbols)).toEqual([
      { name: 'Service / panels', amount: 2050 },
      { name: 'Lighting', amount: 4650, quantity: '31 each' },
      { name: 'Fans', amount: 500, quantity: '2 each' },
    ]);
    expect(getInitialRevealStatusLabel(priced, 0).label).toBe('Mostly ready');
  });

  it('shows actionable mixed-scope pricing gaps before scope is confirmed', () => {
    const draft = {
      projectType: 'other',
      scopeMode: 'mixed',
      estimateTier: 'room_remodel',
      requiresScopeConfirmation: true,
      originalNotes:
        'Demolish existing nonstructural walls, then frame 1,600 sqft of walls with headers, blocking, two door openings, structural sheathing, six windows, two exterior doors, R-21 insulation, 1,600 sqft drywall, flooring, and paint.',
      stillNeededReview: [
        'Pricing for Insulation',
        'Pricing for Nonstructural wall demolition',
        'Material/labor pricing for flooring',
      ],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'demo',
            label: 'Nonstructural wall demolition',
            state: 'included',
          },
          {
            id: 'framing',
            label: 'Wall framing, headers & blocking',
            state: 'included',
          },
          { id: 'drywall', label: 'Drywall hang / finish', state: 'included' },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft)).toEqual({
      pricingScope: ['Material/labor pricing for flooring'],
      bidDetails: [],
    });
    expect(getInitialRevealPrimaryCtaLabel(0, true)).toBe('Confirm scope');
  });

  it('merges explicit catalog note facts into Scope found', () => {
    const draft = {
      projectType: 'kitchen',
      scopeChecklist: {
        templateKey: 'kitchen',
        title: 'Kitchen',
        intro: 'Confirm scope',
        items: [
          {
            id: 'cabinets',
            label: 'Cabinets',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'countertops',
            label: 'Countertops',
            state: 'included',
            noteBacked: true,
          },
        ],
        scopeFacts: [
          {
            scopeId: 'window_install',
            status: 'included',
            catalogEntry: { displayName: 'Window installation' },
          },
          {
            scopeId: 'insulation',
            status: 'included',
            catalogEntry: { displayName: 'Insulation' },
          },
          {
            scopeId: 'interior_doors',
            status: 'excluded',
            catalogEntry: { displayName: 'Interior doors' },
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(['Cabinets', 'Countertops', 'Window install', 'Insulation']);
  });

  it('shows an unquantified exterior door from brief cross-trade notes', () => {
    const draft = {
      projectType: 'kitchen',
      originalNotes:
        'Update the kitchen with cabinet, counter, backsplash, and flooring demolition; new cabinets, counters, backsplash, flooring, drywall, plumbing, electrical, windows, insulation, an exterior door, and paint.',
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          {
            id: 'window_install',
            label: 'Window & trim installation',
            state: 'included',
          },
          {
            id: 'interior_paint',
            label: 'Interior painting',
            state: 'included',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toContain('Exterior doors');
  });

  it('normalizes a cached kitchen floor demo label', () => {
    const draft = {
      projectType: 'room_remodel',
      projectTitle: 'Kitchen Remodel Estimate',
      scopeChecklist: {
        templateKey: 'room_remodel',
        title: 'Kitchen',
        intro: 'Confirm scope',
        items: [
          {
            id: 'floor_demo',
            label: 'Bathroom floor demo / removal',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Kitchen flooring demo / removal', amount: 0 },
    ]);
  });

  it('shows note-backed scope while the refreshed checklist is hydrating', () => {
    const draft = {
      projectType: 'kitchen',
      stillNeededReview: [
        'Pricing for New kitchen cabinets',
        'Pricing for Quartz countertops',
        'Pricing for Plumbing relocation',
        'Pricing for all kitchen scope items',
        'Cabinet style, manufacturer, finish, and hardware selections',
        'Kitchen Remodel',
        'Project schedule',
      ],
      scopeChecklist: undefined,
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      'New kitchen cabinets',
      'Quartz countertops',
      'Plumbing relocation',
    ]);
  });

  it('splits kitchen demolition and removes unrelated plumbing fixture scope', () => {
    const draft = {
      projectType: 'kitchen',
      originalNotes:
        'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install plumbing relocation.',
      stillNeededReview: [
        'Kitchen demolition',
        'Plumbing fixture and appliance scope',
        'Cabinets',
      ],
      scopeChecklist: undefined,
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      'Cabinet demo / removal',
      'Countertop demo / removal',
      'Backsplash demo / removal',
      'Kitchen flooring demo / removal',
      'Cabinets',
    ]);
  });

  it('filters clarification rows and generic duplicates after checklist hydration', () => {
    const draft = {
      projectType: 'kitchen',
      originalNotes:
        'Install 220 sqft drywall repair and R-21 wall insulation.',
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          {
            id: 'drywall',
            label: 'Drywall Repair',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'insulation',
            label: 'Insulation',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'drywall_detail',
            label: '220 sqft drywall repair',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'insulation_detail',
            label: 'R-21 wall insulation',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'cabinet_questions',
            label: 'Cabinet style and hardware selections',
            state: 'unsure',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual(['220 sqft drywall repair', 'R-21 wall insulation']);
  });

  it('expands hydrated kitchen demolition into full demo lines', () => {
    const draft = {
      projectType: 'kitchen',
      projectTitle: 'Kitchen Remodel',
      originalNotes:
        'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring.',
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          {
            id: 'kitchen',
            label: 'Kitchen',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'demo',
            label:
              'Demolition of existing cabinets, countertops, backsplash, flooring',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'window_questions',
            label: 'Window and exterior door details',
            state: 'unsure',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      'Cabinet demo / removal',
      'Countertop demo / removal',
      'Backsplash demo / removal',
      'Kitchen flooring demo / removal',
    ]);
  });

  it('drops unmentioned kitchen questionnaire cards and tile duplicates', () => {
    const draft = {
      projectType: 'kitchen',
      projectTitle: 'Kitchen Remodel',
      originalNotes:
        'Kitchen remodel. Demo existing cabinets, countertops, backsplash, and vinyl floor. Install 22 LF new cabinets, quartz counters 48 sqft, tile backsplash 32 sqft, and LVP flooring 160 sqft. Baseboards 40 LF. Include sink and dishwasher hookup. No prices yet.',
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          { id: 'cabinet_demo', label: 'Cabinet demo / removal', state: 'included', noteBacked: true },
          { id: 'countertop_demo', label: 'Countertop demo / removal', state: 'included', noteBacked: true },
          { id: 'backsplash_demo', label: 'Backsplash demo / removal', state: 'included', noteBacked: true },
          { id: 'floor_demo', label: 'Flooring demo / removal', state: 'included', noteBacked: true },
          { id: 'demo', label: 'Shower tile demo / tear-out', state: 'included', noteBacked: true },
          { id: 'cabinets', label: 'Stock cabinet supply & installation', state: 'included', noteBacked: true },
          { id: 'countertops', label: 'Countertop fabrication & install', state: 'included', noteBacked: true },
          { id: 'backsplash', label: 'Backsplash tile install', state: 'included', noteBacked: true },
          { id: 'flooring', label: 'Kitchen flooring install', state: 'included', noteBacked: true },
          { id: 'flooring_lvp', label: 'LVP installation', state: 'included', noteBacked: true },
          { id: 'tile', label: 'Tile', state: 'included', noteBacked: true },
          { id: 'trim', label: 'Trim & baseboard', state: 'included', noteBacked: true },
          { id: 'baseboard_install', label: 'Baseboard trim & finish', state: 'included', noteBacked: true },
          { id: 'sink_faucet', label: 'Sink & faucet', state: 'included', noteBacked: true },
          { id: 'garbage_disposal', label: 'Garbage disposal', state: 'unsure', noteBacked: true },
          { id: 'electrical', label: 'Electrical outlets, GFCI & circuits', state: 'included', noteBacked: true },
          { id: 'drywall', label: 'Drywall / patching', state: 'unsure', noteBacked: true },
          { id: 'paint', label: 'Interior painting', state: 'unsure', noteBacked: true },
          { id: 'plumbing', label: 'Plumbing connections', state: 'included', noteBacked: true },
          { id: 'permits', label: 'Permits & inspections', state: 'unsure', noteBacked: true },
          { id: 'cleanup', label: 'Cleanup, haul-off & disposal', state: 'unsure', noteBacked: true },
        ],
      },
    } as EstimateAiDraft;

    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).toEqual([
      'Cabinet demo / removal',
      'Countertop demo / removal',
      'Backsplash demo / removal',
      'Kitchen flooring demo / removal',
      '22 LF cabinets',
      'Countertop fabrication & install',
      'Backsplash tile install',
      'Kitchen flooring install',
      'Baseboard installation',
      'Plumbing connections',
    ]);
  });

  it('filters standalone plumbing pricing noise before Confirm Scope', () => {
    const notes =
      'Kitchen plumbing only. 3 plumbing rough-in points. 4 trim hookups. 25 LF water line. 1 gas appliance hookup.';
    const draft = {
      projectType: 'plumbing',
      estimateConfidence: { level: 'high' },
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'plumbing_trim',
            label: 'Plumbing trim / hookups',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'water_line',
            label: 'Water line piping',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'gas_appliance_connections',
            label: 'Gas appliance connections',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
      scopeMeasurements: { tradeWorkflowSource: 'standalone_trade' },
      stillNeededReview: [
        'Pricing for Water line piping',
        'Pricing for Plumbing rough-in',
        'Pricing for Plumbing trim / hookups (material + labor)',
        'Pricing for Gas appliance connections',
        'Customer name',
      ],
      needsReviewItems: [],
    } as EstimateAiDraft;

    expect(
      filterPlumbingRevealAttentionItems(draft, [
        'Pricing for Water line piping',
        'Pricing for Plumbing rough-in',
        'Customer name',
      ])
    ).toEqual(['Customer name']);

    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope).toHaveLength(0);
    expect(
      getInitialRevealStatusLabel(draft, buckets.pricingScope.length).label
    ).toBe('Ready to send');
  });

  it('filters concrete pricing noise and shows note bullets before Confirm Scope', () => {
    const notes =
      'Pour new driveway 900 sqft, 4 inch thick with 80 ft of thickened edge. Dig out, gravel base, forms, rebar, finish broom. Might need a pump truck depending on access.';
    const draft = {
      projectType: 'concrete',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          {
            id: 'pour_flatwork',
            label: 'Pour flatwork',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'excavation',
            label: 'Excavation / soil movement',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'site_prep',
            label: 'Basic subgrade prep / grading',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'reinforcement',
            label: 'Rebar / mesh',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'complex_forming',
            label: 'Complex forming',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
      scopeMeasurements: { concreteSqft: 900, excavationCy: 22.22 },
      stillNeededReview: [
        'Pricing for Pour flatwork',
        'Pricing for Excavation / soil movement',
        'Pricing total not found in notes',
      ],
      needsReviewItems: [],
    } as EstimateAiDraft;

    expect(getInitialRevealConfirmItems(draft).pricingScope).toHaveLength(0);
    expect(
      getInitialRevealUnderstoodBullets(draft, 6).some(line =>
        /900 sqft flatwork/i.test(line)
      )
    ).toBe(true);
  });

  it('hides decorative finish when a driveway note only names a broom finish', () => {
    const notes =
      'Pour a new driveway, 900 sqft and 4 inches thick, with 80 feet of thickened edge. Dig out the pad, place a gravel base, set forms, install rebar, and broom finish. A pump truck may be needed depending on access.';
    const draft = {
      projectType: 'concrete',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          {
            id: 'pour_flatwork',
            label: 'Pour flatwork',
            state: 'included',
            noteBacked: true,
          },
          {
            id: 'decorative_finish',
            label: 'Decorative finish',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
      scopeMeasurements: { concreteSqft: 900 },
    } as EstimateAiDraft;
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => row.name)
    ).not.toContain('Decorative finish');
  });

  it('filters roofing admin noise for typical re-roof notes before Confirm Scope', () => {
    const notes =
      'Tear off and reroof, 22 squares architectural shingles. New underlayment, drip edge, pipe boots, haul off old shingles. Decking looks ok but put $1,000 allowance if we find bad wood.';
    const draft = {
      projectType: 'roofing',
      requiresScopeConfirmation: true,
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'roofing',
        items: [
          {
            id: 'roofing_system',
            label: 'Roofing system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
          {
            id: 'tear_off',
            label: 'Tear-off',
            state: 'included',
            choiceId: 'one_layer',
          },
        ],
      },
      stillNeededReview: [
        'Pricing total not found in notes',
        'Permit requirements and permit fees',
        'Clarification of whether decking allowance covers labor, materials, or both',
        'Pricing for drip edge',
      ],
      needsReviewItems: [],
    } as EstimateAiDraft;

    expect(
      filterRoofingRevealAttentionItems(draft, draft.stillNeededReview || [])
    ).toEqual([]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toHaveLength(0);
  });

  it('names a concrete cover-sheet patio instead of a deck', () => {
    const draft = {
      projectTitle: 'Concrete Patio Estimate',
      projectType: 'deck_patio',
      originalNotes: 'Covered Patio: 322 SqFt.',
      whatAiDid: ['Detected deck/patio.'],
      scopeChecklist: { templateKey: 'deck_patio', items: [] },
      scopeMeasurements: {
        planImportTradeKey: 'concrete',
        planImportFingerprint: 'lot-49',
        planImportMode: 'selected_trade',
        concretePatioSqft: 322,
        measurementProvenance: {
          concretePatioSqft: {
            source: 'plan_facts',
            reason: 'Cover sheet patio area.',
          },
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Covered patio from the cover sheet.'
    );
  });

  it('names cover-sheet living and garage areas for a drywall plan', () => {
    const draft = {
      projectTitle: 'Drywall Planning Estimate',
      projectType: 'drywall',
      originalNotes: 'Hang and finish drywall.',
      whatAiDid: ['Detected drywall job.'],
      scopeChecklist: { templateKey: 'drywall', items: [] },
      scopeMeasurements: {
        planImportTradeKey: 'drywall',
        planImportMode: 'selected_trade',
        floorAreaSqft: 2571,
        garageSqft: 1427,
        drywallWallSqft: 6428,
        drywallCeilingSqft: 2571,
        garageWallDrywallSqft: 1647.1,
        garageCeilingDrywallSqft: 1427,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Living and garage areas from the cover sheet.'
    );
  });

  it('prices a framing plan on cover-sheet living plus garage', () => {
    const draft = {
      projectTitle: 'Framing Estimate Draft',
      projectType: 'framing',
      originalNotes: 'Detected framing.',
      whatAiDid: [
        'Detected framing job.',
        'Preserved 3 room totals from your notes (unchanged).',
      ],
      scopeChecklist: {
        templateKey: 'framing',
        items: [
          {
            id: 'framing',
            label: 'Framing (lumber + labor)',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
      scopeMeasurements: {
        planImportTradeKey: 'framing',
        planImportMode: 'selected_trade',
        planImportFingerprint: 'lot-49',
        floorAreaSqft: 2571,
        garageSqft: 1427,
        framedAreaSqft: 3998,
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Living and garage areas from the cover sheet.'
    );
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Framing package', amount: 0, quantity: '3,998 SF' },
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(getInitialRevealUnderstoodBullets(draft)).toEqual([]);
  });

  it('keeps the note summary for a framing job that is not a cover-sheet plan', () => {
    const draft = {
      projectTitle: 'Framing Estimate Draft',
      projectType: 'framing',
      originalNotes: '',
      whatAiDid: [
        'Detected framing job.',
        'Preserved 3 room totals from your notes (unchanged).',
      ],
      scopeChecklist: { templateKey: 'framing', items: [] },
      scopeMeasurements: {},
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft)).toEqual([
      'Detected framing job.',
      'Preserved 3 room totals from your notes (unchanged).',
    ]);
  });

  it('lists insulation wall and attic areas and drops a leftover story count', () => {
    const draft = {
      projectTitle: 'Insulation Estimate Draft',
      projectType: 'insulation',
      originalNotes: 'Detected insulation.',
      whatAiDid: ['Detected insulation.'],
      scopeChecklist: { templateKey: 'insulation', items: [] },
      scopeMeasurements: {
        planImportTradeKey: 'insulation',
        planImportMode: 'selected_trade',
        planImportFingerprint: 'lot-49',
        storyCount: 2,
        exteriorWallInsulationSqft: 1555.1,
        atticInsulationSqft: 2527,
        quickMeasurementSources: {
          storyCount: 'detected_from_plan',
          exteriorWallInsulationSqft: 'planning_assumption',
          atticInsulationSqft: 'planning_assumption',
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Wall and attic areas from the floor-plan footprint.'
    );
    expect(getInitialRevealChecklistScopePreview(draft).map(row => row.name)).toEqual([
      'Exterior wall insulation · 1,555.1 SF',
      'Attic / ceiling insulation · 2,527 SF',
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(countInitialRevealAttentionItems(draft)).toBe(0);
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Mostly ready');
  });

  it('names labeled baths when a plumbing plan prints no fixture or pipe counts', () => {
    const draft = {
      projectTitle: 'Plumbing Estimate Draft',
      projectType: 'plumbing',
      originalNotes: 'Plumbing Estimate Draft',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
          {
            id: 'water_line',
            label: 'Underground water service',
            state: 'included',
          },
          {
            id: 'sewer_line',
            label: 'Underground sewer',
            state: 'included',
          },
          {
            id: 'plumbing_trim',
            label: 'Plumbing fixtures & trim',
            state: 'included',
          },
          {
            id: 'gas_line',
            label: 'Gas piping',
            state: 'included',
          },
          {
            id: 'water_heater',
            label: 'Water heater',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportTradeKey: 'plumbing',
        planImportMode: 'selected_trade',
        planRooms: [
          { name: 'Primary Suite' },
          { name: 'Powder Bath' },
          { name: 'Primary Bath' },
          { name: 'Sauna' },
          { name: 'Garage' },
        ],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      'Powder bath and primary bath are on the floor plan. Fixture counts and pipe lengths are not printed.'
    );
    expect(getInitialRevealChecklistScopePreview(draft).map(row => row.name)).toEqual([
      'Powder bath',
      'Primary bath',
    ]);
    expect(getInitialRevealConfirmItems(draft).pricingScope).toEqual([]);
    expect(countInitialRevealAttentionItems(draft)).toBe(0);
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Mostly ready');
    expect(
      countScopePricingReadiness(
        draft.scopeChecklist.items,
        draft.scopeMeasurements,
        'plumbing'
      ).needsMeasurement
    ).toBe(0);
  });

  it('keeps a printed plumbing count and still skips blank package cards', () => {
    const draft = {
      projectTitle: 'Plumbing Estimate Draft',
      projectType: 'plumbing',
      originalNotes: 'Plumbing Estimate Draft',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportTradeKey: 'plumbing',
        planImportMode: 'selected_trade',
        plumbingRoughPointCount: 12,
        planRooms: [{ name: 'Powder Bath' }],
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft) || '').not.toMatch(/not printed/);
    expect(countInitialRevealAttentionItems(draft)).toBe(0);
    const preview = getInitialRevealChecklistScopePreview(draft);
    expect(preview.some(row => /12/.test(`${row.name} ${row.quantity || ''}`))).toBe(
      true
    );
  });

  it('lists the priced plumbing cards after confirm', () => {
    const draft = {
      projectTitle: 'Plumbing Estimate Draft',
      projectType: 'plumbing',
      originalNotes: 'Plumbing Estimate Draft',
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
          { id: 'water_line', label: 'Underground water service', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportTradeKey: 'plumbing',
        planImportMode: 'selected_trade',
        plumbingRoughPointCount: 10,
        waterLineLf: 25,
        pricingAcceptance: {
          plumbing_rough: { totalAmount: 5350, selectionStatus: 'accepted' },
          water_line: { totalAmount: 800, selectionStatus: 'accepted' },
        },
      },
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBeNull();
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Underground water service', amount: 800, quantity: '25 LF' },
      { name: 'Plumbing rough-in', amount: 5350, quantity: '10 EA' },
    ]);
  });

  it('still flags a notes plumbing rough-in that has no count', () => {
    const draft = {
      projectType: 'plumbing',
      originalNotes: 'Plumbing rough-in for the new bath.',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          {
            id: 'plumbing_rough',
            label: 'Plumbing rough-in',
            state: 'included',
            noteBacked: true,
          },
        ],
      },
      scopeMeasurements: {},
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft, 6).join(' ')).toMatch(
      /rough-in/i
    );
    expect(
      countScopePricingReadiness(
        draft.scopeChecklist.items,
        draft.scopeMeasurements,
        'plumbing',
        draft.originalNotes
      ).needsMeasurement
    ).toBeGreaterThan(0);
  });
});
