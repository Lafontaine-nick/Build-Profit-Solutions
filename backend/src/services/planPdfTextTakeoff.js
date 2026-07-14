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
  const t = String(text || '').replace(/\s+/g, ' ');
  const num = (re) => {
    const m = t.match(re);
    if (!m) return null;
    const v = Number(String(m[1]).replace(/,/g, ''));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null;
  };
  const buildingAreas = {};
  const living =
    num(/Main\s*Living\s*Area\s*:\s*([\d,]+)\s*Sq\.?\s*Ft/i) ||
    num(/Total\s*Living\s*(?:Area)?\s*:?\s*([\d,]+)\s*Sq\.?\s*Ft/i) ||
    num(/Living\s*Area\s*:?\s*([\d,]+)\s*Sq\.?\s*Ft/i);
  if (living != null) buildingAreas.totalLivingSqft = living;

  const garage = num(/Garages?\s*:\s*([\d,]+)\s*Sq\.?\s*Ft/i) || num(/Garage\s*Area\s*:?\s*([\d,]+)\s*Sq\.?\s*Ft/i);
  if (garage != null) buildingAreas.garageSqft = garage;

  const patio =
    num(/Covered\s*Patio\s*:\s*([\d,]+)\s*Sq\.?\s*Ft/i) ||
    num(/Covered\s*Porch\s*:\s*([\d,]+)\s*Sq\.?\s*Ft/i);
  if (patio != null) buildingAreas.coveredPatioSqft = patio;

  const roofDeck = num(/Roof\s*Deck\s*:\s*([\d,]+)\s*Sq\.?\s*Ft/i);
  if (roofDeck != null) buildingAreas.roofDeckSqft = roofDeck;

  return buildingAreas;
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

function extractRoomsFromPhrases(phrases) {
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
      const schedule = parseScheduleFromText(pageText);
      for (const [k, v] of Object.entries(schedule)) {
        if (buildingAreas[k] == null) buildingAreas[k] = v;
      }

      const kind = classifyPage(phrases, page.pageIndex);
      if (kind === 'skip' || kind === 'foundation' || kind === 'cover') continue;
      if (kind !== 'floor' && kind !== 'other') continue;
      // Only pair rooms on floor-like pages (or unknown pages that have many L×W labels)
      const dimCount = phrases.filter((p) => parseDimensionString(p.str.replace(/\s+/g, ''))).length;
      if (kind === 'other' && dimCount < 3) continue;

      const rooms = extractRoomsFromPhrases(phrases);
      allRooms.push(...rooms);
      if (rooms.length) {
        assumptions.push(`Room dimensions from PDF text on page ${page.pageIndex + 1}`);
      }
    }
  }

  if (Object.keys(buildingAreas).length) {
    assumptions.unshift('Building Areas from PDF text layer (schedule)');
  }

  return {
    buildingAreas,
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
  const rooms = pdfTakeoff.rooms || [];
  if (rooms.length) {
    lines.push('PDF text layer — room L×W already paired spatially (prefer these; do not swap labels):');
    for (const r of rooms.slice(0, 40)) {
      lines.push(
        `- ${r.name}: ${r.lengthFt}' × ${r.widthFt}' = ${r.areaSqft} sqft`
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
  clusterPhrases,
  extractRoomsFromPhrases,
  dedupeRoomsByName,
  extractPlanTakeoffFromPdfBuffers,
  formatPdfEvidenceForVision,
  feetInchesToDecimal,
};
