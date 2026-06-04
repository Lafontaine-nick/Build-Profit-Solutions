/**
 * Extract room-specific fragments from full bid notes (avoid attaching global lines to every room).
 */

const { isJunkPriceLabel, isAbsurdParsedAmount } = require('./estimateDraftQuantityPrice');

const ROOM_SECTION_STOP_WORDS = new Set(['with', 'and', 'the', 'a', 'an', 'of', 'for']);

/** Tokens too common to tie a line item to a specific room. */
const GENERIC_LABEL_TOKENS = new Set([
  'install',
  'installation',
  'paint',
  'painting',
  'three',
  'tone',
  'new',
  'demo',
  'removal',
  'remove',
  'labor',
  'material',
  'materials',
  'floor',
  'flooring',
  'per',
  'square',
  'foot',
  'allowance',
  'supply',
  'hookup',
  'reconnect',
  'finish',
  'items',
  'needs',
  'price',
  'combined',
  'total',
  'notes',
  'user',
  'provided',
  'subtotal',
]);

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function roomNameTokens(roomName) {
  const raw = String(roomName || '')
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, ' ')
    .trim();
  return raw.split(/\s+/).filter((t) => {
    if (!t) return false;
    if (/^\d+$/.test(t) || t.includes('#')) return true;
    return t.length > 2 && !ROOM_SECTION_STOP_WORDS.has(t);
  });
}

function bedroomNumber(roomName) {
  const rn = String(roomName || '').toLowerCase();
  const m = rn.match(/#\s*(\d+)|bedroom\s*#?\s*(\d+)/);
  return m ? m[1] || m[2] : null;
}

function sectionMatchesRoom(sectionText, roomName) {
  const text = String(sectionText || '').toLowerCase();
  const rn = String(roomName || '').toLowerCase().trim();
  if (!text || !rn) return false;

  const firstLine = text.split('\n')[0].trim();
  if (firstLine.includes(rn) || rn.includes(firstLine.slice(0, Math.min(firstLine.length, 40)))) {
    return true;
  }

  const bedNum = bedroomNumber(roomName);
  if (bedNum) {
    const hasBedroom = /\bedroom\b/.test(text);
    const hasNum = new RegExp(`(?:bedroom\\s*#?\\s*${bedNum}|#\\s*${bedNum}\\b)`).test(text);
    if (hasBedroom && !hasNum) return false;
    if (hasNum && !hasBedroom && !/master\s+bedroom/.test(rn)) {
      return new RegExp(`(?:bedroom\\s*#?\\s*${bedNum}|#\\s*${bedNum}\\b)`).test(text);
    }
  }

  const tokens = roomNameTokens(roomName);
  if (!tokens.length) return text.includes(rn);

  const matched = tokens.filter((t) => text.includes(t)).length;
  return matched >= Math.max(1, Math.ceil(tokens.length * 0.65));
}

function extractRoomNotesText(originalNotes, roomName, roomScope) {
  const notes = String(originalNotes || '').trim();
  const name = String(roomName || '').trim();
  const scope = String(roomScope || '').trim();

  if (!notes) return `${name}\n${scope}`.trim();
  if (!name) return scope || notes;

  const paragraphs = notes
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    const hit = paragraphs.find((p) => sectionMatchesRoom(p, name));
    if (hit) return hit;
  }

  const lines = notes.split(/\n/);
  const blocks = [];
  let current = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const looksLikeHeader =
      trimmed.length > 0 &&
      trimmed.length < 80 &&
      /^[A-Z#]/.test(trimmed) &&
      !/^\$/.test(trimmed) &&
      (/\b(bathroom|bedroom|kitchen|entry|closet|hall|stairs|garage|master)\b/i.test(trimmed) ||
        /#\s*\d/.test(trimmed));

    if (looksLikeHeader && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));

  if (blocks.length > 1) {
    const hit = blocks.find((b) => sectionMatchesRoom(b, name));
    if (hit) return hit.trim();
  }

  const matchingLines = lines.filter((line) => sectionMatchesRoom(line, name));
  if (matchingLines.length >= 2) {
    const startIdx = lines.indexOf(matchingLines[0]);
    const chunk = lines.slice(startIdx, startIdx + Math.min(lines.length - startIdx, 40)).join('\n');
    if (sectionMatchesRoom(chunk, name)) return chunk.trim();
  }

  return `${name}\n${scope}`.trim();
}

function itemLabelMatchesRoom(itemName, roomContextText) {
  const roomLower = String(roomContextText || '').toLowerCase();
  const nameLower = String(itemName || '').toLowerCase().trim();
  if (!nameLower || !roomLower) return false;

  const normalized = nameLower.replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized.length > 14) {
    const snippet = normalized.slice(0, Math.min(28, normalized.length));
    if (roomLower.includes(snippet)) return true;
  }

  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);
  const distinctive = tokens.filter(
    (t) => !GENERIC_LABEL_TOKENS.has(t) && !ROOM_SECTION_STOP_WORDS.has(t)
  );
  if (distinctive.length === 0) return false;

  const matched = distinctive.filter((t) => roomLower.includes(t)).length;
  return matched >= Math.ceil(distinctive.length * 0.75);
}

function filterPricingItemsForRoom(items, roomContextText, roomTotal) {
  const roomLower = String(roomContextText || '').toLowerCase();
  const cap = roomTotal != null && roomTotal > 0 ? roundMoney(roomTotal) : null;

  return (items || []).filter((item) => {
    const name = String(item?.name || '').trim();
    if (!name || isJunkPriceLabel(name)) return false;
    if (item.amount != null && isAbsurdParsedAmount(item.amount, name)) return false;
    if (cap != null && item.amount != null && roundMoney(item.amount) > cap * 1.5) return false;

    if (!itemLabelMatchesRoom(name, roomLower)) return false;

    return true;
  });
}

module.exports = {
  extractRoomNotesText,
  filterPricingItemsForRoom,
  itemLabelMatchesRoom,
  sectionMatchesRoom,
  roomNameTokens,
};
