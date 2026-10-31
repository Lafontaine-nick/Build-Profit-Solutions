/**
 * One interpretation of the contractor note. Downstream screens and shadow
 * comparison read this object instead of re-deriving scope from the raw sentence.
 */

const CANONICAL_SCOPE_SCHEMA_VERSION = 1;

function notesFingerprint(notes) {
  return String(notes || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function itemId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function notesOwnerHandlesFlooringDemo(notes) {
  const text = String(notes || "").trim();
  if (!text) return false;
  const owner = "(?:home\\s*owners?|homeowners?|owners?|customers?|clients?)";
  const noun =
    "(?:existing\\s+)?(?:carpet|floor(?:ing)?|lvp|laminate|vinyl|hardwood|tile)";
  const verb =
    "(?:remov(?:e|ing|al)|pull(?:ing)?(?:\\s+up)?|tear(?:ing)?[\\s-]?out|demo(?:ing|lition)?)";
  return (
    new RegExp(
      `\\b${owner}\\b[^.!?\\n]{0,80}\\b${verb}\\b[^.!?\\n]{0,60}\\b${noun}\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\b${noun}\\b[^.!?\\n]{0,60}\\b${verb}\\b[^.!?\\n]{0,50}\\b(?:by\\s+(?:the\\s+)?${owner}|by\\s+others)\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\b${owner}[\\s-]+(?:provided|handled|supplied)\\s+(?:floor(?:ing)?\\s+)?(?:demo|removal)\\b`,
      "i",
    ).test(text) ||
    new RegExp(
      `\\b${noun}\\s+(?:already\\s+)?(?:removed|will\\s+be\\s+removed)\\s+by\\s+(?:the\\s+)?${owner}\\b`,
      "i",
    ).test(text)
  );
}

function upsertItem(items, next) {
  const id = itemId(next.id);
  if (!id) return;
  const current = items.get(id);
  if (!current) {
    items.set(id, { ...next, id });
    return;
  }
  const keepExcluded =
    current.status === "excluded" || next.status === "excluded";
  items.set(id, {
    ...current,
    ...next,
    id,
    status: keepExcluded ? "excluded" : next.status || current.status,
    responsibility:
      next.responsibility && next.responsibility !== "unknown"
        ? next.responsibility
        : current.responsibility,
    evidence: next.evidence || current.evidence,
    quantity: next.quantity ?? current.quantity,
    unit: next.unit || current.unit,
    catalogMatch: next.catalogMatch || current.catalogMatch || id,
  });
}

function noteDrivenExclusions(notes) {
  const items = [];
  if (notesOwnerHandlesFlooringDemo(notes)) {
    items.push({
      id: "floor_demo",
      action: "remove",
      object: "existing_flooring",
      status: "excluded",
      responsibility: "owner",
      catalogMatch: "floor_demo",
      evidence: "Owner or homeowner is handling flooring removal.",
      source: "notes",
      confidence: "high",
    });
  }
  if (/\bno\s+new\s+hang\b/i.test(notes)) {
    items.push({
      id: "drywall_hang",
      action: "install",
      object: "drywall",
      status: "excluded",
      responsibility: "unknown",
      catalogMatch: "hang",
      evidence: "No new hang.",
      source: "notes",
      confidence: "high",
    });
  }
  const clauseExclusions = [
    [/no\s+electrical|electrical\s+by\s+others/i, "electrical"],
    [/permits?\s+not\s+included|no\s+permits/i, "permits"],
    [
      /owner\s+providing\s+appliances|appliances?\s+not\s+included|owner\s+appliances/i,
      "appliances",
    ],
    [/windows?\s+by\s+others|no\s+windows/i, "windows"],
    [/gutters?\s+by\s+others|no\s+gutters/i, "gutters"],
    [/no\s+paint/i, "interior_paint"],
    [
      /electrical\s+service\s+upgrades?\s+not\s+included/i,
      "electrical_service_upgrade",
    ],
    [/no\s+roofing/i, "roofing"],
  ];
  for (const [pattern, id] of clauseExclusions) {
    if (!pattern.test(notes)) continue;
    items.push({
      id,
      status: "excluded",
      responsibility: /owner|others/i.test(String(pattern))
        ? "others"
        : "unknown",
      catalogMatch: id,
      evidence: "Explicitly excluded in the notes.",
      source: "notes",
      confidence: "high",
    });
  }
  return items;
}

function buildCanonicalScope({
  notes = "",
  checklistItems = [],
  scopeFacts = [],
  existing = null,
} = {}) {
  const fingerprint = notesFingerprint(notes);
  const items = new Map();

  if (
    existing?.schemaVersion === CANONICAL_SCOPE_SCHEMA_VERSION &&
    existing.notesFingerprint === fingerprint
  ) {
    for (const item of existing.items || []) upsertItem(items, item);
  }

  for (const fact of scopeFacts || []) {
    const id = itemId(fact.scopeId);
    if (!id) continue;
    const excluded =
      Boolean(fact.excluded) || String(fact.status || "") === "excluded";
    upsertItem(items, {
      id,
      action: fact.action || null,
      object: fact.object || null,
      status: excluded ? "excluded" : "included",
      responsibility: excluded ? "unknown" : "contractor",
      quantity: fact.quantity ?? null,
      unit: fact.unit || null,
      catalogMatch: id,
      evidence: fact.sourceText || null,
      source: "notes",
      confidence: "medium",
    });
  }

  for (const row of checklistItems || []) {
    const id = itemId(row.id);
    if (!id) continue;
    const state = String(row.state || "");
    if (state !== "included" && state !== "excluded") continue;
    upsertItem(items, {
      id,
      status: state,
      responsibility: state === "excluded" ? "unknown" : "contractor",
      catalogMatch: row.catalogScopeId || id,
      evidence: row.sourceText || null,
      source: "notes",
      confidence: "medium",
    });
  }

  for (const item of noteDrivenExclusions(notes)) upsertItem(items, item);

  return {
    schemaVersion: CANONICAL_SCOPE_SCHEMA_VERSION,
    notesFingerprint: fingerprint,
    items: [...items.values()],
  };
}

function canonicalScopeExcludedIds(scope) {
  return new Set(
    (scope?.items || [])
      .filter((item) => item.status === "excluded" && item.id)
      .map((item) => item.id),
  );
}

module.exports = {
  CANONICAL_SCOPE_SCHEMA_VERSION,
  notesFingerprint,
  buildCanonicalScope,
  canonicalScopeExcludedIds,
  notesOwnerHandlesFlooringDemo,
};
