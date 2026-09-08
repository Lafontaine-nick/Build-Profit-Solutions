import {
  applyBathroomPlanningMeasurements,
  filterBathroomRevealAttentionItems,
  notesCustomerSuppliesBathroomFixtures,
  notesImplyBathroomFullRoomPaint,
  parseVanityCabinetLfFromNotes,
  reconcileBathroomQuickMeasurements,
} from '@/utils/bathroomPlanningMeasurements';

const LIGHT_BATH_NOTE =
  'Bathroom refresh — same layout. Demo old floor tile and shower surround. New shower wall tile 60 sqft, shower floor 10 sqft, bathroom floor 40 sqft. Replace toilet and 36" vanity. Paint. Haul off included.';

const JOHNSON_BATH_NOTE = `Main bathroom remodel at Johnson residence. Demo existing tile, vanity, toilet, and shower surround.

Wet area: new walk-in shower with tile walls and shower pan, glass shower door, waterproofing/backer board. Shower wall tile about 85 sqft, shower floor tile 12 sqft.

Vanity: remove and replace — 48" double vanity, new faucet set.

Toilet: replace existing.

Floor: install new tile outside the shower, bathroom floor about 55 sqft.

Paint walls and ceiling after tile work.

Include final clean and haul off. Customer supplying vanity and toilet fixtures; we install only.`;

describe('bathroomPlanningMeasurements', () => {
  test('lighter refresh note avoids living-area and shower-wall paint bleed', () => {
    const parsed = applyBathroomPlanningMeasurements(
      {
        bathroomFloorSqft: 40,
        showerWallTileSqft: 60,
        showerFloorTileSqft: 10,
        floorAreaSqft: 40,
        wallPaintSqft: 60,
      },
      LIGHT_BATH_NOTE,
      { templateKey: 'bathroom', projectType: 'bathroom' }
    );

    expect(parsed.floorAreaSqft).toBeUndefined();
    expect(parsed.wallPaintSqft).toBe(128);
    expect(parsed.cabinetLf).toBe(3);
    expect(
      (parsed as { bathroomPaintRepairScope?: string }).bathroomPaintRepairScope
    ).toBeUndefined();
  });

  test('Johnson extensive bath note infers wall/ceiling paint from floor SF', () => {
    const parsed = applyBathroomPlanningMeasurements(
      {
        bathroomFloorSqft: 55,
        showerWallTileSqft: 85,
        showerFloorTileSqft: 12,
        wallPaintSqft: 55,
        ceilingPaintSqft: 55,
        combinedPaintableAreaSqft: 55,
      },
      JOHNSON_BATH_NOTE,
      { templateKey: 'bathroom', projectType: 'bathroom' }
    );

    expect(parsed.wallPaintSqft).toBe(176);
    expect(parsed.ceilingPaintSqft).toBeUndefined();
    expect(parsed.combinedPaintableAreaSqft).toBeUndefined();
    expect(parsed.cabinetLf).toBe(4);
  });

  test('parseVanityCabinetLfFromNotes handles inch and quote formats', () => {
    expect(parseVanityCabinetLfFromNotes('Replace 48 inch vanity')).toBe(4);
    expect(parseVanityCabinetLfFromNotes('new 36" vanity')).toBe(3);
    expect(parseVanityCabinetLfFromNotes('48" double vanity')).toBe(4);
  });

  test('notesCustomerSuppliesBathroomFixtures detects install-only language', () => {
    expect(notesCustomerSuppliesBathroomFixtures(JOHNSON_BATH_NOTE)).toBe(true);
    expect(
      notesCustomerSuppliesBathroomFixtures(
        'Replace toilet. Contractor supplies fixture.'
      )
    ).toBe(false);
  });

  test('notesImplyBathroomFullRoomPaint ignores patch-only language', () => {
    expect(notesImplyBathroomFullRoomPaint('Paint full room')).toBe(true);
    expect(notesImplyBathroomFullRoomPaint('Patch and paint wet area')).toBe(
      false
    );
  });

  test('reconcileBathroomQuickMeasurements strips bath-floor living-area bleed', () => {
    const next = reconcileBathroomQuickMeasurements(
      { floorAreaSqft: '40', bathroomFloorSqft: '40' },
      LIGHT_BATH_NOTE
    );
    expect(next.floorAreaSqft).toBeUndefined();
    expect(next.bathroomFloorSqft).toBe('40');
  });

  test('reconcileBathroomQuickMeasurements upgrades paint SF from floor bleed', () => {
    const next = reconcileBathroomQuickMeasurements(
      {
        bathroomFloorSqft: '55',
        wallPaintSqft: '55',
        ceilingPaintSqft: '55',
      },
      JOHNSON_BATH_NOTE
    );
    expect(next.wallPaintSqft).toBe('176');
    expect(next.ceilingPaintSqft).toBeUndefined();
  });

  test('filterBathroomRevealAttentionItems removes gutter and moisture noise', () => {
    const draft = { scopeChecklist: { templateKey: 'bathroom' } };
    const filtered = filterBathroomRevealAttentionItems(draft, [
      'Pricing for shower tile',
      'Gutter / water mitigation services',
      'Pricing for moisture barrier',
    ]);
    expect(filtered).toEqual(['Pricing for shower tile']);
  });
});
