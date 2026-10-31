const OWNER_PARTY_RE =
  '(?:home\\s*owners?|homeowners?|owners?|customers?|clients?)';
const FLOORING_DEMO_NOUN_RE =
  '(?:existing\\s+)?(?:carpet|floor(?:ing)?|lvp|laminate|vinyl|hardwood|tile)';
const FLOORING_DEMO_VERB_RE =
  '(?:remov(?:e|ing|al)|pull(?:ing)?(?:\\s+up)?|tear(?:ing)?[\\s-]?out|demo(?:ing|lition)?)';

/** True when the owner/customer is the one tearing out the existing floor. */
export function notesOwnerHandlesFlooringDemo(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '').trim();
  if (!text) return false;
  return (
    new RegExp(
      `\\b${OWNER_PARTY_RE}\\b[^.!?\\n]{0,80}\\b${FLOORING_DEMO_VERB_RE}\\b[^.!?\\n]{0,60}\\b${FLOORING_DEMO_NOUN_RE}\\b`,
      'i'
    ).test(text) ||
    new RegExp(
      `\\b${FLOORING_DEMO_NOUN_RE}\\b[^.!?\\n]{0,60}\\b${FLOORING_DEMO_VERB_RE}\\b[^.!?\\n]{0,50}\\b(?:by\\s+(?:the\\s+)?${OWNER_PARTY_RE}|by\\s+others)\\b`,
      'i'
    ).test(text) ||
    new RegExp(
      `\\b${OWNER_PARTY_RE}[\\s-]+(?:provided|handled|supplied)\\s+(?:floor(?:ing)?\\s+)?(?:demo|removal)\\b`,
      'i'
    ).test(text) ||
    new RegExp(
      `\\b${FLOORING_DEMO_NOUN_RE}\\s+(?:already\\s+)?(?:removed|will\\s+be\\s+removed)\\s+by\\s+(?:the\\s+)?${OWNER_PARTY_RE}\\b`,
      'i'
    ).test(text) ||
    new RegExp(
      `\\b${OWNER_PARTY_RE}\\b[^.!?\\n]{0,40}\\b(?:is|are)\\s+handling\\b[^.!?\\n]{0,40}\\b(?:the\\s+)?(?:floor(?:ing)?\\s+)?(?:demo|removal)\\b`,
      'i'
    ).test(text)
  );
}
