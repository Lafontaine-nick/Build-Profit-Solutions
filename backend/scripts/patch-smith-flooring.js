#!/usr/bin/env node
const fs = require('fs');

const mp = '/Users/nicholas/Documents/Build-Profit-Solutions/backend/src/services/scopeMeasurementParser.js';
let t = fs.readFileSync(mp, 'utf8');

t = t.replace(
  /const bathFloor =\s*\n\s*pickSqftFromClauses\(\[[^\]]+\]\) \|\|\s*\n\s*firstGenericBathroomSqft\(\);/,
  `const bathFloor =
    pickSqftFromClauses([
      /\\bbath(?:room)?.\\s+floor\\b/,
      /\\bbath(?:room)?.\\b.*\\bfloor(?:ing)?.\\b/,
      /\\bfloor\\b.*\\bbath(?:room)?.\\b/,
      /\\b(?:main\\s+)(?:bath(?:room|)|bath)\\b/,
    ]) ||
    firstGenericBathroomSqft();`
);

t = t.replace(
  /if \(\/\\bbaseboard\\b[\s\S]*?continue;\s*\n\s*if \(!\/\\b\(demo[\s\S]*?continue;/,
  `if (
        /\\bbaseboards?\\b|\\btrim\\b|\\bmoulding\\b|\\bmolding\\b|\\bcasing\\b/i.test(c) &&
        !/\\b(install|installation|lvp|laminate|vinyl|carpet|flooring|tile|demo|demolition|remove|removal|tear[\\s-]?out)\\b/i.test(c)
      ) {
        continue;
      }
      if (/\\bback\\s*splash|backsplash|\\bcountertop|\\bpaint\\b|\\bshower\\b/i.test(c)) continue;
      if (!/\\b(demo|demolition|remove|removal|tear[\\s-]?out|install|installation|laminate|tile|lvp|vinyl|flooring|floor|carpet)\\b/i.test(c)) continue;`
);

fs.writeFileSync(mp, t);

const cat = '/Users/nicholas/Documents/Build-Profit-Solutions/backend/src/services/scopeItemQuantityCatalog.js';
let c = fs.readFileSync(cat, 'utf8');
if (!c.includes('return applyPricingReadyFlags(')) {
  c = c.replace(
    `    if (measurements[key]) {
      return {
        quantity: measurements[key],
        unit: rule.defaultUnit,
        quantitySource: QUANTITY_SOURCES.inferred,
        label: packageName,
        sourceLabel: sourceLabel(QUANTITY_SOURCES.inferred),
        rule,
        pricingReady: true,
      };
    }`,
    `    if (measurements[key]) {
      return applyPricingReadyFlags(
        {
          quantity: measurements[key],
          unit: rule.defaultUnit,
          quantitySource: QUANTITY_SOURCES.inferred,
          label: packageName,
          sourceLabel: sourceLabel(QUANTITY_SOURCES.inferred),
          rule,
          pricingReady: true,
        },
        itemId,
        ctx
      );
    }`
  );
  fs.writeFileSync(cat, c);
}

const testFile = '/Users/nicholas/Documents/Build-Profit-Solutions/backend/src/services/__tests__/scopeMeasurementParser.test.js';
let te = fs.readFileSync(testFile, 'utf8');
if (!te.includes('Smith residence flooring')) {
  const insert = `
  test('Smith residence flooring: mixed lump-sum demo, allowance demo, unpriced LVP, trim, cleanup', () => {
    const notes =
      'Floor job at Smith residence. Demo existing tile in main bath 850 sqft lump sum $2,550. Demo kitchen vinyl 180 sqft allowance $900. Install LVP in both areas 1030 total sqft not priced yet. Baseboards throughout 220 LF lump sum $1,540. Final clean and haul off $650 lump sum.';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'flooring', projectType: 'flooring' });

    expect(parsed.bathroomFloorSqft).toBe(850);
    expect(parsed.kitchenFloorSqft).toBe(180);
    expect(parsed.floorAreaSqft).toBe(1030);
    expect(parsed.baseboardLf).toBe(220);
    expect(parsed.itemQuantities?.floor_demo).toMatchObject({
      quantity: 3460,
      unit: 'allowance',
      quantitySource: 'notes',
    });
    expect(parsed.itemQuantities?.demo).toBeUndefined();
    expect(parsed.itemQuantities?.flooring).toBeUndefined();
    expect(parsed.itemQuantities?.trim).toMatchObject({ quantity: 1540, unit: 'allowance' });
    expect(parsed.itemQuantities?.cleanup).toMatchObject({ quantity: 650, unit: 'lump_sum' });

    expect(inferItemStateFromNotes('floor_demo', notes)).toBe('included');
    expect(inferItemStateFromNotes('flooring', notes)).toBe('included');
    expect(inferItemStateFromNotes('trim', notes)).toBe('included');
    expect(inferItemStateFromNotes('cleanup', notes)).toBe('included');

    const norm = normalizeScopeMeasurements(parsed);
    expect(
      resolveQuantityForChecklistItem('floor_demo', { templateKey: 'flooring', notes, measurements: norm })
    ).toMatchObject({ quantity: 3460, pricingReady: true });
    expect(
      resolveQuantityForChecklistItem('flooring', { templateKey: 'flooring', notes, measurements: norm })
    ).toMatchObject({ quantity: 1030, unit: 'sqft', pricingReady: false });
    expect(
      resolveQuantityForChecklistItem('cleanup', { templateKey: 'flooring', notes, measurements: norm })
    ).toMatchObject({ quantity: 650, pricingReady: true });
  });

`;
  te = te.replace(
    "  test('flooring scope maps lump-sum tile demo and plural baseboards to existing checklist items', () => {",
    insert + "  test('flooring scope maps lump-sum tile demo and plural baseboards to existing checklist items', () => {"
  );
  fs.writeFileSync(testFile, te);
}

console.log('patch complete');
