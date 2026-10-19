import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import {
  dedicatedDeckMissingQuantityPrompt,
  notesDescribeDedicatedDeckJob,
} from '@/utils/deckNoteScope';
import { notesDescribeDedicatedFlooringJob } from '@/utils/flooringNoteScope';
import { resolveScopeItemIntelligence } from '@/utils/scopeIntelligence';
import { scopeItemNoteBadge } from '@/utils/scopeItemVisualTier';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const NOTE =
  'Remove the existing deck. Pour 6 footings, frame 320 sqft, and install composite decking, railing, and stairs.';

describe('dedicated deck note', () => {
  it('keeps the six named lines and leaves house fields off', () => {
    expect(notesDescribeDedicatedDeckJob(NOTE)).toBe(true);
    expect(notesDescribeDedicatedFlooringJob(NOTE)).toBe(false);
    expect(
      notesDescribeDedicatedDeckJob('Replace 12 squares of roof decking.')
    ).toBe(false);
    expect(
      notesDescribeDedicatedDeckJob('Pour a 400 sqft concrete patio.')
    ).toBe(false);
    expect(
      notesDescribeDedicatedDeckJob(
        'New 1,960 sqft single-story home with an attached 720 sqft 3-car garage and a 240 sqft covered patio. Brick exterior. Standard builder-grade finishes.'
      )
    ).toBe(false);

    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Deck Replacement',
        estimateTier: 'room_remodel',
        originalNotes: NOTE,
        scopeChecklist: {
          templateKey: 'deck_patio',
          items: [
            { id: 'decking', label: 'Decking', state: 'included', inputType: 'yes_no' },
            { id: 'railing', label: 'Railing', state: 'included', inputType: 'yes_no' },
            { id: 'stairs', label: 'Stairs', state: 'included', inputType: 'yes_no' },
            { id: 'permits', label: 'Permits', state: 'unsure', inputType: 'yes_no' },
          ],
        },
        scopeMeasurements: {
          floorAreaSqft: 320,
          wallFramingSqft: 320,
          concreteCy: 14.24,
          deckSqft: 320,
        },
        stillNeededReview: ['Price needed for Deck'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      NOTE
    );

    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'demo_removal',
      'footings_piers',
      'framing_structure',
      'decking',
      'railing',
      'stairs',
    ]);
    expect(repaired.scopeChecklist?.items?.map(item => item.label)).toEqual([
      'Deck demo / removal',
      'Footings',
      'Deck framing',
      'Composite decking',
      'Railing / guardrails',
      'Stair runs',
    ]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`
      )
    ).toEqual([
      'Deck demo / removal',
      'Footings · 6 each',
      'Deck framing · 320 sqft',
      'Composite decking · 320 sqft',
      'Railing / guardrails',
      'Stair runs',
    ]);
    expect(
      groupScopeChecklistItems(repaired.scopeChecklist?.items || [], 'deck_patio', {
        notes: NOTE,
      }).flatMap(group => group.items.map(item => item.id))
    ).toEqual([
      'demo_removal',
      'footings_piers',
      'framing_structure',
      'decking',
      'railing',
      'stairs',
    ]);

    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    expect(Number(measurements.deckSqft)).toBe(320);
    expect(Number(measurements.deckFootingCount)).toBe(6);
    expect(measurements.floorAreaSqft ?? null).toBeNull();
    expect(measurements.wallFramingSqft ?? null).toBeNull();
    expect(measurements.concreteCy ?? null).toBeNull();
    expect(measurements.concreteScope ?? null).toBeNull();
    expect(measurements.railingLf ?? null).toBeNull();
    expect(measurements.deckStairCount ?? null).toBeNull();
    expect(measurements.deckDemoSqft ?? null).toBeNull();

    const quantity = (id: string) =>
      resolveChecklistItemQuantity(id, measurements, {
        templateKey: 'deck_patio',
        notes: NOTE,
      });
    expect(quantity('demo_removal').quantity ?? null).toBeNull();
    expect(quantity('footings_piers').quantity).toBe(6);
    expect(quantity('framing_structure').quantity).toBe(320);
    expect(quantity('decking').quantity).toBe(320);
    expect(quantity('stairs').quantity ?? null).toBeNull();
    expect(quantity('railing').quantity ?? null).toBeNull();
    expect(
      dedicatedDeckMissingQuantityPrompt(NOTE, measurements)
    ).toBe(
      'Enter the deck removal area, railing length, and stair run count before they can be priced.'
    );
    const price = (id: string) =>
      resolveScopeItemSuggestedPricing(
        id,
        measurements,
        'deck_patio',
        quantity(id),
        null,
        null,
        NOTE
      ).fill;
    expect(price('decking')).toMatchObject({
      material: 2560,
      labor: 3840,
      total: 6400,
    });
    expect(price('framing_structure')).toMatchObject({
      material: 1920,
      labor: 2560,
      total: 4480,
      rateSourceLabel: 'Suggested budget split · National Average · deck framing',
    });
    expect(price('footings_piers')).toMatchObject({
      material: 450,
      labor: 750,
      total: 1200,
      rateSourceLabel: 'Suggested budget split · National Average · deck footing',
    });
    expect(price('demo_removal')?.total ?? null).toBeNull();
    expect(price('railing')?.total ?? null).toBeNull();
    expect(price('stairs')?.total ?? null).toBeNull();
    const withTypedCounts = normalizeScopeMeasurements({
      ...measurements,
      deckDemoSqft: 50,
      deckStairCount: 1,
      railingLf: 10,
    });
    const typedQuantity = (id: string) =>
      resolveChecklistItemQuantity(id, withTypedCounts, {
        templateKey: 'deck_patio',
        notes: NOTE,
      });
    expect(typedQuantity('railing')).toMatchObject({
      quantity: 10,
      quantitySource: 'user_entered',
    });
    const badgeFor = (id: string) => {
      const item = repaired.scopeChecklist?.items?.find(row => row.id === id);
      expect(item).toBeTruthy();
      return scopeItemNoteBadge(item!, {
        notes: NOTE,
        templateKey: 'deck_patio',
        measurements: withTypedCounts,
      });
    };
    expect(badgeFor('railing')).toBe('mentioned');
    expect(badgeFor('footings_piers')).toBe('prefilled');
    const typedPrice = (id: string) =>
      resolveScopeItemSuggestedPricing(
        id,
        withTypedCounts,
        'deck_patio',
        resolveChecklistItemQuantity(id, withTypedCounts, {
          templateKey: 'deck_patio',
          notes: NOTE,
        }),
        null,
        null,
        NOTE
      ).fill;
    expect(typedPrice('demo_removal')).toMatchObject({
      material: 100,
      labor: 250,
      total: 350,
      displayUnitRateLabel: '50 sqft × $7/sqft',
    });
    expect(typedPrice('stairs')).toMatchObject({
      material: 220,
      labor: 380,
      total: 600,
      displayUnitRateLabel: '1 run × $600/run',
    });
    expect(
      repaired.scopeChecklist?.items?.find(item => item.id === 'railing')
        ?.helperText
    ).toBe('Enter the railing length. The note does not give one.');
  });

  it('prices wood decking at the national rate and railing from the note', () => {
    const note =
      'Install 240 sqft of wood decking and 36 LF of railing. No demo. Railing material $10 per LF, labor $14 per LF.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'deck_patio',
        projectTitle: 'Wood Decking and Railing Installation',
        estimateTier: 'room_remodel',
        originalNotes: note,
        scopeChecklist: { templateKey: 'deck_patio', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      note
    );
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'decking',
      'railing',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`
      )
    ).toEqual(['Wood decking · 240 sqft', 'Railing / guardrails · 36 LF']);
    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    expect(Number(measurements.deckSqft)).toBe(240);
    expect(Number(measurements.railingLf)).toBe(36);
    const quantity = (id: string) =>
      resolveChecklistItemQuantity(id, measurements, {
        templateKey: 'deck_patio',
        notes: note,
      });
    const price = (id: string) =>
      resolveScopeItemSuggestedPricing(
        id,
        measurements,
        'deck_patio',
        resolveChecklistItemQuantity(id, measurements, {
          templateKey: 'deck_patio',
          notes: note,
        }),
        null,
        null,
        note
      ).fill;
    expect(price('decking')).toMatchObject({
      material: 1920,
      labor: 2880,
      total: 4800,
    });
    expect(quantity('railing')).toMatchObject({
      quantity: 36,
      quantitySource: 'notes',
    });
    expect(price('railing')).toMatchObject({
      material: 360,
      labor: 504,
      total: 864,
      rateSourceLabel: 'From notes',
      basis: { quantity: 36, unit: 'lf' },
      displayUnitRateLabel: '36 LF × $24/LF',
    });
    expect(
      repaired.scopeChecklist?.items?.find(item => item.id === 'railing')
        ?.helperText
    ).toBe('Railing length from the notes.');
    expect(
      resolveScopeItemIntelligence({
        scopeKey: 'railing',
        templateKey: 'deck_patio',
        notes: note,
        measurements,
        resolved: quantity('railing'),
      }).formula
    ).toBeNull();

    const pricedAsLength = normalizeScopeMeasurements({
      ...measurements,
      itemQuantities: {
        railing: {
          quantity: 864,
          unit: 'allowance',
          quantitySource: 'notes',
        },
        railing__material: {
          quantity: 360,
          unit: 'allowance',
          quantitySource: 'notes',
        },
        railing__labor: {
          quantity: 504,
          unit: 'allowance',
          quantitySource: 'notes',
        },
      },
    });
    expect(
      resolveChecklistItemQuantity('railing', pricedAsLength, {
        templateKey: 'deck_patio',
        notes: note,
      }).quantity
    ).toBe(36);
  });
});
