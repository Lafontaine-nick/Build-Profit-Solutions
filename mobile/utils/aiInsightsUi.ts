import type { AiInsight, AiNextStep } from "@/types/aiDashboard";

export type ActionBucket = "critical" | "today" | "quick";

export function bucketForNextStep(step: AiNextStep): ActionBucket {
  const chip = String(step.chip || "").toLowerCase();
  if (/\b(5|10|15)\s*min|quick|fast\b/.test(chip) && step.priority !== "high") {
    return "quick";
  }
  if (step.priority === "high") return "critical";
  if (step.priority === "medium") return "today";
  return "quick";
}

export function sortNextStepsForControlCenter(steps: AiNextStep[]): AiNextStep[] {
  const order: Record<ActionBucket, number> = { critical: 0, today: 1, quick: 2 };
  const pr: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...steps].sort((a, b) => {
    const ba = order[bucketForNextStep(a)];
    const bb = order[bucketForNextStep(b)];
    if (ba !== bb) return ba - bb;
    return (pr[a.priority] ?? 2) - (pr[b.priority] ?? 2);
  });
}

/** Strip repetitive command phrasing; keep project-specific copy. */
export function humanizeNextStepLabel(label: string): string {
  let s = String(label || "").trim();
  if (!s) return "";
  const rules: RegExp[] = [
    /^Review\s+margin\s*(?:&|and)\s*scope\s+for\s+/i,
    /^Confirm\s*(?:&|and)\s*add\s+permit\s+fees?\s+for\s+/i,
    /^Upload\s+missing\s+receipts?\s+for\s+/i,
    /^Review\s+margin\s+for\s+/i,
    /^Confirm\s+permit\s+fees?\s+for\s+/i,
  ];
  for (const re of rules) s = s.replace(re, "");
  s = s.trim();
  if (!s) return String(label || "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function inferCtaFromStep(label: string): { cta: string; kind: "permit" | "receipt" | "review" | "open" } {
  const l = label.toLowerCase();
  if (/\bpermit|fee(s)?\b/.test(l)) return { cta: "Add permit", kind: "permit" };
  if (/\breceipt|invoice|upload\b/.test(l)) return { cta: "Upload", kind: "receipt" };
  if (/\bmargin|scope|profit|budget|forecast|overrun|underpriced\b/.test(l)) return { cta: "Review now", kind: "review" };
  return { cta: "Open", kind: "open" };
}

export function heroKickerForInsight(type: string): string {
  if (type === "alert") return "Biggest risk";
  if (type === "opportunity") return "Top opportunity";
  return "Today's brief";
}

export function firstSupportingSentence(body: string, maxLen = 130): string {
  const t = String(body || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const parts = t.split(/(?<=[.!?])\s+/);
  const first = parts[0] || t;
  if (first.length <= maxLen) return first;
  return t.length > maxLen ? `${t.slice(0, maxLen - 1).trim()}…` : t;
}

export function groupNextStepsByBucket(steps: AiNextStep[]): Record<ActionBucket, AiNextStep[]> {
  const sorted = sortNextStepsForControlCenter(steps);
  const out: Record<ActionBucket, AiNextStep[]> = { critical: [], today: [], quick: [] };
  for (const s of sorted) {
    out[bucketForNextStep(s)].push(s);
  }
  return out;
}

export function portfolioPatternBullets(
  insights: AiInsight[],
  steps: AiNextStep[]
): string[] {
  const blob = [...insights.map((i) => `${i.title} ${i.body}`), ...steps.map((s) => s.label)]
    .join(" ")
    .toLowerCase();
  type Hit = { n: number; line: string };
  const candidates: Hit[] = [
    {
      n: (blob.match(/\breceipt|\binvoice|\bupload\b/g) || []).length,
      line: "Most common issue: missing receipts & uploads",
    },
    {
      n: (blob.match(/\bpermit|\bfee(s)?\b/g) || []).length,
      line: "Biggest profit leak: permit gaps on larger jobs",
    },
    {
      n: (blob.match(/\bmargin|\bprofit|\bscope|\bforecast\b/g) || []).length,
      line: "Watch margin & scope drift on active work",
    },
    {
      n: (blob.match(/\blabor|\bcrew|\bcompleted\b/g) || []).length,
      line: "Best opportunity: reallocate labor from closed jobs",
    },
  ];
  const ranked = candidates.filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  const lines = ranked.slice(0, 3).map((c) => c.line);
  if (lines.length === 0) {
    return ["Patterns sharpen as you log costs and close phases."];
  }
  return lines;
}
