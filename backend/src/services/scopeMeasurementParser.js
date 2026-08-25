/**
 * Parse job notes into Confirm Scope quick-measurement fields.
 * Used to autofill kitchen sqft, landscaping coverage, roof squares, etc.
 */

const { splitNoteClauses } = require('./estimateDraftQuantityPrice');
const { parseElectricalMeasurementsFromNotes } = require('./electricalCanonicalParser');
const { parseScopeItemAllowancesFromNotes } = require('./scopeAllowanceParser');
const { parseScopeItemRatePricingFromNotes } = require('./scopeRatePricingParser');

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:total\s+)?(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*(?:²|2\b|\?)|square\s+(?:foot|feet))/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft)/gi;
const WALL_LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft|feet|foot)\b/gi;
const CY_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:cy|cubic\s+yards?)/gi;
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)\s*squares?\b/gi;
const ROOF_PITCH_RE = /\b(\d+)\s*(?::|\/)\s*(\d+)\s*pitch\b|\bpitch\s*(\d+)\s*(?::|\/)\s*(\d+)\b/i;
const STORY_COUNT_RE = /\b(\d+|one|two|three|four|five)\s*[- ]?stor(?:y|ies)\b/i;
const TON_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:tons?)\b/gi;
const DEPTH_INCHES_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:inches?|["″])/i;

const EXTERIOR_FLATWORK_RE =
  /\b(?:driveway|walkway|sidewalk|flat[\s-]?work|concrete\s+(?:patio|slab|pad)|patio\s+slab|rv\s+pad)\b/i;
const DEMO_VERB_RE = /\b(?:demo|demolition|remove|removal|tear[\s-]?out|break\s+up|rip\s+out)\b/i;

function isExteriorFlatworkClause(clause) {
  const c = clause.toLowerCase();
  if (EXTERIOR_FLATWORK_RE.test(c)) return true;
  return /\bconcrete\b/.test(c) && /\b(?:patio|slab|drive|walk|flat)/.test(c);
}

function isDemoClause(clause) {
  return DEMO_VERB_RE.test(clause.toLowerCase());
}

function isDirtExcavationClause(clause) {
  const c = clause.toLowerCase();
  return /\b(?:dirt|soil|earth|subgrade)\b/.test(c) &&
    /\b(?:excavat(?:e|ion)|remove|dig|cut\s*(?:\/|and)?\s*fill|soil\s+movement)\b/.test(c);
}

function parseQty(match) {
  const n = Number(String(match[1] ?? match[0]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStoryCount(text) {
  const match = String(text || '').match(STORY_COUNT_RE);
  if (!match) return null;
  const raw = String(match[1] || '').toLowerCase();
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = words[raw] || Number(raw);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function firstQty(text, re) {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? parseQty(m) : null;
}

function firstHvacCount(text, pattern) {
  const patternSource = pattern instanceof RegExp ? pattern.source : pattern;
  const match = String(text || '').match(
    new RegExp(
      `(?:^|\\b)(\\d[\\d,]*(?:\\.\\d+)?|one|two|three|four|five)\\s*(?:ea|each|count)?\\s*(?:${patternSource})`,
      'i',
    ),
  );
  if (!match) return null;
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = words[match[1].toLowerCase()] || Number(match[1].replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function allQty(text, re) {
  const values = [];
  let m;
  const clone = new RegExp(re.source, re.flags);
  while ((m = clone.exec(text)) !== null) {
    const q = parseQty(m);
    if (q) values.push(q);
  }
  return values;
}

function pickSqftNearPattern(text, pattern) {
  const re = new RegExp(SQFT_RE.source, SQFT_RE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 25);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const window = text.slice(start, end).toLowerCase();
    if (pattern.test(window)) return parseQty(m);
  }
  return null;
}

function pickLfNearPattern(text, pattern) {
  return pickLfNearPatternWithRegex(text, pattern, LF_RE);
}

function pickLfNearPatternWithRegex(text, pattern, quantityRe) {
  const re = new RegExp(quantityRe.source, quantityRe.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 25);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const window = text.slice(start, end).toLowerCase();
    if (pattern.test(window)) return parseQty(m);
  }
  return null;
}

function clauseMatches(clause, patterns) {
  const c = clause.toLowerCase();
  return patterns.some((p) => p.test(c));
}

function splitMeasurementClauses(text) {
  return splitNoteClauses(text)
    .flatMap((clause) => clause.split(/,\s+(?=[a-z])/i))
    .map((clause) => clause.trim())
    .filter(Boolean);
}

const COUNT_TOKEN_RE =
  /\b(\d[\d,]*(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

function parseCountToken(value) {
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const normalized = String(value || '').toLowerCase();
  const count = words[normalized] ?? Number(normalized.replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 && count <= 200
    ? Math.round(count)
    : null;
}

function pickOpeningCount(clauses, text, pattern) {
  const countNearestToPattern = (value) => {
    const patternMatch = pattern.exec(String(value || '').toLowerCase());
    if (!patternMatch || patternMatch.index == null) return null;
    const countRe = new RegExp(COUNT_TOKEN_RE.source, 'gi');
    let match;
    let nearest = null;
    while ((match = countRe.exec(value)) !== null) {
      const count = parseCountToken(match[1]);
      if (count == null) continue;
      const distance = Math.abs(match.index - patternMatch.index);
      if (!nearest || distance < nearest.distance) {
        nearest = { distance, count };
      }
    }
    return nearest?.count ?? null;
  };

  for (const clause of clauses) {
    const count = countNearestToPattern(clause);
    if (count != null) return count;
  }
  return countNearestToPattern(text);
}

/**
 * @param {string} notes
 * @param {{ templateKey?: string, projectType?: string }} [ctx]
 */
function parseScopeMeasurementsFromNotes(notes, ctx = {}) {
  const text = String(notes || '').trim();
  if (!text) return {};

  const templateKey = String(ctx.templateKey || '').toLowerCase();
  const projectType = String(ctx.projectType || '').toLowerCase();
  const out = {};
  if (templateKey === 'painting' || projectType === 'painting') {
    const paintScope = [];
    if (/\bwalls?\b/i.test(text)) paintScope.push('walls');
    if (/\bceilings?\b/i.test(text)) paintScope.push('ceilings');
    if (/\b(?:trim|baseboards?|casing|crown|molding|moulding)\b/i.test(text)) paintScope.push('trim');
    if (/\b(?:interior\s+)?doors?\b/i.test(text)) paintScope.push('doors');
    if (/\bcabinets?\b/i.test(text) && /\b(?:paint|painting|refinish(?:ing)?)\b/i.test(text)) {
      paintScope.push('cabinets');
    }
    const excludesExteriorPaint =
      /\b(?:no|not|without|exclude(?:d)?|excluding)\s+(?:any\s+)?(?:exterior|outside)\s+(?:paint|painting)\b/i.test(text);
    if (
      !excludesExteriorPaint &&
      /\b(?:exterior|outside)\s+(?:paint|painting)\b|\b(?:paint|painting)\s+(?:the\s+)?(?:exterior|outside)\b|\b(?:paint|painting)\s+(?:the\s+)?(?:siding|stucco|soffit|fascia)\b|\b(?:siding|stucco|soffit|fascia)\s+(?:paint|painting)\b/i.test(
        text
      )
    ) {
      paintScope.push('exterior');
    }
    if (paintScope.length) out.paintScope = paintScope;
  }
  if (/\b(?:occupied|owner[- ]occupied|furnished)\b/i.test(text)) {
    out.paintOccupancy = 'occupied';
    out.paintOccupancyConfirmed = true;
  } else if (/\b(?:new construction|new build)\b/i.test(text)) {
    out.paintOccupancy = 'new_construction';
    out.paintOccupancyConfirmed = true;
  } else if (/\b(?:vacant|empty|unoccupied)\b/i.test(text)) {
    out.paintOccupancy = 'vacant';
    out.paintOccupancyConfirmed = true;
  }
  const hasSpray = /\b(?:spray|airless|sprayer)\b/i.test(text);
  const hasBrushRoll = /\b(?:brush|roll|roller)\b/i.test(text);
  if (hasSpray && hasBrushRoll) out.paintApplicationMethod = 'mixed';
  else if (hasSpray) out.paintApplicationMethod = 'spray';
  else if (hasBrushRoll) out.paintApplicationMethod = 'brush_roll';
  if (hasSpray || hasBrushRoll) out.paintApplicationMethodConfirmed = true;

  const clauses = splitMeasurementClauses(text);
  const blob = text.toLowerCase();

  const pickSqftFromClauses = (patterns) => {
    for (const clause of clauses) {
      const matchedPattern = patterns.find((p) => p.test(clause.toLowerCase()));
      if (!matchedPattern) continue;
      const near = pickSqftNearPattern(clause, matchedPattern);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    for (const pattern of patterns) {
      const near = pickSqftNearPattern(text, pattern);
      if (near) return near;
    }
    return null;
  };
  // A generic yard/landscape area is not an area for a specific material.
  // Require the material to be explicitly tied to the sqft value.
  const pickExplicitLandscapeMaterialSqft = (patterns) => {
    for (const clause of clauses) {
      const lower = clause.toLowerCase();
      const quantityRe = new RegExp(SQFT_RE.source, SQFT_RE.flags);
      let match;
      while ((match = quantityRe.exec(clause)) !== null) {
        const beforeQuantity = lower.slice(Math.max(0, match.index - 55), match.index);
        const materialIndexes = patterns
          .map((pattern) => {
            const matches = [
              ...beforeQuantity.matchAll(
                new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
              ),
            ];
            return matches.length ? matches[matches.length - 1].index : -1;
          })
          .filter((index) => index >= 0);
        const materialIndex = Math.max(...materialIndexes);
        if (materialIndex < 0) continue;
        const between = beforeQuantity.slice(materialIndex);
        if (/(?:back|front|side)?\s*yard\b/.test(between)) continue;
        return parseQty(match);
      }
    }
    return null;
  };

  const firstGenericBathroomSqft = () => {
    if (!/\bbath(?:room)?\s+remodel\b/.test(blob) || /\bkitchen\b/.test(blob)) return null;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(shower|wall|ceiling|backsplash|countertop|paint)\b/.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return null;
  };

  // Bathroom floor
  const bathFloor =
    pickSqftFromClauses([
      /\bbath(?:room)?.\s+floor\b/,
      /\bbath(?:room)?.\b.*\bfloor(?:ing)?.\b/,
      /\bfloor\b.*\bbath(?:room)?.\b/,
      /\b(?:main\s+)(?:bath(?:room|)|bath)\b/,
    ]) ||
    firstGenericBathroomSqft();
  if (bathFloor) out.bathroomFloorSqft = bathFloor;

  // Kitchen floor — only when notes explicitly mention kitchen/floor tile (not backsplash or paint)
  const kitchenFloor = pickSqftFromClauses([
    /\bkitchen\s+floor\b/,
    /\bkitchen\b.*\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b/,
    /\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b.*\bkitchen\b/,
    /\bfloor(?:ing)?\s+(?:demo|removal|install)\b/,
  ]);
  if (kitchenFloor) out.kitchenFloorSqft = kitchenFloor;

  // Backsplash
  const backsplash =
    pickSqftNearPattern(text, /\bback\s*splash\b|\bbacksplash\b/) ||
    pickSqftFromClauses([/\bback\s*splash\b/, /\bbacksplash\b/]);
  if (backsplash) out.backsplashSqft = backsplash;

  // Countertops (exclude backsplash lines)
  const countertopSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bback\s*splash|backsplash/.test(c)) continue;
      if (!/\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/.test(c)) continue;
      const near = pickSqftNearPattern(clause, /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return pickSqftNearPattern(text, /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/);
  })();
  if (countertopSqft) out.countertopSqft = countertopSqft;

  // Cabinet run LF
  const cabinetLf = (() => {
    for (const clause of clauses) {
      if (!/\bcabinet/.test(clause.toLowerCase())) continue;
      const q = firstQty(clause, LF_RE);
      if (q) return q;
    }
    return pickLfNearPattern(text, /\bcabinet/);
  })();
  if (cabinetLf) out.cabinetLf = cabinetLf;

  // Shower wall / shower tile
  const showerWall =
    pickSqftFromClauses([
      /\bshower\s+wall\b/,
      /\bshower\s+tile\b/,
      /\btile\s+shower\b/,
      /\bshower\b.*\btile\b/,
    ]) || null;
  if (showerWall) out.showerWallTileSqft = showerWall;

  // Shower floor
  const showerFloor = pickSqftFromClauses([/\bshower\s+floor\b/, /\bshower\s+pan\b/, /\bshower\s+base\b/]);
  if (showerFloor) out.showerFloorTileSqft = showerFloor;

  // Interior paint — use sqft near paint keywords (not first sqft in clause; backsplash may precede paint on one line)
  const PAINT_SQFT_PATTERNS = [
    /\bpaint(?:ing)?\b/,
    /\bwall(?:s)?\s*(?:and\s+(?:the\s+)?|\/|&\s*)ceiling\b/,
    /\binterior\s+paint\b/,
  ];
  const paintSqft = (() => {
    let largestRelevantPaintSqft = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bexterior\b/.test(c)) continue;
      if (!PAINT_SQFT_PATTERNS.some((p) => p.test(c))) continue;
      for (const pattern of PAINT_SQFT_PATTERNS) {
        const near = pickSqftNearPattern(clause, pattern);
        if (near) largestRelevantPaintSqft = Math.max(largestRelevantPaintSqft, near);
      }
    }
    // A common note format puts the total paintable area in the sentence
    // immediately before "Paint all..." and then lists a smaller cabinet
    // surface area later. Prefer the largest non-exterior paint area.
    const globalPaintAreas =
      (templateKey === 'painting' ||
        projectType === 'painting' ||
        /\binterior\s+repaint\b|\bpaint\s+all\s+(?:interior\s+)?walls?\b/i.test(blob))
        ? clauses
            .filter((clause) => !/\bexterior\b/i.test(clause))
            .flatMap((clause) => allQty(clause, SQFT_RE))
            .filter((q) => q > 0)
        : [];
    if (globalPaintAreas.length) {
      largestRelevantPaintSqft = Math.max(largestRelevantPaintSqft, ...globalPaintAreas);
    }
    return largestRelevantPaintSqft || pickSqftFromClauses(PAINT_SQFT_PATTERNS);
  })();
  if (paintSqft) out.wallPaintSqft = paintSqft;

  const ceilingPaintSqft = pickSqftFromClauses([/\bceilings?\b/]);
  if (ceilingPaintSqft) out.ceilingPaintSqft = ceilingPaintSqft;

  const explicitWallPaintSqft = pickSqftNearPattern(text, /\bwalls?\b/);
  const explicitCeilingPaintSqft = pickSqftNearPattern(text, /\bceilings?\b/);
  const combinedPaintLanguage = /\bwalls?\s*(?:and|&)\s*ceilings?\b|\bceilings?\s*(?:and|&)\s*walls?\b/i.test(blob);
  const interiorPaintBlob = clauses.filter((clause) => !/\bexterior\b/i.test(clause)).join(' ');
  const floorAreaPaintLanguage =
    /\b(?:house|home|floor\s+area|living\s+area)\b[^.;]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(interiorPaintBlob) ||
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;]{0,35}\b(?:house|home|floor\s+area|living\s+area)\b/i.test(interiorPaintBlob);

  if (explicitWallPaintSqft && explicitCeilingPaintSqft && !combinedPaintLanguage) {
    out.paintPricingMethod = 'separate';
    out.wallPaintSqft = explicitWallPaintSqft;
    out.ceilingPaintSqft = explicitCeilingPaintSqft;
  } else if (explicitWallPaintSqft && !combinedPaintLanguage) {
    out.paintPricingMethod = 'separate';
    out.wallPaintSqft = explicitWallPaintSqft;
    delete out.ceilingPaintSqft;
  } else if (explicitCeilingPaintSqft && !combinedPaintLanguage) {
    out.paintPricingMethod = 'separate';
    out.ceilingPaintSqft = explicitCeilingPaintSqft;
    delete out.wallPaintSqft;
  } else if (
    templateKey === 'painting' &&
    paintSqft &&
    (combinedPaintLanguage || (!explicitWallPaintSqft && !explicitCeilingPaintSqft))
  ) {
    out.paintAreaSqft = paintSqft;
    out.originalPaintAreaReferenceSqft = paintSqft;
    out.paintAreaNeedsConfirmation = true;
    out.paintAreaBasis = floorAreaPaintLanguage ? 'floor_area' : 'unknown';
    if (combinedPaintLanguage && !floorAreaPaintLanguage) {
      out.paintPricingMethod = 'combined';
      out.combinedPaintableAreaSqft = paintSqft;
      out.paintAreaNeedsConfirmation = false;
      out.paintAreaBasis = 'combined';
    }
    delete out.wallPaintSqft;
    delete out.ceilingPaintSqft;
  }

  const interiorDoorCountMatch = blob.match(
    /(\d[\d,]*)\s+(?:interior\s+)?doors?\b/i
  );
  if (interiorDoorCountMatch) {
    const count = Number(interiorDoorCountMatch[1].replace(/,/g, ''));
    if (Number.isFinite(count) && count > 0) out.interiorDoorCount = count;
  }

  // Windows & doors notes use explicit counts only. Generic "doors" is not
  // treated as an exterior door because it may describe interior painting.
  const windowCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:windows?|window\s+units?|fenestration)\b/i,
  );
  const exteriorDoorCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:exterior|entry|front|back|side|service|swing|hinged|egress)\s+(?:swing\s+|entry\s+)?doors?\b/i,
  );
  const slidingDoorCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:sliding|patio|slider|multi[-\s]?panel)\s+doors?\b/i,
  );
  const garageDoorSingleCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:single|one[-\s]?car)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:single|one[-\s]?car)\b/i,
  );
  const garageDoorDoubleCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:double|two[-\s]?car)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:double|two[-\s]?car)\b/i,
  );
  const garageDoorRvCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:rv|oversized|extra[-\s]?wide|tall)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:rv|oversized|extra[-\s]?wide|tall)\b/i,
  );
  if (windowCount) out.windowCount = windowCount;
  if (exteriorDoorCount) out.exteriorDoorCount = exteriorDoorCount;
  if (slidingDoorCount) out.slidingDoorCount = slidingDoorCount;
  if (garageDoorSingleCount) out.garageDoorSingleCount = garageDoorSingleCount;
  if (garageDoorDoubleCount) out.garageDoorDoubleCount = garageDoorDoubleCount;
  if (garageDoorRvCount) out.garageDoorRvCount = garageDoorRvCount;

  const explicitReframingLanguage =
    /\b(?:re[-\s]?frame(?:d|ing)?|new\s+(?:window|door)\s+opening|new\s+opening|resize(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|enlarge(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|modify(?:ing|ied)?\s+(?:the\s+)?(?:window|door)?\s*opening)\b/i.test(
      text,
    );
  const negatedReframingLanguage =
    /\b(?:no|not|without|exclude(?:d|s)?|excluding)\s+(?:any\s+)?(?:structural\s+)?re[-\s]?framing\b|\b(?:no|not|without)\s+(?:any\s+)?(?:new\s+)?(?:window|door)?\s*openings?\b/i.test(
      text,
    );
  const reframingRequested =
    explicitReframingLanguage && !negatedReframingLanguage;
  if (reframingRequested) {
    out.reframingRequested = true;
    const framingOpeningCount = pickOpeningCount(
      clauses,
      text,
      /\b(?:re[-\s]?frame|new|resize|enlarge|modify)[^.;\n]{0,45}\bopenings?\b/i,
    );
    if (framingOpeningCount) out.framingOpeningCount = framingOpeningCount;
  }

  const cabinetPaintSqft =
    firstQty(
      text.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;]{0,40}\bcabinets?\b/i)?.[0] || '',
      SQFT_RE
    ) ||
    pickSqftNearPattern(
      text,
      /\b(?:paint(?:ing)?|refinish(?:ing)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint(?:ing)?|refinish(?:ing)?)\b/i
    );
  if (cabinetPaintSqft) out.cabinetPaintSqft = cabinetPaintSqft;
  const cabinetUpperLf = pickLfNearPatternWithRegex(text, /\b(?:upper|uppers?)\b[^.;]{0,30}\bcabinets?\b/i, LF_RE);
  const cabinetLowerLf = pickLfNearPatternWithRegex(text, /\b(?:lower|lowers?)\b[^.;]{0,30}\bcabinets?\b/i, LF_RE);
  const cabinetTallLf = pickLfNearPatternWithRegex(text, /\b(?:tall|pantry)\b[^.;]{0,30}\bcabinets?\b/i, LF_RE);
  const cabinetRunLf = pickLfNearPatternWithRegex(text, /\b(?:cabinet|cabinetry)\s+(?:run|length)\b/i, LF_RE);
  if (cabinetUpperLf) out.cabinetUpperLf = cabinetUpperLf;
  if (cabinetLowerLf) out.cabinetLowerLf = cabinetLowerLf;
  if (cabinetTallLf) out.cabinetTallLf = cabinetTallLf;
  if (cabinetRunLf) out.cabinetRunLf = cabinetRunLf;
  if (!cabinetRunLf && (cabinetUpperLf || cabinetLowerLf || cabinetTallLf)) {
    out.cabinetRunLf = (cabinetUpperLf || 0) + (cabinetLowerLf || 0) + (cabinetTallLf || 0);
  }

  const exteriorPaintSqft = pickSqftFromClauses([/\bexterior\s+paint\b/, /\bpaint\s+exterior\b/]);
  if (exteriorPaintSqft) out.exteriorPaintSqft = exteriorPaintSqft;

  // Drywall
  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/, /\bhang\s+(?:and\s+)?finish\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  const flooringSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(c)) continue;
      if (!/\b(flooring|lvp|laminate|vinyl|carpet|floor\s+install)\b/i.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (flooringSqft) out.flooringSqft = flooringSqft;
  const flooringProductScope = [];
  if (/\b(?:lvp|luxury\s+vinyl)\b/i.test(blob)) flooringProductScope.push('lvp');
  if (/\blaminate\b/i.test(blob)) flooringProductScope.push('laminate');
  if (/\bengineered\s+hardwood\b/i.test(blob)) flooringProductScope.push('engineered_hardwood');
  if (/\bsolid\s+hardwood\b/i.test(blob)) flooringProductScope.push('solid_hardwood');
  if (/\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b/i.test(blob) || (templateKey === 'flooring' && /\btile\b/i.test(blob))) {
    flooringProductScope.push('tile');
  }
  if (/\bcarpet\b/i.test(blob)) flooringProductScope.push('carpet');
  if (flooringProductScope.length) out.flooringProductScope = flooringProductScope;
  if (/\b(?:glue[\s-]?down|adhesive[\s-]?backed)\s+(?:vinyl|lvp)\b/i.test(blob)) {
    out.flooringExistingLvpInstallMethod = 'glue_down';
  } else if (/\bfloating\s+(?:vinyl|lvp)\b/i.test(blob)) {
    out.flooringExistingLvpInstallMethod = 'floating';
  } else if (/\blvp\b/i.test(blob) && /\b(?:existing|current|old)\b/i.test(blob)) {
    out.flooringExistingLvpInstallMethod = 'unknown';
  }
  if (/\b(?:vct|vinyl\s+tile)\b/i.test(blob)) {
    out.flooringExistingSheetVinylType = 'vct';
  } else if (/\bsheet\s+vinyl\b/i.test(blob)) {
    out.flooringExistingSheetVinylType = 'sheet_vinyl';
  } else if (/\bsheet\s+vinyl|vct|vinyl\s+tile\b/i.test(blob) && /\b(?:existing|current|old)\b/i.test(blob)) {
    out.flooringExistingSheetVinylType = 'unknown';
  }
  const roomMeasurements = [];
  const roomPattern =
    /\b(living\s+areas?|living\s+room|great\s+room|kitchens?|dining(?:\s+room)?|hallways?|bedrooms?(?:\s+\d+)?|primary\s+bedroom|bathrooms?(?:\s+\d+)?|offices?|laundry|entries?|foyers?|basements?|mudrooms?)\b/i;
  for (const clause of clauses) {
    const roomMatches = [...clause.matchAll(new RegExp(roomPattern.source, 'gi'))];
    if (!roomMatches.length) continue;
    const area = firstQty(clause, SQFT_RE);
    for (const roomMatch of roomMatches) {
      let name = roomMatch[1].replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const trailingRoomNumber = name.match(/\s+(\d+)$/);
      if (trailingRoomNumber && Number(trailingRoomNumber[1]) > 20) name = name.replace(/\s+\d+$/, '');
      const roomArea = roomMatches.length === 1 ? area : null;
      if (!roomMeasurements.some((room) => room.name.toLowerCase() === name.toLowerCase())) {
        roomMeasurements.push({ name, areaSqft: roomArea || null, sourceType: roomArea ? 'user_entered' : 'unknown' });
      }
    }
  }
  if (roomMeasurements.length) out.planRooms = roomMeasurements;
  const flooringProductPatterns = [
    ['flooringLvpSqft', /\b(?:lvp|luxury\s+vinyl)\b/i],
    ['flooringLaminateSqft', /\blaminate\b/i],
    ['flooringEngineeredHardwoodSqft', /\bengineered\s+hardwood\b/i],
    ['flooringSolidHardwoodSqft', /\bsolid\s+hardwood\b/i],
    ['flooringTileSqft', /\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b/i],
    ['flooringCarpetSqft', /\bcarpet\b/i],
  ];
  for (const [key, pattern] of flooringProductPatterns) {
    const quantity = pickSqftFromClauses([pattern]);
    if (quantity) out[key] = quantity;
  }
  const floorDemoSqft = pickSqftFromClauses([
    /\b(?:floor|flooring|lvp|laminate|vinyl|carpet|tile)\b[^.;]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,60}\b(?:floor|flooring|lvp|laminate|vinyl|carpet|tile)\b/,
  ]);
  if (floorDemoSqft) out.floorDemoSqft = floorDemoSqft;
  const floorPrepSqft = pickSqftFromClauses([
    /\b(?:floor|subfloor)\s+prep\b/,
    /\b(?:prep|preparation|leveling|patching|repair|mitigation)\b[^.;]{0,45}\bfloor\b/,
    /\b(?:prep|preparation)\b/,
  ]);
  if (floorPrepSqft) out.floorPrepSqft = floorPrepSqft;
  const underlaymentSqft = pickSqftFromClauses([/\bunderlayment\b/]);
  if (underlaymentSqft) out.underlaymentSqft = underlaymentSqft;
  const moistureBarrierSqft = pickSqftFromClauses([/\b(?:moisture|vapor)\s+barrier\b|\bmoisture\s+mitigation\b/]);
  if (moistureBarrierSqft) out.moistureBarrierSqft = moistureBarrierSqft;
  const transitionLf = pickLfNearPattern(text, /\b(?:transition|reducer|threshold)s?\b/i);
  if (transitionLf) out.transitionLf = transitionLf;
  const quarterRoundLf = pickLfNearPattern(text, /\bquarter[\s-]?round\b/i);
  if (quarterRoundLf) out.quarterRoundLf = quarterRoundLf;

  // Landscaping — specific coverage areas first
  const sodSqft = pickExplicitLandscapeMaterialSqft([
    /\b(?:new\s+)?sod\b/,
    /\bexisting\s+sod\b/,
  ]);
  if (sodSqft) out.sodSqft = sodSqft;
  const artificialTurfSqft = pickExplicitLandscapeMaterialSqft([
    /\bartificial\s+turf\b/,
    /\bartificial\s+grass\b/,
    /\bsynthetic\s+grass\b/,
    /\bturf\b/,
  ]);
  if (artificialTurfSqft) out.artificialTurfSqft = artificialTurfSqft;

  const paverSqft = pickSqftFromClauses([/\bpavers?\b/, /\bpatio\b.*\bpaver/]);
  if (paverSqft) out.paverSqft = paverSqft;

  const rockMulchSqft = pickSqftFromClauses([/\brock\b/, /\bmulch\b/, /\bgravel\b/]);
  if (rockMulchSqft) out.rockMulchSqft = rockMulchSqft;

  const landscapeSqft = pickSqftFromClauses([
    /\b(?:back|front|side)?\s*yard\b/,
    /\blandscap(?:e|ing)\b/,
    /\blawn\b/,
  ]);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

  const wallDemoSqft = pickSqftFromClauses([
    /\b(?:wall|soffit|bulkhead)s?\b[^.;]{0,80}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:wall|soffit|bulkhead)s?\b/,
  ]);
  if (wallDemoSqft) out.wallDemoSqft = wallDemoSqft;
  const wallDemoLf = (() => {
    const patterns = [
      /\b(?:wall|soffit|bulkhead)s?\b[^.;]{0,80}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
      /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:wall|soffit|bulkhead)s?\b/,
    ];
    for (const clause of clauses) {
      const matchedPattern = patterns.find((p) => p.test(clause.toLowerCase()));
      if (!matchedPattern) continue;
      const near = pickLfNearPatternWithRegex(clause, matchedPattern, WALL_LF_RE);
      if (near) return near;
    }
    return null;
  })();
  if (wallDemoLf) out.wallDemoLf = wallDemoLf;

  // Floor / living area — prefer explicit schedule language over install/demo clauses.
  const livingAreaSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        !/\b(living\s+area|total\s+living|main\s+living|conditioned\s+(?:floor\s+)?area|building\s+areas?|total\s+(?:floor|heated)\s+area|heated\s+area)\b/i.test(
          c
        )
      ) {
        continue;
      }
      const q = firstQty(clause, SQFT_RE);
      if (q && q >= 200) return q;
    }
    return (
      pickSqftNearPattern(text, /\bliving\s+area\b/) ||
      pickSqftNearPattern(text, /\btotal\s+living\b/) ||
      pickSqftNearPattern(text, /\bmain\s+living\b/) ||
      null
    );
  })();

  // Flooring / floor-area jobs (tile demo, laminate install, etc.)
  const floorAreaSqft = (() => {
    if (livingAreaSqft) return livingAreaSqft;
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        /\bbaseboards?\b|\btrim\b|\bmoulding\b|\bmolding\b|\bcasing\b/i.test(c) &&
        !/\b(install|installation|lvp|laminate|vinyl|carpet|flooring|tile|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(c)
      ) {
        continue;
      }
      if (/\bback\s*splash|backsplash|\bcountertop|\bpaint\b|\bshower\b/i.test(c)) continue;
      if (/\bwall\b|\bsoffit\b|\bbulkhead\b/i.test(c)) continue;
      if (isExteriorFlatworkClause(c)) continue;
      if (!/\b(demo|demolition|remove|removal|tear[\s-]?out|install|installation|laminate|tile|lvp|vinyl|flooring|floor|carpet)\b/i.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (floorAreaSqft) out.floorAreaSqft = floorAreaSqft;
  if (floorAreaSqft && !out.kitchenFloorSqft && (projectType === 'kitchen' || templateKey === 'kitchen')) {
    out.kitchenFloorSqft = floorAreaSqft;
  }

  const deckSqft = pickSqftFromClauses([/\bdeck(?:ing)?\b/]);
  if (deckSqft) out.deckSqft = deckSqft;

  const railingLf = (() => {
    for (const clause of clauses) {
      if (!/\brail(?:ing)?|guardrail/.test(clause.toLowerCase())) continue;
      const q = firstQty(clause, LF_RE);
      if (q) return q;
    }
    return pickLfNearPattern(text, /\brail(?:ing)?|guardrail/);
  })();
  if (railingLf) out.railingLf = railingLf;

  // Baseboard LF
  const baseboardLf =
    (() => {
      for (const clause of clauses) {
        if (!/\bbaseboards?\b|\btrim\b/.test(clause.toLowerCase())) continue;
        const q = firstQty(clause, LF_RE);
        if (q) return q;
      }
      return null;
    })() || null;
  if (baseboardLf) out.baseboardLf = baseboardLf;

  // Roofing squares (or convert roof sqft → squares)
  if (/\broof(?:ing)?\b|\bshingles?\b|\btear[\s-]?off\b/.test(blob)) {
    const pitchMatch = text.match(ROOF_PITCH_RE);
    if (pitchMatch) {
      const rise = pitchMatch[1] || pitchMatch[3];
      const run = pitchMatch[2] || pitchMatch[4];
      if (rise && run) out.roofPitch = `${rise}:${run}`;
    }
    const stories = parseStoryCount(text);
    if (stories) out.storyCount = stories;
    for (const clause of clauses) {
      const sq = firstQty(clause, SQUARES_RE);
      if (sq) {
        out.roofSquares = sq;
        break;
      }
      const sqft = firstQty(clause, SQFT_RE);
      if (sqft && /\broof|\bshingle/.test(clause.toLowerCase())) {
        out.roofAreaSqft = sqft;
        out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        break;
      }
    }
    if (!out.roofSquares) {
      const sq = firstQty(text, SQUARES_RE);
      if (sq) out.roofSquares = sq;
      else {
        const sqft = pickSqftNearPattern(text, /\broof|\bshingle/);
        if (sqft) {
          out.roofAreaSqft = sqft;
          out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        }
      }
    }
  }

  const concreteDemoSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      if (!isDemoClause(clause) || isDirtExcavationClause(clause) || !isExteriorFlatworkClause(clause)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (concreteDemoSqft) out.concreteDemoSqft = concreteDemoSqft;

  for (const clause of clauses) {
    if (!isDemoClause(clause) || isDirtExcavationClause(clause) || !/\bconcrete\b|\bslab\b|\bpatio\b|\bdriveway\b|\bsidewalk\b|\bwalkway\b/i.test(clause)) continue;
    const depthMatch = clause.match(DEPTH_INCHES_RE);
    const depth = depthMatch ? Number(depthMatch[1]) : null;
    if (!depth || !Number.isFinite(depth)) continue;
    out.concreteDemoThicknessBand =
      depth >= 7 ? 'structural_7_plus' : depth >= 5 ? 'heavy_5_6' : depth >= 4 ? 'standard_4' : 'thin_2_3';
    if (/\b(?:rebar|reinforced|reinforcement|welded\s+wire|wire\s+mesh)\b/i.test(clause)) out.concreteDemoReinforced = true;
    if (/\b(?:limited|no|without)\s+(?:machine|equipment)\s+access\b|\bhand[\s-]?demo\b|\bnarrow\s+access\b|\bno\s+machine\s+access\b/i.test(clause)) out.concreteDemoLimitedAccess = true;
    break;
  }
  if (/\b(?:rebar|reinforced|reinforcement|welded\s+wire|wire\s+mesh)\b/i.test(text) && out.concreteDemoSqft) out.concreteDemoReinforced = true;
  if (/\b(?:limited|no|without)\s+(?:machine|equipment)\s+access\b|\bhand[\s-]?demo\b|\bnarrow\s+access\b|\bno\s+machine\s+access\b/i.test(text) && out.concreteDemoSqft) out.concreteDemoLimitedAccess = true;

  // Concrete — do not let a paver/landscape patio sqft fill concrete sqft.
  const concreteSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bpavers?\b|\bsod\b|\bturf\b|\brock\b|\bmulch\b|\bgravel\b/.test(c)) continue;
      if (isDemoClause(clause) && isExteriorFlatworkClause(clause)) continue;
      if (
        !/\bconcrete\b|\bflat[\s-]?work\b|\bslab\b|\bdriveway\b|\bwalkway\b|\bsidewalk\b/.test(c)
      ) {
        continue;
      }
      const near =
        pickSqftNearPattern(clause, /\bconcrete\b|\bflat[\s-]?work\b|\bslab\b|\bdriveway\b|\bwalkway\b|\bsidewalk\b/) ||
        firstQty(clause, SQFT_RE);
      if (near && near > max) max = near;
    }
    return max > 0 ? max : null;
  })();
  if (concreteSqft) out.concreteSqft = concreteSqft;

  let concreteCy = null;
  for (const clause of clauses) {
    if (!/\bconcrete\b|\bfoundation\b|\bslab\b/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      concreteCy = cy;
      break;
    }
  }
  if (concreteCy) out.concreteCy = concreteCy;

  // Excavation CY
  let excavationCy = null;
  for (const clause of clauses) {
    if (!/\bexcavat(?:e|ion)\b|\btrench(?:ing)?\b|\bgrading\b/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      excavationCy = cy;
      break;
    }
  }
  if (!excavationCy && /\bexcavat(?:e|ion)\b|\btrench(?:ing)?\b|\bgrading\b/.test(blob)) {
    excavationCy = firstQty(text, CY_RE);
  }
  if (excavationCy) out.excavationCy = excavationCy;

  for (const clause of clauses) {
    if (!isDirtExcavationClause(clause) && !(/\b(?:dirt|soil|earth|subgrade)\b/.test(blob) && /\b(?:excavat(?:e|ion)|remove|dig)\b/.test(blob))) continue;
    const area = firstQty(clause, SQFT_RE) || firstQty(text, SQFT_RE);
    const depthMatch = clause.match(DEPTH_INCHES_RE) || text.match(DEPTH_INCHES_RE);
    const depth = depthMatch ? Number(depthMatch[1]) : null;
    if (area && depth && depth > 0) {
      out.excavationAreaSqft = area;
      out.excavationDepthInches = depth;
      if (!out.excavationCy) {
        out.excavationCy = Math.round((area * (depth / 12) / 27) * 100) / 100;
      }
      break;
    }
  }

  // Tons (mulch/rock)
  const tons = (() => {
    for (const clause of clauses) {
      if (!/\bmulch\b|\brock\b|\bgravel\b|\bstone\b/.test(clause.toLowerCase())) continue;
      const t = firstQty(clause, TON_RE);
      if (t) return t;
    }
    return null;
  })();
  if (tons) out.landscapeTons = tons;

  // Legacy aliases
  if (out.bathroomFloorSqft && !out.sqft) out.sqft = out.bathroomFloorSqft;
  if (out.baseboardLf && !out.lf) out.lf = out.baseboardLf;

  const hvacSignal =
    /\bhvac\b|\bmechanical\b|\bfurnace\b|\bair\s*(?:handler|condition(?:er|ing))\b|\bheat\s*pump\b|\bmini[\s-]?split\b|\bductwork\b|\bthermostat\b|\bventilation\b/i;
  const hvacText = hvacSignal.test(text)
    ? text
    : clauses.filter((clause) => hvacSignal.test(clause)).join(' ');
  if (hvacText) {
    const systemCount =
      firstHvacCount(hvacText, '(?:hvac\\s+)?systems?') ||
      firstHvacCount(
        hvacText,
        '(?:furnaces?|air\\s*handlers?|heat\\s*pumps?|mini[\\s-]?splits?)',
      );
    if (systemCount) out.hvacSystemCount = Math.round(systemCount);
    const tons = firstQty(hvacText, TON_RE);
    if (tons) out.hvacSystemTons = tons;
    const ductworkLf = pickLfNearPattern(
      hvacText,
      /\b(?:ductwork|ducts?|flex\s*duct)\b/i,
    );
    if (ductworkLf) out.hvacDuctworkLf = ductworkLf;
    const supplyRegisterCount = firstHvacCount(
      hvacText,
      '(?:supply\\s+)?(?:air\\s+)?registers?|(?:supply\\s+)?diffusers?',
    );
    if (supplyRegisterCount) {
      out.hvacSupplyRegisterCount = Math.round(supplyRegisterCount);
    }
    const returnGrilleCount = firstHvacCount(
      hvacText,
      'return(?:\\s+air)?\\s+(?:grilles?|registers?)',
    );
    if (returnGrilleCount) {
      out.hvacReturnGrilleCount = Math.round(returnGrilleCount);
    }
    const thermostatCount = firstHvacCount(hvacText, 'thermostats?');
    if (thermostatCount) out.hvacThermostatCount = Math.round(thermostatCount);
    const serviceCallCount = firstHvacCount(
      hvacText,
      '(?:hvac\\s+)?(?:service|diagnostic|maintenance)\\s+calls?',
    );
    if (serviceCallCount) out.hvacServiceCallCount = Math.round(serviceCallCount);
    const replacementCount = firstHvacCount(
      hvacText,
      '(?:equipment|furnace|air\\s*handler|condenser|heat\\s*pump)\\s+(?:replacement|replace(?:ment)?)',
    );
    if (replacementCount) {
      out.hvacEquipmentReplacementCount = Math.round(replacementCount);
    } else if (
      /\b(?:replace|replacement)\b/i.test(hvacText) &&
      /\b(?:equipment|furnace|air\s*handler|condenser|heat\s*pump)\b/i.test(
        hvacText,
      )
    ) {
      out.hvacEquipmentReplacementCount = 1;
    }
    const refrigerantCount = firstHvacCount(
      hvacText,
      'refrigerant(?:\\s+(?:service|recharge|recovery))?',
    );
    if (refrigerantCount) out.hvacRefrigerantCount = Math.round(refrigerantCount);
    const ventilationCount = firstHvacCount(
      hvacText,
      '(?:hvac\\s+)?ventilation(?:\\s+(?:system|unit|fan))?',
    );
    if (ventilationCount) out.hvacVentilationCount = Math.round(ventilationCount);
    if (/\b(?:permit|inspection)\b/i.test(hvacText)) out.hvacPermitCount = 1;
    if (/\b(?:hvac\s+)?(?:cleanup|disposal|haul[\s-]?off)\b/i.test(hvacText)) {
      out.hvacCleanupCount = 1;
    }
  }

  const electrical = parseElectricalMeasurementsFromNotes(text);
  const electricalItemQuantities = electrical.itemQuantities || {};
  for (const [key, value] of Object.entries(electrical)) {
    if (key === 'itemQuantities' || value == null) continue;
    out[key] = value;
  }

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
  const openingItemMap = [
    ['windowCount', 'windows'],
    ['exteriorDoorCount', 'exterior_doors'],
    ['slidingDoorCount', 'sliding_doors'],
  ];
  for (const [key, itemId] of openingItemMap) {
    const quantity = Number(out[key]);
    if (!Number.isFinite(quantity) || quantity <= 0 || itemQuantities[itemId]) {
      continue;
    }
    itemQuantities[itemId] = {
      quantity,
      unit: 'each',
      quantitySource: 'notes',
    };
  }
  const garageDoorCount =
    (Number(out.garageDoorSingleCount) || 0) +
    (Number(out.garageDoorDoubleCount) || 0) +
    (Number(out.garageDoorRvCount) || 0);
  if (garageDoorCount > 0 && !itemQuantities.garage_doors) {
    itemQuantities.garage_doors = {
      quantity: garageDoorCount,
      unit: 'each',
      quantitySource: 'notes',
    };
  }
  for (const [itemId, quantity] of Object.entries(electricalItemQuantities)) {
    if (!itemQuantities[itemId]) itemQuantities[itemId] = quantity;
  }
  const hvacItemMap = [
    ['hvacSystemCount', 'hvac', 'each'],
    ['hvacSystemTons', 'hvac', 'ton'],
    ['hvacServiceCallCount', 'service_call', 'each'],
    ['hvacEquipmentReplacementCount', 'equipment_replace', 'each'],
    ['hvacRefrigerantCount', 'refrigerant', 'each'],
    ['hvacThermostatCount', 'thermostat', 'each'],
    ['hvacDuctworkLf', 'ductwork', 'lf'],
    ['hvacSupplyRegisterCount', 'supply_registers', 'each'],
    ['hvacReturnGrilleCount', 'return_grilles', 'each'],
    ['hvacVentilationCount', 'ventilation', 'each'],
    ['hvacPermitCount', 'permits', 'each'],
    ['hvacCleanupCount', 'cleanup', 'each'],
  ];
  for (const [key, itemId, unit] of hvacItemMap) {
    const quantity = Number(out[key]);
    if (!Number.isFinite(quantity) || quantity <= 0 || itemQuantities[itemId]) {
      continue;
    }
    itemQuantities[itemId] = {
      quantity,
      unit,
      quantitySource: 'notes',
    };
  }
  if (wallDemoSqft && !itemQuantities.wall_demo) {
    itemQuantities.wall_demo = {
      quantity: wallDemoSqft,
      unit: 'sqft',
      quantitySource: 'notes',
    };
  }
  if (wallDemoLf && !itemQuantities['walls_moving__remove']) {
    itemQuantities['walls_moving__remove'] = {
      quantity: wallDemoLf,
      unit: 'lf',
      quantitySource: 'notes',
    };
  }
  if (ctx.templateKey === 'flooring' && itemQuantities.floor_demo) {
    delete itemQuantities.demo;
  }
  if (Object.keys(itemQuantities).length) {
    out.itemQuantities = itemQuantities;
  }

  return out;
}

module.exports = {
  parseScopeMeasurementsFromNotes,
};
