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

describe('estimateInitialRevealUi', () => {
  it('maps technical review copy to plain language', () => {
    expect(plainLanguageReviewItem('Low-confidence quantity for wall tile')).toContain(
      'Please check quantity'
    );
    expect(plainLanguageReviewItem('Pricing gap on plumbing')).toBe('Price needed on plumbing');
    expect(
      plainLanguageReviewItem(
        'Overall bid total or room lump sums (e.g. bathroom $8,500), or $/sqft rates with square footage'
      )
    ).toBe('Pricing total not found in notes');
    expect(plainLanguageReviewItem('Pricing for tile demo')).toBe('Price needed for tile demo');
  });

  it('labels status from attention count and confidence', () => {
    const draft = {
      estimateConfidence: { level: 'high' },
    } as EstimateAiDraft;
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Ready to send');
    expect(getInitialRevealStatusLabel(draft, 2).label).toBe('Mostly ready · 2 to check');
  });

  it('builds primary CTA from attention count', () => {
    expect(getInitialRevealPrimaryCtaLabel(0)).toBe('Review & apply estimate');
    expect(getInitialRevealPrimaryCtaLabel(3)).toBe('Continue to review · 3 to check');
    expect(getInitialRevealPrimaryCtaLabel(0, true)).toBe('Confirm scope');
  });

  it('prefers scope items over admin fields on reveal', () => {
    const draft = {
      stillNeededReview: ['Customer name', 'Pricing for tile demo', 'Project address'],
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
      stillNeededReview: ['Customer name', 'Pricing for tile demo', 'Project address'],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope.some((item) => /tile demo/i.test(item))).toBe(true);
    expect(buckets.bidDetails).toEqual([]);
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
          trim_paint: { quantity: '200', unit: 'lf', quantitySource: 'user_entered' },
          trim_paint__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
          trim_paint__labor: { quantity: '1100', unit: 'allowance', quantitySource: 'user_entered' },
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
    expect(buckets.pricingScope).not.toContain('Pricing total not found in notes');
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

  it('fills Scope found with plumbing note bullets and checklist preview', () => {
    const draft = {
      projectTitle: 'Plumbing bid',
      projectType: 'plumbing',
      originalNotes:
        '12 plumbing rough-in points. 150 LF of water line. 80 LF sewer line. 2 water heaters.',
      scopeChecklist: {
        templateKey: 'plumbing',
        items: [
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
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

  it('keeps detected bathroom scope visible when pricing packages are partial', () => {
    const draft = {
      projectType: 'bathroom',
      originalNotes: 'Install shower wall tile, lighting, and a new toilet.',
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'shower_tile', label: 'Shower wall tile', state: 'included' },
          { id: 'lighting', label: 'New lighting fixtures & install', state: 'included' },
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

    expect(getInitialRevealChecklistScopePreview(draft).map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'Shower wall tile',
        'New lighting fixtures & install',
        'Toilet',
      ]),
    );
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
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
          { id: 'plumbing_trim', label: 'Plumbing trim / hookups', state: 'included' },
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
          { id: 'sewer_line', label: 'Sewer / drain piping', state: 'excluded' },
        ],
      },
      scopePackages: [],
      scopeMeasurements: { tradeWorkflowSource: 'standalone_trade' },
    } as EstimateAiDraft;
    expect(getInitialRevealTagline(draft)).toContain('Kitchen plumbing · 4 scope lines');
    expect(getInitialRevealUnderstoodBullets(draft, 4)).toEqual([
      '3 rough-in points',
      '4 trim hookups',
      '25 LF water line',
      '1 gas appliance hookup',
    ]);
    expect(getInitialRevealChecklistScopePreview(draft).map((row) => row.name)).toEqual([
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
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
          { id: 'plumbing_trim', label: 'Plumbing trim / hookups', state: 'included' },
          { id: 'sewer_line', label: 'Sewer / drain piping', state: 'included' },
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
    expect(getInitialRevealTagline(draft)).toContain('Bathroom plumbing · 3 scope lines');
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
          { id: 'tear_off', label: 'Tear-off', state: 'included', choiceId: 'one_layer' },
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
    expect(buckets.pricingScope.some((item) => /roofing/i.test(item))).toBe(false);
    expect(buckets.pricingScope.some((item) => /shingle color/i.test(item))).toBe(false);
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
          { id: 'tear_off', label: 'Tear-off', state: 'included', choiceId: 'one_layer' },
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
    expect(getInitialRevealUnderstoodBullets(draft, 3).join(' ')).not.toMatch(/\$/);
    expect(getInitialRevealChecklistScopePreview(draft).every((row) => row.amount === 0)).toBe(
      true
    );
  });

  it('merges explicit catalog note facts into Scope found', () => {
    const draft = {
      projectType: 'kitchen',
      scopeChecklist: {
        templateKey: 'kitchen',
        title: 'Kitchen',
        intro: 'Confirm scope',
        items: [
          { id: 'cabinets', label: 'Cabinets', state: 'included', noteBacked: true },
          { id: 'countertops', label: 'Countertops', state: 'included', noteBacked: true },
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

    expect(getInitialRevealChecklistScopePreview(draft).map((row) => row.name)).toEqual([
      'Cabinets',
      'Countertops',
      'Window installation',
      'Insulation',
    ]);
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

    expect(getInitialRevealChecklistScopePreview(draft).map((row) => row.name)).toEqual([
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

    expect(getInitialRevealChecklistScopePreview(draft).map((row) => row.name)).toEqual([
      'Cabinet demo / removal',
      'Countertop demo / removal',
      'Backsplash demo / removal',
      'Kitchen flooring demo / removal',
      'Cabinets',
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
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included', noteBacked: true },
          { id: 'plumbing_trim', label: 'Plumbing trim / hookups', state: 'included', noteBacked: true },
          { id: 'water_line', label: 'Water line piping', state: 'included', noteBacked: true },
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
    expect(getInitialRevealStatusLabel(draft, buckets.pricingScope.length).label).toBe(
      'Ready to send'
    );
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
          { id: 'pour_flatwork', label: 'Pour flatwork', state: 'included', noteBacked: true },
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
          { id: 'reinforcement', label: 'Rebar / mesh', state: 'included', noteBacked: true },
          { id: 'complex_forming', label: 'Complex forming', state: 'included', noteBacked: true },
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
      getInitialRevealUnderstoodBullets(draft, 6).some((line) => /900 sqft flatwork/i.test(line))
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
          { id: 'tear_off', label: 'Tear-off', state: 'included', choiceId: 'one_layer' },
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
