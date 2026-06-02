import { postAiAssistantJson } from '@/utils/resolveAiBackendUrl';

export type EstimateDraftRoom = {
  name: string;
  scope: string;
  price: number | null;
  laborPrice: number | null;
  materialPrice: number | null;
  /** True when notes gave one combined price — no separate L/M amounts. */
  priceIncludesLaborAndMaterials: boolean;
  /** True when labor/material amounts came from opt-in "Suggest split" — not from notes. */
  splitIsSuggested?: boolean;
  priceProvidedByUser: boolean;
};

export type EstimateDraftAllowance = {
  name: string;
  amount: number | null;
  unit: string | null;
  description: string;
};

export type EstimateDraftPayment = {
  label: string;
  amount: number | null;
  percentage: number | null;
  dueTiming: string;
};

export type EstimateAiDraft = {
  customerName: string | null;
  projectTitle: string | null;
  projectType: string;
  projectDescription: string | null;
  rooms: EstimateDraftRoom[];
  allowances: EstimateDraftAllowance[];
  inclusions: string[];
  exclusions: string[];
  statedTotal: number | null;
  calculatedLineItemTotal: number | null;
  calculatedLaborTotal: number | null;
  calculatedMaterialTotal: number | null;
  combinedPriceRoomCount?: number;
  suggestedSplitRoomCount?: number;
  pricingWarnings: string[];
  missingInfo: string[];
  contractScope: string | null;
  suggestedPaymentSchedule: EstimateDraftPayment[] | null;
};

export type ApplyDraftResult = {
  bid: Record<string, unknown>;
  materialsCart: Record<string, unknown>[];
};

const PROJECT_CATEGORY_SLUGS: Record<string, string> = {
  kitchen: 'kitchen-remodel',
  bathroom: 'bathroom-remodel',
  room_addition: 'addition',
  home_addition: 'home-renovation',
  adu: 'adu',
  garage_conversion: 'garage-conversion',
  new_build: 'new-build',
  roofing: 'roofing',
  deck_patio: 'deck-patio',
  plumbing_service: 'plumbing-service',
  landscaping: 'landscaping',
  other: 'other',
};

function newLineItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDraftMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `$${Math.round(Number(amount)).toLocaleString()}`;
}

export async function fetchEstimateDraftFromNotes(notes: string): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-from-notes',
    { notes }
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to generate estimate draft');
  }

  return payload.draft;
}

export async function fetchSuggestedDraftSplits(draft: EstimateAiDraft): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-suggest-splits',
    { draft },
    90000
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to suggest splits');
  }

  return payload.draft;
}

export function draftHasCombinedRoomPrices(draft: EstimateAiDraft | null): boolean {
  return (draft?.combinedPriceRoomCount || 0) > 0;
}

function buildScopeDescription(draft: EstimateAiDraft): string {
  const parts: string[] = [];

  if (draft.projectDescription) {
    parts.push(draft.projectDescription.trim());
  }

  if (draft.contractScope) {
    parts.push(draft.contractScope.trim());
  }

  if (draft.rooms.length > 0) {
    const roomBlocks = draft.rooms.map((room) => {
      const header = room.name.trim();
      const body = room.scope.trim();
      return body ? `${header}\n${body}` : header;
    });
    parts.push(roomBlocks.join('\n\n'));
  }

  if (draft.allowances.length > 0) {
    const allowanceLines = draft.allowances.map((allowance) => {
      const label = allowance.name || allowance.description || 'Allowance';
      const amount =
        allowance.amount != null
          ? formatDraftMoney(allowance.amount) + (allowance.unit ? ` ${allowance.unit}` : '')
          : allowance.unit || '';
      const detail = allowance.description?.trim();
      return [label, amount, detail].filter(Boolean).join(' — ');
    });
    parts.push(['Allowances', ...allowanceLines.map((line) => `• ${line}`)].join('\n'));
  }

  if (draft.inclusions.length > 0) {
    parts.push(['Inclusions', ...draft.inclusions.map((line) => `• ${line}`)].join('\n'));
  }

  if (draft.exclusions.length > 0) {
    parts.push(['Exclusions', ...draft.exclusions.map((line) => `• ${line}`)].join('\n'));
  }

  return parts.filter(Boolean).join('\n\n').trim();
}

function laborPortion(room: EstimateDraftRoom): number {
  if (room.laborPrice != null) return room.laborPrice;
  if (room.priceIncludesLaborAndMaterials && room.price != null) return room.price;
  if (room.price != null) return room.price;
  return 0;
}

function materialPortion(room: EstimateDraftRoom): number {
  if (room.materialPrice != null) return room.materialPrice;
  return 0;
}

function laborDescription(room: EstimateDraftRoom): string {
  const scope = room.scope?.trim() || room.name;
  if (room.splitIsSuggested) {
    return scope;
  }
  if (room.priceIncludesLaborAndMaterials) {
    return `${scope}\n\n(Price from notes includes labor and materials — split on Labor/Materials steps if needed.)`;
  }
  return scope;
}

function laborLineItemsFromDraft(draft: EstimateAiDraft): Record<string, unknown>[] {
  return draft.rooms.map((room) => {
    const total = laborPortion(room);
    const isCombinedOnly = room.priceIncludesLaborAndMaterials && !room.splitIsSuggested;
    return {
      id: newLineItemId(),
      name: room.name,
      description: laborDescription(room),
      hours: 1,
      rate: total,
      total,
      totalCost: total,
      category: isCombinedOnly ? 'Trade package' : 'Labor',
      section: room.name,
      source: 'ai-draft',
      priceProvidedByUser: room.priceProvidedByUser,
      priceIncludesLaborAndMaterials: room.priceIncludesLaborAndMaterials,
      splitIsSuggested: Boolean(room.splitIsSuggested),
    };
  });
}

function materialLineItemsFromDraft(draft: EstimateAiDraft): Record<string, unknown>[] {
  return draft.rooms
    .filter((room) => materialPortion(room) > 0)
    .map((room) => {
      const total = materialPortion(room);
      return {
        id: newLineItemId(),
        name: `${room.name} — materials`,
        description: room.splitIsSuggested
          ? `Suggested materials split for ${room.name} — adjust after applying.`
          : `Materials for ${room.name}`,
        quantity: 1,
        qty: 1,
        unit: 'lot',
        unitPrice: total,
        cost: total,
        total,
        section: room.name,
        source: 'ai-draft',
        isManual: true,
      };
    });
}

function cartItemFromMaterialLine(item: Record<string, unknown>): Record<string, unknown> {
  const qty = Number(item.quantity || item.qty || 1);
  const unitPrice = Number(item.unitPrice || item.cost || 0);
  const total = Number(item.total) || qty * unitPrice;
  return {
    ...item,
    id: item.id || newLineItemId(),
    name: item.name || item.description || 'Material',
    description: item.description || item.name || 'Material',
    quantity: qty,
    qty,
    unitPrice,
    cost: Number(item.cost) || unitPrice,
    total,
    unit: item.unit || 'ea',
    section: item.section || 'General Materials',
    isManual: item.isManual ?? true,
  };
}

export function applyDraftToEstimate(
  bid: Record<string, unknown>,
  draft: EstimateAiDraft
): ApplyDraftResult {
  const projectType = draft.projectType || 'other';
  const category = PROJECT_CATEGORY_SLUGS[projectType] || PROJECT_CATEGORY_SLUGS.other;
  const scopeDescription = buildScopeDescription(draft);
  const laborLineItems = laborLineItemsFromDraft(draft);
  const materialLineItems = materialLineItemsFromDraft(draft);
  const materialsCart = materialLineItems.map(cartItemFromMaterialLine);

  const nextBid: Record<string, unknown> = {
    ...bid,
    _isNewBid: false,
    title: draft.projectTitle?.trim() || bid.title || '',
    projectType,
    projectCategory: category,
    category,
    scopeDescription: scopeDescription || bid.scopeDescription || '',
    laborLineItems,
    materialLineItems,
  };

  if (draft.customerName?.trim()) {
    nextBid.customerName = draft.customerName.trim();
    nextBid.clientName = draft.customerName.trim();
  }

  return { bid: nextBid, materialsCart };
}
