export type PlanEstimatingMode = 'whole_project' | 'selected_trade';

export type PlanTradeKey =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'roofing'
  | 'concrete'
  | 'framing'
  | 'drywall'
  | 'painting'
  | 'stucco'
  | 'insulation'
  | 'flooring'
  | 'cabinets'
  | 'windows_doors'
  | 'landscaping';

export type PlanTradeConfiguration = {
  key: PlanTradeKey;
  label: string;
  status: 'reference' | 'stub';
  scopeHint: string;
  missingInfo: string[];
};

export const PLAN_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] = [
  {
    key: 'electrical',
    label: 'Electrical',
    status: 'reference',
    scopeHint: 'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes.',
    missingInfo: ['Device and fixture counts', 'Panel/circuit schedule', 'Service size and utility scope'],
  },
  ...(
    [
      ['plumbing', 'Plumbing'],
      ['hvac', 'HVAC'],
      ['roofing', 'Roofing'],
      ['concrete', 'Concrete'],
      ['framing', 'Framing'],
      ['drywall', 'Drywall'],
      ['painting', 'Painting'],
      ['stucco', 'Stucco / Exterior Finish'],
      ['insulation', 'Insulation'],
      ['flooring', 'Flooring'],
      ['cabinets', 'Cabinets'],
      ['windows_doors', 'Windows & doors'],
      ['landscaping', 'Landscaping'],
      ['other', 'Other'],
    ] as ReadonlyArray<[PlanTradeKey, string]>
  ).map(([key, label]) => ({
    key,
    label,
    status: 'stub' as const,
    scopeHint: `Focus on ${label.toLowerCase()} sheets and notes; do not infer detailed quantities.`,
    missingInfo: ['Trade-specific plan/schedule details', 'Scope inclusions and exclusions', 'Quantities requiring contractor confirmation'],
  })),
];

export const WHOLE_PROJECT_PLAN_TRADE: PlanTradeConfiguration = {
  key: 'electrical',
  label: 'Whole project',
  status: 'reference',
  scopeHint: 'Read the complete plan set and preserve existing whole-project behavior.',
  missingInfo: [],
};

export function getPlanTradeConfiguration(key: string | null | undefined): PlanTradeConfiguration | null {
  return PLAN_TRADE_CONFIGURATIONS.find((trade) => trade.key === key) || null;
}

export function normalizePlanImportSelection(
  mode?: PlanEstimatingMode | null,
  tradeKey?: string | null
): { mode: PlanEstimatingMode; trade: PlanTradeConfiguration | null } {
  const trade = getPlanTradeConfiguration(tradeKey);
  return {
    mode: mode === 'selected_trade' && trade ? 'selected_trade' : 'whole_project',
    trade: mode === 'selected_trade' ? trade : null,
  };
}
