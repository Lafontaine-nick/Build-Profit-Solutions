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
  { re: /\bbed(?:room)?\s*(\d+)\b/i, name: m => `Bed ${m[1]}` },
  { re: /\bprimary\s*bath(room)?\b/i, name: 'Primary Bath' },
  { re: /\bmaster\s*bath(room)?\b/i, name: 'Primary Bath' },
  { re: /\bguest\s*bath(room)?\b/i, name: 'Guest Bath' },
  { re: /\bpowder\b/i, name: 'Powder' },
  { re: /\bbath(?:room)?\s*(\d+)\b/i, name: m => `Bath ${m[1]}` },
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
  const m = s.match(/^(\d{1,2})'(?:-|–)?(\d{1,2})"?[xX×](\d{1,2})'(?:-|–)?(\d{1,2})"?$/);
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
      .replace(/([A-Z]{2,})/g, m => m)
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

function normalizeExtractedSheetId(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, 20);
}

function isFixtureTagSheetId(id) {
  return /^(?:R-?\d{1,2}[A-Z]?|C\.?F\.?(?:-?\d)?|L-?\d{1,2}[A-Z]?)$/i.test(String(id || ''));
}

function isArchitecturalSheetId(id) {
  const compact = String(id || '').toUpperCase();
  if (!compact || isFixtureTagSheetId(compact)) return false;
  return /^[A-Z]-?\d{1,3}(?:\.\d{1,2})?$/.test(compact);
}

function extractSheet(text) {
  const t = String(text || '');
  const candidates = [];
  const titled = t.match(
    /(?:lighting|electrical|power|reflected\s+ceiling|floor)\s+plan\b[\s\w.-]{0,60}?\b([A-Z]{1,3}\s*[-.]?\s*\d{1,3}(?:\.\d{1,2})?)\b/i
  );
  if (titled) candidates.push(titled[1]);
  const beforeTitle = t.match(
    /\b([A-Z]{1,3}\s*[-.]?\s*\d{1,3}(?:\.\d{1,2})?)\s+(?:lighting|electrical|power|reflected\s+ceiling|floor)\s+plan\b/i
  );
  if (beforeTitle) candidates.push(beforeTitle[1]);
  for (const match of t.matchAll(
    /\b(?:sheet(?:\s*(?:no\.?|number))?\s*[:#-]?\s*)?([A-Z]{1,3}\s*[-.]?\s*\d{1,3}(?:\.\d{1,2})?)\b/gi
  )) {
    candidates.push(match[1]);
  }
  for (const raw of candidates) {
    const id = normalizeExtractedSheetId(raw);
    if (id && isArchitecturalSheetId(id)) return id;
  }
  return null;
}

function evidenceFor(label, sourceText, page, sheet) {
  return {
    page: Number.isInteger(page) && page > 0 ? page : null,
    sheet: sheet || null,
    label,
    sourceText: String(sourceText || '')
      .trim()
      .slice(0, 160),
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
    const hits = [];
    const remember = parsed => {
      if (!parsed || !(parsed.value > 0) || parsed.value > 40) return;
      if (hits.some(h => Math.abs(h.value - parsed.value) < 0.05)) return;
      hits.push(parsed);
    };
    const patterns = [
      /\bplate\s*height\s*[:=-]?\s*["']?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/gi,
      /\btop\s*of\s*plate\s*[:=-]?\s*["']?\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})(?:\s*\d{1,2}\s*\/\s*\d{1,2})?)?["”]?/gi,
      /\b(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?\s*plate(?:\s*height)?\b/gi,
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(t))) {
        remember(parseFeetToken(match[1], match[2] || 0, match[0]));
      }
    }
    // Decimal feet only when not followed by a feet-inches hyphen ("10.2'" ok, "9'-1" not).
    // Do not treat CAD junk digits after the mark (e.g. `10.2' 8 5 0`) as inches.
    const decimalRe =
      /\b(?:top\s*of\s*)?plate(?:\s*height)?\s*[:=-]?\s*["']?\s*(\d{1,2}(?:\.\d+)?)\s*['’](?!\s*-\s*\d)/gi;
    let decimal;
    while ((decimal = decimalRe.exec(t))) {
      const value = Number(decimal[1]);
      if (Number.isFinite(value) && value > 0 && value <= 40) {
        remember({ value: Math.round(value * 1000) / 1000, sourceText: decimal[0] });
      }
    }
    if (!hits.length) return null;
    // Multi-story sections label both first-floor plate (~10.2') and the
    // cumulative upper plate (~20.5'). Stucco needs the per-story height.
    const perStory = hits.filter(h => h.value >= 7 && h.value <= 14).sort((a, b) => a.value - b.value);
    if (perStory.length) return perStory[0];
    return hits.sort((a, b) => a.value - b.value)[0];
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
  const decimal = t.match(/\b(?:wall|ceiling)\s*height\s*[:=-]?\s*(\d{1,2}(?:\.\d+)?)\s*['’](?!\s*-\s*\d)/i);
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
  const kindWord = kind === 'foundation' ? '(?:foundation|footing)' : '(?:exterior|building|house)';
  // Prefer feet-inches so "198'-6\"" is not truncated to 198 by the LF pattern.
  const ftIn = t.match(
    new RegExp(`\\b${kindWord}\\s*perimeter\\s*[:=-]?\\s*(\\d{2,4})['’](?:[-\\s]*(\\d{1,2})["”])?`, 'i')
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
  const withoutRooms = t.replace(/\b\d{1,3}'[^"\n]{0,16}"?\s*[xX×]\s*\d{1,3}'[^"\n]{0,16}"?/g, ' ');
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
  const repeated = [...counts.values()].filter(entry => entry.count >= 2).sort((a, b) => b.value - a.value);
  const uniqueSorted = [...counts.values()].sort((a, b) => b.value - a.value);
  let a = null;
  let b = null;
  if (repeated.length >= 2) {
    const unique = [];
    for (const entry of repeated) {
      if (unique.some(u => Math.abs(u.value - entry.value) < 1.5)) continue;
      unique.push(entry);
      if (unique.length >= 2) break;
    }
    if (unique.length >= 2) {
      a = unique[0];
      b = unique[1];
    }
  }
  // L-shaped / stepped foundation plans often repeat only the long side.
  // Pair the repeated overall with the next largest distinct envelope dim.
  if ((!a || !b) && repeated.length >= 1 && uniqueSorted.length >= 2) {
    a = repeated[0];
    b = uniqueSorted.find(entry => Math.abs(entry.value - a.value) >= 5) || null;
  }
  if (!a || !b) return null;
  if (a.value - b.value < 5 && b.value - a.value < 5) return null;
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
  const sourceText = [...materials.entries()].map(([material, pct]) => `${material} ${pct}%`).join(', ');
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

  // Cover totals only — bare "Living Area #### SQ FT" on floor sheets is the
  // per-floor footprint (handled below), not the whole-house total.
  addArea('totalLivingSqft', [
    /Total\s*Living\s*(?:Area)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
    /Main\s*Living\s*Area\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
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
  addArea('roofDeckSqft', [/Roof\s*Deck\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i]);

  // "Main Living Area" on cover sheets is usually the *total* living SF (also
  // captured above). Only treat it as the first-floor footprint when it differs
  // from the cover total — otherwise 2-story plans double-count upstairs as roof.
  const mainLiving = labeledNumber(t, [/Main\s*Living\s*Area\s*:\s*([\d,]+(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i]);
  if (mainLiving && buildingAreas.mainFloorLivingSqft == null) {
    const coverTotal = buildingAreas.totalLivingSqft;
    const isCoverTotalAlias = coverTotal != null && Math.abs(Number(coverTotal) - mainLiving.value) < 1;
    if (!isCoverTotalAlias) {
      buildingAreas.mainFloorLivingSqft = mainLiving.value;
      fieldEvidence['buildingAreas.mainFloorLivingSqft'] = {
        value: mainLiving.value,
        sourceType: 'detected_from_plan',
        confidence: 'high',
        evidence: [evidenceFor('mainFloorLivingSqft', mainLiving.sourceText, page, sourceSheet)],
      };
    }
  }

  // Floor-plan callouts like "LIVINGAREA 2047SQFT" on MAIN LEVEL / 2ND LEVEL
  // sheets (SHV Lot 58). CAD text often inserts revision junk or nearby room
  // dims between the label and the area ("LIVINGAREA N 2047SQFT").
  const floorLiving = labeledNumber(t, [
    /\bLiving\s*Area\b[\s\S]{0,48}?([\d,]{3,5}(?:\.\d+)?)\s*(?:Sq\.?\s*Ft|SF|SQFT)\b/i,
  ]);
  if (floorLiving) {
    const isUpper = /\b(?:2nd|second|upper)\s*(?:level|floor)\b/i.test(t) || /\bupstairs\b/i.test(t);
    const isMain = /\b(?:main|first|1st)\s*(?:level|floor)\b/i.test(t) && !isUpper;
    if (isUpper && buildingAreas.upstairsLivingSqft == null) {
      buildingAreas.upstairsLivingSqft = floorLiving.value;
      fieldEvidence['buildingAreas.upstairsLivingSqft'] = {
        value: floorLiving.value,
        sourceType: 'detected_from_plan',
        confidence: 'high',
        evidence: [evidenceFor('upstairsLivingSqft', floorLiving.sourceText, page, sourceSheet)],
      };
    } else if (isMain && buildingAreas.mainFloorLivingSqft == null) {
      buildingAreas.mainFloorLivingSqft = floorLiving.value;
      fieldEvidence['buildingAreas.mainFloorLivingSqft'] = {
        value: floorLiving.value,
        sourceType: 'detected_from_plan',
        confidence: 'high',
        evidence: [evidenceFor('mainFloorLivingSqft', floorLiving.sourceText, page, sourceSheet)],
      };
    }
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
  ].filter(value => value != null);
  if (labeledFloors.length) {
    planFacts.storyCount = labeledFloors.length;
    fieldEvidence.storyCount = {
      value: labeledFloors.length,
      sourceType: 'detected_from_plan',
      confidence: 'high',
      evidence: [fieldEvidence['buildingAreas.mainFloorLivingSqft'], fieldEvidence['buildingAreas.upstairsLivingSqft']]
        .filter(Boolean)
        .flatMap(fact => fact.evidence || []),
    };
  }
  return { buildingAreas, planFacts, sourceSheet };
}

function clusterPhrases(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    let line = lines.find(l => Math.abs(l.y - it.y) <= 3.5);
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
  return phrases.map(p => ({
    ...p,
    str: String(p.str || '')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
}

function classifyPage(phrases, pageIndex) {
  const blob = phrases.map(p => p.str).join(' ');
  if (FOUNDATION_PAGE_RE.test(blob)) return 'foundation';
  if (FLOOR_PAGE_RE.test(blob)) return 'floor';
  if (SKIP_PAGE_RE.test(blob)) return 'skip';
  // Cover / schedule-only pages often have Square Footage without floor plan
  if (/Square\s*Footage|Main\s*Living\s*Area/i.test(blob) && pageIndex === 0) return 'cover';
  return 'other';
}

const PAINTING_PAGE_SIGNALS = [
  { re: /floor\s*plan|main\s*floor|upper\s*floor|second\s*floor|floor\s*layout/i, label: 'floor plan', score: 8 },
  { re: /finish\s*(plan|schedule)|room\s*finish/i, label: 'finish schedule', score: 10 },
  { re: /reflected\s*ceiling|\bRCP\b/i, label: 'RCP', score: 8 },
  { re: /door\s*schedule/i, label: 'door schedule', score: 9 },
  { re: /interior\s*elevation/i, label: 'interior elevation', score: 7 },
  { re: /exterior\s*elevation|(?:front|rear|left|right)\s*elevation/i, label: 'exterior elevation', score: 8 },
  { re: /\bcabinets?\b|\bmillwork\b|\bcasework\b/i, label: 'cabinets / millwork', score: 5 },
  { re: /baseboard|wall\s*finish|ceiling\s*finish/i, label: 'finish / trim', score: 6 },
  { re: /\bpaint(?:ing)?\b|\bPT\b|\bP-?1\b/i, label: 'paint', score: 10 },
];

const PAINTING_IRRELEVANT_PAGE_RE =
  /\b(electrical|plumbing|hvac|mechanical|framing|foundation|roof\s*plan|structural|sprinkler)\b/i;

const ELECTRICAL_PAGE_SIGNALS = [
  { re: /\belectrical\s+plan\b|\belectrical\s+layout\b/i, label: 'electrical plan', score: 12 },
  { re: /\blighting\s+plan\b|\bpower\s+plan\b|\blighting\s+layout\b/i, label: 'lighting / power plan', score: 11 },
  { re: /\bpanel\s+schedule\b|\bcircuit\s+schedule\b/i, label: 'panel schedule', score: 12 },
  { re: /\bdevice\s+legend\b|\blighting\s+legend\b|\bsymbol\s+legend\b/i, label: 'device legend', score: 8 },
  {
    re: /\bmain\s+(?:floor|level)\s+electrical|\b(?:second|upper)\s+(?:floor|level)\s+electrical/i,
    label: 'level electrical',
    score: 10,
  },
  { re: /\bE\d+\.\d+\b|\bsheet\s+E[-.]?\d/i, label: 'E sheet', score: 9 },
  { re: /\breceptacle|\bgfci\b|\bsmoke\s+detector|\bceiling\s+fan\b/i, label: 'device callouts', score: 4 },
];

const PLUMBING_PAGE_SIGNALS = [
  { re: /\bplumbing\s+plan\b|\bplumbing\s+layout\b|\bplumbing\s+drawing\b/i, label: 'plumbing plan', score: 14 },
  { re: /\bP\d+\.\d+\b|\bsheet\s+P[-.]?\d/i, label: 'P sheet', score: 13 },
  { re: /\bplumbing\s+riser\b|\brisometric\b|\bplumbing\s+details?\b/i, label: 'plumbing riser/details', score: 12 },
  { re: /\bfixture\s+schedule\b|\bplumbing\s+fixture\s+schedule\b/i, label: 'fixture schedule', score: 11 },
  {
    re: /\bwater\s+heater\b|\bsewer\s+line\b|\bwater\s+line\b|\bdwv\b|\bdrain[-\s]?waste\b/i,
    label: 'plumbing callouts',
    score: 5,
  },
  {
    re: /\bfloor\s*plan|\bmain\s*floor|\bupper\s*floor|\bsecond\s*floor|\bfloor\s*layout/i,
    label: 'floor plan (fixture symbols)',
    score: 6,
  },
  {
    re: /\bsite\s*plan\b|\butility\b|\bsewer\s+tap\b|\bwater\s+tap\b|\bwater\s+meter\b/i,
    label: 'site / utility',
    score: 7,
  },
];

/** Upper-level E sheets often have almost no text layer. Include the next page after a strong hit. */
function expandElectricalRelevantPages(pages, pageCount) {
  const byPage = new Map();
  for (const page of Array.isArray(pages) ? pages : []) {
    const pageNumber = Number(page?.page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) continue;
    byPage.set(pageNumber, page);
  }
  for (const page of [...byPage.values()]) {
    if ((page.score || 0) < 8) continue;
    const next = page.page + 1;
    if (next > pageCount || byPage.has(next)) continue;
    byPage.set(next, {
      page: next,
      score: Math.max(1, (page.score || 1) - 3),
      reasons: ['following electrical sheet'],
    });
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/** Include adjacent floor-plan pages after strong plumbing sheet hits. */
function expandPlumbingRelevantPages(pages, pageCount) {
  const byPage = new Map();
  for (const page of Array.isArray(pages) ? pages : []) {
    const pageNumber = Number(page?.page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) continue;
    byPage.set(pageNumber, page);
  }
  for (const page of [...byPage.values()]) {
    if ((page.score || 0) < 8) continue;
    const next = page.page + 1;
    if (next > pageCount || byPage.has(next)) continue;
    byPage.set(next, {
      page: next,
      score: Math.max(1, (page.score || 1) - 2),
      reasons: ['following plumbing / floor-plan sheet'],
    });
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/**
 * Repeated fixture/device instance tags on lighting / electrical / floor sheets.
 * R4 is the first mapped tag (recessedLightCount). A tag is a quantity only when
 * it is a repeated drawing callout — not a legend, schedule, note, or r-value.
 */
const ELECTRICAL_INSTANCE_TAG_SPECS = [
  {
    key: 'recessedLightCount',
    id: 'R4',
    tokenRe: /^R-?4(?:[A-Z]|-?\d)?$/i,
    concatRe: /R4(?![0-9])/g,
  },
  {
    key: 'ceilingFanCount',
    id: 'CF',
    tokenRe: /^C\.?F\.?(?:-?\d)?$/i,
    concatRe: null,
  },
];

const OTHER_FIXTURE_TAG_RE = /^(?:R-?(?:[1-35-9]|1\d)|L-?\d{1,2}|P-?\d{1,2}|F-?\d{1,2})[A-Z]?$/i;

const FIXTURE_TAG_SKIP_PAGE_RE =
  /elevation|section|roof\s*plan|framing|terrain|site\s*plan|cover\s*sheet|structural|foundation/i;

const LIGHTING_OR_ELECTRICAL_PLAN_RE =
  /lighting\s+plan|electrical\s+plan|power\s+plan|electrical\s+layout|lighting\s+layout/i;

const NON_INSTANCE_TAG_PHRASE_RE =
  /\b(legend|schedule|typical|typ\.|similar|sim\.|see\s+(?:sheet|plan|note)|refer(?:\s+to)?|insulation|insul\.?|batt|r-value|lumen|watt|downlight|description|duct\s*board)\b/i;

function isFixtureTagSkipPage(text) {
  const t = String(text || '');
  if (LIGHTING_OR_ELECTRICAL_PLAN_RE.test(t)) return false;
  return FIXTURE_TAG_SKIP_PAGE_RE.test(t);
}

function detectElectricalPlanLevel(text) {
  const t = String(text || '');
  if (/\b(?:2nd|second|upper)\s+(?:level|floor)\b|\bupstairs\b/i.test(t)) return 'upper';
  if (/\b(?:main|first|1st|lower|ground)\s+(?:level|floor)\b/i.test(t)) return 'main';
  return 'unknown';
}

function detectElectricalSheetKind(text) {
  const t = String(text || '');
  if (/reflected\s*ceiling|\bRCP\b/i.test(t)) return 'rcp';
  if (/lighting\s+plan|electrical\s+plan|power\s+plan|electrical\s+layout|lighting\s+layout/i.test(t)) {
    return 'lighting';
  }
  if (/floor\s*plan|level\s+layout/i.test(t)) return 'floor';
  return 'other';
}

function phraseLooksLikeNonInstance(str) {
  const s = String(str || '').trim();
  if (!s) return true;
  if (s.length > 22) return true;
  if (NON_INSTANCE_TAG_PHRASE_RE.test(s)) return true;
  if (/\d+\s*(?:'|\"|in(?:ch(?:es)?)?)\b/i.test(s) && /R-?4|\bC\.?F\.?/i.test(s)) {
    return true;
  }
  return false;
}

function glyphPairCoveredByPhraseHit(hit, phraseHits) {
  const x = Number(hit?.x) || 0;
  const y = Number(hit?.y) || 0;
  return (Array.isArray(phraseHits) ? phraseHits : []).some(phrase => {
    if (Math.abs((Number(phrase.y) || 0) - y) > 6) return false;
    const left = Number(phrase.x) || 0;
    const right = Number(phrase.xEnd) || left;
    return x >= left - 4 && x <= right + 4;
  });
}

function pairAdjacentGlyphTags(items, spec) {
  if (spec?.id !== 'R4' || !Array.isArray(items) || !items.length) return [];
  const rGlyphs = [];
  const fourGlyphs = [];
  for (const item of items) {
    const str = String(item?.str || '').trim();
    if (str === 'R' || str === 'r') rGlyphs.push(item);
    else if (str === '4') fourGlyphs.push(item);
  }
  const usedFour = new Set();
  const hits = [];
  for (const r of rGlyphs) {
    let best = -1;
    let bestDx = 9;
    for (let i = 0; i < fourGlyphs.length; i++) {
      if (usedFour.has(i)) continue;
      const four = fourGlyphs[i];
      const dy = Math.abs((Number(r.y) || 0) - (Number(four.y) || 0));
      const dx = (Number(four.x) || 0) - (Number(r.x) || 0);
      if (dy <= 4 && dx > 0 && dx <= 8 && dx < bestDx) {
        best = i;
        bestDx = dx;
      }
    }
    if (best < 0) continue;
    usedFour.add(best);
    hits.push({
      x: Number(r.x) || 0,
      y: Number(r.y) || 0,
      count: 1,
      str: 'R4',
    });
  }
  return hits;
}

function countEmbeddedInstanceTags(compact, spec) {
  if (!spec?.concatRe) return 0;
  const upper = String(compact || '')
    .toUpperCase()
    .replace(/[-.]/g, '');
  if (!upper || spec.tokenRe.test(upper)) return 0;
  // CAD often glues one fixture tag into a room label (LAUNR4DRY).
  // Require a letter on both sides so DOOR4 / FLOOR4 are not tags.
  if (spec.id === 'R4') {
    const bounded = upper.match(/[A-Z]R4[A-Z]/g);
    if (bounded?.length) return bounded.length;
  }
  const matches = upper.match(spec.concatRe);
  return matches && matches.length > 1 ? matches.length : 0;
}

function countTagOccurrences(str, spec) {
  const s = String(str || '').trim();
  if (!s) return 0;
  const tokens = s.split(/[\s,;/]+/).filter(Boolean);
  let n = 0;
  for (const token of tokens) {
    const compact = String(token || '').replace(/\s+/g, '');
    if (spec.tokenRe.test(compact)) {
      n += 1;
      continue;
    }
    n += countEmbeddedInstanceTags(compact, spec);
  }
  return n;
}

function findLegendRegions(phrases) {
  const regions = [];
  for (const phrase of Array.isArray(phrases) ? phrases : []) {
    const str = String(phrase?.str || '');
    if (
      !/\b(legend|fixture\s*schedule|lighting\s*schedule|symbol\s*(?:legend|list|key)|device\s*legend)\b/i.test(str)
    ) {
      continue;
    }
    regions.push({
      x: Number(phrase.x) || 0,
      y: Number(phrase.y) || 0,
      w: 180,
      h: 240,
    });
  }
  return regions;
}

function isInsideLegendRegion(phrase, regions) {
  const x = Number(phrase?.x) || 0;
  const y = Number(phrase?.y) || 0;
  return (Array.isArray(regions) ? regions : []).some(
    region => x >= region.x - 24 && x <= region.x + region.w && y <= region.y + 24 && y >= region.y - region.h
  );
}

function tagHitsHaveSpread(hits, minSpan = 40) {
  const list = Array.isArray(hits) ? hits : [];
  if (list.length < 2) return false;
  const xs = list.map(hit => Number(hit.x) || 0);
  const ys = list.map(hit => Number(hit.y) || 0);
  return Math.max(...xs) - Math.min(...xs) > minSpan || Math.max(...ys) - Math.min(...ys) > minSpan;
}

function instanceCountFromTagHits(hits) {
  const list = Array.isArray(hits) ? hits : [];
  if (!list.length) return 0;
  const raw = list.reduce((sum, hit) => sum + (Number(hit.count) || 1), 0);
  if (!tagHitsHaveSpread(list)) return raw;
  return clusterTagHits(list).reduce((sum, hit) => sum + (Number(hit.count) || 1), 0);
}

function isMappedElectricalInstanceTag(str) {
  const compact = String(str || '').replace(/\s+/g, '');
  return ELECTRICAL_INSTANCE_TAG_SPECS.some(spec => spec.tokenRe.test(compact));
}

function clusterTagHits(hits, radius = 8) {
  const list = Array.isArray(hits) ? hits : [];
  const used = new Set();
  const clusters = [];
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue;
    const group = [list[i]];
    used.add(i);
    for (let j = i + 1; j < list.length; j++) {
      if (used.has(j)) continue;
      const dist = Math.hypot(
        (Number(list[i].x) || 0) - (Number(list[j].x) || 0),
        (Number(list[i].y) || 0) - (Number(list[j].y) || 0)
      );
      if (dist <= radius) {
        group.push(list[j]);
        used.add(j);
      }
    }
    const count = Math.max(...group.map(hit => Number(hit.count) || 1));
    clusters.push({ ...group[0], count });
  }
  return clusters;
}

function countElectricalInstanceTagsOnPage(phrases, { pageText, page = null, sheet = null, items = null } = {}) {
  const blob = pageText || (Array.isArray(phrases) ? phrases.map(p => p.str).join(' ') : '');
  if (isFixtureTagSkipPage(blob)) {
    return {
      measurements: {},
      details: {},
      kind: 'other',
      level: 'unknown',
      page,
      sheet,
      unclassifiedFixtureCount: 0,
    };
  }
  const legendBoxes = findLegendRegions(phrases);
  const kind = detectElectricalSheetKind(blob);
  const level = detectElectricalPlanLevel(blob);
  const sourceSheet = sheet || extractSheet(blob);
  const measurements = {};
  const details = {};
  for (const spec of ELECTRICAL_INSTANCE_TAG_SPECS) {
    const hits = [];
    for (const phrase of Array.isArray(phrases) ? phrases : []) {
      const str = String(phrase?.str || '').trim();
      if (!str || phraseLooksLikeNonInstance(str)) continue;
      if (isInsideLegendRegion(phrase, legendBoxes)) continue;
      const count = countTagOccurrences(str, spec);
      if (count < 1) continue;
      const x = Number(phrase.x) || 0;
      hits.push({
        x,
        y: Number(phrase.y) || 0,
        count,
        str,
        xEnd: Number(phrase.xEnd) || x + Math.max(Number(phrase.w) || 0, String(str).length * 6),
      });
    }
    for (const hit of pairAdjacentGlyphTags(items, spec)) {
      if (isInsideLegendRegion(hit, legendBoxes)) continue;
      if (glyphPairCoveredByPhraseHit(hit, hits)) continue;
      hits.push(hit);
    }
    const instanceCount = instanceCountFromTagHits(hits);
    if (instanceCount < 2) continue;
    measurements[spec.key] = instanceCount;
    details[spec.key] = {
      value: instanceCount,
      tag: spec.id,
      page,
      sheet: sourceSheet,
      kind,
      level,
    };
  }
  const unclassifiedFixtureCount = countUnclassifiedFixtureTagsOnPage(phrases, {
    legendBoxes,
    blob,
  });
  return {
    measurements,
    details,
    kind,
    level,
    page,
    sheet: sourceSheet,
    unclassifiedFixtureCount,
  };
}

function countUnclassifiedFixtureTagsOnPage(phrases, { legendBoxes, blob } = {}) {
  if (!LIGHTING_OR_ELECTRICAL_PLAN_RE.test(String(blob || ''))) return 0;
  const hits = [];
  for (const phrase of Array.isArray(phrases) ? phrases : []) {
    const str = String(phrase?.str || '').trim();
    if (!str || phraseLooksLikeNonInstance(str)) continue;
    if (isInsideLegendRegion(phrase, legendBoxes)) continue;
    if (isMappedElectricalInstanceTag(str)) continue;
    const compact = str.replace(/\s+/g, '');
    if (!OTHER_FIXTURE_TAG_RE.test(compact)) continue;
    hits.push({
      x: Number(phrase.x) || 0,
      y: Number(phrase.y) || 0,
      count: 1,
      str,
    });
  }
  const count = instanceCountFromTagHits(hits);
  return count >= 2 ? count : 0;
}

function normalizeSheetId(sheet) {
  return String(sheet || '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function shouldCollapseDuplicateFixtureViews(a, b) {
  if (a?.level && b?.level && a.level !== 'unknown' && b.level !== 'unknown' && a.level !== b.level) {
    return false;
  }
  const sheetA = normalizeSheetId(a?.sheet);
  const sheetB = normalizeSheetId(b?.sheet);
  if (sheetA && sheetB && sheetA === sheetB) return true;
  if (a?.level && a.level !== 'unknown' && a.level === b?.level) {
    const kinds = new Set([a.kind, b.kind]);
    if (kinds.has('rcp') && (kinds.has('lighting') || kinds.has('floor') || kinds.has('other'))) {
      return true;
    }
  }
  return false;
}

function sumCollapsingDuplicateFixtureViews(pages) {
  const groups = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    const existing = groups.find(group => group.some(member => shouldCollapseDuplicateFixtureViews(member, page)));
    if (existing) existing.push(page);
    else groups.push([page]);
  }
  return groups.reduce((sum, group) => sum + Math.max(...group.map(page => Number(page.count) || 0)), 0);
}

function aggregateElectricalInstanceTagCounts(pageResults) {
  const byKey = {};
  for (const spec of ELECTRICAL_INSTANCE_TAG_SPECS) {
    const pages = (Array.isArray(pageResults) ? pageResults : [])
      .map(result => ({
        ...result,
        count: Number(result?.measurements?.[spec.key]) || 0,
        kind: result?.kind || result?.details?.[spec.key]?.kind,
        level: result?.level || result?.details?.[spec.key]?.level,
        sheet: result?.sheet || result?.details?.[spec.key]?.sheet,
        page: result?.page || result?.details?.[spec.key]?.page,
      }))
      .filter(result => result.count >= 2);
    if (!pages.length) continue;
    const total = sumCollapsingDuplicateFixtureViews(pages);
    if (total < 2) continue;
    byKey[spec.key] = {
      value: total,
      tag: spec.id,
      sourceType: 'pdf_text_instance_tags',
      sheets: pages.map(page => ({
        sheet: page.sheet || null,
        page: page.page || null,
        count: page.count,
        kind: page.kind || 'other',
        level: page.level || 'unknown',
      })),
    };
  }
  const unclassifiedPages = (Array.isArray(pageResults) ? pageResults : [])
    .map(result => ({
      ...result,
      count: Number(result?.unclassifiedFixtureCount) || 0,
    }))
    .filter(result => result.count >= 2);
  const unclassifiedFixtureCount = unclassifiedPages.length ? sumCollapsingDuplicateFixtureViews(unclassifiedPages) : 0;
  return {
    measurements: Object.fromEntries(Object.entries(byKey).map(([key, entry]) => [key, entry.value])),
    byKey,
    unclassifiedFixtureCount: unclassifiedFixtureCount >= 2 ? unclassifiedFixtureCount : 0,
  };
}

function scorePaintingRelevantPage(text) {
  const blob = String(text || '');
  if (!blob.trim()) return { score: 0, reasons: [] };
  const hasPaintSignal = PAINTING_PAGE_SIGNALS.some(signal => signal.re.test(blob));
  if (PAINTING_IRRELEVANT_PAGE_RE.test(blob) && !hasPaintSignal) {
    return { score: 0, reasons: [] };
  }
  let score = 0;
  const reasons = [];
  for (const signal of PAINTING_PAGE_SIGNALS) {
    if (signal.re.test(blob)) {
      score += signal.score;
      reasons.push(signal.label);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

function scoreElectricalRelevantPage(text) {
  const blob = String(text || '');
  if (!blob.trim()) return { score: 0, reasons: [] };
  let score = 0;
  const reasons = [];
  for (const signal of ELECTRICAL_PAGE_SIGNALS) {
    if (signal.re.test(blob)) {
      score += signal.score;
      reasons.push(signal.label);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

function scorePlumbingRelevantPage(text) {
  const blob = String(text || '');
  if (!blob.trim()) return { score: 0, reasons: [] };
  let score = 0;
  const reasons = [];
  for (const signal of PLUMBING_PAGE_SIGNALS) {
    if (signal.re.test(blob)) {
      score += signal.score;
      reasons.push(signal.label);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
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
      p.str.replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/”|“|"/g, '"').replace(/×/g, 'x')
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

function loadNodeCanvas() {
  try {
    return require('@napi-rs/canvas');
  } catch (err) {
    return null;
  }
}

class NodeCanvasFactory {
  constructor(createCanvas) {
    this.createCanvas = createCanvas;
  }

  create(width, height) {
    const canvas = this.createCanvas(Math.ceil(width), Math.ceil(height));
    const context = canvas.getContext('2d');
    fillElectricalSheetBackground(context, width, height);
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = Math.ceil(width);
    canvasAndContext.canvas.height = Math.ceil(height);
    fillElectricalSheetBackground(canvasAndContext.context, width, height);
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function fillElectricalSheetBackground(context, width, height) {
  if (!context) return;
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, Math.ceil(width), Math.ceil(height));
  context.restore();
}

function encodeJpeg(canvas, quality = 82) {
  if (typeof canvas.encodeSync === 'function') {
    return canvas.encodeSync('jpeg', quality);
  }
  if (typeof canvas.encode === 'function') {
    return canvas.encode('jpeg', quality);
  }
  if (typeof canvas.toBuffer === 'function') {
    return canvas.toBuffer('image/jpeg', quality);
  }
  throw new Error('Canvas JPEG encode is unavailable');
}

/**
 * Rasterize Electrical sheets so vision can count symbols. The full PDF file
 * pass reads architectural text and skips tiny E-sheet glyphs.
 */
async function renderPlumbingPlanPages(pdfBuffers, plumbingPages, options = {}) {
  const images = await renderElectricalPlanPages(pdfBuffers, plumbingPages, options);
  return images.map(image => ({
    ...image,
    filename: String(image.filename || '').replace(/^electrical-page-/, 'plumbing-page-'),
  }));
}

async function renderElectricalPlanPages(pdfBuffers, electricalPages, options = {}) {
  const canvasLib = loadNodeCanvas();
  if (!canvasLib?.createCanvas) {
    console.warn('Electrical sheet raster skipped: @napi-rs/canvas is not installed');
    return [];
  }
  const pageNumbers = [
    ...new Set(
      (Array.isArray(electricalPages) ? electricalPages : [])
        .map(page => Number(page?.page))
        .filter(page => Number.isInteger(page) && page > 0)
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, options.maxPages || 12);
  const buffers = (Array.isArray(pdfBuffers) ? pdfBuffers : [pdfBuffers]).filter(Boolean);
  if (!pageNumbers.length || !buffers.length) return [];

  const pdfjs = await loadPdfJs();
  const canvasFactory = new NodeCanvasFactory(canvasLib.createCanvas);
  const images = [];
  const maxDim = options.maxDimension || 4200;
  const quality = options.quality || 82;

  for (const buffer of buffers) {
    if (images.length >= pageNumbers.length) break;
    let doc;
    try {
      doc = await pdfjs.getDocument({
        data: toUint8Array(buffer),
        useSystemFonts: true,
        isEvalSupported: false,
        disableFontFace: false,
        canvasFactory,
      }).promise;
    } catch (err) {
      console.warn('Electrical sheet raster open failed:', err?.message || err);
      continue;
    }
    for (const pageNumber of pageNumbers) {
      if (pageNumber > doc.numPages) continue;
      try {
        const page = await doc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2.4, maxDim / Math.max(base.width, base.height, 1));
        const viewport = page.getViewport({ scale });
        const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
        fillElectricalSheetBackground(canvasAndContext.context, viewport.width, viewport.height);
        await page.render({
          canvas: canvasAndContext.canvas,
          canvasContext: canvasAndContext.context,
          viewport,
          background: '#FFFFFF',
        }).promise;
        const jpeg = await encodeJpeg(canvasAndContext.canvas, quality);
        canvasFactory.destroy(canvasAndContext);
        const bytes = Buffer.isBuffer(jpeg) ? jpeg : Buffer.from(jpeg);
        images.push({
          page: pageNumber,
          mimeType: 'image/jpeg',
          base64: bytes.toString('base64'),
          filename: `electrical-page-${pageNumber}.jpg`,
          byteLength: bytes.length,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
        });
      } catch (err) {
        console.warn(`Electrical sheet raster failed for page ${pageNumber}:`, err?.message || err);
      }
    }
  }
  return images;
}

function toUint8Array(buffer) {
  const src = Buffer.isBuffer(buffer) ? buffer : buffer instanceof Uint8Array ? buffer : Buffer.from(buffer || []);
  const copy = new Uint8Array(src.length);
  copy.set(src);
  return copy;
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
      .map(it => {
        const t = it.transform || [1, 0, 0, 1, 0, 0];
        return {
          str: collapseDoubledGlyphs(it.str),
          x: t[4],
          y: t[5],
          w: it.width || 0,
        };
      })
      .filter(it => it.str && String(it.str).trim());
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
  const paintingRelevantPages = [];
  const electricalRelevantPages = [];
  const plumbingRelevantPages = [];
  const electricalInstanceTagPages = [];
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
      const pageText = phrases.map(p => p.str).join(' ');
      const pageNumber = page.pageIndex + 1;
      const paintingPage = scorePaintingRelevantPage(pageText);
      if (paintingPage.score > 0) {
        paintingRelevantPages.push({
          page: pageNumber,
          score: paintingPage.score,
          reasons: paintingPage.reasons,
        });
      }
      const electricalPage = scoreElectricalRelevantPage(pageText);
      if (electricalPage.score > 0) {
        electricalRelevantPages.push({
          page: pageNumber,
          score: electricalPage.score,
          reasons: electricalPage.reasons,
        });
      }
      const plumbingPage = scorePlumbingRelevantPage(pageText);
      if (plumbingPage.score > 0) {
        plumbingRelevantPages.push({
          page: pageNumber,
          score: plumbingPage.score,
          reasons: plumbingPage.reasons,
        });
      }
      const instanceTagPage = countElectricalInstanceTagsOnPage(phrases, {
        pageText,
        page: pageNumber,
        items: page.items,
      });
      if (Object.keys(instanceTagPage.measurements || {}).length) {
        electricalInstanceTagPages.push(instanceTagPage);
        const existingElectrical = electricalRelevantPages.find(entry => entry.page === pageNumber);
        const tagReason = 'fixture instance tags';
        if (existingElectrical) {
          existingElectrical.score = Math.max(existingElectrical.score, 9);
          existingElectrical.reasons = [...new Set([...(existingElectrical.reasons || []), tagReason])];
        } else {
          electricalRelevantPages.push({
            page: pageNumber,
            score: 9,
            reasons: [tagReason],
          });
        }
      }
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
        const nextVal = parsedFacts.planFacts[key];
        if (nextVal == null) continue;
        if (scalarFacts[key] == null) {
          scalarFacts[key] = nextVal;
          continue;
        }
        // Prefer per-story plate (~10.2') over cumulative upper plate (~20.5').
        if (key === 'plateHeightFt' && Number(scalarFacts[key]) > 14 && Number(nextVal) >= 7 && Number(nextVal) <= 14) {
          scalarFacts[key] = nextVal;
          if (parsedFacts.planFacts.fieldEvidence?.plateHeightFt) {
            fieldEvidence.plateHeightFt = parsedFacts.planFacts.fieldEvidence.plateHeightFt;
          }
        }
      }

      const kind = classifyPage(phrases, page.pageIndex);
      if (kind === 'skip' || kind === 'foundation' || kind === 'cover') continue;
      if (kind !== 'floor' && kind !== 'other') continue;
      // Only pair rooms on floor-like pages (or unknown pages that have many L×W labels)
      const dimCount = phrases.filter(p => parseDimensionString(p.str.replace(/\s+/g, ''))).length;
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
  ].filter(value => value != null);
  if (explicitFloors.length) {
    scalarFacts.storyCount = explicitFloors.length;
    const evidence = [
      fieldEvidence['buildingAreas.mainFloorLivingSqft'],
      fieldEvidence['buildingAreas.upstairsLivingSqft'],
    ]
      .filter(Boolean)
      .flatMap(fact => fact.evidence || []);
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
    paintingRelevantPages: paintingRelevantPages.sort((a, b) => b.score - a.score).slice(0, 12),
    electricalRelevantPages: expandElectricalRelevantPages(electricalRelevantPages, pageCount)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12),
    plumbingRelevantPages: expandPlumbingRelevantPages(plumbingRelevantPages, pageCount)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12),
    electricalInstanceTags: aggregateElectricalInstanceTagCounts(electricalInstanceTagPages),
    pageCount,
  };
}

function formatPdfEvidenceForVision(pdfTakeoff, options = {}) {
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
  const scalars = scalarKeys.filter(key => facts[key] != null);
  if (scalars.length) {
    lines.push(
      'PDF text layer — labeled plan facts for living SF / stories / plate-or-wall height / perimeter (prefer these for GROSS wall area; do not invent):'
    );
    for (const key of scalars) lines.push(`- ${key}: ${facts[key]}`);
    lines.push(
      'Opening deductions are almost never in the PDF text layer. Still take off every elevation: sum window/door opening SF and garage-door opening SF from labeled dimensions or count×size callouts into measurements.stuccoWindowDoorOpeningSqft / stuccoGarageOpeningSqft (or elevationFaces.*.windowDoorOpeningsSqft / garageOpeningsSqft). Do not leave openings blank when elevations show dimensioned openings.'
    );
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
  const tradeKey = String(options.tradeKey || '').toLowerCase();
  const paintingPages = Array.isArray(pdfTakeoff.paintingRelevantPages) ? pdfTakeoff.paintingRelevantPages : [];
  if (tradeKey === 'painting') {
    lines.push(
      'Painting-relevant sheets are floor plans, RCPs, finish schedules, door schedules, interior/exterior elevations, and millwork — not only sheets titled Paint. Calculate paint quantities from those sheets when geometry is explicit.'
    );
    if (paintingPages.length) {
      lines.push('PDF text layer — pages that look useful for a Painting takeoff:');
      for (const page of paintingPages.slice(0, 8)) {
        lines.push(`- page ${page.page}: ${Array.isArray(page.reasons) ? page.reasons.join(', ') : 'plan geometry'}`);
      }
    }
  }
  if (tradeKey === 'plumbing') {
    const plumbingPages = Array.isArray(pdfTakeoff.plumbingRelevantPages) ? pdfTakeoff.plumbingRelevantPages : [];
    lines.push(
      'Plumbing-relevant sheets are dedicated P sheets, fixture schedules, riser/isometric diagrams, floor plans with fixture symbols, and site/utility plans. Priority: P sheets > fixture schedules > architectural floor plans > site plans. Count fixture symbols and schedules before inferring underground LF from architectural sheets.'
    );
    if (plumbingPages.length) {
      lines.push('PDF text layer — pages that look useful for a Plumbing takeoff:');
      for (const page of plumbingPages.slice(0, 8)) {
        lines.push(`- page ${page.page}: ${Array.isArray(page.reasons) ? page.reasons.join(', ') : 'plumbing plan'}`);
      }
    }
  }
  const electricalPages = Array.isArray(pdfTakeoff.electricalRelevantPages) ? pdfTakeoff.electricalRelevantPages : [];
  if (tradeKey === 'electrical') {
    lines.push(
      'Electrical-relevant sheets are electrical plans (E sheets), panel schedules, device legends, and lighting legends. Count symbols on those sheets. Sum main-level and upper-level lighting plans (for example A-10 + A-11). Count every ceiling-fan symbol, including covered patio, bedrooms, and upstairs living. Lighting fixtures that are not recessed/canless and not ceiling fans still count — if there is no symbol legend, report them as unclassifiedFixtureCount instead of guessing pendant/vanity/garage. Do not invent homeruns, conduit LF, trench LF, or rough/trim packages from device counts.'
    );
    if (electricalPages.length) {
      lines.push('PDF text layer — pages that look useful for an Electrical takeoff:');
      for (const page of electricalPages.slice(0, 8)) {
        lines.push(`- page ${page.page}: ${Array.isArray(page.reasons) ? page.reasons.join(', ') : 'electrical plan'}`);
      }
    }
    const instanceTags = pdfTakeoff.electricalInstanceTags?.byKey || {};
    const instanceLines = Object.entries(instanceTags)
      .filter(([, entry]) => Number(entry?.value) > 0)
      .map(([key, entry]) => {
        const sheets = Array.isArray(entry.sheets)
          ? entry.sheets
              .map(sheet => {
                const where = [sheet.sheet ? `sheet ${sheet.sheet}` : null, sheet.page ? `page ${sheet.page}` : null]
                  .filter(Boolean)
                  .join(' ');
                return `${where || 'plan'}: ${sheet.count} ${entry.tag}`.trim();
              })
              .join('; ')
          : '';
        return `- ${key}: ${entry.value} from ${entry.tag} instance tags${sheets ? ` (${sheets})` : ''}`;
      });
    if (instanceLines.length) {
      lines.push(
        'PDF text layer — fixture instance tags (each repeated tag is one fixture on the drawing; ignore legend/schedule/note entries):'
      );
      lines.push(...instanceLines);
      lines.push(
        'Prefer these instance-tag counts over symbol estimates when they disagree. Do not treat a legend definition as a quantity.'
      );
    }
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
  scorePaintingRelevantPage,
  scoreElectricalRelevantPage,
  scorePlumbingRelevantPage,
  expandElectricalRelevantPages,
  expandPlumbingRelevantPages,
  ELECTRICAL_INSTANCE_TAG_SPECS,
  countElectricalInstanceTagsOnPage,
  aggregateElectricalInstanceTagCounts,
  detectElectricalSheetKind,
  detectElectricalPlanLevel,
  shouldCollapseDuplicateFixtureViews,
  renderElectricalPlanPages,
  renderPlumbingPlanPages,
  fillElectricalSheetBackground,
  toUint8Array,
  feetInchesToDecimal,
};
