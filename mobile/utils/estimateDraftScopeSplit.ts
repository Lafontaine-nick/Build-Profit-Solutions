/**
 * Trade-aware scope splitting (mobile) — mirrors backend estimateDraftScopeSplit.js
 */
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

export type ScopeTask = {
  id: string;
  trade: string;
  name: string;
  scopeHint: string;
  detect: (n: string) => boolean;
  roomMatch: (n: string) => boolean;
};

/** Break run-on notes on "and" / qty boundaries — mirrors backend splitNoteClauses. */
function splitNoteClauses(text: string): string[] {
  const sentences = String(text || '')
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const clauses: string[] = [];
  for (const sentence of sentences) {
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else clauses.push(sentence);
  }
  return clauses;
}

function notesHasMatchingSegment(notes: string, testFn: (seg: string) => boolean): boolean {
  return splitNoteClauses(notes).some((seg) => testFn(seg.toLowerCase()));
}

const SCOPE_TASKS: ScopeTask[] = [
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
  {
    id: 'interior_paint',
    trade: 'painting',
    name: 'Interior Painting',
    scopeHint: 'interior painting',
    detect: (n) =>
      /\b(paint|painting|primer|repaint)\b/.test(n) &&
      !/\b(exterior|outside|facade)\b/.test(n),
    roomMatch: (n) => /\bpaint/.test(n) && !/\bexterior\b/.test(n),
  },
];

export function detectScopeTasksFromNotes(notes: string): ScopeTask[] {
  const n = notes.toLowerCase();
  const seen = new Set<string>();
  const tasks: ScopeTask[] = [];
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

function roomsMissingDetectedTasks(rooms: Array<{ name?: string }>, tasks: ScopeTask[]): boolean {
  return tasks.some(
    (task) => !rooms.some((r) => task.roomMatch(String(r.name || '').toLowerCase()))
  );
}

function roomsAlreadyFullySplit(rooms: Array<{ name?: string }>, tasks: ScopeTask[]): boolean {
  if (!rooms.length || !tasks.length) return false;
  for (const task of tasks) {
    if (!rooms.some((r) => task.roomMatch(String(r.name || '').toLowerCase()))) return false;
  }
  return true;
}

export function expandJobScopeDraft(draft: EstimateAiDraft, options: { aggressive?: boolean } = {}): EstimateAiDraft {
  const notes = String(draft.originalNotes || '').trim();
  if (!notes) return draft;

  // Keep scope packages built from the confirmed checklist — do not replace with note-only split.
  if (draft.scopeAssumptionsConfirmed && (draft.rooms?.length || draft.scopePackages?.length)) {
    return draft;
  }

  const tasks = detectScopeTasksFromNotes(notes);
  if (tasks.length < 2) return draft;

  const rooms = draft.rooms?.length
    ? draft.rooms
    : (draft.scopePackages || []).map((p) => ({ name: p.name, scope: p.scope }));

  if (roomsAlreadyFullySplit(rooms, tasks) && !roomsMissingDetectedTasks(rooms, tasks)) {
    return draft;
  }

  const aggressive = options.aggressive === true;
  if (!aggressive && rooms.length > 1 && !roomsMissingDetectedTasks(rooms, tasks)) {
    return draft;
  }

  const expandedRooms = tasks.map((task) => ({
    name: task.name,
    scope: task.scopeHint,
    price: null as number | null,
    laborPrice: null as number | null,
    materialPrice: null as number | null,
    priceIncludesLaborAndMaterials: false,
    priceProvidedByUser: false,
    pricingItems: [] as EstimateAiDraft['rooms'][0]['pricingItems'],
    missingPriceItems: [] as string[],
  }));

  return { ...draft, rooms: expandedRooms, scopePackages: undefined };
}
