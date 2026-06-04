const { normalizeDraft } = require('../estimateDraftFromNotes');
const { enrichDraft } = require('../estimateDraftEnrichment');

const FLOOR_SCOPE_NOTES =
  "OK, let's create a bid. I have a floor job. I have 1200 ft.² of tile demo. I have 1200 ft.² of laminate flooring installation and 500 linear feet of baseboard installation, caulk and paint";

describe('scope-only → pricing → apply flow (Phase 1 E2E)', () => {
  test('priced scope packages re-enrich as applyable draft', () => {
    const scopeDraft = normalizeDraft(
      {
        projectType: 'flooring',
        projectTitle: 'Floor job',
        rooms: [
          {
            name: 'Tile Demo',
            scope: 'Demolish 1200 sqft of existing tile',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
          {
            name: 'Laminate Flooring',
            scope: 'Install 1200 sqft laminate flooring',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
          {
            name: 'Baseboard',
            scope: 'Install 500 linear feet of baseboard, caulk and paint',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [],
      },
      { originalNotes: FLOOR_SCOPE_NOTES }
    );

    expect(scopeDraft.noPricingDetected).toBe(true);
    expect(scopeDraft.noteProfile?.primary).toBe('scope_only');

    const pricedDraft = {
      ...scopeDraft,
      customerName: 'Test Customer',
      projectAddress: '123 Main St',
      rooms: scopeDraft.rooms.map((room) => {
        if (/tile|demo/i.test(room.name)) {
          return {
            ...room,
            price: 6000,
            laborPrice: 6000,
            materialPrice: null,
            priceIncludesLaborAndMaterials: false,
            priceProvidedByUser: true,
          };
        }
        if (/laminate|flooring/i.test(room.name)) {
          return {
            ...room,
            price: 10800,
            laborPrice: 6000,
            materialPrice: 4800,
            priceIncludesLaborAndMaterials: false,
            priceProvidedByUser: true,
          };
        }
        if (/baseboard/i.test(room.name)) {
          return {
            ...room,
            price: 1675,
            laborPrice: 1250,
            materialPrice: 425,
            priceIncludesLaborAndMaterials: false,
            priceProvidedByUser: true,
          };
        }
        return room;
      }),
      calculatedLineItemTotal: 18475,
      calculatedLaborTotal: 13250,
      calculatedMaterialTotal: 5225,
    };

    const enriched = enrichDraft(pricedDraft, { originalNotes: FLOOR_SCOPE_NOTES });

    expect(enriched.noPricingDetected).toBe(false);
    expect(enriched.noteProfile?.primary).not.toBe('scope_only');
    expect(enriched.calculatedLineItemTotal).toBe(18475);
    expect(enriched.scopePackages.every((p) => p.status !== 'missing_price')).toBe(true);
    expect(enriched.estimateConfidence?.level).toMatch(/high|medium/);
    expect(enriched.stillNeededReview?.length ?? 0).toBe(0);
  });
});
