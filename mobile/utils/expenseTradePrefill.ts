import { getPlanTradeConfiguration } from '@/utils/planImportTradeConfig';
import { resolveProjectEstimateData } from '@/utils/rateInsightComparisons';

export const EXPENSE_TRADE_PLACEHOLDER = 'e.g., Electrical, Flooring, Tile';

type TradeMatch = {
  keys: string[];
  label: string;
  pattern: RegExp;
};

/** Longer keys first so windows_doors wins over a shorter fragment. */
const TRADE_MATCHES: TradeMatch[] = [
  {
    keys: ['windows_doors'],
    label: 'Windows & doors',
    pattern: /\b(windows?(?:\s*&\s*|\s+and\s+)doors?|exterior doors?|patio doors?|sliding doors?|sliders?)\b/i,
  },
  {
    keys: ['electrical'],
    label: 'Electrical',
    pattern:
      /\b(electrical|electric|wiring|receptacles?|outlets?|gfci|panels?|circuits?|breakers?|switch(?:es)?|recessed|canless|wafer|ceiling fans?|exhaust fans?|lighting|light fixtures?|conduit)\b/i,
  },
  {
    keys: ['plumbing'],
    label: 'Plumbing',
    pattern:
      /\b(plumbing|water heaters?|faucets?|toilets?|sinks?|shower valves?|drains?|supply lines?)\b/i,
  },
  {
    keys: ['hvac'],
    label: 'HVAC',
    pattern: /\b(hvac|furnaces?|air handlers?|heat pumps?|ductwork|condensers?|thermostats?)\b/i,
  },
  {
    keys: ['landscaping'],
    label: 'Landscaping',
    pattern: /\b(landscaping|landscape|irrigation|sod|plantings?|hardscape)\b/i,
  },
  {
    keys: ['tile'],
    label: 'Tile',
    pattern: /\b(tiles?|backsplash|grout)\b/i,
  },
  {
    keys: ['flooring'],
    label: 'Flooring',
    pattern: /\b(flooring|lvp|hardwood|carpets?|vinyl planks?)\b/i,
  },
  {
    keys: ['drywall'],
    label: 'Drywall',
    pattern: /\b(drywall|sheetrock|gypsum)\b/i,
  },
  {
    keys: ['painting'],
    label: 'Painting',
    pattern: /\b(painting|paint|primer)\b/i,
  },
  {
    keys: ['roofing'],
    label: 'Roofing',
    pattern: /\b(roofing|roofs?|shingles?|gutters?)\b/i,
  },
  {
    keys: ['concrete'],
    label: 'Concrete',
    pattern: /\b(concrete|flatwork|footings?|slabs?)\b/i,
  },
  {
    keys: ['framing'],
    label: 'Framing',
    pattern: /\b(framing|studs?|joists?|trusses?)\b/i,
  },
  {
    keys: ['insulation'],
    label: 'Insulation',
    pattern: /\binsulation\b/i,
  },
  {
    keys: ['stucco'],
    label: 'Stucco',
    pattern: /\bstucco\b/i,
  },
  {
    keys: ['cabinets'],
    label: 'Cabinets',
    pattern: /\b(cabinets?|vanit(?:y|ies))\b/i,
  },
];

function labelForTradeKey(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return null;
  const known = TRADE_MATCHES.find((match) => match.keys.includes(key));
  if (known) return known.label;
  return getPlanTradeConfiguration(key)?.label || null;
}

function matchTradeText(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const compact = value.toLowerCase().replace(/[\s-]+/g, '_');
  for (const match of TRADE_MATCHES) {
    if (match.keys.some((key) => compact === key || compact.startsWith(`${key}_`) || compact.includes(`_${key}_`) || compact.endsWith(`_${key}`))) {
      return match.label;
    }
  }
  for (const match of TRADE_MATCHES) {
    if (match.pattern.test(value)) return match.label;
  }
  return null;
}

function draftFromEstimate(estimateData: Record<string, unknown>): Record<string, unknown> | null {
  const snapshot = estimateData.aiEstimateDraftSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  const draft = (snapshot as { draft?: unknown }).draft;
  return draft && typeof draft === 'object' ? (draft as Record<string, unknown>) : null;
}

function singleTradeLabel(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  const unique = Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
  );
  if (unique.length !== 1) return null;
  return labelForTradeKey(unique[0]) || unique[0];
}

function projectTradeLabel(estimateData: Record<string, unknown>): string | null {
  const draft = draftFromEstimate(estimateData);
  const measurements =
    (estimateData.scopeMeasurements && typeof estimateData.scopeMeasurements === 'object'
      ? (estimateData.scopeMeasurements as Record<string, unknown>)
      : null) ||
    (draft?.scopeMeasurements && typeof draft.scopeMeasurements === 'object'
      ? (draft.scopeMeasurements as Record<string, unknown>)
      : null) ||
    {};
  const planImport =
    estimateData.planImport && typeof estimateData.planImport === 'object'
      ? (estimateData.planImport as Record<string, unknown>)
      : null;
  const key = String(
    measurements.planImportTradeKey ||
      draft?.planImportTradeKey ||
      estimateData.planImportTradeKey ||
      planImport?.selectedTrade ||
      ''
  );
  const fromKey = labelForTradeKey(key);
  if (fromKey) return fromKey;

  const classification =
    draft?.classification && typeof draft.classification === 'object'
      ? (draft.classification as Record<string, unknown>)
      : null;
  const checklist =
    draft?.scopeChecklist && typeof draft.scopeChecklist === 'object'
      ? (draft.scopeChecklist as Record<string, unknown>)
      : null;
  const canonical =
    checklist?.canonicalMixedScope && typeof checklist.canonicalMixedScope === 'object'
      ? (checklist.canonicalMixedScope as Record<string, unknown>)
      : null;

  const tradeLists = [
    classification?.detectedTrades,
    draft?.detectedTrades,
    canonical?.detectedTrades,
    draft?.scopeTradeLabels || estimateData.scopeTradeLabels,
  ];
  const hasSeveralTrades = tradeLists.some(
    (values) =>
      Array.isArray(values) &&
      new Set(values.map((value) => String(value || '').trim()).filter(Boolean)).size > 1
  );
  if (hasSeveralTrades) return null;

  return (
    singleTradeLabel(classification?.detectedTrades) ||
    singleTradeLabel(draft?.detectedTrades) ||
    singleTradeLabel(canonical?.detectedTrades) ||
    singleTradeLabel(
      classification?.primaryTrade ? [classification.primaryTrade] : null
    ) ||
    singleTradeLabel(draft?.scopeTradeLabels || estimateData.scopeTradeLabels)
  );
}

export function suggestedExpenseTrade(input: {
  projectLike?: Record<string, unknown> | null;
  lineName?: string | null;
  costCode?: string | null;
}): string {
  const fromLine = matchTradeText(
    [input.costCode, input.lineName].filter(Boolean).join(' ')
  );
  if (fromLine) return fromLine;
  const estimateData = resolveProjectEstimateData(input.projectLike);
  return projectTradeLabel(estimateData) || '';
}
