/**
 * Trade-aware scope splitting: when notes describe multiple tasks but the LLM
 * merges them into generic rooms ("Bathroom remodel", "Flooring"), expand into
 * separate scope packages so saved pricing / templates can match each task.
 */

const { extractScopeQuantitiesForPackage, splitNoteClauses } = require('./estimateDraftQuantityPrice');

function notesHaveExplicitLinePrices(notes) {
  const text = String(notes || '');
  return (
    /\$\s*[\d,]+(?:\.\d{2})?\b/.test(text) &&
    /\b(roughly|around|let's say|lets say|labor|material|cabinet|countertop|allowance|budget|sink|backsplash|vanity|shower)\b/i.test(
      text
    )
  );
}

function roomsHaveCapturedPricing(rooms) {
  return (rooms || []).some(
    (r) =>
      (r.price != null && r.price > 0) ||
      (r.knownSubtotal != null && r.knownSubtotal > 0) ||
      (Array.isArray(r.pricingItems) && r.pricingItems.length > 0) ||
      r.priceProvidedByUser
  );
}

function notesHasMatchingSegment(notes, testFn) {
  const segments = splitNoteClauses(String(notes || ''));
  return segments.some((seg) => testFn(seg.toLowerCase()));
}

/** @typedef {{ id: string, trade: string, name: string, scopeHint: string, detect: (n: string) => boolean, roomMatch: (n: string) => boolean }} ScopeTask */

/** @type {ScopeTask[]} */
const SCOPE_TASKS = [
  // —— Flooring ——
  {
    id: 'tile_demo',
    trade: 'flooring',
    name: 'Tile Removal',
    scopeHint: 'tile removal',
    detect: (n) => /\btile\b/.test(n) && /\b(demo|demolition|removal|tear[\s-]?out)\b/.test(n),
    roomMatch: (n) => /\btile\b/.test(n) && /\b(demo|demolition|removal|tear[\s-]?out)\b/.test(n),
  },
  {
    id: 'tile_install',
    trade: 'flooring',
    name: 'Tile Installation',
    scopeHint: 'tile installation',
    detect: (n) =>
      notesHasMatchingSegment(
        n,
        (seg) =>
          /\btile\b/.test(seg) &&
          /\b(install|installation|installing)\b/.test(seg) &&
          !/\b(demo|demolition|removal|tear[\s-]?out)\b/.test(seg)
      ),
    roomMatch: (n) => /\btile\b/.test(n) && /\binstall/.test(n) && !/\bdemo\b/.test(n),
  },
  {
    id: 'laminate_install',
    trade: 'flooring',
    name: 'Laminate Flooring Installation',
    scopeHint: 'laminate flooring installation',
    detect: (n) =>
      /\b(laminate|lvp|vinyl)\b/.test(n) &&
      (/\b(install|installation|flooring|floor)\b/.test(n) || /\blaminate\s+flooring\b/.test(n)),
    roomMatch: (n) => /laminate|lvp|vinyl/.test(n),
  },
  {
    id: 'baseboard_install',
    trade: 'flooring',
    name: 'Baseboard Installation',
    scopeHint: 'baseboard installation',
    detect: (n) => /\b(baseboard|trim)\b/.test(n) && /\b(lf|linear\s*feet|ln\.?\s*ft|install)\b/.test(n),
    roomMatch: (n) => /baseboard|trim/.test(n) && !/paint/.test(n),
  },
  // —— Bathroom ——
  {
    id: 'bath_demo',
    trade: 'bathroom',
    name: 'Bathroom Demo',
    scopeHint: 'bathroom demo and tear-out',
    detect: (n) =>
      /\b(bath|bathroom|shower|vanity|toilet|tub)\b/.test(n) &&
      /\b(demo|demolition|gut|tear[\s-]?out|removal|rip[\s-]?out)\b/.test(n),
    roomMatch: (n) => /\b(bath|bathroom)\b/.test(n) && /\b(demo|gut|tear|removal)\b/.test(n),
  },
  {
    id: 'shower_tile',
    trade: 'bathroom',
    name: 'Shower Tile Installation',
    scopeHint: 'shower tile installation',
    detect: (n) => /\b(shower|tub surround|tub)\b/.test(n) && /\b(tile|install|installation|surround)\b/.test(n),
    roomMatch: (n) => /\bshower\b/.test(n) && /\btile\b/.test(n),
  },
  {
    id: 'vanity_install',
    trade: 'bathroom',
    name: 'Vanity Installation',
    scopeHint: 'vanity installation',
    detect: (n) => /\bvanity\b/.test(n) && /\b(install|installation|new|replace|double)\b/.test(n),
    roomMatch: (n) => /\bvanity\b/.test(n),
  },
  {
    id: 'toilet_install',
    trade: 'bathroom',
    name: 'Toilet Installation',
    scopeHint: 'toilet installation',
    detect: (n) => /\btoilet\b/.test(n) && /\b(install|installation|new|replace|set)\b/.test(n),
    roomMatch: (n) => /\btoilet\b/.test(n),
  },
  {
    id: 'bath_plumbing',
    trade: 'bathroom',
    name: 'Plumbing (Bathroom)',
    scopeHint: 'bathroom plumbing rough-in or finish',
    detect: (n) =>
      /\b(plumb|plumbing|rough[\s-]?in|faucet|drain|valve|supply line)\b/.test(n) &&
      /\b(bath|bathroom|shower|vanity|toilet)\b/.test(n),
    roomMatch: (n) => /\bplumb/.test(n) && /\b(bath|bathroom|shower|vanity)\b/.test(n),
  },
  // —— Kitchen ——
  {
    id: 'kitchen_demo',
    trade: 'kitchen',
    name: 'Kitchen Demo',
    scopeHint: 'kitchen demo and tear-out',
    detect: (n) => /\bkitchen\b/.test(n) && /\b(demo|demolition|gut|tear[\s-]?out|removal)\b/.test(n),
    roomMatch: (n) => /\bkitchen\b/.test(n) && /\b(demo|gut|tear|removal)\b/.test(n),
  },
  {
    id: 'cabinet_install',
    trade: 'kitchen',
    name: 'Cabinet Installation',
    scopeHint: 'cabinet installation',
    detect: (n) => /\b(cabinet|cabinets)\b/.test(n) && /\b(install|installation|new|replace|set)\b/.test(n),
    roomMatch: (n) => /\bcabinet/.test(n),
  },
  {
    id: 'countertop_install',
    trade: 'kitchen',
    name: 'Countertop Installation',
    scopeHint: 'countertop installation',
    detect: (n) =>
      /\b(countertop|counter\s*top|quartz|granite|stone top)\b/.test(n) &&
      /\b(install|installation|template|fabricat)\b/.test(n),
    roomMatch: (n) => /countertop|counter\s*top|quartz|granite/.test(n),
  },
  {
    id: 'backsplash_install',
    trade: 'kitchen',
    name: 'Backsplash Installation',
    scopeHint: 'backsplash installation',
    detect: (n) => /\bbacksplash\b/.test(n) && /\b(install|installation|tile)\b/.test(n),
    roomMatch: (n) => /\bbacksplash\b/.test(n),
  },
  // —— Painting ——
  {
    id: 'interior_paint',
    trade: 'painting',
    name: 'Interior Painting',
    scopeHint: 'interior painting',
    detect: (n) =>
      /\b(paint|painting|primer|repaint)\b/.test(n) &&
      !/\b(exterior|outside|facade)\b/.test(n) &&
      (/\b(interior|walls?|rooms?|sqft|sq\s*ft|ceiling)\b/.test(n) || !/\b(cabinet|trim only)\b/.test(n)),
    roomMatch: (n) => /\bpaint/.test(n) && !/\bexterior\b/.test(n),
  },
  {
    id: 'exterior_paint',
    trade: 'painting',
    name: 'Exterior Painting',
    scopeHint: 'exterior painting',
    detect: (n) => /\b(exterior|outside|facade|siding)\b/.test(n) && /\b(paint|painting|coat)\b/.test(n),
    roomMatch: (n) => /\b(exterior|outside)\b/.test(n) && /\bpaint/.test(n),
  },
];

function detectScopeTasksFromNotes(notes) {
  const n = String(notes || '').toLowerCase();
  const seen = new Set();
  const tasks = [];
  for (const task of SCOPE_TASKS) {
    if (task.detect(n) && !seen.has(task.id)) {
      seen.add(task.id);
      tasks.push(task);
    }
  }
  if (tasks.some((t) => t.id === 'baseboard_install')) {
    return tasks.filter((t) => t.id !== 'interior_paint');
  }
  return tasks;
}

function roomsMissingDetectedTasks(rooms, tasks) {
  return tasks.some(
    (task) => !rooms.some((r) => task.roomMatch(String(r.name || '').toLowerCase()))
  );
}

function roomsAlreadyFullySplit(rooms, tasks) {
  if (!rooms?.length || !tasks.length) return false;
  for (const task of tasks) {
    const hasRoom = rooms.some((r) => task.roomMatch(String(r.name || '').toLowerCase()));
    if (!hasRoom) return false;
  }
  return true;
}

function buildScopeForTask(task, notes) {
  const quantities = extractScopeQuantitiesForPackage(task.name, '', notes);
  if (quantities.length > 0) {
    return quantities
      .map((q) => `${q.quantity.toLocaleString()} ${q.unit} ${task.scopeHint}`)
      .join('; ');
  }
  return task.scopeHint;
}

function emptyScopeRoom(task, notes) {
  return {
    name: task.name,
    scope: buildScopeForTask(task, notes),
    price: null,
    laborPrice: null,
    materialPrice: null,
    priceIncludesLaborAndMaterials: false,
    priceProvidedByUser: false,
    pricingItems: [],
    missingPriceItems: [],
  };
}

/**
 * Expand merged scope rooms into task-specific packages.
 * @param {object[]} rooms
 * @param {string} originalNotes
 * @param {{ aggressive?: boolean }} [options] - aggressive:true for pricing engine; false for draft parse (single-room only)
 */
function expandJobScopeRooms(rooms, originalNotes, options = {}) {
  const notes = String(originalNotes || '').trim();
  if (!notes || !Array.isArray(rooms)) return rooms;

  const tasks = detectScopeTasksFromNotes(notes);
  if (tasks.length < 2) return rooms;
  if (roomsHaveCapturedPricing(rooms)) return rooms;
  if (notesHaveExplicitLinePrices(notes)) return rooms;
  if (roomsAlreadyFullySplit(rooms, tasks) && !roomsMissingDetectedTasks(rooms, tasks)) {
    return rooms;
  }

  const aggressive = options.aggressive === true;
  if (!aggressive && rooms.length > 1 && !roomsMissingDetectedTasks(rooms, tasks)) {
    return rooms;
  }

  return tasks.map((task) => emptyScopeRoom(task, notes));
}

/** @deprecated Use expandJobScopeRooms */
function expandFloorJobRooms(rooms, originalNotes, options = {}) {
  return expandJobScopeRooms(rooms, originalNotes, options);
}

function detectFloorTasksFromNotes(notes) {
  return detectScopeTasksFromNotes(notes).filter((t) => t.trade === 'flooring');
}

module.exports = {
  SCOPE_TASKS,
  detectScopeTasksFromNotes,
  detectFloorTasksFromNotes,
  roomsAlreadyFullySplit,
  expandJobScopeRooms,
  expandFloorJobRooms,
  buildScopeForTask,
};
