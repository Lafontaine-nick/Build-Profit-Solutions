import type { AiInsight, AiNextStep } from "@/types/aiDashboard";
import { insightActionCtaLabel, resolveInsightActionTarget } from "@/utils/insightNavigation";

export type ActionBucket = "critical" | "today" | "quick";

const COMPLETED_STATUSES = new Set(["completed", "complete", "done", "finished"]);

export function isCompletedProjectStatus(status: unknown): boolean {
  const normalized = String(status ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return COMPLETED_STATUSES.has(normalized);
}

export function resolveInsightImpactDollars(
  insight: Pick<AiInsight, "impactDollars" | "evidence">
): number | null {
  if (insight.impactDollars != null && Number.isFinite(Number(insight.impactDollars))) {
    return Number(insight.impactDollars);
  }
  for (const line of insight.evidence || []) {
    const match = String(line).match(/over by\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
    if (match) {
      const parsed = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

export function formatHeroImpactPhrase(
  leakType: string | undefined,
  impactDollars: number | null | undefined
): string {
  if (impactDollars == null || !Number.isFinite(impactDollars) || impactDollars <= 0) {
    return "";
  }
  const compact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(impactDollars);
  if (leakType === "line_over_estimate") return ` · ~${compact} over estimate`;
  if (leakType === "category_over_budget") return ` · ~${compact} over category budget`;
  if (leakType === "over_budget") return ` · ~${compact} over cost budget`;
  return ` · ~${compact} at risk`;
}

export function heroKickerForLeakType(
  leakType?: string | null,
  opts?: { projectCompleted?: boolean }
): string {
  if (opts?.projectCompleted) return "Closeout review";
  switch (leakType) {
    case "line_over_estimate":
      return "Over estimate";
    case "category_over_budget":
      return "Budget alert";
    case "over_budget":
      return "Over budget";
    case "margin_erosion":
    case "spend_ahead_of_progress":
      return "Biggest risk";
    case "missing_receipts":
      return "Receipt gap";
    case "stale_high_value_estimate":
      return "Top opportunity";
    default:
      return "Today's brief";
  }
}

export function frameInsightForDisplay(
  insight: AiInsight,
  projectCompleted: boolean
): AiInsight {
  if (!projectCompleted) return insight;
  const leakType = insight.leakType;
  if (leakType === "line_over_estimate") {
    return {
      ...insight,
      body: insight.body.includes("closeout")
        ? insight.body
        : `${insight.body} Review final logged costs in closeout.`,
    };
  }
  if (leakType === "category_over_budget") {
    return {
      ...insight,
      body: insight.body.includes("closeout")
        ? insight.body
        : `${insight.body} Compare final category spend before archiving.`,
    };
  }
  if (leakType === "over_budget") {
    return {
      ...insight,
      title: insight.title.startsWith("Closeout")
        ? insight.title
        : `Closeout — ${insight.title}`,
      body: insight.body.includes("closeout")
        ? insight.body
        : `${insight.body} Review final totals against the original cost budget.`,
    };
  }
  return insight;
}

export function frameNextStepForDisplay(
  step: AiNextStep,
  projectCompleted: boolean
): AiNextStep {
  if (!projectCompleted) return step;
  const leakType = step.leakType;
  if (!leakType) return step;
  if (leakType === "line_over_estimate") {
    const label = /^review/i.test(step.label)
      ? step.label.replace(/^Review/i, "Review final")
      : `Review final ${step.label}`;
    return {
      ...step,
      label,
      chip: "Closeout review",
    };
  }
  if (leakType === "category_over_budget" || leakType === "over_budget") {
    return {
      ...step,
      chip: "Closeout review",
    };
  }
  return step;
}

export function pickOverviewInsightPreview(
  insights: AiInsight[],
  limit = 2
): AiInsight[] {
  if (insights.length <= limit) return insights;

  const picked: AiInsight[] = [];
  const seen = new Set<string>();
  const push = (insight?: AiInsight) => {
    if (!insight || seen.has(insight.id)) return;
    seen.add(insight.id);
    picked.push(insight);
  };

  const lineInsightForSection = (section: "materials" | "labor") =>
    insights.find(
      (i) =>
        i.leakType === "line_over_estimate" &&
        i.actionTarget?.kind === "rate_insights" &&
        i.actionTarget.section === section
    ) ||
    insights.find(
      (i) =>
        i.leakType === "line_over_estimate" &&
        (i.evidence?.[0] || "").toLowerCase().includes(section === "labor" ? "labor" : "material")
    );

  push(insights.find((i) => i.leakType === "category_over_budget"));
  push(lineInsightForSection("materials"));
  push(lineInsightForSection("labor"));
  push(insights.find((i) => i.leakType === "line_over_estimate"));
  push(insights.find((i) => i.leakType === "over_budget"));

  for (const insight of insights) {
    if (picked.length >= limit) break;
    push(insight);
  }

  return picked.slice(0, limit);
}

export function summarizeProjectLineOverruns(
  insights: AiInsight[],
  projectId: string
): {
  lineCount: number;
  totalOver: number;
  materialsCount: number;
  laborCount: number;
} {
  const lines = insights.filter(
    (i) => i.leakType === "line_over_estimate" && String(i.projectId) === String(projectId)
  );
  let materialsCount = 0;
  let laborCount = 0;
  let totalOver = 0;
  for (const insight of lines) {
    totalOver += resolveInsightImpactDollars(insight) ?? 0;
    const section =
      insight.actionTarget?.kind === "rate_insights"
        ? insight.actionTarget.section
        : undefined;
    if (section === "labor") laborCount += 1;
    else if (section === "materials") materialsCount += 1;
  }
  return { lineCount: lines.length, totalOver, materialsCount, laborCount };
}

export function nextStepMatchesDailyRisk(
  step: AiNextStep,
  dailyRisk: { id?: string; projectId?: string | null; type?: string; headline?: string }
): boolean {
  if (dailyRisk.id && String(step.id) === String(dailyRisk.id)) return true;
  if (!dailyRisk.projectId || String(step.projectId) !== String(dailyRisk.projectId)) {
    return false;
  }
  if (dailyRisk.type !== "line_over_estimate" || step.leakType !== "line_over_estimate") {
    return false;
  }
  const headline = String(dailyRisk.headline || "").toLowerCase();
  const lineName = compactActionStepTitle(step).toLowerCase();
  return Boolean(lineName && headline.includes(lineName.split("—")[0].trim()));
}

export function filterInsightsActionStepsAfterHero(
  steps: AiNextStep[],
  dailyRisk:
    | { id?: string; projectId?: string | null; type?: string; headline?: string }
    | undefined
    | null,
  heroUsesAggregate: boolean,
  _heroProjectId: string | null
): AiNextStep[] {
  if (!dailyRisk) return steps;
  // Aggregate hero summarizes multiple lines on one project — keep per-line cards
  // in Prioritized actions so users can tap into each rate insight.
  if (heroUsesAggregate) return steps;
  return steps.filter((step) => !nextStepMatchesDailyRisk(step, dailyRisk));
}

export function compactActionStepTitle(step: AiNextStep): string {
  const reviewMatch = step.label.match(/^Review (?:final )?(.+?) on /i);
  if (reviewMatch?.[1]) return reviewMatch[1].trim();
  if (!/\bon\b/i.test(step.label)) {
    return step.label.replace(/^Review (?:final )?/i, "").trim() || step.label;
  }
  const humanized = humanizeNextStepLabel(step.label);
  const onIdx = humanized.lastIndexOf(" on ");
  if (onIdx > 0) return humanized.slice(0, onIdx).trim();
  return humanized;
}

export function compactInsightBody(insight: AiInsight): string {
  if (insight.leakType === "line_over_estimate" && insight.body.includes(" logged vs ")) {
    return insight.body.includes("closeout")
      ? insight.body
      : `${insight.body} Review in rate insights.`;
  }
  if (insight.leakType === "category_over_budget") {
    return firstSupportingSentence(insight.body, 110);
  }
  return firstSupportingSentence(insight.body, 120);
}

export function bucketForNextStep(step: AiNextStep): ActionBucket {
  const chip = String(step.chip || "").toLowerCase();
  const isBudgetOverrun =
    step.leakType === "line_over_estimate" ||
    step.leakType === "category_over_budget" ||
    step.leakType === "over_budget";

  if (step.priority === "high") return "critical";
  // Budget overruns need review even when the dollar gap is small — never "quick win".
  if (step.priority === "medium" || isBudgetOverrun) return "today";
  if (/\b(5|10|15)\s*min|quick|fast\b/.test(chip) && step.priority !== "high") {
    return "quick";
  }
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

export function inferCtaFromStep(
  label: string,
  step?: Pick<AiNextStep, "leakType" | "actionTarget">
): { cta: string; kind: "permit" | "receipt" | "review" | "open" } {
  const actionTarget = step ? resolveInsightActionTarget(step) : undefined;
  if (actionTarget) {
    return {
      cta: insightActionCtaLabel(actionTarget),
      kind:
        actionTarget.kind === "rate_insights"
          ? "review"
          : actionTarget.kind === "budget_category"
            ? "review"
            : "open",
    };
  }
  const l = label.toLowerCase();
  if (/\bpermit|fee(s)?\b/.test(l)) return { cta: "Add permit", kind: "permit" };
  if (/\breceipt|invoice|upload\b/.test(l)) return { cta: "Upload", kind: "receipt" };
  if (/\bmargin|scope|profit|budget|forecast|overrun|underpriced\b/.test(l)) {
    return { cta: "Review now", kind: "review" };
  }
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
  const lineOverCount = insights.filter((i) => i.leakType === "line_over_estimate").length;
  const materialLineCount = insights.filter(
    (i) =>
      i.leakType === "line_over_estimate" &&
      i.actionTarget?.kind === "rate_insights" &&
      i.actionTarget.section === "materials"
  ).length;
  const laborLineCount = insights.filter(
    (i) =>
      i.leakType === "line_over_estimate" &&
      i.actionTarget?.kind === "rate_insights" &&
      i.actionTarget.section === "labor"
  ).length;
  const categoryOverCount = insights.filter((i) => i.leakType === "category_over_budget").length;
  const projectOverCount = insights.filter((i) => i.leakType === "over_budget").length;

  const lines: string[] = [];
  if (materialLineCount > 0) {
    lines.push(
      `${materialLineCount} material line${materialLineCount === 1 ? "" : "s"} over estimate`
    );
  }
  if (laborLineCount > 0) {
    lines.push(`${laborLineCount} labor line${laborLineCount === 1 ? "" : "s"} over estimate`);
  }
  if (lineOverCount > 0 && materialLineCount === 0 && laborLineCount === 0) {
    lines.push(
      `${lineOverCount} estimate line${lineOverCount === 1 ? "" : "s"} running over budget`
    );
  }
  if (categoryOverCount > 0) {
    lines.push(
      `${categoryOverCount} categor${categoryOverCount === 1 ? "y" : "ies"} over cost budget`
    );
  }
  if (projectOverCount > 0) {
    lines.push(
      `${projectOverCount} project${projectOverCount === 1 ? "" : "s"} over total cost budget`
    );
  }

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
  lines.push(...ranked.slice(0, 3 - lines.length).map((c) => c.line));

  if (lines.length === 0) {
    return ["Patterns sharpen as you log costs and close phases."];
  }
  return lines.slice(0, 3);
}
