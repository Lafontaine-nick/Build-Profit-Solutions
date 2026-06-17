#!/usr/bin/env node
/**
 * One-shot patch for Smith residence flooring Step 2 regression fixes.
 * Run: node scripts/apply-smith-flooring-fixes.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src', 'services');

function patchEstimateDraftQuantityPrice() {
  const file = path.join(root, 'estimateDraftQuantityPrice.js');
  let t = fs.readFileSync(file, 'utf8');
  if (!t.includes('function splitScopeNoteSentences')) {
    t = t.replace(
      '/** Break run-on notes into clauses so "removal … in 1200 … installation" assigns qty per task. */',
      `/**
 * Sentence breaks — skip decimals ($1.50) but split after priced totals ($2,550. Demo)
 * when the next clause starts a new scope item.
 */
const SCOPE_NOTE_SENTENCES_RE =
  /(?<!\\d)\\.\\s+(?=[a_z])|\\.\s+(?=(?:demo|install|final|baseboards?|remove|tear|new|paint|cleanup|haul|trim|replace|lvp|vinyl|carpet|flooring)\\b)/gi;

function splitScopeNoteSentences(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(SCOPE_NOTE_SENTENCES_RE)
    .map((x) => x.trim())
    .filter(Boolean);
  if (sentences.length === 1) {
    sentences = normalized
      .split(/[;\\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return sentences;
}

/** Break run-on notes into clauses so "removal … in 1200 … installation" assigns qty per task. */`
    );
  }
  if (t.includes('// Sentence breaks in walkthrough notes')) {
    t = t.replace(
      /  \/\/ Sentence breaks in walkthrough notes[\s\S]*?  \}\n\n  const clauses = \[\];/,
      `  const sentences = splitScopeNoteSentences(normalized);

  const clauses = [];`
    );
  }
  if (!t.includes('__FINAL_CLEAN_HAUL__')) {
    t = t.replace(
      `    sentence = sentence.replace(/\\bwalls?\\s+and\\s+(?:the\\s+})?/?ceiling\\b/gi, (m) =>
      m.replace(/\\s+and\\s+/i, ' __WALLS_CEILING__ ')
    );`,
      `    sentence = sentence.replace(/\\bwalls?\\s+and\\s+(?:the\\s+})?/?ceiling\\b/gi, (m) =>
      m.replace(/\\s+and\\s+/i, ' __WALLS_CEILING__ ')
    );
    sentence = sentence.replace(/\\bfinal\\s+clean\\s+and\\s+haul(?:[\\s-]?off?\\)\\b/gi, (m) =>
      m.replace(/\\s+and\\s+/i, ' __FINAL_CLEAN_HAUL__ ')
    );`
    );
    t = t.replace(
      `.replace(/__WALLS_CEILING__/g, ' and ')`,
      `.replace(/__WALLS_CEILING__/g, ' and ').replace(/__FINAL_CLEAN_HAUL__/g, ' and ')`
    );
  }
  if (!t.includes('splitScopeNoteSentences,')) {
    t = t.replace('  splitNoteClauses,', '  splitNoteClauses,\\n  splitScopeNoteSentences,');
  }
  fs.writeFileSync(file, t);
}

function patchScopeAllowanceParser() {
  const file = path.join(root, 'scopeAllowanceParser.js');
  let t = fs.readFileSync(file, 'utf8');
  if (!t.includes("require('./estimateDraftQuantityPrice')")) {
    t = t.replace(
      'const UNIT_RATE_AFTER_RE =',
      `const { splitScopeNoteSentences } = require('./estimateDraftQuantityPrice');
const ACCUMULATE_ALLOWANCE_IDS = new Set(['floor_demo']);

const UNIT_RATE_AFTER_RE =`
    );
  }
  t = t.replace(
    /function splitAllowanceClauses\(text\) \{[\s\S]*?\}/,
    `function splitAllowanceClauses(text) {
  return splitScopeNoteSentences(text);
}`
  );
  if (!t.includes("id: 'floor_demo'")) {
    // floor_demo was removed in stash - restore order
  }
  const matcherBlock = `  {
    id: 'floor_demo',
    match:
      /\\b(?:demo|demolition|tear[\\s-]?out|remove|removal)\\b[^.;]{0,80}\\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\\b|\\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\\b[^.;]{0,80}\\b(?:demo|demolition|tear[\\s-]?out|remove|removal)\\b/i,
    unit: 'allowance',
  },
  {
    id: 'cleanup',
    match: /\\b(cleanup|disposal|dumpster|debris|final\\s+clean(?:\\s+and\\s+haul(?:[\\s-]?off?))?)\\b/i,
    exclude: /\\b(demo|demolition|tear[\\s-]?out)\\b/i,
    unit: 'lump_sum',
  },
  {
    id: 'demo',
    match: /\\b(demo|demolition|tear[\\s-]?out|gut|haul[\\s-]?off)\\b/i,
    exclude: /\\b(final\\s+clean|cleanup|disposal)\\b/i,
    unit: 'lump_sum',
  },`;
  if (t.includes("id: 'demo',\n    match: /\\b(demo|demolition")) {
    t = t.replace(
      /  \{\n    id: 'demo',[\s\S]*?unit: 'lump_sum',\n  \},\n  \{\n    id: 'cleanup',[\s\S]*?unit: 'lump_sum',\n  \},/,
      matcherBlock
    );
  }
  if (!t.includes('floor_demo')) {
    t = t.replace(
      /  \{\n    id: 'glass_door',[\s\S]*?unit: 'allowance',\n  \},/,
      `  {
    id: 'glass_door',
    match: /\\b(shower\\s+door|glass\\s+shower)\\b/i,
    unit: 'allowance',
  },
${matcherBlock}`
    );
  }
  t = t.replace(
    `    exclude: /\\b(demo|demolition|remove|removal|tear[\\s-]?out|\\/|per\\s+sq)/i,
    unit: 'allowance',
  },
  {
    id: 'trim',`,
    `    exclude: /\\b(demo|demolition|remove|removal|tear[\\s-]?out|\\/|per\\s+sq|not\\s+priced|unpriced|no\\s+pric(?:e|ing))/i,
    unit: 'allowance',
  },
  {
    id: 'trim',`
  );
  if (!t.includes('ACCUMULATE_ALLOWANCE_IDS.has')) {
    t = t.replace(
      `      if (matcher.id === 'demo' && matchedIdsForClause.has('floor_demo')) continue;
      if (!clauseMatchesMatcher(clause, matcher)) continue;
      if (out[matcher.id]) continue;

      const amount = pickAmountForMatcher(clause, matcher) ?? pickClauseTotalAmount(clause);`,
      `      if (matcher.id === 'demo' && matchedIdsForClause.has('floor_demo')) continue;
      if (matcher.id === 'demo' && /\\b(final\\s+clean|cleanup|disposal)\\b/i.test(clause)) continue;
      if (!clauseMatchesMatcher(clause, matcher)) continue;

      const amount = pickAmountForMatcher(clause, matcher) ?? pickClauseTotalAmount(clause);
      if (!amount) continue;

      if (ACCUMULATE_ALLOWANCE_IDS.has(matcher.id) && out[matcher.id]) {
        out[matcher.id].quantity += amount;
        matchedIdsForClause.add(matcher.id);
        continue;
      }
      if (out[matcher.id]) continue;

      const amount2 = amount;`
    );
    t = t.replace('const amount2 = amount;\n      if (!amount) continue;\n', '');
  }
  fs.writeFileSync(file, t);
}

function patchScopeMeasurementParser() {
  const file = path.join(root, 'scopeMeasurementParser.js');
  let t = fs.readFileSync(file, 'utf8');
  if (!t.includes('matchedPattern')) {
    t = t.replace(
      `  const pickSqftFromClauses = (patterns) => {
    for (const clause of clauses) {
      if (!clauseMatches(clause, patterns)) continue;
      const near = pickSqftNearPattern(clause, patterns[0]);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }`,
      `  const pickSqftFromClauses = (patterns) => {
    for (const clause of clauses) {
      const matchedPattern = patterns.find((p) => p.test(clause.toLowerCase()));
      if (!matchedPattern) continue;
      const near = pickSqftNearPattern(clause, matchedPattern);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }`
    );
  }
  t = t.replace(
    /pickSqftFromClauses\(\[\\bbath\(\?:room\)\?\\s\+floor\\b[^\]]+\]\) \|\|/,
    `pickSqftFromClauses([
      /\\bbath(?:room?\\)\\s+floor\\b/,
      /\\bbath(?:room?\\)\\b.*\\bfloor(?:ing?\\)\\b/,
      /\\bfloor\\b.*\\bbath(?:room?\\)\\b/,
      /\\b(?:main\\s+)(?:bath(?:room?\\)|bath)\\b/,
    ]) ||`
  );
  t = t.replace(
    `      if (/\\bbaseboards?\\b|\\btrim\\b|\\bmoulding\\b|\\bmolding\\b|\\bcasing\\b|\\bback\\s*splash|backsplash|\\bcountertop|\\bpaint\\b|\\bshower\\b/).test(c)) continue;`,
    `      if (/\\bbaseboards?\\b|\\btrim\\b|\\bmoulding\\b|\\bmolding\\b|\\bcasing\\b/i.test(c) &&
        !/\\b(install|installation|lvp|laminate|vinyl|carpet|flooring|tile|demo|demolition|remove|removal|tear[\\s-]?out)\\b/i.test(c)) {
        continue;
      }
      if (/\\bback\\s*splash|backsplash|\\bcountertop|\\bpaint\\b|\\bshower\\b/i.test(c)) continue;`
  );
  fs.writeFileSync(file, t);
}

function patchScopeItemQuantityCatalog() {
  const file = path.join(root, 'scopeItemQuantityCatalog.js');
  let t = fs.readFileSync(file, 'utf8');
  t = t.replace(
    "measurementKeys: ['kitchenFloorSqft', 'bathroomFloorSqft', 'floorAreaSqft'],",
    "measurementKeys: ['floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'],"
  );
  if (!t.includes('function notesExplicitlyUnpriced')) {
    t = t.replace(
      'function isQuantityValidForPricing(qty, rule) {',
      `function notesExplicitlyUnpriced(itemId, notes) {
  const n = String(notes || '').toLowerCase();
  if (!/\\b(?:not\\s+priced(?:\\s+yet|)|unpriced|no\\s+pric(?:e|ing)(?:\\s+yet|)|pricing\\s+tbd|tbd\\s+on\\s+pric(?:e|ing))\\b/i.test(n)) {
    return false;
  }
  const itemPatterns = {
    flooring: /\\b(?:install|lvp|laminate|vinyl|carpet|flooring|floor\\s+install)\\b/i,
    floor_tile: /\\b(?:floor\\s+tile|tile\\s+floor)\\b/i,
  };
  const pattern = itemPatterns[itemId];
  return Boolean(pattern && pattern.test(n));
}

function applyPricingReadyFlags(resolved, itemId, ctx = {}) {
  if (!resolved.pricingReady) return resolved;
  const notes = String(ctx.notes || '');
  const hasPricedOverride =
    resolved.quantitySource === QUANTITY_SOURCES.notes &&
    ['allowance', 'lump_sum'].includes(resolved.unit || '');
  if (
    notesExplicitlyUnpriced(itemId, notes) &&
    !hasPricedOverride &&
    ['sqft', 'lf'].includes(resolved.unit || '')
  ) {
    return { ...resolved, pricingReady: false };
  }
  return resolved;
}

function isQuantityValidForPricing(qty, rule) {`
    );
  }
  if (!t.includes('applyPricingReadyFlags(')) {
    t = t.replace(
      `      return {
        quantity: measurements[key],
        unit: rule.defaultUnit,
        quantitySource: QUANTITY_SOURCES.inferred,
        label: packageName,
        sourceLabel: sourceLabel(QUANTITY_SOURCES.inferred),
        rule,
        pricingReady: true,
      };`,
      `      return applyPricingReadyFlags(
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
      );`
    );
  }
  fs.writeFileSync(file, t);
}

function patchTest() {
  const file = path.join(root, '__tests__', 'scopeMeasurementParser.test.js');
  let t = fs.readFileSync(file, 'utf8');
  if (t.includes('Smith residence flooring')) return;
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
  t = t.replace(
    "  test('flooring scope maps lump-sum tile demo and plural baseboards to existing checklist items', () => {",
    insert + "  test('flooring scope maps lump-sum tile demo and plural baseboards to existing checklist items', () => {"
  );
  fs.writeFileSync(file, t);
}

patchEstimateDraftQuantityPrice();
patchScopeAllowanceParser();
patchScopeMeasurementParser();
patchScopeItemQuantityCatalog();
patchTest();
console.log('Patches applied.');
