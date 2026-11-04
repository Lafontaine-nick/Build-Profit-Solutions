/**
 * Read-only note reader. It may describe the sentence and the question it
 * would ask. It must not add a card, a quantity, or a price to the draft.
 */

const MESSY_NOTE =
  /\b(?:about|around|roughly|kinda|sort of|customer wants|retile|throw down|vinyl plank|unless i|don't|do not|something like)\b/i;

const READER_PROMPT = `You are a read-only construction note reader. Return ONLY JSON:
{
  "jobs": [{ "label": string, "evidence": string }],
  "quantities": [{ "label": string, "quantity": number, "unit": string, "evidence": string }],
  "missingCompanions": [{ "label": string }],
  "wouldAsk": string | null
}
evidence must be an exact phrase copied from the note. A quantity is allowed only when that number is inside its evidence. missingCompanions are usual pieces the note never named. wouldAsk is one short question, or null. Do not return prices, checklist ids, or line items.`;

function noteText(notes) {
  return String(notes || '').replace(/\s+/g, ' ').trim();
}

function noteNeedsReaderPass(notes, draft) {
  const text = noteText(notes);
  if (!text) return false;
  if (draft?.extractionConfidence?.requiresAiFallback) return true;
  if (text.length > 320) return true;
  return MESSY_NOTE.test(text);
}

function parseReaderJson(content) {
  const text = String(content || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function evidenceInNote(note, evidence) {
  const phrase = String(evidence || '').replace(/\s+/g, ' ').trim();
  if (phrase.length < 3) return false;
  return note.toLowerCase().includes(phrase.toLowerCase());
}

function numberInEvidence(quantity, evidence) {
  const value = Number(quantity);
  if (!Number.isFinite(value)) return false;
  const digits = String(evidence).replace(/,/g, '');
  return digits.includes(String(value));
}

function labelAlreadyNamed(note, label) {
  const word = String(label || '').trim();
  if (word.length < 3) return true;
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(note);
}

function sanitizeNoteReading(notes, raw) {
  const note = noteText(notes);
  const source = raw && typeof raw === 'object' ? raw : {};
  const jobs = (Array.isArray(source.jobs) ? source.jobs : [])
    .map(row => ({
      label: String(row?.label || '').trim(),
      evidence: String(row?.evidence || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(row => row.label && evidenceInNote(note, row.evidence))
    .slice(0, 12);
  const quantities = (Array.isArray(source.quantities) ? source.quantities : [])
    .map(row => ({
      label: String(row?.label || '').trim(),
      quantity: Number(row?.quantity),
      unit: String(row?.unit || '').trim(),
      evidence: String(row?.evidence || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(
      row =>
        row.label &&
        row.unit &&
        evidenceInNote(note, row.evidence) &&
        numberInEvidence(row.quantity, row.evidence)
    )
    .slice(0, 12);
  const missingCompanions = (Array.isArray(source.missingCompanions)
    ? source.missingCompanions
    : []
  )
    .map(row => String(row?.label || row || '').trim())
    .filter(label => label && !labelAlreadyNamed(note, label))
    .slice(0, 8);
  const ask = String(source.wouldAsk || '').replace(/\s+/g, ' ').trim();
  return {
    jobs,
    quantities,
    missingCompanions,
    wouldAsk: ask ? ask.slice(0, 140) : null,
    authoritative: false,
  };
}

function readerCompletionText(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => part?.text || '').join('');
  }
  return '';
}

async function readNoteComprehension(notes, complete) {
  if (typeof complete !== 'function' || !noteText(notes)) return null;
  const completion = await complete({
    reasoning_effort: 'none',
    temperature: 0,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: READER_PROMPT },
      { role: 'user', content: noteText(notes) },
    ],
  });
  return sanitizeNoteReading(notes, parseReaderJson(readerCompletionText(completion)));
}

function attachReadOnlyNoteReading(draft, reading) {
  if (!draft || !reading) return draft;
  return {
    ...draft,
    noteReading: reading,
  };
}

module.exports = {
  READER_PROMPT,
  noteNeedsReaderPass,
  sanitizeNoteReading,
  readNoteComprehension,
  attachReadOnlyNoteReading,
};
