import {
  buildGlassDoorPricingDetails,
  resolveBathroomGlassDoorDoorCount,
  resolveBathroomGlassDoorSuggestedPricing,
  resolveBathroomGlassDoorStyle,
} from '@/utils/bathroomGlassDoorPricing';

describe('bathroomGlassDoorPricing', () => {
  test('resolveBathroomGlassDoorStyle defaults unsure for invalid values', () => {
    expect(resolveBathroomGlassDoorStyle('standard_slider')).toBe('standard_slider');
    expect(resolveBathroomGlassDoorStyle('premium_frameless')).toBe('premium_frameless');
    expect(resolveBathroomGlassDoorStyle(null)).toBe('unsure');
    expect(resolveBathroomGlassDoorStyle('custom')).toBe('unsure');
  });

  test('resolveBathroomGlassDoorDoorCount prefers explicit quantity', () => {
    expect(resolveBathroomGlassDoorDoorCount({ quantity: 2, showerDoorCount: 3 })).toBe(2);
    expect(resolveBathroomGlassDoorDoorCount({ showerDoorCount: 2 })).toBe(2);
    expect(resolveBathroomGlassDoorDoorCount({})).toBe(1);
  });

  test('standard slider prices at $1,450 per door installed', () => {
    const details = buildGlassDoorPricingDetails({
      style: 'standard_slider',
      doorCount: 1,
    });
    expect(details).toMatchObject({
      material: 835,
      labor: 615,
      total: 1450,
      perDoor: 1450,
    });

    const twoDoors = buildGlassDoorPricingDetails({
      style: 'standard_slider',
      doorCount: 2,
    });
    expect(twoDoors.total).toBe(2900);
    expect(twoDoors.material).toBe(1670);
    expect(twoDoors.labor).toBe(1230);
  });

  test('premium frameless prices at $2,500 per door installed', () => {
    const details = buildGlassDoorPricingDetails({
      style: 'premium_frameless',
      doorCount: 1,
    });
    expect(details).toMatchObject({
      material: 1550,
      labor: 950,
      total: 2500,
      perDoor: 2500,
    });
  });

  test('unsure uses standard slider planning assumption', () => {
    const pricing = resolveBathroomGlassDoorSuggestedPricing({
      quantity: 1,
      style: 'unsure',
    });
    expect(pricing?.fill).toMatchObject({
      material: 835,
      labor: 615,
      total: 1450,
      splitConfidence: 'low',
      pricingRecordId: 'bps_national:glass_door:bathroom:unsure:1ea',
    });
    expect(pricing?.fill?.helper).toMatch(/standard sliding shower door/i);
  });

  test('premium frameless suggested pricing record id encodes style', () => {
    const pricing = resolveBathroomGlassDoorSuggestedPricing({
      quantity: 1,
      style: 'premium_frameless',
    });
    expect(pricing?.fill).toMatchObject({
      total: 2500,
      pricingRecordId: 'bps_national:glass_door:bathroom:premium_frameless:1ea',
      splitConfidence: 'medium',
    });
  });
});
