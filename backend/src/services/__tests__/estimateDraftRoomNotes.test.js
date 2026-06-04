const {
  extractPricingItemsFromText,
  buildScopePackage,
} = require('../estimateDraftPartialPricing');
const {
  isJunkPriceLabel,
  isAbsurdParsedAmount,
} = require('../estimateDraftQuantityPrice');
const { extractRoomNotesText, sectionMatchesRoom, itemLabelMatchesRoom } = require('../estimateDraftRoomNotes');

const RUTH_NOTES = `
Ruth bid

Master bathroom
Demo shower, tub, floor, vanity top. Build new shower with tile.
Three dollar per square foot allowance for shower walls and six for floor tile.
Price for master bathroom $19,309

Master bedroom with closet
Remove baseboards and flooring. Install LVP and baseboards. Paint three tone.
Price $3,240

Bedroom #1
Demo flooring. Install carpet and baseboards. Paint three tone paint.
Price $1,272

Bedroom #2
Demo baseboards and flooring. Install carpet. Paint three tone paint.
Price $1,350

that gives us a total of $99,986
`.trim();

describe('PDF / copy-paste pricing noise', () => {
  test('rejects numeric-only labels like PDF line numbers', () => {
    expect(isJunkPriceLabel('19')).toBe(true);
    expect(isJunkPriceLabel('10')).toBe(true);
    expect(isJunkPriceLabel('that gives us a total of')).toBe(true);
    expect(isJunkPriceLabel('Tile demo labor')).toBe(false);
  });

  test('extractPricingItemsFromText skips 19: $309 and meta totals', () => {
    const pdfNoise =
      '19: $309\n10: $316,000\n28: $629\nthat gives us a total of: $99,986\nInstall vanity $1,200';
    const items = extractPricingItemsFromText(pdfNoise);
    const names = items.map((i) => i.name.toLowerCase());
    expect(names.some((n) => n === '19')).toBe(false);
    expect(names.some((n) => /total of/.test(n))).toBe(false);
    expect(items.some((i) => i.amount === 316000)).toBe(false);
    expect(items.some((i) => /vanity/i.test(i.name) && i.amount === 1200)).toBe(true);
  });

  test('isAbsurdParsedAmount flags huge amounts with numeric labels', () => {
    expect(isAbsurdParsedAmount(316000, '10')).toBe(true);
    expect(isAbsurdParsedAmount(19309, 'Master bathroom')).toBe(false);
  });
});

describe('room-specific note extraction', () => {
  test('extractRoomNotesText isolates master bathroom section', () => {
    const text = extractRoomNotesText(RUTH_NOTES, 'Master bathroom', 'Full bath remodel');
    expect(text.toLowerCase()).toMatch(/master bathroom|demo shower/);
    expect(text).not.toMatch(/bedroom #1/i);
    expect(text).not.toMatch(/\$99,986/);
  });

  test('extractRoomNotesText distinguishes bedroom #1 vs #2', () => {
    const b1 = extractRoomNotesText(RUTH_NOTES, 'Bedroom #1', 'Carpet and paint');
    const b2 = extractRoomNotesText(RUTH_NOTES, 'Bedroom #2', 'Carpet and paint');
    expect(b1.toLowerCase()).toMatch(/bedroom #1|bedroom 1|\$1,272/);
    expect(b2.toLowerCase()).toMatch(/bedroom #2|bedroom 2|\$1,350/);
    expect(b1).not.toMatch(/bedroom #2/i);
  });

  test('buildScopePackage does not attach global total to every room', () => {
    const bath = buildScopePackage(
      {
        name: 'Master bathroom',
        scope: 'Demo shower and install tile. Allowance $3/sqft walls.',
        price: 19309,
        priceProvidedByUser: true,
        pricingItems: [],
      },
      { projectType: 'bathroom', statedTotal: 99986 },
      RUTH_NOTES
    );
    const bedroom = buildScopePackage(
      {
        name: 'Bedroom #1',
        scope: 'Demo flooring, carpet, baseboards, paint.',
        price: 1272,
        priceProvidedByUser: true,
        pricingItems: [],
      },
      { projectType: 'home_addition', statedTotal: 99986 },
      RUTH_NOTES
    );

    const bathLabels = (bath.pricingItems || []).map((p) => p.name).join(' ');
    const bedLabels = (bedroom.pricingItems || []).map((p) => p.name).join(' ');

    expect(bathLabels).not.toMatch(/total of|99,986|316,000/);
    expect(bedLabels).not.toMatch(/total of|99,986|316,000/);
    expect(bathLabels).not.toMatch(/\b19:\b/);
    expect(bath.knownSubtotal).toBeLessThanOrEqual(19309);
    expect(bedroom.knownSubtotal).toBeLessThanOrEqual(1272);
  });

  test('user-provided room total becomes single lump line when no valid partial items', () => {
    const pkg = buildScopePackage(
      {
        name: 'Master bedroom with closet',
        scope: 'LVP flooring, baseboards, paint. No paint in closet.',
        price: 3240,
        priceProvidedByUser: true,
        priceIncludesLaborAndMaterials: true,
        pricingItems: [{ name: '19', amount: 309, status: 'confirmed' }],
      },
      { projectType: 'home_addition' },
      RUTH_NOTES
    );
    expect((pkg.pricingItems || []).some((p) => p.name === '19')).toBe(false);
    expect(pkg.knownSubtotal).toBe(3240);
  });

  test('rejects cross-room AI labor lines duplicated on every room', () => {
    const globalLabor = [
      { name: 'Install new carpet and paint three tone paint', amount: 1200, includedInSubtotal: true },
      { name: 'Paint three tone paint', amount: 2436, includedInSubtotal: true },
    ];
    const bath = buildScopePackage(
      {
        name: 'Master bathroom',
        scope: 'Demo shower and install tile. Allowance $3/sqft walls.',
        price: 19309,
        priceProvidedByUser: true,
        priceIncludesLaborAndMaterials: true,
        pricingItems: globalLabor,
      },
      { projectType: 'bathroom', statedTotal: 99986 },
      RUTH_NOTES
    );
    const bedroom = buildScopePackage(
      {
        name: 'Bedroom #1',
        scope: 'Demo flooring, carpet, baseboards, paint.',
        price: 1272,
        priceProvidedByUser: true,
        priceIncludesLaborAndMaterials: true,
        pricingItems: globalLabor,
      },
      { projectType: 'home_addition', statedTotal: 99986 },
      RUTH_NOTES
    );

    const bathNames = (bath.pricingItems || []).map((p) => p.name).join(' ');
    expect(bathNames).not.toMatch(/carpet/i);
    expect(bath.status).toBe('user_provided');
    expect(bath.knownSubtotal).toBe(19309);

    const bedNames = (bedroom.pricingItems || []).map((p) => p.name).join(' ');
    expect(bedNames).toMatch(/carpet|total from notes/i);
    expect(bedroom.knownSubtotal).toBe(1272);
  });

  test('itemLabelMatchesRoom requires distinctive tokens in room context', () => {
    const carpetLine = 'Install new carpet and paint three tone paint';
    expect(itemLabelMatchesRoom(carpetLine, 'bedroom #1 demo flooring install carpet baseboards')).toBe(true);
    expect(itemLabelMatchesRoom(carpetLine, 'master bathroom demo shower tile waterproof')).toBe(false);
  });
});
