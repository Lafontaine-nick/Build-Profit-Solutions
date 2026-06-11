/**
 * Client mirror of backend scopeAllowanceParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';

const UNIT_RATE_AFTER_RE = /^\s*(?:\/|per)\s*(?:sq\.?\s*ft|sqft|sf|lf|ln|hr|hour|each|ea)\b/i;

type AllowanceMatcher = {
  id: string;
  match: RegExp;
  exclude?: RegExp;
  unit: string;
};

const ITEM_ALLOWANCE_MATCHERS: AllowanceMatcher[] = [
  {
    id: 'appliances',
    match: /\b(appliance\s+install|install\s+appliances?|appliance\s+allowance|appliance\s+hookup|reconnect\s+appliances?)\b/i,
    unit: 'allowance',
  },
  {
    id: 'appliance_removal',
    match: /\b(remove|disconnect|haul).*\b(appliance|ridge|dishwasher|range|refrigerator)\b|\b(appliance|ridge|dishwasher)\b.*\b(remove|disconnect|haul)\b/i,
    unit: 'allowance',
  },
  {
    id: 'cabinets',
    match: /\b(cabinets?)\b/i,
    exclude: /\b(demo|demolition|tear[\s-]?out|haul[\s-]?off|remove|removal)\b/i,
    unit: 'allowance',
  },
  {
    id: 'countertops',
    match: /\b(countertops?|quartz|granite)\b/i,
    exclude: /\b(cabinets?|demo|demolition|tear[\s-]?out)\b/i,
    unit: 'allowance',
  },
  {
    id: 'countertops',
    match: /\bcounters\b/i,
    exclude: /\b(cabinets?|demo|demolition|tear[\s-]?out)\b/i,
    unit: 'allowance',
  },
  {
    id: 'backsplash',
    match: /\b(backsplash|back\s*splash)\b/i,
    exclude: /\b(demo|demolition|material\s+\$|labor\s+\$)\b/i,
    unit: 'allowance',
  },
  {
    id: 'vanity',
    match: /\bvanity\b/i,
    exclude: /\b(demo|demolition|remove)\b/i,
    unit: 'allowance',
  },
  {
    id: 'glass_door',
    match: /\b(shower\s+door|glass\s+shower)\b/i,
    unit: 'allowance',
  },
  {
    id: 'demo',
    match: /\b(demo|demolition|tear[\s-]?out|gut|haul[\s-]?off)\b/i,
    unit: 'lump_sum',
  },
  {
    id: 'cleanup',
    match: /\b(cleanup|disposal|dumpster|debris)\b/i,
    exclude: /\b(demo|demolition|tear[\s-]?out)\b/i,
    unit: 'lump_sum',
  },
  {
    id: 'permits',
    match: /\b(permit|inspection)\b/i,
    unit: 'allowance',
  },
  {
    id: 'paint',
    match: /\b(paint(?:ing)?|primer)\b/i,
    exclude: /\b(exterior|\/|per\s+sq)/i,
    unit: 'allowance',
  },
  {
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition|\/|per\s+sq)/i,
    unit: 'allowance',
  },
];

/** Keep compound labels intact (e.g. "cabinets and counters $28,629") — do not split on "and". */
function splitAllowanceClauses(text: string): string[] {
  return String(text || '')
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAmountToken(raw: string, kSuffix?: string): number | null {
  let n = Number(String(raw || '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kSuffix && /^k$/i.test(kSuffix)) n *= 1000;
  return n;
}

function extractTotalDollarAmounts(clause: string): number[] {
  const amounts: number[] = [];
  const text = String(clause || '');

  const dollarRe = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g;
  let m: RegExpExecArray | null;
  while ((m = dollarRe.exec(text)) !== null) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    if (UNIT_RATE_AFTER_RE.test(after)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  const lumpRe = /\b(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*lump\s*sum\b/gi;
  while ((m = lumpRe.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/\$/.test(before)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  const allowanceRe = /\ballowance\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/gi;
  while ((m = allowanceRe.exec(text)) !== null) {
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  return amounts;
}

function pickClauseTotalAmount(clause: string): number | null {
  const amounts = extractTotalDollarAmounts(clause);
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

function clauseMatchesMatcher(clause: string, matcher: AllowanceMatcher): boolean {
  if (!matcher.match.test(clause)) return false;
  if (matcher.exclude?.test(clause)) return false;
  return true;
}

export function parseScopeItemAllowancesFromNotes(
  notes: string,
  _ctx: { templateKey?: string; projectType?: string } = {}
): Record<string, ScopeItemQuantity> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  const clauses = splitAllowanceClauses(text);

  for (const clause of clauses) {
    const amount = pickClauseTotalAmount(clause);
    if (!amount) continue;

    for (const matcher of ITEM_ALLOWANCE_MATCHERS) {
      if (!clauseMatchesMatcher(clause, matcher)) continue;
      if (out[matcher.id]) break;
      out[matcher.id] = {
        quantity: amount,
        unit: matcher.unit,
        quantitySource: 'notes',
      };
      break;
    }
  }

  return out;
}
