import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_BID_TEMPLATES_KEY = 'bps.savedBidTemplates';

export type SavedBidTemplateApplyMode = 'create_new' | 'materials_labor';

export type SavedBidTemplatePayload = {
  title?: string;
  projectType?: string;
  projectCategory?: string;
  category?: string;
  scopeDescription?: string;
  sqft?: number;
  unitMode?: string;
  region?: string;
  template?: string;
  budgetRange?: string;
  desiredStartDate?: string;
  startDate?: string;
  endDate?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  customerCompany?: string;
  customerNotes?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  materialLineItems: Record<string, unknown>[];
  laborLineItems: Record<string, unknown>[];
  planCost?: number;
  planCostText?: string;
  permitCost?: number;
  permitCostText?: string;
  engineeringCost?: number;
  financingFees?: number;
  interestCost?: number;
  contingencyAllowance?: number;
  otherDirectCost?: number;
  equipment?: number;
  insuranceOverhead?: number;
  equipmentMaintenance?: number;
  facilities?: number;
  adminOverhead?: number;
  otherOverhead?: number;
  contingencyPct?: number;
  markupPct?: number;
  contractorType?: number | null;
  unionToggle?: boolean;
  zipRate?: number;
  paymentSchedule?: string;
  paymentScheduleVariant?: string;
  weeklyProgressSettings?: unknown;
  milestoneBasedSettings?: unknown;
  paymentMilestones?: Record<string, unknown>[];
  weeklyPayments?: Record<string, unknown>[];
  customPayments?: Record<string, unknown>[];
  license?: boolean;
  insurance?: boolean;
  bond?: boolean;
  osha?: boolean;
  clientUpdates?: string;
  clientTransparency?: string;
  internalChannel?: string;
  zoning?: string;
};

export type SavedBidTemplate = {
  id: string;
  name: string;
  category?: string;
  trade?: string;
  description?: string;
  /** Bid/estimate this template was saved from — used to cascade-delete with the bid. */
  sourceEstimateId?: string;
  payload: SavedBidTemplatePayload;
  estimatedMaterialsTotal: number;
  estimatedLaborTotal: number;
  estimatedBidTotal: number;
  lineItemCount: number;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveBidTemplateInput = {
  name: string;
  category?: string;
  trade?: string;
  description?: string;
};

const CUSTOMER_FIELDS = [
  'customerName',
  'customerEmail',
  'customerPhone',
  'customerAddress',
  'customerCity',
  'customerState',
  'customerZip',
  'customerCompany',
  'customerNotes',
  'clientName',
  'clientEmail',
  'clientPhone',
  'clientCompany',
] as const;

function newLineItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneLineItems<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    id: newLineItemId(),
  }));
}

function sumMaterials(items: Record<string, unknown>[]): number {
  return items.reduce((sum, item) => {
    const total = Number(item.total);
    if (!Number.isNaN(total) && total > 0) return sum + total;
    const qty = Number(item.quantity || item.qty || 0);
    const unit = Number(item.unitPrice || item.cost || 0);
    return sum + qty * unit;
  }, 0);
}

function sumLabor(items: Record<string, unknown>[]): number {
  return items.reduce(
    (sum, item) => sum + (Number(item.total) || Number(item.totalCost) || 0),
    0
  );
}

function normalizeLaborLineItem(item: Record<string, unknown>): Record<string, unknown> {
  const total = Number(item.total) || Number(item.totalCost) || 0;
  const rate = Number(item.rate) || Number(item.unitPrice) || 0;
  const mode = item.mode === 'sqft' ? 'sqft' : item.mode;
  let hours = Number(item.hours ?? item.quantity ?? item.qty ?? 0) || 0;
  if (mode === 'sqft' && hours <= 0 && total > 0 && rate > 0) {
    hours = Math.round(total / rate);
  }
  return {
    ...item,
    mode,
    total,
    totalCost: total,
    hours,
    rate: rate || item.rate,
    name: item.name || item.description || 'Labor',
    description: item.description || item.name || 'Labor',
  };
}

function cloneLaborLineItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return cloneLineItems(items.map(normalizeLaborLineItem));
}

function cartItemFromLineItem(item: Record<string, unknown>): Record<string, unknown> {
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

function lineItemsFromCart(cart: Record<string, unknown>[]): Record<string, unknown>[] {
  return cart.map((item) => ({
    id: item.id || newLineItemId(),
    name: item.name || item.description || 'Material',
    description: item.description || item.name || 'Material',
    quantity: Number(item.qty || item.quantity || 1),
    unit: item.unit || 'ea',
    total: Number(item.total) || 0,
    cost: Number(item.cost) || Number(item.unitPrice) || 0,
    unitPrice: Number(item.unitPrice) || Number(item.cost) || 0,
    section: item.section || 'General Materials',
    scope: item.scope,
    sku: item.sku || '',
    vendorId: item.vendorId || '',
    vendor: item.vendor,
    isManual: item.isManual ?? true,
    mode: item.mode,
  }));
}

export function extractTemplatePayload(
  bid: Record<string, unknown>,
  materialsCart: Record<string, unknown>[]
): SavedBidTemplatePayload {
  const materialLineItems =
    materialsCart.length > 0
      ? lineItemsFromCart(materialsCart)
      : Array.isArray(bid.materialLineItems)
        ? (bid.materialLineItems as Record<string, unknown>[])
        : [];

  const laborLineItems = Array.isArray(bid.laborLineItems)
    ? (bid.laborLineItems as Record<string, unknown>[])
    : [];

  return {
    title: bid.title as string | undefined,
    projectType: bid.projectType as string | undefined,
    projectCategory: bid.projectCategory as string | undefined,
    category: bid.category as string | undefined,
    scopeDescription: bid.scopeDescription as string | undefined,
    sqft: Number(bid.sqft) || 0,
    unitMode: bid.unitMode as string | undefined,
    region: bid.region as string | undefined,
    template: bid.template as string | undefined,
    budgetRange: bid.budgetRange as string | undefined,
    desiredStartDate: bid.desiredStartDate as string | undefined,
    startDate: bid.startDate as string | undefined,
    endDate: bid.endDate as string | undefined,
    customerName: bid.customerName as string | undefined,
    customerEmail: bid.customerEmail as string | undefined,
    customerPhone: bid.customerPhone as string | undefined,
    customerAddress: bid.customerAddress as string | undefined,
    customerCity: bid.customerCity as string | undefined,
    customerState: bid.customerState as string | undefined,
    customerZip: bid.customerZip as string | undefined,
    customerCompany: bid.customerCompany as string | undefined,
    customerNotes: bid.customerNotes as string | undefined,
    clientName: bid.clientName as string | undefined,
    clientEmail: bid.clientEmail as string | undefined,
    clientPhone: bid.clientPhone as string | undefined,
    clientCompany: bid.clientCompany as string | undefined,
    materialLineItems: JSON.parse(JSON.stringify(materialLineItems)),
    laborLineItems: JSON.parse(JSON.stringify(laborLineItems)),
    planCost: Number(bid.planCost) || 0,
    planCostText: bid.planCostText as string | undefined,
    permitCost: Number(bid.permitCost) || 0,
    permitCostText: bid.permitCostText as string | undefined,
    engineeringCost: Number(bid.engineeringCost) || 0,
    financingFees: Number(bid.financingFees) || 0,
    interestCost: Number(bid.interestCost) || 0,
    contingencyAllowance: Number(bid.contingencyAllowance) || 0,
    otherDirectCost: Number(bid.otherDirectCost) || 0,
    equipment: Number(bid.equipment) || 0,
    insuranceOverhead: Number(bid.insuranceOverhead) || 0,
    equipmentMaintenance: Number(bid.equipmentMaintenance) || 0,
    facilities: Number(bid.facilities) || 0,
    adminOverhead: Number(bid.adminOverhead) || 0,
    otherOverhead: Number(bid.otherOverhead) || 0,
    contingencyPct: Number(bid.contingencyPct) || 0,
    markupPct: Number(bid.markupPct) || 0,
    contractorType: bid.contractorType as number | null | undefined,
    unionToggle: Boolean(bid.unionToggle),
    zipRate: Number(bid.zipRate) || 0,
    paymentSchedule: bid.paymentSchedule as string | undefined,
    paymentScheduleVariant: bid.paymentScheduleVariant as string | undefined,
    weeklyProgressSettings: bid.weeklyProgressSettings,
    milestoneBasedSettings: bid.milestoneBasedSettings,
    paymentMilestones: JSON.parse(JSON.stringify(bid.paymentMilestones || [])),
    weeklyPayments: JSON.parse(JSON.stringify(bid.weeklyPayments || [])),
    customPayments: JSON.parse(JSON.stringify(bid.customPayments || [])),
    license: Boolean(bid.license),
    insurance: Boolean(bid.insurance),
    bond: Boolean(bid.bond),
    osha: Boolean(bid.osha),
    clientUpdates: bid.clientUpdates as string | undefined,
    clientTransparency: bid.clientTransparency as string | undefined,
    internalChannel: bid.internalChannel as string | undefined,
    zoning: bid.zoning as string | undefined,
  };
}

export function estimateHasBidBody(
  bid: Record<string, unknown>,
  materialsCart: Record<string, unknown>[]
): boolean {
  const materials =
    materialsCart.length > 0 ||
    (Array.isArray(bid.materialLineItems) && bid.materialLineItems.length > 0);
  const labor = Array.isArray(bid.laborLineItems) && bid.laborLineItems.length > 0;
  const scope = String(bid.scopeDescription || '').trim().length > 0;
  const title = String(bid.title || '').trim().length > 0;
  const costs =
    Number(bid.planCost) > 0 ||
    Number(bid.permitCost) > 0 ||
    Number(bid.equipment) > 0 ||
    Number(bid.engineeringCost) > 0 ||
    Number(bid.otherDirectCost) > 0;
  return materials || labor || scope || title || costs;
}

export function estimateHasLineItemContent(
  bid: Record<string, unknown>,
  materialsCart: Record<string, unknown>[]
): boolean {
  const materials =
    materialsCart.length > 0 ||
    (Array.isArray(bid.materialLineItems) && bid.materialLineItems.length > 0);
  const labor = Array.isArray(bid.laborLineItems) && bid.laborLineItems.length > 0;
  return materials || labor;
}

export function computeTemplateTotals(
  payload: SavedBidTemplatePayload,
  estimatedBidTotal?: number
): {
  materialsTotal: number;
  laborTotal: number;
  lineItemCount: number;
  bidTotal: number;
} {
  const materialsTotal = sumMaterials(payload.materialLineItems);
  const laborTotal = sumLabor(payload.laborLineItems);
  const lineItemCount = payload.materialLineItems.length + payload.laborLineItems.length;
  const directCosts =
    (Number(payload.planCost) || 0) +
    (Number(payload.permitCost) || 0) +
    (Number(payload.engineeringCost) || 0) +
    (Number(payload.equipment) || 0) +
    (Number(payload.otherDirectCost) || 0);
  const overhead =
    (Number(payload.insuranceOverhead) || 0) +
    (Number(payload.equipmentMaintenance) || 0) +
    (Number(payload.facilities) || 0) +
    (Number(payload.adminOverhead) || 0) +
    (Number(payload.otherOverhead) || 0);
  const subtotal = materialsTotal + laborTotal + directCosts + overhead;
  const markupPct = Number(payload.markupPct) || 0;
  const computedTotal = subtotal * (1 + markupPct / 100);
  return {
    materialsTotal,
    laborTotal,
    lineItemCount,
    bidTotal: estimatedBidTotal && estimatedBidTotal > 0 ? estimatedBidTotal : computedTotal,
  };
}

export async function loadSavedBidTemplates(): Promise<SavedBidTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_BID_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortTemplates(parsed as SavedBidTemplate[]);
  } catch {
    return [];
  }
}

async function persistSavedBidTemplates(templates: SavedBidTemplate[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_BID_TEMPLATES_KEY, JSON.stringify(templates));
}

function sortTemplates(templates: SavedBidTemplate[]): SavedBidTemplate[] {
  return [...templates].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function saveBidTemplateFromEstimate(
  bid: Record<string, unknown>,
  materialsCart: Record<string, unknown>[],
  input: SaveBidTemplateInput,
  estimatedBidTotal?: number
): Promise<SavedBidTemplate[]> {
  const name = String(input.name || '').trim();
  if (!name) return loadSavedBidTemplates();

  const payload = extractTemplatePayload(bid, materialsCart);
  const totals = computeTemplateTotals(payload, estimatedBidTotal);
  const now = new Date().toISOString();

  const list = await loadSavedBidTemplates();
  const sourceEstimateId = String(bid.id || '').trim() || undefined;
  const template: SavedBidTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    category: String(input.category || input.trade || '').trim() || undefined,
    trade: String(input.trade || input.category || '').trim() || undefined,
    description: String(input.description || '').trim() || undefined,
    sourceEstimateId,
    payload,
    estimatedMaterialsTotal: totals.materialsTotal,
    estimatedLaborTotal: totals.laborTotal,
    estimatedBidTotal: totals.bidTotal,
    lineItemCount: totals.lineItemCount,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await persistSavedBidTemplates([template, ...list]);
  return loadSavedBidTemplates();
}

export async function deleteSavedBidTemplate(templateId: string): Promise<SavedBidTemplate[]> {
  const list = await loadSavedBidTemplates();
  const next = list.filter((t) => t.id !== templateId);
  await persistSavedBidTemplates(next);
  return next;
}

/** Remove templates saved from a deleted bid/estimate. */
export async function deleteSavedBidTemplatesForEstimate(
  estimateId: string
): Promise<SavedBidTemplate[]> {
  const id = String(estimateId || '').trim();
  if (!id) return loadSavedBidTemplates();
  const list = await loadSavedBidTemplates();
  const next = list.filter((t) => t.sourceEstimateId !== id);
  if (next.length === list.length) return list;
  await persistSavedBidTemplates(next);
  return next;
}

/** Wipe every saved bid template on this device. */
export async function clearAllSavedBidTemplates(): Promise<SavedBidTemplate[]> {
  await persistSavedBidTemplates([]);
  return [];
}

export async function recordTemplateUsage(templateId: string): Promise<SavedBidTemplate[]> {
  const list = await loadSavedBidTemplates();
  const now = new Date().toISOString();
  const next = list.map((t) =>
    t.id === templateId
      ? {
          ...t,
          usageCount: (t.usageCount || 0) + 1,
          lastUsedAt: now,
          updatedAt: now,
        }
      : t
  );
  await persistSavedBidTemplates(next);
  return next;
}

function preserveCustomerFields(bid: Record<string, unknown>): Record<string, unknown> {
  const preserved: Record<string, unknown> = {
    id: bid.id,
    title: bid.title,
    status: bid.status,
    leadId: bid.leadId,
    leadSource: bid.leadSource,
    startDate: bid.startDate,
    endDate: bid.endDate,
  };
  for (const key of CUSTOMER_FIELDS) {
    preserved[key] = bid[key];
  }
  return preserved;
}

function bidHasCustomerInfo(bid: Record<string, unknown>): boolean {
  return Boolean(
    String(bid.customerName || bid.clientName || '').trim() ||
      String(bid.customerEmail || bid.clientEmail || '').trim() ||
      String(bid.customerPhone || bid.clientPhone || '').trim() ||
      String(bid.customerAddress || '').trim()
  );
}

function extractCustomerFields(source: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of CUSTOMER_FIELDS) {
    fields[key] = source[key] ?? '';
  }
  return fields;
}

/** Keep in-bid customer when present; otherwise fill from template payload. */
function resolveCustomerForApply(
  bid: Record<string, unknown>,
  payload: SavedBidTemplatePayload
): Record<string, unknown> {
  const payloadRecord = payload as Record<string, unknown>;

  // Applying a template should populate Step 1 from the saved package when it has customer info.
  if (bidHasCustomerInfo(payloadRecord)) {
    return extractCustomerFields(payloadRecord);
  }

  if (bidHasCustomerInfo(bid)) {
    return extractCustomerFields(bid);
  }

  return extractCustomerFields(payloadRecord);
}

export function templatePayloadHasCustomer(payload: SavedBidTemplatePayload): boolean {
  return bidHasCustomerInfo(payload as Record<string, unknown>);
}

function createBlankBidShell(preserved: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(Date.now()),
    title: '',
    sqft: 0,
    region: 'NV',
    template: '',
    projectType: 'kitchen',
    projectCategory: undefined,
    category: 'kitchen-remodel',
    scopeDescription: '',
    unitMode: 'sqft',
    materialLineItems: [],
    laborLineItems: [],
    markupPct: 20,
    contingencyPct: 7,
    paymentSchedule: 'weekly',
    paymentScheduleVariant: undefined,
    paymentMilestones: [],
    weeklyPayments: [],
    customPayments: [],
    planCost: 0,
    permitCost: 0,
    engineeringCost: 0,
    equipment: 0,
    insuranceOverhead: 0,
    equipmentMaintenance: 0,
    facilities: 0,
    adminOverhead: 0,
    otherOverhead: 0,
    contractorType: null,
    unionToggle: false,
    status: undefined,
    leadId: undefined,
    leadSource: undefined,
    ...preserved,
  };
}

function applyProjectInfoFromPayload(
  baseBid: Record<string, unknown>,
  payload: SavedBidTemplatePayload
): Record<string, unknown> {
  return {
    ...baseBid,
    title: payload.title ?? baseBid.title ?? '',
    projectType: payload.projectType ?? baseBid.projectType,
    projectCategory: payload.projectCategory ?? baseBid.projectCategory,
    category: payload.category ?? baseBid.category,
    scopeDescription: payload.scopeDescription ?? '',
    sqft: payload.sqft ?? 0,
    unitMode: payload.unitMode ?? baseBid.unitMode,
    region: payload.region ?? baseBid.region,
    template: payload.template ?? '',
    budgetRange: payload.budgetRange ?? '',
    desiredStartDate: payload.desiredStartDate ?? '',
    startDate: payload.startDate ?? baseBid.startDate ?? '',
    endDate: payload.endDate ?? baseBid.endDate ?? '',
    zoning: payload.zoning ?? baseBid.zoning,
    clientUpdates: payload.clientUpdates ?? baseBid.clientUpdates,
    clientTransparency: payload.clientTransparency ?? baseBid.clientTransparency,
    internalChannel: payload.internalChannel ?? baseBid.internalChannel,
    license: payload.license ?? baseBid.license,
    insurance: payload.insurance ?? baseBid.insurance,
    bond: payload.bond ?? baseBid.bond,
    osha: payload.osha ?? baseBid.osha,
  };
}

function buildBidFromPayload(
  baseBid: Record<string, unknown>,
  payload: SavedBidTemplatePayload
): Record<string, unknown> {
  const materialLineItems = cloneLineItems(payload.materialLineItems);
  const laborLineItems = cloneLaborLineItems(payload.laborLineItems);
  const withProjectInfo = applyProjectInfoFromPayload(baseBid, payload);

  return {
    ...withProjectInfo,
    materialLineItems,
    laborLineItems,
    planCost: Number(payload.planCost) || 0,
    planCostText: payload.planCostText ?? '',
    permitCost: Number(payload.permitCost) || 0,
    permitCostText: payload.permitCostText ?? '',
    engineeringCost: Number(payload.engineeringCost) || 0,
    financingFees: Number(payload.financingFees) || 0,
    interestCost: Number(payload.interestCost) || 0,
    contingencyAllowance: Number(payload.contingencyAllowance) || 0,
    otherDirectCost: Number(payload.otherDirectCost) || 0,
    equipment: Number(payload.equipment) || 0,
    insuranceOverhead: Number(payload.insuranceOverhead) || 0,
    equipmentMaintenance: Number(payload.equipmentMaintenance) || 0,
    facilities: Number(payload.facilities) || 0,
    adminOverhead: Number(payload.adminOverhead) || 0,
    otherOverhead: Number(payload.otherOverhead) || 0,
    contingencyPct: Number(payload.contingencyPct) || 0,
    markupPct: Number(payload.markupPct) || 0,
    contractorType: payload.contractorType ?? null,
    unionToggle: Boolean(payload.unionToggle),
    zipRate: Number(payload.zipRate) || 0,
    paymentSchedule: payload.paymentSchedule ?? 'weekly',
    paymentScheduleVariant: payload.paymentScheduleVariant,
    weeklyProgressSettings: payload.weeklyProgressSettings,
    milestoneBasedSettings: payload.milestoneBasedSettings,
    paymentMilestones: cloneLineItems(payload.paymentMilestones || []),
    weeklyPayments: cloneLineItems(payload.weeklyPayments || []),
    customPayments: cloneLineItems(payload.customPayments || []),
    license: payload.license ?? true,
    insurance: payload.insurance ?? true,
    bond: payload.bond ?? false,
    osha: payload.osha ?? false,
    _isNewBid: false,
  };
}

export function applySavedBidTemplate(
  bid: Record<string, unknown>,
  materialsCart: Record<string, unknown>[],
  template: SavedBidTemplate,
  mode: SavedBidTemplateApplyMode
): { bid: Record<string, unknown>; materialsCart: Record<string, unknown>[] } {
  const payload: SavedBidTemplatePayload = {
    ...template.payload,
    title: template.payload.title || template.name,
  };

  const customerFields = resolveCustomerForApply(bid, payload);
  const baseBid =
    mode === 'create_new'
      ? createBlankBidShell(customerFields)
      : { ...bid, ...customerFields };

  const nextBid = buildBidFromPayload(baseBid, payload);
  const nextCart = cloneLineItems(payload.materialLineItems).map(cartItemFromLineItem);

  return {
    bid: nextBid,
    materialsCart: nextCart,
  };
}

export function formatTemplateMoney(value: number): string {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatTemplateCategory(template: SavedBidTemplate): string {
  return template.category || template.trade || 'General';
}

export function formatTemplateUsageLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return 'Use';
  if (n >= 9) return '9+ uses';
  return n === 1 ? 'Used 1×' : `Used ${n}×`;
}
