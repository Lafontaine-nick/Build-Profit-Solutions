/**
 * Parse job notes into Confirm Scope quick-measurement fields.
 * Used to autofill kitchen sqft, landscaping coverage, roof squares, etc.
 */

const { splitNoteClauses } = require('./estimateDraftQuantityPrice');
const { parseScopeItemAllowancesFromNotes } = require('./scopeAllowanceParser');
const { parseScopeItemRatePricingFromNotes } = require('./scopeRatePricingParser');

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:total\s+)?(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*(?:²|2\b|\?)|square\s+(?:foot|feet))/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft)/gi;
const WALL_LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft|feet|foot)\b/gi;
const CY_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:cy|cubic\s+yards?)/gi;
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)\s*squares?\b/gi;
const TON_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:tons?)\b/gi;

function parseQty(match) {
  const n = Number(String(match[1] ?? match[0]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstQty(text, re) {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? parseQty(m) : null;
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
  if (/\b(?:sheet\s+vinyl|sheet\s+vct|vct)\b/i.test(blob)) {
    out.flooringExistingVinylMethod = 'sheet_vct';
  } else if (/\b(?:glue[\s-]?down|adhesive[\s-]?backed)\s+(?:vinyl|lvp)\b/i.test(blob)) {
    out.flooringExistingVinylMethod = 'glue_down';
  } else if (/\bfloating\s+(?:vinyl|lvp)\b/i.test(blob)) {
    out.flooringExistingVinylMethod = 'floating';
  } else if (/\bvinyl\b/i.test(blob) && /\b(?:existing|current|old)\b/i.test(blob)) {
    out.flooringExistingVinylMethod = 'unknown';
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
  const sodSqft = pickSqftFromClauses([/\b(?:new\s+)?sod\b/, /\bturf\b/, /\b(?:new\s+)?grass\b/, /\bexisting\s+sod\b/]);
  if (sodSqft) out.sodSqft = sodSqft;

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
    for (const clause of clauses) {
      const sq = firstQty(clause, SQUARES_RE);
      if (sq) {
        out.roofSquares = sq;
        break;
      }
      const sqft = firstQty(clause, SQFT_RE);
      if (sqft && /\broof|\bshingle/.test(clause.toLowerCase())) {
        out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        break;
      }
    }
    if (!out.roofSquares) {
      const sq = firstQty(text, SQUARES_RE);
      if (sq) out.roofSquares = sq;
      else {
        const sqft = pickSqftNearPattern(text, /\broof|\bshingle/);
        if (sqft) out.roofSquares = Math.round((sqft / 100) * 10) / 10;
      }
    }
  }

  // Concrete — do not let a paver/landscape patio sqft fill concrete sqft.
  const concreteSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bpavers?\b|\bsod\b|\bturf\b|\brock\b|\bmulch\b|\bgravel\b/.test(c)) continue;
      if (!/\bconcrete\b|\bflatwork\b|\bslab\b|\bdriveway\b/.test(c)) continue;
      const near = pickSqftNearPattern(clause, /\bconcrete\b|\bflatwork\b|\bslab\b|\bdriveway\b/);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return null;
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

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
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
