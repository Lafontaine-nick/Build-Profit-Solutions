/**
 * Shared helpers for calendar event list / modal display (notes, payment titles).
 */

const AI_ATTRIBUTION_LINE_RE =
  /^(created from ai assistant|added via ai assistant|from ai assistant|via ai assistant)\.?$/i;

/** True if a line is only an AI attribution (any case). */
function isAiAttributionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (AI_ATTRIBUTION_LINE_RE.test(t)) return true;
  return /created from ai assistant|added via ai assistant/i.test(t);
}

/**
 * Split user notes so AI attribution can be shown as a dim secondary line.
 */
export function splitEventNotesForDisplay(notes: string | undefined): {
  primary: string;
  showAiAttribution: boolean;
} {
  if (!notes?.trim()) return { primary: '', showAiAttribution: false };
  const lines = notes.split(/\r?\n/);
  const rest: string[] = [];
  let showAiAttribution = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isAiAttributionLine(line)) {
      showAiAttribution = true;
    } else {
      rest.push(line);
    }
  }
  return { primary: rest.join('\n').trim(), showAiAttribution };
}

/** Parse amount from a title containing USD from formatMoneyUSD, e.g. "$18,048.20" → "18048.20" */
export function extractUsdAmountKeyFromTitle(title: string | undefined): string {
  const m = title?.match(/\$([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return '0';
  return m[1].replace(/,/g, '');
}
