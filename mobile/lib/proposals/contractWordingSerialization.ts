import { stripEditorListPrefix } from "./contractTemplate";

export type BusinessTermDraft = { title: string; body: string };

export function isNonemptyBusinessTerm(term: BusinessTermDraft): boolean {
  return Boolean(String(term.title ?? "").trim() || String(term.body ?? "").trim());
}

/** Human-readable counts for the Step 8 contract wording card and editor header. */
export function formatContractWordingSummary(
  assumptions: string[],
  businessTerms: BusinessTermDraft[],
  workNotes: string[],
): string {
  const assumptionCount = assumptions.filter((s) => parseAssumptionItem(s)).length;
  const termCount = businessTerms.filter(isNonemptyBusinessTerm).length;
  const noteCount = workNotes.filter((s) => parseAssumptionItem(s)).length;
  return `${assumptionCount} scope bullet${assumptionCount === 1 ? "" : "s"} · ${termCount} contract term${termCount === 1 ? "" : "s"} · ${noteCount} job note${noteCount === 1 ? "" : "s"}`;
}

/** One assumption / work-type line → body text (no leading dash). */
export function parseAssumptionItem(raw: string): string {
  return stripEditorListPrefix(String(raw ?? "")).trim();
}

/** Split stored textarea / newline text into assumption bodies. */
export function parseAssumptionLines(text: string): string[] {
  return String(text ?? "")
    .split("\n")
    .map((line) => parseAssumptionItem(line))
    .filter(Boolean);
}

/** Strips list markers from each template line → bodies for editor cards. */
export function parseAssumptionLinesFromDefaults(lines: string[]): string[] {
  return (lines ?? []).map((s) => parseAssumptionItem(s)).filter(Boolean);
}

export function serializeAssumptionLines(items: string[]): string {
  return items
    .map((s) => parseAssumptionItem(s))
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
}

/** Parse "- Title: body" or plain line → draft row. */
export function parseBusinessTermLine(raw: string): BusinessTermDraft {
  const s = stripEditorListPrefix(String(raw ?? "")).trim();
  if (!s) return { title: "", body: "" };
  const i = s.indexOf(":");
  if (i === -1) return { title: "", body: s };
  return { title: s.slice(0, i).trim(), body: s.slice(i + 1).trim() };
}

export function parseBusinessTermsText(text: string): BusinessTermDraft[] {
  const lines = String(text ?? "").split("\n");
  const out: BusinessTermDraft[] = [];
  for (const line of lines) {
    const row = parseBusinessTermLine(line);
    if (row.title || row.body) out.push(row);
  }
  return out.length ? out : [{ title: "", body: "" }];
}

export function serializeBusinessTerms(terms: BusinessTermDraft[]): string {
  return terms
    .map(({ title, body }) => {
      const t = String(title ?? "").trim();
      const b = String(body ?? "").trim();
      if (t && b) return `- ${t}: ${b}`;
      if (b) return `- ${b}`;
      if (t) return `- ${t}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Build display strings for a read-only PDF summary column. */
export function previewFromDrafts(
  assumptions: string[],
  businessTerms: BusinessTermDraft[],
  workNotes: string[],
): { assumptions: string[]; business: string[]; work: string[] } {
  return {
    assumptions: assumptions.map((s) => parseAssumptionItem(s)).filter(Boolean),
    business: businessTerms
      .map(({ title, body }) => {
        const t = String(title ?? "").trim();
        const b = String(body ?? "").trim();
        if (t && b) return `${t}: ${b}`;
        return b || t;
      })
      .filter(Boolean),
    work: workNotes.map((s) => parseAssumptionItem(s)).filter(Boolean),
  };
}
