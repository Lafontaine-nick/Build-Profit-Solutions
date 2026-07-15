/**
 * Deterministic plan takeoff from PDF text layers.
 *
 * Many architectural PDFs draw labels as individual glyphs (sometimes doubled).
 * We collapse/cluster those into phrases, parse schedule totals + L×W strings,
 * and pair each room name with the nearest dimension on floor-plan sheets.
 *
 * When this succeeds it is more accurate than vision for room SF (no swapped labels).
 */

const ROOM_NAME_PATTERNS = [
  { re: /\brv\s*garage\b/i, name: 'RV Garage' },
  { re: /\bprimary\s*suite\b/i, name: 'Primary Suite' },
  { re: /\bmaster\s*(bed(room)?|suite)\b/i, name: 'Primary Suite' },
  { re: /\bgreat\s*room\b/i, name: 'Great Room' },
  { re: /\bliving\s*area\b/i, name: 'Living Area' },
  { re: /\bden\s*\/\s*bed\s*4\b/i, name: 'Den/Bed 4' },
  { re: /\bbed\s*2\s*\/\s*office\b/i, name: 'Bed 2/Office' },
  { re: /\bbed(?:room)?\s*(\d+)\b/i, name: (m) => `Bed ${m[1]}` },
  { re: /\bprimary\s*bath(room)?\b/i, name: 'Primary Bath' },
  { re: /\bmaster\s*bath(room)?\b/i, name: 'Primary Bath' },
  { re: /\bguest\s*bath(room)?\b/i, name: 'Guest Bath' },
  { re: /\bpowder\b/i, name: 'Powder' },
  { re: /\bbath(?:room)?\s*(\d+)\b/i, name: (m) => `Bath ${m[1]}` },
  { re: /\bbath(?:room)?\b/i, name: 'Bath' },
  { re: /\bkitchen\b/i, name: 'Kitchen' },
  { re: /\bdining\b/i, name: 'Dining' },
  { re: /\bpantry\b/i, name: 'Pantry' },
  { re: /\blaundry\b/i, name: 'Laundry' },
  { re: /\bcloset\b/i, name: 'Closet' },
  { re: /\bgarage\b/i, name: 'Garage' },
  { re: /\bden\b/i, name: 'Den' },
  { re: /\boffice\b/i, name: 'Office' },
  { re: /\bfoyer\b/i, name: 'Foyer' },
  { re: /\bmud(?:room)?\b/i, name: 'Mudroom' },
  { re: /\bporch\b/i, name: 'Porch' },
  { re: /\bpatio\b/i, name: 'Patio' },
  { re: /\bdeck\b/i, name: 'Deck' },
];

const SKIP_PAGE_RE = /elevation|section|roof\s*plan|electrical|framing|terrain|site\s*plan|cover\s*sheet/i;
const FLOOR_PAGE_RE = /floor\s*plan|main\s*floor|floor\s*layout|dimensioned/i;
const FOUNDATION_PAGE_RE = /foundation/i;

function collapseDoubledGlyphs(raw) {
  const str = String(raw || '');
  if (str.length < 2) return str;
  let pairs = 0;
  let matches = 0;
  for (let i = 0; i + 1 < str.length; i += 2) {
    pairs += 1;
    if (str[i] === str[i + 1]) matches += 1;
  }
  if (pairs && matches / pairs >= 0.55) {
    let out = '';
    for (let i = 0; i < str.length; i += 2) out += str[i];
    return out;
  }
  return str;
}

function feetInchesToDecimal(ft, inches) {
  const f = Number(ft);
  const inch = Number(inches);
  if (!Number.isFinite(f) || !Number.isFinite(inch)) return null;
  return Math.round((f + inch / 12) * 1000) / 1000;
}

function parseDimensionString(text) {
  const s = String(text || '').replace(/\s+/g, '');
  const m = s.match(
    /^(\d{1,2})'(?:-|–)?(\d{1,2})"?[xX×](\d{1,2})'(?:-|–)?(\d{1,2})"?$/
  );
  if (!m) return null;
  const lengthFt = feetInchesToDecimal(m[1], m[2]);
  const widthFt = feetInchesToDecimal(m[3], m[4]);
  if (lengthFt == null || widthFt == null || lengthFt <= 0 || widthFt <= 0) return null;
  if (lengthFt > 120 || widthFt > 120) return null;
  const areaSqft = Math.round(lengthFt * widthFt * 10) / 10;
  return { lengthFt, widthFt, areaSqft, raw: `${m[1]}'-${m[2]}" x ${m[3]}'-${m[4]}"` };
}

function normalizeRoomLabel(raw) {
  const compact = String(raw || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
  const spaced = compact
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  // CAD often concatenates: PRIMARYSUITE, DEN/BED4, BED2/OFFICE
  const candidates = [
    spaced,
    spaced.replace(/\//g, ' / '),
    String(raw || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]{2,})(?=[A-Z][a-z])/g, '$1 ')
      .replace(/([A-Za-z])(\d)/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim(),
    String(raw || '')
      .replace(/PRIMARYSUITE/i, 'Primary Suite')
      .replace(/GREATROOM/i, 'Great Room')
      .replace(/RVGARAGE/i, 'RV Garage')
      .replace(/LIVINGAREA/i, 'Living Area')
      .replace(/DEN\/?BED\s*4/i, 'Den/Bed 4')
      .replace(/BED\s*2\s*\/?\s*OFFICE/i, 'Bed 2/Office')
      .replace(/([A-Z]{2,})/g, (m) => m)
      .trim(),
  ];

  for (const candidate of candidates) {
    const c = candidate.replace(/\s+/g, ' ').trim();
    if (!c || c.length > 40) continue;
    for (const pat of ROOM_NAME_PATTERNS) {
      const m = c.match(pat.re);
      if (!m) continue;
      const name = typeof pat.name === 'function' ? pat.name(m) : pat.name;
      if (name) return name;
    }
  }
  return null;
}

function parseScheduleFromText(text) {
  return parsePageFactsFromText(text).buildingAreas;
}

function labeledNumber(text, patterns) {
  for (const re of patterns) {
    const match = String(text || '').match(re);
    if (!match) continue;
    const value = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) {
      return { value: Math.round(value * 10) / 10, sourceText: match[0].trim() };
    }
  }
  return null;
}

function extractSheet(text) {
  const match = String(text || '').match(
    /\b(?:sheet(?:\s*(?:no\.?|number))?\s*[:#-]?\s*)?([A-Z]{1,3}\s*[-.]?\s*\d{1,3}(?:\.\d{1,2})?)\b/i
  );
  return match ? match[1].replace(/\s+/g, '').toUpperCase().slice(0, 20) : null;
}

function evidenceFor(label, sourceText, page, sheet) {
  return {
    page: Number.isInteger(page) && page > 0 ? page : null,
    sheet: sheet || null,
    label,
    sourceText: String(sourceText || '').trim().slice(0, 160),
    sourceType: 'pdf_text',
    confidence: 1,
  };
}

/**
 * CAD exports often concatenate callouts ("TOPOFPLATE") or leave bare pitch
 * markers ("5:12") on roof plans. Normalize common tokens before regex facts.
 */
function normalizeCadCallouts(text) {
  return String(text || '')
    .replace(/TOPOFPLATE/gi, 'TOP OF PLATE')
    .replace(/TOPOFSUBFLOOR/gi, 'TOP OF SUBFLOOR')
    .replace(/BOTTOMOFFOOTING/gi, 'BOTTOM OF FOOTING')
    .replace(/HIGHESTRIDGE/gi, 'HIGHEST RIDGE')
    .replace(/ROOFPLAN/gi, 'ROOF PLAN')
    .replace(/FOUNDATIONPLAN/gi, 'FOUNDATION PLAN')
    .replace(/FRONTELEVATION/gi, 'FRONT ELEVATION')
    .replace(/BACKELEVATION/gi, 'BACK ELEVATION')
    .replace(/RIGHTELEVATION/gi, 'RIGHT ELEVATION')
    .replace(/LEFTELEVATION/gi, 'LEFT ELEVATION')
    .replace(/CROSSSECTION/gi, 'CROSS SECTION')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePitch(text) {
  const t = normalizeCadCallouts(text);
  const match =
    t.match(/\b(?:roof\s*)?pitch\s*[:=-]?\s*(\d{1,2})\s*[:/]\s*(12)\b/i) ||
    t.match(/\b(\d{1,2})\s*[:/]\s*(12)\s*(?:roof\s*)?pitch\b/i);
  if (match) return { value: `${Number(match[1])}:${Number(match[2])}`, sourceText: match[0] };
  const lowSlope = t.match(/\blow[-\s]*slope(?:\s+roof)?\b/i);
  if (lowSlope) return { value: 'low-slope', sourceText: lowSlope[0] };
  // Roof plans often print bare rise:run markers without the word "pitch".
  if (/\broof\b/i.test(t)) {
    const counts = new Map();
    const re = /\b(\d{1,2})\s*[:/]\s*(12)\b/g;
    let m;
    while ((m = re.exec(t))) {
      const rise = Number(m[1]);
      if (!Number.isInteger(rise) || rise < 1 || rise > 14) continue;
      const key = `${rise}:12`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    if (best && bestCount >= 2) return { value: best, sourceText: best };
  }
  return null;
}

function parseFeetToken(ft, inches, sourceText) {
  const value = feetInchesToDecimal(ft, inches || 0);
  if (value == null || value <= 0 || value > 40) return null;
  return { value: Math.round(value * 1000) / 1000, sourceText };
}

function parseLabeledHeight(text, kind) {
  const t = normalizeCadCallouts(text);
  if (kind === 'plate') {
    const patterns = [
      /\bplate\s*height\s*[:=-]?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/i,
      /\btop\s*of\s*plate\s*[:=-]?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})(?:\s*\d{1,2}\s*\/\s*\d{1,2})?)?["”]?/i,
      /\b(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?\s*plate(?:\s*height)?\b/i,
    ];
    for (const re of patterns) {
      const match = t.match(re);
      if (!match) continue;
      const parsed = parseFeetToken(match[1], match[2] || 0, match[0]);
      if (parsed) return parsed;
    }
    // Decimal feet only when not followed by an inches segment ("10.2'" ok, "9'-1\"" not).
    const decimal = t.match(
      /\b(?:top\s*of\s*)?plate(?:\s*height)?\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*['’](?!\s*-?\s*\d)/i
    );
    if (decimal) {
      const value = Number(decimal[1]);
      if (Number.isFinite(value) && value > 0 && value <= 40) {
        return { value: Math.round(value * 1000) / 1000, sourceText: decimal[0] };
      }
    }
    return null;
  }

  const patterns = [
    /\b(?:wall|ceiling)\s*height\s*[:=-]?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/i,
    /\b(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?\s*(?:wall|ceiling)\s*height\b/i,
    /\bfinished?\s*ceiling\s*[:=-]?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/i,
  ];
  for (const re of patterns) {
    const match = t.match(re);
    if (!match) continue;
    const parsed = parseFeetToken(match[1], match[2] || 0, match[0]);
    if (parsed) return parsed;
  }
  const decimal = t.match(
    /\b(?:wall|ceiling)\s*height\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*['’](?!\s*-?\s*\d)/i
  );
  if (decimal) {
    const value = Number(decimal[1]);
    if (Number.isFinite(value) && value > 0 && value <= 40) {
      return { value: Math.round(value * 1000) / 1000, sourceText: decimal[0] };
    }
  }
  return null;
}

/** Labeled exterior/foundation perimeter in LF (or feet-inches). */
function parseLabeledPerimeter(text, kind) {
  const t = normalizeCadCallouts(text);
  const kindWord =
    kind === 'foundation'
      ? '(?:foundation|footing)'
      : '(?:exterior|building|house)';
  // Prefer feet-inches so "198'-6\"" is not truncated to 198 by the LF pattern.
  const ftIn = t.match(
    new RegExp(
      `\\b${kindWord}\\s*perimeter\\s*[:=-]?\\s*(\\d{2,4})['’](?:[-\\s]*(\\d{1,2})["”])?`,
      'i'
    )
  );
  if (ftIn) {
    const value = feetInchesToDecimal(ftIn[1], ftIn[2] || 0);
    if (value != null && value >= 40 && value <= 2000) {
      return { value: Math.round(value * 10) / 10, sourceText: ftIn[0] };
    }
  }
  const patterns = [
    new RegExp(
      `\\b${kindWord}\\s*perimeter\\s*[:=-]?\\s*([\\d,]+(?:\\.\\d+)?)(?!['’])\\s*(?:LF|L\\.F\\.|lin(?:eal|ear)?\\.?\\s*ft\\.?|ft\\.?)\\b`,
      'i'
    ),
    new RegExp(
      `\\bperimeter\\s*(?:of\\s*)?(?:the\\s*)?${kindWord}\\s*[:=-]?\\s*([\\d,]+(?:\\.\\d+)?)(?!['’])\\s*(?:LF|L\\.F\\.|lin(?:eal|ear)?\\.?\\s*ft\\.?|ft\\.?)\\b`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const match = t.match(re);
    if (!match) continue;
    const value = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(value) && value >= 40 && value <= 2000) {
      return { value: Math.round(value * 10) / 10, sourceText: match[0] };
    }
  }
  return null;
}

/**
 * When foundation plans omit an explicit perimeter label, use the two largest
 * overall envelope dimensions that each appear at least twice (typical opposite-
 * side overall dims). Single-hit midspan dims and room L×W pairs are ignored.
 */
function parseOverallEnvelopePerimeter(text) {
  const t = normalizeCadCallouts(text);
  if (!/foundation/i.test(t)) return null;
  const withoutRooms = t.replace(
    /\b\d{1,3}'[^"\n]{0,16}"?\s*[xX×]\s*\d{1,3}'[^"\n]{0,16}"?/g,
    ' '
  );
  const counts = new Map();
  const re = /\b(\d{2,3})['’](?:\s*-\s*(\d{1,2}))?/g;
  let match;
  while ((match = re.exec(withoutRooms))) {
    const value = feetInchesToDecimal(match[1], match[2] || 0);
    if (value == null || value < 20 || value > 300) continue;
    const rounded = Math.round(value * 10) / 10;
    const key = String(rounded);
    const prev = counts.get(key);
    if (prev) prev.count += 1;
    else counts.set(key, { value: rounded, sourceText: match[0], count: 1 });
  }
  const repeated = [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.value - a.value);
  if (repeated.length < 2) return null;
  const unique = [];
  for (const entry of repeated) {
    if (unique.some((u) => Math.abs(u.value - entry.value) < 1.5)) continue;
    unique.push(entry);
    if (unique.length >= 2) break;
  }
  if (unique.length < 2) return null;
  const [a, b] = unique;
  if (a.value - b.value < 5) return null;
  const perimeter = Math.round(2 * (a.value + b.value) * 10) / 10;
  if (perimeter < 80 || perimeter > 2000) return null;
  return {
    value: perimeter,
    sourceText: `${a.sourceText} x ${b.sourceText}`,
  };
}

/**
 * Coarse non-painted exterior finish share from elevation notes
 * (stone/brick/stucco/masonry percentages). Sums distinct material hits
 * and caps at 90%.
 */
function parseNonPaintedExteriorPercent(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const materials = new Map();
  const remember = (materialRaw, pctRaw) => {
    const material = String(materialRaw || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    const pct = Number(pctRaw);
    if (!material || !Number.isFinite(pct) || pct <= 0 || pct > 90) return;
    const prev = materials.get(material);
    if (prev == null || pct > prev) materials.set(material, pct);
  };
  // Prefer "STONE 20%" over "% STONE" so "STONE 20% BRICK 10%" does not
  // re-attribute 20% to brick via the trailing "% MATERIAL" form.
  const materialFirst =
    /\b(stone|brick|masonry|stucco|cultured\s*stone|veneer|metal\s*panel)\b[^%]{0,48}?(\d{1,2}(?:\.\d+)?)\s*%/gi;
  let match;
  while ((match = materialFirst.exec(t))) remember(match[1], match[2]);
  const percentFirst =
    /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:of\s*)?(?:the\s*)?(?:exterior\s*)?(stone|brick|masonry|stucco|cultured\s*stone|veneer|metal\s*panel)\b/gi;
  while ((match = percentFirst.exec(t))) {
    const material = String(match[2] || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (materials.has(material)) continue;
    remember(match[2], match[1]);
  }
  if (!materials.size) return null;
  const total = Math.min(
    90,
    [...materials.values()].reduce((sum, value) => sum + value, 0)
  );
  const sourceText = [...materials.entries()]
    .map(([material, pct]) => `${material} ${pct}%`)
    .join(', ');
  return { value: Math.round(total * 10) / 10, sourceText };
}

function parsePageFactsFromText(text, { page = null, sheet = null } = {}) {
  const t = normalizeCadCallouts(text);
  const sourceSheet = sheet || extractSheet(t);
  const buildingAreas = {};
  const fieldEvidence = {};
  const addArea = (key, labels) => {
    const fact = labeledNumber(t, labels);
    if (!fact) return;
    buildingAreas[key] = fact.value;
    fieldEvidence[`buildingAreas.${key}`] = {
      value: fact.value,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: [evidenceFor(key, fact.sourceText, page, sourceSheet)],
    };
  };

  addArea('totalLivingSqft', [
    /Total\s*Living\s*(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /Main\s*Living\s*Area\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /Living\s*Area\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('mainFloorLivingSqft', [
    /Main\s*Floor\s*(?:Living\s*)?(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /First\s*Floor\s*(?:Living\s*)?(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('upstairsLivingSqft', [
    /(?:Upper|Upstairs|Second)\s*(?:Floor\s*)?(?:Living\s*)?(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('garageSqft', [
    /Garages?\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /Garage\s*Area\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('coveredPatioSqft', [
    /Covered\s*Patio\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /Covered\s*Porch\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('coveredOutdoorSqft', [
    /Covered\s*Outdoor\s*(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  addArea('roofDeckSqft', [
    /Roof\s*Deck\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);

  // "Main Living Area" is a cover total, but on a plan with no separate floor
  // labels it is also explicit evidence of the only labeled living floor.
  const mainLiving = labeledNumber(t, [
    /Main\s*Living\s*Area\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  if (mainLiving && buildingAreas.mainFloorLivingSqft == null) {
    buildingAreas.mainFloorLivingSqft = mainLiving.value;
    fieldEvidence['buildingAreas.mainFloorLivingSqft'] = {
      value: mainLiving.value,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: [evidenceFor('mainFloorLivingSqft', mainLiving.sourceText, page, sourceSheet)],
    };
  }

  const roofPitch = parsePitch(t);
  const wallHeight = parseLabeledHeight(t, 'wall');
  const plateHeight = parseLabeledHeight(t, 'plate');
  const exteriorPerimeter = parseLabeledPerimeter(t, 'exterior');
  const foundationPerimeter = parseLabeledPerimeter(t, 'foundation');
  const nonPaintedExterior = parseNonPaintedExteriorPercent(t);
  const planFacts = { buildingAreas, fieldEvidence };
  const addScalar = (key, fact) => {
    if (!fact) return;
    planFacts[key] = fact.value;
    fieldEvidence[key] = {
      value: fact.value,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: [evidenceFor(key, fact.sourceText, page, sourceSheet)],
    };
  };
  addScalar('roofPitch', roofPitch);
  addScalar('wallHeightFt', wallHeight);
  addScalar('plateHeightFt', plateHeight);
  addScalar('exteriorPerimeterLf', exteriorPerimeter);
  addScalar('foundationPerimeterLf', foundationPerimeter);
  if (!planFacts.foundationPerimeterLf) {
    addScalar('foundationPerimeterLf', parseOverallEnvelopePerimeter(t));
  }
  addScalar('nonPaintedExteriorPercent', nonPaintedExterior);
  if (buildingAreas.coveredPatioSqft != null) {
    planFacts.coveredPatioRoofed = true;
    fieldEvidence.coveredPatioRoofed = {
      value: true,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: fieldEvidence['buildingAreas.coveredPatioSqft'].evidence,
    };
  }
  const labeledFloors = [
    buildingAreas.mainFloorLivingSqft,
    buildingAreas.upstairsLivingSqft,
    ...(buildingAreas.additionalFloorAreas || []),
  ].filter((value) => value != null);
  if (labeledFloors.length) {
    planFacts.storyCount = labeledFloors.length;
    fieldEvidence.storyCount = {
      value: labeledFloors.length,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: [
        fieldEvidence['buildingAreas.mainFloorLivingSqft'],
        fieldEvidence['buildingAreas.upstairsLivingSqft'],
      ]
        .filter(Boolean)
        .flatMap((fact) => fact.evidence || []),
    };
  }
  return { buildingAreas, planFacts, sourceSheet };
}

function clusterPhrases(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    let line = lines.find((l) => Math.abs(l.y - it.y) <= 3.5);
    if (!line) {
      line = { y: it.y, parts: [] };
      lines.push(line);
    }
    line.parts.push(it);
  }

  const phrases = [];
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const p of line.parts) {
      const gap = cur ? p.x - cur.xEnd : 999;
      if (!cur || gap > 10) {
        cur = {
          str: p.str,
          x: p.x,
          y: line.y,
          xEnd: p.x + Math.max(p.w || 0, 3),
        };
        phrases.push(cur);
      } else {
        cur.str += p.str;
        cur.xEnd = p.x + Math.max(p.w || 0, 3);
      }
    }
  }
  return phrases.map((p) => ({
    ...p,
    str: String(p.str || '').replace(/\s+/g, ' ').trim(),
  }));
}

function classifyPage(phrases, pageIndex) {
  const blob = phrases.map((p) => p.str).join(' ');
  if (FOUNDATION_PAGE_RE.test(blob)) return 'foundation';
  if (FLOOR_PAGE_RE.test(blob)) return 'floor';
  if (SKIP_PAGE_RE.test(blob)) return 'skip';
  // Cover / schedule-only pages often have Square Footage without floor plan
  if (/Square\s*Footage|Main\s*Living\s*Area/i.test(blob) && pageIndex === 0) return 'cover';
  return 'other';
}

function extractRoomsFromPhrases(phrases, { sourcePage = null, sourceSheet = null } = {}) {
  const dims = [];
  const names = [];
  for (const p of phrases) {
    const dim = parseDimensionString(p.str.replace(/\s+/g, ''));
    if (dim) {
      dims.push({ ...dim, x: p.x, y: p.y });
      continue;
    }
    // Also accept "13'-1" X 8'-7"" with spaces / odd quotes
    const loose = parseDimensionString(
      p.str
        .replace(/\s+/g, '')
        .replace(/[–—]/g, '-')
        .replace(/”|“|"/g, '"')
        .replace(/×/g, 'x')
    );
    if (loose) {
      dims.push({ ...loose, x: p.x, y: p.y });
      continue;
    }
    const name = normalizeRoomLabel(p.str.replace(/\s+/g, ''));
    if (name && name !== 'Living Area') {
      names.push({ name, x: p.x, y: p.y });
    }
  }

  const usedDims = new Set();
  const rooms = [];
  for (const room of names) {
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < dims.length; i++) {
      if (usedDims.has(i)) continue;
      const d = dims[i];
      const dx = Math.abs(room.x - d.x);
      const dy = room.y - d.y; // PDF coords: +y up; dims usually slightly below label
      const dist = Math.hypot(dx, Math.abs(dy));
      let score = dist;
      // Prefer dimension directly under / near the label
      if (dy >= -8 && dy <= 55 && dx <= 140) score *= 0.25;
      else if (Math.abs(dy) <= 30 && dx <= 180) score *= 0.55;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestScore > 220) continue;
    usedDims.add(bestIdx);
    const d = dims[bestIdx];
    rooms.push({
      name: room.name,
      lengthFt: d.lengthFt,
      widthFt: d.widthFt,
      areaSqft: d.areaSqft,
      confidence: bestScore < 80 ? 0.98 : 0.9,
      source: 'pdf_text',
      sourcePage,
      sourceSheet,
      measurementKey: null,
    });
  }
  return rooms;
}

function dedupeRoomsByName(rooms) {
  const byName = new Map();
  for (const room of rooms) {
    const key = String(room.name || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || (room.confidence || 0) > (prev.confidence || 0)) {
      byName.set(key, room);
    }
  }
  return [...byName.values()];
}

async function loadPdfJs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array && !(Buffer.isBuffer?.(buffer))) return buffer;
  if (Buffer.isBuffer(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return new Uint8Array(buffer);
}

async function extractItemsFromPdfBuffer(buffer) {
  const pdfjs = await loadPdfJs();
  const data = toUint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => {
        const t = it.transform || [1, 0, 0, 1, 0, 0];
        return {
          str: collapseDoubledGlyphs(it.str),
          x: t[4],
          y: t[5],
          w: it.width || 0,
        };
      })
      .filter((it) => it.str && String(it.str).trim());
    pages.push({ pageIndex: i - 1, items });
  }
  return pages;
}

/**
 * @param {Buffer|Uint8Array|Array<Buffer|Uint8Array>} pdfBuffers
 */
async function extractPlanTakeoffFromPdfBuffers(pdfBuffers) {
  const list = (Array.isArray(pdfBuffers) ? pdfBuffers : [pdfBuffers]).filter(Boolean);
  if (!list.length) {
    return { buildingAreas: {}, rooms: [], assumptions: [], pageCount: 0 };
  }

  const buildingAreas = {};
  const fieldEvidence = {};
  const scalarFacts = {};
  const allRooms = [];
  const assumptions = [];
  let pageCount = 0;

  for (const buf of list) {
    let pages;
    try {
      pages = await extractItemsFromPdfBuffer(buf);
    } catch (err) {
      console.warn('PDF text takeoff failed:', err?.message || err);
      continue;
    }
    pageCount += pages.length;
    for (const page of pages) {
      const phrases = clusterPhrases(page.items);
      const pageText = phrases.map((p) => p.str).join(' ');
      const pageNumber = page.pageIndex + 1;
      const parsedFacts = parsePageFactsFromText(pageText, { page: pageNumber });
      const schedule = parsedFacts.buildingAreas;
      for (const [k, v] of Object.entries(schedule)) {
        if (buildingAreas[k] == null) buildingAreas[k] = v;
      }
      for (const [k, v] of Object.entries(parsedFacts.planFacts.fieldEvidence || {})) {
        if (fieldEvidence[k] == null) fieldEvidence[k] = v;
      }
      for (const key of [
        'roofPitch',
        'wallHeightFt',
        'plateHeightFt',
        'coveredPatioRoofed',
        'exteriorPerimeterLf',
        'foundationPerimeterLf',
        'nonPaintedExteriorPercent',
      ]) {
        if (scalarFacts[key] == null && parsedFacts.planFacts[key] != null) {
          scalarFacts[key] = parsedFacts.planFacts[key];
        }
      }

      const kind = classifyPage(phrases, page.pageIndex);
      if (kind === 'skip' || kind === 'foundation' || kind === 'cover') continue;
      if (kind !== 'floor' && kind !== 'other') continue;
      // Only pair rooms on floor-like pages (or unknown pages that have many L×W labels)
      const dimCount = phrases.filter((p) => parseDimensionString(p.str.replace(/\s+/g, ''))).length;
      if (kind === 'other' && dimCount < 3) continue;

      const rooms = extractRoomsFromPhrases(phrases, {
        sourcePage: pageNumber,
        sourceSheet: parsedFacts.sourceSheet,
      });
      allRooms.push(...rooms);
      if (rooms.length) {
        assumptions.push(`Room dimensions from PDF text on page ${page.pageIndex + 1}`);
      }
    }
  }

  if (Object.keys(buildingAreas).length) {
    assumptions.unshift('Building Areas from PDF text layer (schedule)');
  }
  const explicitFloors = [
    buildingAreas.mainFloorLivingSqft,
    buildingAreas.upstairsLivingSqft,
    ...(Array.isArray(buildingAreas.additionalFloorAreas) ? buildingAreas.additionalFloorAreas : []),
  ].filter((value) => value != null);
  if (explicitFloors.length) {
    scalarFacts.storyCount = explicitFloors.length;
    const evidence = [
      fieldEvidence['buildingAreas.mainFloorLivingSqft'],
      fieldEvidence['buildingAreas.upstairsLivingSqft'],
    ]
      .filter(Boolean)
      .flatMap((fact) => fact.evidence || []);
    fieldEvidence.storyCount = {
      value: explicitFloors.length,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence,
    };
  }

  return {
    buildingAreas,
    planFacts: { buildingAreas, ...scalarFacts, fieldEvidence },
    rooms: dedupeRoomsByName(allRooms).slice(0, 60),
    assumptions: [...new Set(assumptions)].slice(0, 8),
    pageCount,
  };
}

function formatPdfEvidenceForVision(pdfTakeoff) {
  if (!pdfTakeoff) return '';
  const lines = [];
  const ba = pdfTakeoff.buildingAreas || {};
  if (Object.keys(ba).length) {
    lines.push('PDF text layer — Building Areas (use these exact schedule totals):');
    for (const [k, v] of Object.entries(ba)) lines.push(`- ${k}: ${v}`);
  }
  const facts = pdfTakeoff.planFacts || {};
  const scalarKeys = [
    'storyCount',
    'roofPitch',
    'wallHeightFt',
    'plateHeightFt',
    'exteriorPerimeterLf',
    'foundationPerimeterLf',
    'nonPaintedExteriorPercent',
    'coveredPatioRoofed',
  ];
  const scalars = scalarKeys.filter((key) => facts[key] != null);
  if (scalars.length) {
    lines.push('PDF text layer — labeled plan facts (prefer these; do not invent):');
    for (const key of scalars) lines.push(`- ${key}: ${facts[key]}`);
  }
  const rooms = pdfTakeoff.rooms || [];
  if (rooms.length) {
    lines.push('PDF text layer — room L×W already paired spatially (prefer these; do not swap labels):');
    for (const r of rooms.slice(0, 40)) {
      lines.push(
        `- ${r.name}: ${r.lengthFt}' × ${r.widthFt}' = ${r.areaSqft} sqft (page ${r.sourcePage || '?'}, sheet ${r.sourceSheet || '?'})`
      );
    }
    lines.push(
      'Only add additional rooms that are missing from this list and have a readable L×W. Never invent bath SF.'
    );
  }
  return lines.join('\n');
}

module.exports = {
  collapseDoubledGlyphs,
  parseDimensionString,
  normalizeRoomLabel,
  parseScheduleFromText,
  parsePageFactsFromText,
  parseLabeledHeight,
  parseLabeledPerimeter,
  parseNonPaintedExteriorPercent,
  parseOverallEnvelopePerimeter,
  parsePitch,
  normalizeCadCallouts,
  extractSheet,
  clusterPhrases,
  extractRoomsFromPhrases,
  dedupeRoomsByName,
  extractPlanTakeoffFromPdfBuffers,
  formatPdfEvidenceForVision,
  feetInchesToDecimal,
};
