/**
 * A note that states one material total and one labor total, with no unit,
 * prices the named work once. Per-card rates and named allowances stay on
 * their own cards. Removal cards the note did not price stay on national rates.
 */

import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import { parseScopeItemRatePricingFromNotes } from '@/utils/scopeRatePricingParser';

export type NoteMaterialLaborQuote = {
  material: number;
  labor: number;
  total: number;
};

const MONEY_AMOUNT = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const UNIT_TAIL =
  /^(?:\s*(?:dollars?)?)?(?:\s*(?:\/|per|a|@)\s*|\s+)(?:sq(?:uare)?(?:\.?\s*(?:ft|foot|feet))?|sqft|sf|lf|linear|cy|cubic|each|ea|hr|hours?|ton)/i;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function moneyAmount(raw: string, kilo: string | undefined): number | null {
  const amount = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return roundMoney(kilo ? amount * 1000 : amount);
}

function bareAmounts(text: string, kind: 'labor' | 'material'): number[] {
  const label = kind === 'labor' ? 'labou?r' : 'materials?';
  const patterns = [
    new RegExp(
      `\\b(?:${label})\\b[^\\n]{0,40}?\\$\\s*(${MONEY_AMOUNT})\\s*(k)?\\b`,
      'gi'
    ),
    new RegExp(
      `\\$\\s*(${MONEY_AMOUNT})\\s*(k)?\\s+(?:${label})\\b`,
      'gi'
    ),
  ];
  const found: number[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const tail = text.slice(match.index + match[0].length, match.index + match[0].length + 32);
      if (UNIT_TAIL.test(tail)) continue;
      const amount = moneyAmount(match[1], match[2]);
      if (amount == null) continue;
      found.push(amount);
    }
  }
  return found;
}

function pairInText(text: string): { material: number; labor: number } | null {
  const material = bareAmounts(text, 'material');
  const labor = bareAmounts(text, 'labor');
  if (material.length !== 1 || labor.length !== 1) return null;
  return { material: material[0], labor: labor[0] };
}

/** Job-level material and labor totals. Unit rates and a single unlabeled lump do not match. */
export function parseNoteMaterialLaborQuote(
  notes: string | null | undefined
): NoteMaterialLaborQuote | null {
  const text = String(notes || '').trim();
  if (!text) return null;
  const sentences = text
    .split(/[.\n]/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const pair = pairInText(sentence);
    if (!pair) continue;
    return {
      material: pair.material,
      labor: pair.labor,
      total: roundMoney(pair.material + pair.labor),
    };
  }
  const pair = pairInText(text);
  if (!pair) return null;
  return {
    material: pair.material,
    labor: pair.labor,
    total: roundMoney(pair.material + pair.labor),
  };
}

const NOTE_QUOTE_INSTALL_ITEMS: Array<{ id: string; match: RegExp }> = [
  { id: 'cabinets', match: /\bcabinets?\b|\bcabinetry\b|\bcabs\b/i },
  { id: 'countertops', match: /\bcountertops?\b|\bcounters?\b|\bquartz\b|\bgranite\b/i },
  { id: 'backsplash', match: /\bbacksplash\b|\bback\s*splash\b/i },
  { id: 'flooring', match: /\bflooring\b|\blvp\b|\bluxury\s+vinyl\b|\bvinyl\s+plank\b/i },
  { id: 'flooring_lvp', match: /\blvp\b|\bluxury\s+vinyl\b|\bvinyl\s+plank\b/i },
  { id: 'drywall', match: /\bdrywall\b|\bsheetrock\b/i },
  { id: 'interior_paint', match: /\bpaint(?:ing)?\b/i },
  { id: 'electrical', match: /\belectrical\b|\boutlets?\b|\brecessed\s+lights?\b/i },
  { id: 'lighting', match: /\blights?\b|\blighting\b|\brecessed\b/i },
];

function clauseLeavesWorkToOthers(clause: string, work: RegExp): boolean {
  return work.test(clause) && /\bby\s+others?\b/i.test(clause);
}

/** Install cards the note names. A partial group must not receive the whole job total. */
export function noteQuoteNamedInstallIds(notes: string | null | undefined): string[] {
  const text = String(notes || '');
  if (!text.trim()) return [];
  const clauses = text.split(/[.\n]/);
  return NOTE_QUOTE_INSTALL_ITEMS.filter(item => {
    if (!item.match.test(text)) return false;
    if (clauses.some(clause => clauseLeavesWorkToOthers(clause, item.match))) return false;
    return true;
  }).map(item => item.id);
}

/** Tear-out cards keep their own price. The note total belongs to the named install work. */
export function isNoteQuoteRemovalItem(itemId: string): boolean {
  const id = String(itemId || '').toLowerCase();
  return /(?:^|_)demo(?:$|_)|\bdemo\b|removal|tear[-_ ]?off|tearout/.test(id);
}

function noteAlreadyPricesIndividualCards(notes: string): boolean {
  const allowances = parseScopeItemAllowancesFromNotes(notes);
  if (Object.values(allowances).some(entry => Number(entry?.quantity) > 0)) return true;
  const rates = parseScopeItemRatePricingFromNotes(notes, {});
  return Object.keys(rates).length > 0;
}

/** True when the note's material and labor totals should replace per-card national prices. */
export function noteMaterialLaborQuoteSupersedes(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '').trim();
  if (!parseNoteMaterialLaborQuote(text)) return false;
  return !noteAlreadyPricesIndividualCards(text);
}

export function noteQuoteCoversItem(
  itemId: string,
  notes: string | null | undefined
): boolean {
  if (!noteMaterialLaborQuoteSupersedes(notes)) return false;
  return !isNoteQuoteRemovalItem(itemId);
}

function acceptanceDisablesNoteQuote(
  acceptance?: Record<string, { selectionStatus?: string | null } | null | undefined> | null
): boolean {
  if (!acceptance) return false;
  return Object.entries(acceptance).some(([itemId, row]) => {
    if (isNoteQuoteRemovalItem(itemId)) return false;
    const status = row?.selectionStatus;
    return status === 'manual_adjusted' || status === 'user_entered';
  });
}

/** The quote to show, or null when a typed card price has taken over. */
export function noteQuoteReplacesCardPrices(
  notes: string | null | undefined,
  acceptance?: Record<string, { selectionStatus?: string | null } | null | undefined> | null
): NoteMaterialLaborQuote | null {
  if (!noteMaterialLaborQuoteSupersedes(notes)) return null;
  if (acceptanceDisablesNoteQuote(acceptance)) return null;
  return parseNoteMaterialLaborQuote(notes);
}

export type NoteQuoteShare = {
  material: number;
  labor: number;
  total: number;
};

function allocateLeg(total: number, weights: number[]): number[] {
  const positive = weights.map(weight => (weight > 0 ? weight : 0));
  const sum = positive.reduce((totalWeight, weight) => totalWeight + weight, 0);
  if (!(total > 0) || !(sum > 0)) return weights.map(() => 0);
  const amounts = positive.map(weight => roundMoney((total * weight) / sum));
  let drift = roundMoney(total - amounts.reduce((summed, amount) => summed + amount, 0));
  for (let index = amounts.length - 1; index >= 0 && drift !== 0; index -= 1) {
    if (!(positive[index] > 0)) continue;
    const next = roundMoney(amounts[index] + drift);
    if (next < 0) continue;
    amounts[index] = next;
    drift = 0;
  }
  return amounts;
}

/** Split a job material/labor total across cards in proportion to each card's national price. */
export function allocateNoteQuoteShares(
  quote: { material: number; labor: number },
  rows: Array<{ id: string; material: number; labor: number }>
): Map<string, NoteQuoteShare> {
  const materials = allocateLeg(
    quote.material,
    rows.map(row => row.material)
  );
  const labors = allocateLeg(
    quote.labor,
    rows.map(row => row.labor)
  );
  const shares = new Map<string, NoteQuoteShare>();
  rows.forEach((row, index) => {
    const material = materials[index] || 0;
    const labor = labors[index] || 0;
    shares.set(row.id, {
      material,
      labor,
      total: roundMoney(material + labor),
    });
  });
  return shares;
}

export type NoteQuotePlanningLine = {
  itemId: string;
  material: number;
  labor: number;
  allowance: number;
  total: number;
};

/**
 * The note's material and labor stay on the named install cards. Removal the
 * note did not price is added on top. Whole-dollar rounding is put back on the
 * last install card so those cards still add up to the stated amounts.
 */
export function reconcileNoteQuotePlanningLines<T extends NoteQuotePlanningLine>(
  lines: T[],
  notes: string | null | undefined
): T[] {
  if (!noteMaterialLaborQuoteSupersedes(notes)) return lines;
  const quote = parseNoteMaterialLaborQuote(notes);
  if (!quote) return lines;
  const next = lines.map(line => ({ ...line }));
  const coveredIndexes = next
    .map((line, index) => (noteQuoteCoversItem(line.itemId, notes) ? index : -1))
    .filter(index => index >= 0);
  if (!coveredIndexes.length) return next;
  const covered = coveredIndexes.map(index => next[index]);
  const materialSum = covered.reduce((sum, line) => sum + line.material, 0);
  const laborSum = covered.reduce((sum, line) => sum + line.labor, 0);
  const materialDrift = quote.material - materialSum;
  const laborDrift = quote.labor - laborSum;
  if (materialDrift === 0 && laborDrift === 0) return next;
  if (materialDrift + laborDrift !== 0) return next;
  const lastIndex = coveredIndexes[coveredIndexes.length - 1];
  const last = next[lastIndex];
  const material = last.material + materialDrift;
  const labor = last.labor + laborDrift;
  if (material < 0 || labor < 0) return next;
  next[lastIndex] = {
    ...last,
    material,
    labor,
    total: material + labor + last.allowance,
  };
  return next;
}
