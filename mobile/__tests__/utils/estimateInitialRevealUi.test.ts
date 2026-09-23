import {
  filterRoofingRevealAttentionItems,
  filterPlumbingRevealAttentionItems,
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPlanningDisclaimer,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealPriorityItems,
  getInitialRevealScopeMetaLabel,
  getInitialRevealStatusLabel,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
  initialRevealPricingVisible,
  plainLanguageReviewItem,
  shouldDefaultExpandInitialRevealScope,
  shouldShowInitialRevealWhatWeFound,
  splitInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

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
    expect(getInitialRevealTagline(draft)).toBe(
      'Mixed-scope construction · Framing · Flooring'
    );
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual([
      'Framing',
      'Flooring',
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
          { id: 'insulation', label: 'Insulation', state: 'included' },
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
          name: 'Drywall patch / repair',
          quantity: '500 sqft',
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
        expect.objectContaining({ name: 'Insulation' }),
      ])
    );
    expect(preview.find(row => row.name === 'Insulation')).not.toHaveProperty(
      'quantity'
    );
    expect(names).toEqual(
      expect.arrayContaining([
        'Cabinet removal',
        'Fixture removal',
        'Flooring demo / removal',
        'Air sealing',
        'Plumbing',
        'Electrical',
        'Interior paint',
      ])
    );
    expect(names).not.toContain('Kitchen flooring demo / removal');
    expect(names).not.toEqual(
      expect.arrayContaining([
        'Interior door painting',
        'Door casing / trim painting',
        'Exterior trim, windows & doors',
        'Baseboard and trim painting',
      ])
    );
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
      }).find(row => /insulation/i.test(row.name))
    ).toEqual(
      expect.objectContaining({
        name: 'Wall insulation · R-21 · Attic insulation · R-38',
      })
    );
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
});
